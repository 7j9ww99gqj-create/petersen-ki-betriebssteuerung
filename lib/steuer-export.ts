/**
 * ELSTER-XML Export für Umsatzsteuer-Voranmeldung (UStVA)
 * Kennzahlen: 81 (Umsatzsteuer), 83 (Vorsteuer)
 * Format: ElsterOnline UStVA XML (vereinfacht, zur Vorbereitung)
 */

export function generateElsterXml(
  periode: string,
  ustBetrag: number,
  vstBetrag: number
): string {
  const zahllast = ustBetrag - vstBetrag
  const [jahr, monat] = periode.split('-')

  const r = (n: number) => Math.round(n * 100) / 100
  const cents = (n: number) => Math.round(n * 100)

  const now = new Date()
  const erstelltAm = now.toISOString().replace('T', ' ').slice(0, 19)

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!-- ELSTER UStVA XML Export – erstellt am ${erstelltAm} -->
<!-- Hinweis: Diese Datei dient als Vorbereitungsdokument. -->
<!-- Bitte mit Ihrem Steuerberater abstimmen. -->
<Elster xmlns="http://www.elster.de/elsterxml/schema/v12">
  <TransferHeader>
    <Verfahren>ElsterAnmeldung</Verfahren>
    <DatenArt>UStVA</DatenArt>
    <Vorgang>send-NoSig</Vorgang>
    <Erstellungsdatum>${now.toISOString().slice(0, 10).replace(/-/g, '')}</Erstellungsdatum>
  </TransferHeader>
  <DatenTeil>
    <Nutzdaten>
      <Anmeldungssteuern art="UStVA" version="201501">
        <DatenLieferant>
          <Name>Petersen KI Betriebssteuerung</Name>
          <Erstellungsdatum>${erstelltAm}</Erstellungsdatum>
        </DatenLieferant>
        <Erklarung>
          <Zeitraum>
            <Jahr>${jahr}</Jahr>
            <Monat>${monat}</Monat>
          </Zeitraum>
          <Steuerfall>
            <Umsatzsteuervoranmeldung>
              <!-- Kennzahl 81: Umsatzsteuer (§ 18 UStG) -->
              <Kz81>${r(ustBetrag).toFixed(2)}</Kz81>
              <!-- Kennzahl 83: Abziehbare Vorsteuerbetraege (§ 15 UStG) -->
              <Kz83>${r(vstBetrag).toFixed(2)}</Kz83>
              <!-- Berechnete Zahllast / Erstattungsbetrag -->
              <Kz83Differenz>${r(zahllast).toFixed(2)}</Kz83Differenz>
              <!-- Betraege in Cent fuer maschinelle Verarbeitung -->
              <Kz81Cent>${cents(ustBetrag)}</Kz81Cent>
              <Kz83Cent>${cents(vstBetrag)}</Kz83Cent>
              <ZahllastCent>${cents(zahllast)}</ZahllastCent>
            </Umsatzsteuervoranmeldung>
          </Steuerfall>
        </Erklarung>
      </Anmeldungssteuern>
    </Nutzdaten>
  </DatenTeil>
</Elster>`

  return xml
}

export function downloadElsterXml(
  periode: string,
  ustBetrag: number,
  vstBetrag: number
): void {
  const xml = generateElsterXml(periode, ustBetrag, vstBetrag)
  const blob = new Blob([xml], { type: 'application/xml;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `ELSTER_UStVA_${periode}.xml`
  a.click()
  URL.revokeObjectURL(url)
}
