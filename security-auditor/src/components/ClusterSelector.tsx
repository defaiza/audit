import { useState, useEffect } from 'react';
import { useConnection } from '@solana/wallet-adapter-react';
import { clusterManager, ClusterName } from '@/utils/cluster-config';

export function ClusterSelector() {
  const { connection } = useConnection();
  const [currentCluster, setCurrentCluster] = useState(clusterManager.getCurrentCluster());
  const [isChanging, setIsChanging] = useState(false);
  const [showWarning, setShowWarning] = useState(false);

  useEffect(() => {
    // Listen for cluster changes
    const handleClusterChange = (event: CustomEvent) => {
      setCurrentCluster(event.detail);
    };

    window.addEventListener('cluster-changed' as any, handleClusterChange);
    return () => {
      window.removeEventListener('cluster-changed' as any, handleClusterChange);
    };
  }, []);

  const handleClusterChange = async (clusterName: ClusterName) => {
    if (clusterName === currentCluster.name) return;

    // Show warning for mainnet
    if (clusterName === 'mainnet-beta') {
      setShowWarning(true);
      return;
    }

    setIsChanging(true);
    try {
      // Update cluster
      clusterManager.setCluster(clusterName);
      
      // Reload page to reinitialize connection
      // In a production app, you'd update the connection context instead
      window.location.reload();
    } catch (error) {
      console.error('Failed to change cluster:', error);
    } finally {
      setIsChanging(false);
    }
  };

  const confirmMainnet = () => {
    setShowWarning(false);
    handleClusterChange('mainnet-beta');
  };

  return (
    <>
      <div className="relative">
        <label className="block text-sm font-medium text-gray-400 mb-2">
          Solana Cluster
        </label>
        
        <div className="relative">
          <select
            value={currentCluster.name}
            onChange={(e) => handleClusterChange(e.target.value as ClusterName)}
            disabled={isChanging}
            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white appearance-none cursor-pointer hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {clusterManager.getAvailableClusters().map(cluster => (
              <option key={cluster.name} value={cluster.name}>
                {cluster.label}
              </option>
            ))}
          </select>
          
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400">
            <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
              <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
            </svg>
          </div>
        </div>

        {currentCluster.isCustom && (
          <div className="mt-2 text-xs text-yellow-400">
            Using custom RPC: {currentCluster.endpoint}
          </div>
        )}

        <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
          <span>Endpoint: {currentCluster.endpoint}</span>
          {isChanging && (
            <span className="text-blue-400 animate-pulse">Switching...</span>
          )}
        </div>

        {/* Status indicator */}
        <div className="absolute top-0 right-0 mt-1">
          <div className={`h-2 w-2 rounded-full ${
            currentCluster.name === 'mainnet-beta' ? 'bg-red-500' :
            currentCluster.name === 'localnet' ? 'bg-green-500' :
            'bg-yellow-500'
          }`} />
        </div>
      </div>

      {/* Mainnet Warning Modal */}
      {showWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-gray-900 rounded-lg p-6 max-w-md mx-4 border border-red-600">
            <h3 className="text-xl font-bold text-red-500 mb-4">⚠️ Mainnet Warning</h3>
            
            <div className="space-y-3 text-gray-300">
              <p>
                You are about to switch to <strong>Mainnet</strong>. This is the production network where real funds are at risk.
              </p>
              
              <div className="bg-red-900 bg-opacity-20 border border-red-700 rounded p-3">
                <p className="text-sm text-red-400">
                  <strong>Important:</strong>
                </p>
                <ul className="list-disc list-inside text-sm text-red-400 mt-2">
                  <li>This security auditor is for testing only</li>
                  <li>Never test attacks on mainnet programs</li>
                  <li>Always use devnet or testnet for security testing</li>
                  <li>Unauthorized testing on mainnet may be illegal</li>
                </ul>
              </div>
              
              <p className="text-sm">
                Are you sure you want to continue to mainnet?
              </p>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowWarning(false)}
                className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmMainnet}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
              >
                Continue to Mainnet
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
} 