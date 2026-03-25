import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'

const COLORS = ['#7C9E87','#9B7E5A','#6B8FAB','#A87C8C','#7A9BAB','#9E8F7C']
const avatarColor = n => COLORS[(n||'').charCodeAt(0) % COLORS.length]
const initials = n => (n||'?').split(' ').map(p=>p[0]).join('').slice(0,2).toUpperCase()
const EMPTY = { code:'', preferred_name:'', pronouns:'', age:'', modality:'', presenting_issue:'', referral_source:'', contracted_sessions:'', cultural_faith:'', language:'English', status:'active' }

export default function Patients() {
  const nav = useNavigate()
  const [patients, setPatients] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => { load() }, [])
  async function load() {
    setLoading(true)
    const r = await api.getPatients()
    if (r.data) setPatients(r.data)
    setLoading(false)
  }
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function submit(e) {
    e.preventDefault()
    if (!form.code.trim()) { setErr('Patient code is required'); return }
    setSaving(true); setErr('')
    const r = await api.createPatient(form)
    if (r.error) { setErr(r.error.message || 'Error saving'); setSaving(false); return }
    setSaving(false); setShowAdd(false); setForm(EMPTY); load()
  }

  const filtered = patients.filter(p =>
    !search || (p.code||'').toLowerCase().includes(search.toLowerCase()) ||
    (p.presenting_issue||'').toLowerCase().includes(search.toLowerCase()))

  return (
    <div>
      <div className="sec-header">
        <div>
          <div className="sec-title">Patients</div>
          <div className="sec-subtitle">{patients.length} case{patients.length !== 1 ? 's' : ''}</div>
        </div>
        <button className="btn btn-primary" onClick={() => { setForm(EMPTY); setErr(''); setShowAdd(true) }}>
          + New Patient
        </button>
      </div>

      <input style={{ maxWidth: 340, marginBottom: 18 }} placeholder="Search by code or presenting issue…"
        value={search} onChange={e => setSearch(e.target.value)} />

      {loading ? <div className="empty-state">Loading…</div>
      : filtered.length === 0 ? (
        <div className="empty-state">
          <div style={{ fontSize: 32, marginBottom: 10 }}>🗂</div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>No patients yet</div>
          <div style={{ fontSize: 13, color: 'var(--text-light)', marginBottom: 18 }}>Add your first patient to begin.</div>
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>Add Patient</button>
        </div>
      ) : (
        <div className="patient-grid">
          {filtered.map(p => (
            <div key={p.id} className="patient-card" onClick={() => nav(`/patients/${p.id}`)}>
              <div className="p-avatar" style={{ background: avatarColor(p.code) }}>{initials(p.code)}</div>
              <div className="p-name">{p.code}</div>
              <div className="p-meta">{p.modality || 'No modality'} · {p.status}</div>
              {p.presenting_issue && <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 8, lineHeight: 1.5 }}>{p.presenting_issue.slice(0,80)}{p.presenting_issue.length>80?'…':''}</div>}
              <div style={{ marginTop: 12, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {p.contracted_sessions && <span className="tag tag-sm">{p.contracted_sessions} sessions</span>}
                {p.language && p.language !== 'English' && <span className="tag tag-muted tag-sm">{p.language}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowAdd(false)}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">New Patient</span>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowAdd(false)}>✕</button>
            </div>
            <form onSubmit={submit}>
              <div className="modal-body">
                {err && <div style={{ color: 'var(--danger)', fontSize: 12.5, marginBottom: 12 }}>{err}</div>}
                <div className="form-row">
                  <div className="form-group"><label className="form-label">Patient Code *</label>
                    <input placeholder="e.g. P-042" value={form.code} onChange={e => set('code', e.target.value)} /></div>
                  <div className="form-group"><label className="form-label">Preferred Name</label>
                    <input placeholder="Optional" value={form.preferred_name} onChange={e => set('preferred_name', e.target.value)} /></div>
                </div>
                <div className="form-row">
                  <div className="form-group"><label className="form-label">Pronouns</label>
                    <input placeholder="they/them, she/her…" value={form.pronouns} onChange={e => set('pronouns', e.target.value)} /></div>
                  <div className="form-group"><label className="form-label">Age / DOB</label>
                    <input placeholder="32 or 1992-01-01" value={form.age} onChange={e => set('age', e.target.value)} /></div>
                </div>
                <div className="form-group"><label className="form-label">Presenting Issue at Intake</label>
                  <textarea rows={3} value={form.presenting_issue} onChange={e => set('presenting_issue', e.target.value)} /></div>
                <div className="form-row">
                  <div className="form-group"><label className="form-label">Modality</label>
                    <select value={form.modality} onChange={e => set('modality', e.target.value)}>
                      <option value="">Select…</option>
                      {['CBT','ACT','DBT','Psychodynamic','Person-Centred','Integrative','Solution-Focused','Narrative','EMDR','Coaching','Other'].map(m=><option key={m}>{m}</option>)}
                    </select></div>
                  <div className="form-group"><label className="form-label">Referral Source</label>
                    <input placeholder="GP, self-referral…" value={form.referral_source} onChange={e => set('referral_source', e.target.value)} /></div>
                </div>
                <div className="form-row">
                  <div className="form-group"><label className="form-label">Contracted Sessions</label>
                    <input type="number" min="1" placeholder="12" value={form.contracted_sessions} onChange={e => set('contracted_sessions', e.target.value)} /></div>
                  <div className="form-group"><label className="form-label">Language</label>
                    <input placeholder="English" value={form.language} onChange={e => set('language', e.target.value)} /></div>
                </div>
                <div className="form-group"><label className="form-label">Cultural / Faith Context</label>
                  <input placeholder="Optional — relevant background" value={form.cultural_faith} onChange={e => set('cultural_faith', e.target.value)} /></div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Create Patient'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
