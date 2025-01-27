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

async function backupCollection(collectionName) {
  try {
    const response = await fetch(`${CHROMA_URL}/collections/${collectionName}/get`);
    if (!response.ok) {
      if (response.status === 404) {
        console.log(`Collection ${collectionName} does not exist, skipping backup`);
        return null;
      }
      throw new Error(`Failed to get collection ${collectionName}: ${await response.text()}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`Failed to backup collection ${collectionName}:`, error);
    return null;
  }
}

async function backupChromaDB() {
  console.log('Starting ChromaDB backup...');

  try {
    // Connect to ChromaDB with retries
    console.log('Connecting to ChromaDB...');
    await tryConnect();
    console.log('Successfully connected to ChromaDB');

    // Collections to backup
    const collections = [
      'additional_agents',
      'additional_tools',
      'agent_modifications',
      'tool_modifications',
      'chat_sessions'
    ];

    // Create backup directory if it doesn't exist
    const backupDir = path.join(process.cwd(), 'chroma_backup');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir);
    }

    // Backup each collection
    for (const collection of collections) {
      console.log(`Backing up collection: ${collection}`);
      const data = await backupCollection(collection);
      if (data) {
        const backupPath = path.join(backupDir, `${collection}.json`);
        fs.writeFileSync(backupPath, JSON.stringify(data, null, 2));
        console.log(`Successfully backed up ${collection} to ${backupPath}`);
      }
    }

    console.log('ChromaDB backup complete!');
    console.log(`Backup files saved to: ${backupDir}`);

  } catch (error) {
    console.error('Failed to backup ChromaDB:', error);
    process.exit(1);
  }
}

// Run the backup
backupChromaDB();
