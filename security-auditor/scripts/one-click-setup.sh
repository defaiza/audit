#!/bin/bash

# DeFAI Security Auditor - One-Click Setup Script
# This script automates the entire setup process including:
# - Solana validator setup
# - Program deployment  
# - Program initialization
# - Test environment preparation

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SOLANA_VERSION="1.18.25"
ANCHOR_VERSION="0.30.1"
NODE_VERSION="18"

echo -e "${BLUE}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║       DeFAI Security Auditor - One-Click Setup       ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════╝${NC}"
echo ""

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to print status
print_status() {
    echo -e "${BLUE}[$(date +'%H:%M:%S')]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[$(date +'%H:%M:%S')] ✅ $1${NC}"
}

print_error() {
    echo -e "${RED}[$(date +'%H:%M:%S')] ❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}[$(date +'%H:%M:%S')] ⚠️  $1${NC}"
}

# Step 1: Check prerequisites
print_status "Checking prerequisites..."

if ! command_exists node; then
    print_error "Node.js is not installed. Please install Node.js ${NODE_VERSION} or higher"
    exit 1
fi

if ! command_exists npm; then
    print_error "npm is not installed. Please install npm"
    exit 1
fi

if ! command_exists rustc; then
    print_error "Rust is not installed. Please install Rust via https://rustup.rs"
    exit 1
fi

print_success "Prerequisites check passed"

# Step 2: Install/Update Solana
print_status "Setting up Solana..."

if ! command_exists solana; then
    print_status "Installing Solana ${SOLANA_VERSION}..."
    sh -c "$(curl -sSfL https://release.solana.com/v${SOLANA_VERSION}/install)"
    export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
else
    CURRENT_VERSION=$(solana --version | awk '{print $2}')
    print_success "Solana ${CURRENT_VERSION} is already installed"
fi

# Step 3: Install/Update Anchor
print_status "Setting up Anchor..."

if ! command_exists anchor; then
    print_status "Installing Anchor ${ANCHOR_VERSION}..."
    cargo install --git https://github.com/coral-xyz/anchor --tag v${ANCHOR_VERSION} anchor-cli --locked
else
    CURRENT_ANCHOR=$(anchor --version | awk '{print $2}')
    print_success "Anchor ${CURRENT_ANCHOR} is already installed"
fi

# Step 4: Configure Solana for localnet
print_status "Configuring Solana for localnet..."
solana config set --url localhost
print_success "Solana configured for localnet"

# Step 5: Check for admin keypair
print_status "Checking for admin keypair..."

ADMIN_KEYPAIR="admin-keypair.json"
if [ ! -f "$ADMIN_KEYPAIR" ]; then
    print_warning "Admin keypair not found. Generating new admin keypair..."
    solana-keygen new --outfile "$ADMIN_KEYPAIR" --no-bip39-passphrase --force
    print_success "Admin keypair generated: $(solana address -k $ADMIN_KEYPAIR)"
else
    print_success "Admin keypair found: $(solana address -k $ADMIN_KEYPAIR)"
fi

# Set as default keypair
solana config set --keypair $(pwd)/$ADMIN_KEYPAIR
print_success "Admin keypair set as default"

# Step 6: Start Solana validator
print_status "Starting Solana test validator..."

# Check if validator is already running
if pgrep -x "solana-test-validator" > /dev/null; then
    print_warning "Solana test validator is already running"
else
    print_status "Starting fresh validator..."
    # Start validator in background
    solana-test-validator --reset --quiet &
    VALIDATOR_PID=$!
    
    # Wait for validator to be ready
    print_status "Waiting for validator to be ready..."
    sleep 5
    
    # Check if validator started successfully
    if ! solana cluster-version >/dev/null 2>&1; then
        print_error "Failed to start validator"
        exit 1
    fi
    
    print_success "Validator started (PID: $VALIDATOR_PID)"
fi

# Step 7: Airdrop SOL to admin
print_status "Funding admin wallet..."
ADMIN_ADDRESS=$(solana address -k $ADMIN_KEYPAIR)
BALANCE=$(solana balance $ADMIN_ADDRESS | awk '{print $1}')

if (( $(echo "$BALANCE < 10" | bc -l) )); then
    print_status "Current balance: $BALANCE SOL. Airdropping 10 SOL..."
    solana airdrop 10 $ADMIN_ADDRESS
    sleep 2
    NEW_BALANCE=$(solana balance $ADMIN_ADDRESS | awk '{print $1}')
    print_success "Admin wallet funded. New balance: $NEW_BALANCE SOL"
else
    print_success "Admin wallet already has sufficient balance: $BALANCE SOL"
fi

# Step 8: Install dependencies
print_status "Installing project dependencies..."
npm install
print_success "Dependencies installed"

# Step 9: Build Anchor programs
print_status "Building Anchor programs..."

# Save current directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
cd "$SCRIPT_DIR/.."

if [ -f "Anchor.toml" ]; then
    print_status "Building programs with Anchor..."
    anchor build
    print_success "Programs built successfully"
else
    print_error "Anchor.toml not found. Are you in the correct directory?"
    exit 1
fi

# Step 10: Deploy programs
print_status "Deploying programs to localnet..."

# Deploy each program
for program in defai_swap defai_staking defai_estate defai_app_factory; do
    print_status "Deploying $program..."
    
    SO_FILE="target/deploy/${program}.so"
    KEYPAIR_FILE="target/deploy/${program}-keypair.json"
    
    if [ -f "$SO_FILE" ] && [ -f "$KEYPAIR_FILE" ]; then
        PROGRAM_ID=$(solana address -k $KEYPAIR_FILE)
        
        # Check if already deployed
        if solana program show $PROGRAM_ID >/dev/null 2>&1; then
            print_warning "$program already deployed at $PROGRAM_ID"
        else
            solana program deploy $SO_FILE --program-id $KEYPAIR_FILE
            print_success "$program deployed at $PROGRAM_ID"
        fi
    else
        print_error "Build files not found for $program"
    fi
done

# Step 11: Update program IDs
print_status "Updating program IDs throughout the codebase..."
node scripts/fix-program-ids.js
print_success "Program IDs updated"

# Step 12: Initialize programs
print_status "Initializing programs..."
npm run init
INIT_EXIT_CODE=$?

if [ $INIT_EXIT_CODE -eq 0 ]; then
    print_success "Programs initialized successfully"
else
    print_warning "Some programs may have failed to initialize. This is normal if they were already initialized."
fi

# Step 13: Run initial tests
print_status "Running initial test suite..."
npm run test:run
TEST_EXIT_CODE=$?

if [ $TEST_EXIT_CODE -eq 0 ]; then
    print_success "All tests passed!"
else
    print_warning "Some tests failed. Check the output above for details."
fi

# Final summary
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║              Setup Complete! 🎉                      ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "1. Run the frontend: ${YELLOW}npm run dev${NC}"
echo "2. Visit: ${YELLOW}http://localhost:3002${NC}"
echo "3. Connect your wallet using the admin keypair"
echo "4. Run security tests from the UI or CLI"
echo ""
echo -e "${BLUE}Useful commands:${NC}"
echo "- Run tests: ${YELLOW}npm run test:run${NC}"
echo "- Run audit: ${YELLOW}npm run audit${NC}"
echo "- View TODOs: ${YELLOW}npm run todo${NC}"
echo "- Fix program IDs: ${YELLOW}npm run fix:ids${NC}"
echo ""
echo -e "${BLUE}Admin wallet:${NC}"
echo "- Address: ${YELLOW}$ADMIN_ADDRESS${NC}"
echo "- Balance: ${YELLOW}$(solana balance $ADMIN_ADDRESS)${NC}"
echo "- Keypair: ${YELLOW}$(pwd)/$ADMIN_KEYPAIR${NC}"
echo ""

# Save setup info
SETUP_INFO="setup-info.json"
cat > $SETUP_INFO << EOF
{
  "setupDate": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "adminWallet": "$ADMIN_ADDRESS",
  "adminKeypair": "$(pwd)/$ADMIN_KEYPAIR",
  "solanaVersion": "$(solana --version | awk '{print $2}')",
  "anchorVersion": "$(anchor --version | awk '{print $2}')",
  "nodeVersion": "$(node --version)",
  "programs": {
    "swap": "$(solana address -k target/deploy/defai_swap-keypair.json 2>/dev/null || echo 'not deployed')",
    "staking": "$(solana address -k target/deploy/defai_staking-keypair.json 2>/dev/null || echo 'not deployed')",
    "estate": "$(solana address -k target/deploy/defai_estate-keypair.json 2>/dev/null || echo 'not deployed')",
    "appFactory": "$(solana address -k target/deploy/defai_app_factory-keypair.json 2>/dev/null || echo 'not deployed')"
  }
}
EOF

print_success "Setup information saved to: $SETUP_INFO"

# Cleanup function for validator
cleanup() {
    if [ ! -z "$VALIDATOR_PID" ]; then
        print_warning "Stopping validator (PID: $VALIDATOR_PID)..."
        kill $VALIDATOR_PID 2>/dev/null || true
    fi
}

# Only register cleanup if we started the validator
if [ ! -z "$VALIDATOR_PID" ]; then
    trap cleanup EXIT
    print_warning "Note: Validator is running in background. It will stop when this script exits."
    print_warning "To keep it running, start a new terminal and run: solana-test-validator"
fi 