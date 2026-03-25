// All clinical data goes through the Worker (service key never in browser).
// Auth token from Supabase session attached to every request.
import { supabase } from './supabase'

const BASE = import.meta.env.VITE_API_URL || '/api'

async function req(method, path, body) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`
    },
    body: body ? JSON.stringify(body) : undefined
  })

  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`)
  return json
}

export const api = {
  // Patients
  getPatients:        ()        => req('GET',    '/patients'),
  getPatient:         (id)      => req('GET',    `/patients/${id}`),
  createPatient:      (data)    => req('POST',   '/patients', data),
  updatePatient:      (id, data)=> req('PATCH',  `/patients/${id}`, data),
  deletePatient:      (id)      => req('DELETE', `/patients/${id}`),

  // Sessions
  getSessions:        (pid)     => req('GET',    `/patients/${pid}/sessions`),
  createSession:      (pid, d)  => req('POST',   `/patients/${pid}/sessions`, d),
  updateSession:      (sid, d)  => req('PATCH',  `/sessions/${sid}`, d),

  // Case history
  getHistory:         (pid)     => req('GET',    `/patients/${pid}/history`),
  createHistory:      (pid, d)  => req('POST',   `/patients/${pid}/history`, d),

  // Insights (private layer)
  getInsights:        (pid)     => req('GET',    `/patients/${pid}/insights`),
  saveInsights:       (pid, d)  => req('PUT',    `/patients/${pid}/insights`, d),

  // Profile + audit
  getMe:              ()        => req('GET',    '/me'),
  getAudit:           (n=50)    => req('GET',    `/audit?limit=${n}`),
}
