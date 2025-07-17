import { useState, useEffect } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { PublicKey, Keypair } from '@solana/web3.js'
import { ConfigurableInitializer } from './ConfigurableInitializer'
import { AttackVectorTester } from './AttackVectorTester'
import { AdminOperationsPanel } from './AdminOperationsPanel'
import { SecurityMonitor } from './SecurityMonitor'
import { AuditReportGenerator } from './AuditReportGenerator'
import { AttackSuccessDetector } from './AttackSuccessDetector'
import { PerformanceBenchmark } from './PerformanceBenchmark'
import { TestImplementationStatus } from './TestImplementationStatus'
import { PROGRAMS } from '@/utils/constants'
import { ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'

interface SecurityTestResult {
  id: string
  timestamp: Date
  testType: 'initialization' | 'attack_vector' | 'admin_operation' | 'monitoring'
  program: string
  description: string
  status: 'success' | 'error' | 'warning' | 'info'
  details: any
  severity?: 'low' | 'medium' | 'high' | 'critical'
}

export function AdvancedSecurityPanel() {
  const { connection } = useConnection()
  const wallet = useWallet()
  const [activeTab, setActiveTab] = useState<'init' | 'attack' | 'admin' | 'monitor' | 'detect' | 'perf' | 'report' | 'implementation'>('init')
  const [isAdminWallet, setIsAdminWallet] = useState(false)
  const [adminKeypair, setAdminKeypair] = useState<Keypair | null>(null)
  const [testResults, setTestResults] = useState<SecurityTestResult[]>([])
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    init: true,
    attack: false,
    admin: false,
    monitor: false,
    report: false
  })

  // Admin wallet public key
  const ADMIN_WALLET = '4efsLapeRBz4pnqey6vBUECUSD6HmDie4pGzUxhnW1aZ'

  useEffect(() => {
    if (wallet.publicKey) {
      setIsAdminWallet(wallet.publicKey.toBase58() === ADMIN_WALLET)
    }
    loadAdminKeypair()
  }, [wallet.publicKey])

  const loadAdminKeypair = async () => {
    try {
      // Load admin keypair from admin-keypair.json
      const response = await fetch('/admin-keypair.json')
      const keypairArray = await response.json()
      const keypair = Keypair.fromSecretKey(new Uint8Array(keypairArray))
      setAdminKeypair(keypair)
    } catch (error) {
      console.error('Failed to load admin keypair:', error)
    }
  }

  const addTestResult = (result: Omit<SecurityTestResult, 'id' | 'timestamp'>) => {
    const newResult: SecurityTestResult = {
      ...result,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date()
    }
    setTestResults(prev => [newResult, ...prev])
    
    // Show toast based on status
    switch (result.status) {
      case 'success':
        toast.success(`✅ ${result.description}`)
        break
      case 'error':
        toast.error(`❌ ${result.description}`)
        break
      case 'warning':
        toast(`⚠️ ${result.description}`, { icon: '⚠️' })
        break
      case 'info':
        toast.success(`ℹ️ ${result.description}`)
        break
    }
  }

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }))
  }

  const clearResults = () => {
    setTestResults([])
    toast.success('Test results cleared')
  }

  const tabs = [
    { id: 'init', label: '🚀 Configuration & Init', description: 'Configure and initialize programs' },
    { id: 'attack', label: '🎯 Attack Vectors', description: 'Test security vulnerabilities' },
    { id: 'admin', label: '🔐 Admin Operations', description: 'Admin-only functions' },
    { id: 'monitor', label: '📊 Live Monitor', description: 'Real-time security monitoring' },
    { id: 'detect', label: '🔍 Attack Detection', description: 'Automated vulnerability detection' },
    { id: 'perf', label: '⚡ Performance', description: 'Benchmark gas costs & optimization' },
    { id: 'report', label: '📋 Audit Report', description: 'Generate comprehensive reports' },
    { id: 'implementation', label: '📊 Test Status', description: 'View test implementation details' }
  ]

  return (
    <div className="bg-defai-gray rounded-lg border border-gray-800">
      {/* Header */}
      <div className="border-b border-gray-800 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">
              🛡️ Advanced Security Audit Panel
            </h2>
            <p className="text-gray-400">
              End-to-end security testing and audit tools for DeFAI programs
            </p>
          </div>
          <div className="flex items-center space-x-4">
            {/* Admin Wallet Status */}
            <div className={`px-3 py-1 rounded-full text-xs font-medium ${
              isAdminWallet 
                ? 'bg-green-900 text-green-300 border border-green-700' 
                : 'bg-red-900 text-red-300 border border-red-700'
            }`}>
              {isAdminWallet ? '🔑 Admin Wallet' : '👤 Regular Wallet'}
            </div>
            
            {/* Connection Status */}
            <div className={`px-3 py-1 rounded-full text-xs font-medium ${
              connection.rpcEndpoint.includes('localhost') || connection.rpcEndpoint.includes('127.0.0.1')
                ? 'bg-blue-900 text-blue-300 border border-blue-700'
                : 'bg-yellow-900 text-yellow-300 border border-yellow-700'
            }`}>
              {connection.rpcEndpoint.includes('localhost') || connection.rpcEndpoint.includes('127.0.0.1')
                ? '🏠 Localnet' 
                : '🌐 ' + new URL(connection.rpcEndpoint).hostname}
            </div>
            
            {/* Results Count */}
            <div className="px-3 py-1 rounded-full text-xs font-medium bg-gray-800 text-gray-300 border border-gray-700">
              📊 {testResults.length} Results
            </div>
          </div>
        </div>

        {/* Wallet Warning */}
        {!isAdminWallet && wallet.connected && (
          <div className="mt-4 bg-yellow-900 bg-opacity-20 border border-yellow-700 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <span className="text-yellow-400 text-lg">⚠️</span>
              <div>
                <p className="text-yellow-400 font-semibold text-sm">Admin Wallet Required</p>
                <p className="text-yellow-300 text-xs mt-1">
                  Some operations require the admin wallet ({ADMIN_WALLET.slice(0, 8)}...). 
                  Import admin-keypair.json to unlock all features.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-800">
        <nav className="flex space-x-8 px-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-4 px-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-defai-primary text-defai-primary'
                  : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-600'
              }`}
            >
              <div className="text-left">
                <div>{tab.label}</div>
                <div className="text-xs opacity-75">{tab.description}</div>
              </div>
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {activeTab === 'init' && (
          <ConfigurableInitializer
            connection={connection}
            wallet={wallet}
            adminKeypair={adminKeypair}
            onTestResult={addTestResult}
          />
        )}

        {activeTab === 'attack' && (
          <AttackVectorTester
            connection={connection}
            wallet={wallet}
            adminKeypair={adminKeypair}
            onTestResult={addTestResult}
          />
        )}

        {activeTab === 'admin' && (
          <AdminOperationsPanel
            connection={connection}
            wallet={wallet}
            adminKeypair={adminKeypair}
            isAdminWallet={isAdminWallet}
            onTestResult={addTestResult}
          />
        )}

        {activeTab === 'monitor' && (
          <SecurityMonitor
            connection={connection}
            wallet={wallet}
            onTestResult={addTestResult}
          />
        )}

        {activeTab === 'detect' && (
          <AttackSuccessDetector
            connection={connection}
            onDetection={(report) => {
              addTestResult({
                testType: 'attack_vector',
                program: 'Attack Detection',
                description: report.vulnerabilityFound 
                  ? `Vulnerability detected: ${report.details}`
                  : 'No vulnerabilities detected',
                status: report.vulnerabilityFound ? 'warning' : 'success',
                details: report,
                severity: report.severity as any
              })
            }}
          />
        )}

        {activeTab === 'perf' && (
          <PerformanceBenchmark
            connection={connection}
            wallet={wallet}
            onBenchmarkComplete={(results) => {
              // Add summary result
              const avgGas = results.reduce((sum, r) => sum + r.gasUsed, 0) / results.length
              const successRate = (results.filter(r => r.success).length / results.length) * 100
              
              addTestResult({
                testType: 'monitoring',
                program: 'Performance Benchmark',
                description: `Completed ${results.length} benchmark tests. Avg gas: ${Math.round(avgGas).toLocaleString()}, Success rate: ${successRate.toFixed(1)}%`,
                status: successRate > 90 ? 'success' : 'warning',
                details: { results, avgGas, successRate }
              })
            }}
          />
        )}

        {activeTab === 'report' && (
          <AuditReportGenerator
            testResults={testResults}
            connection={connection}
            programs={PROGRAMS}
          />
        )}

        {activeTab === 'implementation' && (
          <TestImplementationStatus />
        )}
      </div>

      {/* Recent Results Panel */}
      {testResults.length > 0 && (
        <div className="border-t border-gray-800 p-6">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => toggleSection('results')}
              className="flex items-center space-x-2 text-white font-medium hover:text-defai-primary transition-colors"
            >
              {expandedSections.results ? (
                <ChevronDownIcon className="h-4 w-4" />
              ) : (
                <ChevronRightIcon className="h-4 w-4" />
              )}
              <span>Recent Test Results ({testResults.length})</span>
            </button>
            <button
              onClick={clearResults}
              className="text-xs text-gray-400 hover:text-red-400 transition-colors"
            >
              Clear All
            </button>
          </div>

          {expandedSections.results && (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {testResults.slice(0, 10).map((result) => (
                <div
                  key={result.id}
                  className={`p-3 rounded-lg border ${
                    result.status === 'success' ? 'bg-green-900 bg-opacity-20 border-green-700' :
                    result.status === 'error' ? 'bg-red-900 bg-opacity-20 border-red-700' :
                    result.status === 'warning' ? 'bg-yellow-900 bg-opacity-20 border-yellow-700' :
                    'bg-blue-900 bg-opacity-20 border-blue-700'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <span className={`text-xs px-2 py-1 rounded ${
                          result.status === 'success' ? 'bg-green-800 text-green-300' :
                          result.status === 'error' ? 'bg-red-800 text-red-300' :
                          result.status === 'warning' ? 'bg-yellow-800 text-yellow-300' :
                          'bg-blue-800 text-blue-300'
                        }`}>
                          {result.testType.replace('_', ' ').toUpperCase()}
                        </span>
                        <span className="text-xs text-gray-400">{result.program}</span>
                        {result.severity && (
                          <span className={`text-xs px-2 py-1 rounded ${
                            result.severity === 'critical' ? 'bg-red-900 text-red-300' :
                            result.severity === 'high' ? 'bg-orange-900 text-orange-300' :
                            result.severity === 'medium' ? 'bg-yellow-900 text-yellow-300' :
                            'bg-gray-800 text-gray-300'
                          }`}>
                            {result.severity.toUpperCase()}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-white mt-1">{result.description}</p>
                    </div>
                    <div className="text-xs text-gray-500">
                      {result.timestamp.toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
} 