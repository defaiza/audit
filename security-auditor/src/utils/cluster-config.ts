import { clusterApiUrl, Cluster } from '@solana/web3.js';

export type ClusterName = 'localnet' | 'devnet' | 'testnet' | 'mainnet-beta';

export interface ClusterConfig {
  name: ClusterName;
  endpoint: string;
  wsEndpoint?: string;
  label: string;
  isCustom?: boolean;
}

// Default cluster configurations
const CLUSTER_CONFIGS: Record<ClusterName, ClusterConfig> = {
  'localnet': {
    name: 'localnet',
    endpoint: 'http://localhost:8899',
    wsEndpoint: 'ws://localhost:8900',
    label: 'Localnet'
  },
  'devnet': {
    name: 'devnet',
    endpoint: clusterApiUrl('devnet'),
    label: 'Devnet'
  },
  'testnet': {
    name: 'testnet',
    endpoint: clusterApiUrl('testnet'),
    label: 'Testnet'
  },
  'mainnet-beta': {
    name: 'mainnet-beta',
    endpoint: clusterApiUrl('mainnet-beta'),
    label: 'Mainnet'
  }
};

export class ClusterManager {
  private static instance: ClusterManager;
  private currentCluster: ClusterConfig;

  private constructor() {
    this.currentCluster = this.loadClusterFromEnv();
  }

  static getInstance(): ClusterManager {
    if (!ClusterManager.instance) {
      ClusterManager.instance = new ClusterManager();
    }
    return ClusterManager.instance;
  }

  /**
   * Load cluster configuration from environment variables
   */
  private loadClusterFromEnv(): ClusterConfig {
    // Check for environment variables
    const envCluster = process.env.NEXT_PUBLIC_SOLANA_CLUSTER || 
                      process.env.REACT_APP_SOLANA_CLUSTER || 
                      'localnet';
    
    const envRpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 
                      process.env.REACT_APP_SOLANA_RPC_URL;
    
    const envWsUrl = process.env.NEXT_PUBLIC_SOLANA_WS_URL || 
                     process.env.REACT_APP_SOLANA_WS_URL;

    // If custom RPC URL is provided, create custom config
    if (envRpcUrl && !this.isStandardCluster(envRpcUrl)) {
      return {
        name: 'localnet', // Default to localnet for custom URLs
        endpoint: envRpcUrl,
        wsEndpoint: envWsUrl,
        label: `Custom (${new URL(envRpcUrl).hostname})`,
        isCustom: true
      };
    }

    // Use standard cluster config
    const clusterName = this.validateClusterName(envCluster);
    return CLUSTER_CONFIGS[clusterName];
  }

  /**
   * Check if URL is a standard Solana cluster
   */
  private isStandardCluster(url: string): boolean {
    return Object.values(CLUSTER_CONFIGS).some(config => 
      config.endpoint === url
    );
  }

  /**
   * Validate and normalize cluster name
   */
  private validateClusterName(name: string): ClusterName {
    const normalized = name.toLowerCase() as ClusterName;
    if (normalized in CLUSTER_CONFIGS) {
      return normalized;
    }
    console.warn(`Invalid cluster name: ${name}, defaulting to localnet`);
    return 'localnet';
  }

  /**
   * Get current cluster configuration
   */
  getCurrentCluster(): ClusterConfig {
    return this.currentCluster;
  }

  /**
   * Switch to a different cluster
   */
  setCluster(clusterName: ClusterName | ClusterConfig): void {
    if (typeof clusterName === 'string') {
      this.currentCluster = CLUSTER_CONFIGS[clusterName];
    } else {
      this.currentCluster = clusterName;
    }
    
    // Emit event for cluster change
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('cluster-changed', { 
        detail: this.currentCluster 
      }));
    }
  }

  /**
   * Get all available clusters
   */
  getAvailableClusters(): ClusterConfig[] {
    return Object.values(CLUSTER_CONFIGS);
  }

  /**
   * Get RPC endpoint for current cluster
   */
  getRpcEndpoint(): string {
    return this.currentCluster.endpoint;
  }

  /**
   * Get WebSocket endpoint for current cluster
   */
  getWsEndpoint(): string | undefined {
    return this.currentCluster.wsEndpoint;
  }

  /**
   * Check if current cluster is localnet
   */
  isLocalnet(): boolean {
    return this.currentCluster.name === 'localnet';
  }

  /**
   * Check if current cluster is mainnet
   */
  isMainnet(): boolean {
    return this.currentCluster.name === 'mainnet-beta';
  }

  /**
   * Get cluster-specific program IDs
   */
  getProgramIds(): Record<string, string> {
    // In production, you would have different program IDs per cluster
    // For now, return the same IDs for all clusters
    const baseIds = {
      SWAP: process.env.NEXT_PUBLIC_SWAP_PROGRAM_ID || '877w653ayrjqM6fT5yjCuPuTABo8h7N6ffF3es1HRrxm',
      STAKING: process.env.NEXT_PUBLIC_STAKING_PROGRAM_ID || 'CvDs2FSKiNAmtdGmY3LaVcCpqAudK3otmrG3ksmUBzpG',
      ESTATE: process.env.NEXT_PUBLIC_ESTATE_PROGRAM_ID || 'J8qubfQ5SdvYiJLo5V2mMspZp9as75RePwstVXrtJxo8',
      APP_FACTORY: process.env.NEXT_PUBLIC_APP_FACTORY_PROGRAM_ID || '4HsYtGADv25mPs1CqicceHK1BuaLhBD66ZFjZ8jnJZr3'
    };

    // Override with cluster-specific IDs if available
    if (this.currentCluster.name === 'devnet') {
      // Add devnet-specific program IDs here
    } else if (this.currentCluster.name === 'testnet') {
      // Add testnet-specific program IDs here
    } else if (this.currentCluster.name === 'mainnet-beta') {
      // Add mainnet-specific program IDs here
    }

    return baseIds;
  }

  /**
   * Get explorer URL for a transaction or address
   */
  getExplorerUrl(signature: string, type: 'tx' | 'address' = 'tx'): string {
    const baseUrl = 'https://explorer.solana.com';
    const cluster = this.currentCluster.name === 'mainnet-beta' ? '' : `?cluster=${this.currentCluster.name}`;
    return `${baseUrl}/${type}/${signature}${cluster}`;
  }
}

// Export singleton instance
export const clusterManager = ClusterManager.getInstance();

// Export helper functions
export const getCurrentCluster = () => clusterManager.getCurrentCluster();
export const getRpcEndpoint = () => clusterManager.getRpcEndpoint();
export const getWsEndpoint = () => clusterManager.getWsEndpoint();
export const getProgramIds = () => clusterManager.getProgramIds();
export const getExplorerUrl = (sig: string, type?: 'tx' | 'address') => 
  clusterManager.getExplorerUrl(sig, type); 