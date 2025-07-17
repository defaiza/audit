import { useState, useEffect } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { PROGRAMS } from '../utils/constants';
import * as anchor from '@coral-xyz/anchor';

export interface ProgramStatus {
  programId: string;
  name: string;
  isDeployed: boolean;
  isInitialized: boolean;
  lastChecked: Date | null;
  error?: string;
}

export interface ProgramStatusState {
  programs: Record<string, ProgramStatus>;
  isLoading: boolean;
  isAllDeployed: boolean;
  isAllInitialized: boolean;
  deployedCount: number;
  initializedCount: number;
  totalPrograms: number;
  lastRefresh: Date | null;
}

export function useProgramStatus() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [status, setStatus] = useState<ProgramStatusState>({
    programs: {},
    isLoading: false,
    isAllDeployed: false,
    isAllInitialized: false,
    deployedCount: 0,
    initializedCount: 0,
    totalPrograms: Object.keys(PROGRAMS).length,
    lastRefresh: null
  });

  const checkProgramDeployed = async (programId: string): Promise<boolean> => {
    try {
      const pubkey = new PublicKey(programId);
      const accountInfo = await connection.getAccountInfo(pubkey);
      return accountInfo !== null && accountInfo.executable;
    } catch (error) {
      console.error(`Error checking program ${programId}:`, error);
      return false;
    }
  };

  const checkProgramInitialized = async (programKey: string, programInfo: any): Promise<boolean> => {
    if (!wallet.publicKey) return false;

    try {
      const programId = new PublicKey(programInfo.programId);
      
      // Check based on program type
      switch (programKey) {
        case 'swap': {
          // Check for swap state account
          const [swapStatePda] = anchor.web3.PublicKey.findProgramAddressSync(
            [Buffer.from('swap_state')],
            programId
          );
          const account = await connection.getAccountInfo(swapStatePda);
          return account !== null;
        }
        
        case 'staking': {
          // Check for staking pool account
          const [poolPda] = anchor.web3.PublicKey.findProgramAddressSync(
            [Buffer.from('staking_pool')],
            programId
          );
          const account = await connection.getAccountInfo(poolPda);
          return account !== null;
        }
        
        case 'estate': {
          // Check for estate state account
          const [estateStatePda] = anchor.web3.PublicKey.findProgramAddressSync(
            [Buffer.from('estate_state')],
            programId
          );
          const account = await connection.getAccountInfo(estateStatePda);
          return account !== null;
        }
        
        case 'appFactory': {
          // Check for factory state account
          const [factoryStatePda] = anchor.web3.PublicKey.findProgramAddressSync(
            [Buffer.from('factory_state')],
            programId
          );
          const account = await connection.getAccountInfo(factoryStatePda);
          return account !== null;
        }
        
        default:
          return false;
      }
    } catch (error) {
      console.error(`Error checking initialization for ${programKey}:`, error);
      return false;
    }
  };

  const refreshStatus = async () => {
    setStatus(prev => ({ ...prev, isLoading: true }));

    try {
      const newPrograms: Record<string, ProgramStatus> = {};
      let deployedCount = 0;
      let initializedCount = 0;

      for (const [key, info] of Object.entries(PROGRAMS)) {
        const isDeployed = await checkProgramDeployed(info.programId);
        const isInitialized = isDeployed ? await checkProgramInitialized(key, info) : false;

        if (isDeployed) deployedCount++;
        if (isInitialized) initializedCount++;

        newPrograms[key] = {
          programId: info.programId,
          name: info.name,
          isDeployed,
          isInitialized,
          lastChecked: new Date(),
          error: !isDeployed ? 'Program not deployed' : !isInitialized ? 'Program not initialized' : undefined
        };
      }

      setStatus({
        programs: newPrograms,
        isLoading: false,
        isAllDeployed: deployedCount === Object.keys(PROGRAMS).length,
        isAllInitialized: initializedCount === Object.keys(PROGRAMS).length,
        deployedCount,
        initializedCount,
        totalPrograms: Object.keys(PROGRAMS).length,
        lastRefresh: new Date()
      });
    } catch (error) {
      console.error('Error refreshing program status:', error);
      setStatus(prev => ({ 
        ...prev, 
        isLoading: false,
        lastRefresh: new Date()
      }));
    }
  };

  // Auto-refresh on wallet connection
  useEffect(() => {
    if (wallet.publicKey && connection) {
      refreshStatus();
    }
  }, [wallet.publicKey, connection]);

  // Refresh every 30 seconds if wallet is connected
  useEffect(() => {
    if (!wallet.publicKey) return;

    const interval = setInterval(refreshStatus, 30000);
    return () => clearInterval(interval);
  }, [wallet.publicKey]);

  return {
    ...status,
    refreshStatus
  };
} 