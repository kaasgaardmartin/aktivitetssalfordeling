import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
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

  // Beskytt /admin/* UNNTATT /admin/logg-inn
  if (pathname.startsWith('/admin') && !pathname.startsWith('/admin/logg-inn')) {
    const adminSession = request.cookies.get('admin_session')?.value
    if (!adminSession) return NextResponse.redirect(new URL('/admin/logg-inn', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/klubb/:path*', '/admin/:path*'],
}
