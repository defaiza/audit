#!/usr/bin/env node

const { Connection, PublicKey } = require('@solana/web3.js');
const { Program, AnchorProvider } = require('@coral-xyz/anchor');

const PROGRAMS = {
  SWAP: {
    name: 'DeFAI Swap',
    programId: 'SwapWR2cjuCAM7A9tQkqCh7MiKaeYr5rGGQFqnMVjfP'
  },
  STAKING: {
    name: 'DeFAI Staking',
    programId: 'StakfVMEW5hqTq7SYe5qFBJrX4cxa9NNmqWXjFuqFKy'
  },
  ESTATE: {
    name: 'DeFAI Estate',
    programId: 'EstateVs1eKrmwRrmAWfW8KrZBFqSmFLQhcbDbLQnc7y'
  },
  APP_FACTORY: {
    name: 'DeFAI App Factory',
    programId: 'FactHVn6j9XTSzg9RXgGMXGcRMyxyDXJjHP9AkhtDYfJ'
  }
};

async function testPrograms() {
  console.log('🔍 DeFAI Security Auditor - CLI Test Runner\n');
  
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  
  for (const [key, program] of Object.entries(PROGRAMS)) {
    console.log(`Testing ${program.name}...`);
    console.log(`Program ID: ${program.programId}`);
    
    try {
      const programId = new PublicKey(program.programId);
      const accountInfo = await connection.getAccountInfo(programId);
      
      if (accountInfo && accountInfo.executable) {
        console.log('✅ Program is deployed and executable');
        console.log(`   Size: ${accountInfo.data.length} bytes`);
        console.log(`   Owner: ${accountInfo.owner.toString()}`);
      } else {
        console.log('❌ Program not found or not executable');
      }
      
      // Try to fetch IDL
      try {
        const idlAddress = await PublicKey.createProgramAddressSync(
          [Buffer.from('metadata'), programId.toBuffer()],
          programId
        );
        
        const idlAccount = await connection.getAccountInfo(idlAddress);
        if (idlAccount) {
          console.log('✅ IDL metadata found');
        } else {
          console.log('⚠️  IDL metadata not found');
        }
      } catch (err) {
        console.log('⚠️  Could not check IDL:', err.message);
      }
      
    } catch (error) {
      console.log('❌ Error testing program:', error.message);
    }
    
    console.log('---\n');
  }
  
  console.log('Test run complete!');
}

// Run the tests
testPrograms().catch(console.error);