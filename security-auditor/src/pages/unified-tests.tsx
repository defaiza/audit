import { Layout } from '@/components/Layout';
import { UnifiedTestPanel } from '@/components/UnifiedTestPanel';

export default function UnifiedTestsPage() {
  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-4">
            DeFAI Unified Test Suite
          </h1>
          <p className="text-gray-400 text-lg">
            Comprehensive testing framework for all DeFAI programs using unified utilities.
          </p>
        </div>

        <UnifiedTestPanel />

        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-gray-900 rounded-lg p-6">
            <h3 className="text-xl font-semibold text-white mb-4">Test Categories</h3>
            <ul className="space-y-3">
              <li className="flex items-start">
                <span className="text-2xl mr-3">📦</span>
                <div>
                  <h4 className="text-white font-medium">Deployment Tests</h4>
                  <p className="text-gray-400 text-sm">Verify all programs are deployed and executable</p>
                </div>
              </li>
              <li className="flex items-start">
                <span className="text-2xl mr-3">🚀</span>
                <div>
                  <h4 className="text-white font-medium">Initialization Tests</h4>
                  <p className="text-gray-400 text-sm">Set up program state, PDAs, and configurations</p>
                </div>
              </li>
              <li className="flex items-start">
                <span className="text-2xl mr-3">🔒</span>
                <div>
                  <h4 className="text-white font-medium">Security Tests</h4>
                  <p className="text-gray-400 text-sm">Validate access control and state consistency</p>
                </div>
              </li>
            </ul>
          </div>

          <div className="bg-gray-900 rounded-lg p-6">
            <h3 className="text-xl font-semibold text-white mb-4">Programs Tested</h3>
            <ul className="space-y-3">
              <li className="flex items-center justify-between p-3 bg-gray-800 rounded">
                <span className="text-white">DeFAI Swap</span>
                <span className="text-xs text-gray-400">Token swaps & NFT exchange</span>
              </li>
              <li className="flex items-center justify-between p-3 bg-gray-800 rounded">
                <span className="text-white">DeFAI Staking</span>
                <span className="text-xs text-gray-400">Tiered staking & rewards</span>
              </li>
              <li className="flex items-center justify-between p-3 bg-gray-800 rounded">
                <span className="text-white">DeFAI Estate</span>
                <span className="text-xs text-gray-400">Digital estate management</span>
              </li>
              <li className="flex items-center justify-between p-3 bg-gray-800 rounded">
                <span className="text-white">DeFAI App Factory</span>
                <span className="text-xs text-gray-400">dApp creation & monetization</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 bg-yellow-900 bg-opacity-20 border border-yellow-700 rounded-lg p-6">
          <h3 className="text-yellow-400 font-semibold mb-2">⚠️ Important Notes</h3>
          <ul className="text-yellow-300 text-sm space-y-1 list-disc list-inside">
            <li>Ensure you&apos;re connected to the correct network (localnet/devnet)</li>
            <li>Use the admin wallet for initialization operations</li>
            <li>Programs must be deployed before running tests</li>
            <li>Some tests may require SOL for transaction fees</li>
          </ul>
        </div>
      </div>
    </Layout>
  );
} 