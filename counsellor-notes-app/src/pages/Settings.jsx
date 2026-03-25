import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../lib/api'

export default function Settings() {
  const { session, signOut, enrollMFA, verifyMFA } = useAuth()
  const [tab, setTab] = useState('account')
  const [audit, setAudit] = useState([])
  const [auditLoading, setAuditLoading] = useState(false)
  const [mfaUri, setMfaUri] = useState(null)
  const [mfaFactorId, setMfaFactorId] = useState(null)
  const [mfaCode, setMfaCode] = useState('')
  const [mfaStatus, setMfaStatus] = useState('')
  const [mfaError, setMfaError] = useState('')

  useEffect(() => {
    if (tab === 'audit') loadAudit()
  }, [tab])

  async function loadAudit() {
    setAuditLoading(true)
    const r = await api.getAudit()
    if (r.data) setAudit(r.data)
    setAuditLoading(false)
  }

  async function startMFA() {
    setMfaError(''); setMfaStatus('enrolling')
    const r = await enrollMFA()
    if (r.error) { setMfaError(r.error.message); setMfaStatus(''); return }
    setMfaUri(r.totp?.uri)
    setMfaFactorId(r.id)
    setMfaStatus('verify')
  }

  async function confirmMFA() {
    setMfaError('')
    const r = await verifyMFA(mfaFactorId, mfaCode)
    if (r.error) { setMfaError(r.error.message); return }
    setMfaStatus('done'); setMfaUri(null); setMfaCode('')
  }

  return (
    <div>
      <div className="page-header">
        <div className="sec-title">Settings</div>
        <div className="sec-subtitle">Account, security, and audit trail</div>
      </div>

      <div className="tabs">
        {[['account','Account'],['security','Security & MFA'],['audit','Audit Log']].map(([k,l])=>(
          <button key={k} className={`tab${tab===k?' active':''}`} onClick={()=>setTab(k)}>{l}</button>
        ))}
      </div>

      {/* ── Account ── */}
      {tab === 'account' && (
        <div style={{ maxWidth: 480 }}>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header"><span className="card-title">Logged In As</span></div>
            <div className="card-body">
              <div className="field"><div className="field-label">Email</div>
                <div className="field-value">{session?.user?.email || '—'}</div></div>
              <div className="field"><div className="field-label">User ID</div>
                <div className="field-value" style={{ fontFamily:'monospace', fontSize:11.5 }}>{session?.user?.id || '—'}</div></div>
              <div className="field"><div className="field-label">Role</div>
                <div className="field-value">{session?.user?.user_metadata?.role || 'therapist'}</div></div>
            </div>
          </div>
          <button className="btn btn-danger-soft" onClick={signOut}>Sign Out</button>
        </div>
      )}

      {/* ── Security & MFA ── */}
      {tab === 'security' && (
        <div style={{ maxWidth: 500 }}>
          <div className="card">
            <div className="card-header"><span className="card-title">Two-Factor Authentication (TOTP)</span></div>
            <div className="card-body">
              {mfaStatus === '' && (
                <>
                  <p style={{ fontSize:13, color:'var(--text-muted)', marginBottom:16, lineHeight:1.6 }}>
                    Add an extra layer of protection using an authenticator app (Google Authenticator, Authy, 1Password, etc.).
                  </p>
                  <button className="btn btn-primary" onClick={startMFA}>Enable 2FA</button>
                </>
              )}
              {mfaStatus === 'enrolling' && <div>Generating QR code…</div>}
              {mfaStatus === 'verify' && (
                <div>
                  <p style={{ fontSize:13, color:'var(--text-muted)', marginBottom:12 }}>Scan this QR code in your authenticator app, then enter the 6-digit code to confirm.</p>
                  {mfaUri && (
                    <div style={{ marginBottom:16, padding:12, background:'#f8f8f8', borderRadius:8, display:'inline-block' }}>
                      <img src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(mfaUri)}`} alt="TOTP QR" width={160} height={160} />
                    </div>
                  )}
                  <div className="form-group"><label className="form-label">6-digit code</label>
                    <input placeholder="123456" maxLength={6} value={mfaCode} onChange={e=>setMfaCode(e.target.value)} style={{ maxWidth:160 }} /></div>
                  {mfaError && <div style={{ color:'var(--danger)', fontSize:12.5, marginBottom:8 }}>{mfaError}</div>}
                  <button className="btn btn-primary" onClick={confirmMFA} disabled={mfaCode.length < 6}>Confirm & Enable</button>
                </div>
              )}
              {mfaStatus === 'done' && (
                <div style={{ color:'var(--accent-hover)', fontWeight:500 }}>✓ 2FA enabled successfully.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Audit Log ── */}
      {tab === 'audit' && (
        <div>
          <div className="card">
            <div className="card-header">
              <span className="card-title">Audit Trail</span>
              <button className="btn btn-ghost btn-sm" onClick={loadAudit}>Refresh</button>
            </div>
            <div className="card-body-sm">
              {auditLoading ? <div className="empty-state">Loading…</div>
              : audit.length === 0 ? <div className="field-empty">No audit events recorded yet.</div>
              : (
                <table style={{ width:'100%', fontSize:12.5, borderCollapse:'collapse' }}>
                  <thead>
                    <tr style={{ color:'var(--text-muted)', textAlign:'left' }}>
                      <th style={{ padding:'6px 10px' }}>Time</th>
                      <th style={{ padding:'6px 10px' }}>Action</th>
                      <th style={{ padding:'6px 10px' }}>Table</th>
                      <th style={{ padding:'6px 10px' }}>Row</th>
                    </tr>
                  </thead>
                  <tbody>
                    {audit.map((a,i) => (
                      <tr key={i} style={{ borderTop:'1px solid var(--border)' }}>
                        <td style={{ padding:'8px 10px', whiteSpace:'nowrap', color:'var(--text-muted)' }}>{new Date(a.created_at).toLocaleString()}</td>
                        <td style={{ padding:'8px 10px' }}><span className={`tag tag-sm ${a.action==='DELETE'?'tag-warning':''}`}>{a.action}</span></td>
                        <td style={{ padding:'8px 10px', fontFamily:'monospace', fontSize:11.5 }}>{a.table_name}</td>
                        <td style={{ padding:'8px 10px', fontFamily:'monospace', fontSize:11.5, color:'var(--text-muted)' }}>{a.row_id?.slice(0,8)}…</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
