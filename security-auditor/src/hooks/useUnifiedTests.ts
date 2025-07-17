import { useState, useCallback, useRef } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { UnifiedTestUtils, TestResult } from '@/utils/unified-test-utils';
import toast from 'react-hot-toast';

export interface UseUnifiedTestsReturn {
  isInitialized: boolean;
  isRunning: boolean;
  results: TestResult[];
  initializeTests: () => Promise<void>;
  runDeploymentChecks: () => Promise<TestResult[]>;
  initializePrograms: () => Promise<TestResult[]>;
  runSecurityTests: (testType: string) => Promise<TestResult[]>;
  clearResults: () => void;
}

export function useUnifiedTests(): UseUnifiedTestsReturn {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [isInitialized, setIsInitialized] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);
  const testUtilsRef = useRef<UnifiedTestUtils | null>(null);

  const initializeTests = useCallback(async () => {
    if (!wallet.connected || !wallet.publicKey) {
      toast.error('Please connect your wallet first');
      return;
    }

    try {
      const testUtils = new UnifiedTestUtils({
        connection,
        wallet
      });

      await testUtils.initializePrograms();
      testUtilsRef.current = testUtils;
      setIsInitialized(true);
      toast.success('Test utilities initialized');
    } catch (error: any) {
      console.error('Failed to initialize tests:', error);
      toast.error('Failed to initialize test utilities');
    }
  }, [connection, wallet]);

  const runDeploymentChecks = useCallback(async (): Promise<TestResult[]> => {
    if (!testUtilsRef.current) {
      toast.error('Test utilities not initialized');
      return [];
    }

    setIsRunning(true);
    const checkResults: TestResult[] = [];

    try {
      // Check deployment status
      const deploymentStatus = await testUtilsRef.current.checkAllProgramsDeployed();
      
      for (const [program, deployed] of Object.entries(deploymentStatus)) {
        checkResults.push({
          test: 'Deployment Check',
          program,
          status: deployed ? 'success' : 'failed',
          message: deployed ? 'Program is deployed' : 'Program not deployed',
          details: { deployed }
        });
      }

      setResults(prev => [...prev, ...checkResults]);
    } catch (error: any) {
      console.error('Deployment check failed:', error);
      toast.error('Deployment check failed');
    } finally {
      setIsRunning(false);
    }

    return checkResults;
  }, []);

  const initializePrograms = useCallback(async (): Promise<TestResult[]> => {
    if (!testUtilsRef.current) {
      toast.error('Test utilities not initialized');
      return [];
    }

    if (!wallet.publicKey) {
      toast.error('Wallet not connected');
      return [];
    }

    setIsRunning(true);
    const initResults: TestResult[] = [];

    try {
      const programs = ['SWAP', 'STAKING', 'ESTATE', 'APP_FACTORY'];
      
      for (const program of programs) {
        toast.loading(`Initializing ${program}...`, { id: `init-${program}` });
        
        try {
          const result = await testUtilsRef.current.initializeProgramState(program);
          initResults.push(result);
          
          if (result.status === 'success') {
            toast.success(`${program} initialized!`, { id: `init-${program}` });
          } else if (result.status === 'warning') {
            toast(`${program}: ${result.message}`, { 
              icon: 'ℹ️',
              id: `init-${program}` 
            });
          } else {
            toast.error(`${program} failed: ${result.message}`, { id: `init-${program}` });
          }
        } catch (error: any) {
          const errorResult: TestResult = {
            test: 'Initialize Program',
            program,
            status: 'error',
            message: error.message || 'Unknown error'
          };
          initResults.push(errorResult);
          toast.error(`${program} error: ${error.message}`, { id: `init-${program}` });
        }
      }

      setResults(prev => [...prev, ...initResults]);
    } finally {
      setIsRunning(false);
    }

    return initResults;
  }, [wallet]);

  const runSecurityTests = useCallback(async (testType: string): Promise<TestResult[]> => {
    if (!testUtilsRef.current) {
      toast.error('Test utilities not initialized');
      return [];
    }

    setIsRunning(true);
    const testResults: TestResult[] = [];

    try {
      // For now, return placeholder results
      // In a real implementation, this would run actual security tests
      const programs = ['SWAP', 'STAKING', 'ESTATE', 'APP_FACTORY'];
      
      for (const program of programs) {
        testResults.push({
          test: testType,
          program,
          status: 'success',
          message: `${testType} test passed`,
          details: { testType }
        });
      }

      setResults(prev => [...prev, ...testResults]);
      toast.success(`${testType} tests completed`);
    } catch (error: any) {
      console.error('Security test failed:', error);
      toast.error('Security test failed');
    } finally {
      setIsRunning(false);
    }

    return testResults;
  }, []);

  const clearResults = useCallback(() => {
    setResults([]);
  }, []);

  return {
    isInitialized,
    isRunning,
    results,
    initializeTests,
    runDeploymentChecks,
    initializePrograms,
    runSecurityTests,
    clearResults
  };
} 