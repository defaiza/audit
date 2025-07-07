import { useState } from 'react'
import { Connection, PublicKey, Keypair, SystemProgram } from '@solana/web3.js'
import * as anchor from '@coral-xyz/anchor'
import { Program, Idl } from '@coral-xyz/anchor'
import defaiSwapIdl from '@/idl/defai_swap.json'
import defaiStakingIdl from '@/idl/defai_staking.json'
import defaiEstateIdl from '@/idl/defai_estate.json'
import defaiAppFactoryIdl from '@/idl/defai_app_factory.json'
import { PROGRAMS } from '@/utils/constants'
import { SimpleInitializer } from '@/utils/simple-initialize'

interface ConfigurableInitializerProps {
  connection: Connection
  wallet: any
  adminKeypair: Keypair | null
  onTestResult: (result: any) => void
}

interface InitConfig {
  useCustomMints: boolean
  defaiMint: string
  rewardsMint: string
  treasuryWallet: string
  tierPrices: number[]
  platformFeeBps: number
  multisigThreshold: number
  enableVesting: boolean
  enableTax: boolean
  skipIfInitialized: boolean
}

export function ConfigurableInitializer({ connection, wallet, adminKeypair, onTestResult }: ConfigurableInitializerProps) {
  const [isInitializing, setIsInitializing] = useState(false)
  const [selectedPrograms, setSelectedPrograms] = useState<string[]>(Object.keys(PROGRAMS))
  const [config, setConfig] = useState<InitConfig>({
    useCustomMints: false,
    defaiMint: '',
    rewardsMint: '',
    treasuryWallet: wallet?.publicKey?.toBase58() || '',
    tierPrices: [1_000_000_000, 10_000_000_000, 500_000_000_000, 1_000_000_000_000, 5_000_000_000_000],
    platformFeeBps: 2000, // 20%
    multisigThreshold: 2,
    enableVesting: true,
    enableTax: true,
    skipIfInitialized: true
  })

  const updateConfig = (field: keyof InitConfig, value: any) => {
    setConfig(prev => ({ ...prev, [field]: value }))
  }

  const toggleProgram = (programKey: string) => {
    setSelectedPrograms(prev => 
      prev.includes(programKey) 
        ? prev.filter(p => p !== programKey)
        : [...prev, programKey]
    )
  }

  const generateRandomMints = () => {
    updateConfig('defaiMint', Keypair.generate().publicKey.toBase58())
    updateConfig('rewardsMint', Keypair.generate().publicKey.toBase58())
  }

  const validateConfig = (): string | null => {
    if (config.useCustomMints) {
      try {
        new PublicKey(config.defaiMint)
        new PublicKey(config.rewardsMint)
      } catch {
        return 'Invalid mint public keys'
      }
    }
    
    if (config.treasuryWallet) {
      try {
        new PublicKey(config.treasuryWallet)
      } catch {
        return 'Invalid treasury wallet public key'
      }
    }

    if (config.tierPrices.some(price => price <= 0)) {
      return 'All tier prices must be positive'
    }

    if (config.platformFeeBps < 0 || config.platformFeeBps > 10000) {
      return 'Platform fee must be between 0-10000 basis points (0-100%)'
    }

    return null
  }

  const createProgramInstance = async (programId: PublicKey, idl: Idl, programName: string): Promise<Program | null> => {
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
      
      const program = new Program(idlCopy as Idl, programId, provider)
      return program
    } catch (err: any) {
      console.error(`Error creating ${programName} program instance:`, err)
      if (err.message?.includes('DeclaredProgramIdMismatch')) {
        console.log(`Trying to fix program ID mismatch for ${programName}...`)
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
          const program = new Program(idlWithoutAddress as Idl, programId, provider)
          return program
        } catch (retryErr: any) {
          console.error(`Retry failed for ${programName}:`, retryErr)
          onTestResult({
            testType: 'initialization',
            program: programName,
            description: `Failed to create program instance after retry: ${retryErr.message}`,
            status: 'error',
            details: retryErr,
            severity: 'high'
          })
          return null
        }
      }
      onTestResult({
        testType: 'initialization',
        program: programName,
        description: `Failed to create program instance: ${err.message}`,
        status: 'error',
        details: err,
        severity: 'high'
      })
      return null
    }
  }

  const initializeSpecificProgram = async (programKey: string): Promise<boolean> => {
    const program = PROGRAMS[programKey as keyof typeof PROGRAMS]
    const programId = new PublicKey(program.programId)
    
    const defaiMint = config.useCustomMints 
      ? new PublicKey(config.defaiMint)
      : Keypair.generate().publicKey
    
    const rewardsMint = config.useCustomMints 
      ? new PublicKey(config.rewardsMint)
      : Keypair.generate().publicKey

    const treasury = config.treasuryWallet 
      ? new PublicKey(config.treasuryWallet)
      : wallet.publicKey

    try {
      switch (programKey) {
        case 'SWAP':
          return await initializeSwap(programId, defaiMint, rewardsMint, treasury)
        case 'STAKING':
          return await initializeStaking(programId, defaiMint)
        case 'ESTATE':
          return await initializeEstate(programId)
        case 'APP_FACTORY':
          return await initializeAppFactory(programId, defaiMint, treasury)
        default:
          return false
      }
    } catch (err: any) {
      onTestResult({
        testType: 'initialization',
        program: program.name,
        description: `Initialization failed: ${err.message}`,
        status: 'error',
        details: err,
        severity: 'high'
      })
      return false
    }
  }

  const initializeSwap = async (programId: PublicKey, defaiMint: PublicKey, rewardsMint: PublicKey, treasury: PublicKey): Promise<boolean> => {
    const program = await createProgramInstance(programId, defaiSwapIdl as Idl, 'DeFAI Swap')
    if (!program) return false

    const [configPda] = PublicKey.findProgramAddressSync([Buffer.from('config')], programId)
    const [escrowPda] = PublicKey.findProgramAddressSync([Buffer.from('escrow')], programId)
    const [taxPda] = PublicKey.findProgramAddressSync([Buffer.from('tax_state')], programId)

    // Check if already initialized
    if (config.skipIfInitialized) {
      try {
        await program.account.config.fetch(configPda)
        onTestResult({
          testType: 'initialization',
          program: 'DeFAI Swap',
          description: 'Already initialized - skipped',
          status: 'info',
          details: { configPda: configPda.toBase58() }
        })
        return true
      } catch {
        // Not initialized, continue
      }
    }

    const collectionMint = Keypair.generate().publicKey
    const tierPrices = config.tierPrices.map(p => new anchor.BN(p))

    const tx = await program.methods
      .initialize(tierPrices)
      .accounts({
        admin: wallet.publicKey,
        oldMint: defaiMint,
        newMint: rewardsMint,
        collection: collectionMint,
        treasury,
        config: configPda,
        escrow: escrowPda,
        taxState: taxPda,
        systemProgram: SystemProgram.programId
      })
      .rpc()

    onTestResult({
      testType: 'initialization',
      program: 'DeFAI Swap',
      description: 'Initialized successfully with custom configuration',
      status: 'success',
      details: { tx, configPda: configPda.toBase58(), tierPrices: config.tierPrices }
    })

    return true
  }

  const initializeStaking = async (programId: PublicKey, defaiMint: PublicKey): Promise<boolean> => {
    const program = await createProgramInstance(programId, defaiStakingIdl as Idl, 'DeFAI Staking')
    if (!program) return false

    const [programStatePda] = PublicKey.findProgramAddressSync([Buffer.from('program-state')], programId)
    const [stakeVaultPda] = PublicKey.findProgramAddressSync([Buffer.from('stake-vault')], programId)

    if (config.skipIfInitialized) {
      try {
        await program.account.programState.fetch(programStatePda)
        onTestResult({
          testType: 'initialization',
          program: 'DeFAI Staking',
          description: 'Already initialized - skipped',
          status: 'info',
          details: { programStatePda: programStatePda.toBase58() }
        })
        return true
      } catch {
        // Not initialized, continue
      }
    }

    const tx = await program.methods
      .initializeProgram(defaiMint)
      .accounts({
        programState: programStatePda,
        stakeVault: stakeVaultPda,
        authority: wallet.publicKey,
        defaiMint,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY
      })
      .rpc()

    onTestResult({
      testType: 'initialization',
      program: 'DeFAI Staking',
      description: 'Initialized successfully',
      status: 'success',
      details: { tx, programStatePda: programStatePda.toBase58() }
    })

    return true
  }

  const initializeEstate = async (programId: PublicKey): Promise<boolean> => {
    const program = await createProgramInstance(programId, defaiEstateIdl as Idl, 'DeFAI Estate')
    if (!program) return false

    const [globalCounterPda] = PublicKey.findProgramAddressSync([Buffer.from('global-counter')], programId)

    if (config.skipIfInitialized) {
      try {
        await program.account.globalCounter.fetch(globalCounterPda)
        onTestResult({
          testType: 'initialization',
          program: 'DeFAI Estate',
          description: 'Already initialized - skipped',
          status: 'info',
          details: { globalCounterPda: globalCounterPda.toBase58() }
        })
        return true
      } catch {
        // Not initialized, continue
      }
    }

    const tx = await program.methods
      .initializeGlobalCounter()
      .accounts({
        admin: wallet.publicKey,
        globalCounter: globalCounterPda,
        systemProgram: SystemProgram.programId
      })
      .rpc()

    onTestResult({
      testType: 'initialization',
      program: 'DeFAI Estate',
      description: 'Initialized successfully',
      status: 'success',
      details: { tx, globalCounterPda: globalCounterPda.toBase58() }
    })

    return true
  }

  const initializeAppFactory = async (programId: PublicKey, defaiMint: PublicKey, treasury: PublicKey): Promise<boolean> => {
    const program = await createProgramInstance(programId, defaiAppFactoryIdl as Idl, 'DeFAI App Factory')
    if (!program) return false

    const [appFactoryPda] = PublicKey.findProgramAddressSync([Buffer.from('app_factory')], programId)

    if (config.skipIfInitialized) {
      try {
        await program.account.appFactory.fetch(appFactoryPda)
        onTestResult({
          testType: 'initialization',
          program: 'DeFAI App Factory',
          description: 'Already initialized - skipped',
          status: 'info',
          details: { appFactoryPda: appFactoryPda.toBase58() }
        })
        return true
      } catch {
        // Not initialized, continue
      }
    }

    const masterCollection = Keypair.generate().publicKey

    const tx = await program.methods
      .initializeAppFactory(config.platformFeeBps)
      .accounts({
        appFactory: appFactoryPda,
        authority: wallet.publicKey,
        defaiMint,
        treasury,
        masterCollection,
        systemProgram: SystemProgram.programId
      })
      .rpc()

    onTestResult({
      testType: 'initialization',
      program: 'DeFAI App Factory',
      description: `Initialized successfully with ${config.platformFeeBps} BPS platform fee`,
      status: 'success',
      details: { tx, appFactoryPda: appFactoryPda.toBase58(), platformFeeBps: config.platformFeeBps }
    })

    return true
  }

  const handleInitialize = async () => {
    const validationError = validateConfig()
    if (validationError) {
      onTestResult({
        testType: 'initialization',
        program: 'Configuration',
        description: `Configuration error: ${validationError}`,
        status: 'error',
        details: { config },
        severity: 'medium'
      })
      return
    }

    if (!wallet.connected) {
      onTestResult({
        testType: 'initialization',
        program: 'Wallet',
        description: 'Wallet not connected',
        status: 'error',
        details: {},
        severity: 'medium'
      })
      return
    }

    setIsInitializing(true)

    try {
      const results = []
      for (const programKey of selectedPrograms) {
        const success = await initializeSpecificProgram(programKey)
        results.push({ programKey, success })
      }

      const successCount = results.filter(r => r.success).length
      onTestResult({
        testType: 'initialization',
        program: 'Batch Initialization',
        description: `Completed: ${successCount}/${results.length} programs initialized`,
        status: successCount === results.length ? 'success' : 'warning',
        details: { results, config },
        severity: successCount === 0 ? 'high' : 'low'
      })

    } catch (error: any) {
      onTestResult({
        testType: 'initialization',
        program: 'Batch Initialization',
        description: `Batch initialization failed: ${error.message}`,
        status: 'error',
        details: { error, config },
        severity: 'high'
      })
    } finally {
      setIsInitializing(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-white mb-4">🚀 Configurable Program Initialization</h3>
        <p className="text-gray-400 text-sm mb-6">
          Customize initialization parameters and deploy programs with specific configurations for security testing.
        </p>
      </div>

      {/* Program Selection */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h4 className="text-sm font-medium text-white mb-3">Select Programs to Initialize</h4>
        <div className="grid grid-cols-2 gap-3">
          {Object.entries(PROGRAMS).map(([key, program]) => (
            <label key={key} className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedPrograms.includes(key)}
                onChange={() => toggleProgram(key)}
                className="rounded border-gray-600 text-defai-primary focus:ring-defai-primary focus:ring-offset-gray-800"
              />
              <span className="text-sm text-gray-300">{program.name}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Token Configuration */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h4 className="text-sm font-medium text-white mb-3">Token Configuration</h4>
        <div className="space-y-4">
          <label className="flex items-center space-x-3">
            <input
              type="checkbox"
              checked={config.useCustomMints}
              onChange={(e) => updateConfig('useCustomMints', e.target.checked)}
              className="rounded border-gray-600 text-defai-primary focus:ring-defai-primary focus:ring-offset-gray-800"
            />
            <span className="text-sm text-gray-300">Use Custom Token Mints</span>
          </label>

          {config.useCustomMints && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">DeFAI Mint Address</label>
                <input
                  type="text"
                  value={config.defaiMint}
                  onChange={(e) => updateConfig('defaiMint', e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                  placeholder="Enter mint public key"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Rewards Mint Address</label>
                <input
                  type="text"
                  value={config.rewardsMint}
                  onChange={(e) => updateConfig('rewardsMint', e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                  placeholder="Enter mint public key"
                />
              </div>
            </div>
          )}

          {config.useCustomMints && (
            <button
              onClick={generateRandomMints}
              className="text-xs text-defai-primary hover:underline"
            >
              Generate Random Mints for Testing
            </button>
          )}

          <div>
            <label className="block text-xs text-gray-400 mb-1">Treasury Wallet</label>
            <input
              type="text"
              value={config.treasuryWallet}
              onChange={(e) => updateConfig('treasuryWallet', e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm"
              placeholder="Treasury wallet address"
            />
          </div>
        </div>
      </div>

      {/* Swap Configuration */}
      {selectedPrograms.includes('SWAP') && (
        <div className="bg-gray-800 rounded-lg p-4">
          <h4 className="text-sm font-medium text-white mb-3">Swap Program Configuration</h4>
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-gray-400 mb-2">Tier Prices (in smallest unit)</label>
              <div className="grid grid-cols-5 gap-2">
                {config.tierPrices.map((price, i) => (
                  <div key={i}>
                    <label className="block text-xs text-gray-500 mb-1">Tier {i + 1}</label>
                    <input
                      type="number"
                      value={price}
                      onChange={(e) => {
                        const newPrices = [...config.tierPrices]
                        newPrices[i] = parseInt(e.target.value) || 0
                        updateConfig('tierPrices', newPrices)
                      }}
                      className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-xs"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* App Factory Configuration */}
      {selectedPrograms.includes('APP_FACTORY') && (
        <div className="bg-gray-800 rounded-lg p-4">
          <h4 className="text-sm font-medium text-white mb-3">App Factory Configuration</h4>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Platform Fee (Basis Points)</label>
            <input
              type="number"
              value={config.platformFeeBps}
              onChange={(e) => updateConfig('platformFeeBps', parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm"
              placeholder="2000 = 20%"
              min="0"
              max="10000"
            />
            <p className="text-xs text-gray-500 mt-1">
              {(config.platformFeeBps / 100).toFixed(2)}% platform fee
            </p>
          </div>
        </div>
      )}

      {/* Options */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h4 className="text-sm font-medium text-white mb-3">Initialization Options</h4>
        <div className="space-y-3">
          <label className="flex items-center space-x-3">
            <input
              type="checkbox"
              checked={config.skipIfInitialized}
              onChange={(e) => updateConfig('skipIfInitialized', e.target.checked)}
              className="rounded border-gray-600 text-defai-primary focus:ring-defai-primary focus:ring-offset-gray-800"
            />
            <span className="text-sm text-gray-300">Skip if already initialized</span>
          </label>
        </div>
      </div>

      {/* Initialize Button */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-400">
          {selectedPrograms.length} program(s) selected
        </div>
        <button
          onClick={handleInitialize}
          disabled={isInitializing || selectedPrograms.length === 0 || !wallet.connected}
          className={`px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
            isInitializing || selectedPrograms.length === 0 || !wallet.connected
              ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
              : 'bg-defai-primary hover:bg-defai-primary-dark text-white hover:shadow-lg'
          }`}
        >
          {isInitializing ? (
            <span className="flex items-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Initializing...
            </span>
          ) : (
            '🚀 Initialize Selected Programs'
          )}
        </button>
      </div>
    </div>
  )
} 