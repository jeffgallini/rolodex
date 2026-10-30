import { createHash, randomUUID } from 'node:crypto'
import {
  addressBookChanges,
  addressBooks,
  addresses,
  auditLogs,
  contactMethods,
  contactResources,
  contactTags,
  contacts,
  tags,
  type ContactType,
  type Database,
} from '@rolodex/db'
import { and, asc, desc, eq, ilike, inArray, isNull, or, sql } from 'drizzle-orm'
import type { z } from 'zod'
import { requireBook, requireMembership, requireWriter, type Db } from './access'
import { AppError } from './errors'
import { emptyToNull, isUuid, normalizeEmail, normalizePhone } from './normalize'
import { etagMatches, makeEtag } from './secrets'
import { cardDisplayName, parseVcards, serializeVcard, structuredName, type ParsedCard } from './vcard'
import { contactSchema } from './validation'

export type ContactBody = z.infer<typeof contactSchema>

type Bundle = Awaited<ReturnType<typeof loadBundle>>

export function displayNameOf(input: ContactBody) {
  const preferred = input.preferredName?.trim()
  const last = input.lastName?.trim()
  const core = preferred
    ? [preferred, last].filter((part): part is string => Boolean(part))
    : [input.firstName, input.middleName, input.lastName]
        .map((part) => part?.trim())
        .filter((part): part is string => Boolean(part))
  const parts = [input.prefix?.trim(), ...core, input.suffix?.trim()].filter((part): part is string => Boolean(part))
  if (parts.length) return parts.join(' ')
  if (input.organizationName?.trim()) return input.organizationName.trim()
  return 'Unnamed'
}

export async function listContacts(
  db: Database,
  userId: string,
  workspaceId: string,
  query: { q?: string | undefined; addressBookId?: string | undefined; limit?: number | undefined; offset?: number | undefined },
) {
  const limit = Math.min(Math.max(query.limit ?? 50, 1), 200)
  const offset = Math.max(query.offset ?? 0, 0)
  const filters = [eq(contacts.workspaceId, workspaceId), isNull(contacts.deletedAt)]
  if (query.addressBookId) {
    const { book } = await requireBook(db, userId, query.addressBookId)
    if (book.workspaceId !== workspaceId) throw new AppError(404, 'Address book not found')
    filters.push(
      sql`exists (select 1 from contact_resources r where r.contact_id = ${contacts.id} and r.address_book_id = ${book.id} and r.deleted_at is null)`,
    )
  } else {
    await requireMembership(db, userId, workspaceId)
  }
  const q = query.q?.trim()
  if (q) {
    const pattern = `%${q.replace(/[%_]/g, '')}%`
    const tsQuery = q.replace(/[^\p{L}\p{N}\s]/gu, ' ').trim()
    const search = [
      ilike(contacts.displayName, pattern),
      ilike(contacts.organizationName, pattern),
      ilike(contacts.cardNote, pattern),
      sql`exists (select 1 from contact_methods m where m.contact_id = ${contacts.id} and (m.value ilike ${pattern} or m.normalized_value ilike ${pattern}))`,
      sql`exists (select 1 from contact_tags ct join tags t on t.id = ct.tag_id where ct.contact_id = ${contacts.id} and t.name ilike ${pattern})`,
      sql`exists (select 1 from organization_memberships om join organizations o on o.id = om.organization_id where om.contact_id = ${contacts.id} and o.deleted_at is null and o.name ilike ${pattern})`,
      sql`exists (select 1 from relationships r where r.workspace_id = ${workspaceId} and (r.from_contact_id = ${contacts.id} or r.to_contact_id = ${contacts.id}) and (r.type ilike ${pattern} or r.category ilike ${pattern}))`,
      sql`exists (select 1 from notes n where n.contact_id = ${contacts.id} and n.deleted_at is null and n.body ilike ${pattern} and (n.visibility = 'workspace' or n.author_id = ${userId}))`,
      sql`exists (select 1 from activity_contacts ac join activities a on a.id = ac.activity_id where ac.contact_id = ${contacts.id} and a.deleted_at is null and (coalesce(a.description, '') ilike ${pattern} or a.type ilike ${pattern}) and (a.visibility = 'workspace' or a.created_by = ${userId}))`,
      sql`exists (select 1 from tasks t where t.contact_id = ${contacts.id} and t.deleted_at is null and t.title ilike ${pattern})`,
    ]
    if (/^birthdays?$/i.test(q)) {
      search.push(sql`${contacts.birthday} is not null and extract(month from ${contacts.birthday}) = extract(month from current_date)`)
    }
    if (tsQuery) {
      search.push(
        sql`to_tsvector('english', coalesce(${contacts.displayName}, '') || ' ' || coalesce(${contacts.organizationName}, '') || ' ' || coalesce(${contacts.cardNote}, '')) @@ plainto_tsquery('english', ${tsQuery})`,
      )
    }
    const combined = or(...search)
    if (combined) filters.push(combined)
  }
  const where = and(...filters)
  const [countRow] = await db.select({ total: sql<number>`count(*)::int` }).from(contacts).where(where)
  const rows = await db
    .select()
    .from(contacts)
    .where(where)
    .orderBy(asc(contacts.displayName))
    .limit(limit)
    .offset(offset)
  const ids = rows.map((row) => row.id)
  const methodRows = ids.length
    ? await db.select().from(contactMethods).where(inArray(contactMethods.contactId, ids)).orderBy(contactMethods.sortOrder)
    : []
  const tagRows = ids.length
    ? await db
        .select({ contactId: contactTags.contactId, id: tags.id, name: tags.name })
        .from(contactTags)
        .innerJoin(tags, eq(tags.id, contactTags.tagId))
        .where(inArray(contactTags.contactId, ids))
    : []
  const bookRows = ids.length
    ? await db
        .select({ contactId: contactResources.contactId, id: addressBooks.id, name: addressBooks.name })
        .from(contactResources)
        .innerJoin(addressBooks, eq(addressBooks.id, contactResources.addressBookId))
        .where(and(inArray(contactResources.contactId, ids), isNull(contactResources.deletedAt), isNull(addressBooks.deletedAt)))
    : []
  return {
    total: countRow?.total ?? 0,
    contacts: rows.map((row) => {
      const methods = methodRows.filter((method) => method.contactId === row.id)
      const email = methods.find((method) => method.kind === 'email' && method.isPrimary) ?? methods.find((method) => method.kind === 'email')
      const phone = methods.find((method) => method.kind === 'phone' && method.isPrimary) ?? methods.find((method) => method.kind === 'phone')
      return {
        id: row.id,
        workspaceId: row.workspaceId,
        displayName: row.displayName,
        organizationName: row.organizationName,
        title: row.title,
        primaryEmail: email?.value ?? null,
        primaryPhone: phone?.value ?? null,
        updatedAt: row.updatedAt.toISOString(),
        hasPhoto: Boolean(row.photoAttachmentId),
        tags: tagRows.filter((tag) => tag.contactId === row.id).map((tag) => ({ id: tag.id, name: tag.name })),
        addressBooks: bookRows.filter((book) => book.contactId === row.id).map((book) => ({ id: book.id, name: book.name })),
      }
    }),
  }
}

export async function getContact(db: Database, userId: string, workspaceId: string, contactId: string) {
  const bundle = await loadBundle(db, contactId)
  await assertCanReadContact(db, userId, workspaceId, bundle)
  return presentContact(bundle)
}

export async function createContact(db: Database, userId: string, workspaceId: string, input: ContactBody) {
  await requireWriter(db, userId, workspaceId)
  const bookIds = await writableBookIds(db, userId, workspaceId, input)
  return db.transaction(async (tx) => {
    const database = tx as unknown as Database
    const contactId = await insertContact(database, {
      workspaceId,
      ownerId: userId,
      input,
      bookId: bookIds[0]!,
      bookIds,
    })
    await recordAudit(database, workspaceId, userId, 'contact.create', contactId)
    return presentContact(await loadBundle(database, contactId))
  })
}

export async function updateContact(
  db: Database,
  userId: string,
  workspaceId: string,
  contactId: string,
  input: ContactBody,
) {
  const existingAccess = await loadBundle(db, contactId)
  await assertCanWriteContact(db, userId, workspaceId, existingAccess)
  const bookIds = input.addressBookIds ? await writableBookIds(db, userId, workspaceId, input) : undefined
  return db.transaction(async (tx) => {
    const database = tx as unknown as Database
    const existing = await loadBundle(database, contactId)
    if (existing.contact.workspaceId !== workspaceId) throw new AppError(404, 'Contact not found')
    const merged = mergeContact(input, existing.contact)
    if (merged.introducedByContactId) {
      await assertSameWorkspaceContact(database, workspaceId, merged.introducedByContactId, contactId)
    }
    const tagIds = await resolveTags(database, workspaceId, input.tagIds, input.tagNames)
    await database
      .update(contacts)
      .set({ ...identityValues(merged, existing.contact.type), updatedAt: new Date() })
      .where(eq(contacts.id, contactId))
    if (input.methods) await replaceMethods(database, contactId, input.methods)
    if (input.addresses) await replaceAddresses(database, contactId, input.addresses)
    if (input.tagIds || input.tagNames) await replaceTags(database, contactId, tagIds)
    await syncResources(database, contactId, bookIds ? { bookIds } : undefined)
    await recordAudit(database, workspaceId, userId, 'contact.update', contactId)
    return presentContact(await loadBundle(database, contactId))
  })
}

export async function deleteContact(db: Database, userId: string, workspaceId: string, contactId: string) {
  await assertCanWriteContact(db, userId, workspaceId, await loadBundle(db, contactId))
  await db.transaction(async (tx) => {
    const database = tx as unknown as Database
    const existing = await loadBundle(database, contactId)
    if (existing.contact.workspaceId !== workspaceId) throw new AppError(404, 'Contact not found')
    await database.update(contacts).set({ deletedAt: new Date(), updatedAt: new Date() }).where(eq(contacts.id, contactId))
    await syncResources(database, contactId, { deleted: true })
    await recordAudit(database, workspaceId, userId, 'contact.delete', contactId)
  })
}

export async function setContactPhoto(db: Database, userId: string, workspaceId: string, contactId: string, attachmentId: string | null) {
  const bundle = await loadBundle(db, contactId)
  await assertCanWriteContact(db, userId, workspaceId, bundle)
  await db.update(contacts).set({ photoAttachmentId: attachmentId, updatedAt: new Date() }).where(eq(contacts.id, contactId))
}

export async function listTags(db: Database, userId: string, workspaceId: string) {
  await requireMembership(db, userId, workspaceId)
  return db.select().from(tags).where(eq(tags.workspaceId, workspaceId)).orderBy(asc(tags.name))
}

export async function createTag(db: Database, userId: string, workspaceId: string, name: string, color?: string | null) {
  await requireWriter(db, userId, workspaceId)
  return findOrCreateTag(db, workspaceId, name, color)
}

export async function upsertFromVCard(
  db: Database,
  input: { userId: string; bookId: string; uid: string; vcardText: string; ifMatch?: string | null },
) {
  const { book } = await requireBook(db, input.userId, input.bookId, true)
  const [card] = parseVcards(input.vcardText)
  if (!card) throw new AppError(400, 'A vCard is required')
  card.uid = input.uid
  return db.transaction(async (tx) => {
    const database = tx as unknown as Database
    const [existing] = await database
      .select()
      .from(contactResources)
      .where(and(eq(contactResources.addressBookId, book.id), eq(contactResources.uid, input.uid)))
      .limit(1)
    if (existing && !existing.deletedAt) {
      if (!input.ifMatch) throw new AppError(412, 'If-Match is required to update a contact')
      if (!etagMatches(input.ifMatch, existing.etag)) throw new AppError(412, 'The contact was changed somewhere else')
      await applyCard(database, existing.contactId, card)
      const synced = await syncResources(database, existing.contactId, { unknown: card.unknown, uid: input.uid })
      await recordAudit(database, book.workspaceId, input.userId, 'contact.update', existing.contactId)
      return { etag: synced.etag, created: false }
    }
    if (existing?.deletedAt) {
      await database.update(contacts).set({ deletedAt: null, updatedAt: new Date() }).where(eq(contacts.id, existing.contactId))
      await applyCard(database, existing.contactId, card)
      const synced = await syncResources(database, existing.contactId, { unknown: card.unknown, uid: input.uid })
      await recordAudit(database, book.workspaceId, input.userId, 'contact.create', existing.contactId)
      return { etag: synced.etag, created: true }
    }
    const createdId = await insertContact(database, {
      workspaceId: book.workspaceId,
      ownerId: input.userId,
      input: cardToInput(card),
      bookId: book.id,
      uid: input.uid,
      unknown: card.unknown,
    })
    const synced = await loadBundle(database, createdId)
    await recordAudit(database, book.workspaceId, input.userId, 'contact.create', createdId)
    return { etag: synced.resource?.etag ?? '', created: true }
  })
}

export async function deleteCard(db: Database, userId: string, bookId: string, uid: string) {
  const { book } = await requireBook(db, userId, bookId, true)
  await db.transaction(async (tx) => {
    const database = tx as unknown as Database
    const [existing] = await database
      .select()
      .from(contactResources)
      .where(and(eq(contactResources.addressBookId, book.id), eq(contactResources.uid, uid), isNull(contactResources.deletedAt)))
      .limit(1)
    if (!existing) throw new AppError(404, 'Contact not found')
    await database.update(contacts).set({ deletedAt: new Date(), updatedAt: new Date() }).where(eq(contacts.id, existing.contactId))
    await syncResources(database, existing.contactId, { deleted: true })
    await recordAudit(database, book.workspaceId, userId, 'contact.delete', existing.contactId)
  })
}

export async function getLiveCard(db: Database, userId: string, bookId: string, uid: string) {
  const { book } = await requireBook(db, userId, bookId)
  const [resource] = await db
    .select()
    .from(contactResources)
    .where(and(eq(contactResources.addressBookId, book.id), eq(contactResources.uid, uid), isNull(contactResources.deletedAt)))
    .limit(1)
  if (!resource) throw new AppError(404, 'Contact not found')
  return resource
}

export async function listLiveCards(db: Database, userId: string, bookId: string) {
  const { book } = await requireBook(db, userId, bookId)
  return db
    .select()
    .from(contactResources)
    .where(and(eq(contactResources.addressBookId, book.id), isNull(contactResources.deletedAt)))
    .orderBy(asc(contactResources.uid))
}

export async function syncCollection(db: Database, userId: string, bookId: string, token: number | null) {
  const { book } = await requireBook(db, userId, bookId)
  if (token !== null && (!Number.isInteger(token) || token < 0 || token > book.syncToken)) {
    throw new AppError(409, 'Sync token is no longer valid')
  }
  if (token === null) {
    const rows = await listLiveCards(db, userId, book.id)
    return {
      token: book.syncToken,
      changes: rows.map((row) => ({ uid: row.uid, deleted: false, etag: row.etag, vcard: row.vcardText })),
    }
  }
  const changes = await db
    .select()
    .from(addressBookChanges)
    .where(and(eq(addressBookChanges.addressBookId, book.id), sql`${addressBookChanges.syncToken} > ${token}`))
    .orderBy(asc(addressBookChanges.syncToken))
  const latest = new Map<string, (typeof changes)[number]>()
  for (const change of changes) latest.set(change.uid, change)
  const liveIds = [...latest.values()].filter((change) => !change.deleted).map((change) => change.uid)
  const live = liveIds.length
    ? await db
        .select()
        .from(contactResources)
        .where(
          and(eq(contactResources.addressBookId, book.id), inArray(contactResources.uid, liveIds), isNull(contactResources.deletedAt)),
        )
    : []
  const liveByUid = new Map(live.map((row) => [row.uid, row]))
  return {
    token: book.syncToken,
    changes: [...latest.values()].map((change) => {
      const resource = liveByUid.get(change.uid)
      if (!resource || change.deleted) return { uid: change.uid, deleted: true, etag: null, vcard: null }
      return { uid: change.uid, deleted: false, etag: resource.etag, vcard: resource.vcardText }
    }),
  }
}

export async function findDuplicates(db: Database, workspaceId: string, emails: string[], phones: string[]) {
  const matches = new Map<string, { id: string; displayName: string; reason: 'email' | 'phone' }>()
  if (emails.length) {
    const rows = await db
      .select({ id: contacts.id, displayName: contacts.displayName })
      .from(contactMethods)
      .innerJoin(contacts, eq(contacts.id, contactMethods.contactId))
      .where(
        and(
          eq(contacts.workspaceId, workspaceId),
          isNull(contacts.deletedAt),
          eq(contactMethods.kind, 'email'),
          inArray(contactMethods.normalizedValue, emails),
        ),
      )
    for (const row of rows) matches.set(row.id, { ...row, reason: 'email' })
  }
  if (phones.length) {
    const rows = await db
      .select({ id: contacts.id, displayName: contacts.displayName })
      .from(contactMethods)
      .innerJoin(contacts, eq(contacts.id, contactMethods.contactId))
      .where(
        and(
          eq(contacts.workspaceId, workspaceId),
          isNull(contacts.deletedAt),
          eq(contactMethods.kind, 'phone'),
          inArray(contactMethods.normalizedValue, phones),
        ),
      )
    for (const row of rows) {
      if (!matches.has(row.id)) matches.set(row.id, { ...row, reason: 'phone' })
    }
  }
  return [...matches.values()]
}

export function cardFingerprint(card: ParsedCard) {
  const emails = card.emails.map((entry) => normalizeEmail(entry.value)).filter(Boolean).sort()
  const phones = card.phones.map((entry) => normalizePhone(entry.value)).filter(Boolean).sort()
  const basis = [card.uid ?? '', cardDisplayName(card), emails.join(','), phones.join(',')].join('|')
  return createHash('sha256').update(basis).digest('hex').slice(0, 20)
}

export async function createContactFromCard(db: Database, userId: string, bookId: string, card: ParsedCard) {
  const { book } = await requireBook(db, userId, bookId, true)
  return db.transaction(async (tx) => {
    const database = tx as unknown as Database
    const contactId = await insertContact(database, {
      workspaceId: book.workspaceId,
      ownerId: userId,
      input: cardToInput(card),
      bookId: book.id,
      uid: card.uid,
      unknown: card.unknown,
    })
    return contactId
  })
}

async function resolveBook(db: Database, userId: string, workspaceId: string, addressBookId?: string) {
  if (addressBookId) {
    const { book } = await requireBook(db, userId, addressBookId, true)
    if (book.workspaceId !== workspaceId) throw new AppError(404, 'Address book not found')
    return book
  }
  const [book] = await db
    .select()
    .from(addressBooks)
    .where(and(eq(addressBooks.workspaceId, workspaceId), isNull(addressBooks.deletedAt)))
    .orderBy(asc(addressBooks.createdAt))
    .limit(1)
  if (!book) throw new AppError(400, 'Create an address book before adding contacts')
  return book
}

async function writableBookIds(db: Database, userId: string, workspaceId: string, input: ContactBody) {
  const requested = [...new Set([...(input.addressBookIds ?? []), ...(input.addressBookId ? [input.addressBookId] : [])])]
  if (input.addressBookIds && !requested.length) throw new AppError(400, 'Choose at least one address book')
  if (!requested.length) {
    const book = await resolveBook(db, userId, workspaceId)
    return [book.id]
  }
  for (const id of requested) {
    const { book } = await requireBook(db, userId, id, true)
    if (book.workspaceId !== workspaceId) throw new AppError(400, 'Choose address books from this workspace')
  }
  return requested
}

async function assertCanReadContact(db: Database, userId: string, workspaceId: string, bundle: Bundle) {
  if (bundle.contact.workspaceId !== workspaceId) throw new AppError(404, 'Contact not found')
  try {
    await requireMembership(db, userId, workspaceId)
    return
  } catch (error) {
    if (!(error instanceof AppError) || error.status !== 404) throw error
  }
  for (const book of bundle.books) {
    try {
      await requireBook(db, userId, book.id)
      return
    } catch (error) {
      if (!(error instanceof AppError)) throw error
    }
  }
  throw new AppError(404, 'Contact not found')
}

async function assertCanWriteContact(db: Database, userId: string, workspaceId: string, bundle: Bundle) {
  if (bundle.contact.workspaceId !== workspaceId) throw new AppError(404, 'Contact not found')
  try {
    await requireWriter(db, userId, workspaceId)
    return
  } catch (error) {
    if (!(error instanceof AppError) || (error.status !== 403 && error.status !== 404)) throw error
  }
  for (const book of bundle.books) {
    try {
      await requireBook(db, userId, book.id, true)
      return
    } catch (error) {
      if (!(error instanceof AppError)) throw error
    }
  }
  throw new AppError(403, 'You do not have permission to edit contacts')
}

async function insertContact(
  db: Db,
  args: {
    workspaceId: string
    ownerId: string
    input: ContactBody
    bookId: string
    bookIds?: string[] | undefined
    uid?: string | undefined
    unknown?: string[] | undefined
  },
) {
  if (args.input.introducedByContactId) {
    await assertSameWorkspaceContact(db, args.workspaceId, args.input.introducedByContactId)
  }
  const tagIds = await resolveTags(db, args.workspaceId, args.input.tagIds, args.input.tagNames)
  const [contact] = await db
    .insert(contacts)
    .values({
      workspaceId: args.workspaceId,
      ownerId: args.ownerId,
      ...identityValues(args.input, args.input.type ?? 'individual'),
    })
    .returning()
  if (!contact) throw new AppError(500, 'Could not create the contact')
  if (args.input.methods) await replaceMethods(db, contact.id, args.input.methods)
  if (args.input.addresses) await replaceAddresses(db, contact.id, args.input.addresses)
  if (tagIds.length) await replaceTags(db, contact.id, tagIds)
  await syncResources(db, contact.id, { bookId: args.bookId, bookIds: args.bookIds ?? [args.bookId], uid: args.uid, unknown: args.unknown })
  return contact.id
}

function cardToInput(card: ParsedCard): ContactBody {
  const name = structuredName(card)
  return {
    firstName: name.first || null,
    middleName: name.middle || null,
    lastName: name.last || null,
    prefix: name.prefix || null,
    suffix: name.suffix || null,
    nickname: card.nickname || null,
    organizationName: card.organization || null,
    department: card.department || null,
    title: card.title || null,
    position: card.position || null,
    website: card.url || null,
    cardNote: card.note || null,
    birthday: card.birthday || null,
    anniversary: card.anniversary || null,
    methods: [
      ...card.emails.map((entry) => ({ kind: 'email' as const, label: entry.label, value: entry.value })),
      ...card.phones.map((entry) => ({ kind: 'phone' as const, label: entry.label, value: entry.value })),
    ],
    addresses: card.addresses.map((entry) => ({
      label: entry.label,
      street: entry.street,
      street2: entry.street2,
      city: entry.city,
      region: entry.region,
      postalCode: entry.postalCode,
      country: entry.country,
    })),
  }
}

async function applyCard(db: Db, contactId: string, card: ParsedCard) {
  const input = cardToInput(card)
  await db
    .update(contacts)
    .set({
      prefix: emptyToNull(input.prefix),
      firstName: emptyToNull(input.firstName),
      middleName: emptyToNull(input.middleName),
      lastName: emptyToNull(input.lastName),
      suffix: emptyToNull(input.suffix),
      nickname: emptyToNull(input.nickname),
      displayName: cardDisplayName(card),
      organizationName: emptyToNull(input.organizationName),
      department: emptyToNull(input.department),
      title: emptyToNull(input.title),
      position: emptyToNull(input.position),
      website: emptyToNull(input.website),
      cardNote: emptyToNull(input.cardNote),
      birthday: input.birthday ?? null,
      anniversary: input.anniversary ?? null,
      updatedAt: new Date(),
    })
    .where(eq(contacts.id, contactId))
  await db
    .delete(contactMethods)
    .where(and(eq(contactMethods.contactId, contactId), inArray(contactMethods.kind, ['email', 'phone'])))
  const methods = (input.methods ?? []).filter((method) => method.kind === 'email' || method.kind === 'phone')
  if (methods.length) await insertMethods(db, contactId, methods, 0)
  await replaceAddresses(db, contactId, input.addresses ?? [])
}

function mergeContact(input: ContactBody, current: typeof contacts.$inferSelect): ContactBody {
  const keep = <T>(value: T | null | undefined, previous: T | null) => (value === undefined ? previous : value)
  return {
    type: input.type ?? current.type,
    prefix: keep(input.prefix, current.prefix),
    firstName: keep(input.firstName, current.firstName),
    middleName: keep(input.middleName, current.middleName),
    lastName: keep(input.lastName, current.lastName),
    suffix: keep(input.suffix, current.suffix),
    preferredName: keep(input.preferredName, current.preferredName),
    nickname: keep(input.nickname, current.nickname),
    organizationName: keep(input.organizationName, current.organizationName),
    department: keep(input.department, current.department),
    title: keep(input.title, current.title),
    position: keep(input.position, current.position),
    birthday: keep(input.birthday, current.birthday),
    anniversary: keep(input.anniversary, current.anniversary),
    website: keep(input.website, current.website),
    cardNote: keep(input.cardNote, current.cardNote),
    howWeMet: keep(input.howWeMet, current.howWeMet),
    introducedByContactId: keep(input.introducedByContactId, current.introducedByContactId),
    preferredCommunication: keep(input.preferredCommunication, current.preferredCommunication),
    interests: keep(input.interests, current.interests),
    personalDetails: keep(input.personalDetails, current.personalDetails),
    professionalBackground: keep(input.professionalBackground, current.professionalBackground),
    followUpFrequency: keep(input.followUpFrequency, current.followUpFrequency),
    methods: input.methods,
    addresses: input.addresses,
    tagIds: input.tagIds,
    tagNames: input.tagNames,
  }
}

function identityValues(input: ContactBody, fallbackType: ContactType) {
  return {
    type: input.type ?? fallbackType,
    prefix: emptyToNull(input.prefix),
    firstName: emptyToNull(input.firstName),
    middleName: emptyToNull(input.middleName),
    lastName: emptyToNull(input.lastName),
    suffix: emptyToNull(input.suffix),
    preferredName: emptyToNull(input.preferredName),
    nickname: emptyToNull(input.nickname),
    displayName: displayNameOf(input),
    organizationName: emptyToNull(input.organizationName),
    department: emptyToNull(input.department),
    title: emptyToNull(input.title),
    position: emptyToNull(input.position),
    birthday: input.birthday ?? null,
    anniversary: input.anniversary ?? null,
    website: emptyToNull(input.website),
    cardNote: emptyToNull(input.cardNote),
    howWeMet: emptyToNull(input.howWeMet),
    introducedByContactId: input.introducedByContactId ?? null,
    preferredCommunication: emptyToNull(input.preferredCommunication),
    interests: emptyToNull(input.interests),
    personalDetails: emptyToNull(input.personalDetails),
    professionalBackground: emptyToNull(input.professionalBackground),
    followUpFrequency: emptyToNull(input.followUpFrequency),
  }
}

async function replaceMethods(db: Db, contactId: string, methods: NonNullable<ContactBody['methods']>) {
  await db.delete(contactMethods).where(eq(contactMethods.contactId, contactId))
  if (methods.length) await insertMethods(db, contactId, methods, 0)
}

async function insertMethods(db: Db, contactId: string, methods: NonNullable<ContactBody['methods']>, start: number) {
  const values = methods
    .map((method, index) => {
      const value = method.value.trim()
      const normalizedValue =
        method.kind === 'email' ? normalizeEmail(value) : method.kind === 'phone' ? normalizePhone(value) : value.toLowerCase()
      return { method, value, normalizedValue, index: start + index }
    })
    .filter((entry) => entry.normalizedValue)
  if (!values.length) return
  await db.insert(contactMethods).values(
    values.map((entry) => ({
      contactId,
      kind: entry.method.kind,
      label: entry.method.label?.trim() || defaultLabel(entry.method.kind),
      value: entry.value,
      normalizedValue: entry.normalizedValue,
      isPrimary: entry.method.isPrimary ?? entry.index === start,
      sortOrder: entry.index,
    })),
  )
}

function defaultLabel(kind: string) {
  if (kind === 'email') return 'other'
  if (kind === 'phone') return 'mobile'
  return ''
}

async function replaceAddresses(db: Db, contactId: string, rows: NonNullable<ContactBody['addresses']>) {
  await db.delete(addresses).where(eq(addresses.contactId, contactId))
  if (!rows.length) return
  await db.insert(addresses).values(
    rows.map((row, index) => ({
      contactId,
      label: row.label?.trim() || 'home',
      street: row.street?.trim() || '',
      street2: row.street2?.trim() || '',
      city: row.city?.trim() || '',
      region: row.region?.trim() || '',
      postalCode: row.postalCode?.trim() || '',
      country: row.country?.trim() || '',
      sortOrder: index,
    })),
  )
}

async function replaceTags(db: Db, contactId: string, tagIds: string[]) {
  await db.delete(contactTags).where(eq(contactTags.contactId, contactId))
  if (!tagIds.length) return
  await db.insert(contactTags).values(tagIds.map((tagId) => ({ contactId, tagId })))
}

async function resolveTags(db: Db, workspaceId: string, tagIds?: string[], tagNames?: string[]) {
  const ids = new Set(tagIds ?? [])
  for (const name of tagNames ?? []) {
    const tag = await findOrCreateTag(db, workspaceId, name)
    ids.add(tag.id)
  }
  if (!ids.size) return []
  const rows = await db
    .select({ id: tags.id })
    .from(tags)
    .where(and(eq(tags.workspaceId, workspaceId), inArray(tags.id, [...ids])))
  if (rows.length !== ids.size) throw new AppError(400, 'Unknown tag')
  return rows.map((row) => row.id)
}

async function findOrCreateTag(db: Db, workspaceId: string, name: string, color?: string | null) {
  const trimmed = name.trim()
  const [existing] = await db
    .select()
    .from(tags)
    .where(and(eq(tags.workspaceId, workspaceId), ilike(tags.name, trimmed)))
    .limit(1)
  if (existing) return existing
  try {
    const [created] = await db
      .insert(tags)
      .values({ workspaceId, name: trimmed, color: color ?? null })
      .returning()
    if (!created) throw new AppError(500, 'Could not create the tag')
    return created
  } catch (error) {
    if (!isUniqueViolation(error)) throw error
    const [again] = await db
      .select()
      .from(tags)
      .where(and(eq(tags.workspaceId, workspaceId), eq(tags.name, trimmed)))
      .limit(1)
    if (!again) throw error
    return again
  }
}

async function assertSameWorkspaceContact(db: Db, workspaceId: string, contactId: string, selfId?: string) {
  if (!isUuid(contactId)) throw new AppError(400, 'Invalid contact')
  if (selfId && contactId === selfId) throw new AppError(400, 'A contact cannot introduce itself')
  const [row] = await db
    .select({ id: contacts.id })
    .from(contacts)
    .where(and(eq(contacts.id, contactId), eq(contacts.workspaceId, workspaceId), isNull(contacts.deletedAt)))
    .limit(1)
  if (!row) throw new AppError(400, 'Introduced-by contact was not found')
}

async function loadBundle(db: Db, contactId: string) {
  if (!isUuid(contactId)) throw new AppError(400, 'Invalid contact')
  const [contact] = await db.select().from(contacts).where(and(eq(contacts.id, contactId), isNull(contacts.deletedAt))).limit(1)
  if (!contact) throw new AppError(404, 'Contact not found')
  const methods = await db.select().from(contactMethods).where(eq(contactMethods.contactId, contactId)).orderBy(asc(contactMethods.sortOrder))
  const addressRows = await db.select().from(addresses).where(eq(addresses.contactId, contactId)).orderBy(asc(addresses.sortOrder))
  const tagRows = await db
    .select({ id: tags.id, name: tags.name, color: tags.color })
    .from(contactTags)
    .innerJoin(tags, eq(tags.id, contactTags.tagId))
    .where(eq(contactTags.contactId, contactId))
    .orderBy(asc(tags.name))
  const resources = await db
    .select()
    .from(contactResources)
    .where(and(eq(contactResources.contactId, contactId), isNull(contactResources.deletedAt)))
    .orderBy(desc(contactResources.updatedAt))
  const bookRows = resources.length
    ? await db
        .select()
        .from(addressBooks)
        .where(and(inArray(addressBooks.id, resources.map((resource) => resource.addressBookId)), isNull(addressBooks.deletedAt)))
    : []
  const liveResources = resources.filter((resource) => bookRows.some((item) => item.id === resource.addressBookId))
  return { contact, methods, addresses: addressRows, tags: tagRows, resource: liveResources[0] ?? resources[0], book: bookRows[0], books: bookRows }
}

function presentContact(bundle: Bundle) {
  const { contact, methods, addresses: addressRows, tags: tagRows, resource, book, books } = bundle
  return {
    id: contact.id,
    workspaceId: contact.workspaceId,
    type: contact.type,
    prefix: contact.prefix,
    firstName: contact.firstName,
    middleName: contact.middleName,
    lastName: contact.lastName,
    suffix: contact.suffix,
    preferredName: contact.preferredName,
    nickname: contact.nickname,
    displayName: contact.displayName,
    organizationName: contact.organizationName,
    department: contact.department,
    title: contact.title,
    position: contact.position,
    birthday: contact.birthday,
    anniversary: contact.anniversary,
    website: contact.website,
    cardNote: contact.cardNote,
    howWeMet: contact.howWeMet,
    introducedByContactId: contact.introducedByContactId,
    preferredCommunication: contact.preferredCommunication,
    interests: contact.interests,
    personalDetails: contact.personalDetails,
    professionalBackground: contact.professionalBackground,
    followUpFrequency: contact.followUpFrequency,
    hasPhoto: Boolean(contact.photoAttachmentId),
    photoAttachmentId: contact.photoAttachmentId,
    addressBookId: book?.id ?? null,
    addressBookName: book?.name ?? null,
    addressBooks: books.map((item) => ({ id: item.id, name: item.name })),
    uid: resource?.uid ?? null,
    etag: resource?.etag ?? null,
    createdAt: contact.createdAt.toISOString(),
    updatedAt: contact.updatedAt.toISOString(),
    methods: methods.map((method) => ({
      id: method.id,
      kind: method.kind,
      label: method.label,
      value: method.value,
      isPrimary: method.isPrimary,
    })),
    addresses: addressRows.map((row) => ({
      id: row.id,
      label: row.label,
      street: row.street,
      street2: row.street2,
      city: row.city,
      region: row.region,
      postalCode: row.postalCode,
      country: row.country,
    })),
    tags: tagRows,
  }
}

async function syncResources(
  db: Db,
  contactId: string,
  options?: { bookId?: string; bookIds?: string[]; uid?: string; unknown?: string[]; deleted?: boolean },
) {
  const [contact] = await db.select().from(contacts).where(eq(contacts.id, contactId)).limit(1)
  if (!contact) throw new AppError(404, 'Contact not found')
  const methods = await db.select().from(contactMethods).where(eq(contactMethods.contactId, contactId)).orderBy(asc(contactMethods.sortOrder))
  const addressRows = await db.select().from(addresses).where(eq(addresses.contactId, contactId)).orderBy(asc(addresses.sortOrder))
  let resources = await db.select().from(contactResources).where(eq(contactResources.contactId, contactId))
  if (options?.bookIds?.length) {
    for (const bookId of options.bookIds) {
      if (resources.some((resource) => resource.addressBookId === bookId)) continue
      await db.insert(contactResources).values({
        contactId,
        addressBookId: bookId,
        uid: options.uid && bookId === options.bookId ? options.uid : randomUUID(),
        etag: 'pending',
        vcardText: '',
        unknownProperties: options.unknown ?? [],
      })
    }
    resources = await db.select().from(contactResources).where(eq(contactResources.contactId, contactId))
  } else if (!resources.length) {
    if (!options?.bookId) throw new AppError(500, 'Contact is missing an address book')
    const uid = options.uid ?? randomUUID()
    await db.insert(contactResources).values({
      contactId,
      addressBookId: options.bookId,
      uid,
      etag: 'pending',
      vcardText: '',
      unknownProperties: options.unknown ?? [],
    })
    resources = await db.select().from(contactResources).where(eq(contactResources.contactId, contactId))
  }
  const bookIds = [...new Set(resources.map((resource) => resource.addressBookId))].sort()
  let primary: { etag: string; uid: string } | undefined
  for (const bookId of bookIds) {
    const [book] = await db.select().from(addressBooks).where(eq(addressBooks.id, bookId)).for('update').limit(1)
    if (!book) continue
    const bookResources = resources.filter((resource) => resource.addressBookId === bookId)
    for (const resource of bookResources) {
      const uid = options?.uid && resource.addressBookId === options.bookId ? options.uid : resource.uid
      const unknown = options?.unknown && (resource.uid === uid || resource.addressBookId === options.bookId)
        ? options.unknown
        : (resource.unknownProperties ?? [])
      const now = new Date()
      const next = book.syncToken + 1
      const removed = Boolean(options?.bookIds && !options.bookIds.includes(bookId))
      if (removed && resource.deletedAt) continue
      if (options?.deleted || removed) {
        await db
          .update(contactResources)
          .set({ deletedAt: now, updatedAt: now })
          .where(eq(contactResources.id, resource.id))
        await db.update(addressBooks).set({ syncToken: next, updatedAt: now }).where(eq(addressBooks.id, book.id))
        book.syncToken = next
        await db.insert(addressBookChanges).values({ addressBookId: book.id, syncToken: next, uid: resource.uid, deleted: true })
        primary = { etag: resource.etag, uid: resource.uid }
        continue
      }
      const parsed = toParsed(contact, methods, addressRows, uid, unknown)
      const vcardText = serializeVcard(parsed)
      const etag = makeEtag(vcardText)
      await db
        .update(contactResources)
        .set({ uid, etag, vcardText, unknownProperties: unknown, updatedAt: now, deletedAt: null })
        .where(eq(contactResources.id, resource.id))
      await db.update(addressBooks).set({ syncToken: next, updatedAt: now }).where(eq(addressBooks.id, book.id))
      book.syncToken = next
      await db.insert(addressBookChanges).values({ addressBookId: book.id, syncToken: next, uid, deleted: false })
      primary = { etag, uid }
    }
  }
  if (!primary) throw new AppError(500, 'Could not update the contact card')
  return primary
}

function toParsed(
  contact: typeof contacts.$inferSelect,
  methods: Array<typeof contactMethods.$inferSelect>,
  addressRows: Array<typeof addresses.$inferSelect>,
  uid: string,
  unknown: string[],
): ParsedCard {
  return {
    uid,
    fn: contact.displayName,
    n: {
      last: contact.lastName ?? '',
      first: contact.firstName ?? '',
      middle: contact.middleName ?? '',
      prefix: contact.prefix ?? '',
      suffix: contact.suffix ?? '',
    },
    nickname: contact.nickname ?? undefined,
    organization: contact.organizationName ?? undefined,
    department: contact.department ?? undefined,
    title: contact.title ?? undefined,
    position: contact.position ?? undefined,
    note: contact.cardNote ?? undefined,
    url: contact.website ?? undefined,
    birthday: contact.birthday ?? undefined,
    anniversary: contact.anniversary ?? undefined,
    emails: methods.filter((method) => method.kind === 'email').map((method) => ({ label: method.label, value: method.value })),
    phones: methods.filter((method) => method.kind === 'phone').map((method) => ({ label: method.label, value: method.value })),
    addresses: addressRows.map((row) => ({
      label: row.label,
      street: row.street,
      street2: row.street2,
      city: row.city,
      region: row.region,
      postalCode: row.postalCode,
      country: row.country,
    })),
    unknown,
  }
}

async function recordAudit(db: Db, workspaceId: string, actorId: string, action: string, entityId: string) {
  await db.insert(auditLogs).values({ workspaceId, actorId, action, entityType: 'contact', entityId })
}

function isUniqueViolation(error: unknown) {
  const candidate = error as { code?: string; cause?: { code?: string } }
  return candidate.code === '23505' || candidate.cause?.code === '23505'
}
