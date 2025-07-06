import '@/styles/globals.css'
import '@solana/wallet-adapter-react-ui/styles.css'
import type { AppProps } from 'next/app'
import { WalletContextProvider } from '@/components/WalletContextProvider'
import { Toaster } from 'react-hot-toast'

export default function App({ Component, pageProps }: AppProps) {
  return (
    <WalletContextProvider>
      <Component {...pageProps} />
      <Toaster 
        position="bottom-right"
        toastOptions={{
          style: {
            background: '#1A1A1A',
            color: '#fff',
            border: '1px solid #333',
          },
        }}
      />
    </WalletContextProvider>
  )
}