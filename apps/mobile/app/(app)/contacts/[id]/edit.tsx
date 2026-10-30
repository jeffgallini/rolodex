import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { Text } from 'react-native'
import { api, type Contact } from '../../../../src/api'
import { ContactForm } from '../../../../src/ContactForm'
import { useAuth } from '../../../../src/auth'
import { Loader } from '../../../../src/logo'
import { font, theme } from '../../../../src/theme'

export default function EditContact() {
  const { id, workspace: workspaceParam } = useLocalSearchParams<{ id: string; workspace?: string }>()
  const { workspace } = useAuth()
  const router = useRouter()
  const scope = (typeof workspaceParam === 'string' && workspaceParam) || workspace?.id
  const [contact, setContact] = useState<Contact | null>(null)

  useEffect(() => {
    if (!scope || !id) return
    api<Contact>(`/api/workspaces/${scope}/contacts/${id}`).then(setContact).catch(() => setContact(null))
  }, [scope, id])

  if (!contact) return <Loader />
  return (
    <>
      <Text style={{ fontFamily: font, fontSize: 28, fontWeight: '700', color: theme.text }}>Edit {contact.displayName}</Text>
      <ContactForm contact={contact} onSaved={(savedId) => router.replace(`/contacts/${savedId}?workspace=${scope}`)} />
    </>
  )
}
