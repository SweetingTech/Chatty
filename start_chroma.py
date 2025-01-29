import chromadb
from chromadb.config import Settings
import uvicorn
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Dict, Optional, Union
import json
import time
import httpx
import os
import traceback
from dotenv import load_dotenv
from pydantic import BaseModel
import onnxruntime as ort
from fastapi.responses import Response, StreamingResponse
import socket
import psutil
import sys
import openai
from openai import OpenAI
import anthropic
from anthropic import Anthropic

import hashlib  # For generating cache keys

# Model configurations
class ModelCapabilities(BaseModel):
    contextWindow: int
    maxOutputTokens: int
    supportsFunctionCalling: bool
    supportsVision: bool
    supportsJson: bool
    supportsReasoning: bool

class ModelInfo(BaseModel):
    id: str
    name: str
    capabilities: ModelCapabilities

class LLMMessage(BaseModel):
    role: str
    content: str
    name: Optional[str] = None

class LLMRequest(BaseModel):
    messages: List[LLMMessage]
    model: Optional[str] = None
    temperature: Optional[float] = 0.7
    max_tokens: Optional[int] = None
    tools: Optional[List[Dict]] = None
    tool_choice: Optional[Dict] = None
    response_format: Optional[Dict] = None
    stream: Optional[bool] = False

class LLMResponse(BaseModel):
    id: str
    model: str
    content: str
    finish_reason: Optional[str] = None
    usage: Optional[Dict] = None

class Message(BaseModel):
    id: str
    role: str
    content: str
    timestamp: int

class CollectionModel(BaseModel):
    name: str
    metadata: Optional[Dict] = {}

class GetRequest(BaseModel):
    ids: Optional[List[str]] = None
    limit: Optional[int] = None

def is_port_in_use(port: int) -> bool:
    """Check if a port is in use."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        try:
            s.bind(('localhost', port))
            return False
        except socket.error:
            return True

def kill_process_on_port(port: int) -> bool:
    """Kill process using the specified port."""
    for proc in psutil.process_iter(['pid', 'name']):
        try:
            for conn in proc.connections('inet'):
                if conn.laddr.port == port:
                    proc.kill()
                    return True
        except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
            pass
    return False

# Load environment variables
load_dotenv()

# Get configuration from environment
CHROMA_HOST = os.getenv('CHROMA_HOST', 'localhost')
CHROMA_PORT = int(os.getenv('CHROMA_PORT', '8001'))
COLLECTION_NAME = os.getenv('CHROMA_COLLECTION_NAME', 'chat_sessions')

# Provider configurations
LMSTUDIO_HOST = os.getenv('LMSTUDIO_HOST', 'localhost')
LMSTUDIO_PORT = int(os.getenv('LMSTUDIO_PORT', '1234'))
LMSTUDIO_BASE_URL = f"http://{LMSTUDIO_HOST}:{LMSTUDIO_PORT}"

OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')
CLAUDE_API_KEY = os.getenv('CLAUDE_API_KEY')
DEEPSEEK_API_KEY = os.getenv('DEEPSEEK_API_KEY')

# Initialize FastAPI app
app = FastAPI()

# Add CORS middleware
ALLOWED_ORIGINS = os.getenv('ALLOWED_ORIGINS', '*')
app.add_middleware(
    CORSMiddleware,
    allow_origins=[ALLOWED_ORIGINS],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=86400
)

# Initialize ChromaDB client
client = chromadb.PersistentClient(
    path="./chroma_data",
    settings=Settings(
        anonymized_telemetry=False,
        allow_reset=True,
        is_persistent=True
    )
)

# Default collections
DEFAULT_COLLECTIONS = [
    {
        'name': 'chat_sessions',
        'description': 'Stores chat session history and metadata'
    },
    {
        'name': 'agent_modifications',
        'description': 'Stores modifications to default agents'
    },
    {
        'name': 'tool_modifications',
        'description': 'Stores modifications to default tools'
    },
    {
        'name': 'additional_agents',
        'description': 'Stores additional custom agents'
    },
    {
        'name': 'additional_tools',
        'description': 'Stores additional custom tools'
    },
    {
        'name': 'user_settings',
        'description': 'Stores user settings and API keys',
        'initial_data': {
            'ids': ['api_keys'],
            'metadatas': [{'timestamp': int(time.time() * 1000), 'type': 'settings'}],
            'documents': [json.dumps({
                'openaiKey': os.getenv('VITE_OPENAI_API_KEY', ''),
                'claudeKey': os.getenv('VITE_CLAUDE_API_KEY', ''),
                'deepseekKey': os.getenv('VITE_DEEPSEEK_API_KEY', ''),
                'lmStudioHost': os.getenv('VITE_LM_STUDIO_HOST', 'localhost'),
                'lmStudioPort': os.getenv('VITE_LM_STUDIO_PORT', '1234')
            })]
        }
    }
]

def ensure_collections(retries=5, delay=1):
    """Create all required collections if they don't exist."""
    print("Initializing collections...")
    for collection_info in DEFAULT_COLLECTIONS:
        collection = None
        for attempt in range(retries):
            try:
                # Try to create collection directly
                try:
                    collection = client.create_collection(
                        name=collection_info['name'],
                        metadata={
                            'description': collection_info['description'],
                            'hnsw:space': 'cosine',
                            'hnsw:construction_ef': 100,
                            'hnsw:search_ef': 50
                        }
                    )
                    print(f"Created collection {collection_info['name']}")
                except Exception as e:
                    if "already exists" in str(e):
                        collection = client.get_collection(collection_info['name'])
                        print(f"Collection {collection_info['name']} already exists")
                    else:
                        raise

                # Add initial data if needed
                if collection and 'initial_data' in collection_info:
                    try:
                        existing = collection.get(ids=collection_info['initial_data']['ids'])
                        if not existing['ids']:
                            collection.add(**collection_info['initial_data'])
                            print(f"Added initial data to {collection_info['name']}")
                        else:
                            print(f"Initial data already exists in {collection_info['name']}")
                    except Exception as e:
                        print(f"Warning: Failed to add initial data to {collection_info['name']}: {str(e)}")

                break

            except Exception as e:
                if attempt == retries - 1:
                    print(f"Error ensuring collection {collection_info['name']} after {retries} attempts: {str(e)}")
                    raise
                print(f"Attempt {attempt + 1} failed, retrying in {delay} seconds...")
                time.sleep(delay)

@app.on_event("startup")
async def startup_event():
    try:
        # Create collections before starting API
        ensure_collections()
        print("ChromaDB server ready to accept connections")
    except Exception as e:
        print(f"Failed to initialize ChromaDB: {str(e)}")
        print("Server will continue starting - collections will be created on demand")

@app.get("/")
async def root():
    return {"status": "ok", "message": "ChromaDB server is running"}

@app.get("/heartbeat")
async def heartbeat():
    try:
        client.heartbeat()
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.head("/heartbeat")
async def heartbeat_head():
    try:
        client.heartbeat()
        return Response(status_code=200)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# -------------------------------------------------------------------------
# Provider-specific endpoints
# -------------------------------------------------------------------------

async def forward_to_lm_studio(data: dict) -> dict:
    """Forward request to LM Studio and return response"""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{LMSTUDIO_BASE_URL}/v1/chat/completions",
            json=data
        )
        response.raise_for_status()
        return response.json()

async def forward_to_openai(data: dict) -> dict:
    """Forward request to OpenAI API and return response"""
    client = OpenAI(api_key=OPENAI_API_KEY)
    response = await client.chat.completions.create(**data)
    return response

async def forward_to_claude(data: dict) -> dict:
    """Forward request to Claude API and return response"""
    client = Anthropic(api_key=CLAUDE_API_KEY)
    response = await client.messages.create(**data)
    return response

async def forward_to_deepseek(data: dict) -> dict:
    """Forward request to Deepseek API and return response"""
    headers = {"Authorization": f"Bearer {DEEPSEEK_API_KEY}"}
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://api.deepseek.com/v1/chat/completions",
            json=data,
            headers=headers
        )
        response.raise_for_status()
        return response.json()

@app.get("/llm/{provider}/models")
async def list_models(provider: str):
    """Get available models for a provider"""
    try:
        if provider == "lm-studio":
            async with httpx.AsyncClient() as client:
                response = await client.get(f"{LMSTUDIO_BASE_URL}/v1/models")
                return response.json()
        elif provider == "openai":
            client = OpenAI(api_key=OPENAI_API_KEY)
            models = client.models.list()
            return {"models": [{"id": model.id} for model in models.data]}
        elif provider == "claude":
            return {
                "models": [
                    {"id": "claude-3-opus-20240229"},
                    {"id": "claude-3-sonnet-20240229"},
                    {"id": "claude-3-haiku-20240307"}
                ]
            }
        elif provider == "deepseek":
            return {
                "models": [
                    {"id": "deepseek-coder-33b-instruct"},
                    {"id": "deepseek-coder-6.7b-instruct"},
                    {"id": "deepseek-chat"},
                    {"id": "deepseek-chat-medium"}
                ]
            }
        else:
            raise HTTPException(status_code=400, detail="Invalid provider")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/llm/lm-studio/models")
async def list_lm_studio_models(request: Request):
    """Get available models from LM Studio"""
    try:
        data = await request.json()
        host = data.get('host', 'localhost')
        port = data.get('port', '1234')
        
        async with httpx.AsyncClient() as client:
            response = await client.get(f"http://{host}:{port}/v1/models")
            if not response.ok:
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"LM Studio API error: {response.text}"
                )
            return response.json()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/llm/{provider}")
async def provider_chat(provider: str, request: Request):
    """Handle chat requests for any provider"""
    try:
        data = await request.json()
        stream = data.get('stream', False)
        
        # If streaming is requested, handle differently
        if stream:
            return StreamingResponse(
                stream_provider_chat(provider, data),
                media_type='text/event-stream'
            )
        
        # Check cache for non-streaming requests
        messages_json = json.dumps(data, sort_keys=True)
        cached = get_cached_response(messages_json)
        if cached:
            return json.loads(cached)
        
        # Forward to appropriate provider
        if provider == "lm-studio":
            # Extract LM Studio connection details
            lm_studio = data.pop('lmStudio', {})
            host = lm_studio.get('host', 'localhost')
            port = lm_studio.get('port', '1234')
            
            # Forward to LM Studio
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"http://{host}:{port}/v1/chat/completions",
                    json=data
                )
                if not response.ok:
                    raise HTTPException(
                        status_code=response.status_code,
                        detail=f"LM Studio API error: {response.text}"
                    )
                result = response.json()
        elif provider == "openai":
            result = await forward_to_openai(data)
        elif provider == "claude":
            result = await forward_to_claude(data)
        elif provider == "deepseek":
            result = await forward_to_deepseek(data)
        else:
            raise HTTPException(status_code=400, detail="Invalid provider")
        
        # Cache response
        store_cached_response(messages_json, json.dumps(result))
        
        return result

async def stream_provider_chat(provider: str, data: dict):
    """Handle streaming chat requests for any provider"""
    try:
        if provider == "lm-studio":
            # Extract LM Studio connection details
            lm_studio = data.pop('lmStudio', {})
            host = lm_studio.get('host', 'localhost')
            port = lm_studio.get('port', '1234')
            
            # Forward to LM Studio with streaming
            async with httpx.AsyncClient() as client:
                async with client.stream(
                    'POST',
                    f"http://{host}:{port}/v1/chat/completions",
                    json=data
                ) as response:
                    if not response.ok:
                        error_text = await response.text()
                        raise HTTPException(
                            status_code=response.status_code,
                            detail=f"LM Studio API error: {error_text}"
                        )
                    
                    async for line in response.aiter_lines():
                        if line.startswith('data: '):
                            yield line + '\n'
        else:
            raise HTTPException(status_code=400, detail="Streaming not supported for this provider")
    except HTTPException as e:
        yield f"data: {json.dumps({'error': str(e.detail)})}\n\n"
    except Exception as e:
        yield f"data: {json.dumps({'error': str(e)})}\n\n"

# -------------------------------------------------------------------------
# Caching functions
# -------------------------------------------------------------------------

def generate_cache_key(messages_json: str) -> str:
    """Generate a stable hash from messages JSON"""
    return hashlib.md5(messages_json.encode('utf-8')).hexdigest()

def get_cached_response(messages_json: str) -> Optional[str]:
    """Get cached response if it exists"""
    cache_id = f"cache-{generate_cache_key(messages_json)}"
    collection = client.get_collection('chat_sessions')
    result = collection.get(ids=[cache_id])
    if result and result['ids']:
        return result['documents'][0]
    return None

def store_cached_response(messages_json: str, response_str: str):
    """Store response in cache"""
    cache_id = f"cache-{generate_cache_key(messages_json)}"
    collection = client.get_collection('chat_sessions')
    collection.delete(ids=[cache_id])
    collection.add(
        ids=[cache_id],
        documents=[response_str],
        metadatas=[{
            'timestamp': int(time.time() * 1000),
            'type': 'chat_cache'
        }]
    )

# -------------------------------------------------------------------------
# Session Management
# -------------------------------------------------------------------------

@app.get("/sessions")
async def get_sessions():
    """Get all chat sessions"""
    try:
        collection = client.get_collection('chat_sessions')
        result = collection.get()
        sessions = []
        for i, doc in enumerate(result['documents']):
            try:
                messages = json.loads(doc) if isinstance(doc, str) else doc
                metadata = result['metadatas'][i] or {}
                sessions.append({
                    'id': result['ids'][i],
                    'messages': messages,
                    'metadata': metadata
                })
            except json.JSONDecodeError as e:
                print(f"Error parsing session document: {e}")
                continue
        return sessions
    except ValueError:
        return []
    except Exception as e:
        print(f"Error getting sessions: {str(e)}")
        return []

@app.get("/sessions/{session_id}")
async def get_session(session_id: str):
    """Get a specific chat session"""
    try:
        collection = client.get_collection('chat_sessions')
        result = collection.get(ids=[session_id])
        
        if not result['ids']:
            raise HTTPException(status_code=404, detail="Session not found")
            
        doc = result['documents'][0]
        messages = json.loads(doc) if isinstance(doc, str) else doc
        return {
            'id': session_id,
            'messages': messages,
            'metadata': result['metadatas'][0] or {}
        }
    except ValueError:
        raise HTTPException(status_code=404, detail="Chat sessions collection not found")
    except Exception as e:
        print(f"Error getting session: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/sessions")
async def create_session(request: Request):
    """Create or update a chat session"""
    try:
        data = await request.json()
        session_id = data.get('id')
        messages = data.get('messages', [])
        metadata = data.get('metadata', {})
        
        if not session_id:
            raise HTTPException(status_code=400, detail="Session ID is required")
            
        collection = client.get_collection('chat_sessions')
        
        # Delete existing session if it exists
        try:
            collection.delete(ids=[session_id])
        except Exception:
            pass  # ignore if session doesn't exist
            
        # Add new session
        collection.add(
            ids=[session_id],
            documents=[json.dumps(messages) if isinstance(messages, list) else messages],
            metadatas=[{
                **metadata,
                'timestamp': int(time.time() * 1000),
                'type': 'chat_session'
            }]
        )
        
        return {"status": "success", "id": session_id}
    except ValueError:
        raise HTTPException(status_code=404, detail="Chat sessions collection not found")
    except Exception as e:
        print(f"Error creating/updating session: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/sessions/{session_id}")
async def delete_session(session_id: str):
    """Delete a chat session"""
    try:
        collection = client.get_collection('chat_sessions')
        collection.delete(ids=[session_id])
        return {"status": "success"}
    except ValueError:
        raise HTTPException(status_code=404, detail="Chat sessions collection not found")
    except Exception as e:
        print(f"Error deleting session: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# -------------------------------------------------------------------------
# MAIN
# -------------------------------------------------------------------------
if __name__ == "__main__":
    print(f"Starting ChromaDB server on {CHROMA_HOST}:{CHROMA_PORT}...")
    print(f"Using collection: {COLLECTION_NAME}")
    print(f"LM Studio URL: {LMSTUDIO_BASE_URL}")

    if is_port_in_use(CHROMA_PORT):
        print(f"Port {CHROMA_PORT} is already in use. Attempting to kill existing process...")
        if kill_process_on_port(CHROMA_PORT):
            print("Successfully killed existing process")
        else:
            print("Failed to kill existing process")
            sys.exit(1)
    
    uvicorn.run(app, host=CHROMA_HOST, port=CHROMA_PORT)
