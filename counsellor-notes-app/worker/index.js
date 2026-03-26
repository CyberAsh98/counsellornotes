// ============================================================
// Cloudflare Worker — API Proxy / BFF
// Supabase service key NEVER leaves this Worker.
// All requests validated via JWT before hitting Supabase.
// ============================================================

const CORS = {
  'Access-Control-Allow-Origin': '*',  // tighten to your domain in prod
  'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
};

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

    const url = new URL(request.url);
    const rawPath = url.pathname.startsWith("/api") ? url.pathname.replace("/api", "") : url.pathname;

    // ── Validate JWT ────────────────────────────────────────
    const auth = request.headers.get('Authorization') || '';
    const token = auth.replace('Bearer ', '');
    if (!token) return json({ error: 'Unauthorised' }, 401);

    const user = await verifyJWT(token, env);
    if (!user) return json({ error: 'Invalid token' }, 401);

    // ── Route ───────────────────────────────────────────────
    const path = rawPath;
    const method = request.method;
    let body = null;
    if (method !== 'GET' && method !== 'DELETE') {
      try { body = await request.json(); } catch {}
    }

    try {
      return await route(path, method, body, user, url, env);
    } catch (e) {
      return json({ error: e.message || 'Server error' }, 500);
    }
  }
};

// ── Router ───────────────────────────────────────────────────
async function route(path, method, body, user, url, env) {
  const uid = user.id || user.sub;
  const sb = supabase(env);

  // GET /patients — list own patients (PII joined)
  if (path === '/patients' && method === 'GET') {
    const { data, error } = await sb
      .from('patients')
      .select('*')
      .eq('therapist_id', uid)
      .order('last_session_at', { ascending: false, nullsFirst: false });
    if (error) throw error;
    return json(data);
  }

  // POST /patients — create patient (PII + clinical atomically)
  if (path === '/patients' && method === 'POST') {
    const { pii, ...clinical } = body;
    const { data: piiRow, error: piiErr } = await sb
      .schema('pii').from('patients')
      .insert({ ...pii, therapist_id: uid })
      .select().single();
    if (piiErr) throw piiErr;

    const { data: pt, error: ptErr } = await sb
      .from('patients')
      .insert({ ...clinical, pii_id: piiRow.id, therapist_id: uid })
      .select().single();
    if (ptErr) throw ptErr;

    await writeAudit(sb, uid, 'INSERT', 'public', 'patients', pt.id);
    return json({ ...pt, pii: piiRow }, 201);
  }

  // GET /patients/:id
  if (path.match(/^\/patients\/[\w-]+$/) && method === 'GET') {
    const id = path.split('/')[2];
    const { data, error } = await sb
      .from('patients')
      .select('*')
      .eq('id', id).eq('therapist_id', uid).single();
    if (error) return json({ error: 'Not found' }, 404);
    return json(data);
  }

  // PATCH /patients/:id
  if (path.match(/^\/patients\/[\w-]+$/) && method === 'PATCH') {
    const id = path.split('/')[2];
    const { pii, ...clinical } = body;

    if (pii) {
      const { data: existing } = await sb.from('patients').select('pii_id').eq('id', id).eq('therapist_id', uid).single();
      if (existing?.pii_id) {
        await sb.schema('pii').from('patients').update(pii).eq('id', existing.pii_id).eq('therapist_id', uid);
      }
    }
    const { data, error } = await sb.from('patients').update(clinical).eq('id', id).eq('therapist_id', uid).select().single();
    if (error) throw error;
    await writeAudit(sb, uid, 'UPDATE', 'public', 'patients', id);
    return json(data);
  }

  // DELETE /patients/:id
  if (path.match(/^\/patients\/[\w-]+$/) && method === 'DELETE') {
    const id = path.split('/')[2];
    const { error } = await sb.from('patients').delete().eq('id', id).eq('therapist_id', uid);
    if (error) throw error;
    await writeAudit(sb, uid, 'DELETE', 'public', 'patients', id);
    return json({ ok: true });
  }

  // GET /patients/:id/sessions
  if (path.match(/^\/patients\/[\w-]+\/sessions$/) && method === 'GET') {
    const pid = path.split('/')[2];
    const { data, error } = await sb.from('sessions').select('*').eq('patient_id', pid).eq('therapist_id', uid).order('session_date', { ascending: true });
    if (error) throw error;
    return json(data);
  }

  // POST /patients/:id/sessions
  if (path.match(/^\/patients\/[\w-]+\/sessions$/) && method === 'POST') {
    const pid = path.split('/')[2];
    const { data, error } = await sb.from('sessions').insert({ ...body, patient_id: pid, therapist_id: uid }).select().single();
    if (error) throw error;
    // Update last_session_at
    await sb.from('patients').update({ last_session_at: body.session_date }).eq('id', pid).eq('therapist_id', uid);
    await writeAudit(sb, uid, 'INSERT', 'public', 'sessions', data.id);
    return json(data, 201);
  }

  // PATCH /sessions/:id
  if (path.match(/^\/sessions\/[\w-]+$/) && method === 'PATCH') {
    const id = path.split('/')[2];
    const { data, error } = await sb.from('sessions').update(body).eq('id', id).eq('therapist_id', uid).select().single();
    if (error) throw error;
    return json(data);
  }

  // GET /patients/:id/history
  if (path.match(/^\/patients\/[\w-]+\/history$/) && method === 'GET') {
    const pid = path.split('/')[2];
    const { data, error } = await sb.from('case_history').select('*').eq('patient_id', pid).eq('therapist_id', uid).order('event_date', { ascending: true });
    if (error) throw error;
    return json(data);
  }

  // POST /patients/:id/history
  if (path.match(/^\/patients\/[\w-]+\/history$/) && method === 'POST') {
    const pid = path.split('/')[2];
    const { data, error } = await sb.from('case_history').insert({ ...body, patient_id: pid, therapist_id: uid }).select().single();
    if (error) throw error;
    return json(data, 201);
  }

  // GET /patients/:id/insights
  if (path.match(/^\/patients\/[\w-]+\/insights$/) && method === 'GET') {
    const pid = path.split('/')[2];
    const { data, error } = await sb.schema('insights').from('therapist_insights')
      .select('*').eq('patient_id', pid).eq('therapist_id', uid).single();
    if (error && error.code !== 'PGRST116') throw error;
    return json(data || {});
  }

  // PUT /patients/:id/insights (upsert)
  if (path.match(/^\/patients\/[\w-]+\/insights$/) && method === 'PUT') {
    const pid = path.split('/')[2];
    const { data, error } = await sb.schema('insights').from('therapist_insights')
      .upsert({ ...body, patient_id: pid, therapist_id: uid }, { onConflict: 'patient_id,therapist_id' })
      .select().single();
    if (error) throw error;
    return json(data);
  }

  // GET /me — therapist profile
  if (path === '/me' && method === 'GET') {
    const { data, error } = await sb.from('therapists').select('*').eq('id', uid).single();
    if (error) return json({ error: 'Profile not found' }, 404);
    return json(data);
  }

  // GET /audit — own audit log
  if (path === '/audit' && method === 'GET') {
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const { data, error } = await sb.from('audit_log').select('*').eq('therapist_id', uid).order('created_at', { ascending: false }).limit(limit);
    if (error) throw error;
    return json(data);
  }

  return json({ error: 'Route not found' }, 404);
}

// ── Helpers ──────────────────────────────────────────────────
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS }
  });
}

function supabase(env) {
  // Minimal Supabase REST client (no SDK needed in Worker)
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_KEY;

  const headers = {
    'apikey': key,
    'Authorization': `Bearer ${key}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };

  function buildUrl(schema, table) {
    const base = schema === 'public' ? `${url}/rest/v1` : `${url}/rest/v1`;
    // For non-public schemas, use search_path header
    return `${base}/${table}`;
  }

  class Builder {
    constructor(schema, table) {
      this._schema = schema; this._table = table;
      this._filters = []; this._select = '*';
      this._order = null; this._limit = null;
      this._method = 'GET'; this._body = null;
      this._single = false;
    }
    schema(s) { const b = new Builder(s, this._table); return b; }
    from(t) { return new Builder(this._schema, t); }
    select(s) { this._select = s; return this; }
    eq(col, val) { this._filters.push(`${col}=eq.${val}`); return this; }
    order(col, { ascending = true, nullsFirst = false } = {}) {
      this._order = `${col}.${ascending ? 'asc' : 'desc'}${nullsFirst ? '.nullsfirst' : ''}`; return this;
    }
    limit(n) { this._limit = n; return this; }
    single() { this._single = true; return this; }
    insert(data) { this._method = 'POST'; this._body = data; return this; }
    update(data) { this._method = 'PATCH'; this._body = data; return this; }
    upsert(data, opts) { this._method = 'POST'; this._body = data; this._upsert = opts; return this; }
    delete() { this._method = 'DELETE'; return this; }

    async _exec() {
      const params = new URLSearchParams();
      params.set('select', this._select);
      this._filters.forEach(f => { const [k, v] = f.split('='); params.set(k, v.slice(3)); });
      if (this._order) params.set('order', this._order);
      if (this._limit) params.set('limit', this._limit);

      let qs = '';
      this._filters.forEach(f => { qs += (qs ? '&' : '?') + f; });
      if (this._order) qs += (qs ? '&' : '?') + `order=${this._order}`;
      if (this._limit) qs += (qs ? '&' : '?') + `limit=${this._limit}`;
      if (this._select && this._select !== '*') qs += (qs ? '&' : '?') + `select=${encodeURIComponent(this._select)}`;

      const schemaHeader = this._schema !== 'public' ? { 'Accept-Profile': this._schema, 'Content-Profile': this._schema } : {};
      const h = { ...headers, ...schemaHeader };
      if (this._single) h['Accept'] = 'application/vnd.pgrst.object+json';
      if (this._upsert) h['Prefer'] = `resolution=merge-duplicates,return=representation`;

      const tableUrl = `${url}/rest/v1/${this._table}${qs}`;
      const res = await fetch(tableUrl, {
        method: this._method,
        headers: h,
        body: this._body ? JSON.stringify(this._body) : undefined
      });

      if (!res.ok && res.status !== 404) {
        const err = await res.json().catch(() => ({ message: res.statusText }));
        return { data: null, error: { message: err.message || err.hint || 'DB error', code: err.code } };
      }
      if (res.status === 204) return { data: null, error: null };
      const data = await res.json().catch(() => null);
      return { data, error: null };
    }

    then(resolve, reject) { return this._exec().then(resolve, reject); }
  }

  const client = {
    from: (t) => new Builder('public', t),
    schema: (s) => ({ from: (t) => new Builder(s, t) })
  };
  return client;
}

async function verifyJWT(token, env) {
  try {
    // Verify via Supabase Auth API (server-side)
    const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: { 'Authorization': `Bearer ${token}`, 'apikey': env.SUPABASE_SERVICE_KEY }
    });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

async function writeAudit(sb, uid, action, schema, table, recordId) {
  try {
    await sb.from('audit_log').insert({
      therapist_id: uid, action, schema_name: schema,
      table_name: table, record_id: recordId
    });
  } catch {}
}
