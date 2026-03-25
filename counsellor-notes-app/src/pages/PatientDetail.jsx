import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'

const COLORS = ['#7C9E87','#9B7E5A','#6B8FAB','#A87C8C','#7A9BAB','#9E8F7C']
const avatarColor = n => COLORS[(n||'').charCodeAt(0) % COLORS.length]
const initials = n => (n||'?').split(' ').map(p=>p[0]).join('').slice(0,2).toUpperCase()
const fmt = d => d ? new Date(d).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}) : '—'

const TABS = ['Overview','Sessions','Timeline','Goals','Inter-Session','Insights','Risk','Snapshot','Export']

const EMPTY_SESSION = { date: new Date().toISOString().slice(0,10), session_number:'', format:'in-person', arrive_state:'', leave_state:'', theme:'', intervention:'', effective:'', alliance_note:'', homework:'', risk_status:'green', notes:'' }

export default function PatientDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const [patient, setPatient] = useState(null)
  const [sessions, setSessions] = useState([])
  const [history, setHistory] = useState([])
  const [insights, setInsights] = useState(null)
  const [tab, setTab] = useState('Overview')
  const [loading, setLoading] = useState(true)
  const [showSession, setShowSession] = useState(false)
  const [sesForm, setSesForm] = useState(EMPTY_SESSION)
  const [saving, setSaving] = useState(false)
  const [insightText, setInsightText] = useState('')
  const [insightSaving, setInsightSaving] = useState(false)

  useEffect(() => { loadAll() }, [id])

  async function loadAll() {
    setLoading(true)
    const [pr, sr, hr, ir] = await Promise.all([
      api.getPatient ? api.getPatient(id) : api.getPatients().then(r=>({data:(r.data||[]).find(p=>p.id===id)})),
      api.getSessions(id),
      api.getHistory(id),
      api.getInsights(id)
    ])
    if (pr.data) setPatient(pr.data)
    if (sr.data) setSessions(sr.data)
    if (hr.data) setHistory(hr.data)
    if (ir.data) { setInsights(ir.data); setInsightText(ir.data?.notes || '') }
    setLoading(false)
  }

  const setSes = (k,v) => setSesForm(f=>({...f,[k]:v}))

  async function submitSession(e) {
    e.preventDefault(); setSaving(true)
    const r = await api.createSession(id, sesForm)
    if (!r.error) { setShowSession(false); setSesForm(EMPTY_SESSION); loadAll() }
    setSaving(false)
  }

  async function saveInsights() {
    setInsightSaving(true)
    await api.saveInsights(id, { notes: insightText })
    setInsightSaving(false)
  }

  if (loading) return <div className="empty-state">Loading…</div>
  if (!patient) return <div className="empty-state">Patient not found. <button className="btn btn-ghost" onClick={()=>nav('/patients')}>Back</button></div>

  const lastSession = sessions[0]
  const sessionCount = sessions.length
  const contractedLeft = patient.contracted_sessions ? patient.contracted_sessions - sessionCount : null

  return (
    <div>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:20 }}>
        <button className="btn btn-ghost btn-sm" onClick={()=>nav('/patients')}>← Patients</button>
      </div>
      <div className="patient-header">
        <div className="ph-avatar" style={{ background: avatarColor(patient.code) }}>{initials(patient.code)}</div>
        <div style={{ flex:1 }}>
          <div className="ph-name">{patient.code}{patient.preferred_name ? ` (${patient.preferred_name})` : ''}</div>
          <div className="ph-meta">{patient.modality || '—'} · {patient.status} {patient.pronouns ? `· ${patient.pronouns}` : ''}</div>
        </div>
        <button className="btn btn-primary" onClick={()=>{setSesForm(EMPTY_SESSION);setShowSession(true)}}>+ New Session</button>
      </div>

      {/* Tabs */}
      <div className="tabs">
        {TABS.map(t => <button key={t} className={`tab${tab===t?' active':''}`} onClick={()=>setTab(t)}>{t}</button>)}
      </div>

      {/* ── Overview ── */}
      {tab === 'Overview' && (
        <div className="grid-2">
          <div>
            <div className="card" style={{ marginBottom:16 }}>
              <div className="card-body">
                <div className="grid-2" style={{ gap:14 }}>
                  {[['Presenting Issue', patient.presenting_issue],['Referral Source', patient.referral_source],
                    ['Contracted Sessions', patient.contracted_sessions ? `${patient.contracted_sessions} (${contractedLeft} remaining)` : null],
                    ['Language', patient.language],['Cultural / Faith', patient.cultural_faith],
                    ['Age / DOB', patient.age]].map(([l,v]) => (
                    <div key={l} className="field">
                      <div className="field-label">{l}</div>
                      <div className={v ? 'field-value' : 'field-empty'}>{v || 'Not recorded'}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div>
            <div className="grid-2" style={{ gap:12, marginBottom:16 }}>
              <div className="stat-card"><div className="stat-value">{sessionCount}</div><div className="stat-label">Sessions</div></div>
              <div className="stat-card"><div className="stat-value">{contractedLeft ?? '—'}</div><div className="stat-label">Remaining</div></div>
            </div>
            <div className="card">
              <div className="card-header"><span className="card-title">Last Session</span></div>
              <div className="card-body-sm">
                {lastSession ? (
                  <>
                    <div className="field"><div className="field-label">Date</div><div className="field-value">{fmt(lastSession.date)}</div></div>
                    <div className="field"><div className="field-label">Theme</div><div className="field-value">{lastSession.theme || '—'}</div></div>
                    <div className="field"><div className="field-label">Risk</div>
                      <div><span className={`tag tag-sm ${lastSession.risk_status==='red'?'risk-flag-badge':lastSession.risk_status==='amber'?'tag-warning':''}`}>{lastSession.risk_status||'green'}</span></div>
                    </div>
                  </>
                ) : <div className="field-empty">No sessions yet</div>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Sessions ── */}
      {tab === 'Sessions' && (
        <div>
          {sessions.length === 0 ? <div className="empty-state">No sessions recorded yet.</div> : (
            <div className="gap-stack">
              {sessions.map((s,i) => (
                <div key={s.id} className="card">
                  <div className="card-header">
                    <span className="card-title">Session {sessions.length - i} — {fmt(s.date)}</span>
                    <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                      {s.risk_status === 'red' && <span className="risk-flag-badge">⚠ Risk</span>}
                      <span className="tag tag-muted tag-sm">{s.format || 'in-person'}</span>
                    </div>
                  </div>
                  <div className="card-body-sm">
                    <div className="grid-2" style={{ gap:12 }}>
                      {s.theme && <div className="field"><div className="field-label">Theme</div><div className="field-value">{s.theme}</div></div>}
                      {s.intervention && <div className="field"><div className="field-label">Intervention</div><div className="field-value">{s.intervention}</div></div>}
                      {s.arrive_state && <div className="field"><div className="field-label">Arrived as</div><div className="field-value">{s.arrive_state}</div></div>}
                      {s.leave_state && <div className="field"><div className="field-label">Left as</div><div className="field-value">{s.leave_state}</div></div>}
                    </div>
                    {s.notes && <div className="field" style={{ marginTop:10 }}><div className="field-label">Notes</div><div className="field-value" style={{ whiteSpace:'pre-wrap' }}>{s.notes}</div></div>}
                    {s.homework && <div className="field" style={{ marginTop:8 }}><div className="field-label">Homework</div><div className="field-value">{s.homework}</div></div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Timeline ── */}
      {tab === 'Timeline' && (
        <div>
          <AddHistoryInline patientId={id} onSave={loadAll} />
          <div style={{ marginTop:20 }}>
            {history.length === 0 ? <div className="empty-state">No history entries yet.</div> : (
              <div className="timeline">
                {history.map(h => (
                  <div key={h.id} className="tl-item">
                    <div className="tl-dot" />
                    <div className="tl-date">{fmt(h.occurred_at)} · {h.category}</div>
                    <div className="tl-body">
                      <div className="tl-title">{h.title}</div>
                      {h.body && <div className="tl-text">{h.body}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Goals ── */}
      {tab === 'Goals' && (
        <div className="card">
          <div className="card-header"><span className="card-title">Goals & Progress</span></div>
          <div className="card-body"><div className="field-empty">Goals feature — store as history entries with category "Goal" or use a dedicated table in a future migration.</div></div>
        </div>
      )}

      {/* ── Inter-Session ── */}
      {tab === 'Inter-Session' && (
        <InterSessionTab patientId={id} />
      )}

      {/* ── Insights (Private) ── */}
      {tab === 'Insights' && (
        <div className="private-zone">
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
            <span className="private-badge">🔒 Private — Therapist Only</span>
          </div>
          <div className="form-group"><label className="form-label">Private Notes & Reflections</label>
            <textarea rows={10} value={insightText} onChange={e=>setInsightText(e.target.value)} style={{ background:'#fff8f3' }} />
          </div>
          <button className="btn btn-primary" onClick={saveInsights} disabled={insightSaving}>{insightSaving?'Saving…':'Save Insights'}</button>
        </div>
      )}

      {/* ── Risk ── */}
      {tab === 'Risk' && (
        <RiskTab sessions={sessions} />
      )}

      {/* ── Snapshot ── */}
      {tab === 'Snapshot' && (
        <SnapshotTab sessions={sessions} />
      )}

      {/* ── Export ── */}
      {tab === 'Export' && (
        <ExportTab patient={patient} sessions={sessions} history={history} />
      )}

      {/* New Session Modal */}
      {showSession && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setShowSession(false)}>
          <div className="modal" style={{ maxWidth:640 }}>
            <div className="modal-header">
              <span className="modal-title">New Session — {patient.code}</span>
              <button className="btn btn-ghost btn-icon" onClick={()=>setShowSession(false)}>✕</button>
            </div>
            <form onSubmit={submitSession}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group"><label className="form-label">Date</label>
                    <input type="date" value={sesForm.date} onChange={e=>setSes('date',e.target.value)} /></div>
                  <div className="form-group"><label className="form-label">Session #</label>
                    <input type="number" placeholder={sessionCount+1} value={sesForm.session_number} onChange={e=>setSes('session_number',e.target.value)} /></div>
                </div>
                <div className="form-row">
                  <div className="form-group"><label className="form-label">Format</label>
                    <select value={sesForm.format} onChange={e=>setSes('format',e.target.value)}>
                      {['in-person','online','phone','hybrid'].map(f=><option key={f}>{f}</option>)}
                    </select></div>
                  <div className="form-group"><label className="form-label">Risk Status</label>
                    <select value={sesForm.risk_status} onChange={e=>setSes('risk_status',e.target.value)}>
                      <option value="green">Green — No concern</option>
                      <option value="amber">Amber — Monitor</option>
                      <option value="red">Red — Immediate concern</option>
                    </select></div>
                </div>
                <div className="form-row">
                  <div className="form-group"><label className="form-label">Arrived as (state)</label>
                    <input placeholder="anxious, flat, guarded…" value={sesForm.arrive_state} onChange={e=>setSes('arrive_state',e.target.value)} /></div>
                  <div className="form-group"><label className="form-label">Left as (state)</label>
                    <input placeholder="calmer, hopeful…" value={sesForm.leave_state} onChange={e=>setSes('leave_state',e.target.value)} /></div>
                </div>
                <div className="form-group"><label className="form-label">Theme / Focus</label>
                  <input placeholder="Main topic or thread" value={sesForm.theme} onChange={e=>setSes('theme',e.target.value)} /></div>
                <div className="form-row">
                  <div className="form-group"><label className="form-label">Intervention Used</label>
                    <input placeholder="Cognitive restructuring…" value={sesForm.intervention} onChange={e=>setSes('intervention',e.target.value)} /></div>
                  <div className="form-group"><label className="form-label">What Was Effective</label>
                    <input placeholder="Externalising the critic…" value={sesForm.effective} onChange={e=>setSes('effective',e.target.value)} /></div>
                </div>
                <div className="form-group"><label className="form-label">Alliance Note</label>
                  <input placeholder="Rapport, rupture, repair…" value={sesForm.alliance_note} onChange={e=>setSes('alliance_note',e.target.value)} /></div>
                <div className="form-group"><label className="form-label">Session Notes</label>
                  <textarea rows={5} value={sesForm.notes} onChange={e=>setSes('notes',e.target.value)} /></div>
                <div className="form-group"><label className="form-label">Homework / Between-Session Task</label>
                  <input placeholder="Optional" value={sesForm.homework} onChange={e=>setSes('homework',e.target.value)} /></div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={()=>setShowSession(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving?'Saving…':'Save Session'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Sub-components ── */

function AddHistoryInline({ patientId, onSave }) {
  const [show, setShow] = useState(false)
  const [form, setForm] = useState({ occurred_at: new Date().toISOString().slice(0,10), category:'Clinical', title:'', body:'' })
  const [saving, setSaving] = useState(false)
  const set = (k,v) => setForm(f=>({...f,[k]:v}))
  async function submit(e) {
    e.preventDefault(); setSaving(true)
    await api.createHistory(patientId, form)
    setSaving(false); setShow(false); onSave()
  }
  return (
    <div>
      {!show ? <button className="btn btn-secondary btn-sm" onClick={()=>setShow(true)}>+ Add Entry</button> : (
        <form onSubmit={submit} className="card" style={{ padding:16 }}>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Date</label>
              <input type="date" value={form.occurred_at} onChange={e=>set('occurred_at',e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Category</label>
              <select value={form.category} onChange={e=>set('category',e.target.value)}>
                {['Clinical','Life Event','Medical','Goal','Milestone','Other'].map(c=><option key={c}>{c}</option>)}
              </select></div>
          </div>
          <div className="form-group"><label className="form-label">Title</label>
            <input required value={form.title} onChange={e=>set('title',e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Details</label>
            <textarea rows={3} value={form.body} onChange={e=>set('body',e.target.value)} /></div>
          <div style={{ display:'flex', gap:8 }}>
            <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>{saving?'Saving…':'Add'}</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={()=>setShow(false)}>Cancel</button>
          </div>
        </form>
      )}
    </div>
  )
}

function InterSessionTab({ patientId }) {
  const [notes, setNotes] = useState([])
  const [text, setText] = useState(''); const [saving, setSaving] = useState(false)
  useEffect(()=>{ api.getHistory(patientId).then(r=>{ if(r.data) setNotes(r.data.filter(h=>h.category==='Inter-Session')) }) },[patientId])
  async function add() {
    if (!text.trim()) return; setSaving(true)
    await api.createHistory(patientId, { occurred_at: new Date().toISOString().slice(0,10), category:'Inter-Session', title:'Note', body: text })
    setText(''); setSaving(false)
    api.getHistory(patientId).then(r=>{ if(r.data) setNotes(r.data.filter(h=>h.category==='Inter-Session')) })
  }
  return (
    <div>
      <div className="card" style={{ marginBottom:16 }}>
        <div className="card-body">
          <div className="form-group"><label className="form-label">Add Inter-Session Note</label>
            <textarea rows={3} value={text} onChange={e=>setText(e.target.value)} placeholder="Observation between sessions…" /></div>
          <button className="btn btn-primary btn-sm" onClick={add} disabled={saving||!text.trim()}>{saving?'Saving…':'Add Note'}</button>
        </div>
      </div>
      <div className="gap-stack">
        {notes.map(n=>(
          <div key={n.id} className="card">
            <div className="card-body-sm">
              <div style={{ fontSize:11, color:'var(--text-light)', marginBottom:4 }}>{new Date(n.occurred_at).toLocaleDateString()}</div>
              <div style={{ fontSize:13.5, whiteSpace:'pre-wrap' }}>{n.body}</div>
            </div>
          </div>
        ))}
        {notes.length===0 && <div className="empty-state">No inter-session notes yet.</div>}
      </div>
    </div>
  )
}

function RiskTab({ sessions }) {
  const flagged = sessions.filter(s=>s.risk_status==='red'||s.risk_status==='amber')
  return (
    <div>
      <div className="card" style={{ marginBottom:16 }}>
        <div className="card-header"><span className="card-title">Risk Overview</span></div>
        <div className="card-body-sm">
          <div className="grid-3" style={{ gap:12 }}>
            {[['🔴 Red Flags', sessions.filter(s=>s.risk_status==='red').length, '#FEF2F2', '#C9504A'],
              ['🟡 Amber', sessions.filter(s=>s.risk_status==='amber').length, '#FEF9F0', '#D4954A'],
              ['🟢 Clear', sessions.filter(s=>s.risk_status==='green'||!s.risk_status).length, '#EBF1ED', '#5E8A72']
            ].map(([l,v,bg,c])=>(
              <div key={l} style={{ background:bg, border:`1px solid ${c}22`, borderRadius:8, padding:'12px 16px' }}>
                <div style={{ fontSize:22, fontWeight:700, color:c }}>{v}</div>
                <div style={{ fontSize:12, color:c }}>{l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      {flagged.length > 0 && (
        <div className="gap-stack">
          {flagged.map(s=>(
            <div key={s.id} className="card" style={{ borderLeft:`3px solid ${s.risk_status==='red'?'#C9504A':'#D4954A'}` }}>
              <div className="card-body-sm">
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                  <b>{new Date(s.date).toLocaleDateString()}</b>
                  <span className={s.risk_status==='red'?'risk-flag-badge':'tag tag-warning tag-sm'}>{s.risk_status}</span>
                </div>
                {s.theme && <div className="field-value">{s.theme}</div>}
                {s.notes && <div className="field-empty" style={{ marginTop:6 }}>{s.notes.slice(0,120)}…</div>}
              </div>
            </div>
          ))}
        </div>
      )}
      {flagged.length===0 && <div className="empty-state">No risk flags recorded.</div>}
    </div>
  )
}

function SnapshotTab({ sessions }) {
  const moods = sessions.slice().reverse().map((s,i)=>({ i, v: s.mood_score||null, date: s.date })).filter(x=>x.v!==null)
  return (
    <div>
      <div className="card" style={{ marginBottom:16 }}>
        <div className="card-header"><span className="card-title">Session Trend</span></div>
        <div className="card-body">
          {moods.length < 2 ? <div className="field-empty">Need at least 2 sessions with mood scores to show trend.</div> : (
            <svg viewBox={`0 0 ${moods.length*60} 80`} style={{ width:'100%', height:100 }}>
              <polyline fill="none" stroke="var(--accent)" strokeWidth="2"
                points={moods.map((m,i)=>`${i*60+30},${80-((m.v/10)*70)}`).join(' ')} />
              {moods.map((m,i)=>(
                <g key={i}>
                  <circle cx={i*60+30} cy={80-((m.v/10)*70)} r="4" fill="var(--accent)" />
                  <text x={i*60+30} y={78} textAnchor="middle" fontSize="9" fill="var(--text-light)">{new Date(m.date).toLocaleDateString('en-GB',{day:'numeric',month:'short'})}</text>
                </g>
              ))}
            </svg>
          )}
        </div>
      </div>
      <div className="card">
        <div className="card-header"><span className="card-title">Session States</span></div>
        <div className="card-body-sm">
          <table style={{ width:'100%', fontSize:12.5, borderCollapse:'collapse' }}>
            <thead><tr style={{ color:'var(--text-muted)', textAlign:'left' }}>
              <th style={{ padding:'6px 10px' }}>Date</th><th style={{ padding:'6px 10px' }}>Arrived</th><th style={{ padding:'6px 10px' }}>Left</th><th style={{ padding:'6px 10px' }}>Theme</th>
            </tr></thead>
            <tbody>
              {sessions.map(s=>(
                <tr key={s.id} style={{ borderTop:'1px solid var(--border)' }}>
                  <td style={{ padding:'8px 10px' }}>{new Date(s.date).toLocaleDateString()}</td>
                  <td style={{ padding:'8px 10px', color:'var(--text-muted)' }}>{s.arrive_state||'—'}</td>
                  <td style={{ padding:'8px 10px', color:'var(--text-muted)' }}>{s.leave_state||'—'}</td>
                  <td style={{ padding:'8px 10px' }}>{s.theme||'—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {sessions.length===0 && <div className="field-empty">No sessions yet.</div>}
        </div>
      </div>
    </div>
  )
}

function ExportTab({ patient, sessions, history }) {
  function printSummary() {
    const html = `<!DOCTYPE html><html><head><title>Case Summary — ${patient.code}</title>
    <style>body{font-family:Georgia,serif;max-width:700px;margin:40px auto;color:#222;line-height:1.7}
    h1{font-size:22px;border-bottom:2px solid #333;padding-bottom:8px}h2{font-size:16px;margin-top:28px;color:#444}
    table{width:100%;border-collapse:collapse;font-size:13px}td{padding:6px 10px;border-bottom:1px solid #eee}
    .meta{font-size:13px;color:#666}.private{display:none}</style></head><body>
    <h1>Case Summary: ${patient.code}</h1>
    <div class="meta">Generated ${new Date().toLocaleDateString()} · ${sessions.length} sessions · ${patient.modality||'—'}</div>
    <h2>Presenting Issue</h2><p>${patient.presenting_issue||'Not recorded'}</p>
    <h2>Sessions (${sessions.length})</h2>
    <table><tr style="font-weight:600"><td>Date</td><td>Theme</td><td>Intervention</td><td>Risk</td></tr>
    ${sessions.map(s=>`<tr><td>${new Date(s.date).toLocaleDateString()}</td><td>${s.theme||'—'}</td><td>${s.intervention||'—'}</td><td>${s.risk_status||'green'}</td></tr>`).join('')}
    </table>
    <h2>Timeline</h2>
    ${history.map(h=>`<p><b>${new Date(h.occurred_at).toLocaleDateString()} [${h.category}]</b> ${h.title}${h.body?': '+h.body:''}</p>`).join('')}
    </body></html>`
    const w = window.open('','_blank'); w.document.write(html); w.document.close(); w.print()
  }
  return (
    <div className="card">
      <div className="card-header"><span className="card-title">Case Summary Export</span></div>
      <div className="card-body">
        <p style={{ fontSize:13, color:'var(--text-muted)', marginBottom:16 }}>
          Generates a print-ready clinical summary. Private insights are excluded.
        </p>
        <button className="btn btn-primary" onClick={printSummary}>🖨 Print / Export PDF</button>
      </div>
    </div>
  )
}
