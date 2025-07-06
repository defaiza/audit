export const PROGRAMS = {
  SWAP: {
    name: 'DeFAI Swap',
    programId: 'SwapWR2cjuCAM7A9tQkqCh7MiKaeYr5rGGQFqnMVjfP',
    readiness: 9.5,
    status: 'Ready',
    features: ['Token Swap', 'NFT Exchange', 'Vesting', 'VRF Randomness']
  },
  STAKING: {
    name: 'DeFAI Staking',
    programId: 'StakfVMEW5hqTq7SYe5qFBJrX4cxa9NNmqWXjFuqFKy',
    readiness: 9.5,
    status: 'Ready',
    features: ['Tiered Staking', 'Compound Rewards', 'APY Tiers', 'Escrow']
  },
  ESTATE: {
    name: 'DeFAI Estate',
    programId: 'EstateVs1eKrmwRrmAWfW8KrZBFqSmFLQhcbDbLQnc7y',
    readiness: 9.5,
    status: 'Ready',
    features: ['Digital Estate', 'Inheritance', 'Multi-sig', 'AI Trading']
  },
  APP_FACTORY: {
    name: 'DeFAI App Factory',
    programId: 'FactHVn6j9XTSzg9RXgGMXGcRMyxyDXJjHP9AkhtDYfJ',
    readiness: 7.0,
    status: 'Needs Testing',
    features: ['App Registration', 'SFT Creation', 'Monetization', 'Usage Tracking']
  }
}

export const SECURITY_CHECKS = [
  'Access Control',
  'Input Validation',
  'Overflow Protection',
  'Reentrancy Guards',
  'Admin Timelocks',
  'Event Emissions',
  'Error Handling',
  'State Consistency',
  'PDA Derivation',
  'Token Account Validation'
]

export const TEST_SCENARIOS = {
  SWAP: [
    'Normal Swap',
    'Swap with Vesting',
    'Swap with Referral',
    'Invalid Amount',
    'Unauthorized Access',
    'Tax Calculation',
    'VRF Integration'
  ],
  STAKING: [
    'Stake Tokens',
    'Claim Rewards',
    'Compound Staking',
    'Unstake Early',
    'Tier Transitions',
    'Admin Functions',
    'Overflow Scenarios'
  ],
  ESTATE: [
    'Create Estate',
    'Add Beneficiary',
    'Execute Inheritance',
    'Multi-sig Operations',
    'AI Trading Toggle',
    'Emergency Recovery',
    'Access Control'
  ],
  APP_FACTORY: [
    'Register App',
    'Purchase App',
    'Track Usage',
    'Creator Withdrawal',
    'NFT Metadata',
    'Price Updates',
    'Admin Controls'
  ]
}