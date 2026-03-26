export default function FeilPage({ searchParams }: { searchParams: { msg?: string } }) {
  const meldinger: Record<string, string> = {
    'ingen-token': 'Ingen innloggingslenke funnet.',
    'ugyldig-token': 'Innloggingslenken er ugyldig.',
    'utlopt-token': 'Innloggingslenken har utløpt (gyldig i 7 dager).',
  }

  const melding = meldinger[searchParams.msg ?? ''] ?? 'Noe gikk galt.'

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-4 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
          <span className="text-2xl">!</span>
        </div>
        <h1 className="text-lg font-semibold text-gray-900">Kunne ikke logge inn</h1>
        <p className="text-sm text-gray-500">{melding}</p>
        <p className="text-sm text-gray-500">
          Kontakt{' '}
          <a href="mailto:idrettssekretariatet@oslo.kommune.no" className="text-blue-600 underline">
            idrettssekretariatet
          </a>{' '}
          for en ny lenke.
        </p>
      </div>
    </main>
  )
}
