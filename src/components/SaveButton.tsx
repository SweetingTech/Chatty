import { useState } from 'react';
import { CheckCircleIcon, ExclamationCircleIcon } from '@heroicons/react/24/solid';

interface SaveButtonProps {
  onSave: () => Promise<void>;
  hasChanges: boolean;
  disabled?: boolean;
}

export default function SaveButton({ onSave, hasChanges, disabled = false }: SaveButtonProps) {
  const [status, setStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');

  const handleClick = async () => {
    setStatus('saving');
    try {
      await onSave();
      setStatus('success');
      setTimeout(() => setStatus('idle'), 2000);
    } catch (error) {
      setStatus('error');
      setTimeout(() => setStatus('idle'), 2000);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled || status === 'saving'}
      className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white ${
        status === 'error' 
          ? 'bg-red-600 hover:bg-red-700' 
          : 'bg-indigo-600 hover:bg-indigo-700'
      } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500`}
    >
      {status === 'saving' && (
        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      )}
      {status === 'success' && <CheckCircleIcon className="-ml-1 mr-3 h-5 w-5" />}
      {status === 'error' && <ExclamationCircleIcon className="-ml-1 mr-3 h-5 w-5" />}
      {status === 'idle' && 'Save Changes'}
      {status === 'saving' && 'Saving...'}
      {status === 'success' && 'Saved!'}
      {status === 'error' && 'Error'}
    </button>
  );
}
