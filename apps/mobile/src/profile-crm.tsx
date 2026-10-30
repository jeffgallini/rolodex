import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import {
  api,
  send,
  type Activity,
  type CustomField,
  type Household,
  type Note,
  type OrgMembership,
  type Relationship,
  type Task,
} from './api'
import { font, theme } from './theme'
import { Button, Field, Notice, Panel } from './ui'
import { IndustryField } from './fields'
import { OrgLogo } from './org-logo'
import { Choice, PersonPicker } from './people'

const categories = ['family', 'personal', 'professional', 'commercial', 'social', 'custom'] as const
const types: Record<(typeof categories)[number], string[]> = {
  family: ['spouse', 'parent', 'child', 'sibling', 'cousin', 'relative'],
  personal: ['friend', 'neighbor', 'acquaintance'],
  professional: ['colleague', 'manager', 'employee', 'business partner'],
  commercial: ['client', 'vendor', 'customer', 'supplier'],
  social: ['introduced by', 'mutual friend', 'community'],
  custom: [],
}
const activityTypes = ['call', 'meeting', 'meal', 'note']

export function ProfileCrm({ workspaceId, contactId, canWrite, birthday }: { workspaceId: string; contactId: string; canWrite: boolean; birthday: string | null }) {
  const router = useRouter()
  const [error, setError] = useState('')
  const [links, setLinks] = useState<Relationship[]>([])
  const [homes, setHomes] = useState<{ id: string; name: string; role: string | null; city: string | null }[]>([])
  const [orgs, setOrgs] = useState<OrgMembership[]>([])
  const [notes, setNotes] = useState<Note[]>([])
  const [events, setEvents] = useState<Activity[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [fields, setFields] = useState<CustomField[]>([])
  const [allHomes, setAllHomes] = useState<Household[]>([])
  const [allOrgs, setAllOrgs] = useState<{ id: string; name: string }[]>([])
  const [category, setCategory] = useState<(typeof categories)[number]>('personal')
  const [relation, setRelation] = useState('friend')
  const [customType, setCustomType] = useState('')
  const [person, setPerson] = useState('')
  const [note, setNote] = useState('')
  const [sharedNote, setSharedNote] = useState(false)
  const [eventType, setEventType] = useState('meeting')
  const [eventDate, setEventDate] = useState(new Date().toISOString().slice(0, 10))
  const [eventText, setEventText] = useState('')
  const [eventPeople, setEventPeople] = useState<string[]>([])
  const [taskTitle, setTaskTitle] = useState('')
  const [taskDue, setTaskDue] = useState('')
  const [homeId, setHomeId] = useState('')
  const [homeRole, setHomeRole] = useState('')
  const [newHome, setNewHome] = useState('')
  const [orgId, setOrgId] = useState('')
  const [orgTitle, setOrgTitle] = useState('')
  const [newOrg, setNewOrg] = useState('')
  const [newOrgIndustry, setNewOrgIndustry] = useState('')
  const [newOrgWebsite, setNewOrgWebsite] = useState('')
  const [fieldLabel, setFieldLabel] = useState('')
  const [fieldType, setFieldType] = useState<'text' | 'number' | 'date' | 'boolean'>('text')
  const [drafts, setDrafts] = useState<Record<string, string>>({})

  function load() {
    const base = `/api/workspaces/${workspaceId}`
    Promise.all([
      api<Relationship[]>(`${base}/contacts/${contactId}/relationships`),
      api<typeof homes>(`${base}/contacts/${contactId}/households`),
      api<OrgMembership[]>(`${base}/contacts/${contactId}/organizations`),
      api<Note[]>(`${base}/contacts/${contactId}/notes`),
      api<Activity[]>(`${base}/activities?contactId=${contactId}`),
      api<Task[]>(`${base}/tasks?contactId=${contactId}`),
      api<CustomField[]>(`${base}/contacts/${contactId}/fields`),
      api<Household[]>(`${base}/households`),
      api<{ id: string; name: string }[]>(`${base}/organizations`),
    ])
      .then(([nextLinks, nextHomes, nextOrgs, nextNotes, nextEvents, nextTasks, nextFields, homesList, orgsList]) => {
        setLinks(nextLinks)
        setHomes(nextHomes)
        setOrgs(nextOrgs)
        setNotes(nextNotes)
        setEvents(nextEvents)
        setTasks(nextTasks)
        setFields(nextFields)
        setAllHomes(homesList)
        setAllOrgs(orgsList)
        setDrafts(Object.fromEntries(nextFields.map((field) => [field.id, field.value == null ? '' : String(field.value)])))
        setError('')
      })
      .catch((caught: Error) => setError(caught.message))
  }

  useEffect(load, [workspaceId, contactId])

  async function run(action: () => Promise<unknown>) {
    setError('')
    try {
      await action()
      load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save')
    }
  }

  const relationType = category === 'custom' ? customType.trim() : relation

  return (
    <View style={styles.stack}>
      {error ? <Notice text={error} /> : null}
      <Panel>
        <Text style={styles.section}>Relationships</Text>
        {links.map((link) => (
          <View key={link.id} style={styles.row}>
            <Pressable onPress={() => router.push(`/contacts/${link.contactId}`)}>
              <Text style={styles.link}>{link.displayName}</Text>
            </Pressable>
            <Text style={styles.meta}>{link.category} · {link.type}</Text>
            {canWrite ? <Button label="Remove" tone="ghost" onPress={() => void run(() => send(`/api/workspaces/${workspaceId}/relationships/${link.id}`, 'DELETE'))} /> : null}
          </View>
        ))}
        {!links.length ? <Text style={styles.meta}>No relationships yet.</Text> : null}
        {canWrite ? (
          <View style={styles.form}>
            <View style={styles.chips}>
              {categories.map((item) => (
                <Choice key={item} label={item} on={category === item} onPress={() => { setCategory(item); setRelation(types[item][0] ?? '') }} />
              ))}
            </View>
            <View style={styles.chips}>
              {types[category].map((item) => (
                <Choice key={item} label={item} on={relation === item} onPress={() => setRelation(item)} />
              ))}
            </View>
            {category === 'custom' ? <Field label="Type" value={customType} onChangeText={setCustomType} /> : null}
            <PersonPicker workspaceId={workspaceId} exclude={contactId} selected={person ? [person] : []} onToggle={(id) => setPerson(id === person ? '' : id)} />
            <Button
              label="Link person"
              disabled={!person || !relationType}
              onPress={() => void run(async () => {
                await send(`/api/workspaces/${workspaceId}/contacts/${contactId}/relationships`, 'POST', { toContactId: person, category, type: relationType })
                setPerson('')
              })}
            />
          </View>
        ) : null}
      </Panel>
      <Panel>
        <Text style={styles.section}>Household</Text>
        {homes.map((home) => (
          <Text key={home.id} style={styles.body}>{home.name}{home.role ? ` · ${home.role}` : ''}{home.city ? ` · ${home.city}` : ''}</Text>
        ))}
        {!homes.length ? <Text style={styles.meta}>Not in a household.</Text> : null}
        {canWrite ? (
          <View style={styles.form}>
            <View style={styles.chips}>
              {allHomes.map((home) => (
                <Choice key={home.id} label={home.name} on={homeId === home.id} onPress={() => setHomeId(home.id)} />
              ))}
            </View>
            <Field label="Role" value={homeRole} onChangeText={setHomeRole} placeholder="spouse, child, roommate" />
            <Button
              label="Add to household"
              disabled={!homeId}
              onPress={() => void run(() => send(`/api/workspaces/${workspaceId}/households/${homeId}/members`, 'POST', { contactId, role: homeRole || null }))}
            />
            <Field label="New household" value={newHome} onChangeText={setNewHome} />
            <Button
              label="Create household"
              disabled={!newHome.trim()}
              onPress={() => void run(async () => {
                const created = await send<Household>(`/api/workspaces/${workspaceId}/households`, 'POST', { name: newHome.trim() })
                await send(`/api/workspaces/${workspaceId}/households/${created.id}/members`, 'POST', { contactId, role: homeRole || null })
                setNewHome('')
              })}
            />
          </View>
        ) : null}
      </Panel>
      <Panel>
        <Text style={styles.section}>Organizations</Text>
        {orgs.map((org) => (
          <View key={org.id} style={styles.identity}>
            <OrgLogo uri={org.logoUrl} />
            <Text style={styles.body}>{org.name}{[org.title, org.department].filter(Boolean).length ? ` · ${[org.title, org.department].filter(Boolean).join(', ')}` : ''}</Text>
          </View>
        ))}
        {!orgs.length ? <Text style={styles.meta}>No organization records. The company on the card stays the vCard organization.</Text> : null}
        {canWrite ? (
          <View style={styles.form}>
            <View style={styles.chips}>
              {allOrgs.map((org) => (
                <Choice key={org.id} label={org.name} on={orgId === org.id} onPress={() => setOrgId(org.id)} />
              ))}
            </View>
            <Field label="Title" value={orgTitle} onChangeText={setOrgTitle} />
            <Button
              label="Add to organization"
              disabled={!orgId}
              onPress={() => void run(() => send(`/api/workspaces/${workspaceId}/organizations/${orgId}/members`, 'POST', { contactId, title: orgTitle || null }))}
            />
            <Field label="New organization" value={newOrg} onChangeText={setNewOrg} />
            <IndustryField value={newOrgIndustry} onChange={setNewOrgIndustry} />
            <Field label="Website" autoCapitalize="none" value={newOrgWebsite} onChangeText={setNewOrgWebsite} placeholder="https://example.com" />
            <Button
              label="Create organization"
              disabled={!newOrg.trim()}
              onPress={() => void run(async () => {
                const created = await send<{ id: string }>(`/api/workspaces/${workspaceId}/organizations`, 'POST', { name: newOrg.trim(), industry: newOrgIndustry || null, website: newOrgWebsite || null })
                await send(`/api/workspaces/${workspaceId}/organizations/${created.id}/members`, 'POST', { contactId, title: orgTitle || null })
                setNewOrg('')
                setNewOrgIndustry('')
                setNewOrgWebsite('')
              })}
            />
          </View>
        ) : null}
      </Panel>
      <Panel>
        <Text style={styles.section}>Timeline</Text>
        {events.map((event) => (
          <View key={event.id} style={styles.block}>
            <Text style={styles.body}>{event.type} · {event.occurredAt.slice(0, 10)}</Text>
            {event.description ? <Text style={styles.meta}>{event.description}</Text> : null}
            <Text style={styles.meta}>{event.people.map((person) => person.displayName).join(', ')} · {event.visibility}</Text>
          </View>
        ))}
        {!events.length ? <Text style={styles.meta}>No activities yet.</Text> : null}
        {canWrite ? (
          <View style={styles.form}>
            <View style={styles.chips}>
              {activityTypes.map((item) => (
                <Choice key={item} label={item} on={eventType === item} onPress={() => setEventType(item)} />
              ))}
            </View>
            <Field label="Date" value={eventDate} onChangeText={setEventDate} placeholder="YYYY-MM-DD" />
            <Field label="What happened" value={eventText} onChangeText={setEventText} />
            <PersonPicker workspaceId={workspaceId} exclude={contactId} selected={eventPeople} onToggle={(id) => setEventPeople((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])} />
            <Button
              label="Add activity"
              onPress={() => void run(async () => {
                await send(`/api/workspaces/${workspaceId}/activities`, 'POST', {
                  type: eventType,
                  occurredAt: eventDate,
                  description: eventText || null,
                  contactIds: [contactId, ...eventPeople],
                })
                setEventText('')
                setEventPeople([])
              })}
            />
          </View>
        ) : null}
      </Panel>
      <Panel>
        <Text style={styles.section}>Notes</Text>
        <Text style={styles.meta}>Private notes stay with you. Workspace notes are visible to people who can see this contact. Neither is written to the vCard.</Text>
        {notes.map((item) => (
          <View key={item.id} style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.body}>{item.body}</Text>
              <Text style={styles.meta}>{item.visibility}</Text>
            </View>
            {canWrite ? <Button label="Delete" tone="ghost" onPress={() => void run(() => send(`/api/workspaces/${workspaceId}/notes/${item.id}`, 'DELETE'))} /> : null}
          </View>
        ))}
        {canWrite ? (
          <View style={styles.form}>
            <Field label="Note" value={note} onChangeText={setNote} />
            <Choice label={sharedNote ? 'Visible to workspace' : 'Private'} on={sharedNote} onPress={() => setSharedNote((current) => !current)} />
            <Button
              label="Save note"
              disabled={!note.trim()}
              onPress={() => void run(async () => {
                await send(`/api/workspaces/${workspaceId}/notes`, 'POST', { body: note.trim(), contactId, visibility: sharedNote ? 'workspace' : 'private' })
                setNote('')
              })}
            />
          </View>
        ) : null}
      </Panel>
      <Panel>
        <Text style={styles.section}>Tasks</Text>
        {tasks.filter((task) => !task.completedAt).map((task) => (
          <View key={task.id} style={styles.row}>
            <Text style={styles.body}>{task.title}{task.dueAt ? ` · ${task.dueAt.slice(0, 10)}` : ''}</Text>
            {canWrite ? <Button label="Done" tone="ghost" onPress={() => void run(() => send(`/api/workspaces/${workspaceId}/tasks/${task.id}/complete`, 'POST', { completed: true }))} /> : null}
          </View>
        ))}
        {canWrite ? (
          <View style={styles.form}>
            <Field label="Task" value={taskTitle} onChangeText={setTaskTitle} />
            <Field label="Due date" value={taskDue} onChangeText={setTaskDue} placeholder="YYYY-MM-DD" />
            <Button
              label="Add task"
              disabled={!taskTitle.trim()}
              onPress={() => void run(async () => {
                await send(`/api/workspaces/${workspaceId}/tasks`, 'POST', { title: taskTitle.trim(), dueAt: taskDue || null, contactId })
                setTaskTitle('')
                setTaskDue('')
              })}
            />
            {birthday ? (
              <Button
                label="Remind me about this birthday"
                tone="ghost"
                onPress={() => void run(() => send(`/api/workspaces/${workspaceId}/reminders`, 'POST', { type: 'birthday', remindAt: nextDate(birthday), contactId }))}
              />
            ) : null}
          </View>
        ) : null}
      </Panel>
      <Panel>
        <Text style={styles.section}>Custom fields</Text>
        {fields.map((field) => (
          <View key={field.id} style={styles.form}>
            <Field label={field.label} value={drafts[field.id] ?? ''} onChangeText={(value) => setDrafts((current) => ({ ...current, [field.id]: value }))} />
            {canWrite ? (
              <Button
                label="Save"
                tone="ghost"
                onPress={() => void run(() => send(`/api/workspaces/${workspaceId}/contacts/${contactId}/fields/${field.id}`, 'PUT', { value: castField(field.fieldType, drafts[field.id] ?? '') }))}
              />
            ) : null}
          </View>
        ))}
        {canWrite ? (
          <View style={styles.form}>
            <Field label="New field" value={fieldLabel} onChangeText={setFieldLabel} />
            <View style={styles.chips}>
              {(['text', 'number', 'date', 'boolean'] as const).map((item) => (
                <Choice key={item} label={item} on={fieldType === item} onPress={() => setFieldType(item)} />
              ))}
            </View>
            <Button
              label="Define field"
              disabled={!fieldLabel.trim()}
              onPress={() => void run(async () => {
                await send(`/api/workspaces/${workspaceId}/fields`, 'POST', { label: fieldLabel.trim(), fieldType })
                setFieldLabel('')
              })}
            />
          </View>
        ) : null}
      </Panel>
    </View>
  )
}

function castField(type: string, value: string) {
  if (!value.trim()) return null
  if (type === 'number') return Number(value)
  if (type === 'boolean') return /^(1|true|yes)$/i.test(value.trim())
  return value.trim()
}

function nextDate(iso: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!match) return new Date().toISOString()
  const month = Number(match[2]) - 1
  const day = Number(match[3])
  const target = new Date()
  target.setHours(9, 0, 0, 0)
  target.setMonth(month, day)
  if (target.getTime() < Date.now()) target.setFullYear(target.getFullYear() + 1)
  return target.toISOString()
}

const styles = StyleSheet.create({
  stack: { gap: 16 },
  section: { fontFamily: font, fontSize: 13, color: theme.muted, marginBottom: 8, letterSpacing: 0.4 },
  body: { fontFamily: font, color: theme.text, fontSize: 15 },
  meta: { fontFamily: font, color: theme.muted, fontSize: 13 },
  link: { fontFamily: font, color: theme.text, fontSize: 16, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 8 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  block: { gap: 2, marginBottom: 10 },
  form: { gap: 10, marginTop: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
})
