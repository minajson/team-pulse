-- TEAM PULSE — Postgres schema.
--
-- Works against any PostgreSQL 13+ instance, including the Postgres behind a
-- Supabase project. Apply with:
--   psql "$TEAM_PULSE_DATABASE_URL" -f src/lib/store/schema.sql
--
-- The session document is stored as a single jsonb row. A live session is a
-- small, hot, whole-document object that is always read and written in full;
-- splitting it across normalised tables would buy nothing and cost a join on
-- every broadcast. Individual fields are still queryable via jsonb operators,
-- and the generated columns below keep the common lookups indexed.

CREATE TABLE IF NOT EXISTS team_pulse_sessions (
  code              text PRIMARY KEY,
  id                uuid NOT NULL,
  facilitator_token text NOT NULL,
  data              jsonb NOT NULL,
  status            text GENERATED ALWAYS AS (data ->> 'status') STORED,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS team_pulse_sessions_updated_at_idx
  ON team_pulse_sessions (updated_at DESC);

CREATE INDEX IF NOT EXISTS team_pulse_sessions_status_idx
  ON team_pulse_sessions (status);

-- Cross-instance realtime fan-out. Every write NOTIFYs the session code; app
-- instances LISTEN and push the new state down their open SSE connections.
CREATE OR REPLACE FUNCTION team_pulse_notify() RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify('team_pulse', COALESCE(NEW.code, OLD.code));
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS team_pulse_sessions_notify ON team_pulse_sessions;
CREATE TRIGGER team_pulse_sessions_notify
  AFTER INSERT OR UPDATE OR DELETE ON team_pulse_sessions
  FOR EACH ROW EXECUTE FUNCTION team_pulse_notify();

-- Sessions are ephemeral by design. Nothing here identifies a participant:
-- responses carry an opaque per-session participant id and nothing else.
-- Run periodically (e.g. pg_cron) to keep the table small:
--   DELETE FROM team_pulse_sessions WHERE updated_at < now() - interval '30 days';
