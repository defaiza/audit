#!/bin/bash

echo "Building DeFAI programs for localnet..."

# Set environment
export RUST_BACKTRACE=1

# Build with Anchor
echo "Running anchor build..."
anchor build --skip-lint

# Check if build was successful
if [ -d "target/deploy" ]; then
    echo "Build completed. Checking for compiled programs..."
    ls -la target/deploy/
else
    echo "Build failed or target/deploy not created"
fi

echo "Done!"