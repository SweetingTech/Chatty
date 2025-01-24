import React from 'react';
import { format } from 'date-fns';
import { FileText, Trash2, Search } from 'lucide-react';
import type { EmbeddedDocument } from '../types';

interface DocumentListProps {
  documents: EmbeddedDocument[];
  onDelete: (id: string) => void;
  onSearch: (content: string) => void;
}

export function DocumentList({ documents, onDelete, onSearch }: DocumentListProps) {
  return (
    <div className="bg-white rounded-lg shadow">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Document
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Created
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {documents.map((doc) => (
              <tr key={doc.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <FileText size={20} className="text-gray-400 mr-3" />
                    <div className="text-sm font-medium text-gray-900">
                      {doc.title}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {format(doc.createdAt, 'MMM d, yyyy')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button
                    onClick={() => onSearch(doc.content)}
                    className="text-blue-600 hover:text-blue-900 mr-4"
                  >
                    <Search size={18} />
                  </button>
                  <button
                    onClick={() => onDelete(doc.id)}
                    className="text-red-600 hover:text-red-900"
                  >
                    <Trash2 size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}