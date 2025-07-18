import { useState, useEffect, useRef } from 'react'
import { Connection, PublicKey } from '@solana/web3.js'
import { PROGRAMS } from '@/utils/constants'
import { DETECTION_RULES, type VulnerabilityReport } from './AttackSuccessDetector'
import { ErrorHandler } from '../utils/error-handler'
import { ErrorModal } from './ErrorModal'
import { WebSocketMonitor, TransactionAlert } from '@/utils/websocket-monitor'
import { Program } from '@coral-xyz/anchor'

interface SecurityMonitorProps {
  connection: Connection
  wallet: any
  onTestResult: (result: any) => void
}

interface SecurityMetric {
  id: string
  name: string
  value: string | number
  status: 'normal' | 'warning' | 'critical'
  lastUpdate: Date
  description: string
}

interface ProgramHealth {
  programId: string
  name: string
  isReachable: boolean
  lastChecked: Date
  accountCount: number
  suspiciousActivity: string[]
}

interface MonitoringAlert {
  id: string
  timestamp: Date
  type: 'security' | 'performance' | 'availability' | 'attack'
  severity: 'low' | 'medium' | 'high' | 'critical'
  message: string
  program: string
  details: any
  attackVector?: string
  vulnerabilityDetails?: VulnerabilityReport
}

export function SecurityMonitor({ connection, wallet, onTestResult }: SecurityMonitorProps) {
  const [isMonitoring, setIsMonitoring] = useState(false)
  const [metrics, setMetrics] = useState<SecurityMetric[]>([])
  const [programHealth, setProgramHealth] = useState<ProgramHealth[]>([])
  const [alerts, setAlerts] = useState<MonitoringAlert[]>([])
  const [monitoringInterval, setMonitoringInterval] = useState(30) // seconds
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [enableAttackDetection, setEnableAttackDetection] = useState(true)
  const [attackTestResults, setAttackTestResults] = useState<Map<string, VulnerabilityReport>>(new Map())
  const [errorModalData, setErrorModalData] = useState<any>(null)
  const [isErrorModalOpen, setIsErrorModalOpen] = useState(false)
  const wsMonitorRef = useRef<WebSocketMonitor | null>(null)
  const [wsConnected, setWsConnected] = useState(false)

  const initializeMetrics = () => {
    const initialMetrics: SecurityMetric[] = [
      {
        id: 'network_health',
        name: 'Network Health',
        value: 'Checking...',
        status: 'normal',
        lastUpdate: new Date(),
        description: 'Overall network connectivity and performance'
      },
      {
        id: 'program_count',
        name: 'Programs Online',
        value: 0,
        status: 'normal',
        lastUpdate: new Date(),
        description: 'Number of DeFAI programs reachable and functioning'
      },
      {
        id: 'total_accounts',
        name: 'Total Accounts',
        value: 0,
        status: 'normal',
        lastUpdate: new Date(),
        description: 'Total number of program accounts across all programs'
      },
      {
        id: 'suspicious_activities',
        name: 'Suspicious Activities',
        value: 0,
        status: 'normal',
        lastUpdate: new Date(),
        description: 'Number of potential security threats detected'
      },
      {
        id: 'avg_response_time',
        name: 'Avg Response Time',
        value: '0ms',
        status: 'normal',
        lastUpdate: new Date(),
        description: 'Average response time for program calls'
      },
      {
        id: 'failed_transactions',
        name: 'Failed Transactions',
        value: 0,
        status: 'normal',
        lastUpdate: new Date(),
        description: 'Number of failed transactions in monitoring period'
      },
      {
        id: 'attack_attempts',
        name: 'Attack Attempts',
        value: 0,
        status: 'normal',
        lastUpdate: new Date(),
        description: 'Number of detected attack attempts'
      },
      {
        id: 'vulnerabilities_found',
        name: 'Active Vulnerabilities',
        value: 0,
        status: 'normal',
        lastUpdate: new Date(),
        description: 'Number of unpatched vulnerabilities detected'
      }
    ]
    setMetrics(initialMetrics)
  }

  const updateMetric = (id: string, value: string | number, status: 'normal' | 'warning' | 'critical') => {
    setMetrics(prev => prev.map(metric => 
      metric.id === id 
        ? { ...metric, value, status, lastUpdate: new Date() }
        : metric
    ))
  }

  const addAlert = (alert: Omit<MonitoringAlert, 'id' | 'timestamp'>) => {
    const newAlert: MonitoringAlert = {
      ...alert,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date()
    }
    
    setAlerts(prev => [newAlert, ...prev.slice(0, 49)]) // Keep last 50 alerts
    
    // Also report to parent
    onTestResult({
      testType: 'monitoring',
      program: alert.program,
      description: alert.message,
      status: alert.severity === 'critical' ? 'error' : alert.severity === 'high' ? 'warning' : 'info',
      details: { alert: newAlert },
      severity: alert.severity
    })
  }

  const checkProgramHealth = async (programKey: string, programInfo: any): Promise<ProgramHealth> => {
    const startTime = Date.now()
    let isReachable = false
    let accountCount = 0
    const suspiciousActivity: string[] = []

    try {
      const programId = new PublicKey(programInfo.programId)
      
      // Check if program exists and is executable
      const accountInfo = await connection.getAccountInfo(programId)
      if (accountInfo && accountInfo.executable) {
        isReachable = true
        
        // Get program accounts (this is a simplified check)
        try {
          const accounts = await connection.getProgramAccounts(programId, {
            dataSlice: { offset: 0, length: 0 } // Just count, don't fetch data
          })
          accountCount = accounts.length
          
          // Basic suspicious activity detection
          if (accountCount > 10000) {
            suspiciousActivity.push('Unusually high account count')
          }
        } catch (err) {
          // Some programs may not allow getProgramAccounts
          accountCount = -1
        }
      }

      const responseTime = Date.now() - startTime
      if (responseTime > 5000) {
        suspiciousActivity.push(`Slow response time: ${responseTime}ms`)
      }

    } catch (error: any) {
      // Handle connection errors with more detail
      const errorMessage = error?.message || 'Unknown error'
      if (errorMessage.includes('Failed to fetch') || errorMessage.includes('ECONNREFUSED')) {
        suspiciousActivity.push('Validator connection failed')
      } else {
        suspiciousActivity.push(`Connection error: ${errorMessage}`)
      }
    }

    return {
      programId: programInfo.programId,
      name: programInfo.name,
      isReachable,
      lastChecked: new Date(),
      accountCount,
      suspiciousActivity
    }
  }

  // Handle WebSocket alerts
  const handleWebSocketAlert = (alert: TransactionAlert) => {
    // Convert WebSocket alert to monitoring alert
    const monitoringAlert: MonitoringAlert = {
      id: `ws-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: alert.timestamp,
      type: alert.type === 'attack' ? 'attack' : 'security',
      severity: alert.severity,
      message: alert.details,
      program: alert.program,
      details: alert.metadata || {},
      attackVector: alert.type === 'attack' ? alert.details.split(':')[0] : undefined
    }

    addAlert(monitoringAlert)

    // Update metrics based on alert type
    if (alert.type === 'attack') {
      const currentAttacks = metrics.find(m => m.id === 'attack_attempts')?.value as number || 0
      updateMetric('attack_attempts', currentAttacks + 1, 'critical')
    }
    
    if (alert.type === 'suspicious') {
      const currentSuspicious = metrics.find(m => m.id === 'suspicious_activities')?.value as number || 0
      updateMetric('suspicious_activities', currentSuspicious + 1, 
        currentSuspicious < 5 ? 'warning' : 'critical')
    }
  }

  // Initialize WebSocket monitor
  const initializeWebSocketMonitor = async () => {
    if (!wsMonitorRef.current) {
      wsMonitorRef.current = new WebSocketMonitor(connection)
      
      // Set up event listeners
      wsMonitorRef.current.on('alert', handleWebSocketAlert)
      
      wsMonitorRef.current.on('stats-update', (stats) => {
        // Update metrics with real WebSocket stats
        updateMetric('total_accounts', stats.totalTransactions, 'normal')
        updateMetric('suspicious_activities', stats.suspiciousTransactions,
          stats.suspiciousTransactions === 0 ? 'normal' : 
          stats.suspiciousTransactions < 5 ? 'warning' : 'critical')
      })
      
      wsMonitorRef.current.on('monitoring-stopped', (finalStats) => {
        console.log('WebSocket monitoring stopped. Final stats:', finalStats)
        setWsConnected(false)
      })
    }
  }

  const monitorAttackTests = async () => {
    if (!enableAttackDetection) return

    // Use WebSocket monitor for real attack detection if available
    if (wsMonitorRef.current && wsConnected) {
      // Analyze historical transactions for each program
      for (const [programKey, programInfo] of Object.entries(PROGRAMS)) {
        try {
          const programId = new PublicKey(programInfo.programId)
          const analysis = await wsMonitorRef.current.analyzeHistoricalTransactions(programId, 50)
          
          if (analysis.suspiciousCount > 0) {
            addAlert({
              type: 'security',
              severity: analysis.suspiciousCount > 5 ? 'high' : 'medium',
              message: `Found ${analysis.suspiciousCount} suspicious transactions in ${programInfo.name}`,
              program: programInfo.name,
              details: { patterns: analysis.patterns }
            })
          }
        } catch (error) {
          console.error(`Failed to analyze ${programInfo.name}:`, error)
        }
      }
      
      // Update vulnerability metrics from WebSocket stats
      const stats = wsMonitorRef.current.getStats()
      updateMetric('attack_attempts', stats.attackPatterns.size, 
        stats.attackPatterns.size === 0 ? 'normal' : 
        stats.attackPatterns.size < 3 ? 'warning' : 'critical')
    } else {
      // Fallback to simulated monitoring
      console.log('WebSocket not connected, using simulated monitoring')
    }
  }

  const performSecurityScan = async () => {
    const startTime = Date.now()
    const results: ProgramHealth[] = []
    let totalAccounts = 0
    let onlinePrograms = 0
    let totalSuspiciousActivities = 0
    let failedChecks = 0

    try {
      // Run attack detection monitoring
      await monitorAttackTests()
      // Check network health first
      const slot = await connection.getSlot()
      if (slot > 0) {
        updateMetric('network_health', 'Online', 'normal')
      } else {
        updateMetric('network_health', 'Offline', 'critical')
        addAlert({
          type: 'availability',
          severity: 'critical',
          message: 'Network appears to be offline',
          program: 'Network',
          details: { slot }
        })
      }

      // Check each program
      for (const [programKey, programInfo] of Object.entries(PROGRAMS)) {
        try {
          const health = await checkProgramHealth(programKey, programInfo)
          results.push(health)

          if (health.isReachable) {
            onlinePrograms++
            if (health.accountCount > 0) {
              totalAccounts += health.accountCount
            }
          } else {
            failedChecks++
            addAlert({
              type: 'availability',
              severity: 'high',
              message: `${health.name} is not reachable`,
              program: health.name,
              details: { programId: health.programId }
            })
          }

          // Check for suspicious activities
          if (health.suspiciousActivity.length > 0) {
            totalSuspiciousActivities += health.suspiciousActivity.length
            health.suspiciousActivity.forEach(activity => {
              addAlert({
                type: 'security',
                severity: 'medium',
                message: `Suspicious activity in ${health.name}: ${activity}`,
                program: health.name,
                details: { activity, programId: health.programId }
              })
            })
          }

        } catch (error) {
          failedChecks++
          addAlert({
            type: 'performance',
            severity: 'medium',
            message: `Failed to check ${programInfo.name}: ${error}`,
            program: programInfo.name,
            details: { error }
          })
          
          // Show detailed error if needed
          const errorDetails = ErrorHandler.showErrorModal(error, `Checking ${programInfo.name}`)
          if (errorDetails.code === 'PROGRAM_NOT_DEPLOYED' || errorDetails.code === 'ACCOUNT_NOT_FOUND') {
            setErrorModalData(errorDetails)
            setIsErrorModalOpen(true)
          }
        }
      }

      // Update metrics
      const endTime = Date.now()
      const avgResponseTime = Math.round((endTime - startTime) / Object.keys(PROGRAMS).length)
      
      updateMetric('program_count', onlinePrograms, onlinePrograms === Object.keys(PROGRAMS).length ? 'normal' : 'warning')
      updateMetric('total_accounts', totalAccounts, 'normal')
      updateMetric('suspicious_activities', totalSuspiciousActivities, totalSuspiciousActivities === 0 ? 'normal' : totalSuspiciousActivities < 5 ? 'warning' : 'critical')
      updateMetric('avg_response_time', `${avgResponseTime}ms`, avgResponseTime < 1000 ? 'normal' : avgResponseTime < 5000 ? 'warning' : 'critical')
      updateMetric('failed_transactions', failedChecks, failedChecks === 0 ? 'normal' : failedChecks < 3 ? 'warning' : 'critical')

      setProgramHealth(results)

      // Report successful scan
      onTestResult({
        testType: 'monitoring',
        program: 'Security Monitor',
        description: `Security scan completed - ${onlinePrograms}/${Object.keys(PROGRAMS).length} programs online`,
        status: 'success',
        details: { 
          onlinePrograms, 
          totalAccounts, 
          suspiciousActivities: totalSuspiciousActivities,
          avgResponseTime 
        }
      })

    } catch (error: any) {
      addAlert({
        type: 'performance',
        severity: 'high',
        message: `Security scan failed: ${error.message}`,
        program: 'Security Monitor',
        details: { error }
      })
      
      // Handle critical errors
      await ErrorHandler.handle(error, 'Security scan')
    }
  }

  const startMonitoring = async () => {
    setIsMonitoring(true)
    
    // Initialize WebSocket monitor
    await initializeWebSocketMonitor()
    
    // Start WebSocket monitoring
    if (wsMonitorRef.current) {
      try {
        // Get programs for monitoring
        const programs: Program[] = []
        // Note: In real implementation, you would get actual Program instances
        // For now, we'll monitor the program IDs
        await wsMonitorRef.current.startMonitoring(programs)
        setWsConnected(true)
        
        addAlert({
          type: 'performance',
          severity: 'low',
          message: '🔌 WebSocket monitoring connected and active',
          program: 'WebSocket Monitor',
          details: { status: 'connected' }
        })
      } catch (error) {
        console.error('Failed to start WebSocket monitoring:', error)
        setWsConnected(false)
      }
    }
    
    performSecurityScan() // Initial scan
    
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }
    
    intervalRef.current = setInterval(() => {
      if (autoRefresh) {
        performSecurityScan()
      }
    }, monitoringInterval * 1000)
  }

  const stopMonitoring = async () => {
    setIsMonitoring(false)
    
    // Stop WebSocket monitoring
    if (wsMonitorRef.current) {
      await wsMonitorRef.current.stopMonitoring()
      setWsConnected(false)
    }
    
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }

  const clearAlerts = () => {
    setAlerts([])
    onTestResult({
      testType: 'monitoring',
      program: 'Security Monitor',
      description: 'All alerts cleared',
      status: 'info',
      details: {}
    })
  }

  useEffect(() => {
    initializeMetrics()
    return () => {
      // Cleanup
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
      if (wsMonitorRef.current) {
        wsMonitorRef.current.stopMonitoring()
      }
    }
  }, [])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'normal': return 'text-green-400'
      case 'warning': return 'text-yellow-400'
      case 'critical': return 'text-red-400'
      default: return 'text-gray-400'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'normal': return '✅'
      case 'warning': return '⚠️'
      case 'critical': return '🚨'
      default: return '❓'
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'low': return 'bg-blue-900 text-blue-300 border-blue-700'
      case 'medium': return 'bg-yellow-900 text-yellow-300 border-yellow-700'
      case 'high': return 'bg-orange-900 text-orange-300 border-orange-700'
      case 'critical': return 'bg-red-900 text-red-300 border-red-700'
      default: return 'bg-gray-800 text-gray-300 border-gray-700'
    }
  }

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'attack': return '🎯'
      case 'security': return '🔐'
      case 'performance': return '⚡'
      case 'availability': return '🔗'
      default: return '⚠️'
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-white mb-4">📊 Real-Time Security Monitor</h3>
        <p className="text-gray-400 text-sm mb-6">
          Monitor program health, detect suspicious activities, and track security metrics in real-time.
        </p>
      </div>

      {/* Monitor Controls */}
      <div className="bg-gray-800 rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-medium text-white">Monitoring Controls</h4>
          <div className="flex items-center space-x-2">
            <div className={`px-3 py-1 rounded-full text-xs font-medium ${
              isMonitoring ? 'bg-green-900 text-green-300 border border-green-700' : 'bg-gray-700 text-gray-300'
            }`}>
              {isMonitoring ? '🟢 Active' : '🔴 Inactive'}
            </div>
            {isMonitoring && (
              <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                wsConnected ? 'bg-blue-900 text-blue-300 border border-blue-700' : 'bg-gray-700 text-gray-300'
              }`}>
                {wsConnected ? '🔌 WebSocket Connected' : '🔌 WebSocket Disconnected'}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Scan Interval (seconds)</label>
            <input
              type="number"
              value={monitoringInterval}
              onChange={(e) => setMonitoringInterval(parseInt(e.target.value) || 30)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm"
              min="5"
              max="300"
            />
          </div>

          <div className="flex flex-col space-y-2">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded border-gray-600 text-defai-primary focus:ring-defai-primary focus:ring-offset-gray-800"
              />
              <span className="text-sm text-gray-300">Auto Refresh</span>
            </label>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={enableAttackDetection}
                onChange={(e) => setEnableAttackDetection(e.target.checked)}
                className="rounded border-gray-600 text-red-500 focus:ring-red-500 focus:ring-offset-gray-800"
              />
              <span className="text-sm text-gray-300">Attack Detection</span>
            </label>
          </div>

          <div className="flex items-end space-x-2">
            <button
              onClick={isMonitoring ? stopMonitoring : startMonitoring}
              className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                isMonitoring
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-green-600 hover:bg-green-700 text-white'
              }`}
            >
              {isMonitoring ? 'Stop' : 'Start'} Monitoring
            </button>
            <button
              onClick={performSecurityScan}
              disabled={isMonitoring}
              className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                isMonitoring
                  ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              Scan Now
            </button>
          </div>
        </div>
      </div>

      {/* Security Metrics */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h4 className="text-sm font-medium text-white mb-4">Security Metrics</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {metrics.map((metric) => (
            <div key={metric.id} className="bg-gray-700 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-400">{metric.name}</span>
                <span className="text-lg">{getStatusIcon(metric.status)}</span>
              </div>
              <div className={`text-lg font-semibold ${getStatusColor(metric.status)}`}>
                {metric.value}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {metric.lastUpdate.toLocaleTimeString()}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Attack Detection Summary */}
      {enableAttackDetection && attackTestResults.size > 0 && (
        <div className="bg-gray-800 rounded-lg p-4">
          <h4 className="text-sm font-medium text-white mb-4">🎯 Attack Detection Summary</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {Array.from(attackTestResults.entries()).map(([vector, report]) => (
              <div
                key={vector}
                className={`p-3 rounded-lg border ${
                  report.vulnerabilityFound
                    ? report.severity === 'critical'
                      ? 'bg-red-900 bg-opacity-20 border-red-700'
                      : report.severity === 'high'
                      ? 'bg-orange-900 bg-opacity-20 border-orange-700'
                      : 'bg-yellow-900 bg-opacity-20 border-yellow-700'
                    : 'bg-green-900 bg-opacity-20 border-green-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-white">
                    {vector.replace(/_/g, ' ').toUpperCase()}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    report.vulnerabilityFound
                      ? 'bg-red-800 text-red-300'
                      : 'bg-green-800 text-green-300'
                  }`}>
                    {report.vulnerabilityFound ? 'VULNERABLE' : 'SECURE'}
                  </span>
                </div>
                {report.vulnerabilityFound && (
                  <div className="text-xs text-gray-300 mt-1">
                    Confidence: {report.confidence}%
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Program Health Status */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h4 className="text-sm font-medium text-white mb-4">Program Health Status</h4>
        <div className="space-y-3">
          {programHealth.map((health) => (
            <div key={health.programId} className="bg-gray-700 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <span className="text-lg">
                    {health.isReachable ? '🟢' : '🔴'}
                  </span>
                  <div>
                    <span className="text-sm font-medium text-white">{health.name}</span>
                    <div className="text-xs text-gray-400">
                      {health.accountCount >= 0 ? `${health.accountCount} accounts` : 'Account count unavailable'}
                      {' • '}
                      Last checked: {health.lastChecked.toLocaleTimeString()}
                    </div>
                  </div>
                </div>
                <div className="text-xs text-gray-500">
                  {health.programId.slice(0, 8)}...
                </div>
              </div>
              {health.suspiciousActivity.length > 0 && (
                <div className="mt-2 space-y-1">
                  {health.suspiciousActivity.map((activity, i) => (
                    <div key={i} className="text-xs text-orange-400 bg-orange-900 bg-opacity-20 px-2 py-1 rounded">
                      ⚠️ {activity}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Recent Alerts */}
      {alerts.length > 0 && (
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-medium text-white">Recent Alerts ({alerts.length})</h4>
            <button
              onClick={clearAlerts}
              className="text-xs text-gray-400 hover:text-red-400 transition-colors"
            >
              Clear All
            </button>
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {alerts.slice(0, 10).map((alert) => (
              <div
                key={alert.id}
                className={`p-3 rounded-lg border ${getSeverityColor(alert.severity)} ${
                  alert.type === 'attack' ? 'animate-pulse' : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-lg">{getAlertIcon(alert.type)}</span>
                      <span className="text-xs px-2 py-1 rounded bg-opacity-50">
                        {alert.type.toUpperCase()}
                      </span>
                      <span className="text-xs">{alert.program}</span>
                    </div>
                    <p className="text-sm mt-1">{alert.message}</p>
                    
                    {/* Attack-specific details */}
                    {alert.attackVector && (
                      <div className="mt-2 text-xs">
                        <span className="text-gray-400">Attack Vector:</span>{' '}
                        <span className="text-red-400 font-medium">
                          {alert.attackVector.replace(/_/g, ' ').toUpperCase()}
                        </span>
                      </div>
                    )}
                    
                    {alert.vulnerabilityDetails && (
                      <div className="mt-2 space-y-1">
                        <div className="text-xs">
                          <span className="text-gray-400">Confidence:</span>{' '}
                          <span className="text-yellow-400">
                            {alert.vulnerabilityDetails.confidence}%
                          </span>
                        </div>
                        {alert.vulnerabilityDetails.recommendations.length > 0 && (
                          <div className="text-xs">
                            <span className="text-gray-400">Quick Fix:</span>{' '}
                            <span className="text-green-400">
                              {alert.vulnerabilityDetails.recommendations[0]}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="text-xs opacity-75">
                    {alert.timestamp.toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Info Panel */}
      <div className="bg-blue-900 bg-opacity-20 border border-blue-700 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <span className="text-blue-400 text-lg">ℹ️</span>
          <div>
            <p className="text-blue-400 font-semibold text-sm">Real-Time Monitoring</p>
            <p className="text-blue-300 text-xs mt-1">
              The security monitor continuously checks program health, response times, and suspicious activities.
              Adjust the scan interval based on your monitoring needs. Lower intervals provide more real-time data but use more resources.
            </p>
          </div>
        </div>
      </div>

      {/* Error Modal */}
      <ErrorModal
        error={errorModalData}
        isOpen={isErrorModalOpen}
        onClose={() => {
          setIsErrorModalOpen(false)
          setErrorModalData(null)
        }}
      />
    </div>
  )
} 