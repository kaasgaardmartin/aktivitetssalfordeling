export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-gray-900">
          <svg viewBox="0 0 16 16" className="h-6 w-6 fill-white">
            <path d="M8 2L14 6V10L8 14L2 10V6L8 2Z" />
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
            Aktivitetssalfordeling
          </h1>
          <p className="mt-2 text-sm text-gray-600">Aktivitetssaler Oslo</p>
        </div>
        <div className="card p-6 text-left space-y-4">
          <p className="text-sm text-gray-600 leading-relaxed">
            Logg inn via lenken du mottok på e-post fra Oslo idrettssekretariat.
          </p>
          <p className="text-sm text-gray-600">
            Har du ikke fått lenke? Kontakt{' '}
            <a href="mailto:idrettssekretariatet@oslo.kommune.no" className="text-blue-600 underline">
              idrettssekretariatet
            </a>
            .
          </p>
        </div>
        <p className="text-xs text-gray-500">
          Administrasjon?{' '}
          <a href="/admin" className="text-gray-700 underline">
            Admin-innlogging
          </a>
        </p>
      </div>
    </main>
  )
}
