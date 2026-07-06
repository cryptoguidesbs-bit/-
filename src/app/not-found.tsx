// Root not-found boundary — required so notFound() responses carry a real
// 404 status. Lives outside the [locale] layout, so it renders its own html.
export default function RootNotFound() {
  return (
    <html lang="en" className="dark">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0a0f1c',
          color: '#e2e8f0',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 48, fontWeight: 700, margin: 0 }}>404</p>
          <p style={{ color: '#94a3b8' }}>Page not found</p>
          <a href="/" style={{ color: '#60a5fa' }}>
            Home
          </a>
        </div>
      </body>
    </html>
  )
}
