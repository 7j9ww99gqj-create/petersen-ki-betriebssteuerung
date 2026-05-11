export function ComingSoonPaymentMethods() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
      <ComingSoon title="SEPA-Lastschrift" icon="🏦" text="Die monatliche Zahlung per SEPA-Lastschrift wird bald verfügbar sein." />
      <ComingSoon title="PayPal" icon="🅿️" text="PayPal-Zahlungen werden demnächst unterstützt." />
    </div>
  )
}

function ComingSoon({ title, icon, text }: { title: string; icon: string; text: string }) {
  return (
    <div className="pk-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900 }}>{icon} {title}</h3>
          <p style={{ margin: '8px 0 0', color: '#aeb9c8', fontSize: 13, lineHeight: 1.5 }}>{text}</p>
        </div>
        <span className="badge badge-orange">Bald verfügbar</span>
      </div>
    </div>
  )
}

