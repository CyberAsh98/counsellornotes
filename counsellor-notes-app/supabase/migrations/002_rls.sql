-- ============================================================
-- MIGRATION 002: Row Level Security + Audit Triggers
-- Every table: therapist_id = auth.uid() only
-- Insights schema: extra policy — no cross-read ever
-- ============================================================

-- ── Enable RLS ──────────────────────────────────────────────
ALTER TABLE public.therapists         ENABLE ROW LEVEL SECURITY;
ALTER TABLE pii.patients              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_history       ENABLE ROW LEVEL SECURITY;
ALTER TABLE insights.therapist_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log          ENABLE ROW LEVEL SECURITY;

-- ── Therapists: own profile only ────────────────────────────
CREATE POLICY "own_profile" ON public.therapists
  FOR ALL USING (id = auth.uid());

-- ── PII: own patients only ───────────────────────────────────
CREATE POLICY "own_pii" ON pii.patients
  FOR ALL USING (therapist_id = auth.uid())
  WITH CHECK (therapist_id = auth.uid());

-- ── Clinical: own patients only ─────────────────────────────
CREATE POLICY "own_patients" ON public.patients
  FOR ALL USING (therapist_id = auth.uid())
  WITH CHECK (therapist_id = auth.uid());

CREATE POLICY "own_sessions" ON public.sessions
  FOR ALL USING (therapist_id = auth.uid())
  WITH CHECK (therapist_id = auth.uid());

CREATE POLICY "own_history" ON public.case_history
  FOR ALL USING (therapist_id = auth.uid())
  WITH CHECK (therapist_id = auth.uid());

-- ── Insights: own only, extra isolation ─────────────────────
CREATE POLICY "own_insights" ON insights.therapist_insights
  FOR ALL USING (therapist_id = auth.uid())
  WITH CHECK (therapist_id = auth.uid());

-- ── Audit log: own entries, INSERT only from server ─────────
CREATE POLICY "own_audit_read" ON public.audit_log
  FOR SELECT USING (therapist_id = auth.uid());

-- Service role bypasses RLS for audit writes (Worker only)

-- ── Audit trigger function ───────────────────────────────────
CREATE OR REPLACE FUNCTION audit_write()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.audit_log(therapist_id, action, schema_name, table_name, record_id)
  VALUES (
    COALESCE(NEW.therapist_id, OLD.therapist_id),
    TG_OP,
    TG_TABLE_SCHEMA,
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id)
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Attach audit triggers
CREATE TRIGGER audit_pii_patients
  AFTER INSERT OR UPDATE OR DELETE ON pii.patients
  FOR EACH ROW EXECUTE FUNCTION audit_write();

CREATE TRIGGER audit_patients
  AFTER INSERT OR UPDATE OR DELETE ON public.patients
  FOR EACH ROW EXECUTE FUNCTION audit_write();

CREATE TRIGGER audit_sessions
  AFTER INSERT OR UPDATE OR DELETE ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION audit_write();

CREATE TRIGGER audit_insights
  AFTER INSERT OR UPDATE OR DELETE ON insights.therapist_insights
  FOR EACH ROW EXECUTE FUNCTION audit_write();

-- ── Auto-create therapist profile on signup ──────────────────
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.therapists(id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'role', 'therapist')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
