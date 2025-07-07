import { Connection, PublicKey, Keypair, Transaction, TransactionInstruction, SystemProgram } from '@solana/web3.js'
import { Program } from '@coral-xyz/anchor'
import * as anchor from '@coral-xyz/anchor'
import { TestEnvironment } from '../test-infrastructure'

export interface AccessControlAttackResult {
  success: boolean
  type: 'unauthorized-admin' | 'privilege-escalation' | 'access-bypass' | 'role-manipulation'
  targetFunction: string
  program: string
  attackerRole: string
  requiredRole: string
  error?: string
  logs?: string[]
  computeUnits?: number
}

export class AccessControlAttackTester {
  private connection: Connection
  private environment: TestEnvironment
  private adminPubkey = new PublicKey('4efsLapeRBz4pnqey6vBUECUSD6HmDie4pGzUxhnW1aZ')

  constructor(connection: Connection, environment: TestEnvironment) {
    this.connection = connection
    this.environment = environment
  }

  /**
   * Test unauthorized admin operation access
   */
  async testUnauthorizedAdminAccess(program: Program): Promise<AccessControlAttackResult> {
    console.log(`\n🔐 Testing unauthorized admin access on ${program.programId.toBase58()}...`)
    
    try {
      // Find admin-only functions
      const adminFunction = this.findAdminFunction(program)
      if (!adminFunction) {
        return {
          success: false,
          type: 'unauthorized-admin',
          targetFunction: 'unknown',
          program: program.programId.toBase58(),
          attackerRole: 'user',
          requiredRole: 'admin',
          error: 'No admin function found'
        }
      }

      // Build transaction with non-admin attacker
      const tx = await this.buildUnauthorizedAdminTx(
        program,
        adminFunction,
        this.environment.attacker.keypair
      )

      // Simulate attack
      const simulation = await this.connection.simulateTransaction(tx)
      
      if (simulation.value.err) {
        // Good - access denied
        const errorStr = JSON.stringify(simulation.value.err)
        const accessDenied = this.isAccessDeniedError(errorStr, simulation.value.logs || [])
        
        return {
          success: false,
          type: 'unauthorized-admin',
          targetFunction: adminFunction,
          program: program.programId.toBase58(),
          attackerRole: 'user',
          requiredRole: 'admin',
          error: errorStr,
          logs: simulation.value.logs || undefined,
          computeUnits: simulation.value.unitsConsumed
        }
      }

      // If simulation passes, that's a vulnerability!
      return {
        success: true,
        type: 'unauthorized-admin',
        targetFunction: adminFunction,
        program: program.programId.toBase58(),
        attackerRole: 'user',
        requiredRole: 'admin',
        logs: simulation.value.logs || undefined,
        computeUnits: simulation.value.unitsConsumed
      }

    } catch (error: any) {
      return {
        success: false,
        type: 'unauthorized-admin',
        targetFunction: 'unknown',
        program: program.programId.toBase58(),
        attackerRole: 'user',
        requiredRole: 'admin',
        error: error.message
      }
    }
  }

  /**
   * Test privilege escalation attacks
   */
  async testPrivilegeEscalation(program: Program): Promise<AccessControlAttackResult> {
    console.log(`\n⬆️ Testing privilege escalation on ${program.programId.toBase58()}...`)
    
    try {
      // Find role-changing functions
      const roleFunction = this.findRoleFunction(program)
      if (!roleFunction) {
        return {
          success: false,
          type: 'privilege-escalation',
          targetFunction: 'unknown',
          program: program.programId.toBase58(),
          attackerRole: 'user',
          requiredRole: 'admin',
          error: 'No role management function found'
        }
      }

      // Try to escalate privileges
      const tx = await this.buildPrivilegeEscalationTx(
        program,
        roleFunction,
        this.environment.attacker.keypair
      )

      const simulation = await this.connection.simulateTransaction(tx)
      
      // Check if escalation was successful
      const escalationDetected = this.detectPrivilegeEscalation(
        simulation.value.logs || [],
        simulation.value.err
      )
      
      return {
        success: escalationDetected && !simulation.value.err,
        type: 'privilege-escalation',
        targetFunction: roleFunction,
        program: program.programId.toBase58(),
        attackerRole: 'user',
        requiredRole: 'self-elevated',
        error: simulation.value.err ? JSON.stringify(simulation.value.err) : undefined,
        logs: simulation.value.logs || undefined,
        computeUnits: simulation.value.unitsConsumed
      }

    } catch (error: any) {
      return {
        success: false,
        type: 'privilege-escalation',
        targetFunction: 'unknown',
        program: program.programId.toBase58(),
        attackerRole: 'user',
        requiredRole: 'admin',
        error: error.message
      }
    }
  }

  /**
   * Test access control bypass
   */
  async testAccessBypass(program: Program): Promise<AccessControlAttackResult> {
    console.log(`\n🚪 Testing access control bypass on ${program.programId.toBase58()}...`)
    
    try {
      // Find protected functions
      const protectedFunction = this.findProtectedFunction(program)
      if (!protectedFunction) {
        return {
          success: false,
          type: 'access-bypass',
          targetFunction: 'unknown',
          program: program.programId.toBase58(),
          attackerRole: 'unauthorized',
          requiredRole: 'authorized',
          error: 'No protected function found'
        }
      }

      // Try various bypass techniques
      const bypassResults = await this.attemptAccessBypasses(
        program,
        protectedFunction,
        this.environment.attacker.keypair
      )

      const successfulBypass = bypassResults.find(r => r.success)
      
      if (successfulBypass) {
        return {
          success: true,
          type: 'access-bypass',
          targetFunction: protectedFunction,
          program: program.programId.toBase58(),
          attackerRole: 'unauthorized',
          requiredRole: 'authorized',
          logs: successfulBypass.logs,
          computeUnits: successfulBypass.computeUnits
        }
      }

      return {
        success: false,
        type: 'access-bypass',
        targetFunction: protectedFunction,
        program: program.programId.toBase58(),
        attackerRole: 'unauthorized',
        requiredRole: 'authorized',
        error: 'All bypass attempts failed'
      }

    } catch (error: any) {
      return {
        success: false,
        type: 'access-bypass',
        targetFunction: 'unknown',
        program: program.programId.toBase58(),
        attackerRole: 'unauthorized',
        requiredRole: 'authorized',
        error: error.message
      }
    }
  }

  /**
   * Test role manipulation attacks
   */
  async testRoleManipulation(program: Program): Promise<AccessControlAttackResult> {
    console.log(`\n👤 Testing role manipulation on ${program.programId.toBase58()}...`)
    
    try {
      // Find role storage accounts
      const roleAccounts = await this.findRoleAccounts(program)
      
      if (roleAccounts.length === 0) {
        return {
          success: false,
          type: 'role-manipulation',
          targetFunction: 'role-storage',
          program: program.programId.toBase58(),
          attackerRole: 'attacker',
          requiredRole: 'admin',
          error: 'No role accounts found'
        }
      }

      // Try to directly manipulate role data
      const tx = await this.buildRoleManipulationTx(
        program,
        roleAccounts[0],
        this.environment.attacker.keypair
      )

      const simulation = await this.connection.simulateTransaction(tx)
      
      return {
        success: !simulation.value.err,
        type: 'role-manipulation',
        targetFunction: 'direct-role-modification',
        program: program.programId.toBase58(),
        attackerRole: 'attacker',
        requiredRole: 'manipulated-admin',
        error: simulation.value.err ? JSON.stringify(simulation.value.err) : undefined,
        logs: simulation.value.logs || undefined,
        computeUnits: simulation.value.unitsConsumed
      }

    } catch (error: any) {
      return {
        success: false,
        type: 'role-manipulation',
        targetFunction: 'unknown',
        program: program.programId.toBase58(),
        attackerRole: 'attacker',
        requiredRole: 'admin',
        error: error.message
      }
    }
  }

  /**
   * Find admin-only functions
   */
  private findAdminFunction(program: Program): string | null {
    const adminKeywords = ['admin', 'owner', 'authority', 'governance', 'update', 'set', 'pause']
    
    for (const instruction of program.idl.instructions) {
      // Check function name
      if (adminKeywords.some(keyword => 
        instruction.name.toLowerCase().includes(keyword)
      )) {
        return instruction.name
      }
      
      // Check for admin account requirements
      const hasAdminAccount = instruction.accounts.some(acc =>
        adminKeywords.some(keyword => acc.name.toLowerCase().includes(keyword))
      )
      if (hasAdminAccount) {
        return instruction.name
      }
    }
    
    return null
  }

  /**
   * Find role management functions
   */
  private findRoleFunction(program: Program): string | null {
    const roleKeywords = ['role', 'grant', 'revoke', 'assign', 'permission', 'access']
    
    for (const instruction of program.idl.instructions) {
      if (roleKeywords.some(keyword => 
        instruction.name.toLowerCase().includes(keyword)
      )) {
        return instruction.name
      }
    }
    
    return null
  }

  /**
   * Find protected functions
   */
  private findProtectedFunction(program: Program): string | null {
    // Look for functions with explicit access checks
    for (const instruction of program.idl.instructions) {
             // Check for signer requirements
       const hasSignerAccount = instruction.accounts.some(acc => 
         acc.name.includes('signer') || acc.name.includes('authority')
       )
      
      // Check for specific account constraints
      const hasConstraints = instruction.accounts.some(acc =>
        acc.name.includes('user') || acc.name.includes('member')
      )
      
      if (hasSignerAccount && hasConstraints) {
        return instruction.name
      }
    }
    
    return null
  }

  /**
   * Find role storage accounts
   */
  private async findRoleAccounts(program: Program): Promise<PublicKey[]> {
    const roleAccounts: PublicKey[] = []
    
    // Look for PDA accounts that might store roles
    try {
      const seeds = [Buffer.from('role'), this.environment.attacker.publicKey.toBuffer()]
      const [pda] = await PublicKey.findProgramAddress(seeds, program.programId)
      
      const accountInfo = await this.connection.getAccountInfo(pda)
      if (accountInfo) {
        roleAccounts.push(pda)
      }
    } catch (error) {
      // Continue searching
    }
    
    return roleAccounts
  }

  /**
   * Build unauthorized admin transaction
   */
  private async buildUnauthorizedAdminTx(
    program: Program,
    functionName: string,
    attacker: Keypair
  ): Promise<Transaction> {
    const tx = new Transaction()
    
    try {
      // Try to call admin function as non-admin
      const instruction = await program.methods[functionName]()
        .accounts({
          admin: attacker.publicKey, // Wrong admin!
          systemProgram: SystemProgram.programId
        })
        .instruction()
      
      tx.add(instruction)
      
    } catch (error) {
      // Fallback to raw instruction
      const data = Buffer.from([0x10]) // Admin function marker
      
      tx.add(new TransactionInstruction({
        keys: [
          {
            pubkey: attacker.publicKey,
            isSigner: true,
            isWritable: true
          },
          {
            pubkey: this.adminPubkey, // Real admin
            isSigner: false,
            isWritable: false
          }
        ],
        programId: program.programId,
        data
      }))
    }
    
    return tx
  }

  /**
   * Build privilege escalation transaction
   */
  private async buildPrivilegeEscalationTx(
    program: Program,
    functionName: string,
    attacker: Keypair
  ): Promise<Transaction> {
    const tx = new Transaction()
    
    try {
      // Try to grant ourselves admin role
      const instruction = await program.methods[functionName]({
        role: 'admin',
        user: attacker.publicKey
      })
      .accounts({
        authority: attacker.publicKey, // Self-authorization attempt
        user: attacker.publicKey,
        systemProgram: SystemProgram.programId
      })
      .instruction()
      
      tx.add(instruction)
      
    } catch (error) {
      // Raw escalation attempt
      const data = Buffer.alloc(33)
      data.writeUInt8(0x20, 0) // Role grant marker
      data.write(attacker.publicKey.toBuffer().toString('hex'), 1, 'hex')
      
      tx.add(new TransactionInstruction({
        keys: [
          {
            pubkey: attacker.publicKey,
            isSigner: true,
            isWritable: true
          }
        ],
        programId: program.programId,
        data
      }))
    }
    
    return tx
  }

  /**
   * Attempt various access bypass techniques
   */
  private async attemptAccessBypasses(
    program: Program,
    functionName: string,
    attacker: Keypair
  ): Promise<Array<{success: boolean, logs?: string[], computeUnits?: number}>> {
    const results = []
    
    // Technique 1: Missing signer
    try {
      const tx1 = new Transaction()
      const data = Buffer.from([0x30]) // Protected function
      
      tx1.add(new TransactionInstruction({
        keys: [
          {
            pubkey: attacker.publicKey,
            isSigner: false, // Should be true!
            isWritable: true
          }
        ],
        programId: program.programId,
        data
      }))
      
      const sim1 = await this.connection.simulateTransaction(tx1)
      results.push({
        success: !sim1.value.err,
        logs: sim1.value.logs || undefined,
        computeUnits: sim1.value.unitsConsumed
      })
    } catch (error) {
      results.push({ success: false })
    }
    
    // Technique 2: Account confusion
    try {
      const fakeAuthority = Keypair.generate()
      const tx2 = await program.methods[functionName]()
        .accounts({
          authority: fakeAuthority.publicKey,
          user: attacker.publicKey,
          systemProgram: SystemProgram.programId
        })
        .transaction()
      
      const sim2 = await this.connection.simulateTransaction(tx2)
      results.push({
        success: !sim2.value.err,
        logs: sim2.value.logs || undefined,
        computeUnits: sim2.value.unitsConsumed
      })
    } catch (error) {
      results.push({ success: false })
    }
    
    // Technique 3: Parameter manipulation
    try {
      const tx3 = new Transaction()
      const data = Buffer.alloc(65)
      data.writeUInt8(0x30, 0)
      // Manipulated parameters to bypass checks
      data.writeBigUInt64LE(BigInt(0), 1) // Zero amount
      data.write(attacker.publicKey.toBuffer().toString('hex'), 9, 'hex')
      data.write(attacker.publicKey.toBuffer().toString('hex'), 41, 'hex') // Same as source
      
      tx3.add(new TransactionInstruction({
        keys: [
          {
            pubkey: attacker.publicKey,
            isSigner: true,
            isWritable: true
          }
        ],
        programId: program.programId,
        data
      }))
      
      const sim3 = await this.connection.simulateTransaction(tx3)
      results.push({
        success: !sim3.value.err,
        logs: sim3.value.logs || undefined,
        computeUnits: sim3.value.unitsConsumed
      })
    } catch (error) {
      results.push({ success: false })
    }
    
    return results
  }

  /**
   * Build role manipulation transaction
   */
  private async buildRoleManipulationTx(
    program: Program,
    roleAccount: PublicKey,
    attacker: Keypair
  ): Promise<Transaction> {
    const tx = new Transaction()
    
    // Try to directly write to role account
    const data = Buffer.alloc(9)
    data.writeUInt8(0xFF, 0) // Admin role marker
    data.writeBigUInt64LE(BigInt(Date.now()), 1) // Timestamp
    
    tx.add(new TransactionInstruction({
      keys: [
        {
          pubkey: roleAccount,
          isSigner: false,
          isWritable: true
        },
        {
          pubkey: attacker.publicKey,
          isSigner: true,
          isWritable: false
        }
      ],
      programId: program.programId,
      data
    }))
    
    return tx
  }

  /**
   * Check if error indicates access denied
   */
  private isAccessDeniedError(error: string, logs: string[]): boolean {
    const accessDeniedIndicators = [
      'access denied',
      'unauthorized',
      'not authorized',
      'permission denied',
      'admin only',
      'owner only',
      'insufficient permissions',
      'forbidden'
    ]
    
    const errorLower = error.toLowerCase()
    const hasErrorIndicator = accessDeniedIndicators.some(indicator => 
      errorLower.includes(indicator)
    )
    
    const hasLogIndicator = logs.some(log =>
      accessDeniedIndicators.some(indicator => 
        log.toLowerCase().includes(indicator)
      )
    )
    
    return hasErrorIndicator || hasLogIndicator
  }

  /**
   * Detect privilege escalation
   */
  private detectPrivilegeEscalation(logs: string[], error: any): boolean {
    if (error) return false
    
    const escalationIndicators = [
      'role granted',
      'permission added',
      'admin set',
      'authority changed',
      'elevated',
      'promoted'
    ]
    
    return logs.some(log =>
      escalationIndicators.some(indicator => 
        log.toLowerCase().includes(indicator)
      )
    )
  }

  /**
   * Run all access control tests
   */
  async runAllTests(program: Program): Promise<AccessControlAttackResult[]> {
    const results: AccessControlAttackResult[] = []
    
    results.push(await this.testUnauthorizedAdminAccess(program))
    results.push(await this.testPrivilegeEscalation(program))
    results.push(await this.testAccessBypass(program))
    results.push(await this.testRoleManipulation(program))
    
    return results
  }
}

// Export factory function
export const createAccessControlAttackTester = (
  connection: Connection,
  environment: TestEnvironment
) => new AccessControlAttackTester(connection, environment) 