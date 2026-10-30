import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { api, type Addon } from '../../../src/api'
import { useAuth } from '../../../src/auth'
import { ImmichAdmin } from '../../../src/immich-admin'
import { font, theme } from '../../../src/theme'

export default function ImmichPage() {
  const { workspace } = useAuth()
  const router = useRouter()
  const [enabled, setEnabled] = useState<boolean | null>(null)

  useEffect(() => {
    if (!workspace) return
    api<Addon[]>(`/api/workspaces/${workspace.id}/addons`)
      .then((rows) => setEnabled(rows.some((addon) => addon.id === 'immich' && addon.enabled)))
      .catch(() => setEnabled(false))
  }, [workspace])

  if (!workspace || enabled === null) return null
  if (!enabled) {
    return (
      <View style={styles.card}>
        <Text style={styles.heading}>Immich</Text>
        <Text style={styles.meta}>Immich is an add-on. Enable it before connecting a server.</Text>
        <Pressable onPress={() => router.push('/admin/addons')}>
          <Text style={styles.link}>Open Add-ons</Text>
        </Pressable>
      </View>
    )
  }
  return <ImmichAdmin workspaceId={workspace.id} />
}

const styles = StyleSheet.create({
  card: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 22, padding: 18, gap: 8 },
  heading: { fontFamily: font, fontSize: 22, fontWeight: '700', color: theme.text },
  meta: { fontFamily: font, color: theme.muted },
  link: { fontFamily: font, color: theme.text, textDecorationLine: 'underline', marginTop: 8 },
})
