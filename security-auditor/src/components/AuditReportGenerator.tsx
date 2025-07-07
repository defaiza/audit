import { useState } from 'react'
import { Connection } from '@solana/web3.js'

interface AuditReportGeneratorProps {
  testResults: any[]
  connection: Connection
  programs: any
}

interface ReportConfig {
  includeInitialization: boolean
  includeAttackVectors: boolean
  includeAdminOperations: boolean
  includeMonitoring: boolean
  includeSummary: boolean
  includeRecommendations: boolean
  format: 'markdown' | 'json' | 'html'
  detailLevel: 'basic' | 'detailed' | 'comprehensive'
}

interface AuditSummary {
  totalTests: number
  successfulTests: number
  failedTests: number
  criticalIssues: number
  highPriorityIssues: number
  mediumPriorityIssues: number
  lowPriorityIssues: number
  overallScore: number
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
}

export function AuditReportGenerator({ testResults, connection, programs }: AuditReportGeneratorProps) {
  const [reportConfig, setReportConfig] = useState<ReportConfig>({
    includeInitialization: true,
    includeAttackVectors: true,
    includeAdminOperations: true,
    includeMonitoring: true,
    includeSummary: true,
    includeRecommendations: true,
    format: 'markdown',
    detailLevel: 'detailed'
  })

  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedReport, setGeneratedReport] = useState<string>('')
  const [showReport, setShowReport] = useState(false)

  const updateConfig = (field: keyof ReportConfig, value: any) => {
    setReportConfig(prev => ({ ...prev, [field]: value }))
  }

  const calculateAuditSummary = (): AuditSummary => {
    const totalTests = testResults.length
    const successfulTests = testResults.filter(r => r.status === 'success').length
    const failedTests = testResults.filter(r => r.status === 'error').length
    
    const criticalIssues = testResults.filter(r => r.severity === 'critical').length
    const highPriorityIssues = testResults.filter(r => r.severity === 'high').length
    const mediumPriorityIssues = testResults.filter(r => r.severity === 'medium').length
    const lowPriorityIssues = testResults.filter(r => r.severity === 'low').length

    // Calculate overall score (0-100)
    let score = 100
    score -= criticalIssues * 25
    score -= highPriorityIssues * 15
    score -= mediumPriorityIssues * 10
    score -= lowPriorityIssues * 5
    score = Math.max(0, score)

    // Determine risk level
    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low'
    if (criticalIssues > 0) riskLevel = 'critical'
    else if (highPriorityIssues > 2) riskLevel = 'high'
    else if (mediumPriorityIssues > 5) riskLevel = 'medium'

    return {
      totalTests,
      successfulTests,
      failedTests,
      criticalIssues,
      highPriorityIssues,
      mediumPriorityIssues,
      lowPriorityIssues,
      overallScore: score,
      riskLevel
    }
  }

  const getRecommendations = (summary: AuditSummary): string[] => {
    const recommendations: string[] = []

    if (summary.criticalIssues > 0) {
      recommendations.push('🚨 **IMMEDIATE ACTION REQUIRED**: Address all critical security issues before production deployment')
      recommendations.push('Conduct immediate security review with senior developers')
      recommendations.push('Consider hiring external security auditors for critical systems')
    }

    if (summary.highPriorityIssues > 0) {
      recommendations.push('⚠️ Fix all high-priority security issues before mainnet launch')
      recommendations.push('Implement additional access controls and validation checks')
    }

    if (summary.mediumPriorityIssues > 3) {
      recommendations.push('📝 Create a remediation plan for medium-priority issues')
      recommendations.push('Consider implementing additional monitoring and alerting')
    }

    if (summary.overallScore < 70) {
      recommendations.push('🔄 Comprehensive security review and testing cycle recommended')
      recommendations.push('Implement automated security testing in CI/CD pipeline')
    }

    // General recommendations
    recommendations.push('🛡️ Implement regular security audits and penetration testing')
    recommendations.push('📚 Ensure all team members receive security training')
    recommendations.push('🔍 Set up continuous monitoring for production systems')
    recommendations.push('📋 Maintain incident response procedures and documentation')

    return recommendations
  }

  const generateMarkdownReport = (summary: AuditSummary): string => {
    const timestamp = new Date().toISOString()
    const networkInfo = connection.rpcEndpoint.includes('localhost') ? 'Localnet' : 'External Network'

    let report = `# DeFAI Security Audit Report

**Generated:** ${timestamp}  
**Network:** ${networkInfo}  
**Auditor:** Security Audit Panel  
**Report Version:** 1.0

---

## Executive Summary

| Metric | Value |
|--------|-------|
| **Overall Security Score** | ${summary.overallScore}/100 |
| **Risk Level** | ${summary.riskLevel.toUpperCase()} |
| **Total Tests Executed** | ${summary.totalTests} |
| **Successful Tests** | ${summary.successfulTests} |
| **Failed Tests** | ${summary.failedTests} |

### Issue Breakdown

| Severity | Count |
|----------|-------|
| 🚨 Critical | ${summary.criticalIssues} |
| 🔴 High | ${summary.highPriorityIssues} |
| 🟡 Medium | ${summary.mediumPriorityIssues} |
| 🔵 Low | ${summary.lowPriorityIssues} |

---

## Program Overview

`

    // Add program information
    Object.entries(programs).forEach(([key, program]: [string, any]) => {
      report += `### ${program.name}
- **Program ID:** \`${program.programId}\`
- **Status:** ${program.status}
- **Readiness:** ${program.readiness}/10
- **Features:** ${program.features.join(', ')}

`
    })

    if (reportConfig.includeInitialization) {
      report += `---

## Initialization Tests

`
      const initResults = testResults.filter(r => r.testType === 'initialization')
      if (initResults.length > 0) {
        initResults.forEach(result => {
          const icon = result.status === 'success' ? '✅' : result.status === 'error' ? '❌' : '⚠️'
          report += `${icon} **${result.program}**: ${result.description}\n`
          if (reportConfig.detailLevel !== 'basic' && result.details) {
            report += `   - Details: \`${JSON.stringify(result.details, null, 2)}\`\n`
          }
          report += '\n'
        })
      } else {
        report += 'No initialization tests recorded.\n\n'
      }
    }

    if (reportConfig.includeAttackVectors) {
      report += `---

## Attack Vector Testing

`
      const attackResults = testResults.filter(r => r.testType === 'attack_vector')
      if (attackResults.length > 0) {
        const categories = [...new Set(attackResults.map(r => r.details?.category || 'Unknown'))]
        
        categories.forEach(category => {
          report += `### ${category.replace('_', ' ').toUpperCase()} Tests\n\n`
          const categoryResults = attackResults.filter(r => r.details?.category === category)
          
          categoryResults.forEach(result => {
            const icon = result.status === 'success' ? '✅' : result.status === 'error' ? '❌' : '⚠️'
            const severity = result.severity ? ` (${result.severity.toUpperCase()})` : ''
            report += `${icon} **${result.program}**${severity}: ${result.description}\n`
          })
          report += '\n'
        })
      } else {
        report += 'No attack vector tests recorded.\n\n'
      }
    }

    if (reportConfig.includeAdminOperations) {
      report += `---

## Admin Operations Testing

`
      const adminResults = testResults.filter(r => r.testType === 'admin_operation')
      if (adminResults.length > 0) {
        adminResults.forEach(result => {
          const icon = result.status === 'success' ? '✅' : result.status === 'error' ? '❌' : '⚠️'
          report += `${icon} **${result.program}**: ${result.description}\n`
          
          if (reportConfig.detailLevel === 'comprehensive' && result.details?.operation) {
            report += `   - Operation: \`${result.details.operation}\`\n`
            if (result.details.parameters) {
              report += `   - Parameters: \`${JSON.stringify(result.details.parameters)}\`\n`
            }
          }
          report += '\n'
        })
      } else {
        report += 'No admin operations recorded.\n\n'
      }
    }

    if (reportConfig.includeMonitoring) {
      report += `---

## Security Monitoring

`
      const monitoringResults = testResults.filter(r => r.testType === 'monitoring')
      if (monitoringResults.length > 0) {
        report += `### Monitoring Summary\n\n`
        monitoringResults.slice(-10).forEach(result => {
          const icon = result.status === 'success' ? '📊' : result.status === 'error' ? '🚨' : '⚠️'
          report += `${icon} ${result.description}\n`
        })
      } else {
        report += 'No monitoring data recorded.\n'
      }
      report += '\n'
    }

    if (reportConfig.includeRecommendations) {
      report += `---

## Security Recommendations

`
      const recommendations = getRecommendations(summary)
      recommendations.forEach((rec, i) => {
        report += `${i + 1}. ${rec}\n`
      })
      report += '\n'
    }

    report += `---

## Detailed Test Results

<details>
<summary>Click to expand full test results (${testResults.length} entries)</summary>

\`\`\`json
${JSON.stringify(testResults, null, 2)}
\`\`\`

</details>

---

## Conclusion

`

    if (summary.overallScore >= 90) {
      report += `🟢 **Excellent Security Posture**: The DeFAI programs demonstrate strong security practices with minimal issues detected.`
    } else if (summary.overallScore >= 70) {
      report += `🟡 **Good Security Posture**: The programs show good security practices but have some areas for improvement.`
    } else if (summary.overallScore >= 50) {
      report += `🟠 **Moderate Security Concerns**: Several security issues need to be addressed before production deployment.`
    } else {
      report += `🔴 **Significant Security Risks**: Major security issues detected. Immediate remediation required.`
    }

    report += `

**Next Steps:**
1. Address all critical and high-priority issues
2. Implement recommended security controls
3. Schedule follow-up security testing
4. Establish ongoing security monitoring

*This report was generated automatically by the DeFAI Security Audit Panel.*
`

    return report
  }

  const generateJSONReport = (summary: AuditSummary): string => {
    const reportData = {
      metadata: {
        generatedAt: new Date().toISOString(),
        network: connection.rpcEndpoint.includes('localhost') ? 'localnet' : 'external',
        version: '1.0',
        auditor: 'DeFAI Security Audit Panel'
      },
      summary,
      programs: Object.entries(programs).map(([key, program]: [string, any]) => ({
        key,
        name: program.name,
        programId: program.programId,
        status: program.status,
        readiness: program.readiness,
        features: program.features
      })),
      testResults: testResults.map(result => ({
        ...result,
        timestamp: result.timestamp || new Date().toISOString()
      })),
      recommendations: getRecommendations(summary),
      config: reportConfig
    }

    return JSON.stringify(reportData, null, 2)
  }

  const generateHTMLReport = (summary: AuditSummary): string => {
    const markdownReport = generateMarkdownReport(summary)
    
    // Simple markdown to HTML conversion
    let htmlReport = markdownReport
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/^\* (.*$)/gim, '<li>$1</li>')
      .replace(/^\d+\. (.*$)/gim, '<li>$1</li>')
      .replace(/\n/g, '<br>')

    return `
<!DOCTYPE html>
<html>
<head>
    <title>DeFAI Security Audit Report</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; }
        h1 { color: #333; border-bottom: 2px solid #007acc; }
        h2 { color: #007acc; margin-top: 30px; }
        h3 { color: #555; }
        table { border-collapse: collapse; width: 100%; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
        th { background-color: #f2f2f2; }
        .critical { color: #dc3545; font-weight: bold; }
        .high { color: #fd7e14; font-weight: bold; }
        .medium { color: #ffc107; font-weight: bold; }
        .low { color: #28a745; }
        code { background-color: #f8f9fa; padding: 2px 4px; border-radius: 3px; }
        pre { background-color: #f8f9fa; padding: 15px; border-radius: 5px; overflow-x: auto; }
    </style>
</head>
<body>
    ${htmlReport}
</body>
</html>
`
  }

  const generateReport = async () => {
    setIsGenerating(true)
    
    try {
      const summary = calculateAuditSummary()
      let report = ''

      switch (reportConfig.format) {
        case 'markdown':
          report = generateMarkdownReport(summary)
          break
        case 'json':
          report = generateJSONReport(summary)
          break
        case 'html':
          report = generateHTMLReport(summary)
          break
      }

      setGeneratedReport(report)
      setShowReport(true)

    } catch (error) {
      console.error('Report generation failed:', error)
    } finally {
      setIsGenerating(false)
    }
  }

  const downloadReport = () => {
    const timestamp = new Date().toISOString().split('T')[0]
    const filename = `defai-security-audit-${timestamp}.${reportConfig.format === 'markdown' ? 'md' : reportConfig.format}`
    
    const blob = new Blob([generatedReport], { 
      type: reportConfig.format === 'html' ? 'text/html' : 'text/plain' 
    })
    
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(generatedReport)
      alert('Report copied to clipboard!')
    } catch (error) {
      console.error('Failed to copy to clipboard:', error)
    }
  }

  const summary = calculateAuditSummary()

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-white mb-4">📋 Audit Report Generator</h3>
        <p className="text-gray-400 text-sm mb-6">
          Generate comprehensive security audit reports from your testing session data.
        </p>
      </div>

      {/* Summary Overview */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h4 className="text-sm font-medium text-white mb-4">Audit Summary</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-700 rounded-lg p-3">
            <div className="text-2xl font-bold text-white">{summary.totalTests}</div>
            <div className="text-xs text-gray-400">Total Tests</div>
          </div>
          <div className="bg-gray-700 rounded-lg p-3">
            <div className={`text-2xl font-bold ${
              summary.overallScore >= 90 ? 'text-green-400' :
              summary.overallScore >= 70 ? 'text-yellow-400' :
              'text-red-400'
            }`}>
              {summary.overallScore}/100
            </div>
            <div className="text-xs text-gray-400">Security Score</div>
          </div>
          <div className="bg-gray-700 rounded-lg p-3">
            <div className={`text-2xl font-bold ${
              summary.riskLevel === 'low' ? 'text-green-400' :
              summary.riskLevel === 'medium' ? 'text-yellow-400' :
              summary.riskLevel === 'high' ? 'text-orange-400' :
              'text-red-400'
            }`}>
              {summary.riskLevel.toUpperCase()}
            </div>
            <div className="text-xs text-gray-400">Risk Level</div>
          </div>
          <div className="bg-gray-700 rounded-lg p-3">
            <div className="text-2xl font-bold text-red-400">{summary.criticalIssues}</div>
            <div className="text-xs text-gray-400">Critical Issues</div>
          </div>
        </div>
      </div>

      {/* Report Configuration */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h4 className="text-sm font-medium text-white mb-4">Report Configuration</h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Include Sections */}
          <div>
            <h5 className="text-sm text-gray-300 mb-3">Include Sections</h5>
            <div className="space-y-2">
              {[
                { key: 'includeInitialization', label: 'Initialization Tests' },
                { key: 'includeAttackVectors', label: 'Attack Vector Tests' },
                { key: 'includeAdminOperations', label: 'Admin Operations' },
                { key: 'includeMonitoring', label: 'Security Monitoring' },
                { key: 'includeSummary', label: 'Executive Summary' },
                { key: 'includeRecommendations', label: 'Recommendations' }
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={reportConfig[key as keyof ReportConfig] as boolean}
                    onChange={(e) => updateConfig(key as keyof ReportConfig, e.target.checked)}
                    className="rounded border-gray-600 text-defai-primary focus:ring-defai-primary focus:ring-offset-gray-800"
                  />
                  <span className="text-sm text-gray-300">{label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Format & Detail Level */}
          <div>
            <div className="mb-4">
              <label className="block text-sm text-gray-300 mb-2">Report Format</label>
              <select
                value={reportConfig.format}
                onChange={(e) => updateConfig('format', e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm"
              >
                <option value="markdown">Markdown (.md)</option>
                <option value="json">JSON (.json)</option>
                <option value="html">HTML (.html)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-300 mb-2">Detail Level</label>
              <select
                value={reportConfig.detailLevel}
                onChange={(e) => updateConfig('detailLevel', e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm"
              >
                <option value="basic">Basic Summary</option>
                <option value="detailed">Detailed Report</option>
                <option value="comprehensive">Comprehensive Analysis</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Generate Button */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-400">
          {testResults.length} test results available for reporting
        </div>
        <button
          onClick={generateReport}
          disabled={isGenerating || testResults.length === 0}
          className={`px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
            isGenerating || testResults.length === 0
              ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
              : 'bg-defai-primary hover:bg-defai-primary-dark text-white hover:shadow-lg'
          }`}
        >
          {isGenerating ? (
            <span className="flex items-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Generating Report...
            </span>
          ) : (
            '📋 Generate Audit Report'
          )}
        </button>
      </div>

      {/* Generated Report Display */}
      {showReport && generatedReport && (
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-medium text-white">Generated Report</h4>
            <div className="flex space-x-2">
              <button
                onClick={copyToClipboard}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors"
              >
                Copy
              </button>
              <button
                onClick={downloadReport}
                className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-xs rounded transition-colors"
              >
                Download
              </button>
              <button
                onClick={() => setShowReport(false)}
                className="px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white text-xs rounded transition-colors"
              >
                Close
              </button>
            </div>
          </div>
          
          <div className="bg-gray-900 rounded p-4 max-h-96 overflow-y-auto">
            <pre className="text-xs text-gray-300 whitespace-pre-wrap font-mono">
              {generatedReport}
            </pre>
          </div>
        </div>
      )}

      {/* Info Panel */}
      <div className="bg-blue-900 bg-opacity-20 border border-blue-700 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <span className="text-blue-400 text-lg">📋</span>
          <div>
            <p className="text-blue-400 font-semibold text-sm">Comprehensive Audit Reports</p>
            <p className="text-blue-300 text-xs mt-1">
              Generate detailed security audit reports including test results, recommendations, and risk assessments.
              Reports can be exported in multiple formats for documentation and compliance purposes.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
} 