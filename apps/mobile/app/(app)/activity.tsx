import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { api, send, type Activity } from '../../src/api'
import { useAuth } from '../../src/auth'
import { Choice, PersonPicker } from '../../src/people'
import { font, theme } from '../../src/theme'
import { Button, Field, Notice, Panel } from '../../src/ui'

const kinds = ['call', 'meeting', 'meal', 'note']

export default function ActivityPage() {
  const { workspace } = useAuth()
  const router = useRouter()
  const canWrite = workspace?.role === 'owner' || workspace?.role === 'administrator' || workspace?.role === 'editor'
  const [rows, setRows] = useState<Activity[]>([])
  const [kind, setKind] = useState('meeting')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [text, setText] = useState('')
  const [people, setPeople] = useState<string[]>([])
  const [error, setError] = useState('')

  function load() {
    if (!workspace) return
    api<Activity[]>(`/api/workspaces/${workspace.id}/activities`).then(setRows).catch((caught: Error) => setError(caught.message))
  }

  useEffect(load, [workspace?.id])

  return (
    <View style={styles.page}>
      <Text style={styles.title}>Activity</Text>
      <Text style={styles.meta}>Calls, meetings, and meals stay in Rolodex. They do not sync to CardDAV.</Text>
      {error ? <Notice text={error} /> : null}
      {rows.map((row) => (
        <Panel key={row.id}>
          <Text style={styles.name}>{row.type} · {row.occurredAt.slice(0, 10)}</Text>
          {row.description ? <Text style={styles.meta}>{row.description}</Text> : null}
          <View style={styles.chips}>
            {row.people.map((person) => (
              <Pressable key={person.contactId} onPress={() => router.push(`/contacts/${person.contactId}`)}>
                <Text style={styles.link}>{person.displayName}</Text>
              </Pressable>
            ))}
          </View>
        </Panel>
      ))}
      {canWrite && workspace ? (
        <Panel>
          <View style={styles.chips}>
            {kinds.map((item) => (
              <Choice key={item} label={item} on={kind === item} onPress={() => setKind(item)} />
            ))}
          </View>
          <Field label="Date" value={date} onChangeText={setDate} />
          <Field label="Description" value={text} onChangeText={setText} />
          <PersonPicker workspaceId={workspace.id} selected={people} onToggle={(id) => setPeople((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])} />
          <Button
            label="Add activity"
            disabled={people.length < 1}
            onPress={() => void send(`/api/workspaces/${workspace.id}/activities`, 'POST', { type: kind, occurredAt: date, description: text || null, contactIds: people }).then(() => { setText(''); setPeople([]); load() }).catch((caught: Error) => setError(caught.message))}
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
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
})
