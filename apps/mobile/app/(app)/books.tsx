import { createElement, useEffect, useState } from 'react'
import { Platform, StyleSheet, Text, View } from 'react-native'
import { api, type AddressBook } from '../../src/api'
import { useAuth } from '../../src/auth'
import { font, theme } from '../../src/theme'
import { Button, Field, Notice, Panel } from '../../src/ui'

type Preview = {
  created: number
  skipped: number
  contacts: { fingerprint: string; displayName: string; duplicates: { displayName: string; reason: string }[] }[]
}

export default function Books() {
  const { workspace } = useAuth()
  const [books, setBooks] = useState<AddressBook[]>([])
  const [name, setName] = useState('')
  const [vcf, setVcf] = useState('')
  const [bookId, setBookId] = useState('')
  const [preview, setPreview] = useState<Preview | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const canEdit = workspace?.role === 'owner' || workspace?.role === 'administrator' || workspace?.role === 'editor'

  function load() {
    if (!workspace) return
    api<AddressBook[]>(`/api/workspaces/${workspace.id}/address-books`)
      .then((rows) => {
        setBooks(rows)
        setBookId((current) => current || rows[0]?.id || '')
      })
      .catch((caught: Error) => setError(caught.message))
  }

  useEffect(load, [workspace])

  async function create() {
    if (!workspace || !name.trim()) return
    await api(`/api/workspaces/${workspace.id}/address-books`, { method: 'POST', body: JSON.stringify({ name }) })
    setName('')
    load()
  }

  async function previewImport(commit: boolean, decisions?: { fingerprint: string; action: 'create' | 'skip' }[]) {
    if (!bookId) return
    setError('')
    try {
      const result = await api<Preview>(`/api/workspaces/${workspace?.id}/address-books/${bookId}/import`, {
        method: 'POST',
        body: JSON.stringify({ vcf, commit, decisions }),
      })
      setPreview(result)
      setMessage(commit ? `Imported ${result.created}. Skipped ${result.skipped}.` : 'Review possible duplicates before importing.')
      if (commit) load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Import failed')
    }
  }

  async function download(id = bookId) {
    if (!workspace || !id || Platform.OS !== 'web') return
    const token = sessionStorage.getItem('rolodex.session')
    const parsed = token ? (JSON.parse(token) as { token: string }) : null
    const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000'}/api/workspaces/${workspace.id}/address-books/${id}/export`, {
      headers: parsed ? { Authorization: `Bearer ${parsed.token}` } : undefined,
      credentials: 'include',
    })
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'contacts.vcf'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <View style={styles.page}>
      <Text style={styles.title}>Address books</Text>
      {error ? <Notice text={error} /> : null}
      {books.map((book) => (
        <Panel key={book.id}>
          <Text style={styles.name}>{book.name}</Text>
          <Text style={styles.meta}>Sync token {book.syncToken}</Text>
          <Button label="Export vCard" tone="ghost" onPress={() => { setBookId(book.id); void download(book.id) }} />
        </Panel>
      ))}
      {canEdit ? (
        <Panel>
          <Text style={styles.name}>New address book</Text>
          <Field label="Name" value={name} onChangeText={setName} />
          <Button label="Create" onPress={() => void create()} />
        </Panel>
      ) : null}
      {canEdit ? (
        <Panel>
          <Text style={styles.name}>Import</Text>
          {books.map((book) => (
            <Text key={book.id} onPress={() => setBookId(book.id)} style={[styles.choice, bookId === book.id && styles.choiceActive]}>
              {book.name}
            </Text>
          ))}
          {Platform.OS === 'web'
            ? createElement('input', {
                type: 'file',
                accept: '.vcf,text/vcard,text/plain',
                onChange: async (event: { target: { files?: FileList | null } }) => {
                  const file = event.target.files?.[0]
                  if (file) setVcf(await file.text())
                },
              })
            : null}
          <Field label="vCard text" multiline value={vcf} onChangeText={setVcf} />
          <Button label="Preview" tone="ghost" onPress={() => void previewImport(false)} />
          {preview?.contacts.some((contact) => contact.duplicates.length) ? (
            <View style={{ gap: 8 }}>
              {preview.contacts.filter((contact) => contact.duplicates.length).map((contact) => (
                <Text key={contact.fingerprint} style={styles.meta}>
                  {contact.displayName} matches {contact.duplicates.map((item) => item.displayName).join(', ')}
                </Text>
              ))}
              <Button
                label="Import new, skip matches"
                onPress={() =>
                  void previewImport(
                    true,
                    preview.contacts.map((contact) => ({ fingerprint: contact.fingerprint, action: contact.duplicates.length ? 'skip' : 'create' })),
                  )
                }
              />
            </View>
          ) : (
            <Button label="Import" onPress={() => void previewImport(true)} />
          )}
          {message ? <Text style={styles.meta}>{message}</Text> : null}
        </Panel>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  page: { gap: 14 },
  title: { fontFamily: font, fontSize: 28, fontWeight: '700', color: theme.text },
  name: { fontFamily: font, fontSize: 16, fontWeight: '600', color: theme.text, marginBottom: 6 },
  meta: { fontFamily: font, color: theme.muted, marginBottom: 8 },
  choice: { fontFamily: font, color: theme.muted, paddingVertical: 4 },
  choiceActive: { color: theme.accent },
})
