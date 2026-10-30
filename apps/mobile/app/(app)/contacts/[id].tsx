import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { createElement } from 'react'
import { Linking, Platform, StyleSheet, Text, View } from 'react-native'
import { api, ApiError, type Contact } from '../../../src/api'
import { useAuth } from '../../../src/auth'
import { font, theme } from '../../../src/theme'
import { Button, Panel } from '../../../src/ui'

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000'

export default function ContactProfile() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { workspace } = useAuth()
  const router = useRouter()
  const [contact, setContact] = useState<Contact | null>(null)
  const [photo, setPhoto] = useState<string | null>(null)
  const [error, setError] = useState('')
  const canEdit = workspace?.role === 'owner' || workspace?.role === 'administrator' || workspace?.role === 'editor'

  function load() {
    if (!workspace || !id) return
    api<Contact>(`/api/workspaces/${workspace.id}/contacts/${id}`)
      .then(async (next) => {
        setContact(next)
        if (!next.hasPhoto || Platform.OS !== 'web') {
          setPhoto(null)
          return
        }
        const token = sessionStorage.getItem('rolodex.session')
        const parsed = token ? (JSON.parse(token) as { token: string }) : null
        const response = await fetch(`${API_URL}/api/workspaces/${workspace.id}/contacts/${id}/photo`, {
          headers: parsed ? { Authorization: `Bearer ${parsed.token}` } : undefined,
          credentials: 'include',
        })
        if (response.ok) setPhoto(URL.createObjectURL(await response.blob()))
      })
      .catch((caught: Error) => setError(caught.message))
  }

  useEffect(load, [workspace, id])

  async function upload(file: File) {
    if (!workspace || !id) return
    const body = new FormData()
    body.append('file', file)
    try {
      await api(`/api/workspaces/${workspace.id}/contacts/${id}/photo`, { method: 'POST', body })
      load()
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not upload the photo')
    }
  }

  async function remove() {
    if (!workspace || !id) return
    await api(`/api/workspaces/${workspace.id}/contacts/${id}`, { method: 'DELETE' })
    router.replace('/')
  }

  if (!contact) return <Text style={styles.muted}>{error || 'Loading contact'}</Text>
  return (
    <View style={styles.page}>
      <View style={styles.header}>
        <View style={styles.identity}>
          {photo ? createElement('img', { src: photo, alt: '', style: { width: 72, height: 72, borderRadius: 36, objectFit: 'cover' } }) : <View style={styles.avatar}><Text style={styles.avatarText}>{contact.displayName.slice(0, 1)}</Text></View>}
          <View>
            <Text style={styles.title}>{contact.displayName}</Text>
            <Text style={styles.muted}>{[contact.title, contact.organizationName].filter(Boolean).join(' · ')}</Text>
          </View>
        </View>
        {canEdit ? (
          <View style={styles.actions}>
            {Platform.OS === 'web'
              ? createElement('input', {
                  type: 'file',
                  accept: 'image/*',
                  onChange: (event: { target: { files?: FileList | null } }) => {
                    const file = event.target.files?.[0]
                    if (file) void upload(file)
                  },
                })
              : null}
            <Button label="Edit" tone="ghost" onPress={() => router.push(`/contacts/${contact.id}/edit`)} />
            <Button label="Delete" tone="danger" onPress={() => void remove()} />
          </View>
        ) : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Panel>
        <Text style={styles.section}>Overview</Text>
        {contact.methods.map((method) => (
          <Text
            key={method.id}
            style={styles.link}
            onPress={() => void Linking.openURL(method.kind === 'email' ? `mailto:${method.value}` : `tel:${method.value}`)}
          >
            {method.label}: {method.value}
          </Text>
        ))}
        {contact.addresses.map((address) => (
          <Text key={address.id} style={styles.body}>
            {[address.street, address.city, address.region, address.postalCode, address.country].filter(Boolean).join(', ')}
          </Text>
        ))}
        {contact.website ? <Text style={styles.link} onPress={() => void Linking.openURL(contact.website!)}>{contact.website}</Text> : null}
        {contact.birthday ? <Text style={styles.body}>Birthday {contact.birthday}</Text> : null}
        <Text style={styles.body}>{contact.tags.map((tag) => tag.name).join(' · ')}</Text>
      </Panel>
      <Panel>
        <Text style={styles.section}>Details</Text>
        <Text style={styles.body}>{contact.cardNote || 'No card note.'}</Text>
        {contact.howWeMet ? <Text style={styles.body}>How we met: {contact.howWeMet}</Text> : null}
        {contact.interests ? <Text style={styles.body}>Interests: {contact.interests}</Text> : null}
        <Text style={styles.muted}>Card note is the only note copied to CardDAV. Private notes stay in Rolodex.</Text>
      </Panel>
    </View>
  )
}

const styles = StyleSheet.create({
  page: { gap: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', gap: 16, alignItems: 'center' },
  identity: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  actions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  title: { fontFamily: font, fontSize: 28, fontWeight: '700', color: theme.text },
  section: { fontFamily: font, fontSize: 13, color: theme.muted, marginBottom: 8, letterSpacing: 0.4 },
  body: { fontFamily: font, color: theme.text, fontSize: 15, marginBottom: 6 },
  link: { fontFamily: font, color: theme.accent, fontSize: 15, marginBottom: 6 },
  muted: { fontFamily: font, color: theme.muted },
  error: { color: theme.danger, fontFamily: font },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: theme.accentMuted, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: font, fontSize: 28, color: theme.accent, fontWeight: '700' },
})
