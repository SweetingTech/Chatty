import '@testing-library/jest-dom';

// Mock environment variables
process.env.VITE_API_URL = 'http://localhost:3000';

// Global test environment setup
beforeAll(() => {
  // Setup global test environment
  global.console.error = jest.fn();
  global.console.warn = jest.fn();
});

afterAll(() => {
  // Cleanup global test environment
  jest.restoreAllMocks();
});

// Mock MCP server responses
jest.mock('../src/lib/mcp', () => ({
  MCPRegistry: {
    getInstance: jest.fn(() => ({
      registerClient: jest.fn(),
      getClient: jest.fn(),
      findToolByName: jest.fn(),
      findResourceByUri: jest.fn(),
      getServerStatus: jest.fn(() => ({ connected: true })),
      updateServerStatus: jest.fn(),
    })),
  },
  MCPSecurity: {
    getInstance: jest.fn(() => ({
      validateOperation: jest.fn(() => Promise.resolve(true)),
      validateResourceAccess: jest.fn(() => Promise.resolve(true)),
      trackOperationStart: jest.fn(),
      trackOperationEnd: jest.fn(),
    })),
  },
}));

// Mock fetch for API calls
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
  })
) as jest.Mock;
