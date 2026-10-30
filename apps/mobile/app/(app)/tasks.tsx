import { useEffect, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { api, send, type Task } from '../../src/api'
import { useAuth } from '../../src/auth'
import { font, theme } from '../../src/theme'
import { Button, Field, Notice, Panel } from '../../src/ui'

export default function TasksPage() {
  const { workspace } = useAuth()
  const canWrite = workspace?.role === 'owner' || workspace?.role === 'administrator' || workspace?.role === 'editor'
  const [rows, setRows] = useState<Task[]>([])
  const [title, setTitle] = useState('')
  const [due, setDue] = useState('')
  const [error, setError] = useState('')

  function load() {
    if (!workspace) return
    api<Task[]>(`/api/workspaces/${workspace.id}/tasks`).then(setRows).catch((caught: Error) => setError(caught.message))
  }

  useEffect(load, [workspace?.id])

  const open = rows.filter((row) => !row.completedAt)
  const done = rows.filter((row) => row.completedAt)

  return (
    <View style={styles.page}>
      <Text style={styles.title}>Tasks</Text>
      {error ? <Notice text={error} /> : null}
      {open.map((row) => {
        const overdue = row.dueAt ? new Date(row.dueAt).getTime() < Date.now() : false
        return (
          <Panel key={row.id}>
            <Text style={styles.name}>{row.title}</Text>
            <Text style={styles.meta}>{row.dueAt ? (overdue ? `Overdue · ${row.dueAt.slice(0, 10)}` : `Due ${row.dueAt.slice(0, 10)}`) : 'No due date'}</Text>
            {canWrite ? (
              <Button label="Complete" onPress={() => void send(`/api/workspaces/${workspace?.id}/tasks/${row.id}/complete`, 'POST', { completed: true }).then(load)} />
            ) : null}
          </Panel>
        )
      })}
      {!open.length ? <Text style={styles.meta}>Nothing open.</Text> : null}
      {done.slice(0, 6).map((row) => (
        <Text key={row.id} style={styles.meta}>Done · {row.title}</Text>
      ))}
      {canWrite && workspace ? (
        <Panel>
          <Field label="Title" value={title} onChangeText={setTitle} />
          <Field label="Due date" value={due} onChangeText={setDue} placeholder="YYYY-MM-DD" />
          <Button
            label="Add task"
            disabled={!title.trim()}
            onPress={() => void send(`/api/workspaces/${workspace.id}/tasks`, 'POST', { title: title.trim(), dueAt: due || null }).then(() => { setTitle(''); setDue(''); load() }).catch((caught: Error) => setError(caught.message))}
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
})
