/// <reference types="cypress" />

describe('MCP Workflow', () => {
  beforeEach(() => {
    // Visit the MCP page
    cy.visit('/mcp');

    // Mock MCP server responses
    cy.intercept('GET', '/api/mcp/servers', {
      statusCode: 200,
      body: {
        servers: [
          {
            name: 'test-server',
            status: {
              connected: true,
              tools: [
                {
                  name: 'test:operation',
                  description: 'Test operation',
                  inputSchema: {
                    type: 'object',
                    properties: {
                      param: { type: 'string' },
                    },
                    required: ['param'],
                  },
                },
              ],
              resources: [],
            },
          },
        ],
      },
    });
  });

  describe('Server Management', () => {
    it('displays connected servers', () => {
      cy.get('[data-testid="server-list"]')
        .should('exist')
        .within(() => {
          cy.contains('test-server').should('exist');
          cy.contains('Connected').should('exist');
        });
    });

    it('shows server details on selection', () => {
      cy.get('[data-testid="server-list"]')
        .contains('test-server')
        .click();

      cy.get('[data-testid="server-details"]')
        .should('exist')
        .within(() => {
          cy.contains('test:operation').should('exist');
          cy.contains('Test operation').should('exist');
        });
    });

    it('handles server disconnection', () => {
      // Mock server disconnection
      cy.intercept('GET', '/api/mcp/servers', {
        statusCode: 200,
        body: {
          servers: [
            {
              name: 'test-server',
              status: {
                connected: false,
                tools: [],
                resources: [],
              },
            },
          ],
        },
      });

      // Refresh server status
      cy.get('[data-testid="refresh-servers"]').click();

      cy.get('[data-testid="server-list"]')
        .should('exist')
        .within(() => {
          cy.contains('test-server').should('exist');
          cy.contains('Disconnected').should('exist');
        });
    });
  });

  describe('Tool Operations', () => {
    beforeEach(() => {
      // Select test server
      cy.get('[data-testid="server-list"]')
        .contains('test-server')
        .click();
    });

    it('executes tool operation successfully', () => {
      // Mock successful operation
      cy.intercept('POST', '/api/mcp/execute', {
        statusCode: 200,
        body: {
          success: true,
          result: 'Operation completed successfully',
        },
      });

      // Select tool
      cy.get('[data-testid="tool-list"]')
        .contains('test:operation')
        .click();

      // Fill operation parameters
      cy.get('[data-testid="param-input"]')
        .type('test value');

      // Execute operation
      cy.get('[data-testid="execute-operation"]')
        .click();

      // Verify success message
      cy.get('[data-testid="operation-result"]')
        .should('contain', 'Operation completed successfully');
    });

    it('handles operation failure', () => {
      // Mock operation failure
      cy.intercept('POST', '/api/mcp/execute', {
        statusCode: 400,
        body: {
          success: false,
          error: 'Operation failed: Invalid parameters',
        },
      });

      // Select tool
      cy.get('[data-testid="tool-list"]')
        .contains('test:operation')
        .click();

      // Execute without required parameter
      cy.get('[data-testid="execute-operation"]')
        .click();

      // Verify error message
      cy.get('[data-testid="operation-error"]')
        .should('contain', 'Operation failed: Invalid parameters');
    });

    it('enforces operation permissions', () => {
      // Mock permission denied
      cy.intercept('POST', '/api/mcp/execute', {
        statusCode: 403,
        body: {
          success: false,
          error: 'Operation not allowed by policy',
        },
      });

      // Select tool
      cy.get('[data-testid="tool-list"]')
        .contains('test:operation')
        .click();

      // Fill operation parameters
      cy.get('[data-testid="param-input"]')
        .type('test value');

      // Execute operation
      cy.get('[data-testid="execute-operation"]')
        .click();

      // Verify permission denied message
      cy.get('[data-testid="operation-error"]')
        .should('contain', 'Operation not allowed by policy');
    });
  });

  describe('Resource Access', () => {
    beforeEach(() => {
      // Mock server with resources
      cy.intercept('GET', '/api/mcp/servers', {
        statusCode: 200,
        body: {
          servers: [
            {
              name: 'test-server',
              status: {
                connected: true,
                tools: [],
                resources: [
                  {
                    uri: 'test://resource',
                    name: 'Test Resource',
                  },
                ],
              },
            },
          ],
        },
      });

      // Select test server
      cy.get('[data-testid="server-list"]')
        .contains('test-server')
        .click();
    });

    it('accesses resource successfully', () => {
      // Mock successful resource access
      cy.intercept('GET', '/api/mcp/resource/*', {
        statusCode: 200,
        body: {
          content: 'Resource content',
        },
      });

      // Select resource
      cy.get('[data-testid="resource-list"]')
        .contains('Test Resource')
        .click();

      // Verify resource content
      cy.get('[data-testid="resource-content"]')
        .should('contain', 'Resource content');
    });

    it('handles resource access failure', () => {
      // Mock resource access failure
      cy.intercept('GET', '/api/mcp/resource/*', {
        statusCode: 403,
        body: {
          error: 'Resource access denied',
        },
      });

      // Select resource
      cy.get('[data-testid="resource-list"]')
        .contains('Test Resource')
        .click();

      // Verify error message
      cy.get('[data-testid="resource-error"]')
        .should('contain', 'Resource access denied');
    });
  });

  describe('Security Features', () => {
    it('shows auto-approved operations', () => {
      // Mock server with auto-approved operations
      cy.intercept('GET', '/api/mcp/servers', {
        statusCode: 200,
        body: {
          servers: [
            {
              name: 'test-server',
              status: {
                connected: true,
                tools: [
                  {
                    name: 'test:operation',
                    description: 'Test operation',
                    autoApproved: true,
                  },
                ],
              },
            },
          ],
        },
      });

      cy.get('[data-testid="tool-list"]')
        .contains('test:operation')
        .parent()
        .should('have.class', 'auto-approved');
    });

    it('requires confirmation for non-auto-approved operations', () => {
      // Select tool
      cy.get('[data-testid="tool-list"]')
        .contains('test:operation')
        .click();

      // Fill operation parameters
      cy.get('[data-testid="param-input"]')
        .type('test value');

      // Execute operation
      cy.get('[data-testid="execute-operation"]')
        .click();

      // Verify confirmation dialog
      cy.get('[data-testid="operation-confirm"]')
        .should('exist')
        .within(() => {
          cy.contains('Confirm Operation').should('exist');
          cy.get('[data-testid="confirm-button"]').click();
        });
    });
  });
});
