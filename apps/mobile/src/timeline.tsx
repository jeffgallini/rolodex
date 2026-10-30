import { useRouter } from 'expo-router'
import { useEffect, useState, type ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { api, send, type Activity, type ContactSummary, type ImmichGallery, type Note } from './api'
import { AuthImage } from './immich-photos'
import { Choice, MentionField, mentionParts } from './people'
import { font, theme } from './theme'
import { Button, DateField, Notice } from './ui'

const kinds = ['note', 'call', 'meeting', 'meal'] as const
type Kind = (typeof kinds)[number]
type Filter = 'all' | Kind

type Person = { id: string; name: string }
type Entry = {
  id: string
  source: 'note' | 'activity'
  kind: string
  at: string
  body: string
  visibility: string
  people: Person[]
}

export function Timeline({
  workspaceId,
  contactId,
  canWrite,
  about,
  title,
  attachments,
}: {
  workspaceId: string
  contactId?: string
  canWrite: boolean
  about?: ReactNode
  title?: string
  attachments?: Array<{ activityId: string; assetId: string }>
}) {
  const router = useRouter()
  const [tab, setTab] = useState<'timeline' | 'about'>('timeline')
  const [filter, setFilter] = useState<Filter>('all')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [notes, setNotes] = useState<Note[]>([])
  const [events, setEvents] = useState<Activity[]>([])
  const [people, setPeople] = useState<ContactSummary[]>([])
  const [photos, setPhotos] = useState(attachments ?? [])
  const [text, setText] = useState('')
  const [mentioned, setMentioned] = useState<string[]>([])
  const [kind, setKind] = useState<Kind>('note')
  const [shared, setShared] = useState(true)
  const [remindOn, setRemindOn] = useState(false)
  const [remind, setRemind] = useState('')
  const [closed, setClosed] = useState<Record<string, boolean>>({})
  const [error, setError] = useState('')

  function load() {
    const notesPath = contactId
      ? `/api/workspaces/${workspaceId}/contacts/${contactId}/notes`
      : `/api/workspaces/${workspaceId}/notes`
    const eventsPath = `/api/workspaces/${workspaceId}/activities${contactId ? `?contactId=${contactId}` : ''}`
    Promise.all([
      api<Note[]>(notesPath),
      api<Activity[]>(eventsPath),
      api<{ contacts: ContactSummary[] }>(`/api/workspaces/${workspaceId}/contacts?limit=200`),
    ])
      .then(([nextNotes, nextEvents, directory]) => {
        setNotes(nextNotes)
        setEvents(nextEvents)
        setPeople(directory.contacts)
        setError('')
      })
      .catch((caught: Error) => setError(caught.message))
    if (contactId) {
      api<ImmichGallery>(`/api/workspaces/${workspaceId}/contacts/${contactId}/immich`)
        .then((gallery) => setPhotos(gallery.enabled ? gallery.attachments : []))
        .catch(() => setPhotos([]))
    }
  }

  useEffect(load, [workspaceId, contactId])
  useEffect(() => {
    if (attachments?.length) setPhotos(attachments)
  }, [attachments])

  async function publish() {
    const body = text.trim()
    if (!body) return
    const ids = [...new Set([...(contactId ? [contactId] : []), ...mentioned])]
    if (!ids.length) {
      setError('Mention someone so this has a person to stay with.')
      return
    }
    if (remindOn && remind && !/^\d{4}-\d{2}-\d{2}$/.test(remind)) {
      setError('Use a YYYY-MM-DD date for the reminder.')
      return
    }
    const primary = contactId ?? ids[0]!
    setError('')
    try {
      if (kind === 'note') {
        await send(`/api/workspaces/${workspaceId}/notes`, 'POST', { body, contactId: primary, visibility: shared ? 'workspace' : 'private' })
        const extras = ids.filter((id) => id !== primary)
        if (shared && extras.length) {
          await send(`/api/workspaces/${workspaceId}/activities`, 'POST', {
            type: 'note',
            occurredAt: new Date().toISOString(),
            description: body,
            contactIds: ids,
          })
        }
      } else {
        await send(`/api/workspaces/${workspaceId}/activities`, 'POST', {
          type: kind,
          occurredAt: new Date().toISOString(),
          description: body,
          contactIds: ids,
        })
      }
      if (remindOn && remind) {
        await send(`/api/workspaces/${workspaceId}/reminders`, 'POST', {
          type: 'follow-up',
          remindAt: new Date(`${remind}T09:00:00`).toISOString(),
          contactId: primary,
        })
      }
      setText('')
      setMentioned([])
      setRemind('')
      setRemindOn(false)
      load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save')
    }
  }

  const entries = merge(notes, events).filter((entry) => filter === 'all' || entry.kind === filter)
  const blocks = group(entries)

  return (
    <View style={styles.stack}>
      <View style={styles.bar}>
        {about ? (
          <View style={styles.tabs}>
            <Pressable onPress={() => setTab('timeline')} style={[styles.tab, tab === 'timeline' && styles.tabOn]}>
              <Text style={[styles.tabText, tab === 'timeline' && styles.tabTextOn]}>Timeline</Text>
            </Pressable>
            <Pressable onPress={() => setTab('about')} style={[styles.tab, tab === 'about' && styles.tabOn]}>
              <Text style={[styles.tabText, tab === 'about' && styles.tabTextOn]}>About</Text>
            </Pressable>
          </View>
        ) : (
          <Text style={styles.title}>{title ?? 'Interactions'}</Text>
        )}
        {tab === 'timeline' || !about ? (
          <Pressable onPress={() => setFiltersOpen((open) => !open)} style={styles.filterButton}>
            <Text style={styles.filterLabel}>{filter === 'all' ? 'Filter' : filter}</Text>
          </Pressable>
        ) : <View />}
      </View>
      {about && tab === 'about' ? about : (
        <View style={styles.stack}>
          {error ? <Notice text={error} /> : null}
          {filtersOpen ? (
            <View style={styles.filters}>
              <Choice label="All" on={filter === 'all'} onPress={() => setFilter('all')} />
              {kinds.map((item) => (
                <Choice key={item} label={item[0]!.toUpperCase() + item.slice(1)} on={filter === item} onPress={() => setFilter(item)} />
              ))}
            </View>
          ) : null}
          {canWrite ? (
            <View style={styles.composer}>
              <MentionField
                plain
                workspaceId={workspaceId}
                value={text}
                placeholder="Add a note, set a reminder, mention people..."
                onChange={(next, ids) => {
                  setText(next)
                  setMentioned(ids.filter((id) => id !== contactId))
                }}
              />
              {remindOn ? <DateField label="Remind on" value={remind} onChange={setRemind} /> : null}
              <View style={styles.composerBar}>
                <Pressable accessibilityLabel="Set a reminder" onPress={() => setRemindOn((on) => !on)} style={[styles.clock, remindOn && styles.clockOn]}>
                  <Text style={styles.clockText}>◷</Text>
                </Pressable>
                <View style={styles.kinds}>
                  {kinds.map((item) => (
                    <Pressable key={item} onPress={() => setKind(item)}>
                      <Text style={[styles.kind, kind === item && styles.kindOn]}>{item}</Text>
                    </Pressable>
                  ))}
                </View>
                {kind === 'note' ? (
                  <Pressable onPress={() => setShared((current) => !current)}>
                    <Text style={styles.kind}>{shared ? 'Shared' : 'Private'}</Text>
                  </Pressable>
                ) : <View />}
                <Button label="Add" disabled={!text.trim()} onPress={() => void publish()} />
              </View>
            </View>
          ) : null}
          {!entries.length ? <Text style={styles.meta}>Nothing here yet.</Text> : null}
          {blocks.map((block) => {
            if (block.type === 'group') {
              const shut = closed[block.key]
              return (
                <View key={block.key} style={styles.group}>
                  <Pressable onPress={() => setClosed((current) => ({ ...current, [block.key]: !current[block.key] }))}>
                    <Text style={styles.groupLabel}>{block.entries.length} {plural(block.kind)}</Text>
                  </Pressable>
                  {shut ? null : block.entries.map((entry) => (
                    <EntryRow key={entry.id} entry={entry} people={people} photos={photos} workspaceId={workspaceId} canWrite={canWrite} onOpen={(id) => router.push(`/contacts/${id}`)} onDelete={() => void remove(workspaceId, entry).then(load).catch((caught: Error) => setError(caught.message))} />
                  ))}
                </View>
              )
            }
            return (
              <EntryRow key={block.entry.id} entry={block.entry} people={people} photos={photos} workspaceId={workspaceId} canWrite={canWrite} onOpen={(id) => router.push(`/contacts/${id}`)} onDelete={() => void remove(workspaceId, block.entry).then(load).catch((caught: Error) => setError(caught.message))} />
            )
          })}
        </View>
      )}
    </View>
  )
}

function EntryRow({
  entry,
  people,
  photos,
  workspaceId,
  canWrite,
  onOpen,
  onDelete,
}: {
  entry: Entry
  people: ContactSummary[]
  photos: Array<{ activityId: string; assetId: string }>
  workspaceId: string
  canWrite: boolean
  onOpen: (id: string) => void
  onDelete: () => void
}) {
  const parts = mentionParts(entry.body, people)
  const named = new Set(parts.flatMap((part) => (part.id ? [part.id] : [])))
  const extra = entry.people.filter((person) => !named.has(person.id))
  const shots = entry.source === 'activity' ? photos.filter((item) => item.activityId === entry.id) : []
  return (
    <View style={styles.item}>
      <View style={styles.mark}><Text style={styles.markText}>{mark(entry.kind)}</Text></View>
      <View style={styles.itemBody}>
        <View style={styles.itemHead}>
          <Text style={styles.action}>{action(entry.kind)}{entry.visibility === 'private' ? ' · private' : ''}</Text>
          <Text style={styles.when}>{relative(entry.at)}</Text>
          {canWrite ? <Pressable onPress={onDelete}><Text style={styles.delete}>Delete</Text></Pressable> : null}
        </View>
        {entry.body ? (
          <View style={styles.card}>
            <Text style={styles.cardText}>
              {parts.map((part, index) => part.id ? (
                <Text key={`${part.id}-${index}`} style={styles.mention} onPress={() => onOpen(part.id!)}>{part.text}</Text>
              ) : (
                <Text key={`text-${index}`}>{part.text}</Text>
              ))}
            </Text>
            {extra.length ? (
              <View style={styles.extra}>
                {extra.map((person) => (
                  <Pressable key={person.id} onPress={() => onOpen(person.id)}>
                    <Text style={styles.mention}>@{person.name}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
            {shots.length ? (
              <View style={styles.extra}>
                {shots.map((item) => (
                  <AuthImage key={item.assetId} path={`/api/workspaces/${workspaceId}/immich/assets/${item.assetId}/thumbnail`} size={72} />
                ))}
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  )
}

function merge(notes: Note[], events: Activity[]) {
  const entries: Entry[] = notes.map((note) => ({
    id: note.id,
    source: 'note',
    kind: 'note',
    at: note.createdAt,
    body: note.body,
    visibility: note.visibility,
    people: note.contactId ? [{ id: note.contactId, name: note.contactName ?? '' }] : [],
  }))
  for (const event of events) {
    const twin = event.type === 'note'
      ? entries.find((entry) => entry.source === 'note' && entry.body.trim() === (event.description ?? '').trim() && Math.abs(new Date(entry.at).getTime() - new Date(event.occurredAt).getTime()) < 120_000)
      : undefined
    if (twin) {
      for (const person of event.people) {
        if (!twin.people.some((item) => item.id === person.contactId)) twin.people.push({ id: person.contactId, name: person.displayName })
      }
      continue
    }
    entries.push({
      id: event.id,
      source: 'activity',
      kind: event.type,
      at: event.occurredAt,
      body: event.description ?? '',
      visibility: event.visibility,
      people: event.people.map((person) => ({ id: person.contactId, name: person.displayName })),
    })
  }
  return entries.sort((left, right) => new Date(right.at).getTime() - new Date(left.at).getTime())
}

function group(entries: Entry[]) {
  const blocks: Array<{ type: 'single'; entry: Entry } | { type: 'group'; key: string; kind: string; entries: Entry[] }> = []
  let index = 0
  while (index < entries.length) {
    const kind = entries[index]!.kind
    let end = index + 1
    while (end < entries.length && entries[end]!.kind === kind) end += 1
    const run = entries.slice(index, end)
    if (run.length >= 3 && index > 0) blocks.push({ type: 'group', key: `group-${run[0]!.id}`, kind, entries: run })
    else run.forEach((entry) => blocks.push({ type: 'single', entry }))
    index = end
  }
  return blocks
}

function remove(workspaceId: string, entry: Entry) {
  const path = entry.source === 'note' ? 'notes' : 'activities'
  return send(`/api/workspaces/${workspaceId}/${path}/${entry.id}`, 'DELETE')
}

function action(kind: string) {
  if (kind === 'note') return 'You added a note'
  if (kind === 'call') return 'You logged a call'
  if (kind === 'meeting') return 'You logged a meeting'
  if (kind === 'meal') return 'You logged a meal'
  return `You logged a ${kind}`
}

function mark(kind: string) {
  if (kind === 'call') return 'C'
  if (kind === 'meeting') return 'M'
  if (kind === 'meal') return 'F'
  return 'N'
}

function plural(kind: string) {
  if (kind === 'note') return 'NOTES'
  return `${kind.toUpperCase()}S`
}

function relative(iso: string) {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000)
  if (minutes < 1) return 'now'
  if (minutes < 60) return `${minutes}m`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.round(hours / 24)
  if (days < 14) return `${days}d`
  return new Date(iso).toLocaleDateString()
}

const styles = StyleSheet.create({
  stack: { gap: 14 },
  bar: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: theme.border },
  tabs: { flexDirection: 'row', gap: 18 },
  tab: { paddingBottom: 10 },
  tabOn: { borderBottomWidth: 2, borderBottomColor: theme.text, marginBottom: -1 },
  tabText: { fontFamily: font, fontSize: 16, color: theme.muted, fontWeight: '600' },
  tabTextOn: { color: theme.text },
  title: { fontFamily: font, fontSize: 28, fontWeight: '700', color: theme.text, paddingBottom: 8 },
  filterButton: { paddingBottom: 10, paddingHorizontal: 4 },
  filterLabel: { fontFamily: font, fontSize: 12, letterSpacing: 1, color: theme.muted, fontWeight: '700', textTransform: 'uppercase' },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  composer: { borderWidth: 1, borderColor: theme.border, borderRadius: 16, backgroundColor: theme.surface, padding: 14, gap: 8 },
  composerBar: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  clock: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  clockOn: { backgroundColor: theme.bg },
  clockText: { fontFamily: font, fontSize: 18, color: theme.muted },
  kinds: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  kind: { fontFamily: font, fontSize: 13, color: theme.muted, textTransform: 'capitalize' },
  kindOn: { color: theme.text, fontWeight: '700' },
  meta: { fontFamily: font, color: theme.muted, fontSize: 14 },
  group: { gap: 12 },
  groupLabel: { fontFamily: font, fontSize: 12, letterSpacing: 0.8, color: theme.muted, fontWeight: '700' },
  item: { flexDirection: 'row', gap: 12 },
  mark: { width: 28, height: 28, borderRadius: 8, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  markText: { fontFamily: font, fontSize: 12, fontWeight: '700', color: theme.muted },
  itemBody: { flex: 1, gap: 8 },
  itemHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  action: { fontFamily: font, fontSize: 14, fontWeight: '700', color: theme.text, flex: 1 },
  when: { fontFamily: font, fontSize: 13, color: theme.muted },
  delete: { fontFamily: font, fontSize: 12, color: theme.muted },
  card: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, gap: 8 },
  cardText: { fontFamily: font, fontSize: 15, lineHeight: 22, color: theme.text },
  mention: { fontFamily: font, fontSize: 15, lineHeight: 22, color: '#2563eb', fontWeight: '600' },
  extra: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
})
