import { FC } from 'react'
import { CheckCircleIcon, XCircleIcon, ExclamationCircleIcon } from '@heroicons/react/24/solid'
import { TestResult } from '@/utils/program-test'
import { getTestImplementationStatus, formatImplementationStatus } from '@/utils/test-metadata'

interface Props {
  programName: string
  results: TestResult[]
  onClose: () => void
}

export const TestResults: FC<Props> = ({ programName, results, onClose }) => {
  const getIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />
      case 'failed':
        return <XCircleIcon className="h-5 w-5 text-red-500" />
      case 'error':
        return <ExclamationCircleIcon className="h-5 w-5 text-yellow-500" />
    }
  }

  const getStatusColor = (status: TestResult['status']) => {
    switch (status) {
      case 'success':
        return 'text-green-500'
      case 'failed':
        return 'text-red-500'
      case 'error':
        return 'text-yellow-500'
    }
  }

  const successCount = results.filter(r => r.status === 'success').length
  const totalCount = results.length
  const successRateNum = totalCount > 0 ? (successCount / totalCount * 100) : 0
  const successRate = successRateNum.toFixed(0)

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-defai-gray rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden">
        <div className="p-6 border-b border-gray-800">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-white">{programName} Test Results</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <XCircleIcon className="h-6 w-6" />
            </button>
          </div>
          <div className="mt-2 flex items-center space-x-4">
            <span className="text-sm text-gray-400">Success Rate:</span>
            <span className={`text-lg font-bold ${successRateNum >= 80 ? 'text-green-500' : successRateNum >= 50 ? 'text-yellow-500' : 'text-red-500'}`}>
              {successRate}%
            </span>
            <span className="text-sm text-gray-400">({successCount}/{totalCount} tests passed)</span>
          </div>
        </div>
        
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          <div className="space-y-4">
            {results.map((result, index) => (
              <div key={index} className="bg-black bg-opacity-50 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <div className="mt-0.5">{getIcon(result.status)}</div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-white">{result.scenario}</h3>
                      {(() => {
                        const testMeta = getTestImplementationStatus(result.scenario.toLowerCase().replace(/\s+/g, '_'));
                        if (testMeta) {
                          const statusFormat = formatImplementationStatus(testMeta.implementationStatus);
                          return (
                            <span className={`text-xs px-2 py-1 rounded ${statusFormat.color} bg-opacity-20`}>
                              {statusFormat.icon} {statusFormat.label}
                            </span>
                          );
                        }
                        return null;
                      })()}
                    </div>
                    <p className={`text-sm mt-1 ${getStatusColor(result.status)}`}>
                      {result.message}
                    </p>
                    {result.txSignature && (
                      <p className="text-xs text-gray-400 mt-2 font-mono">
                        Tx: {result.txSignature}
                      </p>
                    )}
                    {result.error && (
                      <details className="mt-2">
                        <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-300">
                          View Error Details
                        </summary>
                        <pre className="text-xs text-red-400 mt-2 overflow-x-auto">
                          {JSON.stringify(result.error, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}