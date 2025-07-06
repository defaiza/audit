import { FC, ReactNode } from 'react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { ShieldCheckIcon } from '@heroicons/react/24/solid'

interface Props {
  children: ReactNode
}

export const Layout: FC<Props> = ({ children }) => {
  return (
    <div className="min-h-screen bg-defai-dark">
      <header className="border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <ShieldCheckIcon className="h-8 w-8 text-defai-primary" />
              <h1 className="text-xl font-bold text-white">DeFAI Security Auditor</h1>
            </div>
            <WalletMultiButton />
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  )
}