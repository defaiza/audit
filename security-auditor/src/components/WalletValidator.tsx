import { useWallet } from '@solana/wallet-adapter-react';
import { useEffect, useState } from 'react';

const ADMIN_WALLET_PUBKEY = '4efsLapeRBz4pnqey6vBUECUSD6HmDie4pGzUxhnW1aZ';

interface WalletValidatorProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  onValidationChange?: (isValid: boolean) => void;
}

export function WalletValidator({ children, requireAdmin = true, onValidationChange }: WalletValidatorProps) {
  const wallet = useWallet();
  const [isValidWallet, setIsValidWallet] = useState(false);
  const [showImportGuide, setShowImportGuide] = useState(false);

  useEffect(() => {
    const isAdmin = wallet.publicKey?.toBase58() === ADMIN_WALLET_PUBKEY;
    const isValid = !requireAdmin || isAdmin;
    
    setIsValidWallet(isValid);
    onValidationChange?.(isValid);
  }, [wallet.publicKey, requireAdmin, onValidationChange]);

  if (!wallet.connected) {
    return (
      <div className="bg-yellow-900 bg-opacity-20 border border-yellow-700 rounded-lg p-6">
        <h3 className="text-yellow-400 font-semibold mb-2">🔌 Wallet Not Connected</h3>
        <p className="text-yellow-300 text-sm">
          Please connect your wallet to use the security auditor.
        </p>
      </div>
    );
  }

  if (requireAdmin && !isValidWallet) {
    return (
      <div className="bg-red-900 bg-opacity-20 border border-red-700 rounded-lg p-6">
        <h3 className="text-red-400 font-semibold mb-2">🚫 Admin Wallet Required</h3>
        <p className="text-red-300 text-sm mb-4">
          The security auditor requires the admin wallet for initialization and testing.
        </p>
        <div className="space-y-2 text-sm">
          <p className="text-gray-400">
            Current wallet: <span className="font-mono text-xs">{wallet.publicKey?.toBase58()}</span>
          </p>
          <p className="text-gray-400">
            Required wallet: <span className="font-mono text-xs">{ADMIN_WALLET_PUBKEY}</span>
          </p>
        </div>
        
        <button
          onClick={() => setShowImportGuide(!showImportGuide)}
          className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm transition-colors"
        >
          {showImportGuide ? 'Hide' : 'Show'} Import Instructions
        </button>

        {showImportGuide && (
          <div className="mt-4 p-4 bg-gray-800 rounded">
            <h4 className="text-white font-semibold mb-2">📝 How to Import Admin Wallet:</h4>
            <ol className="list-decimal list-inside space-y-2 text-gray-300 text-sm">
              <li>Open the <code className="bg-gray-700 px-1 rounded">admin-keypair.json</code> file in the project root</li>
              <li>Copy the array of numbers (this is your private key)</li>
              <li>In Phantom wallet:
                <ul className="list-disc list-inside ml-4 mt-1">
                  <li>Click the menu (≡) → Add/Connect Wallet</li>
                  <li>Select &quot;Import Private Key&quot;</li>
                  <li>Paste the private key array</li>
                  <li>Name it &quot;DeFAI Admin&quot;</li>
                </ul>
              </li>
              <li>Switch to the DeFAI Admin wallet</li>
              <li>Refresh this page</li>
            </ol>
            
            <div className="mt-4 p-3 bg-yellow-900 bg-opacity-30 rounded">
              <p className="text-yellow-400 text-xs font-semibold">⚠️ Security Note:</p>
              <p className="text-yellow-300 text-xs mt-1">
                Only use the admin wallet on localnet/devnet. Never share or use production keys in test environments.
              </p>
            </div>
          </div>
        )}
      </div>
    );
  }

  return <>{children}</>;
}

export function useWalletValidation(requireAdmin = true): {
  isValid: boolean;
  isAdmin: boolean;
  walletAddress: string | null;
} {
  const wallet = useWallet();
  const isAdmin = wallet.publicKey?.toBase58() === ADMIN_WALLET_PUBKEY;
  const isValid = wallet.connected && (!requireAdmin || isAdmin);

  return {
    isValid,
    isAdmin,
    walletAddress: wallet.publicKey?.toBase58() || null
  };
} 