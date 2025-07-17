#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

// Mapping of old IDs to new IDs
const ID_MAPPING = {
  // defai_swap
  '2rpNRpFnZEbb9Xoonieg7THkKnYEQhZoSK8bKNtVaVLS': '877w653ayrjqM6fT5yjCuPuTABo8h7N6ffF3es1HRrxm',
  // defai_staking  
  'CyYfX3MjkuQBTpD8N3KLXBAr8Nik89f63FZ3jFVSMd6s': 'CvDs2FSKiNAmtdGmY3LaVcCpqAudK3otmrG3ksmUBzpG',
  // defai_estate
  'HYJe4U2DToJCjb5T8tysN4784twLUk48dUjPGD7dKYut': 'J8qubfQ5SdvYiJLo5V2mMspZp9as75RePwstVXrtJxo8',
  // defai_app_factory
  'AzcDoYYY1cHCd3faCKd8tG76ESUnuRz8jVBXEcxFwznQ': '4HsYtGADv25mPs1CqicceHK1BuaLhBD66ZFjZ8jnJZr3'
};

console.log('🔄 Updating program IDs throughout the codebase...\n');

// Files to update
const filesToUpdate = [
  '../src/utils/test-environment.ts',
  '../src/utils/program-test.ts',
  '../src/utils/initialize-programs.ts',
  '../src/utils/simple-initialize.ts',
  '../tests/defai-programs.ts',
  '../scripts/init-defai-swap.ts',
  '../scripts/init-defai-staking.ts',
  '../scripts/init-defai-estate.ts',
  '../scripts/init-defai-app-factory.ts',
  '../scripts/init-localnet.js',
  '../scripts/init-localnet.ts',
  '../scripts/test-programs.js',
  '../scripts/simple-init.js',
  '../scripts/initializeAll.js'
];

filesToUpdate.forEach(filePath => {
  const fullPath = path.join(__dirname, filePath);
  
  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️  File not found: ${filePath}`);
    return;
  }
  
  try {
    let content = fs.readFileSync(fullPath, 'utf8');
    let modified = false;
    
    // Replace each old ID with new ID
    Object.entries(ID_MAPPING).forEach(([oldId, newId]) => {
      if (content.includes(oldId)) {
        content = content.replace(new RegExp(oldId, 'g'), newId);
        modified = true;
      }
    });
    
    if (modified) {
      fs.writeFileSync(fullPath, content);
      console.log(`✅ Updated: ${path.basename(filePath)}`);
    } else {
      console.log(`⏭️  No changes needed: ${path.basename(filePath)}`);
    }
  } catch (error) {
    console.error(`❌ Error updating ${filePath}:`, error.message);
  }
});

console.log('\n✨ Program ID update complete!'); 