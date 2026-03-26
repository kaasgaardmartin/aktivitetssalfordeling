import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Protect /klubb/* routes — require klubb_session cookie
  if (pathname.startsWith('/klubb')) {
    const session = request.cookies.get('klubb_session')?.value
    if (!session) {
      return NextResponse.redirect(new URL('/logg-inn', request.url))
    }
    try {
      const parsed = JSON.parse(session)
      if (new Date(parsed.exp) < new Date()) {
        const response = NextResponse.redirect(new URL('/logg-inn?msg=utlopt', request.url))
        response.cookies.delete('klubb_session')
        return response
      }
    } catch {
      return NextResponse.redirect(new URL('/logg-inn', request.url))
    }
  }

  // Protect /admin/* routes — require admin_session cookie
  // (In production: replace with proper auth, e.g. Supabase Auth with admin role)
  if (pathname.startsWith('/admin')) {
    const adminSession = request.cookies.get('admin_session')?.value
    if (!adminSession) {
      return NextResponse.redirect(new URL('/admin/logg-inn', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/klubb/:path*', '/admin/:path*'],
}
