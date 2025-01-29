import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fetch from 'node-fetch';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));

const CHROMA_HOST = process.env.CHROMA_HOST || 'localhost';
const CHROMA_PORT = process.env.CHROMA_PORT || '8001';
const CHROMA_URL = `http://${CHROMA_HOST}:${CHROMA_PORT}`;

// Custom error classes for better error handling
class InitializationError extends Error {
  constructor(message, collection = null) {
    super(message);
    this.name = 'InitializationError';
    this.collection = collection;
  }
}

class SchemaVersionMismatchError extends InitializationError {
  constructor(collection, expected, actual) {
    super(`Schema version mismatch in ${collection}: expected ${expected}, got ${actual}`);
    this.name = 'SchemaVersionMismatchError';
    this.expected = expected;
    this.actual = actual;
  }
}

// Default collections in order of creation
const CORE_COLLECTIONS = [
  {
    name: 'user_settings',
    description: 'Stores user settings and configuration',
    initialData: {
      ids: ['api_keys'],
      metadatas: [{ timestamp: Date.now(), type: 'settings' }],
      documents: [JSON.stringify({
        openaiKey: process.env.OPENAI_API_KEY || '',
        claudeKey: process.env.CLAUDE_API_KEY || '',
        deepseekKey: process.env.DEEPSEEK_API_KEY || '',
        lmStudioHost: process.env.VITE_LM_STUDIO_HOST || 'localhost',
        lmStudioPort: process.env.VITE_LM_STUDIO_PORT || '1234'
      })]
    }
  },
  {
    name: 'chat_sessions',
    description: 'Stores chat session history'
  },
  {
    name: 'agent_modifications',
    description: 'Stores modifications to default agents'
  },
  {
    name: 'tool_modifications',
    description: 'Stores modifications to default tools'
  },
  {
    name: 'additional_agents',
    description: 'Stores additional custom agents'
  },
  {
    name: 'additional_tools',
    description: 'Stores additional custom tools'
  }
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

async function checkServerReady() {
  try {
    const response = await fetch(`${CHROMA_URL}/ready`);
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Server not ready');
    }
    const data = await response.json();
    return data;
  } catch (error) {
    return false;
  }
}

async function waitForServer() {
  console.log('Waiting for ChromaDB server...');
  const maxAttempts = 60;
  const waitTime = 1000;
  
  for (let i = 0; i < maxAttempts; i++) {
    // First check basic connectivity
    if (await isServerRunning()) {
      console.log('ChromaDB server is responding to heartbeat');
      
      // Then check full readiness
      const readyStatus = await checkServerReady();
      if (readyStatus) {
        console.log('ChromaDB server is fully initialized:', readyStatus);
        return readyStatus;
      }
      
      if (i % 5 === 0) {
        console.log('Waiting for collections to be fully initialized...');
      }
    }
    
    await wait(waitTime);
    if (i % 5 === 0) {
      console.log(`Still waiting for ChromaDB server... (attempt ${i + 1}/${maxAttempts})`);
    }
  }
  throw new InitializationError('Server failed to become ready in time');
}

async function verifyCollection(collection) {
  try {
    const response = await fetch(`${CHROMA_URL}/collections/${collection.name}/get`);
    if (!response.ok) {
      throw new InitializationError(`Collection ${collection.name} not accessible`, collection.name);
    }

    // If collection has initial data, verify it exists
    if (collection.initialData) {
      const dataResponse = await fetch(
        `${CHROMA_URL}/collections/${collection.name}/get?ids=${collection.initialData.ids.join(',')}`
      );
      if (!dataResponse.ok) {
        throw new InitializationError(`Initial data not found in ${collection.name}`, collection.name);
      }
      const data = await dataResponse.json();
      if (!data.ids || data.ids.length === 0) {
        throw new InitializationError(`Initial data not found in ${collection.name}`, collection.name);
      }
    }

    console.log(`Verified collection: ${collection.name}`);
    return true;
  } catch (error) {
    if (error instanceof InitializationError) {
      throw error;
    }
    throw new InitializationError(
      `Failed to verify collection ${collection.name}: ${error.message}`,
      collection.name
    );
  }
}

async function verifyCollections() {
  console.log('Verifying collections...');
  for (const collection of CORE_COLLECTIONS) {
    await verifyCollection(collection);
  }
  console.log('All collections verified successfully');
}

async function initialize() {
  try {
    console.log('Starting system initialization...');

    // Step 1: Wait for ChromaDB server to be ready
    const serverStatus = await waitForServer();
    console.log(`Server schema version: ${serverStatus.schema_version}`);

    // Step 2: Verify collections exist
    await verifyCollections();

    console.log('System initialization completed successfully!');
  } catch (error) {
    if (error instanceof SchemaVersionMismatchError) {
      console.error('Schema version mismatch detected:', error.message);
      console.error('Expected:', error.expected, 'Got:', error.actual);
      // Could trigger a schema migration here
    } else if (error instanceof InitializationError) {
      console.error('Initialization failed:', error.message);
      if (error.collection) {
        console.error('Failed collection:', error.collection);
      }
    } else {
      console.error('Unexpected error:', error);
    }
    process.exit(1);
  }
}

// Run initialization
initialize();
