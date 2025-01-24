import React, { useState } from 'react';
import { Plus, Globe, Trash2, Settings2 } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { Modal } from '../components/Modal';
import { useAppStore } from '../store';
import { SaveButton } from '../components/SaveButton';
import type { API, APIEndpoint } from '../types';

export function APIPage() {
  const { 
    apis, 
    addAPI, 
    deleteAPI, 
    updateDraftAPI, 
    saveDraftAPI, 
    hasDraftAPI 
  } = useAppStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAPI, setSelectedAPI] = useState<API | null>(null);

  const onDrop = async (acceptedFiles: File[]) => {
    const apiConfigs = await Promise.all(
      acceptedFiles.map(async (file) => {
        const text = await file.text();
        try {
          return JSON.parse(text);
        } catch (e) {
          console.error(`Failed to parse ${file.name}:`, e);
          return null;
        }
      })
    );

    const validConfigs = apiConfigs.filter((config): config is API => {
      return config && typeof config.name === 'string' && typeof config.baseUrl === 'string';
    });

    validConfigs.forEach(config => addAPI(config));
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/json': ['.json'],
    },
  });

  return (
    <div className="h-full p-8 bg-gray-50">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">API Management</h1>
            <p className="mt-1 text-sm text-gray-500">
              Configure and manage API integrations for agents
            </p>
          </div>
          <button
            onClick={() => {
              setSelectedAPI(null);
              setIsModalOpen(true);
            }}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus size={20} />
            <span>New API</span>
          </button>
        </div>

        {/* Drag & Drop Zone */}
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            isDragActive
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 hover:border-gray-400'
          }`}
        >
          <input {...getInputProps()} />
          <Globe
            size={32}
            className={`mx-auto mb-4 ${
              isDragActive ? 'text-blue-500' : 'text-gray-400'
            }`}
          />
          <p className="text-sm text-gray-600">
            {isDragActive
              ? 'Drop the API configuration files here...'
              : 'Drag and drop API configuration files here, or click to select files'}
          </p>
          <p className="text-xs text-gray-500 mt-2">Supports JSON configuration files</p>
        </div>

        {/* API List */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {apis.map((api) => (
            <div key={api.id} className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <div className="h-10 w-10 bg-blue-50 rounded-lg flex items-center justify-center">
                    <Globe className="text-blue-500" size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{api.name}</h3>
                    <p className="text-sm text-gray-500">{api.description}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => {
                      setSelectedAPI(api);
                      setIsModalOpen(true);
                    }}
                    className="p-2 text-gray-600 hover:bg-gray-50 rounded-lg"
                  >
                    <Settings2 size={20} />
                  </button>
                  <button
                    onClick={() => deleteAPI(api.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-200">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Endpoints</h4>
                <div className="space-y-2">
                  {api.endpoints.map((endpoint, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between text-sm bg-gray-50 p-2 rounded"
                    >
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium
                          ${endpoint.method === 'GET' ? 'bg-green-100 text-green-800' :
                            endpoint.method === 'POST' ? 'bg-blue-100 text-blue-800' :
                            endpoint.method === 'PUT' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'}`}
                        >
                          {endpoint.method}
                        </span>
                        <span className="font-mono">{endpoint.path}</span>
                      </div>
                      <span className="text-gray-500">{endpoint.description}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-200">
                <SaveButton 
                  onSave={() => saveDraftAPI(api.id)}
                  hasChanges={hasDraftAPI(api.id)}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
