import { supabase } from './supabase'

const BASE = import.meta.env.VITE_API_URL || '/api'

async function req(method, path, body) {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return { data: null, error: { message: 'Not authenticated' } }

    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: body ? JSON.stringify(body) : undefined
    })

    const json = await res.json().catch(() => ({}))
    if (!res.ok) return { data: null, error: { message: json.error || `HTTP ${res.status}` } }
    return { data: json, error: null }
  } catch (e) {
    return { data: null, error: { message: e.message } }
  }
}

export const api = {
  getPatients:    ()         => req('GET',    '/patients'),
  getPatient:     (id)       => req('GET',    `/patients/${id}`),
  createPatient:  (data)     => req('POST',   '/patients', data),
  updatePatient:  (id, data) => req('PATCH',  `/patients/${id}`, data),
  deletePatient:  (id)       => req('DELETE', `/patients/${id}`),

  getSessions:    (pid)      => req('GET',    `/patients/${pid}/sessions`),
  createSession:  (pid, d)   => req('POST',   `/patients/${pid}/sessions`, d),
  updateSession:  (sid, d)   => req('PATCH',  `/sessions/${sid}`, d),

  getHistory:     (pid)      => req('GET',    `/patients/${pid}/history`),
  createHistory:  (pid, d)   => req('POST',   `/patients/${pid}/history`, d),

  getInsights:    (pid)      => req('GET',    `/patients/${pid}/insights`),
  saveInsights:   (pid, d)   => req('PUT',    `/patients/${pid}/insights`, d),

  getMe:          ()         => req('GET',    '/me'),
  getAudit:       (n=50)     => req('GET',    `/audit?limit=${n}`),
}
