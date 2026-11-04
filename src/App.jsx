import { useEffect, useState } from 'react'
import Dashboard from './Dashboard.jsx'
import './App.css'

function App() {
  const [user, setUser] = useState(null)
  const [status, setStatus] = useState('loading')
  const [signingOut, setSigningOut] = useState(false)
  const [message, setMessage] = useState(() => {
    const authError = new URLSearchParams(window.location.search).get('authError')
    if (!authError) return ''
    return authError === 'cancelled'
      ? 'Sign-in was cancelled. You can try again when you are ready.'
      : 'We could not sign you in with Google. Please try again.'
  })

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.has('authError')) {
      window.history.replaceState({}, '', window.location.pathname)
    }

    fetch('/api/me')
      .then(async (response) => {
        if (response.status === 401) {
          window.history.replaceState({}, '', '/')
          setStatus('signed-out')
          return
        }
        if (!response.ok) {
          throw new Error(`Session check failed with HTTP ${response.status}.`)
        }

        const result = await response.json()
        window.history.replaceState({}, '', '/dashboard')
        setUser(result.user)
        setStatus('signed-in')
      })
      .catch((error) => {
        console.error('Unable to check the sign-in session:', error)
        setMessage('We could not check your sign-in status. Please refresh and try again.')
        setStatus('error')
      })
  }, [])

  async function handleSignOut() {
    setSigningOut(true)
    setMessage('')
    try {
      const response = await fetch('/api/logout', { method: 'POST' })
      if (!response.ok) {
        throw new Error(`Sign-out failed with HTTP ${response.status}.`)
      }
      setUser(null)
      setStatus('signed-out')
      window.history.replaceState({}, '', '/')
    } catch (error) {
      console.error('Unable to sign out:', error)
      setMessage('We could not sign you out. Please try again.')
    } finally {
      setSigningOut(false)
    }
  }

  if (status === 'signed-in' && user) {
    return (
      <Dashboard
        user={user}
        onSignOut={handleSignOut}
        signingOut={signingOut}
        message={message}
      />
    )
  }

  return (
    <main className="login-shell">
      <section className="welcome-panel" aria-label="Vijay Portal introduction">
        <div className="brand-mark" aria-hidden="true">
          <span></span>
          <span></span>
        </div>
        <p className="eyebrow">Vijay Portal / Member portal</p>
        <div className="welcome-copy">
          <p className="season-label">Your space to slow down</p>
          <h1>Come back to what feels good.</h1>
          <p className="welcome-text">
            Your saved rituals, considered essentials, and a little more room
            to breathe are waiting inside.
          </p>
        </div>
        <div className="panel-footer">
          <span className="footer-line"></span>
          <p>Est. 2018 <span aria-hidden="true">/</span> Quietly made for living well</p>
        </div>
      </section>

      <section className="form-panel" aria-labelledby="login-title">
        <div className="form-wrap">
          <div className="mobile-brand">
            <div className="brand-mark" aria-hidden="true"><span></span><span></span></div>
            <span>Vijay Portal</span>
          </div>
          <div className="form-heading">
            <p className="eyebrow">Member sign in</p>
            <h2 id="login-title">Welcome back<span>.</span></h2>
            <p>Sign in securely with your Google account.</p>
          </div>

          <div className="login-form" aria-live="polite">
            {status === 'loading' && <p className="auth-status">Checking your sign-in status…</p>}
            {status === 'signed-out' && (
              <a className="google-button" href="/auth/google">
                <span className="google-mark" aria-hidden="true">G</span>
                <span>Continue with Google</span>
              </a>
            )}
            {message && <p className="auth-message" role="alert">{message}</p>}
          </div>

          <p className="signup-prompt">Your Google account identifies your secure portal session.</p>
          <p className="form-note">By continuing, you agree to our <a href="#terms">terms</a> and <a href="#privacy">privacy policy</a>.</p>
        </div>
      </section>
    </main>
  )
}

export default App
