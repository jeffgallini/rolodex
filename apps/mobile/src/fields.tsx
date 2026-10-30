import { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { api, type Place } from './api'
import { font, theme } from './theme'

export function TagField({
  tags,
  suggestions,
  onChange,
}: {
  tags: string[]
  suggestions: string[]
  onChange: (tags: string[]) => void
}) {
  const [draft, setDraft] = useState('')
  const query = draft.trim().toLowerCase()
  const matches = query
    ? suggestions.filter((name) => name.toLowerCase().includes(query) && !tags.some((tag) => tag.toLowerCase() === name.toLowerCase())).slice(0, 6)
    : []

  function add(name: string) {
    const next = name.trim()
    if (!next || tags.some((tag) => tag.toLowerCase() === next.toLowerCase())) {
      setDraft('')
      return
    }
    onChange([...tags, next])
    setDraft('')
  }

  return (
    <View style={styles.block}>
      <Text style={styles.label}>Tags</Text>
      <View style={styles.chips}>
        {tags.map((tag) => (
          <Pressable key={tag} onPress={() => onChange(tags.filter((item) => item !== tag))} style={styles.chip}>
            <Text style={styles.chipText}>{tag}  ×</Text>
          </Pressable>
        ))}
        <TextInput
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={() => add(draft)}
          placeholder={tags.length ? 'Add another tag' : 'Add a tag'}
          placeholderTextColor={theme.muted}
          style={styles.input}
        />
      </View>
      {matches.length ? (
        <View style={styles.menu}>
          {matches.map((name) => (
            <Pressable key={name} onPress={() => add(name)} style={styles.option}>
              <Text style={styles.optionText}>{name}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  )
}

export function AddressSearch({
  onPick,
}: {
  onPick: (place: Place) => void
}) {
  const [query, setQuery] = useState('')
  const [provider, setProvider] = useState<'osm' | 'google'>('osm')
  const [google, setGoogle] = useState(false)
  const [results, setResults] = useState<Place[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    api<{ google: boolean }>('/api/places/providers').then((result) => setGoogle(result.google)).catch(() => setGoogle(false))
  }, [])

  useEffect(() => {
    if (query.trim().length < 3) {
      setResults([])
      return
    }
    const handle = setTimeout(() => {
      api<Place[]>(`/api/places?q=${encodeURIComponent(query.trim())}&provider=${provider}`)
        .then((rows) => {
          setResults(rows)
          setError('')
        })
        .catch((caught: Error) => {
          setResults([])
          setError(caught.message)
        })
    }, 400)
    return () => clearTimeout(handle)
  }, [query, provider])

  async function choose(place: Place) {
    setQuery('')
    setResults([])
    if (place.provider === 'google' && !place.street) {
      const detail = await api<Place>(`/api/places/google/${encodeURIComponent(place.id)}`)
      onPick(detail)
      return
    }
    onPick(place)
  }

  return (
    <View style={styles.block}>
      <Text style={styles.label}>Address</Text>
      <View style={styles.providers}>
        <Pressable onPress={() => setProvider('osm')} style={[styles.provider, provider === 'osm' && styles.providerActive]}>
          <Text style={[styles.providerText, provider === 'osm' && styles.providerTextActive]}>OpenStreetMap</Text>
        </Pressable>
        <Pressable onPress={() => setProvider('google')} style={[styles.provider, provider === 'google' && styles.providerActive]}>
          <Text style={[styles.providerText, provider === 'google' && styles.providerTextActive]}>Google</Text>
        </Pressable>
      </View>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder={provider === 'google' && !google ? 'Add GOOGLE_MAPS_API_KEY to use Google' : 'Search for an address'}
        placeholderTextColor={theme.muted}
        style={styles.search}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {results.length ? (
        <View style={styles.menu}>
          {results.map((place) => (
            <Pressable key={`${place.provider}-${place.id}`} onPress={() => void choose(place)} style={styles.option}>
              <Text style={styles.optionText}>{place.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  block: { gap: 8 },
  label: { color: theme.muted, fontSize: 11, fontFamily: font, letterSpacing: 0.8, textTransform: 'uppercase' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center', backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 16, padding: 8 },
  chip: { backgroundColor: theme.text, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  chipText: { color: '#fff', fontFamily: font, fontSize: 13 },
  input: { minWidth: 140, flexGrow: 1, fontFamily: font, fontSize: 15, color: theme.text, paddingVertical: 6, paddingHorizontal: 6 },
  search: { borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontFamily: font, fontSize: 15, color: theme.text },
  menu: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 16, overflow: 'hidden' },
  option: { paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.border },
  optionText: { fontFamily: font, color: theme.text, fontSize: 14 },
  providers: { flexDirection: 'row', gap: 8 },
  provider: { borderWidth: 1, borderColor: theme.border, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: theme.surface },
  providerActive: { backgroundColor: theme.text, borderColor: theme.text },
  providerText: { fontFamily: font, color: theme.text, fontSize: 13 },
  providerTextActive: { color: '#fff' },
  error: { color: theme.danger, fontFamily: font, fontSize: 13 },
})
