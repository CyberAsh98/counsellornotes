import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'

function daysSince(iso) {
  if (!iso) return null
  return Math.floor((Date.now() - new Date(iso)) / 86400000)
}
function initials(name = '') {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

export default function Home() {
  const [patients, setPatients] = useState([])
  const [loading, setLoading] = useState(true)
  const nav = useNavigate()

  useEffect(() => {
    api.getPatients().then(setPatients).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const overdue = patients.filter(p => (daysSince(p.last_session_at) ?? -1) >= 21)

  return (
    <div>
      <div className="page-header">
        <div style={{ fontSize:20, fontWeight:700, letterSpacing:'-0.3px' }}>Good morning</div>
        <div className="text-muted text-sm" style={{ marginTop:3 }}>
          {new Date().toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}
        </div>
      </div>

      {overdue.length > 0 && (
        <div style={{ marginBottom:22 }}>
          <div style={{ fontSize:11, fontWeight:600, color:'var(--warning)', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:8 }}>
            ⚑ Not seen recently (21+ days)
          </div>
          {overdue.map(p => (
            <div key={p.id} className="gap-alert" onClick={() => nav(`/patients/${p.id}`)}>
              <div className="gap-dot"/>
              <div style={{ flex:1 }}><strong>{p.pii?.preferred_name || p.pii?.full_name}</strong></div>
              <span className="text-sm" style={{ color:'var(--warning)' }}>{daysSince(p.last_session_at)}d ago</span>
            </div>
          ))}
        </div>
      )}

      <div className="home-grid">
        <div>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
            <div style={{ fontSize:14, fontWeight:600 }}>Recent patients</div>
            <button className="btn btn-ghost btn-sm" onClick={() => nav('/patients')}>View all →</button>
          </div>
          <div className="gap-stack">
            {loading && <div className="text-muted text-sm">Loading…</div>}
            {!loading && !patients.length && <div className="text-muted text-sm">No patients yet</div>}
            {patients.slice(0,5).map(p => {
              const days = daysSince(p.last_session_at)
              const lbl = days===null?'No sessions':days===0?'Today':days===1?'Yesterday':`${days}d ago`
              return (
                <div key={p.id} className="recent-item" onClick={() => nav(`/patients/${p.id}`)}>
                  <div className="ri-avatar" style={{ background:p.color||'#7C9E87' }}>{initials(p.pii?.full_name)}</div>
                  <div>
                    <div className="ri-name">{p.pii?.preferred_name || p.pii?.full_name}</div>
                    <div className="ri-sub">{p.tags?.slice(0,2).join(', ') || 'No tags'}</div>
                  </div>
                  <div style={{ marginLeft:'auto', textAlign:'right' }}>
                    <div className="text-sm text-muted">{lbl}</div>
                  </div>
                  <div className="ri-arrow">›</div>
                </div>
              )
            })}
          </div>
        </div>

        <div>
          <div style={{ fontSize:14, fontWeight:600, marginBottom:14 }}>Quick actions</div>
          <div className="gap-stack">
            {[{label:'New patient',sub:'Start a new case',icon:'👤',to:'/patients?new=1'},
              {label:'Cross-case patterns',sub:'Explore shared themes',icon:'🔗',to:'/patterns'},
              {label:'Settings & security',sub:'Auth, lock, export',icon:'⚙️',to:'/settings'},
            ].map(a => (
              <div key={a.label} className="quick-action" onClick={() => nav(a.to)}>
                <div className="qa-icon" style={{ fontSize:18 }}>{a.icon}</div>
                <div><div className="qa-label">{a.label}</div><div className="qa-sub">{a.sub}</div></div>
              </div>
            ))}
          </div>
          <div className="divider"/>
          <div style={{ display:'flex', gap:10 }}>
            {[['Patients',patients.length],['Tags',[...new Set(patients.flatMap(p=>p.tags||[]))].length]].map(([lbl,val])=>(
              <div key={lbl} style={{ background:'var(--card)',border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',padding:'12px 16px',flex:1,textAlign:'center' }}>
                <div style={{ fontSize:24, fontWeight:700, color:'var(--accent)' }}>{val}</div>
                <div className="text-sm text-muted">{lbl}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
