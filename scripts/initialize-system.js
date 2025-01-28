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

async function waitForServer() {
  console.log('Waiting for ChromaDB server...');
  for (let i = 0; i < 30; i++) {
    if (await isServerRunning()) {
      console.log('ChromaDB server is ready');
      return true;
    }
    await wait(1000);
  }
  throw new Error('Failed to connect to ChromaDB server');
}

async function verifyCollections() {
  console.log('Verifying collections...');
  for (const collection of CORE_COLLECTIONS) {
    try {
      const response = await fetch(`${CHROMA_URL}/collections/${collection.name}/get`);
      if (!response.ok) {
        throw new Error(`Collection ${collection.name} not found or not accessible`);
      }
      console.log(`Verified collection: ${collection.name}`);

      // If collection has initial data, verify it exists
      if (collection.initialData) {
        const dataResponse = await fetch(`${CHROMA_URL}/collections/${collection.name}/get?ids=${collection.initialData.ids.join(',')}`);
        if (!dataResponse.ok) {
          throw new Error(`Initial data not found in ${collection.name}`);
        }
        const data = await dataResponse.json();
        if (!data.ids || data.ids.length === 0) {
          throw new Error(`Initial data not found in ${collection.name}`);
        }
        console.log(`Verified initial data in ${collection.name}`);
      }
    } catch (error) {
      throw new Error(`Failed to verify collection ${collection.name}: ${error.message}`);
    }
  }
  console.log('All collections verified successfully');
}

async function initialize() {
  try {
    console.log('Starting system initialization...');

    // Step 1: Wait for ChromaDB server to be ready
    await waitForServer();

    // Step 2: Verify collections exist
    await verifyCollections();

    console.log('System initialization completed successfully!');
  } catch (error) {
    console.error('Initialization failed:', error);
    process.exit(1); // Exit if collections aren't ready - they should be created by start_chroma.py
  }
}

// Run initialization
initialize();
