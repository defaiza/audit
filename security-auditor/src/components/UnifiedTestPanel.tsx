import { useUnifiedTests } from '@/hooks/useUnifiedTests';
import { useState } from 'react';

export function UnifiedTestPanel() {
  const {
    isInitialized,
    isRunning,
    results,
    initializeTests,
    runDeploymentChecks,
    initializePrograms,
    runSecurityTests,
    clearResults
  } = useUnifiedTests();

  const [activeTab, setActiveTab] = useState<'deployment' | 'initialization' | 'security'>('deployment');

  const tabs = [
    { id: 'deployment', name: 'Deployment', icon: '📦' },
    { id: 'initialization', name: 'Initialization', icon: '🚀' },
    { id: 'security', name: 'Security', icon: '🔒' }
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <span className="px-2 py-1 text-xs bg-green-500 text-white rounded">✅ Success</span>;
      case 'warning':
        return <span className="px-2 py-1 text-xs bg-yellow-500 text-white rounded">⚠️ Warning</span>;
      case 'failed':
        return <span className="px-2 py-1 text-xs bg-red-500 text-white rounded">❌ Failed</span>;
      case 'error':
        return <span className="px-2 py-1 text-xs bg-red-600 text-white rounded">🚨 Error</span>;
      default:
        return <span className="px-2 py-1 text-xs bg-gray-500 text-white rounded">Unknown</span>;
    }
  };

  const handleRunTests = async () => {
    switch (activeTab) {
      case 'deployment':
        await runDeploymentChecks();
        break;
      case 'initialization':
        await initializePrograms();
        break;
      case 'security':
        await runSecurityTests('Basic Security');
        break;
    }
  };

  return (
    <div className="bg-gray-900 rounded-lg p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Unified Test Panel</h2>
        <div className="flex gap-2">
          {!isInitialized && (
            <button
              onClick={initializeTests}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
            >
              Initialize Tests
            </button>
          )}
          {results.length > 0 && (
            <button
              onClick={clearResults}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded transition-colors"
            >
              Clear Results
            </button>
          )}
        </div>
      </div>

      {/* Status Indicator */}
      <div className="flex items-center gap-4 p-4 bg-gray-800 rounded">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${isInitialized ? 'bg-green-500' : 'bg-gray-500'}`} />
          <span className="text-gray-300">
            {isInitialized ? 'Test Utils Initialized' : 'Not Initialized'}
          </span>
        </div>
        {isRunning && (
          <div className="flex items-center gap-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            <span className="text-gray-300">Running tests...</span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-700">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`
                py-2 px-1 border-b-2 font-medium text-sm transition-colors
                ${activeTab === tab.id
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-gray-400 hover:text-gray-300'
                }
              `}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="space-y-4">
        {activeTab === 'deployment' && (
          <div>
            <h3 className="text-lg font-semibold text-white mb-2">Deployment Tests</h3>
            <p className="text-gray-400 text-sm mb-4">
              Check if all DeFAI programs are properly deployed on the current cluster.
            </p>
          </div>
        )}

        {activeTab === 'initialization' && (
          <div>
            <h3 className="text-lg font-semibold text-white mb-2">Initialization Tests</h3>
            <p className="text-gray-400 text-sm mb-4">
              Initialize the state of all DeFAI programs. This sets up PDAs, escrow accounts, and configuration.
            </p>
          </div>
        )}

        {activeTab === 'security' && (
          <div>
            <h3 className="text-lg font-semibold text-white mb-2">Security Tests</h3>
            <p className="text-gray-400 text-sm mb-4">
              Run basic security checks including access control, account validation, and state consistency.
            </p>
          </div>
        )}

        {/* Run Button */}
        <button
          onClick={handleRunTests}
          disabled={!isInitialized || isRunning}
          className={`
            w-full py-3 px-4 rounded font-medium transition-all
            ${!isInitialized || isRunning
              ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
            }
          `}
        >
          {isRunning ? 'Running...' : `Run ${tabs.find(t => t.id === activeTab)?.name} Tests`}
        </button>

        {/* Results */}
        {results.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-gray-300">Test Results:</h4>
            <div className="max-h-96 overflow-y-auto space-y-2">
              {results.map((result, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-gray-800 rounded"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className="text-white font-medium">{result.program}</span>
                      <span className="text-gray-400 text-sm">{result.test}</span>
                    </div>
                    <p className="text-gray-400 text-sm mt-1">{result.message}</p>
                  </div>
                  <div className="ml-4">
                    {getStatusBadge(result.status)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="mt-6 p-4 bg-blue-900 bg-opacity-20 rounded border border-blue-700">
        <h4 className="text-blue-400 font-semibold mb-2">💡 Quick Start</h4>
        <ol className="text-blue-300 text-sm space-y-1 list-decimal list-inside">
          <li>Make sure your wallet is connected</li>
          <li>Click &quot;Initialize Tests&quot; to set up the test utilities</li>
          <li>Run Deployment tests to check program status</li>
          <li>Run Initialization tests to set up program state</li>
          <li>Run Security tests to validate program security</li>
        </ol>
      </div>
          </div>
  );
} 