import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { COMPETITION_COOKIE, isCompetitionKey } from '@/lib/competition-client'

export async function proxy(request: NextRequest) {
  // Shareable competition links: /?comp=basketball_men sets the cookie and
  // redirects to the clean URL. Runs on every route, before the auth work.
  const comp = request.nextUrl.searchParams.get('comp')
  if (comp && isCompetitionKey(comp)) {
    const url = request.nextUrl.clone()
    url.searchParams.delete('comp')
    const res = NextResponse.redirect(url)
    res.cookies.set(COMPETITION_COOKIE, comp, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' })
    return res
  }

  const path = request.nextUrl.pathname
  const isAdminRoute = path.startsWith('/admin')
  const isOverlayRoute = path.startsWith('/overlay')

  // Only admin/overlay need the Supabase session; skip it for public pages.
  if (!isAdminRoute && !isOverlayRoute) return NextResponse.next()

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const isLoginPage = path === '/admin/login'

  if (isAdminRoute && !isLoginPage && !user) {
    return NextResponse.redirect(new URL('/admin/login', request.url))
  }
  if (isLoginPage && user) {
    return NextResponse.redirect(new URL('/admin', request.url))
  }
  if (isOverlayRoute) {
    supabaseResponse.headers.set('x-overlay', '1')
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
}
