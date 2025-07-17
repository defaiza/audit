#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

// Load todos from the todo system
const todos = [
  { id: 'implement-real-attacks', content: 'Implement real attack vector tests (reentrancy, flash loans, double-spending, DOS, oracle manipulation)', status: 'pending' },
  { id: 'fix-token-minting', content: 'Add real SPL token minting and transfers for realistic testing', status: 'pending' },
  { id: 'fix-wallet-signing', content: 'Implement proper wallet signing in CLI tests and enforce admin wallet in frontend', status: 'pending' },
  { id: 'auto-update-program-ids', content: 'Modify deploy script to auto-update program IDs in all config files', status: 'pending' },
  { id: 'add-pdf-reports', content: 'Implement PDF/HTML report generation with charts and tables', status: 'pending' },
  { id: 'create-setup-script', content: 'Create one-click setup script for validator, deploy, and initialization', status: 'pending' },
  { id: 'add-cluster-config', content: 'Add environment variable support for switching between localnet/devnet/testnet', status: 'pending' },
  { id: 'improve-error-feedback', content: 'Add detailed error messages and recovery suggestions in frontend', status: 'pending' },
  { id: 'enforce-test-sequence', content: 'Disable test buttons until prerequisites are met (deploy → init → test)', status: 'pending' },
  { id: 'add-cicd', content: 'Create GitHub Actions workflow for automated testing', status: 'pending' },
  { id: 'integrate-websocket', content: 'Hook up WebSocket monitor for real-time attack detection', status: 'pending' },
  { id: 'add-wallet-validation', content: 'Add wallet checker that shows import instructions for admin keypair', status: 'pending' },
  { id: 'standardize-reports', content: 'Use ISO timestamps for report names and add cleanup/pagination', status: 'pending' },
  { id: 'mark-placeholders', content: 'Clearly mark placeholder tests vs real implementations in results', status: 'pending' },
  { id: 'add-mobile-support', content: 'Make frontend responsive and add accessibility features', status: 'pending' }
];

// Load tracking document
const trackingPath = path.join(__dirname, '../FIX_TRACKING.md');
const trackingContent = fs.readFileSync(trackingPath, 'utf8');

// Parse severity from tracking document
const getSeverity = (todoId) => {
  const idIndex = trackingContent.indexOf(`**ID**: \`${todoId}\``);
  if (idIndex === -1) return 'unknown';
  
  // Look backwards for the section header
  const beforeId = trackingContent.substring(0, idIndex);
  if (beforeId.includes('Critical Priority')) return 'critical';
  if (beforeId.includes('High Priority')) return 'high';
  if (beforeId.includes('Medium Priority')) return 'medium';
  return 'unknown';
};

// Display todos with formatting
console.log(`${colors.bright}${colors.cyan}📋 DeFAI Security Auditor - TODO Tracker${colors.reset}\n`);

// Group by status
const pending = todos.filter(t => t.status === 'pending');
const inProgress = todos.filter(t => t.status === 'in_progress');
const completed = todos.filter(t => t.status === 'completed');

// Summary
console.log(`${colors.bright}Summary:${colors.reset}`);
console.log(`  ${colors.yellow}⏳ Pending: ${pending.length}${colors.reset}`);
console.log(`  ${colors.blue}🔄 In Progress: ${inProgress.length}${colors.reset}`);
console.log(`  ${colors.green}✅ Completed: ${completed.length}${colors.reset}`);
console.log(`  ${colors.bright}Total: ${todos.length}${colors.reset}\n`);

// Display by severity
const critical = todos.filter(t => ['implement-real-attacks', 'fix-token-minting', 'fix-wallet-signing', 'auto-update-program-ids'].includes(t.id));
const high = todos.filter(t => ['add-pdf-reports', 'create-setup-script', 'add-cluster-config', 'improve-error-feedback', 'enforce-test-sequence'].includes(t.id));
const medium = todos.filter(t => ['add-cicd', 'integrate-websocket', 'add-wallet-validation', 'standardize-reports', 'mark-placeholders', 'add-mobile-support'].includes(t.id));

if (critical.length > 0) {
  console.log(`${colors.red}${colors.bright}🔴 Critical Priority:${colors.reset}`);
  critical.forEach((todo, i) => {
    const status = todo.status === 'pending' ? '[ ]' : 
                  todo.status === 'in_progress' ? '[~]' : 
                  todo.status === 'completed' ? '[✓]' : '[x]';
    console.log(`  ${status} ${i + 1}. ${todo.content}`);
    console.log(`      ${colors.cyan}ID: ${todo.id}${colors.reset}`);
  });
  console.log();
}

if (high.length > 0) {
  console.log(`${colors.yellow}${colors.bright}🟡 High Priority:${colors.reset}`);
  high.forEach((todo, i) => {
    const status = todo.status === 'pending' ? '[ ]' : 
                  todo.status === 'in_progress' ? '[~]' : 
                  todo.status === 'completed' ? '[✓]' : '[x]';
    console.log(`  ${status} ${i + 1}. ${todo.content}`);
    console.log(`      ${colors.cyan}ID: ${todo.id}${colors.reset}`);
  });
  console.log();
}

if (medium.length > 0) {
  console.log(`${colors.green}${colors.bright}🟢 Medium Priority:${colors.reset}`);
  medium.forEach((todo, i) => {
    const status = todo.status === 'pending' ? '[ ]' : 
                  todo.status === 'in_progress' ? '[~]' : 
                  todo.status === 'completed' ? '[✓]' : '[x]';
    console.log(`  ${status} ${i + 1}. ${todo.content}`);
    console.log(`      ${colors.cyan}ID: ${todo.id}${colors.reset}`);
  });
  console.log();
}

// Next actions
console.log(`${colors.bright}${colors.magenta}🎯 Next Actions:${colors.reset}`);
console.log(`1. Start with critical issues (wallet signing, token minting)`);
console.log(`2. Use ${colors.cyan}todo_write${colors.reset} to update task status when starting`);
console.log(`3. See ${colors.blue}FIX_TRACKING.md${colors.reset} for detailed implementation plans`);
console.log(); 