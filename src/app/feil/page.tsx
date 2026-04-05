export default async function FeilPage({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  const params = await searchParams
  const meldinger: Record<string, string> = {
    'ingen-token': 'Ingen innloggingslenke funnet.',
    'ugyldig-token': 'Innloggingslenken er ugyldig.',
    'utlopt-token': 'Innloggingslenken har utl\u00f8pt (gyldig i 7 dager).',
  }
  const melding = meldinger[params.msg ?? ''] ?? 'Noe gikk galt.'
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-4 text-center">
        <h1 className="text-lg font-semibold text-gray-900">Kunne ikke logge inn</h1>
        <p className="text-sm text-gray-600">{melding}</p>
      </div>
    </main>
  )
}
