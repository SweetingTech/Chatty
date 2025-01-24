import React from 'react';
import { CheckCircle, XCircle, AlertCircle } from 'lucide-react';

interface StatusCardProps {
  title: string;
  status: 'online' | 'offline' | 'warning';
  description: string;
  stats?: {
    label: string;
    value: string | number;
  }[];
}

export function StatusCard({ title, status, description, stats }: StatusCardProps) {
  const getStatusIcon = () => {
    switch (status) {
      case 'online':
        return <CheckCircle className="text-green-500" size={24} />;
      case 'offline':
        return <XCircle className="text-red-500" size={24} />;
      case 'warning':
        return <AlertCircle className="text-yellow-500" size={24} />;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'online':
        return 'bg-green-50 border-green-200';
      case 'offline':
        return 'bg-red-50 border-red-200';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200';
    }
  };

  return (
    <div className={`rounded-lg border p-6 ${getStatusColor()}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        {getStatusIcon()}
      </div>
      <p className="text-sm text-gray-600 mb-4">{description}</p>
      {stats && (
        <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-200">
          {stats.map((stat, index) => (
            <div key={index}>
              <p className="text-sm text-gray-500">{stat.label}</p>
              <p className="text-lg font-semibold text-gray-900">{stat.value}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}