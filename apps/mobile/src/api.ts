const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000'

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

let token: string | null = null
let onUnauthorized = () => {}

export function setToken(value: string | null) {
  token = value
}

export function setUnauthorized(handler: () => void) {
  onUnauthorized = handler
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const isForm = typeof FormData !== 'undefined' && options.body instanceof FormData
  if (options.body && !isForm && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  const response = await fetch(`${API_URL}${path}`, { ...options, headers, credentials: 'include' })
  if (response.status === 401 && !path.startsWith('/api/auth/login') && !path.startsWith('/api/auth/register')) {
    onUnauthorized()
    throw new ApiError('Sign in required', 401)
  }
  if (response.status === 204) return undefined as T
  const type = response.headers.get('content-type') || ''
  if (!response.ok) {
    let message = response.statusText
    if (type.includes('json')) {
      const body = (await response.json()) as { error?: string }
      message = body.error || message
    }
    throw new ApiError(message, response.status)
  }
  if (type.includes('json')) return (await response.json()) as T
  return (await response.text()) as T
}

export type Workspace = { id: string; name: string; role: string }
export type ContactSummary = {
  id: string
  workspaceId: string
  displayName: string
  organizationName: string | null
  title: string | null
  primaryEmail: string | null
  primaryPhone: string | null
  updatedAt: string
  hasPhoto: boolean
  tags: { id: string; name: string }[]
  addressBooks: { id: string; name: string }[]
}
export type Contact = ContactSummary & {
  type: string
  prefix: string | null
  firstName: string | null
  middleName: string | null
  lastName: string | null
  suffix: string | null
  preferredName: string | null
  nickname: string | null
  department: string | null
  position: string | null
  birthday: string | null
  anniversary: string | null
  website: string | null
  cardNote: string | null
  howWeMet: string | null
  preferredCommunication: string | null
  interests: string | null
  personalDetails: string | null
  professionalBackground: string | null
  followUpFrequency: string | null
  addressBookId: string | null
  addressBookName: string | null
  addressBooks: { id: string; name: string }[]
  uid: string | null
  methods: { id: string; kind: string; label: string; value: string; isPrimary: boolean }[]
  addresses: { id: string; label: string; street: string; street2: string; city: string; region: string; postalCode: string; country: string }[]
  tags: { id: string; name: string; color?: string | null }[]
}
export type AddressBook = { id: string; workspaceId: string; name: string; description: string | null; role: string; syncToken: number; shared: boolean }
export type Place = {
  id: string
  label: string
  street: string
  city: string
  region: string
  postalCode: string
  country: string
  lat: number | null
  lon: number | null
  provider: 'osm' | 'google' | 'mapbox'
}

export type MapSettings = {
  engine: 'leaflet' | 'mapbox' | 'maplibre'
  templateId: string
  tileUrl: string
  cartoKey: string
  mapboxToken: string
  googleKey: string
}
export type Member = { userId: string; email: string; displayName: string; role: string }
export type AppPassword = { id: string; label: string; createdAt: string; lastUsedAt: string | null }
export type Relationship = { id: string; category: string; type: string; description: string | null; contactId: string; displayName: string }
export type Household = {
  id: string
  name: string
  street: string | null
  city: string | null
  region: string | null
  postalCode: string | null
  country: string | null
  members: { contactId: string; displayName: string; role: string | null }[]
}
export type Organization = { id: string; name: string; industry: string | null; website: string | null; email: string | null; phone: string | null; city: string | null; logoUrl: string | null }
export type OrgMembership = { id: string; name: string; title: string | null; department: string | null; website: string | null; logoUrl: string | null }
export type OrgMember = { contactId: string; displayName: string; title: string | null; department: string | null }
export type Note = { id: string; body: string; visibility: string; authorId: string | null; createdAt: string }
export type Activity = {
  id: string
  type: string
  occurredAt: string
  description: string | null
  location: string | null
  visibility: string
  people: { contactId: string; displayName: string }[]
}
export type Task = { id: string; title: string; dueAt: string | null; completedAt: string | null; contactId: string | null }
export type CustomField = { id: string; label: string; fieldType: string; value: string | number | boolean | null }
export type Agenda = {
  dates: { contactId: string; displayName: string; kind: string; date: string; days: number }[]
  tasks: Task[]
  reminders: { id: string; type: string; remindAt: string; contactId: string | null }[]
}

export function send<T>(path: string, method: string, body?: unknown) {
  return api<T>(path, { method, body: body === undefined ? undefined : JSON.stringify(body) })
}
