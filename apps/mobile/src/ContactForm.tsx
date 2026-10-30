import { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { api, type AddressBook, type Contact } from './api'
import { useAuth } from './auth'
import { font, theme } from './theme'
import { Button, Field, Notice } from './ui'

type Method = { kind: 'email' | 'phone'; label: string; value: string }

export function ContactForm({
  contact,
  onSaved,
}: {
  contact?: Contact
  onSaved: (id: string) => void
}) {
  const { workspace } = useAuth()
  const [books, setBooks] = useState<AddressBook[]>([])
  const [addressBookId, setAddressBookId] = useState(contact?.addressBookId ?? '')
  const [firstName, setFirstName] = useState(contact?.firstName ?? '')
  const [lastName, setLastName] = useState(contact?.lastName ?? '')
  const [preferredName, setPreferredName] = useState(contact?.preferredName ?? '')
  const [organizationName, setOrganizationName] = useState(contact?.organizationName ?? '')
  const [title, setTitle] = useState(contact?.title ?? '')
  const [website, setWebsite] = useState(contact?.website ?? '')
  const [birthday, setBirthday] = useState(contact?.birthday ?? '')
  const [cardNote, setCardNote] = useState(contact?.cardNote ?? '')
  const [howWeMet, setHowWeMet] = useState(contact?.howWeMet ?? '')
  const [interests, setInterests] = useState(contact?.interests ?? '')
  const [emails, setEmails] = useState<Method[]>(
    contact?.methods.filter((method) => method.kind === 'email').map((method) => ({ kind: 'email', label: method.label, value: method.value })) ?? [
      { kind: 'email', label: 'work', value: '' },
    ],
  )
  const [phones, setPhones] = useState<Method[]>(
    contact?.methods.filter((method) => method.kind === 'phone').map((method) => ({ kind: 'phone', label: method.label, value: method.value })) ?? [
      { kind: 'phone', label: 'mobile', value: '' },
    ],
  )
  const [street, setStreet] = useState(contact?.addresses[0]?.street ?? '')
  const [city, setCity] = useState(contact?.addresses[0]?.city ?? '')
  const [region, setRegion] = useState(contact?.addresses[0]?.region ?? '')
  const [postalCode, setPostalCode] = useState(contact?.addresses[0]?.postalCode ?? '')
  const [country, setCountry] = useState(contact?.addresses[0]?.country ?? '')
  const [tagNames, setTagNames] = useState(contact?.tags.map((tag) => tag.name).join(', ') ?? '')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (!workspace || contact) return
    api<AddressBook[]>(`/api/workspaces/${workspace.id}/address-books`).then((rows) => {
      setBooks(rows)
      setAddressBookId(rows[0]?.id ?? '')
    }).catch((caught: Error) => setError(caught.message))
  }, [workspace, contact])

  async function save() {
    if (!workspace) return
    setPending(true)
    setError('')
    const methods = [...emails, ...phones].filter((method) => method.value.trim())
    const body = {
      addressBookId: contact ? undefined : addressBookId,
      firstName,
      lastName,
      preferredName,
      organizationName,
      title,
      website,
      birthday: birthday.trim() || null,
      cardNote,
      howWeMet,
      interests,
      methods,
      addresses: street || city || region || postalCode || country ? [{ label: 'home', street, city, region, postalCode, country }] : [],
      tagNames: tagNames.split(',').map((tag) => tag.trim()).filter(Boolean),
    }
    try {
      const saved = contact
        ? await api<Contact>(`/api/workspaces/${workspace.id}/contacts/${contact.id}`, { method: 'PATCH', body: JSON.stringify(body) })
        : await api<Contact>(`/api/workspaces/${workspace.id}/contacts`, { method: 'POST', body: JSON.stringify(body) })
      onSaved(saved.id)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save the contact')
    } finally {
      setPending(false)
    }
  }

  return (
    <View style={styles.form}>
      {error ? <Notice text={error} /> : null}
      {!contact ? (
        <View style={styles.books}>
          {books.map((book) => (
            <Pressable key={book.id} onPress={() => setAddressBookId(book.id)} style={[styles.book, addressBookId === book.id && styles.bookActive]}>
              <Text style={styles.bookText}>{book.name}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <View style={styles.row}>
        <Field label="First name" value={firstName} onChangeText={setFirstName} />
        <Field label="Last name" value={lastName} onChangeText={setLastName} />
      </View>
      <View style={styles.row}>
        <Field label="Preferred name" value={preferredName} onChangeText={setPreferredName} />
        <Field label="Title" value={title} onChangeText={setTitle} />
      </View>
      <Field label="Organization" value={organizationName} onChangeText={setOrganizationName} />
      {emails.map((email, index) => (
        <Field
          key={`email-${index}`}
          label={index === 0 ? 'Email' : `Email ${index + 1}`}
          autoCapitalize="none"
          value={email.value}
          onChangeText={(value) => setEmails(emails.map((item, itemIndex) => (itemIndex === index ? { ...item, value } : item)))}
        />
      ))}
      <Button label="Add email" tone="ghost" onPress={() => setEmails([...emails, { kind: 'email', label: 'other', value: '' }])} />
      {phones.map((phone, index) => (
        <Field
          key={`phone-${index}`}
          label={index === 0 ? 'Phone' : `Phone ${index + 1}`}
          value={phone.value}
          onChangeText={(value) => setPhones(phones.map((item, itemIndex) => (itemIndex === index ? { ...item, value } : item)))}
        />
      ))}
      <Button label="Add phone" tone="ghost" onPress={() => setPhones([...phones, { kind: 'phone', label: 'mobile', value: '' }])} />
      <Field label="Street" value={street} onChangeText={setStreet} />
      <View style={styles.row}>
        <Field label="City" value={city} onChangeText={setCity} />
        <Field label="Region" value={region} onChangeText={setRegion} />
      </View>
      <View style={styles.row}>
        <Field label="Postal code" value={postalCode} onChangeText={setPostalCode} />
        <Field label="Country" value={country} onChangeText={setCountry} />
      </View>
      <Field label="Birthday" placeholder="YYYY-MM-DD" value={birthday} onChangeText={setBirthday} />
      <Field label="Website" autoCapitalize="none" value={website} onChangeText={setWebsite} />
      <Field label="Card note" multiline value={cardNote} onChangeText={setCardNote} />
      <Field label="How we met" value={howWeMet} onChangeText={setHowWeMet} />
      <Field label="Interests" value={interests} onChangeText={setInterests} />
      <Field label="Tags" placeholder="family, client" value={tagNames} onChangeText={setTagNames} />
      <Button label={pending ? 'Saving' : 'Save contact'} onPress={save} disabled={pending} />
    </View>
  )
}

const styles = StyleSheet.create({
  form: { gap: 12 },
  row: { flexDirection: 'row', gap: 12 },
  books: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  book: { borderWidth: 1, borderColor: theme.border, borderRadius: 99, paddingHorizontal: 12, paddingVertical: 6 },
  bookActive: { backgroundColor: theme.accentMuted, borderColor: theme.accent },
  bookText: { fontFamily: font, color: theme.text },
})
