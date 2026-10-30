import { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { api, type ContactSummary } from './api'
import { font, theme } from './theme'

export function Choice({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, on && styles.chipOn]}>
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  )
}

export function PersonPicker({
  workspaceId,
  selected,
  onToggle,
  exclude,
}: {
  workspaceId: string
  selected: string[]
  onToggle: (id: string) => void
  exclude?: string
}) {
  const [q, setQ] = useState('')
  const [people, setPeople] = useState<ContactSummary[]>([])

  useEffect(() => {
    api<{ contacts: ContactSummary[] }>(`/api/workspaces/${workspaceId}/contacts`)
      .then((result) => setPeople(result.contacts))
      .catch(() => setPeople([]))
  }, [workspaceId])

  const shown = people
    .filter((person) => person.id !== exclude && person.displayName.toLowerCase().includes(q.trim().toLowerCase()))
    .slice(0, 8)

  return (
    <View style={styles.wrap}>
      <TextInput value={q} onChangeText={setQ} placeholder="Find a person" placeholderTextColor={theme.muted} style={styles.input} />
      {shown.map((person) => {
        const on = selected.includes(person.id)
        return (
          <Pressable key={person.id} onPress={() => onToggle(person.id)} style={[styles.person, on && styles.personOn]}>
            <Text style={[styles.personText, on && styles.personTextOn]}>{person.displayName}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  input: { borderWidth: 1, borderColor: theme.border, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, fontFamily: font, color: theme.text, backgroundColor: theme.surface },
  chip: { borderWidth: 1, borderColor: theme.border, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: theme.surface },
  chipOn: { backgroundColor: theme.text, borderColor: theme.text },
  chipText: { fontFamily: font, color: theme.text, fontSize: 13 },
  chipTextOn: { color: '#fff' },
  person: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: theme.bg },
  personOn: { backgroundColor: theme.text },
  personText: { fontFamily: font, color: theme.text },
  personTextOn: { color: '#fff' },
})
