import importlib.util
import sys
import os
import json
import http.client
from urllib.parse import urlparse
import time

def check_package(package_name):
    """Check if a package is installed and can be imported."""
    try:
        spec = importlib.util.find_spec(package_name)
        if spec is None:
            return False
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return True
    except Exception:
        return False

def start_chromadb_server():
    """Start the ChromaDB server if it's not running."""
    try:
        import subprocess
        import time
        
        print("Starting ChromaDB server...")
        # Start the server in a new process
        if os.name == 'nt':  # Windows
            process = subprocess.Popen(['start', 'cmd', '/c', 'python', 'start_chroma.py'], 
                                    shell=True, 
                                    stdout=subprocess.PIPE, 
                                    stderr=subprocess.PIPE)
        else:  # Unix/Linux/Mac
            process = subprocess.Popen(['python', 'start_chroma.py'],
                                    stdout=subprocess.PIPE,
                                    stderr=subprocess.PIPE)
        
        # Give it some time to start
        time.sleep(5)
        return True
    except Exception as e:
        print(f"Error starting ChromaDB server: {str(e)}")
        return False

def check_chromadb_connection():
    """Check if ChromaDB is accessible and initialized."""
    try:
        # Get ChromaDB host and port from env
        from dotenv import load_dotenv
        load_dotenv()
        
        host = os.getenv('CHROMA_HOST', 'localhost')
        port = int(os.getenv('CHROMA_PORT', '8001'))
        max_retries = 3
        
        for attempt in range(max_retries):
            try:
                # Try to connect and check collections
                conn = http.client.HTTPConnection(f"{host}:{port}")
                conn.request("GET", "/collections")
                response = conn.getresponse()
                
                if response.status == 200:
                    collections = json.loads(response.read().decode())
                    required_collections = {'chat_sessions', 'agent_modifications', 'tool_modifications', 'user_settings'}
                    existing_collections = set(collections)
                    
                    return required_collections.issubset(existing_collections)
                
            except Exception:
                if attempt == 0:  # Only try to start the server on first failure
                    if start_chromadb_server():
                        time.sleep(2)  # Give it a moment to initialize
                        continue
                elif attempt < max_retries - 1:
                    time.sleep(2)  # Wait before retrying
                    continue
                
            return False
            
    except Exception as e:
        print(f"Error checking ChromaDB: {str(e)}")
        return False

def check_weaviate_connection():
    """Check if Weaviate is accessible and initialized."""
    try:
        host = os.getenv('WEAVIATE_HOST', 'localhost')
        port = int(os.getenv('WEAVIATE_PORT', '8080'))
        
        conn = http.client.HTTPConnection(f"{host}:{port}")
        conn.request("GET", "/v1/schema")
        response = conn.getresponse()
        
        if response.status != 200:
            return False
            
        schema = json.loads(response.read().decode())
        return any(cls.get('class') == 'Document' for cls in schema.get('classes', []))
    except Exception:
        return False

required_packages = [
    'chromadb',
    'fastapi',
    'uvicorn',
    'python-dotenv',
    'numpy',
    'onnxruntime',
    'psutil',
    'openai',
    'anthropic'
]

all_installed = True
missing_packages = []
issues = []

# Check Python packages
for package in required_packages:
    if not check_package(package.replace('-', '_')):  # Replace hyphens with underscores for import
        all_installed = False
        missing_packages.append(package)

if missing_packages:
    issues.append("Missing packages: " + ", ".join(missing_packages))

# Check database connections
if not check_chromadb_connection():
    all_installed = False
    issues.append("ChromaDB is not properly initialized")

if not check_weaviate_connection():
    all_installed = False
    issues.append("Weaviate is not properly initialized")

if all_installed:
    print("SETUP_CHECK:OK - All components are properly installed and initialized")
    sys.exit(0)
else:
    print("SETUP_CHECK:FAIL - Issues found:")
    for issue in issues:
        print(f"  - {issue}")
    sys.exit(1)
