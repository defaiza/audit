import React from 'react';
import { getImplementationStats, formatImplementationStatus, TEST_METADATA } from '../utils/test-metadata';

export const TestImplementationStatus: React.FC = () => {
  const stats = getImplementationStats();
  const confidenceColor = stats.averageConfidence >= 80 ? 'text-green-400' : 
                         stats.averageConfidence >= 60 ? 'text-yellow-400' : 
                         'text-red-400';

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <h3 className="text-lg font-semibold text-white mb-4">Test Implementation Status</h3>
      
      {/* Overall Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-gray-700 rounded-lg p-3 text-center">
          <p className="text-gray-400 text-xs">Total Tests</p>
          <p className="text-2xl font-bold text-white">{stats.total}</p>
        </div>
        <div className="bg-gray-700 rounded-lg p-3 text-center">
          <p className="text-gray-400 text-xs">Real</p>
          <p className="text-2xl font-bold text-green-400">{stats.real}</p>
        </div>
        <div className="bg-gray-700 rounded-lg p-3 text-center">
          <p className="text-gray-400 text-xs">Partial</p>
          <p className="text-2xl font-bold text-yellow-400">{stats.partial}</p>
        </div>
        <div className="bg-gray-700 rounded-lg p-3 text-center">
          <p className="text-gray-400 text-xs">Placeholder</p>
          <p className="text-2xl font-bold text-red-400">{stats.placeholder}</p>
        </div>
        <div className="bg-gray-700 rounded-lg p-3 text-center">
          <p className="text-gray-400 text-xs">Avg. Confidence</p>
          <p className={`text-2xl font-bold ${confidenceColor}`}>
            {stats.averageConfidence.toFixed(0)}%
          </p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-6">
        <div className="flex justify-between text-xs text-gray-400 mb-1">
          <span>Implementation Progress</span>
          <span>{((stats.real / stats.total) * 100).toFixed(0)}% Real</span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
          <div className="h-full flex">
            <div 
              className="bg-green-500"
              style={{ width: `${(stats.real / stats.total) * 100}%` }}
            />
            <div 
              className="bg-yellow-500"
              style={{ width: `${(stats.partial / stats.total) * 100}%` }}
            />
            <div 
              className="bg-red-500"
              style={{ width: `${(stats.placeholder / stats.total) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Detailed Test List */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-gray-300 mb-2">Test Details</h4>
        <div className="max-h-64 overflow-y-auto space-y-1">
          {Object.values(TEST_METADATA).map(test => {
            const statusFormat = formatImplementationStatus(test.implementationStatus);
            return (
              <div 
                key={test.id}
                className="flex items-center justify-between p-2 bg-gray-700 rounded hover:bg-gray-600 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <span className="text-lg">{statusFormat.icon}</span>
                  <div>
                    <p className="text-sm font-medium text-white">{test.name}</p>
                    <p className="text-xs text-gray-400">{test.category}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="text-right">
                    <span className={`inline-block px-2 py-1 text-xs rounded ${statusFormat.color} bg-opacity-20`}>
                      {statusFormat.label}
                    </span>
                    <p className="text-xs text-gray-400 mt-1">
                      {test.confidence}% confidence
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-6 pt-4 border-t border-gray-700">
        <h4 className="text-sm font-medium text-gray-300 mb-2">Legend</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
          <div className="flex items-center space-x-2">
            <span className="text-green-400">✅</span>
            <span className="text-gray-300">Real: Fully implemented attack vector</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-yellow-400">⚠️</span>
            <span className="text-gray-300">Partial: Limited by platform constraints</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-red-400">🔴</span>
            <span className="text-gray-300">Placeholder: Simulated or not implemented</span>
          </div>
        </div>
      </div>
    </div>
  );
}; 