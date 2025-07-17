const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Function to get program ID from keypair
function getProgramId(keypairPath) {
  try {
    const output = execSync(`solana address -k ${keypairPath}`, { encoding: 'utf8' });
    return output.trim();
  } catch (error) {
    console.error(`Failed to get program ID from ${keypairPath}`);
    return null;
  }
}

// Get deployed program IDs
const programIds = {
  swap: getProgramId('target/deploy/defai_swap-keypair.json'),
  staking: getProgramId('target/deploy/defai_staking-keypair.json'),
  estate: getProgramId('target/deploy/defai_estate-keypair.json'),
  app_factory: getProgramId('target/deploy/defai_app_factory-keypair.json')
};

console.log('🔍 Found deployed program IDs:');
Object.entries(programIds).forEach(([name, id]) => {
  console.log(`  ${name}: ${id || 'NOT FOUND'}`);
});

// Update IDL files with metadata
function updateIdlMetadata(idlPath, programId) {
  try {
    const idl = JSON.parse(fs.readFileSync(idlPath, 'utf8'));
    
    // Update the top-level address field (this is what Anchor checks first)
    idl.address = programId;
    
    // Also add or update metadata for compatibility
    if (!idl.metadata) {
      idl.metadata = {};
    }
    idl.metadata.address = programId;
    
    fs.writeFileSync(idlPath, JSON.stringify(idl, null, 2));
    console.log(`✅ Updated IDL metadata: ${path.basename(idlPath)}`);
  } catch (error) {
    console.error(`❌ Failed to update ${idlPath}: ${error.message}`);
  }
}

// Update constants.ts
function updateConstantsFile() {
  const constantsPath = 'src/utils/constants.ts';
  let content = fs.readFileSync(constantsPath, 'utf8');
  
  // Update PROGRAM_IDS
  content = content.replace(
    /SWAP: ['"].*?['"]/,
    `SWAP: '${programIds.swap}'`
  );
  content = content.replace(
    /STAKING: ['"].*?['"]/,
    `STAKING: '${programIds.staking}'`
  );
  content = content.replace(
    /ESTATE: ['"].*?['"]/,
    `ESTATE: '${programIds.estate}'`
  );
  content = content.replace(
    /APP_FACTORY: ['"].*?['"]/,
    `APP_FACTORY: '${programIds.app_factory}'`
  );
  
  fs.writeFileSync(constantsPath, content);
  console.log('✅ Updated constants.ts');
}

// Update Anchor.toml
function updateAnchorToml() {
  const anchorPath = 'Anchor.toml';
  let content = fs.readFileSync(anchorPath, 'utf8');
  
  content = content.replace(
    /defai_swap = ".*?"/,
    `defai_swap = "${programIds.swap}"`
  );
  content = content.replace(
    /defai_staking = ".*?"/,
    `defai_staking = "${programIds.staking}"`
  );
  content = content.replace(
    /defai_estate = ".*?"/,
    `defai_estate = "${programIds.estate}"`
  );
  content = content.replace(
    /defai_app_factory = ".*?"/,
    `defai_app_factory = "${programIds.app_factory}"`
  );
  
  fs.writeFileSync(anchorPath, content);
  console.log('✅ Updated Anchor.toml');
}

// Update all test files
function updateTestFiles() {
  const testFiles = [
    'tests/defai-programs.ts',
    'scripts/init-defai-swap.ts',
    'scripts/init-defai-staking.ts',
    'scripts/init-defai-estate.ts',
    'scripts/init-defai-app-factory.ts',
    'scripts/init-localnet.ts',
    'scripts/test-programs.js',
    'scripts/simple-init.js',
    'src/utils/program-test.ts',
    'src/utils/test-environment.ts',
    'src/utils/initialize-programs.ts'
  ];
  
  testFiles.forEach(file => {
    if (fs.existsSync(file)) {
      let content = fs.readFileSync(file, 'utf8');
      let updated = false;
      
      // Update any hardcoded program IDs
      Object.entries(programIds).forEach(([name, id]) => {
        if (id) {
          // Match various patterns of program ID usage
          const patterns = [
            new RegExp(`['"]\\w{43,44}['"].*?//.*?${name}`, 'gi'),
            new RegExp(`${name.toUpperCase()}_PROGRAM_ID.*?=.*?['"]\\w{43,44}['"]`, 'gi'),
            new RegExp(`programId:.*?['"]\\w{43,44}['"].*?//.*?${name}`, 'gi')
          ];
          
          patterns.forEach(pattern => {
            if (pattern.test(content)) {
              content = content.replace(/['"]\w{43,44}['"]/g, (match) => {
                // Only replace if it looks like a program ID
                const stripped = match.slice(1, -1);
                if (stripped.length >= 43 && stripped.length <= 44) {
                  updated = true;
                  return `'${id}'`;
                }
                return match;
              });
            }
          });
        }
      });
      
      if (updated) {
        fs.writeFileSync(file, content);
        console.log(`✅ Updated ${file}`);
      }
    }
  });
}

console.log('\n🔄 Updating program IDs throughout the codebase...\n');

// Update IDL files
updateIdlMetadata('src/idl/defai_swap.json', programIds.swap);
updateIdlMetadata('src/idl/defai_staking.json', programIds.staking);
updateIdlMetadata('src/idl/defai_estate.json', programIds.estate);
updateIdlMetadata('src/idl/defai_app_factory.json', programIds.app_factory);

updateIdlMetadata('target/idl/defai_swap.json', programIds.swap);
updateIdlMetadata('target/idl/defai_staking.json', programIds.staking);
updateIdlMetadata('target/idl/defai_estate.json', programIds.estate);
updateIdlMetadata('target/idl/defai_app_factory.json', programIds.app_factory);

// Update configuration files
updateConstantsFile();
updateAnchorToml();
updateTestFiles();

console.log('\n✨ Program ID update complete!');
console.log('\n📝 Next steps:');
console.log('  1. Run "npm run sync:idls" to sync IDL files');
console.log('  2. Run "npm run test:run" to test the programs');
console.log('  3. If tests still fail, check for any remaining hardcoded IDs'); 