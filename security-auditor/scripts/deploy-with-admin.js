#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ADMIN_KEYPAIR_PATH = path.join(__dirname, '..', 'admin-keypair.json');

async function deployWithAdmin() {
  console.log('🚀 Starting program deployment with admin keypair...\n');
  
  // Check if admin keypair exists
  if (!fs.existsSync(ADMIN_KEYPAIR_PATH)) {
    console.error('❌ Admin keypair not found at:', ADMIN_KEYPAIR_PATH);
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
  
  // Build programs
  console.log('🔨 Building programs...');
  execSync('anchor build', { stdio: 'inherit' });
  
  // Deploy programs with admin as upgrade authority
  console.log('\n🚀 Deploying programs with admin as upgrade authority...');
  
  const programs = [
    { name: 'defai_swap', path: './target/deploy/defai_swap.so' },
    { name: 'defai_staking', path: './target/deploy/defai_staking.so' },
    { name: 'defai_estate', path: './target/deploy/defai_estate.so' },
    { name: 'defai_app_factory', path: './target/deploy/defai_app_factory.so' }
  ];
  
  for (const program of programs) {
    console.log(`\n📦 Deploying ${program.name}...`);
    try {
      // Deploy with admin as upgrade authority
      const deployCmd = `solana program deploy ${program.path} --upgrade-authority ${ADMIN_KEYPAIR_PATH}`;
      const output = execSync(deployCmd, { encoding: 'utf-8' });
      console.log(`✅ ${program.name} deployed!`);
      console.log(output);
    } catch (error) {
      console.error(`❌ Failed to deploy ${program.name}:`, error.message);
    }
  }
  
  console.log('\n✨ Deployment complete!');
  console.log('Admin wallet:', execSync('solana address', { encoding: 'utf-8' }).trim());
  
  // Update IDLs
  console.log('\n📄 Updating IDLs...');
  try {
    execSync('anchor idl init -f target/idl/defai_swap.json CevRqnM5Jxz21QQfNz9wQEwXAr9nsaasdF1CZUZfcv3N', { stdio: 'inherit' });
    execSync('anchor idl init -f target/idl/defai_staking.json 9Et8s8t6o52C4e4BkmJpAf68SfJEtn67LvhGLvdHLijN', { stdio: 'inherit' });
    execSync('anchor idl init -f target/idl/defai_estate.json CVbyAQjUZ2oAofKaZG3mfaK3yHDJDDW3UaeJvj6vkGx2', { stdio: 'inherit' });
    execSync('anchor idl init -f target/idl/defai_app_factory.json uosa7o62kupuo2TBHFm36dvpV9JkFsfhXD9tMV8qMM2', { stdio: 'inherit' });
    console.log('✅ IDLs uploaded!');
  } catch (e) {
    console.log('⚠️  IDL upload failed. Programs will still work but IDL won\'t be on-chain.');
  }
}

deployWithAdmin().catch(console.error);