import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import { getAccessProfile } from '@/lib/access'

function resolveRequiredPilot(pathname: string) {
  if (pathname === '/dashboard' || pathname.startsWith('/dashboard/einstellungen')) return null
  if (pathname.startsWith('/dashboard/lager')) return 'lager'
  if (pathname.startsWith('/dashboard/buero')) return 'buero'
  if (pathname.startsWith('/dashboard/werkstatt')) return 'werkstatt'
  if (pathname.startsWith('/dashboard/marketing')) return 'marketing'
  if (pathname.startsWith('/dashboard/analyse')) return 'analyse'
  if (pathname.startsWith('/dashboard/planung')) return 'planung'
  if (pathname.startsWith('/dashboard/steuer')) return 'steuer'
  if (
    pathname.startsWith('/dashboard/ki-erkennung')
    || pathname.startsWith('/dashboard/cloud')
    || pathname.startsWith('/dashboard/archiv')
  ) {
    return 'general'
  }
  return null
}

export async function middleware(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  const path = request.nextUrl.pathname
  const isDashboard = path.startsWith('/dashboard')
  const isLogin = path === '/login'
  const isRegister = path === '/register'
  const isApprovalPage = path === '/freischaltung'
  const isAuthCallback = path.startsWith('/auth/callback')

  // Auth callback must always pass through
  if (isAuthCallback) return NextResponse.next()

  // Demo cookie set? → always allow dashboard access
  const demoCookie = request.cookies.get('pk_demo')?.value === '1'
  if (demoCookie) {
    // Logged-in demo user visits login/register → send to dashboard
    if (isLogin || isRegister) {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }
    return NextResponse.next()
  }

  // Supabase not configured → let client-side layout handle auth
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.next()
  }

  let response = NextResponse.next({ request: { headers: request.headers } })

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      get(name) { return request.cookies.get(name)?.value },
      set(name, value, options) {
        request.cookies.set({ name, value, ...options })
        response = NextResponse.next({ request: { headers: request.headers } })
        response.cookies.set({ name, value, ...options })
      },
      remove(name, options) {
        request.cookies.set({ name, value: '', ...options })
        response = NextResponse.next({ request: { headers: request.headers } })
        response.cookies.set({ name, value: '', ...options })
      },
    },
  })

  let user = null
  try {
    const { data } = await supabase.auth.getUser()
    user = data.user
  } catch {
    return NextResponse.next()
  }

  if ((isDashboard || isApprovalPage) && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (!user) {
    return response
  }

  const access = getAccessProfile(user)

  if (isApprovalPage) {
    if (access.canAccessDashboard) {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      url.search = ''
      return NextResponse.redirect(url)
    }
    return response
  }

  if (!access.canAccessDashboard && (isDashboard || isLogin || isRegister)) {
    const url = request.nextUrl.clone()
    url.pathname = '/freischaltung'
    url.search = ''
    if (access.isExpired) {
      url.searchParams.set('status', 'expired')
    } else if (access.status === 'suspended') {
      url.searchParams.set('status', 'suspended')
    } else {
      url.searchParams.set('status', 'pending')
    }
    return NextResponse.redirect(url)
  }

  if ((isLogin || isRegister) && user) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    url.search = ''
    return NextResponse.redirect(url)
  }

  if (isDashboard) {
    const requiredPilot = resolveRequiredPilot(path)
    if (requiredPilot === 'general' && access.allowedPilotIds.length === 0) {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      url.search = '?access=restricted'
      return NextResponse.redirect(url)
    }
    if (requiredPilot && requiredPilot !== 'general' && !access.allowedPilotIds.includes(requiredPilot)) {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      url.search = '?access=restricted'
      return NextResponse.redirect(url)
    }
  }

  return response
}

export const config = {
  matcher: ['/dashboard/:path*', '/login', '/register', '/freischaltung'],
}
