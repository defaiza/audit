#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ADMIN_KEYPAIR_PATH = path.join(__dirname, '..', 'admin-keypair.json');
const PROGRAMS = [
  { name: 'defai_swap', programId: 'CevRqnM5Jxz21QQfNz9wQEwXAr9nsaasdF1CZUZfcv3N' },
  { name: 'defai_staking', programId: '9Et8s8t6o52C4e4BkmJpAf68SfJEtn67LvhGLvdHLijN' },
  { name: 'defai_estate', programId: 'CVbyAQjUZ2oAofKaZG3mfaK3yHDJDDW3UaeJvj6vkGx2' },
  { name: 'defai_app_factory', programId: 'uosa7o62kupuo2TBHFm36dvpV9JkFsfhXD9tMV8qMM2' }
];

async function deployPrograms() {
  console.log('🚀 Starting program deployment...\n');
  
  // Check if admin keypair exists
  if (!fs.existsSync(ADMIN_KEYPAIR_PATH)) {
    console.error('❌ Admin keypair not found. Run: solana-keygen new --outfile admin-keypair.json');
    process.exit(1);
  }
  
  // Set Solana config to use admin keypair
  console.log('📝 Setting Solana config to use admin keypair...');
  execSync(`solana config set --keypair ${ADMIN_KEYPAIR_PATH}`, { stdio: 'inherit' });
  
  // Check balance
  console.log('\n💰 Checking balance...');
  const balance = execSync('solana balance', { encoding: 'utf-8' });
  console.log(`Balance: ${balance}`);
  
  if (parseFloat(balance) < 10) {
    console.log('⚠️  Low balance detected. Requesting airdrop...');
    try {
      execSync('solana airdrop 10', { stdio: 'inherit' });
      console.log('✅ Airdrop successful!\n');
    } catch (e) {
      console.log('⚠️  Airdrop failed. Make sure you have enough SOL.\n');
    }
  }
  
  // Deploy programs
  console.log('🔨 Building programs...');
  execSync('anchor build', { stdio: 'inherit' });
  
  console.log('\n🚀 Deploying programs...');
  
  // Deploy all programs at once
  try {
    execSync('anchor deploy', { stdio: 'inherit' });
    console.log('✅ All programs deployed successfully!');
  } catch (error) {
    console.error('❌ Failed to deploy programs:', error.message);
    
    // Try deploying individually if batch fails
    for (const program of PROGRAMS) {
      console.log(`\nTrying to deploy ${program.name} individually...`);
      try {
        const programPath = `./target/deploy/${program.name}.so`;
        const keypairPath = `./target/deploy/${program.name}-keypair.json`;
        
        // Check if files exist
        if (fs.existsSync(programPath) && fs.existsSync(keypairPath)) {
          execSync(`solana program deploy ${programPath} --program-id ${keypairPath}`, { stdio: 'inherit' });
          console.log(`✅ ${program.name} deployed successfully!`);
        } else {
          console.error(`❌ ${program.name} build artifacts not found`);
        }
      } catch (err) {
        console.error(`❌ Failed to deploy ${program.name}:`, err.message);
      }
    }
  }
  
  console.log('\n✨ Deployment complete!');
  console.log('Admin wallet:', execSync('solana address', { encoding: 'utf-8' }).trim());
}

deployPrograms().catch(console.error);