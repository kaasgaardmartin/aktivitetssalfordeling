import type { Metadata } from 'next'
import RegistrerClient from './RegistrerClient'

export const metadata: Metadata = {
  title: 'Søk om tilgang — Aktivitetssaler Oslo',
}

export default function RegistrerPage() {
  return <RegistrerClient />
}
