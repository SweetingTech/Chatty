import chromadb
from chromadb.config import Settings
import uvicorn
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Dict, Optional
import json
import os
import traceback
from dotenv import load_dotenv
from pydantic import BaseModel
import onnxruntime as ort
from fastapi.responses import Response
import socket
import psutil
import sys

# Load environment variables
load_dotenv()

# Get configuration from environment
CHROMA_HOST = os.getenv('CHROMA_HOST', 'localhost')
CHROMA_PORT = int(os.getenv('CHROMA_PORT', '8001'))
COLLECTION_NAME = os.getenv('CHROMA_COLLECTION_NAME', 'chat_sessions')

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

# Add CORS middleware with more permissive settings for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins in development
    allow_credentials=False,  # Must be False when allow_origins=["*"]
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]
)

# Set ONNX Runtime providers to use GPU
providers = ort.get_available_providers()
print("Available ONNX Runtime providers:", providers)

# Initialize ChromaDB client in local mode
client = chromadb.Client(
    Settings(
        persist_directory="./chroma_data",  # Persistent storage
        allow_reset=True,
        anonymized_telemetry=False,
        is_persistent=True
    )
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
        # Parse the raw request body
        body = await request.json()
        
        # Handle both array and single object cases
        messages = body if isinstance(body, list) else [body]
        
        # Validate message format
        for msg in messages:
            if not all(key in msg for key in ["id", "role", "content", "timestamp"]):
                raise HTTPException(status_code=422, detail="Invalid message format. Required fields: id, role, content, timestamp")

        collection = client.get_collection('chat_sessions')

        # First try to delete any existing session
        try:
            collection.delete(ids=[session_id])
        except Exception as e:
            print(f"Error deleting existing session: {str(e)}")
            # Continue since this is not critical

        try:
            # Add new session data
            collection.add(
                ids=[session_id],
                metadatas=[{
                    "timestamp": messages[-1].get("timestamp", 0) if messages else 0,
                    "type": "chat_session"
                }],
                documents=[json.dumps(messages)]
            )
            return {"status": "ok", "message": "Session saved"}
        except Exception as e:
            print(f"Error adding session: {str(e)}")
            print(f"Request body: {messages}")
            print(f"Traceback: {traceback.format_exc()}")
            raise HTTPException(status_code=500, detail=f"Failed to save session: {str(e)}")
    except Exception as e:
        print(f"Error in save_session: {str(e)}")
        print(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/sessions/{session_id}")
async def get_session(session_id: str):
    try:
        collection = client.get_collection('chat_sessions')
        result = collection.get(ids=[session_id], limit=1)
        if not result["documents"]:
            raise HTTPException(status_code=404, detail="Session not found")
        return {
            "messages": json.loads(result["documents"][0]),
            "metadata": result["metadatas"][0]
        }
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))

async def delete_session(session_id: str):
    try:
        collection = client.get_collection('chat_sessions')
        collection.delete(ids=[session_id])
        return {"status": "ok", "message": "Session deleted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/sessions")
async def list_sessions():
    try:
        collection = client.get_collection('chat_sessions')
        result = collection.get()
        return [{
            "id": id,
            "messages": json.loads(doc),
            "metadata": meta
        } for id, doc, meta in zip(result["ids"], result["documents"], result["metadatas"])]
    except Exception as e:
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
