import weaviate from 'weaviate-ts-client';

async function initializeWeaviate() {
  console.log('Initializing Weaviate schema...');

  try {
    // Connect to Weaviate
    const client = weaviate.client({
      scheme: 'http',
      host: 'localhost:8080',
    });

    // Check if schema already exists
    const schema = await client.schema.getter().do();
    const documentClass = schema.classes?.find(c => c.class === 'Document');

    if (documentClass) {
      console.log('Document schema already exists. Skipping initialization.');
      return;
    }

    // Create the Document class schema
    await client.schema
      .classCreator()
      .withClass({
        class: 'Document',
        description: 'A document with embeddings',
        properties: [
          {
            name: 'title',
            dataType: ['text'],
            description: 'The title of the document',
          },
          {
            name: 'content',
            dataType: ['text'],
            description: 'The content of the document',
          },
          {
            name: 'metadata',
            dataType: ['object'],
            description: 'Document metadata',
            nestedProperties: [
              {
                name: 'createdAt',
                dataType: ['number'],
                description: 'Timestamp when the document was created',
              },
              {
                name: 'type',
                dataType: ['text'],
                description: 'Document type',
              },
              {
                name: 'tags',
                dataType: ['text[]'],
                description: 'Optional document tags',
              },
            ],
          },
        ],
        vectorizer: 'multi2vec-clip',
        moduleConfig: {
          'multi2vec-clip': {
            vectorizeClassName: true,
            textFields: ['title', 'content']
          },
        },
      })
      .do();

    console.log('Successfully created Document schema in Weaviate');

    // Optional: Add some test data
    const testDocument = {
      title: 'Test Document',
      content: 'This is a test document to verify the schema works correctly.',
      metadata: {
        createdAt: Date.now(),
        type: 'test',
        tags: ['test', 'initialization'],
      },
    };

    await client.data
      .creator()
      .withClassName('Document')
      .withProperties(testDocument)
      .do();

    console.log('Successfully added test document');
    console.log('Weaviate initialization complete!');

  } catch (error) {
    console.error('Failed to initialize Weaviate:', error);
    process.exit(1);
  }
}

// Run the initialization
initializeWeaviate();
