# Default Port Configuration

This document lists all default ports used by the Multi-LLM application and its dependencies.

## Core Services

| Service | Port | Description |
|---------|------|-------------|
| Vite Dev Server | 5173 | Main application development server |
| Production Build | 4173 | Production preview server |

## LLM Services

| Service | Port | Description |
|---------|------|-------------|
| LM Studio | 1234 | Local LLM server |
| LM Studio WebUI | 1235 | LM Studio web interface |

## Vector Databases

| Service | Port | Description |
|---------|------|-------------|
| Weaviate | 8080 | Vector database for embeddings |
| ChromaDB | 8000 | Local embedding storage |

## Agent System

| Service | Port | Description |
|---------|------|-------------|
| Agent Manager | 3000 | Agent coordination service |
| Task Queue | 3001 | Task management system |

## Development Tools

| Service | Port | Description |
|---------|------|-------------|
| Test Runner | 9323 | Vitest test runner |
| Coverage Report | 9324 | Test coverage reporting |

## Port Configuration

To modify these ports:

1. Development server:
   ```bash
   npm run dev -- --port <port>
   ```

2. Preview server:
   ```bash
   npm run preview -- --port <port>
   ```

3. Other services:
   - Update the respective configuration files
   - Modify environment variables
   - Update service configurations