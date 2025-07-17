export interface TestMetadata {
  id: string;
  name: string;
  category: string;
  isImplemented: boolean;
  implementationStatus: 'real' | 'partial' | 'placeholder';
  confidence: number; // 0-100, how confident we are in the test
  notes?: string;
  vulnerabilityTypes: string[];
}

export const TEST_METADATA: Record<string, TestMetadata> = {
  // Access Control Tests
  'unauthorized_admin': {
    id: 'unauthorized_admin',
    name: 'Unauthorized Admin Operations',
    category: 'access_control',
    isImplemented: true,
    implementationStatus: 'real',
    confidence: 95,
    notes: 'Fully implemented with transaction simulation',
    vulnerabilityTypes: ['access_control', 'privilege_escalation']
  },
  'privilege_escalation': {
    id: 'privilege_escalation',
    name: 'Privilege Escalation',
    category: 'access_control',
    isImplemented: true,
    implementationStatus: 'real',
    confidence: 90,
    notes: 'Real implementation using fake authority accounts',
    vulnerabilityTypes: ['access_control', 'authorization']
  },
  
  // Input Validation Tests
  'zero_amount_attack': {
    id: 'zero_amount_attack',
    name: 'Zero Amount Attack',
    category: 'validation',
    isImplemented: true,
    implementationStatus: 'real',
    confidence: 100,
    notes: 'Fully tests zero amount handling',
    vulnerabilityTypes: ['input_validation', 'logic']
  },
  'negative_amount_attack': {
    id: 'negative_amount_attack',
    name: 'Negative Amount Attack',
    category: 'validation',
    isImplemented: true,
    implementationStatus: 'partial',
    confidence: 70,
    notes: 'Tests with max values due to unsigned int limitations',
    vulnerabilityTypes: ['input_validation', 'overflow']
  },
  'overflow_attack': {
    id: 'overflow_attack',
    name: 'Integer Overflow Attack',
    category: 'overflow',
    isImplemented: true,
    implementationStatus: 'real',
    confidence: 95,
    notes: 'Real overflow testing with u64::MAX values',
    vulnerabilityTypes: ['overflow', 'arithmetic']
  },
  
  // DoS Tests
  'dos_large_data': {
    id: 'dos_large_data',
    name: 'DoS with Large Data',
    category: 'dos',
    isImplemented: true,
    implementationStatus: 'real',
    confidence: 85,
    notes: 'Tests with 10KB payloads',
    vulnerabilityTypes: ['dos', 'resource_exhaustion']
  },
  'dos_repeated_calls': {
    id: 'dos_repeated_calls',
    name: 'DoS with Repeated Calls',
    category: 'dos',
    isImplemented: true,
    implementationStatus: 'partial',
    confidence: 60,
    notes: 'Limited by local validator constraints',
    vulnerabilityTypes: ['dos', 'rate_limiting']
  },
  
  // Reentrancy Tests
  'reentrancy_attack': {
    id: 'reentrancy_attack',
    name: 'Reentrancy Attack',
    category: 'reentrancy',
    isImplemented: true,
    implementationStatus: 'partial',
    confidence: 50,
    notes: 'Simulated due to Solana\'s reentrancy prevention',
    vulnerabilityTypes: ['reentrancy', 'state_manipulation']
  },
  
  // Oracle Tests
  'oracle_manipulation': {
    id: 'oracle_manipulation',
    name: 'Oracle Price Manipulation',
    category: 'oracle',
    isImplemented: true,
    implementationStatus: 'placeholder',
    confidence: 20,
    notes: 'Placeholder - no real oracle integration',
    vulnerabilityTypes: ['oracle', 'price_manipulation']
  },
  'stale_oracle_data': {
    id: 'stale_oracle_data',
    name: 'Stale Oracle Data',
    category: 'oracle',
    isImplemented: false,
    implementationStatus: 'placeholder',
    confidence: 0,
    notes: 'Not implemented - requires oracle',
    vulnerabilityTypes: ['oracle', 'data_freshness']
  },
  
  // Logic Tests
  'logic_bypass': {
    id: 'logic_bypass',
    name: 'Business Logic Bypass',
    category: 'logic',
    isImplemented: true,
    implementationStatus: 'real',
    confidence: 80,
    notes: 'Tests various logic bypass scenarios',
    vulnerabilityTypes: ['logic', 'validation']
  },
  'state_manipulation': {
    id: 'state_manipulation',
    name: 'State Manipulation',
    category: 'logic',
    isImplemented: true,
    implementationStatus: 'real',
    confidence: 85,
    notes: 'Real state manipulation attempts',
    vulnerabilityTypes: ['state', 'consistency']
  },
  
  // Cross-Program Tests
  'cross_program_invocation': {
    id: 'cross_program_invocation',
    name: 'Malicious Cross-Program Invocation',
    category: 'cross_program',
    isImplemented: true,
    implementationStatus: 'partial',
    confidence: 65,
    notes: 'Limited by program isolation',
    vulnerabilityTypes: ['cpi', 'program_interaction']
  },
  
  // Flash Loan Tests
  'flash_loan_attack': {
    id: 'flash_loan_attack',
    name: 'Flash Loan Attack',
    category: 'defi',
    isImplemented: false,
    implementationStatus: 'placeholder',
    confidence: 0,
    notes: 'Not implemented - requires flash loan provider',
    vulnerabilityTypes: ['flash_loan', 'liquidity']
  },
  
  // Double Spending Tests
  'double_spending': {
    id: 'double_spending',
    name: 'Double Spending Attack',
    category: 'transaction',
    isImplemented: true,
    implementationStatus: 'real',
    confidence: 90,
    notes: 'Real double-spend attempts with parallel transactions',
    vulnerabilityTypes: ['double_spending', 'transaction_ordering']
  }
};

export function getTestImplementationStatus(testId: string): TestMetadata | undefined {
  return TEST_METADATA[testId];
}

export function getImplementationStats(): {
  total: number;
  real: number;
  partial: number;
  placeholder: number;
  notImplemented: number;
  averageConfidence: number;
} {
  const tests = Object.values(TEST_METADATA);
  const total = tests.length;
  
  const real = tests.filter(t => t.implementationStatus === 'real').length;
  const partial = tests.filter(t => t.implementationStatus === 'partial').length;
  const placeholder = tests.filter(t => t.implementationStatus === 'placeholder').length;
  const notImplemented = tests.filter(t => !t.isImplemented).length;
  
  const implementedTests = tests.filter(t => t.isImplemented);
  const averageConfidence = implementedTests.length > 0
    ? implementedTests.reduce((sum, t) => sum + t.confidence, 0) / implementedTests.length
    : 0;
  
  return {
    total,
    real,
    partial,
    placeholder,
    notImplemented,
    averageConfidence
  };
}

export function formatImplementationStatus(status: TestMetadata['implementationStatus']): {
  label: string;
  color: string;
  icon: string;
} {
  switch (status) {
    case 'real':
      return {
        label: 'Real Implementation',
        color: 'text-green-400 bg-green-900',
        icon: '✅'
      };
    case 'partial':
      return {
        label: 'Partial Implementation',
        color: 'text-yellow-400 bg-yellow-900',
        icon: '⚠️'
      };
    case 'placeholder':
      return {
        label: 'Placeholder',
        color: 'text-red-400 bg-red-900',
        icon: '🔴'
      };
  }
} 