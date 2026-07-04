'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

// Last-resort error UI (500). Replaces the root layout when it crashes,
// so it must render its own <html>/<body> and cannot use next-intl.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="ko" className="dark">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1rem',
          background: '#0a0f1e',
          color: '#f8fafc',
          fontFamily: 'system-ui, sans-serif',
          textAlign: 'center',
          padding: '2rem',
        }}
      >
        <p style={{ fontSize: '3rem', fontWeight: 700, opacity: 0.3, margin: 0 }}>500</p>
        <h1 style={{ margin: 0 }}>문제가 발생했습니다 / Something went wrong</h1>
        <p style={{ opacity: 0.7, margin: 0 }}>
          일시적인 오류입니다. 잠시 후 다시 시도해 주세요.
        </p>
        <button
          onClick={reset}
          style={{
            marginTop: '0.5rem',
            padding: '0.6rem 1.4rem',
            borderRadius: '0.5rem',
            border: 'none',
            background: '#3b82f6',
            color: 'white',
            fontSize: '1rem',
            cursor: 'pointer',
          }}
        >
          다시 시도 / Try again
        </button>
      </body>
    </html>
  )
}
