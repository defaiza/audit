import { Connection, PublicKey, AccountInfo } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';

export interface AccountSnapshot {
  pubkey: string;
  lamports: number;
  owner: string;
  executable: boolean;
  rentEpoch: number;
  dataSize: number;
  dataHash: string;
  parsedData?: any;
  timestamp: Date;
}

export interface StateSnapshot {
  id: string;
  timestamp: Date;
  accounts: Map<string, AccountSnapshot>;
  metadata: {
    totalAccounts: number;
    totalLamports: bigint;
    programs: string[];
    description?: string;
  };
}

export interface StateDiff {
  added: AccountSnapshot[];
  removed: AccountSnapshot[];
  modified: ModifiedAccount[];
  summary: DiffSummary;
}

export interface ModifiedAccount {
  pubkey: string;
  before: AccountSnapshot;
  after: AccountSnapshot;
  changes: {
    lamportsChanged: boolean;
    lamportsDiff: number;
    ownerChanged: boolean;
    dataChanged: boolean;
    dataSizeDiff: number;
  };
}

export interface DiffSummary {
  accountsAdded: number;
  accountsRemoved: number;
  accountsModified: number;
  totalLamportsChange: bigint;
  suspiciousChanges: SuspiciousChange[];
}

export interface SuspiciousChange {
  type: 'large_transfer' | 'ownership_change' | 'unexpected_modification' | 'data_corruption';
  account: string;
  details: string;
  severity: 'low' | 'medium' | 'high';
}

export class StateSnapshotManager {
  private connection: Connection;
  private snapshots: Map<string, StateSnapshot>;
  private crypto: any;

  constructor(connection: Connection) {
    this.connection = connection;
    this.snapshots = new Map();
    // Use Node's crypto for hashing
    this.crypto = require('crypto');
  }

  /**
   * Capture a snapshot of account states
   */
  async captureSnapshot(
    accounts: PublicKey[],
    description?: string
  ): Promise<StateSnapshot> {
    const id = this.generateSnapshotId();
    const timestamp = new Date();
    const accountSnapshots = new Map<string, AccountSnapshot>();
    const programs = new Set<string>();
    let totalLamports = BigInt(0);

    // Fetch all account data
    const accountInfos = await this.connection.getMultipleAccountsInfo(accounts);

    for (let i = 0; i < accounts.length; i++) {
      const pubkey = accounts[i];
      const info = accountInfos[i];

      if (info) {
        const snapshot = await this.createAccountSnapshot(pubkey, info);
        accountSnapshots.set(pubkey.toBase58(), snapshot);
        programs.add(info.owner.toBase58());
        totalLamports += BigInt(info.lamports);
      }
    }

    const stateSnapshot: StateSnapshot = {
      id,
      timestamp,
      accounts: accountSnapshots,
      metadata: {
        totalAccounts: accountSnapshots.size,
        totalLamports,
        programs: Array.from(programs),
        description
      }
    };

    this.snapshots.set(id, stateSnapshot);
    return stateSnapshot;
  }

  /**
   * Capture snapshot for a program's accounts
   */
  async captureProgramSnapshot(
    program: Program,
    accountType?: string,
    description?: string
  ): Promise<StateSnapshot> {
    const accounts: PublicKey[] = [];
    
    // Get all program accounts
    const programAccounts = await this.connection.getProgramAccounts(
      program.programId,
      {
        commitment: 'confirmed'
      }
    );

    for (const { pubkey, account } of programAccounts) {
      // If accountType specified, try to decode and filter
      if (accountType) {
        try {
          const decoded = program.coder.accounts.decode(accountType, account.data);
          if (decoded) {
            accounts.push(pubkey);
          }
        } catch {
          // Not the account type we're looking for
        }
      } else {
        accounts.push(pubkey);
      }
    }

    return this.captureSnapshot(accounts, description || `Program snapshot: ${program.programId.toBase58()}`);
  }

  /**
   * Compare two snapshots
   */
  compareSnapshots(
    beforeId: string,
    afterId: string
  ): StateDiff {
    const before = this.snapshots.get(beforeId);
    const after = this.snapshots.get(afterId);

    if (!before || !after) {
      throw new Error('Snapshot not found');
    }

    const added: AccountSnapshot[] = [];
    const removed: AccountSnapshot[] = [];
    const modified: ModifiedAccount[] = [];
    const suspiciousChanges: SuspiciousChange[] = [];

    // Find added and modified accounts
    Array.from(after.accounts).forEach(([pubkey, afterAccount]) => {
      const beforeAccount = before.accounts.get(pubkey);
      
      if (!beforeAccount) {
        added.push(afterAccount);
      } else if (this.hasAccountChanged(beforeAccount, afterAccount)) {
        const changes = this.analyzeAccountChanges(beforeAccount, afterAccount);
        modified.push({
          pubkey,
          before: beforeAccount,
          after: afterAccount,
          changes
        });

        // Check for suspicious changes
        const suspicious = this.detectSuspiciousChanges(beforeAccount, afterAccount, changes);
        suspiciousChanges.push(...suspicious);
      }
    });

    // Find removed accounts
    Array.from(before.accounts).forEach(([pubkey, beforeAccount]) => {
      if (!after.accounts.has(pubkey)) {
        removed.push(beforeAccount);
      }
    });

    // Calculate summary
    const totalLamportsChange = 
      after.metadata.totalLamports - before.metadata.totalLamports;

    return {
      added,
      removed,
      modified,
      summary: {
        accountsAdded: added.length,
        accountsRemoved: removed.length,
        accountsModified: modified.length,
        totalLamportsChange,
        suspiciousChanges
      }
    };
  }

  /**
   * Compare current state with snapshot
   */
  async compareWithCurrent(
    snapshotId: string,
    accounts?: PublicKey[]
  ): Promise<StateDiff> {
    const snapshot = this.snapshots.get(snapshotId);
    if (!snapshot) {
      throw new Error('Snapshot not found');
    }

    // If no accounts specified, use all accounts from snapshot
    if (!accounts) {
      accounts = Array.from(snapshot.accounts.keys()).map(
        key => new PublicKey(key)
      );
    }

    // Capture current state
    const currentSnapshot = await this.captureSnapshot(
      accounts,
      'Current state comparison'
    );

    return this.compareSnapshots(snapshotId, currentSnapshot.id);
  }

  /**
   * Create account snapshot
   */
  private async createAccountSnapshot(
    pubkey: PublicKey,
    info: AccountInfo<Buffer>
  ): Promise<AccountSnapshot> {
    const dataHash = this.hashAccountData(info.data);
    
    // Try to parse account data if possible
    let parsedData;
    try {
      // Attempt to decode as token account
      if (info.owner.toBase58() === anchor.utils.token.TOKEN_PROGRAM_ID.toBase58()) {
        parsedData = await this.parseTokenAccount(info);
      }
    } catch {
      // Parsing failed, continue without parsed data
    }

    return {
      pubkey: pubkey.toBase58(),
      lamports: info.lamports,
      owner: info.owner.toBase58(),
      executable: info.executable,
      rentEpoch: info.rentEpoch || 0,
      dataSize: info.data.length,
      dataHash,
      parsedData,
      timestamp: new Date()
    };
  }

  /**
   * Hash account data
   */
  private hashAccountData(data: Buffer): string {
    return this.crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Check if account has changed
   */
  private hasAccountChanged(
    before: AccountSnapshot,
    after: AccountSnapshot
  ): boolean {
    return before.lamports !== after.lamports ||
           before.owner !== after.owner ||
           before.dataHash !== after.dataHash ||
           before.dataSize !== after.dataSize;
  }

  /**
   * Analyze account changes
   */
  private analyzeAccountChanges(
    before: AccountSnapshot,
    after: AccountSnapshot
  ): ModifiedAccount['changes'] {
    return {
      lamportsChanged: before.lamports !== after.lamports,
      lamportsDiff: after.lamports - before.lamports,
      ownerChanged: before.owner !== after.owner,
      dataChanged: before.dataHash !== after.dataHash,
      dataSizeDiff: after.dataSize - before.dataSize
    };
  }

  /**
   * Detect suspicious changes
   */
  private detectSuspiciousChanges(
    before: AccountSnapshot,
    after: AccountSnapshot,
    changes: ModifiedAccount['changes']
  ): SuspiciousChange[] {
    const suspicious: SuspiciousChange[] = [];

    // Large transfer detection
    if (Math.abs(changes.lamportsDiff) > 1000000000) { // > 1 SOL
      suspicious.push({
        type: 'large_transfer',
        account: before.pubkey,
        details: `Large transfer detected: ${changes.lamportsDiff / 1e9} SOL`,
        severity: 'high'
      });
    }

    // Ownership change
    if (changes.ownerChanged) {
      suspicious.push({
        type: 'ownership_change',
        account: before.pubkey,
        details: `Owner changed from ${before.owner} to ${after.owner}`,
        severity: 'high'
      });
    }

    // Unexpected data modification
    if (changes.dataChanged && !changes.lamportsChanged) {
      suspicious.push({
        type: 'unexpected_modification',
        account: before.pubkey,
        details: 'Data modified without balance change',
        severity: 'medium'
      });
    }

    // Data size increased significantly
    if (changes.dataSizeDiff > 10000) {
      suspicious.push({
        type: 'data_corruption',
        account: before.pubkey,
        details: `Data size increased by ${changes.dataSizeDiff} bytes`,
        severity: 'medium'
      });
    }

    return suspicious;
  }

  /**
   * Parse token account
   */
  private async parseTokenAccount(info: AccountInfo<Buffer>): Promise<any> {
    // Simple token account parsing
    if (info.data.length === 165) {
      return {
        mint: new PublicKey(info.data.slice(0, 32)).toBase58(),
        owner: new PublicKey(info.data.slice(32, 64)).toBase58(),
        amount: info.data.readBigUInt64LE(64).toString()
      };
    }
    return null;
  }

  /**
   * Generate unique snapshot ID
   */
  private generateSnapshotId(): string {
    return `snapshot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Export snapshot for analysis
   */
  exportSnapshot(snapshotId: string): string {
    const snapshot = this.snapshots.get(snapshotId);
    if (!snapshot) {
      throw new Error('Snapshot not found');
    }

    return JSON.stringify({
      ...snapshot,
      accounts: Array.from(snapshot.accounts.entries())
    }, null, 2);
  }

  /**
   * Import snapshot
   */
  importSnapshot(data: string): StateSnapshot {
    const parsed = JSON.parse(data);
    const snapshot: StateSnapshot = {
      ...parsed,
      accounts: new Map(parsed.accounts),
      timestamp: new Date(parsed.timestamp)
    };

    this.snapshots.set(snapshot.id, snapshot);
    return snapshot;
  }

  /**
   * Generate diff report
   */
  generateDiffReport(diff: StateDiff): string {
    let report = `# State Diff Report

## Summary
- Accounts Added: ${diff.summary.accountsAdded}
- Accounts Removed: ${diff.summary.accountsRemoved}
- Accounts Modified: ${diff.summary.accountsModified}
- Total Lamports Change: ${diff.summary.totalLamportsChange} (${Number(diff.summary.totalLamportsChange) / 1e9} SOL)

`;

    if (diff.summary.suspiciousChanges.length > 0) {
      report += `## ⚠️ Suspicious Changes Detected\n\n`;
      for (const change of diff.summary.suspiciousChanges) {
        report += `### ${change.type} (${change.severity})\n`;
        report += `- Account: ${change.account}\n`;
        report += `- Details: ${change.details}\n\n`;
      }
    }

    if (diff.added.length > 0) {
      report += `## New Accounts\n`;
      for (const account of diff.added.slice(0, 10)) {
        report += `- ${account.pubkey} (${account.lamports / 1e9} SOL)\n`;
      }
      if (diff.added.length > 10) {
        report += `- ... and ${diff.added.length - 10} more\n`;
      }
      report += '\n';
    }

    if (diff.modified.length > 0) {
      report += `## Modified Accounts\n`;
      for (const mod of diff.modified.slice(0, 10)) {
        report += `### ${mod.pubkey}\n`;
        if (mod.changes.lamportsChanged) {
          report += `- Lamports: ${mod.changes.lamportsDiff > 0 ? '+' : ''}${mod.changes.lamportsDiff / 1e9} SOL\n`;
        }
        if (mod.changes.ownerChanged) {
          report += `- Owner changed: ${mod.before.owner} → ${mod.after.owner}\n`;
        }
        if (mod.changes.dataChanged) {
          report += `- Data modified (size diff: ${mod.changes.dataSizeDiff} bytes)\n`;
        }
      }
      if (diff.modified.length > 10) {
        report += `\n... and ${diff.modified.length - 10} more modifications\n`;
      }
    }

    return report;
  }

  /**
   * Clear old snapshots
   */
  cleanupSnapshots(keepLast: number = 10): void {
    const sortedSnapshots = Array.from(this.snapshots.entries())
      .sort((a, b) => b[1].timestamp.getTime() - a[1].timestamp.getTime());

    if (sortedSnapshots.length > keepLast) {
      const toRemove = sortedSnapshots.slice(keepLast);
      for (const [id] of toRemove) {
        this.snapshots.delete(id);
      }
    }
  }
}

// Export factory function
export const createStateSnapshotManager = (connection: Connection) => 
  new StateSnapshotManager(connection); 