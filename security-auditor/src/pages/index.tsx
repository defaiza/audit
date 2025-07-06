import { useState } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { Layout } from '@/components/Layout'
import { ProgramCard } from '@/components/ProgramCard'
import { TestResults } from '@/components/TestResults'
import { SecurityOverview } from '@/components/SecurityOverview'
import { PROGRAMS, TEST_SCENARIOS } from '@/utils/constants'
import { ProgramTester, TestResult } from '@/utils/program-test'
import toast from 'react-hot-toast'

export default function Home() {
  const { connection } = useConnection()
  const wallet = useWallet()
  const [loadingProgram, setLoadingProgram] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<{
    program: string
    results: TestResult[]
  } | null>(null)
  const [selectedProgram, setSelectedProgram] = useState<string | null>(null)

  const runTests = async (programKey: string) => {
    if (!wallet.connected) {
      toast.error('Please connect your wallet first')
      return
    }

    setLoadingProgram(programKey)
    const program = PROGRAMS[programKey as keyof typeof PROGRAMS]
    
    try {
      const tester = new ProgramTester(connection, wallet)
      let results: TestResult[] = []
      
      // Run security checks first
      const securityResults = await tester.runSecurityChecks(program.programId, program.name)
      results = [...securityResults]
      
      // Run program-specific tests
      switch (programKey) {
        case 'SWAP':
          const swapResults = await tester.testSwapProgram(program.programId)
          results = [...results, ...swapResults]
          break
        case 'STAKING':
          const stakingResults = await tester.testStakingProgram(program.programId)
          results = [...results, ...stakingResults]
          break
        case 'ESTATE':
          const estateResults = await tester.testEstateProgram(program.programId)
          results = [...results, ...estateResults]
          break
        case 'APP_FACTORY':
          const factoryResults = await tester.testAppFactoryProgram(program.programId)
          results = [...results, ...factoryResults]
          break
      }
      
      setTestResults({
        program: program.name,
        results
      })
      
      const successCount = results.filter(r => r.status === 'success').length
      if (successCount === results.length) {
        toast.success(`All ${results.length} tests passed!`)
      } else {
        toast.error(`${successCount}/${results.length} tests passed`)
      }
    } catch (error) {
      console.error('Test error:', error)
      toast.error('Failed to run tests')
    } finally {
      setLoadingProgram(null)
    }
  }

  const getImplementedChecks = (programKey: string): string[] => {
    // Based on the ProgramsReadiness.md analysis
    const baseChecks = [
      'Access Control',
      'Input Validation',
      'Overflow Protection',
      'Event Emissions',
      'Error Handling',
      'State Consistency',
      'PDA Derivation',
      'Token Account Validation'
    ]
    
    if (programKey === 'SWAP') {
      return [...baseChecks, 'Admin Timelocks']
    } else if (programKey === 'STAKING') {
      return [...baseChecks, 'Reentrancy Guards']
    } else if (programKey === 'ESTATE') {
      return [...baseChecks, 'Admin Timelocks', 'Reentrancy Guards']
    } else if (programKey === 'APP_FACTORY') {
      return baseChecks.slice(0, 6) // Missing some advanced checks
    }
    return baseChecks
  }

  return (
    <Layout>
      <div className="space-y-8">
        <div>
          <h2 className="text-3xl font-bold text-white mb-2">Security Audit Dashboard</h2>
          <p className="text-gray-400">
            Test and audit DeFAI programs for security vulnerabilities and compliance
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {Object.entries(PROGRAMS).map(([key, program]) => (
            <ProgramCard
              key={key}
              {...program}
              onTest={() => runTests(key)}
              isLoading={loadingProgram === key}
            />
          ))}
        </div>

        {selectedProgram && (
          <SecurityOverview
            programName={PROGRAMS[selectedProgram as keyof typeof PROGRAMS].name}
            implementedChecks={getImplementedChecks(selectedProgram)}
          />
        )}

        <div className="bg-defai-gray rounded-lg p-6 border border-gray-800">
          <h3 className="text-lg font-semibold text-white mb-4">Test Scenarios</h3>
          <div className="space-y-4">
            {Object.entries(TEST_SCENARIOS).map(([program, scenarios]) => (
              <div key={program}>
                <h4 className="text-sm font-medium text-defai-primary mb-2">
                  {PROGRAMS[program as keyof typeof PROGRAMS].name}
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                  {scenarios.map((scenario, i) => (
                    <span key={i} className="text-xs bg-gray-800 text-gray-300 px-2 py-1 rounded">
                      {scenario}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-yellow-900 bg-opacity-20 border border-yellow-700 rounded-lg p-4">
          <p className="text-yellow-400 text-sm">
            <strong>Note:</strong> This security auditor runs basic connectivity and state checks. 
            For comprehensive security audits, additional manual testing and code review are required.
          </p>
        </div>
      </div>

      {testResults && (
        <TestResults
          programName={testResults.program}
          results={testResults.results}
          onClose={() => setTestResults(null)}
        />
      )}
    </Layout>
  )
}