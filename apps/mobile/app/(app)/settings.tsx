import { useEffect, useState } from 'react'
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { accentPresets, useAccent } from '../../src/accent'
import { api, type AppPassword } from '../../src/api'
import { useAuth } from '../../src/auth'
import { font, theme } from '../../src/theme'
import { Button, Field, Notice, Panel } from '../../src/ui'

export default function Settings() {
  const { session } = useAuth()
  const { accent, setAccent } = useAccent()
  const [draft, setDraft] = useState(accent)
  const [colorError, setColorError] = useState('')

  useEffect(() => setDraft(accent), [accent])
  const [passwords, setPasswords] = useState<AppPassword[]>([])
  const [label, setLabel] = useState('iPhone')
  const [created, setCreated] = useState('')
  const [error, setError] = useState('')
  const [backup, setBackup] = useState('')
  const [backupError, setBackupError] = useState('')

  function load() {
    api<AppPassword[]>('/api/app-passwords').then(setPasswords).catch((caught: Error) => setError(caught.message))
  }

  useEffect(load, [])

  async function create() {
    setError('')
    try {
      const result = await api<AppPassword & { password: string }>('/api/app-passwords', {
        method: 'POST',
        body: JSON.stringify({ label }),
      })
      setCreated(result.password)
      load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not create a password')
    }
  }

  async function revoke(id: string) {
    await api(`/api/app-passwords/${id}`, { method: 'DELETE' })
    load()
  }

  async function runBackup() {
    setBackup('')
    setBackupError('')
    try {
      const result = await api<{ path: string }>('/api/backups', { method: 'POST' })
      setBackup(`Backup written to ${result.path}`)
    } catch (caught) {
      setBackupError(caught instanceof Error ? caught.message : 'Backup failed')
    }
  }

  return (
    <View style={styles.page}>
      <Text style={styles.title}>Settings</Text>
      <Panel>
        <Text style={styles.name}>Accent color</Text>
        <Text style={styles.meta}>Buttons use this color. It is saved for this account in this browser.</Text>
        <View style={styles.swatches}>
          {accentPresets.map((preset) => (
            <Pressable
              key={preset.value}
              accessibilityLabel={preset.name}
              onPress={() => {
                setAccent(preset.value)
                setDraft(preset.value)
                setColorError('')
              }}
              style={[styles.swatch, { backgroundColor: preset.value }, accent === preset.value && styles.swatchOn]}
            />
          ))}
        </View>
        <Field label="Custom hex" autoCapitalize="none" value={draft} onChangeText={setDraft} placeholder="#1d4ed8" />
        <Button
          label="Use this color"
          onPress={() => {
            const next = draft.startsWith('#') ? draft : `#${draft}`
            if (!/^#[0-9a-fA-F]{6}$/.test(next)) {
              setColorError('Use a color like #1d4ed8')
              return
            }
            setColorError('')
            setAccent(next)
          }}
        />
        {colorError ? <Notice text={colorError} /> : null}
      </Panel>
      <Panel>
        <Text style={styles.name}>CardDAV</Text>
        <Text style={styles.meta}>Server</Text>
        <Text style={styles.value}>{session?.carddavUrl}</Text>
        <Text style={styles.meta}>Username</Text>
        <Text style={styles.value}>{session?.email}</Text>
        <Text style={styles.meta}>Use an application password in iPhone Contacts. The account password is not accepted by CardDAV.</Text>
        {Platform.OS === 'web' ? (
          <Button
            label="Copy server URL"
            tone="ghost"
            onPress={() => {
              if (session) void navigator.clipboard.writeText(session.carddavUrl)
            }}
          />
        ) : null}
      </Panel>
      <Panel>
        <Text style={styles.name}>Application passwords</Text>
        {error ? <Notice text={error} /> : null}
        {created ? <Text style={styles.secret}>Copy this password now. It will not be shown again. {created}</Text> : null}
        {passwords.map((item) => (
          <View key={item.id} style={styles.row}>
            <Text style={styles.value}>{item.label}</Text>
            <Button label="Revoke" tone="danger" onPress={() => void revoke(item.id)} />
          </View>
        ))}
        <Field label="Label" value={label} onChangeText={setLabel} />
        <Button label="Create password" onPress={() => void create()} />
      </Panel>
      <Panel>
        <Text style={styles.name}>Backup</Text>
        <Text style={styles.meta}>Owners can dump the database here when pg_dump is installed. scripts/backup.sh also archives photos.</Text>
        <Button label="Create database backup" tone="ghost" onPress={() => void runBackup()} />
        {backupError ? <Notice text={backupError} /> : null}
        {backup ? <Text style={styles.meta}>{backup}</Text> : null}
      </Panel>
    </View>
  )
}

const styles = StyleSheet.create({
  page: { gap: 14 },
  title: { fontFamily: font, fontSize: 28, fontWeight: '700', color: theme.text },
  name: { fontFamily: font, fontSize: 16, fontWeight: '600', color: theme.text, marginBottom: 8 },
  meta: { fontFamily: font, color: theme.muted, marginBottom: 6 },
  value: { fontFamily: font, color: theme.text, fontSize: 15, marginBottom: 8 },
  secret: { fontFamily: font, color: theme.text, backgroundColor: theme.accentMuted, padding: 10, borderRadius: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  swatch: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: 'transparent' },
  swatchOn: { borderColor: theme.text },
})
