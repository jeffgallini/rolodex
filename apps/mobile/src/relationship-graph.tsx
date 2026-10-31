import { createElement, useEffect, useState } from 'react'
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { api, type Relationship } from './api'
import { font, theme } from './theme'
import { Panel } from './ui'

const palette = ['#2563eb', '#b45309', '#047857', '#7c3aed', '#be123c', '#0f766e', '#c2410c', '#4338ca']

export function RelationshipGraph({ workspaceId, contactId, name }: { workspaceId: string; contactId: string; name: string }) {
  const router = useRouter()
  const [links, setLinks] = useState<Relationship[]>([])

  useEffect(() => {
    api<Relationship[]>(`/api/workspaces/${workspaceId}/contacts/${contactId}/relationships`).then(setLinks).catch(() => setLinks([]))
  }, [workspaceId, contactId])

  const types = [...new Set(links.map((link) => link.type))]
  const colorFor = (type: string) => palette[Math.abs(hash(type)) % palette.length] ?? palette[0]

  return (
    <Panel>
      <Text style={styles.section}>Relationships</Text>
      {!links.length ? <Text style={styles.meta}>No relationships yet.</Text> : null}
      {links.length && Platform.OS === 'web' ? <Graph name={name} links={links} colorFor={colorFor} onOpen={(id) => router.push(`/contacts/${id}`)} /> : null}
      {links.length && Platform.OS !== 'web'
        ? links.map((link) => (
          <Pressable key={link.id} onPress={() => router.push(`/contacts/${link.contactId}`)}>
            <Text style={styles.link}><Text style={{ color: colorFor(link.type) }}>● </Text>{link.type} · {link.displayName}</Text>
          </Pressable>
        ))
        : null}
      {types.length ? (
        <View style={styles.legend}>
          {types.map((type) => (
            <View key={type} style={styles.legendItem}>
              <View style={[styles.swatch, { backgroundColor: colorFor(type) }]} />
              <Text style={styles.meta}>{type}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </Panel>
  )
}

function Graph({ name, links, colorFor, onOpen }: { name: string; links: Relationship[]; colorFor: (type: string) => string; onOpen: (id: string) => void }) {
  const width = 560
  const height = 280
  const cx = width / 2
  const cy = height / 2
  const radius = 96
  return (
    <View style={styles.graph}>
      {createElement(
        'svg',
        { width: '100%', height, viewBox: `0 0 ${width} ${height}` },
        links.map((link, index) => {
          const angle = -Math.PI / 2 + (index * 2 * Math.PI) / links.length
          const x = cx + Math.cos(angle) * radius
          const y = cy + Math.sin(angle) * radius
          return createElement('line', { key: link.id, x1: cx, y1: cy, x2: x, y2: y, stroke: colorFor(link.type), strokeWidth: 2 })
        }),
      )}
      <View style={[styles.node, styles.center]}>
        <Text style={styles.nodeText} numberOfLines={2}>{name}</Text>
      </View>
      {links.map((link, index) => {
        const angle = -Math.PI / 2 + (index * 2 * Math.PI) / links.length
        const left = `${((cx + Math.cos(angle) * radius) / width) * 100}%`
        const top = `${((cy + Math.sin(angle) * radius) / height) * 100}%`
        return (
          <Pressable key={link.id} onPress={() => onOpen(link.contactId)} style={[styles.node, { left, top, borderColor: colorFor(link.type) }]}>
            <Text style={styles.nodeText} numberOfLines={2}>{link.displayName}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

function hash(value: string) {
  return [...value].reduce((sum, char) => sum + char.charCodeAt(0), 0)
}

const styles = StyleSheet.create({
  section: { fontFamily: font, fontSize: 13, color: theme.muted, marginBottom: 8, letterSpacing: 0.4 },
  meta: { fontFamily: font, color: theme.muted, fontSize: 13 },
  link: { fontFamily: font, color: theme.text, fontSize: 15, marginBottom: 6 },
  graph: { height: 280, position: 'relative' },
  node: { position: 'absolute', width: 92, marginLeft: -46, marginTop: -22, paddingVertical: 8, paddingHorizontal: 8, borderRadius: 12, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface, alignItems: 'center' },
  center: { left: '50%', top: '50%', borderColor: theme.text },
  nodeText: { fontFamily: font, color: theme.text, fontSize: 12, fontWeight: '700', textAlign: 'center' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 8, height: 8, borderRadius: 4 },
})
