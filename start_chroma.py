import chromadb
from chromadb.config import Settings
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Create FastAPI app
app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Vite dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize ChromaDB client
settings = Settings(
    chroma_api_impl="rest",
    chroma_server_host="localhost",
    chroma_server_http_port=8000,
    allow_reset=True,
    anonymized_telemetry=False,
    persist_directory="./chroma_data"  # Persistent storage
)

# Create persistent client
client = chromadb.PersistentClient(path="./chroma_data", settings=settings)

# Create default collection if it doesn't exist
try:
    collection = client.get_or_create_collection("chat_sessions")
except Exception as e:
    print(f"Error creating collection: {e}")

if __name__ == "__main__":
    print("Starting ChromaDB server on http://localhost:8000")
    uvicorn.run("chromadb.app:app", host="localhost", port=8000)
