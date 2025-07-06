import { FC } from 'react'
import { SECURITY_CHECKS } from '@/utils/constants'
import { CheckIcon, XMarkIcon } from '@heroicons/react/24/solid'

interface Props {
  programName: string
  implementedChecks: string[]
}

export const SecurityOverview: FC<Props> = ({ programName, implementedChecks }) => {
  return (
    <div className="bg-defai-gray rounded-lg p-6 border border-gray-800">
      <h3 className="text-lg font-semibold text-white mb-4">Security Checklist - {programName}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {SECURITY_CHECKS.map((check) => {
          const isImplemented = implementedChecks.includes(check)
          return (
            <div key={check} className="flex items-center space-x-2">
              {isImplemented ? (
                <CheckIcon className="h-5 w-5 text-green-500 flex-shrink-0" />
              ) : (
                <XMarkIcon className="h-5 w-5 text-red-500 flex-shrink-0" />
              )}
              <span className={`text-sm ${isImplemented ? 'text-gray-300' : 'text-gray-500'}`}>
                {check}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}