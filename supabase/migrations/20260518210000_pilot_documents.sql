-- Dokumenten-Archiv für alle Piloten
CREATE TABLE IF NOT EXISTS pilot_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pilot_type VARCHAR NOT NULL CHECK (pilot_type IN ('lager', 'werkstatt', 'analyse', 'planung')),
  document_name VARCHAR NOT NULL,
  document_type VARCHAR NOT NULL,
  file_path VARCHAR,
  file_url VARCHAR,
  file_size BIGINT,
  mime_type VARCHAR,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  tags TEXT[],
  description TEXT,
  category VARCHAR
);

CREATE INDEX IF NOT EXISTS idx_pilot_documents_pilot_type ON pilot_documents(pilot_type);
CREATE INDEX IF NOT EXISTS idx_pilot_documents_created_by ON pilot_documents(created_by);
CREATE INDEX IF NOT EXISTS idx_pilot_documents_search ON pilot_documents USING GIN(to_tsvector('german', COALESCE(document_name, '') || ' ' || COALESCE(description, '')));

ALTER TABLE pilot_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their pilot documents" ON pilot_documents
  FOR ALL USING (auth.uid() = created_by);

-- Hinweis: Supabase Storage Bucket 'pilot-documents' muss manuell im
-- Supabase Dashboard unter Storage erstellt werden mit folgenden Policies:
-- - SELECT: auth.uid() = owner (oder auth.role() = 'authenticated')
-- - INSERT: auth.role() = 'authenticated'
-- - DELETE: auth.uid() = owner
