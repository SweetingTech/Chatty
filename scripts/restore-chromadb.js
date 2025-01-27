import * as dotenv from 'dotenv';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

// Load environment variables
dotenv.config();

const CHROMA_HOST = process.env.VITE_CHROMA_HOST || 'localhost';
const CHROMA_PORT = process.env.VITE_CHROMA_PORT || '8001';
const CHROMA_URL = `http://${CHROMA_HOST}:${CHROMA_PORT}`;

async function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function tryConnect(retries = 5, delay = 2000) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(`${CHROMA_URL}/heartbeat`);
      if (response.ok) return;
    } catch (error) {
      if (i === retries - 1) throw error;
      console.log(`Connection attempt ${i + 1} failed, retrying in ${delay/1000} seconds...`);
      await wait(delay);
    }
  }
}

async function createCollection(name, description) {
  // First check if collection exists
  const existingResponse = await fetch(`${CHROMA_URL}/collections`);
  if (!existingResponse.ok) {
    throw new Error('Failed to fetch collections');
  }
  const existingCollections = await existingResponse.json();
  const exists = existingCollections.some(c => c.name === name);

  if (exists) {
    // Delete existing collection
    const deleteResponse = await fetch(`${CHROMA_URL}/collections/${name}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    if (!deleteResponse.ok) {
      console.warn(`Warning: Failed to delete existing collection ${name}`);
    }
  }

  // Create new collection with optimized settings
  const response = await fetch(`${CHROMA_URL}/collections`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name,
      metadata: {
        description,
        "hnsw:space": "cosine",
        "hnsw:construction_ef": 100,
        "hnsw:search_ef": 50
      }
    })
  });

  if (!response.ok) {
    throw new Error(`Failed to create collection ${name}: ${await response.text()}`);
  }
}

async function restoreCollection(collectionName, description) {
  try {
    const backupPath = path.join(process.cwd(), 'chroma_backup', `${collectionName}.json`);
    
    if (!fs.existsSync(backupPath)) {
      console.log(`No backup found for collection ${collectionName}, skipping restore`);
      return;
    }

    const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
    if (!backupData || !backupData.ids || backupData.ids.length === 0) {
      console.log(`Backup for ${collectionName} is empty, skipping restore`);
      return;
    }

    // Create the collection
    await createCollection(collectionName, description);

    // Add the documents
    const response = await fetch(`${CHROMA_URL}/collections/${collectionName}/add`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ids: backupData.ids,
        metadatas: backupData.metadatas,
        documents: backupData.documents
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to restore data to collection ${collectionName}: ${await response.text()}`);
    }

    console.log(`Successfully restored ${collectionName} with ${backupData.ids.length} documents`);
  } catch (error) {
    console.error(`Failed to restore collection ${collectionName}:`, error);
  }
}

async function restoreChromaDB() {
  console.log('Starting ChromaDB restore...');

  try {
    // Connect to ChromaDB with retries
    console.log('Connecting to ChromaDB...');
    await tryConnect();
    console.log('Successfully connected to ChromaDB');

    // Collections to restore with their descriptions
    const collections = [
      {
        name: 'additional_agents',
        description: 'Stores additional custom agents'
      },
      {
        name: 'additional_tools',
        description: 'Stores additional custom tools'
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
        name: 'chat_sessions',
        description: 'Stores chat session history and metadata'
      }
    ];

    // Restore each collection
    for (const collection of collections) {
      console.log(`Restoring collection: ${collection.name}`);
      await restoreCollection(collection.name, collection.description);
    }

    console.log('ChromaDB restore complete!');

  } catch (error) {
    console.error('Failed to restore ChromaDB:', error);
    process.exit(1);
  }
}

// Run the restore
restoreChromaDB();
