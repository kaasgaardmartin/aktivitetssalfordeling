'use client'

import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const defaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})
L.Marker.prototype.options.icon = defaultIcon

interface HallMini {
  id: string
  navn: string
  adresse: string | null
  postnummer: string | null
  poststed: string | null
  lat: number | null
  lng: number | null
  kilde_url: string | null
}

function FitBounds({ haller }: { haller: HallMini[] }) {
  const map = useMap()
  useEffect(() => {
    const pts = haller
      .filter(h => h.lat != null && h.lng != null)
      .map(h => [h.lat as number, h.lng as number] as [number, number])
    if (pts.length > 0) map.fitBounds(pts, { padding: [40, 40] })
  }, [haller, map])
  return null
}

export default function OversiktKart({ haller, onSelectHal }: { haller: HallMini[]; onSelectHal: (id: string) => void }) {
  const medKoord = haller.filter(h => h.lat != null && h.lng != null)

  return (
    <div className="card overflow-hidden">
      <div style={{ height: '480px', width: '100%' }}>
        <MapContainer
          center={[59.92, 10.78]}
          zoom={12}
          scrollWheelZoom={true}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.kartverket.no/">Kartverket</a>'
            url="https://cache.kartverket.no/v1/wmts/1.0.0/topo/default/webmercator/{z}/{y}/{x}.png"
            maxZoom={19}
          />
          <FitBounds haller={medKoord} />
          {medKoord.map(h => (
            <Marker key={h.id} position={[h.lat as number, h.lng as number]}>
              <Popup>
                <div className="space-y-1.5 text-xs min-w-[160px]">
                  <p className="font-semibold text-gray-900">{h.navn}</p>
                  {h.adresse && (
                    <p className="text-gray-600">{h.adresse}{h.postnummer ? `, ${h.postnummer} ${h.poststed ?? ''}` : ''}</p>
                  )}
                  <button
                    onClick={() => onSelectHal(h.id)}
                    className="mt-1 w-full rounded bg-gray-900 px-2 py-1 text-[11px] font-medium text-white hover:bg-gray-700"
                  >
                    Se fordeling →
                  </button>
                  {h.kilde_url && (
                    <a href={h.kilde_url} target="_blank" rel="noopener noreferrer" className="block text-[10px] text-blue-700 underline">
                      Mer info ↗
                    </a>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  )
}
