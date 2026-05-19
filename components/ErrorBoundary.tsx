'use client'
import React from 'react'
import * as Sentry from '@sentry/nextjs'

interface Props {
  children: React.ReactNode
  fallbackTitle?: string
}

interface State {
  hasError: boolean
  eventId?: string
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    const eventId = Sentry.captureException(error, {
      extra: { componentStack: info.componentStack },
    })
    this.setState({ eventId })
  }

  handleReload = () => {
    this.setState({ hasError: false, eventId: undefined })
    window.location.reload()
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
          padding: 32,
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
        <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 800, color: '#f8fbff' }}>
          {this.props.fallbackTitle ?? 'Etwas ist schiefgelaufen'}
        </h2>
        <p style={{ margin: '0 0 24px', color: '#aeb9c8', fontSize: 14, maxWidth: 400 }}>
          Ein unerwarteter Fehler ist aufgetreten. Das Team wurde automatisch benachrichtigt.
          {this.state.eventId && (
            <span style={{ display: 'block', marginTop: 6, fontSize: 11, opacity: 0.6 }}>
              Fehler-ID: {this.state.eventId}
            </span>
          )}
        </p>
        <button
          className="pk-btn"
          onClick={this.handleReload}
          style={{ minWidth: 140 }}
        >
          Neu laden
        </button>
      </div>
    )
  }
}
