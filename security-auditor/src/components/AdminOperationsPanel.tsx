import { useState } from 'react'
import { Connection, PublicKey, Keypair, SystemProgram } from '@solana/web3.js'
import * as anchor from '@coral-xyz/anchor'
import { Program, Idl } from '@coral-xyz/anchor'
import { PROGRAMS } from '@/utils/constants'
import defaiSwapIdl from '@/idl/defai_swap.json'
import defaiStakingIdl from '@/idl/defai_staking.json'
import defaiEstateIdl from '@/idl/defai_estate.json'
import defaiAppFactoryIdl from '@/idl/defai_app_factory.json'

interface AdminOperationsPanelProps {
  connection: Connection
  wallet: any
  adminKeypair: Keypair | null
  isAdminWallet: boolean
  onTestResult: (result: any) => void
}

interface AdminOperation {
  id: string
  name: string
  description: string
  program: string
  requiresAdmin: boolean
  parameters: AdminParameter[]
}

interface AdminParameter {
  name: string
  type: 'string' | 'number' | 'boolean' | 'publickey' | 'array'
  placeholder?: string
  default?: any
  required: boolean
}

const ADMIN_OPERATIONS: AdminOperation[] = [
  // Swap Admin Operations
  {
    id: 'update_swap_prices',
    name: 'Update Tier Prices',
    description: 'Update the pricing for all swap tiers',
    program: 'SWAP',
    requiresAdmin: true,
    parameters: [
      { name: 'tier1Price', type: 'number', placeholder: '1000000000', required: true },
      { name: 'tier2Price', type: 'number', placeholder: '10000000000', required: true },
      { name: 'tier3Price', type: 'number', placeholder: '500000000000', required: true },
      { name: 'tier4Price', type: 'number', placeholder: '1000000000000', required: true },
      { name: 'tier5Price', type: 'number', placeholder: '5000000000000', required: true }
    ]
  },
  {
    id: 'update_treasury',
    name: 'Update Treasury',
    description: 'Change the treasury wallet address',
    program: 'SWAP',
    requiresAdmin: true,
    parameters: [
      { name: 'newTreasury', type: 'publickey', placeholder: 'New treasury public key', required: true }
    ]
  },
  {
    id: 'pause_swap',
    name: 'Pause/Unpause Swap',
    description: 'Emergency pause or unpause the swap program',
    program: 'SWAP',
    requiresAdmin: true,
    parameters: [
      { name: 'pause', type: 'boolean', default: true, required: true }
    ]
  },
  {
    id: 'propose_admin_change',
    name: 'Propose Admin Change',
    description: 'Propose a new admin for the program',
    program: 'SWAP',
    requiresAdmin: true,
    parameters: [
      { name: 'newAdmin', type: 'publickey', placeholder: 'New admin public key', required: true }
    ]
  },

  // Staking Admin Operations
  {
    id: 'initialize_staking_escrow',
    name: 'Initialize Reward Escrow',
    description: 'Set up the reward escrow for staking rewards',
    program: 'STAKING',
    requiresAdmin: true,
    parameters: [
      { name: 'defaiMint', type: 'publickey', placeholder: 'DeFAI token mint', required: true }
    ]
  },
  {
    id: 'fund_staking_escrow',
    name: 'Fund Reward Escrow',
    description: 'Add funds to the reward escrow',
    program: 'STAKING',
    requiresAdmin: true,
    parameters: [
      { name: 'amount', type: 'number', placeholder: '1000000000', required: true }
    ]
  },

  // Estate Admin Operations
  {
    id: 'initialize_estate_multisig',
    name: 'Initialize Multisig',
    description: 'Set up multisig for estate management',
    program: 'ESTATE',
    requiresAdmin: true,
    parameters: [
      { name: 'signers', type: 'array', placeholder: 'Comma-separated public keys', required: true },
      { name: 'threshold', type: 'number', placeholder: '2', required: true }
    ]
  },
  {
    id: 'propose_estate_admin_change',
    name: 'Propose Admin Change',
    description: 'Propose new admin for estate program',
    program: 'ESTATE',
    requiresAdmin: true,
    parameters: [
      { name: 'newAdmin', type: 'publickey', placeholder: 'New admin public key', required: true }
    ]
  },

  // App Factory Admin Operations
  {
    id: 'update_platform_settings',
    name: 'Update Platform Settings',
    description: 'Update platform fee and treasury settings',
    program: 'APP_FACTORY',
    requiresAdmin: true,
    parameters: [
      { name: 'platformFeeBps', type: 'number', placeholder: '2000', required: false },
      { name: 'newTreasury', type: 'publickey', placeholder: 'New treasury address', required: false }
    ]
  },

  // General Operations
  {
    id: 'check_program_state',
    name: 'Check Program State',
    description: 'Read and display current program state',
    program: 'ALL',
    requiresAdmin: false,
    parameters: []
  },
  {
    id: 'emergency_withdraw',
    name: 'Emergency Withdraw',
    description: 'Emergency withdrawal of funds (admin only)',
    program: 'ALL',
    requiresAdmin: true,
    parameters: [
      { name: 'amount', type: 'number', placeholder: 'Amount to withdraw', required: true }
    ]
  }
]

export function AdminOperationsPanel({ connection, wallet, adminKeypair, isAdminWallet, onTestResult }: AdminOperationsPanelProps) {
  const [isExecuting, setIsExecuting] = useState(false)
  const [selectedOperation, setSelectedOperation] = useState<string>('')
  const [operationParams, setOperationParams] = useState<Record<string, any>>({})
  const [selectedProgram, setSelectedProgram] = useState<string>('ALL')

  const getFilteredOperations = () => {
    return ADMIN_OPERATIONS.filter(op => 
      selectedProgram === 'ALL' || op.program === 'ALL' || op.program === selectedProgram
    )
  }

  const updateParameter = (paramName: string, value: any) => {
    setOperationParams(prev => ({
      ...prev,
      [paramName]: value
    }))
  }

  const getCurrentOperation = () => {
    return ADMIN_OPERATIONS.find(op => op.id === selectedOperation)
  }

  const createProgramInstance = async (programId: PublicKey, idl: Idl): Promise<Program | null> => {
    try {
      const provider = new anchor.AnchorProvider(connection, wallet, {
        commitment: 'confirmed',
        preflightCommitment: 'confirmed',
        skipPreflight: false
      })
      anchor.setProvider(provider)

      // First, try to create a copy of the IDL and set the correct program ID
      const idlCopy = JSON.parse(JSON.stringify(idl))
      idlCopy.address = programId.toBase58()
      
      return new Program(idlCopy as Idl, programId, provider)
    } catch (err: any) {
      if (err.message?.includes('DeclaredProgramIdMismatch')) {
        try {
          // Try without the address field
          const idlWithoutAddress = JSON.parse(JSON.stringify(idl))
          delete idlWithoutAddress.address
          const provider = new anchor.AnchorProvider(connection, wallet, {
            commitment: 'confirmed',
            preflightCommitment: 'confirmed',
            skipPreflight: false
          })
          anchor.setProvider(provider)
          return new Program(idlWithoutAddress as Idl, programId, provider)
        } catch (retryErr) {
          return null
        }
      }
      return null
    }
  }

  const executeSwapOperation = async (operation: AdminOperation) => {
    const programId = new PublicKey(PROGRAMS.SWAP.programId)
    const program = await createProgramInstance(programId, defaiSwapIdl as Idl)
    if (!program) throw new Error('Failed to create Swap program instance')

    const [configPda] = PublicKey.findProgramAddressSync([Buffer.from('config')], programId)

    switch (operation.id) {
      case 'update_swap_prices':
        const prices = [
          operationParams.tier1Price,
          operationParams.tier2Price,
          operationParams.tier3Price,
          operationParams.tier4Price,
          operationParams.tier5Price
        ].map(p => new anchor.BN(p || 0))

        const tx = await program.methods
          .updatePrices(prices)
          .accounts({
            admin: wallet.publicKey,
            config: configPda
          })
          .rpc()

        return { tx, details: { prices: prices.map(p => p.toString()) } }

      case 'update_treasury':
        const newTreasury = new PublicKey(operationParams.newTreasury)
        const treasuryTx = await program.methods
          .updateTreasury(newTreasury)
          .accounts({
            admin: wallet.publicKey,
            config: configPda
          })
          .rpc()

        return { tx: treasuryTx, details: { newTreasury: newTreasury.toBase58() } }

      case 'pause_swap':
        const pauseTx = operationParams.pause 
          ? await program.methods.pause().accounts({ admin: wallet.publicKey, config: configPda }).rpc()
          : await program.methods.unpause().accounts({ admin: wallet.publicKey, config: configPda }).rpc()

        return { tx: pauseTx, details: { paused: operationParams.pause } }

      case 'propose_admin_change':
        const newAdmin = new PublicKey(operationParams.newAdmin)
        const adminTx = await program.methods
          .proposeAdminChange(newAdmin)
          .accounts({
            admin: wallet.publicKey,
            config: configPda
          })
          .rpc()

        return { tx: adminTx, details: { proposedAdmin: newAdmin.toBase58() } }

      default:
        throw new Error(`Unknown swap operation: ${operation.id}`)
    }
  }

  const executeStakingOperation = async (operation: AdminOperation) => {
    const programId = new PublicKey(PROGRAMS.STAKING.programId)
    const program = await createProgramInstance(programId, defaiStakingIdl as Idl)
    if (!program) throw new Error('Failed to create Staking program instance')

    switch (operation.id) {
      case 'initialize_staking_escrow':
        const [programStatePda] = PublicKey.findProgramAddressSync([Buffer.from('program-state')], programId)
        const [rewardEscrowPda] = PublicKey.findProgramAddressSync([Buffer.from('reward-escrow')], programId)
        const [escrowTokenAccountPda] = PublicKey.findProgramAddressSync([Buffer.from('escrow-token-account')], programId)
        const defaiMint = new PublicKey(operationParams.defaiMint)

        const tx = await program.methods
          .initializeEscrow()
          .accounts({
            programState: programStatePda,
            rewardEscrow: rewardEscrowPda,
            escrowTokenAccount: escrowTokenAccountPda,
            authority: wallet.publicKey,
            defaiMint,
            tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY
          })
          .rpc()

        return { tx, details: { rewardEscrow: rewardEscrowPda.toBase58() } }

      case 'fund_staking_escrow':
        // This would require token account setup and transfer
        throw new Error('Fund escrow operation requires token setup - not implemented in demo')

      default:
        throw new Error(`Unknown staking operation: ${operation.id}`)
    }
  }

  const executeEstateOperation = async (operation: AdminOperation) => {
    const programId = new PublicKey(PROGRAMS.ESTATE.programId)
    const program = await createProgramInstance(programId, defaiEstateIdl as Idl)
    if (!program) throw new Error('Failed to create Estate program instance')

    switch (operation.id) {
      case 'initialize_estate_multisig':
        const [multisigPda] = PublicKey.findProgramAddressSync([Buffer.from('multisig')], programId)
        const signers = operationParams.signers.split(',').map((s: string) => new PublicKey(s.trim()))
        const threshold = parseInt(operationParams.threshold)

        const tx = await program.methods
          .initializeMultisig(signers, threshold)
          .accounts({
            admin: wallet.publicKey,
            multisig: multisigPda,
            systemProgram: SystemProgram.programId
          })
          .rpc()

        return { tx, details: { multisig: multisigPda.toBase58(), signers: signers.map((s: PublicKey) => s.toBase58()), threshold } }

      case 'propose_estate_admin_change':
        const [multisigPda2] = PublicKey.findProgramAddressSync([Buffer.from('multisig')], programId)
        const newAdmin = new PublicKey(operationParams.newAdmin)

        const adminTx = await program.methods
          .proposeAdminChange(newAdmin)
          .accounts({
            signer: wallet.publicKey,
            multisig: multisigPda2
          })
          .rpc()

        return { tx: adminTx, details: { proposedAdmin: newAdmin.toBase58() } }

      default:
        throw new Error(`Unknown estate operation: ${operation.id}`)
    }
  }

  const executeAppFactoryOperation = async (operation: AdminOperation) => {
    const programId = new PublicKey(PROGRAMS.APP_FACTORY.programId)
    const program = await createProgramInstance(programId, defaiAppFactoryIdl as Idl)
    if (!program) throw new Error('Failed to create App Factory program instance')

    switch (operation.id) {
      case 'update_platform_settings':
        const [appFactoryPda] = PublicKey.findProgramAddressSync([Buffer.from('app_factory')], programId)
        
        const newFeeBps = operationParams.platformFeeBps ? parseInt(operationParams.platformFeeBps) : null
        const newTreasury = operationParams.newTreasury ? new PublicKey(operationParams.newTreasury) : null

        const tx = await program.methods
          .updatePlatformSettings(newFeeBps, newTreasury)
          .accounts({
            appFactory: appFactoryPda,
            authority: wallet.publicKey
          })
          .rpc()

        return { tx, details: { newFeeBps, newTreasury: newTreasury?.toBase58() } }

      default:
        throw new Error(`Unknown app factory operation: ${operation.id}`)
    }
  }

  const checkProgramState = async (programKey: string) => {
    const programInfo = PROGRAMS[programKey as keyof typeof PROGRAMS]
    const programId = new PublicKey(programInfo.programId)
    
    let program: Program | null = null
    let results: any = {}

    try {
      switch (programKey) {
        case 'SWAP':
          program = await createProgramInstance(programId, defaiSwapIdl as Idl)
          if (program) {
            const [configPda] = PublicKey.findProgramAddressSync([Buffer.from('config')], programId)
            const configAccount = await program.account.config.fetch(configPda)
            results = { config: configAccount, configPda: configPda.toBase58() }
          }
          break

        case 'STAKING':
          program = await createProgramInstance(programId, defaiStakingIdl as Idl)
          if (program) {
            const [programStatePda] = PublicKey.findProgramAddressSync([Buffer.from('program-state')], programId)
            const stateAccount = await program.account.programState.fetch(programStatePda)
            results = { programState: stateAccount, programStatePda: programStatePda.toBase58() }
          }
          break

        case 'ESTATE':
          program = await createProgramInstance(programId, defaiEstateIdl as Idl)
          if (program) {
            const [globalCounterPda] = PublicKey.findProgramAddressSync([Buffer.from('global-counter')], programId)
            const counterAccount = await program.account.globalCounter.fetch(globalCounterPda)
            results = { globalCounter: counterAccount, globalCounterPda: globalCounterPda.toBase58() }
          }
          break

        case 'APP_FACTORY':
          program = await createProgramInstance(programId, defaiAppFactoryIdl as Idl)
          if (program) {
            const [appFactoryPda] = PublicKey.findProgramAddressSync([Buffer.from('app_factory')], programId)
            const factoryAccount = await program.account.appFactory.fetch(appFactoryPda)
            results = { appFactory: factoryAccount, appFactoryPda: appFactoryPda.toBase58() }
          }
          break
      }

      return results
    } catch (error) {
      throw new Error(`Failed to read ${programInfo.name} state: ${error}`)
    }
  }

  const executeOperation = async () => {
    const operation = getCurrentOperation()
    if (!operation) return

    if (operation.requiresAdmin && !isAdminWallet) {
      onTestResult({
        testType: 'admin_operation',
        program: operation.program,
        description: `${operation.name} requires admin wallet`,
        status: 'error',
        details: { operation: operation.id },
        severity: 'medium'
      })
      return
    }

    setIsExecuting(true)

    try {
      let result: any = {}

      if (operation.id === 'check_program_state') {
        if (selectedProgram === 'ALL') {
          // Check all programs
          for (const [programKey] of Object.entries(PROGRAMS)) {
            try {
              const state = await checkProgramState(programKey)
              result[programKey] = state
            } catch (error) {
              result[programKey] = { error: error }
            }
          }
        } else {
          result = await checkProgramState(selectedProgram)
        }
      } else {
        // Execute specific program operation
        switch (operation.program) {
          case 'SWAP':
            result = await executeSwapOperation(operation)
            break
          case 'STAKING':
            result = await executeStakingOperation(operation)
            break
          case 'ESTATE':
            result = await executeEstateOperation(operation)
            break
          case 'APP_FACTORY':
            result = await executeAppFactoryOperation(operation)
            break
          default:
            throw new Error(`Unsupported program: ${operation.program}`)
        }
      }

      onTestResult({
        testType: 'admin_operation',
        program: operation.program,
        description: `${operation.name} executed successfully`,
        status: 'success',
        details: { operation: operation.id, result, parameters: operationParams }
      })

    } catch (error: any) {
      onTestResult({
        testType: 'admin_operation',
        program: operation.program,
        description: `${operation.name} failed: ${error.message}`,
        status: 'error',
        details: { operation: operation.id, error, parameters: operationParams },
        severity: 'medium'
      })
    } finally {
      setIsExecuting(false)
    }
  }

  const currentOperation = getCurrentOperation()
  const filteredOperations = getFilteredOperations()

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-white mb-4">🔐 Admin Operations Panel</h3>
        <p className="text-gray-400 text-sm mb-6">
          Execute administrative functions and manage program settings. Admin wallet required for privileged operations.
        </p>
      </div>

      {/* Status Banner */}
      <div className={`rounded-lg p-4 border ${
        isAdminWallet 
          ? 'bg-green-900 bg-opacity-20 border-green-700' 
          : 'bg-yellow-900 bg-opacity-20 border-yellow-700'
      }`}>
        <div className="flex items-center space-x-3">
          <span className={`text-lg ${isAdminWallet ? 'text-green-400' : 'text-yellow-400'}`}>
            {isAdminWallet ? '🔑' : '⚠️'}
          </span>
          <div>
            <p className={`font-semibold text-sm ${isAdminWallet ? 'text-green-400' : 'text-yellow-400'}`}>
              {isAdminWallet ? 'Admin Wallet Connected' : 'Non-Admin Wallet'}
            </p>
            <p className={`text-xs mt-1 ${isAdminWallet ? 'text-green-300' : 'text-yellow-300'}`}>
              {isAdminWallet 
                ? 'You can execute all admin operations' 
                : 'Limited to read-only operations. Admin operations will be blocked.'
              }
            </p>
          </div>
        </div>
      </div>

      {/* Program Selection */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h4 className="text-sm font-medium text-white mb-3">Target Program</h4>
        <select
          value={selectedProgram}
          onChange={(e) => setSelectedProgram(e.target.value)}
          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm"
        >
          <option value="ALL">All Programs</option>
          {Object.entries(PROGRAMS).map(([key, program]) => (
            <option key={key} value={key}>{program.name}</option>
          ))}
        </select>
      </div>

      {/* Operation Selection */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h4 className="text-sm font-medium text-white mb-3">Admin Operation</h4>
        <select
          value={selectedOperation}
          onChange={(e) => {
            setSelectedOperation(e.target.value)
            setOperationParams({})
          }}
          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm"
        >
          <option value="">Select an operation...</option>
          {filteredOperations.map((op) => (
            <option key={op.id} value={op.id}>
              {op.requiresAdmin ? '🔒 ' : '👁️ '}{op.name} ({op.program === 'ALL' ? 'All' : PROGRAMS[op.program as keyof typeof PROGRAMS]?.name})
            </option>
          ))}
        </select>

        {currentOperation && (
          <div className="mt-3 p-3 bg-gray-700 rounded">
            <p className="text-sm text-gray-300">{currentOperation.description}</p>
            {currentOperation.requiresAdmin && !isAdminWallet && (
              <p className="text-xs text-red-400 mt-2">⚠️ This operation requires admin privileges</p>
            )}
          </div>
        )}
      </div>

      {/* Parameters */}
      {currentOperation && currentOperation.parameters.length > 0 && (
        <div className="bg-gray-800 rounded-lg p-4">
          <h4 className="text-sm font-medium text-white mb-3">Parameters</h4>
          <div className="space-y-4">
            {currentOperation.parameters.map((param) => (
              <div key={param.name}>
                <label className="block text-xs text-gray-400 mb-1">
                  {param.name} {param.required && <span className="text-red-400">*</span>}
                </label>
                {param.type === 'boolean' ? (
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={operationParams[param.name] || param.default || false}
                      onChange={(e) => updateParameter(param.name, e.target.checked)}
                      className="rounded border-gray-600 text-defai-primary focus:ring-defai-primary focus:ring-offset-gray-800"
                    />
                    <span className="text-sm text-gray-300">{param.name}</span>
                  </label>
                ) : param.type === 'array' ? (
                  <textarea
                    value={operationParams[param.name] || ''}
                    onChange={(e) => updateParameter(param.name, e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                    placeholder={param.placeholder}
                    rows={3}
                  />
                ) : (
                  <input
                    type={param.type === 'number' ? 'number' : 'text'}
                    value={operationParams[param.name] || param.default || ''}
                    onChange={(e) => updateParameter(param.name, e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                    placeholder={param.placeholder}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Execute Button */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-400">
          {currentOperation ? (
            <>
              {currentOperation.requiresAdmin ? '🔒 Admin Required' : '👁️ Read-Only'}
              {' • '}
              {currentOperation.program === 'ALL' ? 'All Programs' : PROGRAMS[currentOperation.program as keyof typeof PROGRAMS]?.name}
            </>
          ) : (
            'Select an operation to execute'
          )}
        </div>
        <button
          onClick={executeOperation}
          disabled={isExecuting || !currentOperation || !wallet.connected || (currentOperation.requiresAdmin && !isAdminWallet)}
          className={`px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
            isExecuting || !currentOperation || !wallet.connected || (currentOperation?.requiresAdmin && !isAdminWallet)
              ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
              : currentOperation?.requiresAdmin
                ? 'bg-red-600 hover:bg-red-700 text-white hover:shadow-lg'
                : 'bg-blue-600 hover:bg-blue-700 text-white hover:shadow-lg'
          }`}
        >
          {isExecuting ? (
            <span className="flex items-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Executing...
            </span>
          ) : (
            <>
              {currentOperation?.requiresAdmin ? '🔐 ' : '▶️ '}
              Execute Operation
            </>
          )}
        </button>
      </div>
    </div>
  )
} 