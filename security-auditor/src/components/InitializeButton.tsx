import { useState } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { SimpleInitializer, InitializationResult } from '@/utils/simple-initialize'
import toast from 'react-hot-toast'

export function InitializeButton() {
  const { connection } = useConnection()
  const wallet = useWallet()
  const [isInitializing, setIsInitializing] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [results, setResults] = useState<InitializationResult[]>([])

  const handleInitialize = async () => {
    if (!wallet.connected) {
      toast.error('Please connect your wallet first')
      return
    }

    setIsInitializing(true)
    setShowResults(false)
    
    try {
      const initializer = new SimpleInitializer(connection, wallet)
      const initResults = await initializer.initializeAll()
      
      setResults(initResults)
      setShowResults(true)
      
      const successCount = initResults.filter(r => r.status === 'success').length
      const skippedCount = initResults.filter(r => r.status === 'skipped').length
      
      if (successCount > 0) {
        toast.success(`Initialized ${successCount} programs successfully!`)
      }
      if (skippedCount > 0) {
        toast.info(`${skippedCount} programs were already initialized`)
      }
    } catch (error) {
      console.error('Initialization error:', error)
      toast.error('Failed to initialize programs')
    } finally {
      setIsInitializing(false)
    }
  }

  return (
    <div className="bg-yellow-900 bg-opacity-20 border border-yellow-700 rounded-lg p-6 mb-8">
      <h3 className="text-lg font-semibold text-yellow-400 mb-2">Program Initialization Required</h3>
      <p className="text-yellow-300 text-sm mb-2">
        Connected wallet: <span className="font-mono text-xs">{wallet.publicKey?.toBase58() || 'Not connected'}</span>
      </p>
      {wallet.publicKey?.toBase58() !== '4efsLapeRBz4pnqey6vBUECUSD6HmDie4pGzUxhnW1aZ' && (
        <div className="bg-red-900 bg-opacity-20 border border-red-700 rounded p-3 mb-4">
          <p className="text-red-400 text-sm font-semibold">⚠️ Wrong Wallet Connected</p>
          <p className="text-red-300 text-xs mt-1">
            Program initialization requires the admin wallet:
          </p>
          <p className="text-red-200 text-xs font-mono mt-1">
            4efsLapeRBz4pnqey6vBUECUSD6HmDie4pGzUxhnW1aZ
          </p>
          <p className="text-red-300 text-xs mt-2">
            Please import admin-keypair.json to your wallet to initialize programs.
          </p>
        </div>
      )}
      <p className="text-yellow-300 text-sm mb-4">
        The programs need to be initialized before running tests. This will:
      </p>
      <ul className="list-disc list-inside text-yellow-300 text-sm mb-4 space-y-1">
        <li>Initialize all program accounts and PDAs</li>
        <li>Set up required configurations</li>
        <li>Create necessary escrow and vault accounts</li>
        <li>Configure program parameters</li>
      </ul>
      
      <button
        onClick={handleInitialize}
        disabled={isInitializing || !wallet.connected}
        className={`
          px-6 py-3 rounded-lg font-medium transition-all duration-200
          ${isInitializing || !wallet.connected
            ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
            : 'bg-yellow-600 hover:bg-yellow-700 text-white hover:shadow-lg'
          }
        `}
      >
        {isInitializing ? (
          <span className="flex items-center">
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Initializing Programs...
          </span>
        ) : (
          '🚀 Initialize All Programs'
        )}
      </button>

      {showResults && results.length > 0 && (
        <div className="mt-6 space-y-2">
          <h4 className="text-sm font-semibold text-yellow-400">Initialization Results:</h4>
          {results.map((result, i) => (
            <div key={i} className="flex items-start space-x-2 text-sm">
              <span className={`
                ${result.status === 'success' ? 'text-green-400' : 
                  result.status === 'error' ? 'text-red-400' : 'text-gray-400'}
              `}>
                {result.status === 'success' ? '✅' : 
                 result.status === 'error' ? '❌' : '⏭️'}
              </span>
              <div className="flex-1">
                <span className="font-medium text-white">{result.program}:</span>
                <span className="ml-2 text-gray-300">{result.message}</span>
                {result.details && (
                  <div className="text-xs text-gray-500 mt-1">
                    {Object.entries(result.details).map(([key, value]) => (
                      <div key={key}>{key}: {String(value)}</div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}