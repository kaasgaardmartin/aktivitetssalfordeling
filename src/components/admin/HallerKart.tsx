'use client'

import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Hall } from './types'

// Fix default marker icons (Leaflet relies on relative asset paths that break with bundlers)
// We point to the CDN so we don't have to copy assets.
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

interface Props {
  haller: Hall[]
}

function FitBounds({ haller }: { haller: Hall[] }) {
  const map = useMap()
  useEffect(() => {
    const pts = haller
      .filter(h => h.lat != null && h.lng != null)
      .map(h => [h.lat as number, h.lng as number] as [number, number])
    if (pts.length > 0) {
      map.fitBounds(pts, { padding: [40, 40] })
    }
  }, [haller, map])
  return null
}

export default function HallerKart({ haller }: Props) {
  const medKoord = haller.filter(h => h.lat != null && h.lng != null)
  const utenKoord = haller.filter(h => h.lat == null || h.lng == null)

  return (
    <div className="mx-auto max-w-5xl px-4 py-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900">Kart — treningslokaler</h2>
        <span className="text-[10px] text-gray-600">
          {medKoord.length} med koordinater{utenKoord.length > 0 && ` · ${utenKoord.length} uten`}
        </span>
      </div>
      <div className="card overflow-hidden">
        <div style={{ height: '600px', width: '100%' }}>
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
                  <div className="space-y-1 text-xs">
                    <p className="font-semibold text-gray-900">{h.navn}</p>
                    {h.adresse && (
                      <p className="text-gray-700">
                        {h.adresse}
                        {h.postnummer && <>, {h.postnummer} {h.poststed ?? ''}</>}
                      </p>
                    )}
                    {h.underlag && <p className="text-gray-600">Underlag: {h.underlag}</p>}
                    {h.kilde_url && (
                      <p>
                        <a href={h.kilde_url} target="_blank" rel="noopener noreferrer" className="text-blue-700 underline">
                          Kilde ↗
                        </a>
                      </p>
                    )}
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      </div>
      {utenKoord.length > 0 && (
        <div className="rounded-lg bg-amber-50 ring-1 ring-inset ring-amber-200 px-3 py-2 text-xs text-amber-900">
          <p className="font-semibold mb-1">Haller uten koordinater:</p>
          <ul className="list-disc ml-5">
            {utenKoord.map(h => <li key={h.id}>{h.navn}</li>)}
          </ul>
        </div>
      )}
    </div>
  )
}
