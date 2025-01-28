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

# Initialize ChromaDB client
client = chromadb.PersistentClient(
    path="./chroma_data",
    settings=Settings(
        anonymized_telemetry=False,
        allow_reset=True,
        is_persistent=True
    )
)

# Initialize default collections with proper error handling
async def init_default_collections():
    default_collections = {
        'chat_sessions': 'Stores chat session history',
        'agent_modifications': 'Stores modifications to default agents',
        'tool_modifications': 'Stores modifications to default tools',
        'user_settings': 'Stores user settings and preferences'
    }
    
    for name, description in default_collections.items():
        try:
            try:
                # Try to get existing collection
                client.get_collection(name=name)
            except ValueError:
                # Create if it doesn't exist
                client.create_collection(
                    name=name,
                    metadata={"description": description}
                )
        except Exception as e:
            print(f"Error initializing collection {name}: {str(e)}")

@app.on_event("startup")
async def startup_event():
    await init_default_collections()

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
        collections = client.list_collections()
        # Return only collection names as per v0.6.x API
        return [collection.name for collection in collections]
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
        # Check if collection exists
        try:
            client.get_collection(collection_data.name)
            raise HTTPException(status_code=400, detail="Collection already exists")
        except ValueError:
            pass

        # Create collection
        collection = client.create_collection(
            name=collection_data.name,
            metadata=collection_data.metadata
        )
        
        return {
            "name": collection.name,
            "metadata": collection.metadata
        }
    except HTTPException:
        raise
    except Exception as e:
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
