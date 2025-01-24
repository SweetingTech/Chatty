import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload } from 'lucide-react';

interface DocumentUploaderProps {
  onUpload: (files: File[]) => void;
  disabled?: boolean;
}

export function DocumentUploader({ onUpload, disabled }: DocumentUploaderProps) {
  const onDrop = useCallback((acceptedFiles: File[]) => {
    onUpload(acceptedFiles);
  }, [onUpload]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/plain': ['.txt'],
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [
        '.docx',
      ],
    },
    disabled,
  });

  return (
    <div
      {...getRootProps()}
      className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
        isDragActive
          ? 'border-blue-500 bg-blue-50'
          : 'border-gray-300 hover:border-gray-400'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <input {...getInputProps()} />
      <Upload
        size={32}
        className={`mx-auto mb-4 ${
          isDragActive ? 'text-blue-500' : 'text-gray-400'
        }`}
      />
      <p className="text-sm text-gray-600">
        {isDragActive
          ? 'Drop the files here...'
          : 'Drag and drop files here, or click to select files'}
      </p>
      <p className="text-xs text-gray-500 mt-2">
        Supported formats: .txt, .pdf, .doc, .docx
      </p>
    </div>
  );
}