import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { api, send, type Household, type Note } from '../../src/api'
import { useAuth } from '../../src/auth'
import { PersonPicker } from '../../src/people'
import { font, theme } from '../../src/theme'
import { Button, Field, Notice, Panel } from '../../src/ui'

export default function HouseholdsPage() {
  const { workspace } = useAuth()
  const router = useRouter()
  const canWrite = workspace?.role === 'owner' || workspace?.role === 'administrator' || workspace?.role === 'editor'
  const [rows, setRows] = useState<Household[]>([])
  const [notes, setNotes] = useState<Record<string, Note[]>>({})
  const [name, setName] = useState('')
  const [city, setCity] = useState('')
  const [role, setRole] = useState('')
  const [target, setTarget] = useState('')
  const [person, setPerson] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')

  function load() {
    if (!workspace) return
    api<Household[]>(`/api/workspaces/${workspace.id}/households`)
      .then(async (next) => {
        setRows(next)
        const pairs = await Promise.all(next.map(async (row) => [row.id, await api<Note[]>(`/api/workspaces/${workspace.id}/households/${row.id}/notes`)] as const))
        setNotes(Object.fromEntries(pairs))
      })
      .catch((caught: Error) => setError(caught.message))
  }

  useEffect(load, [workspace?.id])

  async function create() {
    if (!workspace) return
    setError('')
    try {
      await send(`/api/workspaces/${workspace.id}/households`, 'POST', { name: name.trim(), city: city || null })
      setName('')
      setCity('')
      load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not create the household')
    }
  }

  return (
    <View style={styles.page}>
      <Text style={styles.title}>Households</Text>
      <Text style={styles.meta}>Households stay in Rolodex. They are not address book cards.</Text>
      {error ? <Notice text={error} /> : null}
      {rows.map((row) => (
        <Panel key={row.id}>
          <Text style={styles.name}>{row.name}</Text>
          <Text style={styles.meta}>{[row.street, row.city, row.region].filter(Boolean).join(', ') || 'No address'}</Text>
          {row.members.map((member) => (
            <View key={member.contactId} style={styles.row}>
              <Pressable onPress={() => router.push(`/contacts/${member.contactId}`)}>
                <Text style={styles.link}>{member.displayName}{member.role ? ` · ${member.role}` : ''}</Text>
              </Pressable>
              {canWrite ? (
                <Button label="Remove" tone="ghost" onPress={() => void send(`/api/workspaces/${workspace?.id}/households/${row.id}/members/${member.contactId}`, 'DELETE').then(load)} />
              ) : null}
            </View>
          ))}
          {(notes[row.id] ?? []).map((item) => (
            <Text key={item.id} style={styles.meta}>{item.visibility === 'private' ? 'Private: ' : ''}{item.body}</Text>
          ))}
          {canWrite ? <Button label="Delete household" tone="danger" onPress={() => void send(`/api/workspaces/${workspace?.id}/households/${row.id}`, 'DELETE').then(load)} /> : null}
        </Panel>
      ))}
      {canWrite && workspace ? (
        <Panel>
          <Field label="Name" value={name} onChangeText={setName} />
          <Field label="City" value={city} onChangeText={setCity} />
          <Button label="Create household" disabled={!name.trim()} onPress={() => void create()} />
          <Text style={styles.name}>Add a member</Text>
          <View style={styles.chips}>
            {rows.map((row) => (
              <Pressable key={row.id} onPress={() => setTarget(row.id)} style={[styles.chip, target === row.id && styles.chipOn]}>
                <Text style={[styles.chipText, target === row.id && styles.chipTextOn]}>{row.name}</Text>
              </Pressable>
            ))}
          </View>
          <Field label="Role" value={role} onChangeText={setRole} />
          <PersonPicker workspaceId={workspace.id} selected={person ? [person] : []} onToggle={(id) => setPerson(id === person ? '' : id)} />
          <Button
            label="Add member"
            disabled={!target || !person}
            onPress={() => void send(`/api/workspaces/${workspace.id}/households/${target}/members`, 'POST', { contactId: person, role: role || null }).then(() => { setPerson(''); load() }).catch((caught: Error) => setError(caught.message))}
          />
          <Field label="Household note" value={note} onChangeText={setNote} />
          <Button
            label="Save private note"
            disabled={!target || !note.trim()}
            onPress={() => void send(`/api/workspaces/${workspace.id}/notes`, 'POST', { body: note.trim(), householdId: target, visibility: 'private' }).then(() => { setNote(''); load() }).catch((caught: Error) => setError(caught.message))}
          />
        </Panel>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  page: { gap: 16 },
  title: { fontFamily: font, fontSize: 32, fontWeight: '700', color: theme.text },
  name: { fontFamily: font, fontSize: 18, fontWeight: '700', color: theme.text },
  meta: { fontFamily: font, color: theme.muted },
  link: { fontFamily: font, color: theme.text, fontSize: 15 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: theme.border, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  chipOn: { backgroundColor: theme.text, borderColor: theme.text },
  chipText: { fontFamily: font, color: theme.text, fontSize: 13 },
  chipTextOn: { color: '#fff' },
})
