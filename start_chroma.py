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

# LLM Models
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

# Model configurations
OPENAI_MODEL_CONFIGS = {
    # GPT-4 Turbo
    'gpt-4-turbo': {
        'name': 'GPT-4 Turbo',
        'capabilities': {
            'contextWindow': 128000,
            'maxOutputTokens': 4096,
            'supportsFunctionCalling': True,
            'supportsVision': False,
            'supportsJson': True,
            'supportsReasoning': False
        }
    },
    'gpt-4-0125-preview': {
        'name': 'GPT-4 Turbo Preview',
        'capabilities': {
            'contextWindow': 128000,
            'maxOutputTokens': 4096,
            'supportsFunctionCalling': True,
            'supportsVision': False,
            'supportsJson': True,
            'supportsReasoning': False
        }
    },
    # GPT-4
    'gpt-4': {
        'name': 'GPT-4',
        'capabilities': {
            'contextWindow': 8192,
            'maxOutputTokens': 8192,
            'supportsFunctionCalling': True,
            'supportsVision': False,
            'supportsJson': False,
            'supportsReasoning': False
        }
    },
    # GPT-3.5 Turbo
    'gpt-3.5-turbo-0125': {
        'name': 'GPT-3.5 Turbo',
        'capabilities': {
            'contextWindow': 16385,
            'maxOutputTokens': 4096,
            'supportsFunctionCalling': True,
            'supportsVision': False,
            'supportsJson': True,
            'supportsReasoning': False
        }
    }
}

CLAUDE_MODEL_CONFIGS = {
    'claude-3-opus-20240229': {
        'name': 'Claude 3 Opus',
        'capabilities': {
            'contextWindow': 200000,
            'maxOutputTokens': 4096,
            'supportsFunctionCalling': True,
            'supportsVision': True,
            'supportsJson': True,
            'supportsReasoning': True
        }
    },
    'claude-3-sonnet-20240229': {
        'name': 'Claude 3 Sonnet',
        'capabilities': {
            'contextWindow': 200000,
            'maxOutputTokens': 4096,
            'supportsFunctionCalling': True,
            'supportsVision': True,
            'supportsJson': True,
            'supportsReasoning': True
        }
    },
    'claude-3-haiku-20240307': {
        'name': 'Claude 3 Haiku',
        'capabilities': {
            'contextWindow': 200000,
            'maxOutputTokens': 4096,
            'supportsFunctionCalling': True,
            'supportsVision': True,
            'supportsJson': True,
            'supportsReasoning': True
        }
    }
}

# Initialize LLM clients (disabled for now since we only need ChromaDB)
openai_client = None
anthropic_client = None

# Load environment variables
load_dotenv()

# Get configuration from environment
CHROMA_HOST = os.getenv('CHROMA_HOST', 'localhost')
CHROMA_PORT = int(os.getenv('CHROMA_PORT', '8001'))
COLLECTION_NAME = os.getenv('CHROMA_COLLECTION_NAME', 'chat_sessions')

# LM Studio Configuration
LM_STUDIO_HOST = os.getenv('LM_STUDIO_HOST', 'localhost')
LM_STUDIO_PORT = int(os.getenv('LM_STUDIO_PORT', '1234'))

# Initialize LLM clients (disabled for now since we only need ChromaDB)
openai_client = None
anthropic_client = None

def kill_process_on_port(port: int):
    for proc in psutil.process_iter(['pid', 'name']):
        try:
            for conn in proc.connections('inet'):
                if conn.laddr.port == port:
                    proc.kill()
                    return True
        except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
            pass
    return False

def is_port_in_use(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        try:
            s.bind(('localhost', port))
            return False
        except socket.error:
            return True

# Create FastAPI app
app = FastAPI()

# Add CORS middleware with specific allowed origins
# Get allowed origins from environment or use defaults
ALLOWED_ORIGINS = os.getenv('ALLOWED_ORIGINS', '*')

# Add CORS middleware with enhanced browser support
app.add_middleware(
    CORSMiddleware,
    allow_origins=[ALLOWED_ORIGINS],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=86400  # Cache preflight requests for 24 hours
)

# Enhanced collection settings for better persistence
COLLECTION_SETTINGS = {
    "description": "Stores chat session history",
    "hnsw:space": "cosine",
    "hnsw:construction_ef": 100,
    "hnsw:search_ef": 50
}

# Set ONNX Runtime providers to use GPU
providers = ort.get_available_providers()
print("Available ONNX Runtime providers:", providers)

# Initialize ChromaDB client in local mode
client = chromadb.PersistentClient(
    path="./chroma_data",  # Persistent storage
    settings=Settings(
        anonymized_telemetry=False,
        allow_reset=True,
        is_persistent=True
    )
)

# Ensure chat_sessions collection exists with proper settings
try:
    # Try to get existing collection
    chat_collection = client.get_collection('chat_sessions')
    
    # Update collection settings if needed
    if chat_collection.metadata != COLLECTION_SETTINGS:
        client.delete_collection('chat_sessions')
        chat_collection = client.create_collection(
            name='chat_sessions',
            metadata=COLLECTION_SETTINGS
        )
except ValueError:
    # Create new collection with enhanced settings
    chat_collection = client.create_collection(
        name='chat_sessions',
        metadata=COLLECTION_SETTINGS
    )

# Initialize default collections
default_collections = {
    'chat_sessions': 'Stores chat session history',
    'agent_modifications': 'Stores modifications to default agents',
    'tool_modifications': 'Stores modifications to default tools'
}

for name, description in default_collections.items():
    try:
        client.get_or_create_collection(
            name=name,
            metadata={"description": description},
            embedding_function=None  # Use default embedding function
        )
    except Exception as e:
        print(f"Error creating collection {name}: {str(e)}")

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

@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    response = await call_next(request)
    response.headers["Content-Type"] = "application/json"
    return response

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

@app.post("/collections")
async def create_collection(collection_data: CollectionModel):
    try:
        # Check if collection already exists
        existing_collections = client.list_collections()
        if any(c.name == collection_data.name for c in existing_collections):
            raise HTTPException(status_code=400, detail="Collection already exists")

        # Create new collection
        new_collection = client.create_collection(
            name=collection_data.name,
            metadata=collection_data.metadata
        )

        # Return collection info
        return {
            "status": "success",
            "collection": {
                "name": new_collection.name,
                "metadata": new_collection.metadata,
                "documents": []
            }
        }
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Error creating collection: {str(e)}")
        print(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/collections")
async def list_collections():
    try:
        collections = client.list_collections()
        return [{
            "name": collection.name,
            "metadata": collection.metadata,
            "documents": []
        } for collection in collections]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/collections/{collection_name}")
async def get_collection(collection_name: str):
    try:
        collection = client.get_collection(collection_name)
        return {
            "name": collection.name,
            "metadata": collection.metadata,
            "documents": []
        }
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Collection {collection_name} not found")

@app.get("/collections/{collection_name}/get")
async def get_collection_documents(collection_name: str):
    try:
        collection = client.get_collection(collection_name)
        result = collection.get()
        return {
            "ids": result["ids"],
            "documents": result["documents"],
            "metadatas": result["metadatas"]
        }
    except Exception as e:
        print(f"Error getting documents: {str(e)}")
        print(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=404, detail=f"Failed to get documents from collection {collection_name}")

@app.post("/collections/{collection_name}/add")
async def add_documents(collection_name: str, request: Request):
    try:
        data = await request.json()
        collection = client.get_collection(collection_name)
        collection.add(
            ids=data["ids"],
            metadatas=data["metadatas"],
            documents=data["documents"]
        )
        return {"status": "success"}
    except Exception as e:
        print(f"Error adding documents: {str(e)}")
        print(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/collections/{collection_name}")
async def delete_collection(collection_name: str):
    try:
        client.delete_collection(name=collection_name)
        return {"status": "success", "message": f"Collection {collection_name} deleted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/collections/{collection_name}/delete")
async def delete_documents(collection_name: str, request: Request):
    try:
        data = await request.json()
        collection = client.get_collection(collection_name)
        collection.delete(ids=data["ids"])
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/sessions/{session_id}")
async def save_session(session_id: str, request: Request):
    try:
        # Get client and browser identifiers
        client_id = request.headers.get("X-Client-ID", "unknown")
        browser_id = request.headers.get("X-Browser-ID", "unknown")
        
        print(f"Debug - Saving session {session_id} for client {client_id}, browser {browser_id}")
        
        # Parse request body
        body = await request.json()
        messages = body if isinstance(body, list) else [body]
        
        print(f"Debug - Received {len(messages)} messages")
        
        # Validate messages
        for msg in messages:
            if not all(key in msg for key in ["id", "role", "content", "timestamp"]):
                print(f"Debug - Invalid message format: {msg}")
                raise HTTPException(status_code=422, detail="Invalid message format")
            
            # Ensure timestamps are integers
            msg["timestamp"] = int(msg["timestamp"])
        
        # First verify the collection exists
        try:
            collection = client.get_collection('chat_sessions')
            print("Debug - Successfully got chat_sessions collection")
        except ValueError as e:
            print(f"Debug - Collection error: {str(e)}")
            # Create collection if it doesn't exist
            collection = client.create_collection(
                name='chat_sessions',
                metadata={"description": "Stores chat session history"}
            )
            print("Debug - Created new chat_sessions collection")
        
        current_time = int(time.time() * 1000)
        
        try:
            # Get existing session with full metadata
            print(f"Debug - Checking for existing session {session_id}")
            existing = collection.get(
                ids=[session_id],
                include=['documents', 'metadatas']
            )
            
            metadata = {
                "timestamp": current_time,
                "last_updated": current_time,
                "type": "chat_session",
                "client_id": client_id,
                "browser_id": browser_id,
                "update_count": 1
            }
            
            if existing['metadatas']:
                try:
                    print(f"Debug - Found existing session, merging messages")
                    existing_messages = json.loads(existing['documents'][0])
                    existing_metadata = existing['metadatas'][0]
                    
                    # Create message ID lookup
                    message_ids = {msg['id'] for msg in messages}
                    
                    # Merge messages, keeping newer versions of duplicates
                    for msg in existing_messages:
                        if msg['id'] not in message_ids:
                            messages.append(msg)
                    
                    # Update metadata
                    metadata.update({
                        "update_count": existing_metadata.get("update_count", 0) + 1,
                        "browsers": list(set([browser_id] + existing_metadata.get("browsers", []))),
                        "clients": list(set([client_id] + existing_metadata.get("clients", [])))
                    })
                except Exception as e:
                    print(f"Debug - Error merging messages: {str(e)}")
            
            # Sort messages by timestamp
            messages.sort(key=lambda x: x['timestamp'])
            
            # Update metadata with latest message info
            if messages:
                metadata.update({
                    "latest_timestamp": messages[-1]['timestamp'],
                    "message_count": len(messages)
                })
            
            print(f"Debug - Saving {len(messages)} messages to session {session_id}")
            
            # Update the session atomically
            collection.delete(ids=[session_id])
            collection.add(
                ids=[session_id],
                metadatas=[metadata],
                documents=[json.dumps(messages)]
            )
            
            print(f"Debug - Successfully saved session {session_id}")
            
            return {
                "status": "ok",
                "message": "Session saved",
                "metadata": metadata
            }
        except Exception as e:
            print(f"Debug - Error adding session: {str(e)}")
            print(f"Debug - Request body: {messages}")
            print(f"Debug - Traceback: {traceback.format_exc()}")
            raise HTTPException(status_code=500, detail=f"Failed to save session: {str(e)}")
    except Exception as e:
        print(f"Debug - Top level error in save_session: {str(e)}")
        print(f"Debug - Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/sessions/{session_id}")
async def get_session(session_id: str, request: Request):
    try:
        # Get client identifiers
        client_id = request.headers.get("X-Client-ID", "unknown")
        browser_id = request.headers.get("X-Browser-ID", "unknown")
        
        print(f"Debug - Getting session {session_id} for client {client_id}, browser {browser_id}")
        
        # First verify the collection exists
        try:
            collection = client.get_collection('chat_sessions')
            print("Debug - Successfully got chat_sessions collection")
        except ValueError as e:
            print(f"Debug - Collection error: {str(e)}")
            # Create collection if it doesn't exist
            collection = client.create_collection(
                name='chat_sessions',
                metadata={"description": "Stores chat session history"}
            )
            print("Debug - Created new chat_sessions collection")
        
        # Get session data
        print(f"Debug - Fetching session data for {session_id}")
        result = collection.get(
            ids=[session_id],
            include=['documents', 'metadatas']
        )
        print(f"Debug - Raw result: {result}")
        
        if not result["documents"] or not result["documents"][0]:
            print(f"Debug - No documents found for session {session_id}")
            raise HTTPException(status_code=404, detail="Session not found")
        
        try:
            print(f"Debug - Parsing session document: {result['documents'][0][:100]}...")
            messages = json.loads(result["documents"][0])
            metadata = result["metadatas"][0] if result["metadatas"] else {}
            
            print(f"Debug - Found {len(messages)} messages")
            
            # Sort messages by timestamp
            messages.sort(key=lambda x: x['timestamp'])
            
            # Update metadata with access info
            metadata.update({
                "last_accessed": int(time.time() * 1000),
                "last_access_client": client_id,
                "last_access_browser": browser_id,
                "message_count": len(messages)
            })
            
            # Update metadata in background
            print(f"Debug - Updating metadata for session {session_id}")
            collection.update(
                ids=[session_id],
                metadatas=[metadata]
            )
            
            return {
                "messages": messages,
                "metadata": metadata
            }
        except json.JSONDecodeError as e:
            print(f"Debug - JSON decode error: {str(e)}")
            print(f"Debug - Problem document: {result['documents'][0][:100]}...")
            raise HTTPException(status_code=500, detail=f"Invalid session data format: {str(e)}")
    except Exception as e:
        print(f"Debug - Top level error in get_session: {str(e)}")
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/sessions/{session_id}")
async def delete_session(session_id: str):
    try:
        collection = client.get_collection('chat_sessions')
        collection.delete(ids=[session_id])
        return {"status": "ok", "message": "Session deleted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/sessions")
async def list_sessions(request: Request):
    try:
        # Get client identifiers
        client_id = request.headers.get("X-Client-ID", "unknown")
        browser_id = request.headers.get("X-Browser-ID", "unknown")
        
        collection = client.get_collection('chat_sessions')
        result = collection.get(
            include=['documents', 'metadatas'],
            where={"type": "chat_session"}  # Only get chat sessions
        )
        
        sessions = []
        current_time = int(time.time() * 1000)
        
        for id, doc, meta in zip(result["ids"], result["documents"], result["metadatas"]):
            try:
                messages = json.loads(doc)
                
                # Sort messages by timestamp
                messages.sort(key=lambda x: x['timestamp'])
                
                # Update metadata
                meta.update({
                    "last_listed": current_time,
                    "last_list_client": client_id,
                    "last_list_browser": browser_id,
                    "message_count": len(messages)
                })
                
                sessions.append({
                    "id": id,
                    "messages": messages,
                    "metadata": meta
                })
            except json.JSONDecodeError as e:
                print(f"Error decoding session {id}: {str(e)}")
                continue
        
        # Sort by last_updated, then by message count
        sessions.sort(
            key=lambda x: (
                x['metadata'].get('last_updated', 0),
                x['metadata'].get('message_count', 0)
            ),
            reverse=True
        )
        
        # Update metadata in background
        if sessions:
            collection.update(
                ids=[s["id"] for s in sessions],
                metadatas=[s["metadata"] for s in sessions]
            )
        
        return sessions
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# LLM Model Listing Endpoints
@app.get("/anthropic/models")
async def list_anthropic_models(limit: int = 20, before_id: str = None, after_id: str = None):
    """List available Anthropic models with capabilities."""
    try:
        result = anthropic_client.models.list(
            limit=limit,
            before_id=before_id,
            after_id=after_id
        )
        
        # Enhance model info with capabilities
        models = []
        for model in result.data:
            model_id = model.id
            if model_id in CLAUDE_MODEL_CONFIGS:
                config = CLAUDE_MODEL_CONFIGS[model_id]
                models.append({
                    "id": model_id,
                    "name": config["name"],
                    "capabilities": config["capabilities"]
                })
            else:
                # Default capabilities for unknown models
                models.append({
                    "id": model_id,
                    "name": model.name if hasattr(model, "name") else model_id,
                    "capabilities": {
                        "contextWindow": 200000,
                        "maxOutputTokens": 4096,
                        "supportsFunctionCalling": True,
                        "supportsVision": True,
                        "supportsJson": True,
                        "supportsReasoning": True
                    }
                })
        
        return {"data": models}
    except Exception as e:
        print(f"Anthropic models error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/anthropic/models/{model_id}")
async def get_anthropic_model(model_id: str):
    """Get details about a specific Anthropic model with capabilities."""
    try:
        result = anthropic_client.models.get(model_id)
        
        if model_id in CLAUDE_MODEL_CONFIGS:
            config = CLAUDE_MODEL_CONFIGS[model_id]
            return {
                "id": model_id,
                "name": config["name"],
                "capabilities": config["capabilities"]
            }
        else:
            # Default capabilities for unknown models
            return {
                "id": model_id,
                "name": result.name if hasattr(result, "name") else model_id,
                "capabilities": {
                    "contextWindow": 200000,
                    "maxOutputTokens": 4096,
                    "supportsFunctionCalling": True,
                    "supportsVision": True,
                    "supportsJson": True,
                    "supportsReasoning": True
                }
            }
    except Exception as e:
        print(f"Anthropic model error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/openai/models")
async def list_openai_models():
    """List available OpenAI models with capabilities."""
    try:
        response = await openai_client.models.list()
        models = []
        
        for model in response.data:
            model_id = model.id
            if "embedding" not in model_id.lower():
                if model_id in OPENAI_MODEL_CONFIGS:
                    config = OPENAI_MODEL_CONFIGS[model_id]
                    models.append({
                        "id": model_id,
                        "name": config["name"],
                        "capabilities": config["capabilities"]
                    })
                else:
                    # Default capabilities for unknown models
                    models.append({
                        "id": model_id,
                        "name": model.name if hasattr(model, "name") else model_id,
                        "capabilities": {
                            "contextWindow": 16385,
                            "maxOutputTokens": 4096,
                            "supportsFunctionCalling": True,
                            "supportsVision": False,
                            "supportsJson": True,
                            "supportsReasoning": False
                        }
                    })
        
        return {"models": models}
    except Exception as e:
        print(f"OpenAI models error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/openai/models/{model_id}")
async def get_openai_model(model_id: str):
    """Get details about a specific OpenAI model with capabilities."""
    try:
        model_info = await openai_client.models.retrieve(model_id)
        
        if model_id in OPENAI_MODEL_CONFIGS:
            config = OPENAI_MODEL_CONFIGS[model_id]
            return {
                "id": model_id,
                "name": config["name"],
                "capabilities": config["capabilities"]
            }
        else:
            # Default capabilities for unknown models
            return {
                "id": model_id,
                "name": model_info.name if hasattr(model_info, "name") else model_id,
                "capabilities": {
                    "contextWindow": 16385,
                    "maxOutputTokens": 4096,
                    "supportsFunctionCalling": True,
                    "supportsVision": False,
                    "supportsJson": True,
                    "supportsReasoning": False
                }
            }
    except Exception as e:
        print(f"OpenAI model error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# LLM Chat Endpoints
@app.post("/llm/openai")
async def call_openai(request: LLMRequest):
    """Call OpenAI's chat completion API."""
    try:
        # Convert messages to OpenAI format
        messages = []
        for msg in request.messages:
            message = {
                "role": msg.role,
                "content": msg.content
            }
            if msg.role == 'function':
                message["name"] = msg.name or 'function'
            messages.append(message)

        # Create completion request
        completion_request = {
            "model": request.model or "gpt-3.5-turbo",
            "messages": messages,
            "temperature": request.temperature,
            "stream": request.stream
        }

        # Add optional parameters
        if request.max_tokens:
            completion_request["max_tokens"] = request.max_tokens
        if request.tools:
            completion_request["tools"] = request.tools
        if request.tool_choice:
            completion_request["tool_choice"] = request.tool_choice
        if request.response_format:
            completion_request["response_format"] = request.response_format

        # Make API call
        if request.stream:
            # Return streaming response
            return StreamingResponse(
                stream_openai_response(completion_request),
                media_type='text/event-stream'
            )
        else:
            # Return regular response
            response = await openai_client.chat.completions.create(**completion_request)
            return LLMResponse(
                id=response.id,
                model=response.model,
                content=response.choices[0].message.content,
                finish_reason=response.choices[0].finish_reason,
                usage=response.usage.model_dump() if response.usage else None
            )
    except Exception as e:
        print(f"OpenAI error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

async def stream_openai_response(completion_request: dict):
    """Stream OpenAI chat completion responses."""
    try:
        stream = await openai_client.chat.completions.create(**completion_request)
        async for chunk in stream:
            if chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content
    except Exception as e:
        print(f"OpenAI streaming error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/llm/claude")
async def call_claude(request: LLMRequest):
    """Call Anthropic's Claude API."""
    try:
        # Convert messages to Claude format
        messages = []
        for msg in request.messages:
            # Claude expects system messages as user messages
            role = 'user' if msg.role == 'system' else msg.role
            messages.append({
                "role": role,
                "content": msg.content
            })

        # Create completion request
        completion_request = {
            "model": request.model or "claude-3-opus-20240229",
            "messages": messages,
            "max_tokens": request.max_tokens or 4096,
            "temperature": request.temperature,
            "stream": request.stream
        }

        # Make API call
        if request.stream:
            # Return streaming response
            return StreamingResponse(
                stream_claude_response(completion_request),
                media_type='text/event-stream'
            )
        else:
            # Return regular response
            response = await anthropic_client.messages.create(**completion_request)
            return LLMResponse(
                id=response.id,
                model=response.model,
                content=response.content[0].text,
                finish_reason=response.stop_reason,
                usage={
                    "prompt_tokens": response.usage.input_tokens,
                    "completion_tokens": response.usage.output_tokens,
                    "total_tokens": response.usage.input_tokens + response.usage.output_tokens
                }
            )
    except Exception as e:
        print(f"Claude error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

async def stream_claude_response(completion_request: dict):
    """Stream Claude chat completion responses."""
    try:
        stream = await anthropic_client.messages.create(**completion_request)
        async for chunk in stream:
            if chunk.type == 'content_block_delta' and 'text' in chunk.delta:
                yield chunk.delta.text
    except Exception as e:
        print(f"Claude streaming error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/llm/deepseek")
async def call_deepseek(request: LLMRequest):
    """Call Deepseek's API (using OpenAI format)."""
    try:
        # Convert messages to OpenAI format
        messages = []
        for msg in request.messages:
            message = {
                "role": msg.role,
                "content": msg.content
            }
            if msg.role == 'function':
                message["name"] = msg.name or 'function'
            messages.append(message)

        # Create completion request
        completion_request = {
            "model": request.model or "deepseek-chat",
            "messages": messages,
            "temperature": request.temperature,
            "stream": request.stream
        }

        # Add optional parameters
        if request.max_tokens:
            completion_request["max_tokens"] = request.max_tokens
        if request.tools:
            completion_request["tools"] = request.tools
        if request.tool_choice:
            completion_request["tool_choice"] = request.tool_choice
        if request.response_format:
            completion_request["response_format"] = request.response_format

        # Make API call
        if request.stream:
            # Return streaming response
            return StreamingResponse(
                stream_openai_response(completion_request),  # Reuse OpenAI streaming
                media_type='text/event-stream'
            )
        else:
            # Return regular response
            response = await openai_client.chat.completions.create(**completion_request)
            return LLMResponse(
                id=response.id,
                model=response.model,
                content=response.choices[0].message.content,
                finish_reason=response.choices[0].finish_reason,
                usage=response.usage.model_dump() if response.usage else None
            )
    except Exception as e:
        print(f"Deepseek error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/lmstudio/models")
async def list_lmstudio_models():
    """List available LM Studio models."""
    try:
        async with httpx.AsyncClient() as client:
            lm_studio_url = f'http://{LM_STUDIO_HOST}:{LM_STUDIO_PORT}/v1/models'
            response = await client.get(lm_studio_url)
            if not response.is_success:
                raise HTTPException(status_code=response.status_code, detail=response.text)
            data = response.json()
        
        # Convert to our format
        models = []
        for model in data['data']:
            model_id = model['id']
            models.append({
                "id": model_id,
                "name": model.get('name', model_id),
                "capabilities": {
                    "contextWindow": 32768,
                    "maxOutputTokens": 8192,
                    "supportsFunctionCalling": True,
                    "supportsVision": False,
                    "supportsJson": True,
                    "supportsReasoning": False
                }
            })
        
        return {"models": models}
    except Exception as e:
        print(f"LM Studio models error: {str(e)}")
        # Return default model if API call fails
        return {
            "models": [{
                "id": "local-model",
                "name": "Local Model",
                "capabilities": {
                    "contextWindow": 32768,
                    "maxOutputTokens": 8192,
                    "supportsFunctionCalling": True,
                    "supportsVision": False,
                    "supportsJson": True,
                    "supportsReasoning": False
                }
            }]
        }

@app.post("/llm/lmstudio")
async def call_lmstudio(request: LLMRequest):
    """Call LM Studio's local API."""
    try:
        # Debug request
        print("Debug - Request type:", type(request))
        print("Debug - Request dict:", request.model_dump())

        # Create completion request
        # Convert messages to LM Studio format
        messages = []
        for msg in request.messages:
            message = {
                "role": msg.role,
                "content": msg.content
            }
            if msg.name:
                message["name"] = msg.name
            messages.append(message)

        # Create completion request
        completion_request = {
            "model": request.model or "local-model",
            "messages": messages,
            "temperature": request.temperature,
            "stream": request.stream
        }

        # Add optional parameters
        if request.max_tokens:
            completion_request["max_tokens"] = request.max_tokens
        if request.tools:
            completion_request["tools"] = request.tools
        if request.tool_choice:
            completion_request["tool_choice"] = request.tool_choice
        if request.response_format:
            completion_request["response_format"] = request.response_format

        print("Debug - Completion request:", completion_request)

        # Make API call
        if request.stream:
            # Return streaming response
            return StreamingResponse(
                stream_lmstudio_response(completion_request),
                media_type='text/event-stream'
            )
        else:
            # Return regular response
            lm_studio_url = f'http://{LM_STUDIO_HOST}:{LM_STUDIO_PORT}/v1/chat/completions'
            print(f"Debug - Making request to: {lm_studio_url}")
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    lm_studio_url,
                    headers={"Content-Type": "application/json"},
                    json=completion_request
                )
            
            if response.status_code < 200 or response.status_code >= 300:
                error = response.text
                print(f"Debug - Error response: {error}")
                raise HTTPException(status_code=response.status_code, detail=error)
            
            try:
                # Get response text first
                response_text = response.text
                print("Debug - Raw response text:", response_text)
                print("Debug - Response text type:", type(response_text))
                
                # Parse JSON
                try:
                    result = json.loads(response_text)
                    print("Debug - Parsed result:", result)
                    print("Debug - Result type:", type(result))
                except json.JSONDecodeError as e:
                    print(f"Debug - JSON decode error: {str(e)}")
                    raise HTTPException(
                        status_code=500,
                        detail=f"Failed to parse LM Studio response as JSON: {str(e)}"
                    )

                # Validate response structure
                if not isinstance(result, dict):
                    raise ValueError("Response is not a dictionary")
                
                if not result.get('choices'):
                    raise ValueError("Missing 'choices' in response")
                
                if not isinstance(result['choices'], list):
                    raise ValueError("'choices' is not a list")
                
                if not result['choices']:
                    raise ValueError("'choices' is empty")
                
                if not isinstance(result['choices'][0], dict):
                    raise ValueError("First choice is not a dictionary")
                
                if not result['choices'][0].get('message'):
                    raise ValueError("Missing 'message' in first choice")
                
                if not isinstance(result['choices'][0]['message'], dict):
                    raise ValueError("'message' is not a dictionary")
                
                if not result['choices'][0]['message'].get('content'):
                    raise ValueError("Missing 'content' in message")

                # Convert LM Studio response to our common format
                return {
                    "id": result.get('id', str(time.time())),
                    "model": result.get('model', request.model or "local-model"),
                    "content": result['choices'][0]['message']['content'],
                    "finish_reason": result['choices'][0].get('finish_reason', 'stop'),
                    "usage": result.get('usage')
                }
            except ValueError as e:
                print(f"Debug - Validation error: {str(e)}")
                raise HTTPException(
                    status_code=500,
                    detail=f"Invalid response format from LM Studio: {str(e)}"
                )
            except Exception as e:
                print(f"Debug - Unexpected error: {str(e)}")
                import traceback
                traceback.print_exc()
                raise HTTPException(
                    status_code=500,
                    detail=f"Error processing LM Studio response: {str(e)}"
                )
    except Exception as e:
        print(f"Debug - Top level error: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

async def stream_lmstudio_response(completion_request: dict):
    """Stream LM Studio chat completion responses."""
    try:
        lm_studio_url = f'http://{LM_STUDIO_HOST}:{LM_STUDIO_PORT}/v1/chat/completions'
        async with httpx.AsyncClient() as client:
            async with client.stream(
                'POST',
                lm_studio_url,
                headers={"Content-Type": "application/json"},
                json=completion_request,
                timeout=60.0
            ) as response:
                if response.status_code < 200 or response.status_code >= 300:
                    error = await response.aread()
                    raise HTTPException(status_code=response.status_code, detail=error.decode())

                async for line in response.aiter_lines():
                    if line.startswith('data: '):
                        try:
                            data = json.loads(line[6:])  # Skip 'data: ' prefix
                            if data == '[DONE]':
                                yield 'data: [DONE]\n\n'
                                continue

                            # Extract content from the delta
                            content = data.get('choices', [{}])[0].get('delta', {}).get('content')
                            if content:
                                yield f'data: {json.dumps({"content": content})}\n\n'
                        except json.JSONDecodeError as e:
                            print(f"Failed to parse streaming chunk: {e}")
                            continue
                        except Exception as e:
                            print(f"Error processing streaming chunk: {e}")
                            continue

    except Exception as e:
        print(f"LM Studio streaming error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    print(f"Starting ChromaDB server on {CHROMA_HOST}:{CHROMA_PORT}...")
    print(f"Using collection: {COLLECTION_NAME}")
    
    # Check if port is already in use
    if is_port_in_use(CHROMA_PORT):
        print(f"Port {CHROMA_PORT} is already in use. Attempting to kill existing process...")
        if kill_process_on_port(CHROMA_PORT):
            print("Successfully killed existing process")
        else:
            print("Failed to kill existing process")
            sys.exit(1)
    
    uvicorn.run(app, host=CHROMA_HOST, port=CHROMA_PORT)
