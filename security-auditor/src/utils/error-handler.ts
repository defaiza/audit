import { toast } from 'react-hot-toast';

export interface ErrorDetails {
  code: string;
  message: string;
  details?: string;
  suggestions: string[];
  recoveryAction?: () => void;
}

export class ErrorHandler {
  private static readonly ERROR_MAP: Record<string, ErrorDetails> = {
    // Wallet errors
    'WALLET_NOT_CONNECTED': {
      code: 'WALLET_NOT_CONNECTED',
      message: 'Wallet not connected',
      details: 'Please connect your wallet to continue',
      suggestions: [
        'Click the "Select Wallet" button in the top right',
        'Make sure you have a Solana wallet extension installed (Phantom, Solflare, etc.)',
        'Check that your wallet is unlocked'
      ]
    },
    'WRONG_WALLET': {
      code: 'WRONG_WALLET',
      message: 'Wrong wallet connected',
      details: 'This operation requires the admin wallet',
      suggestions: [
        'Switch to the admin wallet in your wallet extension',
        'The admin wallet should match the one used during deployment',
        'Check SETUP_GUIDE.md for admin wallet setup instructions'
      ]
    },
    'INSUFFICIENT_BALANCE': {
      code: 'INSUFFICIENT_BALANCE',
      message: 'Insufficient SOL balance',
      details: 'Your wallet does not have enough SOL for this transaction',
      suggestions: [
        'For localnet: Run "solana airdrop 2" to get test SOL',
        'For devnet: Use the Solana faucet at https://faucet.solana.com',
        'Check your balance with "solana balance"'
      ]
    },

    // Program errors
    'PROGRAM_NOT_DEPLOYED': {
      code: 'PROGRAM_NOT_DEPLOYED',
      message: 'Program not deployed',
      details: 'One or more programs are not deployed to the cluster',
      suggestions: [
        'Run "npm run deploy" to deploy all programs',
        'Make sure you\'re connected to the correct cluster',
        'Check if the program IDs in your .env match the deployed programs'
      ]
    },
    'PROGRAM_NOT_INITIALIZED': {
      code: 'PROGRAM_NOT_INITIALIZED',
      message: 'Program not initialized',
      details: 'The program needs to be initialized before use',
      suggestions: [
        'Click the "Initialize" button for each program',
        'Make sure you\'re using the admin wallet',
        'Programs must be deployed before initialization'
      ]
    },
    'ACCOUNT_NOT_FOUND': {
      code: 'ACCOUNT_NOT_FOUND',
      message: 'Account not found',
      details: 'The required account does not exist on-chain',
      suggestions: [
        'Make sure the program is initialized',
        'Check if you\'re connected to the correct cluster',
        'Try refreshing the page to sync with the latest state'
      ]
    },

    // Transaction errors
    'TRANSACTION_FAILED': {
      code: 'TRANSACTION_FAILED',
      message: 'Transaction failed',
      details: 'The transaction was rejected by the network',
      suggestions: [
        'Check the transaction logs for more details',
        'Make sure you have enough SOL for fees',
        'Try increasing the priority fee in your wallet',
        'The program state might have changed - refresh and try again'
      ]
    },
    'SIMULATION_FAILED': {
      code: 'SIMULATION_FAILED',
      message: 'Transaction simulation failed',
      details: 'The transaction would fail if submitted',
      suggestions: [
        'Check that all required accounts exist',
        'Verify you have the correct permissions',
        'Make sure the program state allows this operation',
        'Review the error logs for specific constraints that failed'
      ]
    },
    'TIMEOUT': {
      code: 'TIMEOUT',
      message: 'Operation timed out',
      details: 'The operation took too long to complete',
      suggestions: [
        'Check your network connection',
        'The RPC endpoint might be overloaded - try again',
        'For localnet: Make sure the validator is running',
        'Consider switching to a different RPC endpoint'
      ]
    },

    // Validator errors
    'VALIDATOR_NOT_RUNNING': {
      code: 'VALIDATOR_NOT_RUNNING',
      message: 'Local validator not running',
      details: 'Cannot connect to the local Solana validator',
      suggestions: [
        'Run "npm run validator" to start the local validator',
        'Or use "npm run setup" for complete setup',
        'Check if port 8899 is already in use',
        'Make sure solana-test-validator is installed'
      ]
    },

    // Setup errors
    'ANCHOR_NOT_FOUND': {
      code: 'ANCHOR_NOT_FOUND',
      message: 'Anchor not found',
      details: 'The Anchor framework is not installed',
      suggestions: [
        'Run "npm run setup" for automatic installation',
        'Or install manually: "cargo install --git https://github.com/coral-xyz/anchor avm --force"',
        'Then run: "avm install 0.30.1 && avm use 0.30.1"'
      ]
    },
    'RUST_NOT_FOUND': {
      code: 'RUST_NOT_FOUND',
      message: 'Rust not installed',
      details: 'Rust is required for building Solana programs',
      suggestions: [
        'Install Rust from https://rustup.rs',
        'Run: "curl --proto \'=https\' --tlsv1.2 -sSf https://sh.rustup.rs | sh"',
        'After installation, restart your terminal'
      ]
    }
  };

  static getErrorDetails(error: any): ErrorDetails {
    // Check for known error codes
    const errorCode = this.extractErrorCode(error);
    if (errorCode && this.ERROR_MAP[errorCode]) {
      return this.ERROR_MAP[errorCode];
    }

    // Check error message patterns
    const errorMessage = error?.message || error?.toString() || '';
    
    // Wallet errors
    if (errorMessage.includes('Wallet not connected')) {
      return this.ERROR_MAP['WALLET_NOT_CONNECTED'];
    }
    if (errorMessage.includes('insufficient funds') || errorMessage.includes('insufficient lamports')) {
      return this.ERROR_MAP['INSUFFICIENT_BALANCE'];
    }
    
    // Program errors
    if (errorMessage.includes('AccountNotFound') || errorMessage.includes('account not found')) {
      return this.ERROR_MAP['ACCOUNT_NOT_FOUND'];
    }
    if (errorMessage.includes('Program failed') || errorMessage.includes('InstructionError')) {
      return this.ERROR_MAP['TRANSACTION_FAILED'];
    }
    if (errorMessage.includes('simulation failed')) {
      return this.ERROR_MAP['SIMULATION_FAILED'];
    }
    
    // Network errors
    if (errorMessage.includes('Failed to fetch') || errorMessage.includes('ECONNREFUSED')) {
      return this.ERROR_MAP['VALIDATOR_NOT_RUNNING'];
    }
    if (errorMessage.includes('timeout') || errorMessage.includes('Timeout')) {
      return this.ERROR_MAP['TIMEOUT'];
    }

    // Default error
    return {
      code: 'UNKNOWN_ERROR',
      message: 'An unexpected error occurred',
      details: errorMessage,
      suggestions: [
        'Check the browser console for more details',
        'Try refreshing the page',
        'Make sure you\'re connected to the correct cluster',
        'Contact support if the issue persists'
      ]
    };
  }

  static extractErrorCode(error: any): string | null {
    if (error?.code) return error.code;
    if (error?.error?.code) return error.error.code;
    if (error?.data?.code) return error.data.code;
    return null;
  }

  static async handle(error: any, context?: string): Promise<void> {
    console.error(`Error ${context ? `in ${context}` : ''}:`, error);
    
    const errorDetails = this.getErrorDetails(error);
    const fullMessage = context 
      ? `${context}: ${errorDetails.message}`
      : errorDetails.message;

    // Show error toast
    toast.error(fullMessage, {
      duration: 6000,
      style: {
        maxWidth: '500px'
      }
    });

    // Log detailed error info
    console.group('Error Details');
    console.error('Code:', errorDetails.code);
    console.error('Message:', errorDetails.message);
    if (errorDetails.details) {
      console.error('Details:', errorDetails.details);
    }
    console.group('Suggestions:');
    errorDetails.suggestions.forEach((suggestion, index) => {
      console.log(`${index + 1}. ${suggestion}`);
    });
    console.groupEnd();
    console.groupEnd();
  }

  static showErrorModal(error: any, context?: string): ErrorDetails {
    const errorDetails = this.getErrorDetails(error);
    
    // This returns the error details so components can show them in a modal
    return {
      ...errorDetails,
      message: context ? `${context}: ${errorDetails.message}` : errorDetails.message
    };
  }

  static async wrapAsync<T>(
    operation: () => Promise<T>,
    context: string
  ): Promise<T | null> {
    try {
      return await operation();
    } catch (error) {
      await this.handle(error, context);
      return null;
    }
  }
}

// Helper function for component use
export const handleError = ErrorHandler.handle.bind(ErrorHandler);
export const wrapAsync = ErrorHandler.wrapAsync.bind(ErrorHandler);
export const showErrorModal = ErrorHandler.showErrorModal.bind(ErrorHandler); 