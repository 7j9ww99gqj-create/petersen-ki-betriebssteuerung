-- QM Phase 2A: Team-Mitglieder
CREATE TABLE IF NOT EXISTS qm_team_mitglieder (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid REFERENCES auth.users DEFAULT auth.uid(),
  name       text NOT NULL,
  email      text,
  rolle      text CHECK (rolle IN ('admin','pruefer','viewer')) DEFAULT 'pruefer',
  aktiv      boolean DEFAULT true,
  erstellt_am timestamptz DEFAULT now()
);

ALTER TABLE qm_team_mitglieder ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qm_team_select" ON qm_team_mitglieder FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "qm_team_insert" ON qm_team_mitglieder FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "qm_team_update" ON qm_team_mitglieder FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "qm_team_delete" ON qm_team_mitglieder FOR DELETE USING (auth.uid() = user_id);
