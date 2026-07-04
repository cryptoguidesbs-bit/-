'use client'

import * as Sentry from '@sentry/nextjs'
import { Component, type ErrorInfo, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'

interface Props {
  children: ReactNode
  /** Custom fallback UI. Receives a reset callback. */
  fallback?: (reset: () => void) => ReactNode
}

interface State {
  hasError: boolean
}

/**
 * Reusable client-side error boundary for widget/section-level isolation.
 * Route-level errors are handled by error.tsx / global-error.tsx.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    Sentry.captureException(error, { extra: { componentStack: errorInfo.componentStack } })
  }

  reset = () => this.setState({ hasError: false })

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback(this.reset)
      return (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center">
          <p className="text-sm text-muted-foreground">Something went wrong in this section.</p>
          <Button variant="outline" size="sm" onClick={this.reset}>
            Retry
          </Button>
        </div>
      )
    }

    return this.props.children
  }
}
