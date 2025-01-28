import * as dotenv from 'dotenv';
import fetch from 'node-fetch';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CHROMA_HOST = process.env.VITE_CHROMA_HOST || 'localhost';
const CHROMA_PORT = process.env.VITE_CHROMA_PORT || '8001';
const CHROMA_URL = `http://${CHROMA_HOST}:${CHROMA_PORT}`;

// Required collections that should exist
const REQUIRED_COLLECTIONS = [
  'chat_sessions',
  'agent_modifications',
  'tool_modifications',
  'additional_agents',
  'additional_tools',
  'user_settings'
];

async function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function isServerRunning() {
  try {
    const response = await fetch(`${CHROMA_URL}/heartbeat`);
    return response.ok;
  } catch (error) {
    return false;
  }
}

async function startServer() {
  console.log('Starting ChromaDB server...');
  const pythonCmd = process.platform === 'win32' ? '.\\venv\\Scripts\\python' : './venv/bin/python';
  const server = spawn(pythonCmd, ['start_chroma.py'], {
    stdio: 'inherit',
    detached: true
  });
  server.unref();

  // Wait for server to be ready
  for (let i = 0; i < 30; i++) {
    if (await isServerRunning()) {
      console.log('ChromaDB server is ready');
      return true;
    }
    await wait(1000);
  }
  throw new Error('Failed to start ChromaDB server');
}

async function ensureServerRunning() {
  if (!(await isServerRunning())) {
    await startServer();
  }
}

async function verifyCollections() {
  console.log('Verifying collections...');
  
  // Wait for server to be ready and collections to exist
  for (let i = 0; i < 30; i++) {
    try {
      const response = await fetch(`${CHROMA_URL}/collections`);
      if (!response.ok) {
        throw new Error(`Failed to get collections: ${await response.text()}`);
      }
      
      const collections = await response.json();
      const missingCollections = REQUIRED_COLLECTIONS.filter(name => !collections.includes(name));
      
      if (missingCollections.length === 0) {
        console.log('All required collections are ready');
        return true;
      }
      
      console.log(`Waiting for collections: ${missingCollections.join(', ')}`);
      await wait(1000);
      
    } catch (error) {
      console.log(`Connection attempt ${i + 1} failed, retrying in 1 second...`);
      await wait(1000);
    }
  }
  
  throw new Error('Timed out waiting for collections to be ready');
}

async function main() {
  try {
    console.log('Verifying ChromaDB is ready...');
    
    // Step 1: Make sure server is running
    await ensureServerRunning();
    
    // Step 2: Verify collections exist
    await verifyCollections();
    
    console.log('ChromaDB verification complete!');
  } catch (error) {
    console.error('Failed to verify ChromaDB:', error);
    process.exit(1);
  }
}

// Run the initialization
main();
