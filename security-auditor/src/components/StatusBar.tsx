import React from 'react';
import { useProgramStatus } from '../hooks/useProgramStatus';
import { useWallet } from '@solana/wallet-adapter-react';

export const StatusBar: React.FC = () => {
  const wallet = useWallet();
  const { 
    isAllDeployed, 
    isAllInitialized, 
    deployedCount, 
    initializedCount, 
    totalPrograms,
    isLoading,
    refreshStatus,
    lastRefresh
  } = useProgramStatus();

  const getStepStatus = (stepNumber: number) => {
    if (stepNumber === 1) return wallet.connected ? 'completed' : 'active';
    if (stepNumber === 2) {
      if (!wallet.connected) return 'pending';
      return isAllDeployed ? 'completed' : 'active';
    }
    if (stepNumber === 3) {
      if (!wallet.connected || !isAllDeployed) return 'pending';
      return isAllInitialized ? 'completed' : 'active';
    }
    if (stepNumber === 4) {
      if (!wallet.connected || !isAllDeployed || !isAllInitialized) return 'pending';
      return 'active';
    }
    return 'pending';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-600 border-green-500';
      case 'active': return 'bg-yellow-600 border-yellow-500 animate-pulse';
      case 'pending': return 'bg-gray-600 border-gray-500';
      default: return 'bg-gray-600 border-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return '✓';
      case 'active': return '•';
      case 'pending': return '○';
      default: return '○';
    }
  };

  const steps = [
    { 
      number: 1, 
      title: 'Connect Wallet',
      description: wallet.connected ? `Connected: ${wallet.publicKey?.toBase58().slice(0, 8)}...` : 'Connect your wallet to begin'
    },
    { 
      number: 2, 
      title: 'Deploy Programs',
      description: isAllDeployed ? 'All programs deployed' : `${deployedCount}/${totalPrograms} programs deployed`
    },
    { 
      number: 3, 
      title: 'Initialize Programs',
      description: isAllInitialized ? 'All programs initialized' : `${initializedCount}/${totalPrograms} programs initialized`
    },
    { 
      number: 4, 
      title: 'Run Tests',
      description: isAllInitialized ? 'Ready to run security tests' : 'Complete previous steps first'
    }
  ];

  return (
    <div className="bg-gray-800 rounded-lg p-4 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Setup Progress</h3>
        <div className="flex items-center space-x-3">
          {lastRefresh && (
            <span className="text-xs text-gray-400">
              Last checked: {lastRefresh.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={refreshStatus}
            disabled={isLoading || !wallet.connected}
            className={`px-3 py-1 text-xs rounded-lg transition-all ${
              isLoading || !wallet.connected
                ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {isLoading ? 'Checking...' : 'Refresh'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {steps.map((step) => {
          const status = getStepStatus(step.number);
          return (
            <div
              key={step.number}
              className={`relative p-4 rounded-lg border-2 transition-all ${
                status === 'active' ? 'shadow-lg' : ''
              } ${getStatusColor(status)}`}
            >
              {/* Step Number */}
              <div className="absolute -top-3 -left-3 w-8 h-8 rounded-full bg-gray-900 border-2 border-gray-700 flex items-center justify-center">
                <span className="text-sm font-bold text-white">{step.number}</span>
              </div>

              {/* Status Icon */}
              <div className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-gray-900 border-2 border-gray-700 flex items-center justify-center">
                <span className={`text-lg ${
                  status === 'completed' ? 'text-green-400' : 
                  status === 'active' ? 'text-yellow-400' : 
                  'text-gray-400'
                }`}>
                  {getStatusIcon(status)}
                </span>
              </div>

              {/* Content */}
              <div className="mt-2">
                <h4 className={`font-semibold text-sm mb-1 ${
                  status === 'completed' ? 'text-green-300' :
                  status === 'active' ? 'text-yellow-300' :
                  'text-gray-300'
                }`}>
                  {step.title}
                </h4>
                <p className={`text-xs ${
                  status === 'completed' ? 'text-green-200' :
                  status === 'active' ? 'text-yellow-200' :
                  'text-gray-400'
                }`}>
                  {step.description}
                </p>
              </div>

              {/* Progress bar for deployment/initialization */}
              {(step.number === 2 || step.number === 3) && status !== 'pending' && (
                <div className="mt-3">
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-500 ${
                        status === 'completed' ? 'bg-green-400' : 'bg-yellow-400'
                      }`}
                      style={{
                        width: `${
                          step.number === 2
                            ? (deployedCount / totalPrograms) * 100
                            : (initializedCount / totalPrograms) * 100
                        }%`
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Warning if trying to skip steps */}
      {!isAllInitialized && (
        <div className="mt-4 bg-yellow-900 bg-opacity-20 border border-yellow-700 rounded-lg p-3">
          <div className="flex items-start space-x-2">
            <span className="text-yellow-400">⚠️</span>
            <div>
              <p className="text-yellow-300 text-sm font-semibold">Prerequisites Required</p>
              <p className="text-yellow-200 text-xs mt-1">
                You must complete all setup steps in order before running security tests. 
                {!wallet.connected && ' Start by connecting your wallet.'}
                {wallet.connected && !isAllDeployed && ' Deploy programs using "npm run deploy".'}
                {wallet.connected && isAllDeployed && !isAllInitialized && ' Initialize programs using the button above.'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}; 