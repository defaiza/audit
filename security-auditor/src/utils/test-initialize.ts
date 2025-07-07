import * as anchor from '@coral-xyz/anchor'
import { Program } from '@coral-xyz/anchor'
import { Connection, PublicKey, Keypair } from '@solana/web3.js'
import defaiSwapIdl from '@/idl/defai_swap.json'

export async function testInitialize() {
  const connection = new Connection('http://localhost:8899', 'confirmed')
  const wallet = {
    publicKey: Keypair.generate().publicKey,
    signTransaction: async (tx: any) => tx,
    signAllTransactions: async (txs: any[]) => txs
  }
  
  const provider = new anchor.AnchorProvider(connection, wallet as any, {
    commitment: 'confirmed'
  })
  
  console.log('Testing IDL loading...')
  console.log('IDL structure:', {
    name: defaiSwapIdl.name,
    version: defaiSwapIdl.version,
    instructions: defaiSwapIdl.instructions?.length || 0,
    hasMetadata: !!(defaiSwapIdl as any).metadata
  })
  
  try {
    const programId = new PublicKey('2rpNRpFnZEbb9Xoonieg7THkKnYEQhZoSK8bKNtVaVLS')
    const program = new Program(defaiSwapIdl as any, programId, provider)
    
    console.log('Program created successfully')
    console.log('Program methods:', program.methods ? Object.keys(program.methods) : 'No methods')
    console.log('Program structure:', {
      hasMethods: !!program.methods,
      hasRpc: !!program.rpc,
      hasInstruction: !!program.instruction,
      programId: program.programId.toBase58()
    })
    
    if (program.methods?.initialize) {
      console.log('Initialize method found!')
    } else {
      console.log('Initialize method NOT found')
    }
  } catch (error) {
    console.error('Error creating program:', error)
  }
}

// Export for testing in browser console
if (typeof window !== 'undefined') {
  (window as any).testInitialize = testInitialize
}