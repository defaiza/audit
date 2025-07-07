import { useEffect, useState, useCallback } from 'react'
import { useConnection } from '@solana/wallet-adapter-react'
import { PublicKey } from '@solana/web3.js'
import { PROGRAMS } from '@/utils/constants'

interface ProgramStatus {
  name: string
  programId: string
  deployed: boolean
  executable: boolean
}

export function CheckPrograms() {
  const { connection } = useConnection()
  const [programStatuses, setProgramStatuses] = useState<ProgramStatus[]>([])
  const [checking, setChecking] = useState(true)

  const checkPrograms = useCallback(async () => {
    setChecking(true)
    const statuses: ProgramStatus[] = []

    for (const [key, program] of Object.entries(PROGRAMS)) {
      try {
        const pubkey = new PublicKey(program.programId)
        const accountInfo = await connection.getAccountInfo(pubkey)
        
        statuses.push({
          name: program.name,
          programId: program.programId,
          deployed: accountInfo !== null,
          executable: accountInfo?.executable || false
        })
      } catch (error) {
        statuses.push({
          name: program.name,
          programId: program.programId,
          deployed: false,
          executable: false
        })
      }
    }

    setProgramStatuses(statuses)
    setChecking(false)
  }, [connection])

  useEffect(() => {
    checkPrograms()
  }, [checkPrograms])

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <h3 className="text-lg font-semibold text-white mb-4">📍 Program Deployment Status</h3>
      {checking ? (
        <p className="text-gray-400 text-sm">Checking programs...</p>
      ) : (
        <div className="space-y-4">
          {programStatuses.map((status, index) => (
            <div key={status.programId} className={`pb-3 ${index < programStatuses.length - 1 ? 'border-b border-gray-700' : ''}`}>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-300 font-medium">{status.name}</span>
                <span className={`text-xs ${status.deployed && status.executable ? 'text-green-400' : 'text-red-400'}`}>
                  {status.deployed ? (status.executable ? '✅ Deployed' : '⚠️ Not Executable') : '❌ Not Deployed'}
                </span>
              </div>
              <div className="mt-1">
                <code className="text-xs text-gray-500 font-mono break-all select-all">{status.programId}</code>
              </div>
            </div>
          ))}
        </div>
      )}
      <button
        onClick={checkPrograms}
        className="mt-4 text-xs text-blue-400 hover:text-blue-300 transition-colors"
      >
        🔄 Refresh Status
      </button>
    </div>
  )
}