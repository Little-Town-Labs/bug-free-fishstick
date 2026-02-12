'use client'

import React from 'react'

interface Props {
  children: React.ReactNode
  fallback?: React.ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div
            role="alert"
            data-testid="error-boundary-fallback"
            className="p-4 border rounded-md bg-destructive/10 text-destructive"
          >
            <p className="font-medium">Something went wrong.</p>
            <p className="text-sm mt-1">Please refresh the page or try again.</p>
          </div>
        )
      )
    }
    return this.props.children
  }
}
