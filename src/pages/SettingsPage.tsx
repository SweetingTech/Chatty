import React, { useMemo } from 'react';
import { useAppStore } from '../store';
import SaveButton from '../components/SaveButton';

export function SettingsPage() {
  const { 
    settings, 
    draftSettings,
    updateDraftSettings, 
    saveDraftSettings, 
    hasDraftSettings 
  } = useAppStore();

  const currentSettings = draftSettings || settings;

  return (
    <div className="h-full">
      <h1 className="text-2xl font-bold mb-4">Settings</h1>
      <div className="bg-white rounded-lg shadow-md p-6 max-w-2xl">
        <form className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              LM Studio URL
            </label>
            <input
              type="text"
              value={currentSettings.lmStudioUrl}
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
              value={currentSettings.weaviateUrl}
              onChange={(e) => updateDraftSettings({ weaviateUrl: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              OpenAI API Key
            </label>
            <input
              type="password"
              value={currentSettings.openaiKey}
              onChange={(e) => updateDraftSettings({ openaiKey: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Claude API Key
            </label>
            <input
              type="password"
              value={currentSettings.claudeKey}
              onChange={(e) => updateDraftSettings({ claudeKey: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Theme
            </label>
            <select
              value={currentSettings.theme}
              onChange={(e) =>
                updateDraftSettings({ theme: e.target.value as 'light' | 'dark' })
              }
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Brave API Key (Optional)
            </label>
            <input
              type="password"
              value={currentSettings.braveApiKey || ''}
              onChange={(e) => updateDraftSettings({ braveApiKey: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
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
