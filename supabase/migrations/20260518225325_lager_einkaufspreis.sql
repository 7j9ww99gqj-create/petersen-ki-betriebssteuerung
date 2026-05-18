ALTER TABLE lager_artikel ADD COLUMN IF NOT EXISTS einkaufspreis numeric(10,2) default 0;
