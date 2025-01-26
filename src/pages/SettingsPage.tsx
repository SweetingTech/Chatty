import React, { useMemo, useEffect, useCallback } from 'react';
import { useAppStore } from '../store';
import { SaveButton } from '../components/SaveButton';
import type { ProviderType } from '../types';

export function SettingsPage() {
  const {
    settings,
    draftSettings,
    updateDraftSettings,
    saveDraftSettings,
    hasDraftSettings,
    llmConfigs,
    updateLLMConfig,
    setDefaultProvider
  } = useAppStore();

  const currentSettings = draftSettings || settings;

  // Update LM Studio settings when host/port or URL changes
  useEffect(() => {
    if (currentSettings.lmStudioHost && currentSettings.lmStudioPort) {
      const url = `http://${currentSettings.lmStudioHost}:${currentSettings.lmStudioPort}`;
      if (currentSettings.lmStudioUrl !== url) {
        updateDraftSettings({ lmStudioUrl: url });
      }
      updateLLMConfig('lm-studio', {
        host: currentSettings.lmStudioHost,
        port: currentSettings.lmStudioPort
      } as any);
    } else if (currentSettings.lmStudioUrl) {
      try {
        const url = new URL(currentSettings.lmStudioUrl);
        const host = url.hostname;
        const port = url.port;
        if (host && port) {
          updateDraftSettings({
            lmStudioHost: host,
            lmStudioPort: port
          });
          updateLLMConfig('lm-studio', {
            host: host,
            port: port
          } as any);
        }
      } catch (error) {
        console.error('Invalid LM Studio URL:', error);
      }
    }
  }, [currentSettings.lmStudioHost, currentSettings.lmStudioPort, currentSettings.lmStudioUrl, updateDraftSettings, updateLLMConfig]);

  const handleSetDefault = useCallback((provider: ProviderType) => {
    setDefaultProvider(provider);
  }, [setDefaultProvider]);

  const handleToggleProvider = useCallback((provider: ProviderType, enabled: boolean) => {
    updateLLMConfig(provider, { enabled });
  }, [updateLLMConfig]);

  const handleUpdateApiKey = useCallback((provider: ProviderType, apiKey: string) => {
    updateLLMConfig(provider, { apiKey });
  }, [updateLLMConfig]);

  return (
    <div className="h-full">
      <h1 className="text-2xl font-bold mb-4">Settings</h1>
      <div className="bg-white rounded-lg shadow-md p-6 max-w-2xl">
        <form className="space-y-6">
          {/* Infrastructure URLs */}
          <div>
            <h2 className="text-lg font-semibold mb-4">Infrastructure</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  LM Studio URL
                </label>
                <input
                  type="text"
                  value={currentSettings?.lmStudioUrl || ''}
                  onChange={(e) => updateDraftSettings({ lmStudioUrl: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Weaviate URL
                </label>
                <input
                  type="text"
                  value={currentSettings?.weaviateUrl || ''}
                  onChange={(e) => updateDraftSettings({ weaviateUrl: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* LLM Providers */}
          <div>
            <h2 className="text-lg font-semibold mb-4">LLM Providers</h2>
            <div className="space-y-4">
              {/* OpenAI */}
              <div className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={llmConfigs?.openai?.enabled ?? false}
                      onChange={(e) => handleToggleProvider('openai', e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <h3 className="font-medium">OpenAI</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSetDefault('openai')}
                    disabled={!llmConfigs?.openai?.enabled}
                    className={`px-3 py-1 text-sm rounded-full ${
                      llmConfigs?.openai?.isDefault
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                    } disabled:opacity-50`}
                  >
                    {llmConfigs?.openai?.isDefault ? 'Default' : 'Set as Default'}
                  </button>
                </div>
                    <input
                      type="password"
                      value={llmConfigs?.openai?.apiKey || ''}
                      onChange={(e) => handleUpdateApiKey('openai', e.target.value)}
                      placeholder="OpenAI API Key"
                      className="mt-2 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
              </div>

              {/* Claude */}
              <div className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={llmConfigs?.claude?.enabled ?? false}
                      onChange={(e) => handleToggleProvider('claude', e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <h3 className="font-medium">Claude</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSetDefault('claude')}
                    disabled={!llmConfigs?.claude?.enabled}
                    className={`px-3 py-1 text-sm rounded-full ${
                      llmConfigs?.claude?.isDefault
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                    } disabled:opacity-50`}
                  >
                    {llmConfigs?.claude?.isDefault ? 'Default' : 'Set as Default'}
                  </button>
                </div>
                    <input
                      type="password"
                      value={llmConfigs?.claude?.apiKey || ''}
                      onChange={(e) => handleUpdateApiKey('claude', e.target.value)}
                      placeholder="Claude API Key"
                      className="mt-2 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
              </div>

              {/* LM Studio */}
              <div className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={llmConfigs?.['lm-studio']?.enabled ?? false}
                      onChange={(e) => handleToggleProvider('lm-studio', e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <h3 className="font-medium">LM Studio</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSetDefault('lm-studio')}
                    disabled={!llmConfigs?.['lm-studio']?.enabled}
                    className={`px-3 py-1 text-sm rounded-full ${
                      llmConfigs?.['lm-studio']?.isDefault
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                    } disabled:opacity-50`}
                  >
                    {llmConfigs?.['lm-studio']?.isDefault ? 'Default' : 'Set as Default'}
                  </button>
                </div>
                <div className="mt-2 space-y-2">
                  <input
                    type="text"
                    value={currentSettings?.lmStudioHost || ''}
                    onChange={(e) => updateDraftSettings({ lmStudioHost: e.target.value })}
                    placeholder="Host (e.g., localhost)"
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                  <input
                    type="text"
                    value={currentSettings?.lmStudioPort || ''}
                    onChange={(e) => updateDraftSettings({ lmStudioPort: e.target.value })}
                    placeholder="Port (e.g., 1234)"
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Deepseek */}
              <div className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={llmConfigs?.deepseek?.enabled ?? false}
                      onChange={(e) => handleToggleProvider('deepseek', e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <h3 className="font-medium">Deepseek</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSetDefault('deepseek')}
                    disabled={!llmConfigs?.deepseek?.enabled}
                    className={`px-3 py-1 text-sm rounded-full ${
                      llmConfigs?.deepseek?.isDefault
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                    } disabled:opacity-50`}
                  >
                    {llmConfigs?.deepseek?.isDefault ? 'Default' : 'Set as Default'}
                  </button>
                </div>
                    <input
                      type="password"
                      value={llmConfigs?.deepseek?.apiKey || ''}
                      onChange={(e) => handleUpdateApiKey('deepseek', e.target.value)}
                      placeholder="Deepseek API Key"
                      className="mt-2 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
              </div>
            </div>
          </div>

          {/* Theme */}
          <div>
            <h2 className="text-lg font-semibold mb-4">Appearance</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Theme
              </label>
              <select
                value={currentSettings?.theme || 'light'}
                onChange={(e) =>
                  updateDraftSettings({ theme: e.target.value as 'light' | 'dark' })
                }
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </div>
          </div>

          {/* Optional APIs */}
          <div>
            <h2 className="text-lg font-semibold mb-4">Optional APIs</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Brave API Key (Optional)
              </label>
              <input
                type="password"
                value={currentSettings?.braveApiKey || ''}
                onChange={(e) => updateDraftSettings({ braveApiKey: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="mt-6">
            <SaveButton 
              onSave={saveDraftSettings}
              hasChanges={useMemo(() => hasDraftSettings(), [draftSettings])}
            />
          </div>
        </form>
      </div>
    </div>
  );
}
