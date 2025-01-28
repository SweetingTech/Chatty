# Multi-LLM Application

A powerful and flexible application for managing and interacting with multiple Large Language Models (LLMs) through a unified interface.

![Multi-LLM Dashboard](https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&q=80&w=2000)

## Features

- 🤖 **Multi-Model Support**: Seamlessly integrate with various LLM providers:
  - Local models via LM Studio
  - OpenAI models
  - Anthropic's Claude
  - Custom model implementations

- 💬 **Advanced Chat Interface**:
  - Multi-session management
  - Context-aware conversations
  - File attachments support
  - Real-time responses

- 📊 **Vector Database Integration**:
  - Document embeddings with Weaviate
  - Semantic search capabilities
  - Efficient document management
  - Automatic indexing

- 🤖 **Agent System**:
  - Create and manage AI agents
  - Tool integration
  - Task automation
  - Status monitoring

- 🛠️ **Tool Management**:
  - Custom tool creation
  - API integrations
  - Function calling
  - CLI command execution

- 🧠 **Model Context Protocol (MCP)**:
  - Context management
  - Cross-model communication
  - Context merging
  - Response tracking

- 💻 **CLI Interface**:
  - Command-line control
  - System monitoring
  - Agent management
  - Quick actions

## Getting Started

### Prerequisites

- Node.js 18 or higher
- npm or yarn
- A modern web browser
- ChromaDB v0.6.0 or higher

### ChromaDB v0.6.0 Migration

The application has been updated to support ChromaDB v0.6.0, which includes several important changes:

1. **Collection Listing**: ChromaDB now returns only collection names from `list_collections()` instead of full collection objects.
2. **Storage Backend**: Uses SQLite by default instead of DuckDB+Parquet.
3. **Client Initialization**: Uses the new `PersistentClient` class:
   ```python
   client = chromadb.PersistentClient(
       path="./chroma_data",
       settings=Settings(
           anonymized_telemetry=False,
           allow_reset=True,
           is_persistent=True
       )
   )
   ```

These changes improve reliability and performance while maintaining compatibility with existing data.

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/multi-llm-app.git
   cd multi-llm-app
   ```

2. Run the installation script:
   ```bash
   install.bat
   ```
   
   The installation script provides several options:
   - Full Installation (All Components)
   - Frontend Only (npm packages)
   - Python Environment Only
   - ChromaDB Setup Only
   - Weaviate Setup Only

   Choose the appropriate option based on your needs. For first-time setup, select "Full Installation".

3. Configure environment variables:
   - Copy `.env.example` to `.env`
   - Update the configuration values in `.env`

4. Start the application:
   ```bash
   start.bat
   ```

   This will start both the ChromaDB server and the frontend development server.

Note: If you encounter any issues during installation, you can run individual components of the installation process by selecting the appropriate option in `install.bat`.

### Configuration

1. Navigate to the Settings page
2. Configure at least one of the following:
   - LM Studio URL (for local models)
   - OpenAI API key
   - Claude API key
3. Optional: Set up Weaviate for document embeddings

## Architecture

The application is built with modern web technologies:

- **Frontend**: React, TypeScript, Tailwind CSS
- **State Management**: Zustand
- **Routing**: React Router
- **Vector Database**: Weaviate
- **Embedding Storage**: ChromaDB
- **UI Components**: Custom components with Lucide icons

## Components

- `Layout`: Main application structure
- `ChatInput/Message`: Chat interface components
- `AgentCard/Form`: Agent management
- `ToolCard/Form`: Tool configuration
- `DocumentUploader/List`: Document handling
- `Modal`: Reusable modal component
- `StatusCard/StatsCard`: Dashboard components

## Pages

- `/`: Chat interface
- `/embeddings`: Document embeddings
- `/dashboard`: System overview
- `/agents`: Agent management
- `/tools`: Tool configuration
- `/mcp`: Model Context Protocol
- `/cli`: Command-line interface
- `/settings`: System configuration

## Development

### Project Structure

```
src/
  ├── components/     # Reusable UI components
  ├── pages/         # Application pages
  ├── lib/           # Utility functions and services
  ├── store/         # State management
  ├── types/         # TypeScript definitions
  └── main.tsx       # Application entry point
```

### Building

```bash
npm run build
```

### Testing

```bash
npm run test
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Icons by [Lucide](https://lucide.dev)
- UI inspiration from various modern web applications
- Community feedback and contributions

## Support

For support, please:
1. Check the documentation
2. Search existing issues
3. Create a new issue if needed

---

Built with ❤️ by [Your Name/Organization]
