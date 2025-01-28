import * as dotenv from 'dotenv';
import fetch from 'node-fetch';
import { spawn } from 'child_process';

// Load environment variables
dotenv.config();

const CHROMA_HOST = process.env.VITE_CHROMA_HOST || 'localhost';
const CHROMA_PORT = process.env.VITE_CHROMA_PORT || '8001';
const CHROMA_URL = `http://${CHROMA_HOST}:${CHROMA_PORT}`;

async function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function tryConnect(retries = 30, delay = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(`${CHROMA_URL}/heartbeat`);
      if (response.ok) {
        console.log('Successfully connected to ChromaDB');
        return;
      }
    } catch (error) {
      if (i === retries - 1) {
        console.log('Starting ChromaDB server...');
        const pythonCmd = process.platform === 'win32' ? '.\\venv\\Scripts\\python' : './venv/bin/python';
        const chromaServer = spawn(pythonCmd, ['start_chroma.py'], {
          stdio: 'inherit',
          detached: true
        });
        chromaServer.unref();
        
        // Wait for the server to start
        for (let j = 0; j < retries; j++) {
          try {
            const response = await fetch(`${CHROMA_URL}/heartbeat`);
            if (response.ok) {
              console.log('ChromaDB server is ready');
              return;
            }
          } catch (e) {
            if (j === retries - 1) throw new Error('Failed to start ChromaDB server');
            await wait(delay);
          }
        }
      }
      console.log(`Connection attempt ${i + 1} failed, retrying in ${delay/1000} seconds...`);
      await wait(delay);
    }
  }
}

async function initializeChromaDB() {
  console.log('Initializing ChromaDB schema...');
  console.log(`Using ChromaDB URL: ${CHROMA_URL}`);

  try {
    // Connect to ChromaDB with retries
    console.log('Connecting to ChromaDB...');
    await tryConnect();
    console.log('Successfully connected to ChromaDB');

    // Define collections to create
    const collectionsToCreate = [
      {
        name: 'chat_sessions',
        description: 'Stores chat session history and metadata'
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
      },
      {
        name: 'user_settings',
        description: 'Stores user settings and API keys'
      }
    ];

    // Get existing collections
    const response = await fetch(`${CHROMA_URL}/collections`);
    if (!response.ok) {
      throw new Error('Failed to fetch collections');
    }
    const existingCollections = await response.json();
    const existingNames = existingCollections.map(c => c.name);

    // Create collections if they don't exist
    for (const collection of collectionsToCreate) {
      if (!existingNames.includes(collection.name)) {
        const response = await fetch(`${CHROMA_URL}/collections`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: collection.name,
            metadata: {
              description: collection.description,
              "hnsw:space": "cosine",
              "hnsw:construction_ef": 100,
              "hnsw:search_ef": 50
            }
          })
        });

        if (!response.ok) {
          throw new Error(`Failed to create collection ${collection.name}: ${await response.text()}`);
        }

        console.log(`Created collection '${collection.name}'`);
      } else {
        console.log(`Collection '${collection.name}' already exists`);
      }
    }

    console.log('Successfully created all collections in ChromaDB');

    // Add test documents and default settings
    const initialData = [
      {
        collection: 'user_settings',
        data: {
          ids: ['api_keys'],
          metadatas: [{ timestamp: Date.now(), type: 'settings' }],
          documents: [JSON.stringify({
            openaiKey: process.env.VITE_OPENAI_API_KEY || '',
            claudeKey: process.env.VITE_CLAUDE_API_KEY || '',
            deepseekKey: process.env.VITE_DEEPSEEK_API_KEY || '',
            lmStudioHost: process.env.VITE_LM_STUDIO_HOST || 'localhost',
            lmStudioPort: process.env.VITE_LM_STUDIO_PORT || '1234'
          })]
        }
      }
    ];

    for (const item of initialData) {
      const response = await fetch(`${CHROMA_URL}/collections/${item.collection}/add`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(item.data)
      });

      if (!response.ok) {
        console.warn(`Warning: Failed to add initial data to '${item.collection}': ${await response.text()}`);
      } else {
        console.log(`Added initial data to '${item.collection}'`);
      }
    }

    console.log('Successfully added test documents');
    console.log('ChromaDB initialization complete!');

  } catch (error) {
    console.error('Failed to initialize ChromaDB:', error);
    process.exit(1);
  }
}

// Run the initialization
initializeChromaDB();
