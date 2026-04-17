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

const multiIcon = L.divIcon({
  className: '',
  html: `<div style="
    background:#1f2937;color:white;border-radius:50%;
    width:32px;height:32px;display:flex;align-items:center;
    justify-content:center;font-size:13px;font-weight:700;
    box-shadow:0 2px 6px rgba(0,0,0,0.4);border:2px solid white">
    ★</div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -34],
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

interface Lokasjon {
  lat: number
  lng: number
  haller: HallMini[]
}

function FitBounds({ lokasjoner }: { lokasjoner: Lokasjon[] }) {
  const map = useMap()
  useEffect(() => {
    const pts = lokasjoner.map(l => [l.lat, l.lng] as [number, number])
    if (pts.length > 0) map.fitBounds(pts, { padding: [40, 40] })
  }, [lokasjoner, map])
  return null
}

export default function OversiktKart({ haller, onSelectHal }: { haller: HallMini[]; onSelectHal: (id: string) => void }) {
  // Grupper haller per koordinat
  const lokasjoner: Lokasjon[] = []
  for (const h of haller) {
    if (h.lat == null || h.lng == null) continue
    const key = `${h.lat.toFixed(5)},${h.lng.toFixed(5)}`
    const existing = lokasjoner.find(l => `${l.lat.toFixed(5)},${l.lng.toFixed(5)}` === key)
    if (existing) {
      existing.haller.push(h)
    } else {
      lokasjoner.push({ lat: h.lat, lng: h.lng, haller: [h] })
    }
  }

  return (
    <div className="card overflow-hidden">
      <div style={{ height: '360px', width: '100%' }}>
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
          <FitBounds lokasjoner={lokasjoner} />
          {lokasjoner.map(lok => {
            const flere = lok.haller.length > 1
            const h0 = lok.haller[0]
            return (
              <Marker
                key={`${lok.lat},${lok.lng}`}
                position={[lok.lat, lok.lng]}
                icon={flere ? multiIcon : defaultIcon}
              >
                <Popup minWidth={180}>
                  <div className="space-y-2 text-xs">
                    {/* Adresse øverst */}
                    {h0.adresse && (
                      <p className="text-gray-500 text-[10px]">
                        {h0.adresse}{h0.postnummer ? `, ${h0.postnummer} ${h0.poststed ?? ''}` : ''}
                      </p>
                    )}
                    {/* Liste over saler */}
                    <div className="space-y-1.5">
                      {lok.haller.map(h => (
                        <div key={h.id} className="flex items-center justify-between gap-3">
                          <span className="font-medium text-gray-900 leading-tight">{h.navn}</span>
                          <button
                            onClick={() => onSelectHal(h.id)}
                            className="shrink-0 rounded bg-gray-900 px-2 py-0.5 text-[10px] font-medium text-white hover:bg-gray-700"
                          >
                            Se fordeling
                          </button>
                        </div>
                      ))}
                    </div>
                    {h0.kilde_url && lok.haller.length === 1 && (
                      <a href={h0.kilde_url} target="_blank" rel="noopener noreferrer" className="block text-[10px] text-blue-700 underline">
                        Mer info ↗
                      </a>
                    )}
                  </div>
                </Popup>
              </Marker>
            )
          })}
        </MapContainer>
      </div>
    </div>
  )
}
