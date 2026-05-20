'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { genId } from '@/lib/ids'
import {
  parseCsvFile, validateImportRows, autoMapColumns, buildImportRows,
  normalizeNumber, normalizeDate,
  TARGET_FIELDS, DEMO_CSV_ARTIKEL, DEMO_CSV_KUNDEN, DEMO_CSV_STEUER, DEMO_CSV_BUCHUNGEN,
  type ImportDataType, type ImportSource, type ImportParseResult, type ImportValidationResult,
} from '@/lib/importer'
import {
  getImportProtokolle, insertImportProtokoll, deleteImportProtokoll,
  bulkImportLagerArtikel, bulkImportBueroKunden, bulkImportEinkaufLieferanten,
  bulkImportBueroRechnungen, bulkImportSteuerBelege, bulkImportSteuerBuchungen,
  bulkImportSteuerKonten, bulkImportWerkstattZeitbuchungen, bulkImportWerkstattMaterial,
} from '@/lib/db'

/**
 * ImportWizard — CSV/XLSX-Import mit Mapping, Validierung, Protokoll, Rollback.
 * Aus app/dashboard/einstellungen/page.tsx ausgelagert (DP14-Refactor Schritt 2).
 */
// ── Import Wizard Component ────────────────────────────────────────────────────

type ImportProtokoll = {
  id: string; quelle: string; datentyp: string; dateiname: string; status: string
  anzahl_gesamt: number; anzahl_erfolgreich: number; anzahl_fehlerhaft: number
  erstellt_am: string
}

const IMPORT_SOURCES: ImportSource[] = ['WISO', 'Lexware', 'sevDesk', 'JTL', 'Billbee', 'DATEV CSV', 'Generisch']

const DATA_TYPE_LABELS: Record<ImportDataType, string> = {
  artikel: '📦 Artikel / Lagerbestand → lager_artikel',
  kunden: '👥 Kunden → buero_kunden',
  lieferanten: '🏭 Lieferanten → einkauf_lieferanten',
  rechnungen: '🧾 Rechnungen → buero_rechnungen',
  angebote: '📄 Angebote → buero_angebote',
  auftraege: '📋 Aufträge → buero_auftraege',
  bewegungen: '🔄 Lagerbewegungen → lager_bewegungen',
  belege: '📎 Belege → steuer_belege',
  projekte: '📅 Projekte → planung_projekte',
  steuer_belege: '🧾 Steuerbelege / Eingangsrechnungen → steuer_belege',
  steuer_buchungen: '📒 Buchungen → steuer_buchungen',
  steuer_ustva: '📊 UStVA-Daten → steuer_ustva',
  steuer_konten: '🗂️ Steuerkonten / Kontenrahmen → steuer_konten',
  werkstatt_zeitbuchungen: '⏱️ Werkstatt-Zeitbuchungen → werkstatt_zeitbuchungen',
  werkstatt_material: '🔩 Werkstatt-Materialverbrauch → werkstatt_material',
}


export default function ImportWizard({ isDemo, showToast }: { isDemo: boolean; showToast: (msg: string, type?: 'success' | 'error') => void }) {
  const [step, setStep] = useState(1)
  const [source, setSource] = useState<ImportSource>('Generisch')
  const [dataType, setDataType] = useState<ImportDataType>('artikel')
  const [file, setFile] = useState<File | null>(null)
  const [parseResult, setParseResult] = useState<ImportParseResult | null>(null)
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [validationResult, setValidationResult] = useState<ImportValidationResult | null>(null)
  const [importing, setImporting] = useState(false)
  const [protokolle, setProtokolle] = useState<ImportProtokoll[]>([])
  const [dragOver, setDragOver] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [delDialog, setDelDialog] = useState<{ id: string; count: number } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    getImportProtokolle().then(d => setProtokolle(d as ImportProtokoll[])).catch(() => {})
  }, [])

  const handleFile = useCallback(async (f: File) => {
    if (!f.name.endsWith('.csv') && !f.name.endsWith('.xlsx')) {
      showToast('Nur CSV-Dateien werden unterstützt (XLSX: in Kürze)', 'error'); return
    }
    if (f.name.endsWith('.xlsx')) {
      showToast('Excel-Dateien: Bitte als CSV exportieren (Datei → Speichern unter → CSV)', 'error'); return
    }
    setFile(f); setParsing(true)
    const result = await parseCsvFile(f)
    setParseResult(result)
    setMapping(autoMapColumns(result.headers, source, dataType))
    setParsing(false)
    if (result.error) { showToast(result.error, 'error'); return }
    setStep(3)
  }, [source, dataType, showToast])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }, [handleFile])

  const handleDemoSimulate = useCallback(async () => {
    const csvMap: Partial<Record<ImportDataType, string>> = {
      artikel: DEMO_CSV_ARTIKEL, kunden: DEMO_CSV_KUNDEN,
      steuer_belege: DEMO_CSV_STEUER, steuer_buchungen: DEMO_CSV_BUCHUNGEN,
    }
    const csv = csvMap[dataType] ?? DEMO_CSV_ARTIKEL
    const blob = new Blob([csv], { type: 'text/csv' })
    const f = new File([blob], `demo_${dataType}.csv`, { type: 'text/csv' })
    await handleFile(f)
  }, [dataType, handleFile])

  const handleValidate = () => {
    if (!parseResult) return
    const result = validateImportRows(parseResult.rows, dataType, mapping)
    setValidationResult(result)
    setStep(4)
  }

  const handleImport = async () => {
    if (!validationResult || !parseResult) return
    setImporting(true)
    // validationResult.valid enthält BEREITS gemappte Zeilen (target-fields) — nicht erneut mappen!
    const builtRows = validationResult.valid

    try {
      const result = await runBulkImport(dataType, builtRows)
      const importedCount = result.count
      const proto: ImportProtokoll = {
        id: genId('IMP'),
        quelle: source,
        datentyp: dataType,
        dateiname: file?.name ?? '',
        status: importedCount === 0 ? 'fehlgeschlagen' : validationResult.summary.invalid > 0 ? 'teilweise' : 'erfolgreich',
        anzahl_gesamt: validationResult.summary.total,
        anzahl_erfolgreich: importedCount,
        anzahl_fehlerhaft: validationResult.summary.invalid,
        erstellt_am: new Date().toISOString(),
      }
      await insertImportProtokoll({
        ...proto, fehler: validationResult.warnings as object,
        imported_ids: result.ids, ziel_tabelle: result.table,
      })
      setProtokolle(prev => [proto, ...prev])
      if (importedCount === 0) {
        showToast('⚠️ Import abgeschlossen, aber keine Datensätze geschrieben. Mapping prüfen.', 'error')
      } else {
        showToast(`✅ ${importedCount} Datensätze erfolgreich importiert`)
      }
      setStep(5)
    } catch (err) {
      showToast('Fehler beim Import: ' + String(err), 'error')
    } finally { setImporting(false) }
  }

  const handleDeleteProtokoll = async (id: string, rollback: boolean) => {
    try {
      const r = await deleteImportProtokoll(id, rollback)
      setProtokolle(prev => prev.filter(p => p.id !== id))
      showToast(rollback ? `🗑️ Protokoll und ${r.deleted_records} Datensätze gelöscht` : '🗑️ Protokoll gelöscht')
    } catch (err) {
      showToast('Fehler beim Löschen: ' + String(err), 'error')
    }
  }

  const reset = () => {
    setStep(1); setFile(null); setParseResult(null); setMapping({}); setValidationResult(null)
  }

  const STEP_LABELS = ['System', 'Datentyp', 'Upload', 'Mapping', 'Vorschau']

  // Schnelle Prüfung: Pflichtfeld 'name' (bzw. erstes required-Feld) im Mapping vorhanden?
  const requiredField = TARGET_FIELDS[dataType].find(f => f.required)
  const requiredMapped = requiredField ? Object.values(mapping).includes(requiredField.key) : true

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 1200, marginInline: 'auto', width: '100%' }}>
      {/* Header */}
      <div className="pk-card" style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h3 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 800 }}>📥 Datenimport & Migration</h3>
            <p style={{ margin: 0, color: '#aeb9c8', fontSize: 13 }}>
              Importiere Daten aus WISO, Lexware, DATEV, sevDesk, JTL und anderen Systemen als CSV.
              {isDemo && <span style={{ marginLeft: 8, padding: '2px 8px', borderRadius: 6, background: 'rgba(255,165,0,.15)', color: '#ffb347', fontSize: 11, fontWeight: 700 }}>DEMO</span>}
            </p>
          </div>
          {step > 1 && <button className="pk-btn-ghost" onClick={reset} style={{ fontSize: 12 }}>↺ Neu starten</button>}
        </div>

        {/* Step indicator */}
        <div style={{ display: 'flex', gap: 0, marginTop: 20, borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,.08)' }}>
          {STEP_LABELS.map((label, i) => {
            const n = i + 1
            const active = step === n
            const done = step > n
            return (
              <div key={n} style={{
                flex: 1, padding: '8px 4px', textAlign: 'center', fontSize: 11, fontWeight: 700,
                background: active ? 'rgba(22,132,255,.18)' : done ? 'rgba(37,211,102,.08)' : 'transparent',
                color: active ? '#6cb6ff' : done ? '#4ddb7e' : '#4a5568',
                borderRight: n < 5 ? '1px solid rgba(255,255,255,.06)' : 'none',
                transition: 'all .2s',
              }}>
                <div style={{ fontSize: 16 }}>{done ? '✓' : n}</div>
                <div style={{ marginTop: 2 }}>{label}</div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Step 1: System */}
      {step === 1 && (
        <div className="pk-card" style={{ padding: 24 }}>
          <h4 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 800 }}>Schritt 1: Quellsystem wählen</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10, marginBottom: 20 }}>
            {IMPORT_SOURCES.map(s => (
              <button key={s} onClick={() => setSource(s)} style={{
                padding: '14px 10px', borderRadius: 10, border: `2px solid ${source === s ? '#1684ff' : 'rgba(255,255,255,.08)'}`,
                background: source === s ? 'rgba(22,132,255,.12)' : 'rgba(255,255,255,.03)',
                color: source === s ? '#6cb6ff' : '#aeb9c8', fontWeight: source === s ? 700 : 500,
                cursor: 'pointer', fontSize: 13, transition: 'all .15s',
              }}>{s}</button>
            ))}
          </div>
          <div style={{ padding: '12px 16px', borderRadius: 8, background: 'rgba(22,132,255,.06)', border: '1px solid rgba(22,132,255,.15)', fontSize: 13, color: '#aeb9c8', marginBottom: 20 }}>
            💡 Exportiere deine Daten aus <strong style={{ color: '#6cb6ff' }}>{source}</strong> als CSV-Datei und lade sie hier hoch. Spalten werden automatisch erkannt und vorgeschlagen.
          </div>
          <button className="pk-btn" onClick={() => setStep(2)}>Weiter →</button>
        </div>
      )}

      {/* Step 2: Datentyp */}
      {step === 2 && (
        <div className="pk-card" style={{ padding: 24 }}>
          <h4 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 800 }}>Schritt 2: Was möchtest du importieren?</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            {(Object.keys(DATA_TYPE_LABELS) as ImportDataType[]).map(dt => (
              <button key={dt} onClick={() => setDataType(dt)} style={{
                padding: '12px 16px', borderRadius: 10, border: `2px solid ${dataType === dt ? '#1684ff' : 'rgba(255,255,255,.07)'}`,
                background: dataType === dt ? 'rgba(22,132,255,.1)' : 'rgba(255,255,255,.02)',
                color: dataType === dt ? '#6cb6ff' : '#aeb9c8', fontWeight: dataType === dt ? 700 : 500,
                cursor: 'pointer', fontSize: 13, textAlign: 'left', transition: 'all .15s',
              }}>{DATA_TYPE_LABELS[dt]}</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="pk-btn-ghost" onClick={() => setStep(1)}>← Zurück</button>
            <button className="pk-btn" onClick={() => setStep(3)}>Weiter →</button>
          </div>
        </div>
      )}

      {/* Step 3: Upload */}
      {step === 3 && (
        <div className="pk-card" style={{ padding: 24 }}>
          <h4 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 800 }}>Schritt 3: CSV-Datei hochladen</h4>
          <p style={{ margin: '0 0 20px', fontSize: 13, color: '#aeb9c8' }}>
            Ziel: <strong style={{ color: '#6cb6ff' }}>{DATA_TYPE_LABELS[dataType]}</strong>
          </p>

          {/* Drag & Drop zone */}
          <div
            role="button"
            tabIndex={0}
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click() }}
            style={{
              border: `2px dashed ${dragOver ? '#1684ff' : 'rgba(255,255,255,.15)'}`,
              borderRadius: 14, padding: '36px 24px', textAlign: 'center', cursor: 'pointer',
              background: dragOver ? 'rgba(22,132,255,.08)' : 'rgba(255,255,255,.02)',
              transition: 'all .2s', marginBottom: 16,
            }}
          >
            <div style={{ fontSize: 36, marginBottom: 10 }}>📁</div>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>
              {file ? file.name : 'CSV-Datei hier ablegen oder klicken'}
            </div>
            <div style={{ fontSize: 12, color: '#4a5568' }}>Unterstützt: .csv (XLSX: bitte als CSV exportieren)</div>
            {file && <div style={{ marginTop: 8, fontSize: 12, color: '#4ddb7e' }}>✓ {(file.size / 1024).toFixed(1)} KB geladen</div>}
          </div>
          <input ref={fileInputRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />

          {isDemo && (
            <div style={{ marginBottom: 16 }}>
              <button className="pk-btn-ghost" onClick={handleDemoSimulate} style={{ fontSize: 13 }}>
                🎭 Demo-CSV simulieren
              </button>
              <span style={{ fontSize: 12, color: '#4a5568', marginLeft: 10 }}>Lädt Beispieldaten für {dataType}</span>
            </div>
          )}

          {parsing && <div style={{ fontSize: 13, color: '#aeb9c8', marginBottom: 12 }}>⏳ Datei wird geparst…</div>}

          {parseResult && !parseResult.error && (
            <div style={{ padding: '12px 16px', borderRadius: 8, background: 'rgba(37,211,102,.06)', border: '1px solid rgba(37,211,102,.2)', fontSize: 13, marginBottom: 16 }}>
              ✅ <strong>{parseResult.totalRows}</strong> Zeilen erkannt · <strong>{parseResult.headers.length}</strong> Spalten · Trennzeichen: <code>&quot;{parseResult.delimiter}&quot;</code>
            </div>
          )}
          {parseResult?.error && (
            <div style={{ padding: '12px 16px', borderRadius: 8, background: 'rgba(255,80,80,.08)', border: '1px solid rgba(255,80,80,.25)', fontSize: 13, color: '#ff8080', marginBottom: 16 }}>
              ❌ {parseResult.error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <button className="pk-btn-ghost" onClick={() => setStep(2)}>← Zurück</button>
            {parseResult && !parseResult.error && (
              <button className="pk-btn" onClick={() => setStep(3.5 as never)}>Spalten mappen →</button>
            )}
          </div>
        </div>
      )}

      {/* Step 3.5: Column Mapping (shown between step 3 and 4) */}
      {(step as number) === 3.5 && parseResult && (
        <div className="pk-card" style={{ padding: 24 }}>
          <h4 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 800 }}>Schritt 4: Spalten zuordnen</h4>
          <p style={{ margin: '0 0 16px', fontSize: 13, color: '#aeb9c8' }}>
            Ordne die Spalten deiner Datei den Zielfeldern zu. Felder auf <strong>– ignorieren –</strong> werden übersprungen.
          </p>

          <div style={{ overflowX: 'auto', marginBottom: 16 }}>
            <table className="pk-table" style={{ minWidth: 900, width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ minWidth: 180 }}>Spalte in deiner Datei</th>
                  <th>Beispielwerte (Zeile 1–3)</th>
                  <th style={{ minWidth: 240 }}>Zielfeld in Petersen KI</th>
                </tr>
              </thead>
              <tbody>
                {parseResult.headers.map(header => {
                  const examples = [0, 1, 2]
                    .map(i => parseResult.rows[i]?.[header])
                    .filter(v => v !== undefined && v !== '')
                  const isMapped = mapping[header] && mapping[header] !== '__skip__'
                  return (
                    <tr key={header} style={{ background: isMapped ? 'rgba(37,211,102,.04)' : undefined }}>
                      <td style={{ fontWeight: 700, verticalAlign: 'top', padding: '8px 10px' }}>{header}</td>
                      <td style={{ color: '#aeb9c8', fontSize: 12, padding: '8px 10px', verticalAlign: 'top' }}>
                        {examples.length === 0
                          ? <span style={{ color: '#4a5568', fontStyle: 'italic' }}>(leer)</span>
                          : examples.map((v, i) => <div key={i} style={{ whiteSpace: 'normal', wordBreak: 'break-word', marginBottom: 2 }}>{v}</div>)}
                      </td>
                      <td style={{ padding: '8px 10px', verticalAlign: 'top' }}>
                        <select
                          className="pk-input"
                          value={mapping[header] ?? '__skip__'}
                          onChange={e => setMapping(prev => ({ ...prev, [header]: e.target.value }))}
                          style={{ fontSize: 13, padding: '8px 12px', width: '100%' }}
                        >
                          <option value="__skip__">– ignorieren –</option>
                          {TARGET_FIELDS[dataType].map(f => (
                            <option key={f.key} value={f.key}>
                              {f.label}{f.required ? ' *' : ''}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {!requiredMapped && requiredField && (
            <div style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(255,80,80,.08)', border: '1px solid rgba(255,80,80,.30)', fontSize: 13, color: '#ff8080', marginBottom: 12, fontWeight: 600 }}>
              ⚠️ Pflichtfeld <strong>{requiredField.label}</strong> ist noch keiner Spalte zugeordnet — der Import wird sonst leer bleiben!
            </div>
          )}
          <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(22,132,255,.06)', border: '1px solid rgba(22,132,255,.12)', fontSize: 12, color: '#aeb9c8', marginBottom: 16 }}>
            * Pflichtfelder müssen zugeordnet sein. Spalten mit grünem Hintergrund werden importiert.
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="pk-btn-ghost" onClick={() => setStep(3)}>← Zurück</button>
            <button className="pk-btn" onClick={handleValidate}>Prüfen & Vorschau →</button>
          </div>
        </div>
      )}

      {/* Step 4: Preview & Validation */}
      {step === 4 && validationResult && parseResult && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Summary */}
          <div className="pk-card" style={{ padding: 20 }}>
            <h4 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 800 }}>Schritt 5: Vorschau & Prüfung</h4>
            <div className="stats-grid">
              {[
                { label: 'Gesamt', val: validationResult.summary.total, color: '#f8fbff' },
                { label: 'Gültig', val: validationResult.summary.valid, color: '#4ddb7e' },
                { label: 'Fehlerhaft', val: validationResult.summary.invalid, color: '#ff8080' },
                { label: 'Warnungen', val: validationResult.summary.warnings, color: '#f59e0b' },
                { label: 'Duplikate', val: validationResult.summary.duplicates, color: '#a78bfa' },
              ].map(s => (
                <div key={s.label} className="pk-card" style={{ padding: '14px 16px' }}>
                  <div style={{ fontSize: 11, color: '#aeb9c8', marginBottom: 4 }}>{s.label}</div>
                  <div style={{ fontSize: 24, fontWeight: 900, color: s.color }}>{s.val}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Warnings */}
          {validationResult.warnings.length > 0 && (
            <div className="pk-card" style={{ padding: 20 }}>
              <div style={{ fontWeight: 700, marginBottom: 12 }}>⚠️ Prüf-Meldungen ({validationResult.warnings.length})</div>
              <div style={{ maxHeight: 240, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {validationResult.warnings.slice(0, 30).map((w, i) => (
                  <div key={i} style={{
                    display: 'flex', gap: 10, padding: '7px 10px', borderRadius: 7, fontSize: 12,
                    background: w.type === 'error' ? 'rgba(255,80,80,.07)' : w.type === 'warn' ? 'rgba(245,158,11,.07)' : 'rgba(22,132,255,.07)',
                    borderLeft: `2px solid ${w.type === 'error' ? '#ff5050' : w.type === 'warn' ? '#f59e0b' : '#1684ff'}`,
                  }}>
                    <span style={{ fontFamily: 'monospace', color: '#4a5568', flexShrink: 0 }}>Z.{w.row}</span>
                    <span style={{ color: '#aeb9c8' }}><strong>{w.field}:</strong> {w.message}</span>
                  </div>
                ))}
                {validationResult.warnings.length > 30 && <div style={{ fontSize: 12, color: '#4a5568' }}>… und {validationResult.warnings.length - 30} weitere</div>}
              </div>
            </div>
          )}

          {/* Preview table */}
          <div className="pk-card" style={{ padding: 20 }}>
            <div style={{ fontWeight: 700, marginBottom: 12 }}>Vorschau (erste 10 Zeilen, gültige Felder)</div>
            <div style={{ overflowX: 'auto' }}>
              <table className="pk-table" style={{ minWidth: 800, width: '100%' }}>
                <thead>
                  <tr>
                    {Object.values(mapping).filter(v => v && v !== '__skip__').map(field => (
                      <th key={field} style={{ padding: '8px 10px', textAlign: 'left' }}>{field}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {buildImportRows(parseResult.rows.slice(0, 10), mapping).map((row, i) => (
                    <tr key={i}>
                      {Object.values(mapping).filter(v => v && v !== '__skip__').map(field => (
                        <td key={field} style={{ fontSize: 12, padding: '8px 10px', maxWidth: 240, whiteSpace: 'normal', wordBreak: 'break-word', verticalAlign: 'top' }} title={row[field] ?? ''}>
                          {row[field] || <span style={{ color: '#4a5568' }}>—</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {validationResult.summary.valid === 0 && (
            <div style={{ padding: '14px 16px', borderRadius: 10, background: 'rgba(255,80,80,.08)', border: '1px solid rgba(255,80,80,.25)', color: '#ff8080', fontSize: 13, fontWeight: 600 }}>
              ❌ Keine gültigen Datensätze. Bitte Mapping überprüfen.
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="pk-btn-ghost" onClick={() => setStep(3.5 as never)}>← Mapping ändern</button>
            <button className="pk-btn-ghost" onClick={reset} style={{ color: '#ff8080', borderColor: 'rgba(255,80,80,.3)' }}>✕ Abbrechen</button>
            {validationResult.summary.valid > 0 && (
              <button className="pk-btn" onClick={handleImport} disabled={importing} style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
                {importing ? '⏳ Importiere…' : `✅ ${validationResult.summary.valid} Datensätze importieren`}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Step 5: Result */}
      {step === 5 && (
        <div className="pk-card" style={{ padding: 32, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
          <div style={{ fontWeight: 900, fontSize: 20, marginBottom: 8 }}>Import abgeschlossen!</div>
          <div style={{ color: '#aeb9c8', fontSize: 14, marginBottom: 20 }}>
            Die Daten wurden erfolgreich importiert und stehen jetzt im jeweiligen Piloten zur Verfügung.
            {isDemo && ' (Demo-Modus – keine echten Daten gespeichert)'}
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button className="pk-btn" onClick={reset}>Weiteren Import starten</button>
          </div>
        </div>
      )}

      {/* Import Protokolle */}
      <div className="pk-card" style={{ padding: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>📋 Import-Protokolle</div>
        {protokolle.length === 0 && !isDemo ? (
          <div style={{ color: '#4a5568', fontSize: 13 }}>Noch keine Importe durchgeführt.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="pk-table" style={{ minWidth: 900, width: '100%' }}>
              <thead>
                <tr><th>Datum</th><th>Quelle</th><th>Datentyp</th><th>Datei</th><th>Gesamt</th><th>OK</th><th>Fehler</th><th>Status</th><th></th></tr>
              </thead>
              <tbody>
                {(isDemo ? DEMO_PROTOKOLLE : protokolle).map(p => (
                  <tr key={p.id}>
                    <td style={{ fontSize: 12 }}>{new Date(p.erstellt_am).toLocaleDateString('de-DE')}</td>
                    <td style={{ fontWeight: 600 }}>{p.quelle}</td>
                    <td style={{ fontSize: 12 }}>{p.datentyp}</td>
                    <td style={{ fontSize: 11, color: '#aeb9c8', maxWidth: 200, whiteSpace: 'normal', wordBreak: 'break-word' }} title={p.dateiname}>{p.dateiname}</td>
                    <td style={{ fontFamily: 'monospace' }}>{p.anzahl_gesamt}</td>
                    <td style={{ fontFamily: 'monospace', color: '#4ddb7e' }}>{p.anzahl_erfolgreich}</td>
                    <td style={{ fontFamily: 'monospace', color: p.anzahl_fehlerhaft > 0 ? '#ff8080' : '#4a5568' }}>{p.anzahl_fehlerhaft}</td>
                    <td>
                      <span className={`badge ${p.status === 'erfolgreich' ? 'badge-green' : p.status === 'teilweise' ? 'badge-orange' : 'badge-red'}`}>
                        {p.status}
                      </span>
                    </td>
                    <td>
                      {!isDemo && (
                        <button onClick={() => setDelDialog({ id: p.id, count: p.anzahl_erfolgreich })}
                          style={{ fontSize: 11, padding: '4px 8px', borderRadius: 8, border: '1px solid rgba(255,80,80,.3)', background: 'rgba(255,80,80,.08)', color: '#ff8080', cursor: 'pointer' }}
                          title="Eintrag (optional mit Datensätzen) löschen">
                          🗑️
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {delDialog && (
        <div role="presentation" onClick={() => setDelDialog(null)} onKeyDown={e => { if (e.key === 'Escape') setDelDialog(null) }} style={{ position: 'fixed', inset: 0, zIndex: 1500, background: 'rgba(0,0,0,.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div role="presentation" onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()} className="pk-card" style={{ maxWidth: 520, width: '100%', padding: 24 }}>
            <h3 style={{ margin: '0 0 10px', fontSize: 17, fontWeight: 800 }}>Import löschen?</h3>
            <p style={{ margin: '0 0 18px', color: '#aeb9c8', fontSize: 13, lineHeight: 1.5 }}>
              Wähle, wie das Protokoll entfernt werden soll. <strong>Achtung:</strong> „Mit Daten&ldquo; entfernt zusätzlich
              alle <strong>{delDialog.count}</strong> beim Import angelegten Datensätze (z. B. Kunden in der DB).
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button className="pk-btn-ghost" onClick={() => { handleDeleteProtokoll(delDialog.id, false); setDelDialog(null) }} style={{ width: '100%', justifyContent: 'flex-start', padding: '12px 16px' }}>
                📋 Nur Protokoll-Eintrag entfernen
              </button>
              <button onClick={() => { handleDeleteProtokoll(delDialog.id, true); setDelDialog(null) }}
                style={{ width: '100%', padding: '12px 16px', borderRadius: 10, border: '1px solid rgba(255,80,80,.4)', background: 'rgba(255,80,80,.12)', color: '#ff8080', cursor: 'pointer', fontWeight: 700, textAlign: 'left' }}>
                🗑️ Protokoll + alle {delDialog.count} importierten Datensätze löschen
              </button>
              <button className="pk-btn-ghost" onClick={() => setDelDialog(null)} style={{ width: '100%' }}>
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const DEMO_PROTOKOLLE: ImportProtokoll[] = [
  { id: 'IMP-001', quelle: 'WISO', datentyp: 'artikel', dateiname: 'wiso_artikel_export.csv', status: 'erfolgreich', anzahl_gesamt: 48, anzahl_erfolgreich: 48, anzahl_fehlerhaft: 0, erstellt_am: '2025-04-10T09:15:00Z' },
  { id: 'IMP-002', quelle: 'Lexware', datentyp: 'kunden', dateiname: 'kundenstamm_2025.csv', status: 'teilweise', anzahl_gesamt: 120, anzahl_erfolgreich: 118, anzahl_fehlerhaft: 2, erstellt_am: '2025-04-08T14:30:00Z' },
  { id: 'IMP-003', quelle: 'DATEV CSV', datentyp: 'steuer_belege', dateiname: 'datev_belege_q1.csv', status: 'erfolgreich', anzahl_gesamt: 34, anzahl_erfolgreich: 34, anzahl_fehlerhaft: 0, erstellt_am: '2025-04-01T11:00:00Z' },
]

type BulkResult = { count: number; ids: string[]; table?: string }

async function runBulkImport(dataType: ImportDataType, rows: Record<string, string>[]): Promise<BulkResult> {

  if (dataType === 'artikel') {
    const prepared = rows.map(r => ({
      id: genId('ART'), name: r.name ?? '', artikelnummer: r.artikelnummer,
      beschreibung: r.beschreibung, einheit: r.einheit, lagerort: r.lagerort,
      bestand: normalizeNumber(r.bestand ?? '') ?? 0,
      mindestbestand: normalizeNumber(r.mindestbestand ?? '') ?? 0,
      einkaufspreis: normalizeNumber(r.einkaufspreis ?? '') ?? 0,
      verkaufspreis: normalizeNumber(r.verkaufspreis ?? '') ?? 0,
    }))
    await bulkImportLagerArtikel(prepared)
    return { count: prepared.length, ids: prepared.map(p => p.id), table: 'lager_artikel' }
  }
  if (dataType === 'kunden') {
    const prepared = rows.map(r => {
      const fullName = [r.vorname?.trim(), r.nachname?.trim()].filter(Boolean).join(' ').trim()
      // Name = Firma, sonst Ansprechpartner, sonst Vorname+Nachname
      const name = (r.name?.trim()) || (r.ansprechpartner?.trim()) || fullName
      // Ansprechpartner = explizit angegeben, sonst Vorname+Nachname
      const ansprechpartner = r.ansprechpartner?.trim() || fullName || undefined
      return {
        id: genId('KD'), name,
        kundennummer: r.kundennummer || undefined,
        ansprechpartner,
        email: r.email || undefined, telefon: r.telefon || undefined, mobil: r.mobil || undefined,
        strasse: r.strasse || undefined, plz: r.plz || undefined, ort: r.ort || undefined, land: r.land || undefined,
        website: r.website || undefined, ust_id: r.ust_id || undefined,
        adresse: r.adresse || undefined, notizen: r.notizen || undefined,
      }
    }).filter(r => r.name.trim().length > 0)
    if (!prepared.length) return { count: 0, ids: [], table: 'buero_kunden' }
    const result = await bulkImportBueroKunden(prepared)
    return { count: result.length, ids: result.map(r => r.id), table: 'buero_kunden' }
  }
  if (dataType === 'lieferanten') {
    const prepared = rows.map(r => ({ id: genId('LFR'), name: r.name ?? '', email: r.email, telefon: r.telefon, ort: r.ort, kategorie: r.kategorie, zahlungsziel: r.zahlungsziel, notiz: r.notiz }))
    await bulkImportEinkaufLieferanten(prepared)
    return { count: prepared.length, ids: prepared.map(p => p.id), table: 'einkauf_lieferanten' }
  }
  if (dataType === 'rechnungen') {
    const prepared = rows.map(r => ({ id: genId('RE'), nummer: r.nummer ?? genId('RE'), kunde: r.kunde, datum: normalizeDate(r.datum ?? '') ?? undefined, faellig_am: normalizeDate(r.faellig_am ?? '') ?? undefined, summe: normalizeNumber(r.summe ?? '') ?? 0, status: r.status ?? 'Offen', notiz: r.notiz }))
    await bulkImportBueroRechnungen(prepared)
    return { count: prepared.length, ids: prepared.map(p => p.id), table: 'buero_rechnungen' }
  }
  if (dataType === 'steuer_belege' || dataType === 'belege') {
    const prepared = rows.map(r => ({
      id: genId('BLG'), lieferant: r.lieferant ?? '', datum: normalizeDate(r.datum ?? '') ?? new Date().toISOString().split('T')[0],
      betrag: normalizeNumber(r.betrag ?? '') ?? 0, steuerbetrag: normalizeNumber(r.steuerbetrag ?? '') ?? 0,
      steuersatz: normalizeNumber(r.steuersatz ?? '') ?? 19, belegnummer: r.belegnummer,
      kategorie: r.kategorie, status: r.status ?? 'offen', notiz: r.notiz,
    }))
    await bulkImportSteuerBelege(prepared)
    return { count: prepared.length, ids: prepared.map(p => p.id), table: 'steuer_belege' }
  }
  if (dataType === 'steuer_buchungen') {
    const prepared = rows.map(r => ({
      id: genId('BCH'), datum: normalizeDate(r.datum ?? '') ?? new Date().toISOString().split('T')[0],
      buchungstext: r.buchungstext ?? '', betrag: normalizeNumber(r.betrag ?? '') ?? 0,
      soll_konto: r.soll_konto, haben_konto: r.haben_konto, steuerkonto: r.steuerkonto,
      steuersatz: normalizeNumber(r.steuersatz ?? '') ?? undefined, beleg_id: r.beleg_id, status: r.status ?? 'offen',
    }))
    await bulkImportSteuerBuchungen(prepared)
    return { count: prepared.length, ids: prepared.map(p => p.id), table: 'steuer_buchungen' }
  }
  if (dataType === 'steuer_konten') {
    const prepared = rows.map(r => ({ id: genId('KTO'), kontonummer: r.kontonummer ?? '', name: r.name ?? '', typ: r.typ, steuersatz: normalizeNumber(r.steuersatz ?? '') ?? undefined, aktiv: r.aktiv !== 'false' }))
    await bulkImportSteuerKonten(prepared)
    return { count: prepared.length, ids: prepared.map(p => p.id), table: 'steuer_konten' }
  }
  if (dataType === 'werkstatt_zeitbuchungen') {
    const today = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
    const prepared = rows.map(r => ({
      mitarbeiter: r.mitarbeiter ?? '',
      auftragsnr: r.auftragsnr ?? '',
      stunden: normalizeNumber(r.stunden ?? '') ?? 0,
      datum: r.datum || today,
      taetigkeit: r.taetigkeit ?? '',
    }))
    await bulkImportWerkstattZeitbuchungen(prepared)
    return { count: prepared.length, ids: [], table: 'werkstatt_zeitbuchungen' }
  }
  if (dataType === 'werkstatt_material') {
    const today = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
    const prepared = rows.map(r => ({
      artikel: r.artikel ?? '',
      menge: normalizeNumber(r.menge ?? '') ?? 0,
      einheit: r.einheit ?? 'Stk',
      auftragsnr: r.auftragsnr ?? '',
      datum: r.datum || today,
      mitarbeiter: r.mitarbeiter ?? '',
    }))
    await bulkImportWerkstattMaterial(prepared)
    return { count: prepared.length, ids: [], table: 'werkstatt_material' }
  }
  return { count: 0, ids: [] }
}
