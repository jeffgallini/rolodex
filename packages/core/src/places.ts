import { AppError } from './errors'

export type PlaceSuggestion = {
  id: string
  label: string
  street: string
  city: string
  region: string
  postalCode: string
  country: string
  provider: 'osm' | 'google'
}

export function placeProviders() {
  return { osm: true, google: Boolean(process.env.GOOGLE_MAPS_API_KEY) }
}

export async function searchPlaces(query: string, provider: 'osm' | 'google' = 'osm') {
  const q = query.trim()
  if (q.length < 3) return []
  if (provider === 'google') return googleSuggestions(q)
  return osmSuggestions(q)
}

export async function placeDetails(provider: 'google', id: string) {
  const key = googleKey()
  const response = await fetch(
    `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(id)}&fields=address_component,formatted_address&key=${encodeURIComponent(key)}`,
  )
  if (!response.ok) throw new AppError(502, 'Google could not look up that address')
  const body = (await response.json()) as {
    status?: string
    result?: { formatted_address?: string; address_components?: GoogleComponent[] }
  }
  if (body.status !== 'OK' || !body.result) throw new AppError(404, 'Address was not found')
  return fromGoogle(id, body.result.formatted_address ?? '', body.result.address_components ?? [])
}

async function osmSuggestions(query: string): Promise<PlaceSuggestion[]> {
  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=5&q=${encodeURIComponent(query)}`,
    { headers: { 'User-Agent': 'Rolodex/0.1 (self-hosted address book)', Accept: 'application/json' } },
  )
  if (!response.ok) throw new AppError(502, 'OpenStreetMap could not search addresses')
  const rows = (await response.json()) as OsmPlace[]
  return rows.map((row) => ({
    id: String(row.place_id),
    label: row.display_name,
    street: [row.address?.house_number, row.address?.road].filter(Boolean).join(' '),
    city: row.address?.city || row.address?.town || row.address?.village || row.address?.hamlet || '',
    region: row.address?.state || '',
    postalCode: row.address?.postcode || '',
    country: row.address?.country || '',
    provider: 'osm' as const,
  }))
}

async function googleSuggestions(query: string): Promise<PlaceSuggestion[]> {
  const key = googleKey()
  const response = await fetch(
    `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&types=address&key=${encodeURIComponent(key)}`,
  )
  if (!response.ok) throw new AppError(502, 'Google could not search addresses')
  const body = (await response.json()) as { status?: string; predictions?: { description: string; place_id: string }[]; error_message?: string }
  if (body.status === 'REQUEST_DENIED') throw new AppError(502, body.error_message || 'Google rejected the address search')
  return (body.predictions ?? []).slice(0, 5).map((row) => ({
    id: row.place_id,
    label: row.description,
    street: '',
    city: '',
    region: '',
    postalCode: '',
    country: '',
    provider: 'google' as const,
  }))
}

function googleKey() {
  const key = process.env.GOOGLE_MAPS_API_KEY
  if (!key) throw new AppError(400, 'Add GOOGLE_MAPS_API_KEY to search with Google')
  return key
}

function fromGoogle(id: string, label: string, components: GoogleComponent[]): PlaceSuggestion {
  const part = (type: string) => components.find((component) => component.types.includes(type))?.long_name ?? ''
  return {
    id,
    label,
    street: [part('street_number'), part('route')].filter(Boolean).join(' '),
    city: part('locality') || part('postal_town') || part('sublocality'),
    region: part('administrative_area_level_1'),
    postalCode: part('postal_code'),
    country: part('country'),
    provider: 'google',
  }
}

type OsmPlace = {
  place_id: number
  display_name: string
  address?: {
    house_number?: string
    road?: string
    city?: string
    town?: string
    village?: string
    hamlet?: string
    state?: string
    postcode?: string
    country?: string
  }
}

type GoogleComponent = { long_name: string; types: string[] }
