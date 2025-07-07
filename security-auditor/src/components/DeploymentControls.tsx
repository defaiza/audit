import { useState } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js'
import { execSync } from 'child_process'
import toast from 'react-hot-toast'

// Admin keypair (stored in repo for local testing only)
const ADMIN_PUBKEY = '4efsLapeRBz4pnqey6vBUECUSD6HmDie4pGzUxhnW1aZ'

export function DeploymentControls() {
  const { connection } = useConnection()
  const wallet = useWallet()
  const [isAirdropping, setIsAirdropping] = useState(false)
  const [isDeploying, setIsDeploying] = useState(false)
  const [balance, setBalance] = useState<number | null>(null)

  const checkBalance = async () => {
    try {
      const pubkey = wallet.publicKey || new PublicKey(ADMIN_PUBKEY)
      const bal = await connection.getBalance(pubkey)
      setBalance(bal / LAMPORTS_PER_SOL)
    } catch (error) {
      console.error('Error checking balance:', error)
    }
  }

  const handleAirdrop = async () => {
    if (!wallet.publicKey) {
      toast.error('Please connect your wallet first')
      return
    }

    setIsAirdropping(true)
    try {
      const signature = await connection.requestAirdrop(
        wallet.publicKey,
        2 * LAMPORTS_PER_SOL
      )
      
      toast.loading('Confirming airdrop...', { id: 'airdrop' })
      await connection.confirmTransaction(signature, 'confirmed')
      
      toast.success('Airdrop successful! +2 SOL', { id: 'airdrop' })
      await checkBalance()
    } catch (error: any) {
      console.error('Airdrop error:', error)
      toast.error('Airdrop failed: ' + (error.message || 'Unknown error'), { id: 'airdrop' })
    } finally {
      setIsAirdropping(false)
    }
  }

  const handleDeploy = async () => {
    setIsDeploying(true)
    toast.loading('Starting deployment process...', { id: 'deploy' })
    
    try {
      // This would normally run the deploy script server-side
      // For demo purposes, we'll show the process
      toast.success('Deployment initiated! Check console for progress.', { id: 'deploy' })
      
      // In a real implementation, this would be an API call to a backend service
      console.log('To deploy programs, run: node scripts/deploy-programs.js')
      
    } catch (error: any) {
      toast.error('Deployment failed: ' + error.message, { id: 'deploy' })
    } finally {
      setIsDeploying(false)
    }
  }

  return (
    <div className="bg-purple-900 bg-opacity-20 border border-purple-700 rounded-lg p-6 mb-8">
      <h3 className="text-lg font-semibold text-purple-400 mb-4">🛠️ Deployment Controls</h3>
      
      <div className="space-y-4">
        {/* Admin Info */}
        <div className="bg-gray-800 bg-opacity-50 rounded p-3">
          <p className="text-sm text-gray-300 mb-1">Admin Wallet (for local testing):</p>
          <p className="text-xs font-mono text-gray-400">{ADMIN_PUBKEY}</p>
          {wallet.publicKey && (
            <p className="text-xs text-gray-400 mt-2">
              Connected: <span className="font-mono">{wallet.publicKey.toBase58()}</span>
            </p>
          )}
        </div>

        {/* Balance Display */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-300">Wallet Balance:</span>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white">
              {balance !== null ? `${balance.toFixed(4)} SOL` : '-'}
            </span>
            <button
              onClick={checkBalance}
              className="text-xs text-blue-400 hover:text-blue-300"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-4">
          {/* Airdrop Button */}
          <button
            onClick={handleAirdrop}
            disabled={isAirdropping || !wallet.connected}
            className={`
              px-4 py-3 rounded-lg font-medium transition-all duration-200
              ${isAirdropping || !wallet.connected
                ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 text-white hover:shadow-lg'
              }
            `}
          >
            {isAirdropping ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Requesting...
              </span>
            ) : (
              '💰 Request Airdrop (2 SOL)'
            )}
          </button>

          {/* Deploy Button */}
          <button
            onClick={handleDeploy}
            disabled={isDeploying}
            className={`
              px-4 py-3 rounded-lg font-medium transition-all duration-200
              ${isDeploying
                ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                : 'bg-purple-600 hover:bg-purple-700 text-white hover:shadow-lg'
              }
            `}
          >
            {isDeploying ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Deploying...
              </span>
            ) : (
              '🚀 Redeploy Programs'
            )}
          </button>
        </div>

        {/* Instructions */}
        <div className="mt-4 p-3 bg-yellow-900 bg-opacity-20 border border-yellow-700 rounded">
          <p className="text-xs text-yellow-300">
            <strong>Note:</strong> For manual deployment, run in terminal:
          </p>
          <code className="text-xs text-yellow-200 font-mono block mt-1">
            node scripts/deploy-programs.js
          </code>
        </div>
      </div>
    </div>
  )
}