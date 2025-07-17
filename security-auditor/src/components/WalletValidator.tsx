import React, { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Keypair, PublicKey } from '@solana/web3.js';

interface WalletValidatorProps {
  onAdminKeypairLoaded?: (keypair: Keypair) => void;
}

export const WalletValidator: React.FC<WalletValidatorProps> = ({ onAdminKeypairLoaded }) => {
  const wallet = useWallet();
  const [isCheckingWallet, setIsCheckingWallet] = useState(false);
  const [adminPublicKey, setAdminPublicKey] = useState<string | null>(null);
  const [walletStatus, setWalletStatus] = useState<{
    isConnected: boolean;
    isAdmin: boolean;
    error?: string;
  }>({
    isConnected: false,
    isAdmin: false
  });
  const [showInstructions, setShowInstructions] = useState(false);

  // Try to load admin keypair from environment or file
  const loadAdminKeypair = async () => {
    try {
      // First check if we have an admin public key in env
      const adminPubkeyEnv = process.env.NEXT_PUBLIC_ADMIN_PUBKEY;
      if (adminPubkeyEnv) {
        setAdminPublicKey(adminPubkeyEnv);
        return adminPubkeyEnv;
      }

      // In browser context, we can't access the file system
      // Instead, provide instructions for the user
      return null;
    } catch (error) {
      console.error('Error loading admin keypair:', error);
      return null;
    }
  };

  const checkWalletStatus = async () => {
    setIsCheckingWallet(true);
    
    try {
      const adminPubkey = await loadAdminKeypair();
      
      if (wallet.connected && wallet.publicKey) {
        const isAdmin = adminPubkey ? 
          wallet.publicKey.toBase58() === adminPubkey : 
          false;
        
        setWalletStatus({
          isConnected: true,
          isAdmin,
          error: !isAdmin && adminPubkey ? 
            'Connected wallet is not the admin wallet' : 
            !adminPubkey ? 
            'Admin wallet not configured' : 
            undefined
        });
      } else {
        setWalletStatus({
          isConnected: false,
          isAdmin: false,
          error: 'No wallet connected'
        });
      }
    } catch (error) {
      setWalletStatus({
        isConnected: false,
        isAdmin: false,
        error: 'Error checking wallet status'
      });
    } finally {
      setIsCheckingWallet(false);
    }
  };

  useEffect(() => {
    checkWalletStatus();
  }, [wallet.connected, wallet.publicKey]);

  const getStatusIcon = () => {
    if (walletStatus.isAdmin) return '✅';
    if (walletStatus.isConnected) return '⚠️';
    return '❌';
  };

  const getStatusColor = () => {
    if (walletStatus.isAdmin) return 'text-green-400 bg-green-900';
    if (walletStatus.isConnected) return 'text-yellow-400 bg-yellow-900';
    return 'text-red-400 bg-red-900';
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-white">Wallet Status</h3>
        <button
          onClick={() => setShowInstructions(!showInstructions)}
          className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
        >
          {showInstructions ? 'Hide' : 'Show'} Setup Instructions
        </button>
      </div>

      {/* Status Display */}
      <div className={`rounded-lg p-3 ${getStatusColor()} bg-opacity-20 border ${
        walletStatus.isAdmin ? 'border-green-700' : 
        walletStatus.isConnected ? 'border-yellow-700' : 
        'border-red-700'
      }`}>
        <div className="flex items-center space-x-3">
          <span className="text-2xl">{getStatusIcon()}</span>
          <div className="flex-1">
            <p className={`font-semibold ${
              walletStatus.isAdmin ? 'text-green-400' : 
              walletStatus.isConnected ? 'text-yellow-400' : 
              'text-red-400'
            }`}>
              {walletStatus.isAdmin ? 'Admin Wallet Connected' :
               walletStatus.isConnected ? 'Non-Admin Wallet Connected' :
               'No Wallet Connected'}
            </p>
            {wallet.publicKey && (
              <p className="text-xs text-gray-300 mt-1">
                Current: {wallet.publicKey.toBase58().slice(0, 20)}...
              </p>
            )}
            {adminPublicKey && !walletStatus.isAdmin && (
              <p className="text-xs text-gray-300 mt-1">
                Expected: {adminPublicKey.slice(0, 20)}...
              </p>
            )}
            {walletStatus.error && (
              <p className="text-xs mt-1 opacity-75">{walletStatus.error}</p>
            )}
          </div>
        </div>
      </div>

      {/* Admin Wallet Setup Instructions */}
      {showInstructions && (
        <div className="mt-4 space-y-4">
          <div className="bg-blue-900 bg-opacity-20 border border-blue-700 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-blue-400 mb-2">
              🔑 Admin Wallet Setup Instructions
            </h4>
            
            <div className="space-y-3 text-xs text-blue-300">
              <div>
                <p className="font-semibold mb-1">Option 1: Import Existing Admin Keypair</p>
                <ol className="list-decimal list-inside space-y-1 ml-2">
                  <li>Locate your admin keypair file (usually at <code className="bg-gray-700 px-1 rounded">~/.config/solana/admin-keypair.json</code>)</li>
                  <li>Copy the keypair to your project: <code className="bg-gray-700 px-1 rounded block mt-1">cp ~/.config/solana/admin-keypair.json ./admin-keypair.json</code></li>
                  <li>Add to .env file: <code className="bg-gray-700 px-1 rounded block mt-1">ADMIN_KEYPAIR_PATH=./admin-keypair.json</code></li>
                  <li>Restart the application</li>
                </ol>
              </div>

              <div>
                <p className="font-semibold mb-1">Option 2: Generate New Admin Keypair</p>
                <ol className="list-decimal list-inside space-y-1 ml-2">
                  <li>Run: <code className="bg-gray-700 px-1 rounded">solana-keygen new -o admin-keypair.json</code></li>
                  <li>Fund the wallet: <code className="bg-gray-700 px-1 rounded">solana airdrop 2 --keypair admin-keypair.json</code></li>
                  <li>Set as admin in .env: <code className="bg-gray-700 px-1 rounded block mt-1">ADMIN_KEYPAIR_PATH=./admin-keypair.json</code></li>
                </ol>
              </div>

              <div>
                <p className="font-semibold mb-1">Option 3: Use Browser Wallet as Admin</p>
                <ol className="list-decimal list-inside space-y-1 ml-2">
                  <li>Connect your wallet (Phantom, Solflare, etc.)</li>
                  <li>Copy the wallet address</li>
                  <li>Add to .env: <code className="bg-gray-700 px-1 rounded block mt-1">NEXT_PUBLIC_ADMIN_PUBKEY=YourWalletAddress</code></li>
                  <li>Restart the application</li>
                </ol>
              </div>
            </div>
          </div>

          {/* Security Warning */}
          <div className="bg-red-900 bg-opacity-20 border border-red-700 rounded-lg p-3">
            <div className="flex items-start space-x-2">
              <span className="text-red-400">🔒</span>
              <div>
                <p className="text-red-400 font-semibold text-xs">Security Warning</p>
                <p className="text-red-300 text-xs mt-1">
                  Never commit your admin keypair to version control. Add <code className="bg-gray-700 px-1 rounded">admin-keypair.json</code> to your .gitignore file.
                  For production, use secure key management services.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      {!walletStatus.isAdmin && (
        <div className="mt-4 flex items-center space-x-3">
          {!wallet.connected ? (
            <button
              onClick={() => wallet.select(wallet.wallets[0]?.adapter.name || null)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
            >
              Connect Wallet
            </button>
          ) : (
            <button
              onClick={() => wallet.disconnect()}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white text-sm rounded-lg transition-colors"
            >
              Disconnect & Switch Wallet
            </button>
          )}
          
          <button
            onClick={checkWalletStatus}
            disabled={isCheckingWallet}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
          >
            {isCheckingWallet ? 'Checking...' : 'Recheck Status'}
          </button>
        </div>
      )}
    </div>
  );
}; 