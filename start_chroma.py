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

# Initialize ChromaDB client with v0.6.0 settings
client = chromadb.PersistentClient(
    path="./chroma_data",
    settings=Settings(
        anonymized_telemetry=False,
        allow_reset=True,
        is_persistent=True
    )
)

# Default collections that should exist
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

                # Collection exists or was created, now add initial data if needed
                if collection and 'initial_data' in collection_info:
                    try:
                        # Check if data already exists
                        existing = collection.get(ids=collection_info['initial_data']['ids'])
                        if not existing['ids']:
                            collection.add(**collection_info['initial_data'])
                            print(f"Added initial data to {collection_info['name']}")
                        else:
                            print(f"Initial data already exists in {collection_info['name']}")
                    except Exception as e:
                        print(f"Warning: Failed to add initial data to {collection_info['name']}: {str(e)}")
                        # Continue even if initial data fails - the collection exists

                # If we get here, collection is ready
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

@app.get("/collections")
async def list_collections():
    """List all collection names (v0.6.x compatible)"""
    try:
        # In v0.6.0, list_collections() returns just the names
        return client.list_collections()
    except Exception as e:
        print(f"Error listing collections: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/collections/{collection_name}")
async def get_collection(collection_name: str):
    """Get collection details"""
    try:
        collection = client.get_collection(collection_name)
        return {
            "name": collection.name,
            "metadata": collection.metadata
        }
    except ValueError:
        raise HTTPException(status_code=404, detail=f"Collection {collection_name} not found")
    except Exception as e:
        print(f"Error getting collection: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/collections")
async def create_collection(collection_data: CollectionModel):
    """Create a new collection"""
    try:
        # Try to create collection directly
        collection = client.create_collection(
            name=collection_data.name,
            metadata=collection_data.metadata
        )
        
        return {
            "name": collection.name,
            "metadata": collection.metadata
        }
    except Exception as e:
        # If collection already exists, that's fine
        if "already exists" in str(e):
            try:
                collection = client.get_collection(collection_data.name)
                return {
                    "name": collection.name,
                    "metadata": collection.metadata
                }
            except Exception as inner_e:
                print(f"Error getting existing collection: {str(inner_e)}")
                raise HTTPException(status_code=500, detail=str(inner_e))
        
        print(f"Error creating collection: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/collections/{collection_name}/get")
async def get_collection_documents(collection_name: str):
    """Get documents from a collection"""
    try:
        collection = client.get_collection(collection_name)
        result = collection.get()
        return {
            "ids": result["ids"],
            "documents": result["documents"],
            "metadatas": result["metadatas"]
        }
    except ValueError:
        raise HTTPException(status_code=404, detail=f"Collection {collection_name} not found")
    except Exception as e:
        print(f"Error getting documents: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/collections/{collection_name}/add")
async def add_documents(collection_name: str, request: Request):
    """Add documents to a collection"""
    try:
        data = await request.json()
        collection = client.get_collection(collection_name)
        collection.add(
            ids=data["ids"],
            metadatas=data["metadatas"],
            documents=data["documents"]
        )
        return {"status": "success"}
    except ValueError:
        raise HTTPException(status_code=404, detail=f"Collection {collection_name} not found")
    except Exception as e:
        print(f"Error adding documents: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/collections/{collection_name}/delete")
async def delete_documents(collection_name: str, request: Request):
    """Delete documents from a collection"""
    try:
        data = await request.json()
        collection = client.get_collection(collection_name)
        collection.delete(ids=data["ids"])
        return {"status": "success"}
    except ValueError:
        raise HTTPException(status_code=404, detail=f"Collection {collection_name} not found")
    except Exception as e:
        print(f"Error deleting documents: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/collections/{collection_name}")
async def delete_collection(collection_name: str):
    """Delete a collection"""
    try:
        client.delete_collection(collection_name)
        return {"status": "success"}
    except ValueError:
        raise HTTPException(status_code=404, detail=f"Collection {collection_name} not found")
    except Exception as e:
        print(f"Error deleting collection: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Session Management Endpoints

@app.get("/sessions")
async def get_sessions():
    """Get all chat sessions"""
    try:
        try:
            collection = client.get_collection('chat_sessions')
        except ValueError:
            # Return empty list if collection doesn't exist
            return []
            
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
    except Exception as e:
        print(f"Error getting sessions: {str(e)}")
        # Return empty list for any error to avoid frontend issues
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
            pass  # Ignore if session doesn't exist
            
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
