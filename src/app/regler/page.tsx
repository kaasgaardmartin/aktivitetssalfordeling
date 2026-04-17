import { createAdminClient } from '@/lib/supabase'
import Link from 'next/link'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Regler for tildeling — Aktivitetssaler Oslo' }

export default async function ReglerPage() {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('regler_info')
    .select('innhold, oppdatert_at')
    .order('oppdatert_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-3xl px-4 py-4 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-gray-900">Regler for tildeling</h1>
          <div className="flex items-center gap-3 text-xs text-gray-600">
            <Link href="/ledig" className="underline">Ledige tider</Link>
            <span>·</span>
            <Link href="/oversikt" className="underline">Kart og fordeling</Link>
            <span>·</span>
            <Link href="/" className="underline">← Forside</Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-8">
        {data?.innhold ? (
          <div className="card p-6">
            <pre className="whitespace-pre-wrap font-sans text-sm text-gray-800 leading-relaxed">
              {data.innhold}
            </pre>
            {data.oppdatert_at && (
              <p className="mt-6 text-xs text-gray-400 border-t border-gray-100 pt-4">
                Sist oppdatert:{' '}
                {new Date(data.oppdatert_at).toLocaleDateString('nb-NO', {
                  day: 'numeric', month: 'long', year: 'numeric',
                })}
              </p>
            )}
          </div>
        ) : (
          <div className="card p-6 text-center text-sm text-gray-500">
            Regler er ikke publisert ennå.
          </div>
        )}
      </div>
    </main>
  )
}
