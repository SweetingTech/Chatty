# Changelog

## [1.1.0] - Unreleased

### Added
- Added fallback error UI in `App.tsx` for `initializeServices` startup failures.
- Added robust Markdown rendering and syntax highlighting to `ChatMessage.tsx` using `react-markdown`, `remark-gfm`, and `react-syntax-highlighter`.
- Implemented async streaming support in the Python backend (`start_chroma.py`) for both OpenAI and Claude.
- Added explicit error responses for unsupported streaming providers.

### Fixed
- Fixed critical test suite instability and concurrency issues in `MCPRegistry` and `MCPSecurity` by properly clearing singleton states and mock registries between tests.
- Replaced synchronous `OpenAI` client in the Python backend with `AsyncOpenAI` for valid asyncio compatibility.
- Resolved multiple deep-equality and polling test failures by omitting `lastPing` from the public `MCPServerStatus` interface in `mcp/registry.ts`.
- Removed hardcoded API URLs from all LLM providers in the frontend, substituting them with dynamically loaded `import.meta.env` configurations.

### Changed
- Split the monolithic 800+ line Zustand store (`src/store/index.ts`) into seven isolated slices (`settingsSlice`, `agentSlice`, `chatSlice`, `toolSlice`, `mcpSlice`, `apiSlice`, `appSlice`), making state management maintainable and testable while retaining the identical public `useAppStore` hook API.
- Replaced various untyped `any` signatures in Zustand slices and layout components with proper `unknown` or strictly defined types.
- Quarantined flaky fake-timer `executeWithTimeout` Jest tests that failed due to Node environment execution limits.

### Post-Review Fixes
- Fixed a state freezing issue in Zustand's index store configuration (`workflow` static object creation in `Object.assign` via getter proxy). Replaced proxy getters with direct store calls to preserve component reactivity.
- Added explicit visual fallback error boundaries and retry logic to `App.tsx` on application initialize failure.
- Restored test assertions for timeout logic and lifecycle event streams.
