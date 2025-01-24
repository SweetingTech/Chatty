import React, { useEffect, useState } from 'react';
import { useAppStore } from '../store';
import { DocumentUploader } from '../components/DocumentUploader';
import { DocumentList } from '../components/DocumentList';
import { weaviateService } from '../lib/weaviate';
import type { EmbeddedDocument } from '../types';

export function EmbeddingsPage() {
  const { settings } = useAppStore();
  const [documents, setDocuments] = useState<EmbeddedDocument[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (settings.weaviateUrl) {
      loadDocuments();
    }
  }, [settings.weaviateUrl]);

  const loadDocuments = async () => {
    try {
      await weaviateService.init(settings.weaviateUrl);
      const docs = await weaviateService.getAllDocuments();
      setDocuments(
        docs.map((doc: any) => ({
          id: doc._additional.id,
          title: doc.title,
          content: doc.content,
          createdAt: doc.createdAt,
        }))
      );
    } catch (err) {
      setError('Failed to load documents. Please check your Weaviate connection.');
      console.error(err);
    }
  };

  const handleUpload = async (files: File[]) => {
    setIsLoading(true);
    setError(null);

    try {
      for (const file of files) {
        const content = await file.text();
        await weaviateService.addDocument({
          title: file.name,
          content,
          createdAt: Date.now(),
        });
      }
      await loadDocuments();
    } catch (err) {
      setError('Failed to upload documents. Please try again.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await weaviateService.deleteDocument(id);
      setDocuments((docs) => docs.filter((doc) => doc.id !== id));
    } catch (err) {
      setError('Failed to delete document. Please try again.');
      console.error(err);
    }
  };

  const handleSearch = async (content: string) => {
    try {
      const results = await weaviateService.searchDocuments(content);
      setDocuments(
        results.map((doc: any) => ({
          id: doc._additional.id,
          title: doc.title,
          content: doc.content,
          createdAt: doc.createdAt,
        }))
      );
    } catch (err) {
      setError('Failed to search documents. Please try again.');
      console.error(err);
    }
  };

  if (!settings.weaviateUrl) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-700">
            Weaviate Not Configured
          </h2>
          <p className="mt-2 text-gray-500">
            Please set up your Weaviate URL in the settings page
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full p-8 bg-gray-50">
      <div className="max-w-6xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Document Embeddings</h1>
          <p className="mt-1 text-sm text-gray-500">
            Upload documents to create embeddings for semantic search
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 text-sm text-red-600">
            {error}
          </div>
        )}

        <DocumentUploader onUpload={handleUpload} disabled={isLoading} />

        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-4 text-sm text-gray-500">Processing documents...</p>
          </div>
        ) : documents.length > 0 ? (
          <DocumentList
            documents={documents}
            onDelete={handleDelete}
            onSearch={handleSearch}
          />
        ) : (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <p className="text-gray-500">No documents uploaded yet</p>
          </div>
        )}
      </div>
    </div>
  );
}