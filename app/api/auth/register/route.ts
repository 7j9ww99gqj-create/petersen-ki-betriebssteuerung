import { NextRequest, NextResponse } from 'next/server'

import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase-admin'

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export async function POST(req: NextRequest) {
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Registrierung ist serverseitig noch nicht konfiguriert.' }, { status: 503 })
  }

  const body = await req.json().catch(() => null) as {
    email?: string
    password?: string
    fullName?: string
    company?: string
    strasse?: string
    plz?: string
    stadt?: string
    interessiertePiloten?: string[]
  } | null

  const email = body?.email?.trim().toLowerCase() ?? ''
  const password = body?.password ?? ''
  const fullName = body?.fullName?.trim() || email.split('@')[0] || 'Neuer Kunde'
  const company = body?.company?.trim() ?? ''
  const strasse = body?.strasse?.trim() ?? ''
  const plz = body?.plz?.trim() ?? ''
  const stadt = body?.stadt?.trim() ?? ''
  const interessiertePiloten: string[] = Array.isArray(body?.interessiertePiloten) ? body.interessiertePiloten : []

  if (!email || !isValidEmail(email)) {
    return NextResponse.json({ error: 'Bitte eine gueltige E-Mail angeben.' }, { status: 400 })
  }
  if (password.length < 6) {
    return NextResponse.json({ error: 'Passwort muss mindestens 6 Zeichen lang sein.' }, { status: 400 })
  }

  const admin = createSupabaseAdminClient()
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: {
      role: 'Mitarbeiter',
      access_status: 'pending',
      access_mode: 'standard',
      allowed_pilot_ids: [],
      access_expires_at: null,
    },
    user_metadata: {
      full_name: fullName,
      firma: company,
      role: 'Mitarbeiter',
      access_status: 'pending',
      access_mode: 'standard',
      allowed_pilot_ids: [],
      access_expires_at: null,
    },
  })

  if (created.error || !created.data?.user) {
    const message = /already registered|already exists|duplicate/i.test(created.error?.message ?? '')
      ? 'Fuer diese E-Mail existiert bereits ein Benutzer.'
      : created.error?.message ?? 'Benutzer konnte nicht angelegt werden.'
    return NextResponse.json({ error: message }, { status: message.includes('bereits') ? 409 : 500 })
  }

  const user = created.data.user
  const ownerLookup = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
  const ownerUserId = ownerLookup.data?.users.find(entry => entry.email?.toLowerCase() === 'info@petersen-ki-pilot.de')?.id

  if (ownerUserId) {
    const customerId = `REG-${user.id}`

    const adresse = strasse || undefined
    const ort = plz && stadt ? `${plz} ${stadt}` : (stadt || plz || undefined)

    const pilotenNotiz = interessiertePiloten.length > 0
      ? `Interesse: ${interessiertePiloten.join(', ')}`
      : undefined

    await admin.from('buero_kunden').upsert({
      id: customerId,
      user_id: ownerUserId,
      auth_user_id: user.id,
      source: 'registration',
      name: company || fullName,
      typ: 'Registrierung',
      ansprechpartner: fullName,
      email,
      adresse,
      ort,
      notizen: pilotenNotiz,
      status: 'In Prüfung',
      software_enabled: false,
      updated_at: new Date().toISOString(),
    })

    await admin.rpc('pk_register_owner_event', {
      p_source: 'system',
      p_event_type: 'registration.created',
      p_severity: 'info',
      p_entity_type: 'auth_user',
      p_entity_id: user.id,
      p_dedupe_key: `registration:${user.id}`,
      p_title: 'Neue Registrierung wartet',
      p_message: `${email} hat sich registriert und wartet auf Freigabe.`,
      p_link_url: '/dashboard/einstellungen?section=registrierungen',
      p_payload: {
        user_id: user.id,
        email,
        full_name: fullName,
        company,
        adresse,
        ort,
        interessierte_piloten: interessiertePiloten,
        customer_id: customerId,
      },
    })
  }

  return NextResponse.json({ ok: true, userId: user.id })
}
