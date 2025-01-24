// Mock implementation of chromadb-default-embed
export const pipeline = {
  // Basic pipeline implementation
  async pipe(texts) {
    return texts.map(text => new Float32Array(384).fill(0)); // Return zero embeddings
  }
};

export const env = {
  // Environment configuration
  backends: ['cpu'],
  device: 'cpu'
};
