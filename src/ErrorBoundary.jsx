import { Component } from 'react'

export default class ErrorBoundary extends Component {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error, errorInfo) {
    if (import.meta.env.DEV) console.error('Application render failed.', error, errorInfo)
    if (import.meta.env.PROD) {
      fetch('/api/client-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        keepalive: true,
        body: JSON.stringify({
          message: String(error?.message || 'Application render failed').slice(0, 500),
          componentStack: String(errorInfo?.componentStack || '').slice(0, 3000),
          path: window.location.pathname.slice(0, 500),
        }),
      }).catch(() => {})
    }
  }

  render() {
    if (!this.state.failed) return this.props.children

    return (
      <main className="fatal-error" role="alert">
        <div>
          <p>PURE HEALTH PEPTIDES</p>
          <h1>We couldn’t load this page.</h1>
          <p>Please refresh the page. If the problem continues, contact info@purehealthpeptidesshop.com.</p>
          <button type="button" onClick={() => window.location.reload()}>REFRESH PAGE</button>
        </div>
      </main>
    )
  }
}
