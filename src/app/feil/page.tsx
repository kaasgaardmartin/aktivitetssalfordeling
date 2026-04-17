import Link from 'next/link'

export const metadata = { title: 'Innloggingsfeil — Aktivitetssaler Oslo' }

export default async function FeilPage({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  const params = await searchParams
  const meldinger: Record<string, string> = {
    'ingen-token': 'Ingen innloggingslenke funnet.',
    'ugyldig-token': 'Innloggingslenken er ugyldig.',
    'utlopt-token': 'Innloggingslenken har utløpt eller er allerede brukt. Be om en ny lenke fra ditt forbund.',
  }
  const melding = meldinger[params.msg ?? ''] ?? 'Noe gikk galt.'
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-5 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 mx-auto">
          <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>
        <h1 className="text-lg font-semibold text-gray-900">Kunne ikke logge inn</h1>
        <p className="text-sm text-gray-600">{melding}</p>
        <div className="flex flex-col gap-2 pt-2">
          <Link href="/" className="btn text-sm w-full justify-center">← Til forsiden</Link>
          <Link href="/ledig" className="text-xs text-gray-500 underline">Se ledige tider</Link>
        </div>
      </div>
    </main>
  )
}
