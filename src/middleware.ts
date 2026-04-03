import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Beskytt /klubb/* - krever klubb_session cookie
  if (pathname.startsWith('/klubb')) {
    const session = request.cookies.get('klubb_session')?.value
    if (!session) return NextResponse.redirect(new URL('/logg-inn', request.url))
    try {
      const parsed = JSON.parse(session)
      if (new Date(parsed.exp) < new Date()) {
        const r = NextResponse.redirect(new URL('/logg-inn?msg=utlopt', request.url))
        r.cookies.delete('klubb_session')
        return r
      }
    } catch { return NextResponse.redirect(new URL('/logg-inn', request.url)) }
  }

  // Beskytt /admin/* UNNTATT /admin/logg-inn — krever Supabase Auth-sesjon
  if (pathname.startsWith('/admin') && !pathname.startsWith('/admin/logg-inn')) {
    let response = NextResponse.next({ request })

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return request.cookies.getAll() },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              request.cookies.set(name, value)
              response.cookies.set(name, value, options)
            })
          },
        },
      }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.redirect(new URL('/admin/logg-inn', request.url))
    }

    return response
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/klubb/:path*', '/admin/:path*'],
}
