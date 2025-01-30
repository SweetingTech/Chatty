import { mcp } from '../mcp';
import type { API } from '../../types';

interface MCPProvider {
  id: string;
  context: string[];
  apis: API[];
  metadata: {
    type: 'llm' | 'api' | 'hybrid';
    capabilities: string[];
    maxTokens?: number;
    temperature?: number;
  };
}

const baseProviders: MCPProvider[] = [
  {
    id: 'lm-studio',
    context: [
      'You are running in LM Studio local environment',
      'Respond efficiently and accurately'
    ],
    apis: [],
    metadata: {
      type: 'llm',
      capabilities: ['text-generation', 'chat'],
      maxTokens: 4096,
      temperature: 0.7
    }
  },
  {
    id: 'openai',
    context: [
      'You are using OpenAI models',
      'Follow OpenAI usage guidelines'
    ],
    apis: [],
    metadata: {
      type: 'hybrid',
      capabilities: ['text-generation', 'chat', 'embeddings', 'function-calling'],
      maxTokens: 4096,
      temperature: 0.7
    }
  },
  {
    id: 'claude',
    context: [
      'You are using Anthropic Claude',
      'Follow Anthropic\'s ethical principles'
    ],
    apis: [],
    metadata: {
      type: 'llm',
      capabilities: ['text-generation', 'chat', 'analysis'],
      maxTokens: 8192,
      temperature: 0.7
    }
  }
];

// Base API configurations
const baseAPIs: API[] = [
  {
    id: 'giphy',
    name: 'GIPHY',
    description: 'GIF search and retrieval',
    baseUrl: 'https://api.giphy.com/v1',
    authType: 'apiKey',
    headers: {},
    endpoints: [
      {
        path: '/gifs/search',
        method: 'GET',
        description: 'Search GIFs',
        parameters: {
          q: 'Search query',
          limit: 'Number of results',
          offset: 'Results offset',
          rating: 'Content rating'
        }
      },
      {
        path: '/gifs/trending',
        method: 'GET',
        description: 'Get trending GIFs',
        parameters: {
          limit: 'Number of results',
          offset: 'Results offset',
          rating: 'Content rating'
        }
      }
    ]
  },
  {
    id: 'arxiv',
    name: 'arXiv',
    description: 'Scientific paper repository',
    baseUrl: 'http://export.arxiv.org/api',
    authType: 'none',
    headers: {},
    endpoints: [
      {
        path: '/query',
        method: 'GET',
        description: 'Search papers',
        parameters: {
          search_query: 'Search terms',
          start: 'Starting index',
          max_results: 'Maximum results'
        }
      }
    ]
  },
  {
    id: 'reddit',
    name: 'Reddit',
    description: 'Reddit API integration',
    baseUrl: 'https://oauth.reddit.com',
    authType: 'bearer',
    headers: {
      'User-Agent': 'Multi-LLM App v1.0.0'
    },
    endpoints: [
      {
        path: '/r/{subreddit}/hot',
        method: 'GET',
        description: 'Get hot posts from subreddit',
        parameters: {
          limit: 'Number of posts',
          after: 'Pagination token'
        }
      },
      {
        path: '/api/v1/me',
        method: 'GET',
        description: 'Get user information',
        parameters: {}
      }
    ]
  }
];

// Create root MCPs for each provider
export const setupRootMCPs = () => {
  const providers = baseProviders.map(provider => {
    const context = mcp.createContext(provider.id, provider.context, provider.metadata);
    return {
      ...context,
      apis: provider.apis
    };
  });

  return {
    lmStudioMCP: providers.find(p => p.id === 'lm-studio')!,
    openAIMCP: providers.find(p => p.id === 'openai')!,
    claudeMCP: providers.find(p => p.id === 'claude')!
  };
};

// Add API to MCP
export const addAPItoMCP = (mcpId: string, api: API) => {
  const context = mcp.getContext(mcpId);
  if (!context) throw new Error(`MCP not found: ${mcpId}`);

  // Add API-specific context
  const apiContext = [
    `API Integration: ${api.name}`,
    `Base URL: ${api.baseUrl}`,
    `Available endpoints: ${api.endpoints.map(e => e.path).join(', ')}`
  ];

  mcp.updateContext(mcpId, [...context.context, ...apiContext]);
};

// Remove API from MCP
export const removeAPIFromMCP = (mcpId: string, apiId: string) => {
  const context = mcp.getContext(mcpId);
  if (!context) throw new Error(`MCP not found: ${mcpId}`);

  // Remove API-specific context
  const updatedContext = context.context.filter(c => 
    !c.startsWith(`API Integration: `) && !c.includes(apiId)
  );

  mcp.updateContext(mcpId, updatedContext);
};

export const getBaseAPIs = () => baseAPIs;