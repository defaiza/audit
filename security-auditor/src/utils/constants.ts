export const PROGRAMS = {
  SWAP: {
    name: 'DeFAI Swap',
    programId: '2rpNRpFnZEbb9Xoonieg7THkKnYEQhZoSK8bKNtVaVLS',
    readiness: 9.5,
    status: 'Ready',
    features: ['Token Swap', 'NFT Exchange', 'Vesting', 'VRF Randomness']
  },
  STAKING: {
    name: 'DeFAI Staking',
    programId: 'CyYfX3MjkuQBTpD8N3KLXBAr8Nik89f63FZ3jFVSMd6s',
    readiness: 9.5,
    status: 'Ready',
    features: ['Tiered Staking', 'Compound Rewards', 'APY Tiers', 'Escrow']
  },
  ESTATE: {
    name: 'DeFAI Estate',
    programId: 'HYJe4U2DToJCjb5T8tysN4784twLUk48dUjPGD7dKYut',
    readiness: 9.5,
    status: 'Ready',
    features: ['Digital Estate', 'Inheritance', 'Multi-sig', 'AI Trading']
  },
  APP_FACTORY: {
    name: 'DeFAI App Factory',
    programId: 'AzcDoYYY1cHCd3faCKd8tG76ESUnuRz8jVBXEcxFwznQ',
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