import { Link, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { api, type ContactSummary } from '../../src/api'
import { useAuth } from '../../src/auth'
import { font, theme } from '../../src/theme'
import { Button } from '../../src/ui'

export default function Contacts() {
  const { workspace } = useAuth()
  const router = useRouter()
  const [q, setQ] = useState('')
  const [rows, setRows] = useState<ContactSummary[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    if (!workspace) return
    const handle = setTimeout(() => {
      const query = q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''
      api<{ contacts: ContactSummary[] }>(`/api/workspaces/${workspace.id}/contacts${query}`)
        .then((result) => {
          setRows(result.contacts)
          setError('')
        })
        .catch((caught: Error) => setError(caught.message))
    }, 200)
    return () => clearTimeout(handle)
  }, [workspace, q])

  return (
    <View style={styles.page}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Contacts</Text>
          <Text style={styles.meta}>{workspace?.role}</Text>
        </View>
        <Button label="New contact" onPress={() => router.push('/contacts/new')} />
      </View>
      <TextInput
        value={q}
        onChangeText={setQ}
        placeholder="Search name, email, phone, or tag"
        placeholderTextColor={theme.muted}
        style={styles.search}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.list}>
        {rows.map((contact) => (
          <Link key={contact.id} href={`/contacts/${contact.id}`} asChild>
            <Pressable style={styles.row}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{contact.displayName.slice(0, 1).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{contact.displayName}</Text>
                <Text style={styles.detail}>{[contact.title, contact.organizationName].filter(Boolean).join(' · ') || contact.primaryEmail || 'No details yet'}</Text>
              </View>
              <Text style={styles.detail}>{contact.primaryPhone || contact.primaryEmail || ''}</Text>
            </Pressable>
          </Link>
        ))}
        {!rows.length ? <Text style={styles.detail}>No contacts yet.</Text> : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  page: { gap: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontFamily: font, fontSize: 28, fontWeight: '700', color: theme.text },
  meta: { fontFamily: font, color: theme.muted, textTransform: 'capitalize' },
  search: { borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontFamily: font, fontSize: 15, color: theme.text },
  list: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 12, overflow: 'hidden' },
  row: { flexDirection: 'row', gap: 12, alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: theme.border },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: theme.accentMuted, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: theme.accent, fontFamily: font, fontWeight: '700' },
  name: { fontFamily: font, fontSize: 16, color: theme.text, fontWeight: '600' },
  detail: { fontFamily: font, color: theme.muted, fontSize: 13 },
  error: { color: theme.danger, fontFamily: font },
})
