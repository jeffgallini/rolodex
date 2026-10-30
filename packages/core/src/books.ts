import { randomUUID } from 'node:crypto'
import { addressBooks, contactResources, workspaceMembers, type Database } from '@rolodex/db'
import { and, asc, eq, isNull } from 'drizzle-orm'
import { defaultWritableWorkspace, requireBook, requireWriter } from './access'
import { cardFingerprint, createContactFromCard, findDuplicates } from './contacts'
import { AppError } from './errors'
import { normalizeEmail, normalizePhone } from './normalize'
import { cardDisplayName, parseVcards, type ParsedCard } from './vcard'

export async function createAddressBook(
  db: Database,
  userId: string,
  workspaceId: string,
  name: string,
  urlSegment?: string,
  description?: string | null,
) {
  await requireWriter(db, userId, workspaceId)
  const id = randomUUID()
  try {
    const [book] = await db
      .insert(addressBooks)
      .values({
        id,
        workspaceId,
        name: name.trim() || 'Untitled',
        description: description ?? null,
        urlSegment: urlSegment?.trim() || id,
      })
      .returning()
    if (!book) throw new AppError(500, 'Could not create the address book')
    return book
  } catch (error) {
    if (isUniqueViolation(error)) throw new AppError(409, 'An address book already uses that address')
    throw error
  }
}

export async function createAddressBookForPrincipal(db: Database, userId: string, name: string, urlSegment: string) {
  const workspaceId = await defaultWritableWorkspace(db, userId)
  return createAddressBook(db, userId, workspaceId, name, urlSegment)
}

export async function listAddressBooks(db: Database, userId: string, workspaceId?: string) {
  const filters = [eq(workspaceMembers.userId, userId), isNull(addressBooks.deletedAt)]
  if (workspaceId) filters.push(eq(addressBooks.workspaceId, workspaceId))
  const rows = await db
    .select({ book: addressBooks, role: workspaceMembers.role })
    .from(addressBooks)
    .innerJoin(workspaceMembers, eq(workspaceMembers.workspaceId, addressBooks.workspaceId))
    .where(and(...filters))
    .orderBy(asc(addressBooks.name))
  return rows.map((row) => ({ ...row.book, role: row.role }))
}

export async function updateAddressBook(
  db: Database,
  userId: string,
  bookId: string,
  input: { name?: string; description?: string | null },
) {
  const { book } = await requireBook(db, userId, bookId, true)
  const [updated] = await db
    .update(addressBooks)
    .set({
      name: input.name?.trim() || book.name,
      description: input.description === undefined ? book.description : input.description,
      updatedAt: new Date(),
    })
    .where(eq(addressBooks.id, book.id))
    .returning()
  return updated
}

export async function deleteAddressBook(db: Database, userId: string, bookId: string) {
  const { book } = await requireBook(db, userId, bookId, true)
  await db.update(addressBooks).set({ deletedAt: new Date(), updatedAt: new Date() }).where(eq(addressBooks.id, book.id))
}

export async function exportAddressBook(db: Database, userId: string, bookId: string) {
  const { book } = await requireBook(db, userId, bookId)
  const rows = await db
    .select({ vcardText: contactResources.vcardText })
    .from(contactResources)
    .where(and(eq(contactResources.addressBookId, book.id), isNull(contactResources.deletedAt)))
  const body = rows
    .map((row) => row.vcardText.trim())
    .filter(Boolean)
    .join('\r\n')
  return {
    filename: `${book.name.replace(/[^\w.-]+/g, '_') || 'contacts'}.vcf`,
    body: body ? `${body}\r\n` : '',
  }
}

export async function importAddressBook(
  db: Database,
  userId: string,
  bookId: string,
  input: { vcf: string; commit?: boolean | undefined; decisions?: { fingerprint: string; action: 'create' | 'skip' }[] | undefined },
) {
  const { book } = await requireBook(db, userId, bookId, input.commit === true)
  const cards = parseVcards(input.vcf)
  const previews = []
  for (const card of cards) {
    const emails = card.emails.map((entry) => normalizeEmail(entry.value)).filter(Boolean)
    const phones = card.phones.map((entry) => normalizePhone(entry.value)).filter(Boolean)
    const duplicates = await findDuplicates(db, book.workspaceId, emails, phones)
    previews.push({
      fingerprint: cardFingerprint(card),
      displayName: cardDisplayName(card),
      emails: card.emails.map((entry) => entry.value),
      phones: card.phones.map((entry) => entry.value),
      duplicates,
    })
  }
  if (!input.commit) return { created: 0, skipped: 0, contacts: previews }
  let created = 0
  let skipped = 0
  for (let index = 0; index < cards.length; index++) {
    const card = cards[index]
    const preview = previews[index]
    if (!card || !preview) continue
    if (preview.duplicates.length) {
      const decision = input.decisions?.find((item) => item.fingerprint === preview.fingerprint)
      if (!decision || decision.action === 'skip') {
        skipped += 1
        continue
      }
    }
    await createContactFromCard(db, userId, book.id, card)
    created += 1
  }
  return { created, skipped, contacts: previews }
}

export function formatSyncToken(bookId: string, token: number) {
  return `http://rolodex/sync/${bookId}/${token}`
}

export function readSyncToken(value: string | null | undefined) {
  if (value == null || value.trim() === '') return null
  const match = value.trim().match(/(\d+)$/)
  if (!match?.[1]) throw new AppError(409, 'Sync token is no longer valid')
  return Number(match[1])
}

function isUniqueViolation(error: unknown) {
  const candidate = error as { code?: string; cause?: { code?: string } }
  return candidate.code === '23505' || candidate.cause?.code === '23505'
}

export type { ParsedCard }
