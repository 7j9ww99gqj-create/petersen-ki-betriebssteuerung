-- Add ab_nummer column to buero_auftraege for sequential AB numbers
ALTER TABLE buero_auftraege ADD COLUMN IF NOT EXISTS ab_nummer text;
