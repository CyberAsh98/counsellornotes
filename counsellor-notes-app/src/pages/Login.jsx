import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Login() {
  const { signIn, signUp } = useAuth()
  const nav = useNavigate()
  const [mode, setMode] = useState('login') // 'login' | 'register'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [registered, setRegistered] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      if (mode === 'login') {
        const { error } = await signIn(email, password)
        if (error) throw error
        nav('/')
      } else {
        if (!fullName.trim()) throw new Error('Please enter your full name')
        const { error } = await signUp(email, password, fullName)
        if (error) throw error
        setRegistered(true)
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  if (registered) return (
    <div className="lock-screen">
      <div className="lock-card" style={{ textAlign: 'center', padding: '48px 40px' }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>✉️</div>
        <h2 style={{ marginBottom: 8 }}>Check your email</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
          We've sent a confirmation link to <strong>{email}</strong>.
          Verify your email then sign in.
        </p>
        <button className="btn btn-ghost" style={{ marginTop: 20 }} onClick={() => { setRegistered(false); setMode('login') }}>
          Back to sign in
        </button>
      </div>
    </div>
  )

  return (
    <div className="lock-screen active">
      <div className="lock-card">
        <div className="lock-logo">
          <div className="lock-logo-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
          <h1>Counsellor Notes</h1>
        </div>
        <p className="lock-subtitle">{mode === 'login' ? 'Sign in to your workspace' : 'Create your account'}</p>

        <form onSubmit={submit}>
          {mode === 'register' && (
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Your full name" required />
            </div>
          )}
          <div className="form-group">
            <label className="form-label">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder={mode === 'register' ? 'Min 8 characters' : '••••••••'} minLength={8} required />
          </div>
          {error && <div className="lock-error" style={{ marginBottom: 12 }}>{error}</div>}
          <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}>
            {loading ? '…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', marginTop: 16 }}>
          {mode === 'login' ? "Don't have an account? " : 'Already registered? '}
          <button className="btn btn-ghost btn-sm" style={{ padding: '0 4px' }} onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }}>
            {mode === 'login' ? 'Register' : 'Sign in'}
          </button>
        </p>
        <p className="lock-hint" style={{ marginTop: 8, textAlign: 'center' }}>Private workspace — data never shared</p>
      </div>
    </div>
  )
}
