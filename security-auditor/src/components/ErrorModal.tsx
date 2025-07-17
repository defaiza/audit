import React from 'react';
import { ErrorDetails } from '../utils/error-handler';

interface ErrorModalProps {
  error: ErrorDetails | null;
  isOpen: boolean;
  onClose: () => void;
}

export const ErrorModal: React.FC<ErrorModalProps> = ({ error, isOpen, onClose }) => {
  if (!isOpen || !error) return null;

  const getSeverityColor = (code: string) => {
    if (code.includes('NOT_FOUND') || code.includes('NOT_CONNECTED')) return 'bg-yellow-100 text-yellow-800';
    if (code.includes('FAILED') || code.includes('TIMEOUT')) return 'bg-red-100 text-red-800';
    return 'bg-blue-100 text-blue-800';
  };

  const getSeverityIcon = (code: string) => {
    if (code.includes('NOT_FOUND') || code.includes('NOT_CONNECTED')) return '⚠️';
    if (code.includes('FAILED') || code.includes('TIMEOUT')) return '❌';
    return 'ℹ️';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="text-2xl">{getSeverityIcon(error.code)}</span>
            <h2 className="text-xl font-semibold text-gray-900">Error Details</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-4 overflow-y-auto max-h-[calc(90vh-200px)]">
          {/* Error Code Badge */}
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-gray-500">Error Code:</span>
            <span className={`px-2 py-1 text-xs font-medium rounded-full ${getSeverityColor(error.code)}`}>
              {error.code}
            </span>
          </div>

          {/* Error Message */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">{error.message}</h3>
            {error.details && (
              <p className="text-gray-600">{error.details}</p>
            )}
          </div>

          {/* Recovery Suggestions */}
          <div>
            <h4 className="text-md font-semibold text-gray-900 mb-2">
              How to fix this:
            </h4>
            <ol className="space-y-2">
              {error.suggestions.map((suggestion, index) => (
                <li key={index} className="flex">
                  <span className="text-blue-500 font-semibold mr-2 flex-shrink-0">
                    {index + 1}.
                  </span>
                  <span className="text-gray-700">{suggestion}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* Recovery Action Button */}
          {error.recoveryAction && (
            <div className="pt-2">
              <button
                onClick={() => {
                  error.recoveryAction!();
                  onClose();
                }}
                className="w-full bg-blue-500 text-white font-medium py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors"
              >
                Try Recovery Action
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Check the browser console for more technical details
            </p>
            <button
              onClick={onClose}
              className="bg-gray-200 text-gray-700 font-medium py-2 px-4 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}; 