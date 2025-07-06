import { FC } from 'react'
import { CheckCircleIcon, ExclamationCircleIcon, XCircleIcon } from '@heroicons/react/24/solid'

interface Props {
  name: string
  programId: string
  readiness: number
  status: string
  features: string[]
  onTest: () => void
  isLoading?: boolean
}

export const ProgramCard: FC<Props> = ({ 
  name, 
  programId, 
  readiness, 
  status, 
  features, 
  onTest,
  isLoading 
}) => {
  const getStatusIcon = () => {
    if (readiness >= 9) return <CheckCircleIcon className="h-6 w-6 text-green-500" />
    if (readiness >= 7) return <ExclamationCircleIcon className="h-6 w-6 text-yellow-500" />
    return <XCircleIcon className="h-6 w-6 text-red-500" />
  }

  const getStatusColor = () => {
    if (readiness >= 9) return 'text-green-500'
    if (readiness >= 7) return 'text-yellow-500'
    return 'text-red-500'
  }

  return (
    <div className="bg-defai-gray rounded-lg p-6 border border-gray-800 hover:border-defai-primary transition-colors">
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-xl font-semibold text-white">{name}</h3>
        <div className="flex items-center space-x-2">
          {getStatusIcon()}
          <span className={`font-bold ${getStatusColor()}`}>{readiness}/10</span>
        </div>
      </div>
      
      <div className="space-y-3 mb-4">
        <div>
          <p className="text-sm text-gray-400">Program ID</p>
          <p className="text-xs font-mono text-gray-300 break-all">{programId}</p>
        </div>
        
        <div>
          <p className="text-sm text-gray-400">Status</p>
          <p className={`font-medium ${getStatusColor()}`}>{status}</p>
        </div>
        
        <div>
          <p className="text-sm text-gray-400 mb-2">Features</p>
          <div className="flex flex-wrap gap-2">
            {features.map((feature, i) => (
              <span key={i} className="text-xs bg-gray-800 text-gray-300 px-2 py-1 rounded">
                {feature}
              </span>
            ))}
          </div>
        </div>
      </div>
      
      <button
        onClick={onTest}
        disabled={isLoading}
        className="w-full bg-defai-primary text-black font-semibold py-2 px-4 rounded hover:bg-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isLoading ? 'Testing...' : 'Run Security Tests'}
      </button>
    </div>
  )
}