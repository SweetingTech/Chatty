import chromadb
from chromadb.config import Settings
import uvicorn
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Dict, Optional
import json
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Get configuration from environment
CHROMA_HOST = os.getenv('CHROMA_HOST', 'localhost')
CHROMA_PORT = int(os.getenv('CHROMA_PORT', '8000'))
COLLECTION_NAME = os.getenv('CHROMA_COLLECTION_NAME', 'chat_sessions')

# Create FastAPI app
app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174"],  # Vite dev server ports
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize ChromaDB client
client = chromadb.Client(
    Settings(
        persist_directory="./chroma_data",  # Persistent storage
        allow_reset=True,
        anonymized_telemetry=False
    )
)

# Get or create the collection
collection = client.get_or_create_collection(
    name=COLLECTION_NAME,
    metadata={"description": "Stores chat session history"}
)

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

@app.post("/sessions/{session_id}")
async def save_session(session_id: str, messages: List[Dict]):
    try:
        # First try to delete any existing session
        try:
            collection.delete(ids=[session_id])
        except:
            pass  # Ignore if session doesn't exist

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
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/sessions/{session_id}")
async def get_session(session_id: str):
    try:
        result = collection.get(ids=[session_id], limit=1)
        if not result.documents:
            raise HTTPException(status_code=404, detail="Session not found")
        return {
            "messages": json.loads(result.documents[0]),
            "metadata": result.metadatas[0]
        }
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/sessions/{session_id}")
async def delete_session(session_id: str):
    try:
        collection.delete(ids=[session_id])
        return {"status": "ok", "message": "Session deleted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/sessions")
async def list_sessions():
    try:
        result = collection.get()
        return [{
            "id": id,
            "messages": json.loads(doc),
            "metadata": meta
        } for id, doc, meta in zip(result.ids, result.documents, result.metadatas)]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    print(f"Starting ChromaDB server on {CHROMA_HOST}:{CHROMA_PORT}...")
    print(f"Using collection: {COLLECTION_NAME}")
    uvicorn.run(app, host=CHROMA_HOST, port=CHROMA_PORT)
