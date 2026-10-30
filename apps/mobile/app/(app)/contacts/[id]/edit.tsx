import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { Text } from 'react-native'
import { api, type Contact } from '../../../../src/api'
import { ContactForm } from '../../../../src/ContactForm'
import { useAuth } from '../../../../src/auth'
import { font, theme } from '../../../../src/theme'

export default function EditContact() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { workspace } = useAuth()
  const router = useRouter()
  const [contact, setContact] = useState<Contact | null>(null)

  useEffect(() => {
    if (!workspace || !id) return
    api<Contact>(`/api/workspaces/${workspace.id}/contacts/${id}`).then(setContact).catch(() => setContact(null))
  }, [workspace, id])

  if (!contact) return <Text style={{ fontFamily: font, color: theme.muted }}>Loading contact</Text>
  return (
    <>
      <Text style={{ fontFamily: font, fontSize: 28, fontWeight: '700', color: theme.text }}>Edit {contact.displayName}</Text>
      <ContactForm contact={contact} onSaved={(savedId) => router.replace(`/contacts/${savedId}`)} />
    </>
  )
}
