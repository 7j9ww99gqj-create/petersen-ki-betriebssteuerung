-- Cloud Backups: persistente Backup-Historie pro User
CREATE TABLE IF NOT EXISTS cloud_backups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users DEFAULT auth.uid(),
  created_at timestamptz DEFAULT now(),
  label text NOT NULL DEFAULT 'Manuell',
  modules jsonb NOT NULL DEFAULT '{}',
  total_records integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'ok'
);

ALTER TABLE cloud_backups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cloud_backups_own" ON cloud_backups
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS cloud_backups_user_created ON cloud_backups (user_id, created_at DESC);
