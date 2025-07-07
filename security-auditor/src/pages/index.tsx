import { useState } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { Layout } from '@/components/Layout'
import { AdvancedSecurityPanel } from '@/components/AdvancedSecurityPanel'
import { CheckPrograms } from '@/components/CheckPrograms'
import { DeploymentControls } from '@/components/DeploymentControls'
import Link from 'next/link'
import { DocumentTextIcon } from '@heroicons/react/24/outline'

export default function Home() {
  const { connection } = useConnection()
  const wallet = useWallet()

  return (
    <Layout>
      <div className="space-y-8">
        <div>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">🛡️ DeFAI Security Audit Center</h1>
              <p className="text-gray-400 text-lg">
                Comprehensive security testing, auditing, and monitoring tools for DeFAI programs
              </p>
            </div>
            <Link 
              href="/reports" 
              className="flex items-center space-x-2 bg-defai-primary hover:bg-defai-primary-dark text-white px-4 py-3 rounded-lg transition-colors"
            >
              <DocumentTextIcon className="h-5 w-5" />
              <span>View Reports</span>
            </Link>
          </div>
        </div>

        {/* Network & Deployment Status */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <DeploymentControls />
          <CheckPrograms />
        </div>

        {/* Main Security Panel */}
        <AdvancedSecurityPanel />

        {/* Quick Start Guide */}
        <div className="bg-defai-gray rounded-lg p-6 border border-gray-800">
          <h3 className="text-lg font-semibold text-white mb-4">🚀 Quick Start Guide</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="text-2xl mb-2">1️⃣</div>
              <h4 className="text-sm font-medium text-white mb-2">Connect Admin Wallet</h4>
              <p className="text-xs text-gray-400">
                Import admin-keypair.json to unlock all administrative functions and privileged operations.
              </p>
            </div>
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="text-2xl mb-2">2️⃣</div>
              <h4 className="text-sm font-medium text-white mb-2">Initialize Programs</h4>
              <p className="text-xs text-gray-400">
                Configure and deploy programs with custom parameters for comprehensive security testing.
              </p>
            </div>
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="text-2xl mb-2">3️⃣</div>
              <h4 className="text-sm font-medium text-white mb-2">Run Security Tests</h4>
              <p className="text-xs text-gray-400">
                Execute attack vector tests, monitor security metrics, and validate admin operations.
              </p>
            </div>
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="text-2xl mb-2">4️⃣</div>
              <h4 className="text-sm font-medium text-white mb-2">Generate Reports</h4>
              <p className="text-xs text-gray-400">
                Create comprehensive audit reports with findings, recommendations, and compliance data.
              </p>
            </div>
          </div>
        </div>

        {/* Security Features Overview */}
        <div className="bg-defai-gray rounded-lg p-6 border border-gray-800">
          <h3 className="text-lg font-semibold text-white mb-4">🔒 Security Testing Features</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* Configuration & Initialization */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-defai-primary">🚀 Configuration & Initialization</h4>
              <ul className="text-xs text-gray-400 space-y-1">
                <li>• Configurable program parameters</li>
                <li>• Custom token mint setup</li>
                <li>• Batch program initialization</li>
                <li>• Parameter validation</li>
                <li>• Skip existing initialization</li>
              </ul>
            </div>

            {/* Attack Vector Testing */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-defai-primary">🎯 Attack Vector Testing</h4>
              <ul className="text-xs text-gray-400 space-y-1">
                <li>• Access control bypass tests</li>
                <li>• Integer overflow/underflow</li>
                <li>• Input validation attacks</li>
                <li>• Reentrancy vulnerability tests</li>
                <li>• Business logic exploitation</li>
              </ul>
            </div>

            {/* Admin Operations */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-defai-primary">🔐 Admin Operations</h4>
              <ul className="text-xs text-gray-400 space-y-1">
                <li>• Price and fee management</li>
                <li>• Treasury configuration</li>
                <li>• Emergency pause/unpause</li>
                <li>• Admin privilege changes</li>
                <li>• Multi-signature operations</li>
              </ul>
            </div>

            {/* Real-time Monitoring */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-defai-primary">📊 Real-time Monitoring</h4>
              <ul className="text-xs text-gray-400 space-y-1">
                <li>• Program health monitoring</li>
                <li>• Suspicious activity detection</li>
                <li>• Performance metrics tracking</li>
                <li>• Automated alerting system</li>
                <li>• Response time analysis</li>
              </ul>
            </div>

            {/* Security Reporting */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-defai-primary">📋 Security Reporting</h4>
              <ul className="text-xs text-gray-400 space-y-1">
                <li>• Comprehensive audit reports</li>
                <li>• Risk assessment scoring</li>
                <li>• Vulnerability categorization</li>
                <li>• Remediation recommendations</li>
                <li>• Multiple export formats</li>
              </ul>
            </div>

            {/* Compliance & Standards */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-defai-primary">✅ Compliance & Standards</h4>
              <ul className="text-xs text-gray-400 space-y-1">
                <li>• OWASP security guidelines</li>
                <li>• Solana best practices</li>
                <li>• DeFi security standards</li>
                <li>• Automated compliance checks</li>
                <li>• Audit trail maintenance</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Important Notes */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-yellow-900 bg-opacity-20 border border-yellow-700 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <span className="text-yellow-400 text-lg">⚠️</span>
              <div>
                <p className="text-yellow-400 font-semibold text-sm">Testing Environment</p>
                <p className="text-yellow-300 text-xs mt-1">
                  This security audit panel is designed for testing environments only. 
                  Use with test funds and isolated networks. Some attack tests may modify program state.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-blue-900 bg-opacity-20 border border-blue-700 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <span className="text-blue-400 text-lg">🛡️</span>
              <div>
                <p className="text-blue-400 font-semibold text-sm">Security Best Practices</p>
                <p className="text-blue-300 text-xs mt-1">
                  Regular security audits, continuous monitoring, and proper access controls are essential 
                  for maintaining secure DeFi protocols. Use this tool as part of your security pipeline.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Info */}
        <div className="text-center py-8 border-t border-gray-800">
          <p className="text-gray-500 text-sm">
            DeFAI Security Audit Center v1.0 • Built for comprehensive blockchain security testing
          </p>
          <p className="text-gray-600 text-xs mt-2">
            For questions or support, consult the security documentation or contact the development team.
          </p>
        </div>
      </div>
    </Layout>
  )
}