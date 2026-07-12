import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}
interface State {
  error: Error | null
}

/** Surfaces any render/runtime error instead of a blank white screen. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error) {
    console.error('Erreur applicative :', error)
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, fontFamily: 'system-ui, sans-serif' }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#b91c1c' }}>
            Une erreur est survenue
          </h1>
          <p style={{ marginTop: 8, color: '#334155' }}>
            L'application a rencontré un problème. Détail technique :
          </p>
          <pre
            style={{
              marginTop: 12,
              padding: 12,
              background: '#f1f5f9',
              borderRadius: 8,
              overflow: 'auto',
              fontSize: 13,
              color: '#0f172a',
            }}
          >
            {this.state.error.message}
            {'\n\n'}
            {this.state.error.stack}
          </pre>
          <button
            onClick={() => this.setState({ error: null })}
            style={{
              marginTop: 12,
              padding: '6px 14px',
              background: '#0f172a',
              color: 'white',
              borderRadius: 6,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Réessayer
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
