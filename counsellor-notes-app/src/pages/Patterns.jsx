import { useState, useEffect } from 'react'
import { api } from '../lib/api'

export default function Patterns() {
  const [patients, setPatients] = useState([])
  const [allSessions, setAllSessions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const pr = await api.getPatients()
    const pts = pr.data || []
    setPatients(pts)
    const sessionArrays = await Promise.all(pts.map(p => api.getSessions(p.id).then(r => (r.data||[]).map(s=>({...s, patientId: p.id})))))
    setAllSessions(sessionArrays.flat())
    setLoading(false)
  }

  if (loading) return <div className="empty-state">Loading…</div>

  const totalSessions = allSessions.length
  const activeCount = patients.filter(p => p.status === 'active').length
  const riskSessions = allSessions.filter(s => s.risk_status === 'red').length
  const amberSessions = allSessions.filter(s => s.risk_status === 'amber').length

  // Co-occurrence: theme → count
  const themeMap = {}
  allSessions.forEach(s => {
    if (!s.theme) return
    const words = s.theme.toLowerCase().split(/[\s,]+/).filter(w=>w.length>3)
    words.forEach(w => { themeMap[w] = (themeMap[w]||0) + 1 })
  })
  const topThemes = Object.entries(themeMap).sort((a,b)=>b[1]-a[1]).slice(0,12)

  // Intervention effectiveness (sessions with effective field)
  const interventionMap = {}
  allSessions.forEach(s => {
    if (!s.intervention) return
    if (!interventionMap[s.intervention]) interventionMap[s.intervention] = { count:0, effective:0 }
    interventionMap[s.intervention].count++
    if (s.effective) interventionMap[s.intervention].effective++
  })
  const topInterventions = Object.entries(interventionMap).sort((a,b)=>b[1].count-a[1].count).slice(0,8)

  // Sessions per week distribution
  const weekMap = {}
  allSessions.forEach(s => {
    if (!s.date) return
    const d = new Date(s.date)
    const week = `${d.getFullYear()}-W${String(Math.ceil((d.getDate()+(new Date(d.getFullYear(),d.getMonth(),1).getDay()))/7)).padStart(2,'0')}`
    weekMap[week] = (weekMap[week]||0) + 1
  })
  const weeks = Object.entries(weekMap).sort((a,b)=>a[0].localeCompare(b[0])).slice(-12)
  const maxWeek = Math.max(...weeks.map(w=>w[1]), 1)

  return (
    <div>
      <div className="sec-header">
        <div>
          <div className="sec-title">Cross-Case Patterns</div>
          <div className="sec-subtitle">Aggregated insights across your caseload — no PII exposed</div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid-3" style={{ marginBottom: 22 }}>
        <div className="stat-card"><div className="stat-value">{activeCount}</div><div className="stat-label">Active patients</div></div>
        <div className="stat-card"><div className="stat-value">{totalSessions}</div><div className="stat-label">Total sessions</div></div>
        <div className="stat-card" style={{ borderLeft: riskSessions > 0 ? '3px solid #C9504A' : undefined }}>
          <div className="stat-value" style={{ color: riskSessions > 0 ? '#C9504A' : undefined }}>{riskSessions}</div>
          <div className="stat-label">Red-flag sessions</div>
        </div>
      </div>

      <div className="grid-2" style={{ marginBottom: 22 }}>
        {/* Top themes */}
        <div className="card">
          <div className="card-header"><span className="card-title">Common Themes</span></div>
          <div className="card-body-sm">
            {topThemes.length === 0
              ? <div className="field-empty">No theme data yet. Add themes to sessions.</div>
              : topThemes.map(([word, count]) => (
                <div key={word} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                  <div style={{ flex:1, fontSize:13 }}>{word}</div>
                  <div style={{ width:120, background:'var(--border)', borderRadius:4, height:8 }}>
                    <div style={{ width:`${(count/topThemes[0][1])*100}%`, background:'var(--accent)', height:8, borderRadius:4 }} />
                  </div>
                  <div style={{ fontSize:12, color:'var(--text-muted)', width:20, textAlign:'right' }}>{count}</div>
                </div>
              ))}
          </div>
        </div>

        {/* Interventions */}
        <div className="card">
          <div className="card-header"><span className="card-title">Intervention Usage</span></div>
          <div className="card-body-sm">
            {topInterventions.length === 0
              ? <div className="field-empty">No intervention data yet. Log interventions in sessions.</div>
              : topInterventions.map(([name, stats]) => (
                <div key={name} style={{ marginBottom:10 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:12.5, marginBottom:3 }}>
                    <span>{name}</span>
                    <span style={{ color:'var(--text-muted)' }}>{stats.count}× · {stats.effective} effective</span>
                  </div>
                  <div style={{ background:'var(--border)', borderRadius:4, height:6 }}>
                    <div style={{ width:`${(stats.count/topInterventions[0][1].count)*100}%`, background:'var(--accent-hover)', height:6, borderRadius:4 }} />
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* Session volume over time */}
      <div className="card" style={{ marginBottom: 22 }}>
        <div className="card-header"><span className="card-title">Session Volume (last 12 weeks)</span></div>
        <div className="card-body">
          {weeks.length < 2
            ? <div className="field-empty">Not enough data yet.</div>
            : (
              <div style={{ display:'flex', alignItems:'flex-end', gap:6, height:80 }}>
                {weeks.map(([w, count]) => (
                  <div key={w} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
                    <div style={{ width:'100%', background:'var(--accent)', borderRadius:'3px 3px 0 0', height:`${(count/maxWeek)*64}px`, minHeight:4 }} title={`${count} sessions`} />
                    <div style={{ fontSize:9, color:'var(--text-light)', writingMode:'vertical-rl', transform:'rotate(180deg)', height:36 }}>{w.split('-W')[1]?`W${w.split('-W')[1]}`:'—'}</div>
                  </div>
                ))}
              </div>
            )}
        </div>
      </div>

      {/* Caseload overview */}
      <div className="card">
        <div className="card-header"><span className="card-title">Caseload Overview</span></div>
        <div className="card-body-sm">
          <table style={{ width:'100%', fontSize:12.5, borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ color:'var(--text-muted)', textAlign:'left' }}>
                <th style={{ padding:'6px 10px' }}>Code</th>
                <th style={{ padding:'6px 10px' }}>Modality</th>
                <th style={{ padding:'6px 10px' }}>Sessions</th>
                <th style={{ padding:'6px 10px' }}>Contracted</th>
                <th style={{ padding:'6px 10px' }}>Remaining</th>
                <th style={{ padding:'6px 10px' }}>Risk</th>
              </tr>
            </thead>
            <tbody>
              {patients.map(p => {
                const ps = allSessions.filter(s=>s.patientId===p.id)
                const hasRed = ps.some(s=>s.risk_status==='red')
                const hasAmber = ps.some(s=>s.risk_status==='amber')
                return (
                  <tr key={p.id} style={{ borderTop:'1px solid var(--border)' }}>
                    <td style={{ padding:'8px 10px', fontWeight:500 }}>{p.code}</td>
                    <td style={{ padding:'8px 10px', color:'var(--text-muted)' }}>{p.modality||'—'}</td>
                    <td style={{ padding:'8px 10px' }}>{ps.length}</td>
                    <td style={{ padding:'8px 10px', color:'var(--text-muted)' }}>{p.contracted_sessions||'—'}</td>
                    <td style={{ padding:'8px 10px', color:'var(--text-muted)' }}>{p.contracted_sessions ? Math.max(0, p.contracted_sessions - ps.length) : '—'}</td>
                    <td style={{ padding:'8px 10px' }}>
                      {hasRed ? <span className="risk-flag-badge">Red</span>
                      : hasAmber ? <span className="tag tag-warning tag-sm">Amber</span>
                      : <span className="tag tag-sm">Clear</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {patients.length === 0 && <div className="field-empty">No patients yet.</div>}
        </div>
      </div>
    </div>
  )
}
