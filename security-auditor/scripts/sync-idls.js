#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

console.log('🔄 Syncing IDL files...');

const sourceDir = path.join(__dirname, '../target/idl');
const destDir = path.join(__dirname, '../src/idl');

const idlFiles = [
  'defai_swap.json',
  'defai_staking.json',
  'defai_estate.json',
  'defai_app_factory.json'
];

idlFiles.forEach(file => {
  try {
    const sourcePath = path.join(sourceDir, file);
    const destPath = path.join(destDir, file);
    
    if (fs.existsSync(sourcePath)) {
      const content = fs.readFileSync(sourcePath, 'utf8');
      fs.writeFileSync(destPath, content);
      console.log(`✅ Synced ${file}`);
    } else {
      console.log(`⚠️  Source file not found: ${file}`);
    }
  } catch (error) {
    console.error(`❌ Error syncing ${file}:`, error.message);
  }
});

console.log('\n✨ IDL sync complete!'); 