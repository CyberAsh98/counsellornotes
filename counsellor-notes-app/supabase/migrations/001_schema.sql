-- ============================================================
-- MIGRATION 001: Schema, Tables, Indexes
-- Three-layer PII separation:
--   pii.*      — identity only (name, DOB, contact)
--   public.*   — clinical data (sessions, history, goals)
--   insights.* — private therapist layer (strictly separate)
-- ============================================================

CREATE SCHEMA IF NOT EXISTS pii;
CREATE SCHEMA IF NOT EXISTS insights;

-- ── Therapist profiles ──────────────────────────────────────
CREATE TABLE public.therapists (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'therapist' CHECK (role IN ('therapist','supervisor','admin')),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── PII layer ───────────────────────────────────────────────
CREATE TABLE pii.patients (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name         TEXT NOT NULL,
  preferred_name    TEXT,
  dob               DATE,
  gender            TEXT,
  emergency_contact TEXT,
  consent_notes     TEXT,
  language          TEXT,
  cultural_notes    TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ── Clinical layer ──────────────────────────────────────────
CREATE TABLE public.patients (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pii_id           UUID NOT NULL REFERENCES pii.patients(id) ON DELETE CASCADE,
  therapist_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  color            TEXT DEFAULT '#7C9E87',
  tags             TEXT[] DEFAULT '{}',
  risk_flag        BOOLEAN DEFAULT FALSE,
  intake           JSONB DEFAULT '{}',
  family_context   JSONB DEFAULT '{}',
  academic_career  JSONB DEFAULT '{}',
  mental_emotional JSONB DEFAULT '{}',
  current_situation JSONB DEFAULT '{}',
  past_interventions JSONB DEFAULT '[]',
  goals            JSONB DEFAULT '[]',
  inter_session_notes JSONB DEFAULT '[]',
  last_session_at  DATE,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id    UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  therapist_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  number        INTEGER NOT NULL,
  session_date  DATE NOT NULL,
  concern       TEXT,
  themes        TEXT[] DEFAULT '{}',
  tone          TEXT,
  format        TEXT,
  arrive_state  TEXT,
  leave_state   TEXT,
  interventions TEXT[] DEFAULT '{}',
  effective     TEXT,
  reflections   TEXT,
  follow_up     TEXT,
  homework      TEXT,
  alliance_note TEXT,
  risk_status   TEXT DEFAULT 'No concerns',
  snapshot      JSONB,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.case_history (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id               UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  therapist_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period                   TEXT,
  event_date               DATE,
  event                    TEXT NOT NULL,
  patient_narrative        TEXT,
  therapist_interpretation TEXT,
  impact                   TEXT,
  resolved                 BOOLEAN DEFAULT FALSE,
  uncertain                BOOLEAN DEFAULT FALSE,
  tags                     TEXT[] DEFAULT '{}',
  created_at               TIMESTAMPTZ DEFAULT NOW()
);

-- ── Private insights layer ──────────────────────────────────
CREATE TABLE insights.therapist_insights (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id          UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  therapist_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hypotheses          TEXT,
  patterns            TEXT,
  transference        TEXT,
  formulation         TEXT,
  ethical_reflections TEXT,
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ── Audit log ───────────────────────────────────────────────
CREATE TABLE public.audit_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id UUID NOT NULL,
  action       TEXT NOT NULL,  -- INSERT | UPDATE | DELETE
  schema_name  TEXT NOT NULL,
  table_name   TEXT NOT NULL,
  record_id    UUID,
  ip_address   TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── Indexes ─────────────────────────────────────────────────
CREATE INDEX idx_patients_therapist   ON public.patients(therapist_id);
CREATE INDEX idx_sessions_patient     ON public.sessions(patient_id);
CREATE INDEX idx_sessions_therapist   ON public.sessions(therapist_id);
CREATE INDEX idx_case_history_patient ON public.case_history(patient_id);
CREATE INDEX idx_pii_therapist        ON pii.patients(therapist_id);
CREATE INDEX idx_insights_patient     ON insights.therapist_insights(patient_id);
CREATE INDEX idx_audit_therapist      ON public.audit_log(therapist_id);
CREATE INDEX idx_audit_created        ON public.audit_log(created_at);

-- ── updated_at trigger ──────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_patients_updated
  BEFORE UPDATE ON public.patients
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_sessions_updated
  BEFORE UPDATE ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_pii_updated
  BEFORE UPDATE ON pii.patients
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
