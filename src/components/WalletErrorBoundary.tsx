'use client'

import { Component, ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class WalletErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    // Catch ethereum redefinition errors
    if (error.message?.includes('ethereum') || error.message?.includes('Cannot redefine')) {
      return { hasError: true, error }
    }
    throw error
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.warn('[WalletErrorBoundary] Caught wallet conflict:', error.message)
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0a0e17]/95 p-4">
          <div className="max-w-md rounded-2xl border border-[#f59e0b]/30 bg-[#0f1724] p-6 text-center">
            <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-[#f59e0b]" />
            <h2 className="mb-2 text-lg font-bold text-[#e2e8f0]">Wallet Conflict Detected</h2>
            <p className="mb-4 text-sm text-[#94a3b8]">
              Multiple wallet extensions (MetaMask, Rainbow, etc.) are conflicting with each other.
              This is a known browser extension issue.
            </p>
            <div className="mb-4 rounded-lg border border-[#1e293b] bg-[#0a0e17] p-3 text-left text-xs text-[#64748b]">
              <p className="font-semibold text-[#94a3b8]">Fix:</p>
              <ol className="mt-1 list-decimal pl-4 space-y-1">
                <li>Disable all wallet extensions except one</li>
                <li>Or use a browser profile with only your preferred wallet</li>
                <li>Then refresh this page</li>
              </ol>
            </div>
            <button
              onClick={this.handleRetry}
              className="flex items-center justify-center gap-2 rounded-xl bg-[#00ff41]/10 px-6 py-2.5 text-sm font-bold text-[#00ff41] transition-all hover:bg-[#00ff41]/20 mx-auto"
            >
              <RefreshCw className="h-4 w-4" />
              Retry
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
