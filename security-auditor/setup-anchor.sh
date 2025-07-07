#!/bin/bash

echo "Setting up Anchor environment for localnet deployment..."

# Ensure we're in the right directory
cd /Users/futjr/defai_audit/audit/security-auditor

# Start local validator if not running
if ! pgrep -x "solana-test-val" > /dev/null; then
    echo "Starting local Solana validator..."
    solana-test-validator &
    sleep 5
fi

# Configure Solana CLI for localnet
solana config set --url localhost

# Airdrop SOL to default wallet
echo "Airdropping SOL to wallet..."
solana airdrop 10 || true

# Deploy programs
echo "Deploying programs to localnet..."

# Deploy each program
for program in defai_swap defai_staking defai_estate defai_app_factory; do
    echo "Deploying $program..."
    
    # First, we need to build just the individual program
    if [ -f "target/deploy/${program}.so" ]; then
        solana program deploy target/deploy/${program}.so \
            --program-id target/deploy/${program}-keypair.json \
            || echo "Failed to deploy $program"
    else
        echo "Warning: ${program}.so not found. Run 'anchor build' first."
    fi
done

echo "Setup complete!"
echo "You can now run 'anchor deploy' to deploy the programs."