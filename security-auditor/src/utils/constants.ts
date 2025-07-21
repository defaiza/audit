export const PROGRAMS = {
  defaiSwap: {
    programId: '5ag9ncKTGrhDxdfvRxmSenP848kkgP6BMdaTFLfa2siT',
    name: 'DeFAI Swap',
    icon: '💱'
  },
  defaiStaking: {
    programId: 'DtTDbmQgghWJYp3F4vhaaJGyGoF86qRZh9t2kMtmPBbg',
    name: 'DeFAI Staking',
    icon: '🥩'
  },
  defaiEstate: {
    programId: 'DYXXvied9wwpDaE1NcVS56BfeQ4ZxXozft7FCLNVUG41',
    name: 'DeFAI Estate',
    icon: '🏠'
  },
  defaiAppFactory: {
    programId: '7NF6yiQeRbNpYZJzgdijQErD1WYh9mUxwN5SBDpSA6dX',
    name: 'DeFAI App Factory',
    icon: '🏭'
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