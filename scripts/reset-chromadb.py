import chromadb
from chromadb.config import Settings
import os
import shutil
import psutil
import time

def kill_chroma_processes():
    print("Stopping any running ChromaDB processes...")
    for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
        try:
            cmdline = proc.cmdline()
            if any('start_chroma.py' in cmd for cmd in cmdline):
                print(f"Killing ChromaDB process {proc.pid}")
                proc.kill()
                time.sleep(1)  # Give it time to release files
        except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
            pass

def reset_chromadb():
    print("Resetting ChromaDB...")
    
    # Path to ChromaDB data directory
    data_dir = "./chroma_data"
    
    try:
        # First kill any running ChromaDB processes
        kill_chroma_processes()
        
        # Remove the data directory
        if os.path.exists(data_dir):
            print(f"Removing {data_dir} directory...")
            shutil.rmtree(data_dir)
            
        print("Successfully reset ChromaDB")
        return True
        
    except Exception as e:
        print(f"Error resetting ChromaDB: {str(e)}")
        return False

if __name__ == "__main__":
    reset_chromadb()
