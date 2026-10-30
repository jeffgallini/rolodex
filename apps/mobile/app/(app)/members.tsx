import { useEffect, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { api, type Member } from '../../src/api'
import { useAuth } from '../../src/auth'
import { font, theme } from '../../src/theme'
import { Button, Field, Notice, Panel } from '../../src/ui'

const roles = ['administrator', 'editor', 'contributor', 'viewer'] as const

export default function Members() {
  const { workspace, refreshWorkspaces } = useAuth()
  const [members, setMembers] = useState<Member[]>([])
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<(typeof roles)[number]>('viewer')
  const [error, setError] = useState('')
  const canManage = workspace?.role === 'owner' || workspace?.role === 'administrator'

  function load() {
    if (!workspace) return
    api<Member[]>(`/api/workspaces/${workspace.id}/members`).then(setMembers).catch((caught: Error) => setError(caught.message))
  }

  useEffect(load, [workspace])

  async function add() {
    if (!workspace) return
    setError('')
    try {
      await api(`/api/workspaces/${workspace.id}/members`, { method: 'POST', body: JSON.stringify({ email, role }) })
      setEmail('')
      load()
      await refreshWorkspaces()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not add the member')
    }
  }

  async function update(member: Member, next: string) {
    if (!workspace) return
    await api(`/api/workspaces/${workspace.id}/members/${member.userId}`, { method: 'PATCH', body: JSON.stringify({ role: next }) })
    load()
  }

  async function remove(member: Member) {
    if (!workspace) return
    await api(`/api/workspaces/${workspace.id}/members/${member.userId}`, { method: 'DELETE' })
    load()
  }

  return (
    <View style={styles.page}>
      <Text style={styles.title}>Members</Text>
      <Text style={styles.meta}>Editors can change contacts. Contributors and viewers can read them.</Text>
      {error ? <Notice text={error} /> : null}
      {members.map((member) => (
        <Panel key={member.userId}>
          <Text style={styles.name}>{member.displayName}</Text>
          <Text style={styles.meta}>{member.email}</Text>
          <Text style={styles.meta}>{member.role}</Text>
          {canManage ? (
            <View style={styles.row}>
              {roles.map((item) => (
                <Button key={item} label={item} tone="ghost" onPress={() => void update(member, item)} />
              ))}
              <Button label="Remove" tone="danger" onPress={() => void remove(member)} />
            </View>
          ) : null}
        </Panel>
      ))}
      {canManage ? (
        <Panel>
          <Field label="Email" autoCapitalize="none" value={email} onChangeText={setEmail} />
          <View style={styles.row}>
            {roles.map((item) => (
              <Button key={item} label={item} tone={item === role ? 'primary' : 'ghost'} onPress={() => setRole(item)} />
            ))}
          </View>
          <Button label="Add member" onPress={() => void add()} />
        </Panel>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  page: { gap: 14 },
  title: { fontFamily: font, fontSize: 28, fontWeight: '700', color: theme.text },
  name: { fontFamily: font, fontSize: 16, fontWeight: '600', color: theme.text },
  meta: { fontFamily: font, color: theme.muted },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
})
