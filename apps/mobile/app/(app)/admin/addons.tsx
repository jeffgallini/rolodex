import { useRouter } from 'expo-router'
import { useContext, useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { AdminNavContext } from '../../../src/admin-nav'
import { api, send, type Addon } from '../../../src/api'
import { useAuth } from '../../../src/auth'
import { font, theme } from '../../../src/theme'
import { Notice } from '../../../src/ui'

export default function AddonsPage() {
  const { workspace } = useAuth()
  const { refresh } = useContext(AdminNavContext)
  const router = useRouter()
  const [rows, setRows] = useState<Addon[]>([])
  const [error, setError] = useState('')

  function load() {
    if (!workspace) return
    api<Addon[]>(`/api/workspaces/${workspace.id}/addons`).then(setRows).catch((caught: Error) => setError(caught.message))
  }

  useEffect(load, [workspace])

  return (
    <View style={styles.card}>
      <Text style={styles.heading}>Add-ons</Text>
      <Text style={styles.meta}>Add-ons stay off until you enable them. Turning one off hides it and leaves any saved connection in place.</Text>
      {error ? <Notice text={error} /> : null}
      {rows.map((addon) => (
        <View key={addon.id} style={styles.row}>
          <View style={styles.copy}>
            <Text style={styles.name}>{addon.name}</Text>
            <Text style={styles.meta}>{addon.description}</Text>
            <Text style={styles.state}>{addon.enabled ? 'On' : 'Off'}</Text>
            {addon.enabled && addon.id === 'immich' ? (
              <Pressable onPress={() => router.push('/admin/immich')}>
                <Text style={styles.link}>Open Immich</Text>
              </Pressable>
            ) : null}
          </View>
          <Pressable
            onPress={() => {
              if (!workspace) return
              setError('')
              void send<Addon>(`/api/workspaces/${workspace.id}/addons/${addon.id}`, 'PUT', { enabled: !addon.enabled })
                .then((next) => {
                  setRows((current) => current.map((item) => (item.id === next.id ? next : item)))
                  refresh()
                })
                .catch((caught: Error) => setError(caught.message))
            }}
            style={[styles.toggle, addon.enabled && styles.toggleOn]}
          >
            <Text style={[styles.toggleText, addon.enabled && styles.toggleTextOn]}>{addon.enabled ? 'Disable' : 'Enable'}</Text>
          </Pressable>
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  card: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 22, padding: 18, gap: 12 },
  heading: { fontFamily: font, fontSize: 22, fontWeight: '700', color: theme.text },
  meta: { fontFamily: font, color: theme.muted, fontSize: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 16, borderWidth: 1, borderColor: theme.border, borderRadius: 16, padding: 14 },
  copy: { flex: 1, gap: 4 },
  name: { fontFamily: font, fontSize: 16, fontWeight: '700', color: theme.text },
  state: { fontFamily: font, fontSize: 13, color: theme.text, fontWeight: '700' },
  link: { fontFamily: font, fontSize: 14, color: theme.text, textDecorationLine: 'underline' },
  toggle: { borderWidth: 1, borderColor: theme.text, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14 },
  toggleOn: { backgroundColor: theme.text },
  toggleText: { fontFamily: font, color: theme.text, fontSize: 14, fontWeight: '700' },
  toggleTextOn: { color: '#fff' },
})
