import { ChromaClient } from 'chromadb';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const CHROMA_URL = process.env.VITE_CHROMA_URL;
const COLLECTION_NAME = process.env.CHROMA_COLLECTION_NAME || 'chat_sessions';

async function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function tryConnect(retries = 5, delay = 2000) {
  const client = new ChromaClient({
    path: CHROMA_URL
  });

  for (let i = 0; i < retries; i++) {
    try {
      await client.listCollections();
      return client;
    } catch (error) {
      if (i === retries - 1) throw error;
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
    const client = await tryConnect();
    console.log('Successfully connected to ChromaDB');

    // Check if collection exists
    const collections = await client.listCollections();
    const chatCollection = collections.find(c => c.name === COLLECTION_NAME);

    if (chatCollection) {
      console.log(`Collection '${COLLECTION_NAME}' already exists. Skipping initialization.`);
      return;
    }

    // Create the collection
    await client.createCollection({
      name: COLLECTION_NAME,
      metadata: {
        description: 'Stores chat session history and metadata'
      },
    });

    console.log(`Successfully created '${COLLECTION_NAME}' collection in ChromaDB`);

    // Add test document to verify everything works
    const collection = await client.getCollection({
      name: COLLECTION_NAME,
    });

    await collection.add({
      ids: ['test-session'],
      metadatas: [{ 
        timestamp: Date.now(),
        type: 'test'
      }],
      documents: [JSON.stringify({
        id: 'test-session',
        title: 'Test Chat Session',
        messages: [{
          id: 'test-message',
          role: 'system',
          content: 'This is a test message to verify ChromaDB is working correctly.',
          timestamp: Date.now()
        }],
        createdAt: Date.now(),
        updatedAt: Date.now()
      })]
    });

    console.log('Successfully added test chat session');
    console.log('ChromaDB initialization complete!');

  } catch (error) {
    console.error('Failed to initialize ChromaDB:', error);
    process.exit(1);
  }
}

// Run the initialization
initializeChromaDB();
