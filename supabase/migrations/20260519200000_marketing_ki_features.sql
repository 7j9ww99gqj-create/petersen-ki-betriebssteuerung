-- Marketing KI Feature-Flags in firma_einstellungen
-- Default false = offline, Owner kann im Dashboard aktivieren

ALTER TABLE firma_einstellungen
  ADD COLUMN IF NOT EXISTS marketing_content_daily_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS marketing_autopilot_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS marketing_sales_assistant_enabled boolean DEFAULT false;
