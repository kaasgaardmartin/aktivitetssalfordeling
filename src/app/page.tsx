import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen bg-white">

      {/* Hero */}
      <div className="bg-gray-900 text-white">
        <div className="mx-auto max-w-4xl px-6 py-16 sm:py-24">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">
              <svg viewBox="0 0 16 16" className="h-5 w-5 fill-white">
                <path d="M8 2L14 6V10L8 14L2 10V6L8 2Z" />
              </svg>
            </div>
            <span className="text-sm font-medium text-white/60">aktivitetssal.no</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
            Fordeling av aktivitetssaler i Oslo
          </h1>
          <p className="text-lg text-white/75 max-w-2xl leading-relaxed">
            Oslo idrettskrets tildeler tid i kommunale aktivitetssaler til de seks kampidrettsforbundene:
            Norges Bokseforbund, Norges Bryteforbund, Norges Fekteforbund, Norges Judoforbund,
            Norges Kickbokseforbund og Norges Kampsportforbund.
            Hvert forbund fordeler deretter tiden videre til sine tilknyttede klubber.
          </p>
          <p className="mt-3 text-sm text-white/50">
            Dette nettstedet administreres av Martin Kaasgaard Nielsen på vegne av kampidrettsforbundene.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-6 py-12 space-y-14">

        {/* Slik fungerer det */}
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Slik fungerer fordelingen</h2>
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="rounded-xl bg-gray-50 ring-1 ring-gray-200 p-5">
              <div className="text-2xl font-bold text-gray-300 mb-2">1</div>
              <h3 className="font-semibold text-gray-900 mb-1">Oslo idrettskrets tildeler</h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                Idrettskretsen fordeler treningstid i kommunale saler til kampidrettsforbundene basert på behov og kapasitet.
              </p>
            </div>
            <div className="rounded-xl bg-gray-50 ring-1 ring-gray-200 p-5">
              <div className="text-2xl font-bold text-gray-300 mb-2">2</div>
              <h3 className="font-semibold text-gray-900 mb-1">Forbundene fordeler videre</h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                Kampidrettsforbundene administrerer fordelingen mellom de tilknyttede klubbene via dette nettstedet.
              </p>
            </div>
            <div className="rounded-xl bg-gray-50 ring-1 ring-gray-200 p-5">
              <div className="text-2xl font-bold text-gray-300 mb-2">3</div>
              <h3 className="font-semibold text-gray-900 mb-1">Klubbene søker og bekrefter</h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                Klubbene logger inn, søker om ønsket treningstid og bekrefter tildelingen. Søknadsfristen kunngjøres før hver sesong.
              </p>
            </div>
          </div>
        </section>

        {/* Saler og kart */}
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Aktivitetssalene</h2>
          <p className="text-sm text-gray-600 mb-5 leading-relaxed">
            Salene som inngår i fordelingen er kommunale aktivitetssaler spredt rundt i Oslo.
            Merk at salene deles med skoler og andre aktivitetstilbud — klubbene har ikke eksklusiv tilgang.
            I oversikten kan du klikke på en sal og se hvem som bruker den og hvilke tider som er ledige.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/oversikt" className="btn-primary text-sm">
              Se fordeling og ledige tider
            </Link>
          </div>
        </section>

        {/* For klubber */}
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">For klubber</h2>
          <p className="text-sm text-gray-600 mb-5 leading-relaxed">
            Etablerte klubber logger inn via lenken de har mottatt på e-post og søker om tid i den aktive søknadsrunden.
            Du kan se hvilke tider som er ledige i oversikten, og søke om de tidene som passer for din klubb.
          </p>

          <div className="grid sm:grid-cols-2 gap-4 mb-5">
            <div className="rounded-xl bg-blue-50 ring-1 ring-blue-200 p-5">
              <h3 className="font-semibold text-blue-900 mb-1">Eksisterende klubb</h3>
              <p className="text-sm text-blue-800 leading-relaxed">
                Logg inn via lenken du mottok på e-post. Har du ikke fått lenke, ta kontakt med ditt forbund.
              </p>
            </div>
            <div className="rounded-xl bg-green-50 ring-1 ring-green-200 p-5">
              <h3 className="font-semibold text-green-900 mb-1">Ny klubb</h3>
              <p className="text-sm text-green-800 leading-relaxed mb-3">
                Nye klubber kan søke om tilgang. Du vil enten få tildelt ledig tid eller bli satt på venteliste og kontaktet når tid blir tilgjengelig.
              </p>
              <Link href="/registrer" className="text-xs text-green-700 underline">
                Søk om tilgang →
              </Link>
            </div>
          </div>
        </section>

        {/* Ledig tid */}
        <section className="rounded-xl bg-gray-50 ring-1 ring-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-1">Se ledig tid</h2>
          <p className="text-sm text-gray-600 mb-4">
            I den offentlige oversikten kan du se hvilke tider som er ledige i hver sal.
          </p>
          <Link href="/oversikt" className="btn text-sm">
            Åpne oversikten
          </Link>
        </section>

        {/* Footer-lenker */}
        <div className="border-t border-gray-100 pt-6 flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-400">
          <Link href="/oversikt" className="hover:text-gray-700">Offentlig oversikt</Link>
          <Link href="/registrer" className="hover:text-gray-700">Søk om tilgang</Link>
          <a href="/admin" className="hover:text-gray-700">Administrasjon</a>
        </div>

      </div>
    </main>
  )
}
