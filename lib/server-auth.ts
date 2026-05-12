import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

const SERVER_ROLES = ['Admin', 'Mitarbeiter', 'Büro', 'Werkstatt', 'Lager'] as const

export type ServerAppRole = (typeof SERVER_ROLES)[number]

function getEnv() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '')
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
  return { url, key }
}

function normalizeRole(value: unknown): ServerAppRole {
  if (typeof value === 'string' && SERVER_ROLES.includes(value as ServerAppRole)) {
    return value as ServerAppRole
  }
  return 'Mitarbeiter'
}

export async function getRouteAccess(req: NextRequest, allowedRoles?: ServerAppRole[]) {
  const isDemo = req.cookies.get('pk_demo')?.value === '1'
  if (isDemo) {
    return { isDemo: true as const, role: 'Admin' as ServerAppRole, user: null, supabase: null, error: null }
  }

  const { url, key } = getEnv()
  if (!url || !key) {
    return {
      isDemo: false as const,
      role: null,
      user: null,
      supabase: null,
      error: NextResponse.json({ error: 'Supabase ist serverseitig nicht konfiguriert.' }, { status: 500 }),
    }
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      get(name) {
        return req.cookies.get(name)?.value
      },
      set() {},
      remove() {},
    },
  })

  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) {
    return {
      isDemo: false as const,
      role: null,
      user: null,
      supabase: null,
      error: NextResponse.json({ error: 'Nicht authentifiziert.' }, { status: 401 }),
    }
  }

  const role = normalizeRole(data.user.app_metadata?.role ?? data.user.user_metadata?.role)
  if (allowedRoles && !allowedRoles.includes(role)) {
    return {
      isDemo: false as const,
      role,
      user: data.user,
      supabase,
      error: NextResponse.json({ error: 'Keine Berechtigung für diese Aktion.' }, { status: 403 }),
    }
  }

  return { isDemo: false as const, role, user: data.user, supabase, error: null }
}
