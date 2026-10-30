import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  addMember,
  addressBookSchema,
  contactSchema,
  createAddressBook,
  createContact,
  createTag,
  createWorkspace,
  deleteAddressBook,
  deleteContact,
  exportAddressBook,
  getContact,
  importAddressBook,
  importSchema,
  listAddressBooks,
  listContacts,
  listMembers,
  listTags,
  listWorkspaces,
  memberRoleSchema,
  memberSchema,
  parseBody,
  removeMember,
  setContactPhoto,
  tagSchema,
  updateAddressBook,
  updateContact,
  updateMemberRole,
  workspaceSchema,
  AppError,
} from '@rolodex/core'
import { attachments, type Database } from '@rolodex/db'
import { and, eq } from 'drizzle-orm'
import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import type { Response } from 'express'
import { AuthGuard, DB, STORAGE, type AuthedRequest } from './http'
import { deleteObject, getObject, photoKey, putObject, type objectStorage } from './storage'

type Storage = ReturnType<typeof objectStorage>

const images = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

@Controller()
@UseGuards(AuthGuard)
export class DataController {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(STORAGE) private readonly storage: Storage,
  ) {}

  @Get('workspaces')
  workspaces(@Req() req: AuthedRequest) {
    return listWorkspaces(this.db, req.user.id)
  }

  @Post('workspaces')
  async createWorkspace(@Req() req: AuthedRequest, @Body() body: unknown) {
    const input = parseBody(workspaceSchema, body)
    const workspace = await createWorkspace(this.db, req.user.id, input.name)
    const book = await createAddressBook(this.db, req.user.id, workspace.id, 'Contacts')
    return { ...workspace, addressBookId: book.id }
  }

  @Get('workspaces/:workspaceId/members')
  members(@Req() req: AuthedRequest, @Param('workspaceId') workspaceId: string) {
    return listMembers(this.db, req.user.id, workspaceId)
  }

  @Post('workspaces/:workspaceId/members')
  addMember(@Req() req: AuthedRequest, @Param('workspaceId') workspaceId: string, @Body() body: unknown) {
    const input = parseBody(memberSchema, body)
    return addMember(this.db, req.user.id, workspaceId, input.email, input.role)
  }

  @Patch('workspaces/:workspaceId/members/:memberId')
  updateMember(
    @Req() req: AuthedRequest,
    @Param('workspaceId') workspaceId: string,
    @Param('memberId') memberId: string,
    @Body() body: unknown,
  ) {
    const input = parseBody(memberRoleSchema, body)
    return updateMemberRole(this.db, req.user.id, workspaceId, memberId, input.role)
  }

  @Delete('workspaces/:workspaceId/members/:memberId')
  async removeMember(
    @Req() req: AuthedRequest,
    @Param('workspaceId') workspaceId: string,
    @Param('memberId') memberId: string,
  ) {
    await removeMember(this.db, req.user.id, workspaceId, memberId)
    return { ok: true }
  }

  @Get('workspaces/:workspaceId/tags')
  tags(@Req() req: AuthedRequest, @Param('workspaceId') workspaceId: string) {
    return listTags(this.db, req.user.id, workspaceId)
  }

  @Post('workspaces/:workspaceId/tags')
  createTag(@Req() req: AuthedRequest, @Param('workspaceId') workspaceId: string, @Body() body: unknown) {
    const input = parseBody(tagSchema, body)
    return createTag(this.db, req.user.id, workspaceId, input.name, input.color)
  }

  @Get('workspaces/:workspaceId/contacts')
  contacts(
    @Req() req: AuthedRequest,
    @Param('workspaceId') workspaceId: string,
    @Query('q') q?: string,
    @Query('addressBookId') addressBookId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return listContacts(this.db, req.user.id, workspaceId, {
      q,
      addressBookId,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    })
  }

  @Get('search')
  search(@Req() req: AuthedRequest, @Query('workspaceId') workspaceId?: string, @Query('q') q?: string) {
    if (!workspaceId) throw new AppError(400, 'workspaceId is required')
    return listContacts(this.db, req.user.id, workspaceId, { q })
  }

  @Post('workspaces/:workspaceId/contacts')
  createContact(@Req() req: AuthedRequest, @Param('workspaceId') workspaceId: string, @Body() body: unknown) {
    return createContact(this.db, req.user.id, workspaceId, parseBody(contactSchema, body))
  }

  @Get('workspaces/:workspaceId/contacts/:contactId')
  contact(@Req() req: AuthedRequest, @Param('workspaceId') workspaceId: string, @Param('contactId') contactId: string) {
    return getContact(this.db, req.user.id, workspaceId, contactId)
  }

  @Patch('workspaces/:workspaceId/contacts/:contactId')
  updateContact(
    @Req() req: AuthedRequest,
    @Param('workspaceId') workspaceId: string,
    @Param('contactId') contactId: string,
    @Body() body: unknown,
  ) {
    return updateContact(this.db, req.user.id, workspaceId, contactId, parseBody(contactSchema, body))
  }

  @Delete('workspaces/:workspaceId/contacts/:contactId')
  async deleteContact(
    @Req() req: AuthedRequest,
    @Param('workspaceId') workspaceId: string,
    @Param('contactId') contactId: string,
  ) {
    await deleteContact(this.db, req.user.id, workspaceId, contactId)
    return { ok: true }
  }

  @Post('workspaces/:workspaceId/contacts/:contactId/photo')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 8 * 1024 * 1024 } }))
  async uploadPhoto(
    @Req() req: AuthedRequest,
    @Param('workspaceId') workspaceId: string,
    @Param('contactId') contactId: string,
    @UploadedFile() file?: { mimetype: string; buffer: Buffer; originalname: string; size: number },
  ) {
    if (!file) throw new AppError(400, 'Choose an image file')
    if (!images.has(file.mimetype)) throw new AppError(400, 'Use a JPEG, PNG, WebP, or GIF image')
    const contact = await getContact(this.db, req.user.id, workspaceId, contactId)
    const key = photoKey(workspaceId, contactId, file.originalname)
    await putObject(this.storage, key, file.buffer, file.mimetype)
    const [attachment] = await this.db
      .insert(attachments)
      .values({
        workspaceId,
        ownerId: req.user.id,
        storageKey: key,
        filename: file.originalname || 'photo',
        contentType: file.mimetype,
        sizeBytes: file.size,
      })
      .returning()
    if (!attachment) throw new AppError(500, 'Could not store the photo')
    const previous = contact.photoAttachmentId
    await setContactPhoto(this.db, req.user.id, workspaceId, contactId, attachment.id)
    if (previous) await this.removeAttachment(previous)
    return { ok: true }
  }

  @Get('workspaces/:workspaceId/contacts/:contactId/photo')
  async photo(
    @Req() req: AuthedRequest,
    @Param('workspaceId') workspaceId: string,
    @Param('contactId') contactId: string,
    @Res() res: Response,
  ) {
    const contact = await getContact(this.db, req.user.id, workspaceId, contactId)
    if (!contact.photoAttachmentId) throw new AppError(404, 'No photo')
    const [attachment] = await this.db.select().from(attachments).where(eq(attachments.id, contact.photoAttachmentId)).limit(1)
    if (!attachment) throw new AppError(404, 'No photo')
    const object = await getObject(this.storage, attachment.storageKey)
    res.setHeader('Content-Type', object.contentType)
    res.setHeader('Cache-Control', 'private, max-age=300')
    res.send(object.bytes)
  }

  @Delete('workspaces/:workspaceId/contacts/:contactId/photo')
  async deletePhoto(
    @Req() req: AuthedRequest,
    @Param('workspaceId') workspaceId: string,
    @Param('contactId') contactId: string,
  ) {
    const contact = await getContact(this.db, req.user.id, workspaceId, contactId)
    await setContactPhoto(this.db, req.user.id, workspaceId, contactId, null)
    if (contact.photoAttachmentId) await this.removeAttachment(contact.photoAttachmentId)
    return { ok: true }
  }

  @Get('workspaces/:workspaceId/address-books')
  addressBooks(@Req() req: AuthedRequest, @Param('workspaceId') workspaceId: string) {
    return listAddressBooks(this.db, req.user.id, workspaceId)
  }

  @Post('workspaces/:workspaceId/address-books')
  createBook(@Req() req: AuthedRequest, @Param('workspaceId') workspaceId: string, @Body() body: unknown) {
    const input = parseBody(addressBookSchema, body)
    return createAddressBook(this.db, req.user.id, workspaceId, input.name, undefined, input.description)
  }

  @Patch('workspaces/:workspaceId/address-books/:bookId')
  updateBook(
    @Req() req: AuthedRequest,
    @Param('bookId') bookId: string,
    @Body() body: unknown,
  ) {
    const input = parseBody(addressBookSchema.partial(), body)
    return updateAddressBook(this.db, req.user.id, bookId, input)
  }

  @Delete('workspaces/:workspaceId/address-books/:bookId')
  async deleteBook(@Req() req: AuthedRequest, @Param('bookId') bookId: string) {
    await deleteAddressBook(this.db, req.user.id, bookId)
    return { ok: true }
  }

  @Get('workspaces/:workspaceId/address-books/:bookId/export')
  async exportBook(@Req() req: AuthedRequest, @Param('bookId') bookId: string, @Res() res: Response) {
    const file = await exportAddressBook(this.db, req.user.id, bookId)
    res.setHeader('Content-Type', 'text/vcard; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`)
    res.send(file.body)
  }

  @Post('workspaces/:workspaceId/address-books/:bookId/import')
  importBook(@Req() req: AuthedRequest, @Param('bookId') bookId: string, @Body() body: unknown) {
    return importAddressBook(this.db, req.user.id, bookId, parseBody(importSchema, body))
  }

  @Post('backups')
  async backup(@Req() req: AuthedRequest) {
    const workspaces = await listWorkspaces(this.db, req.user.id)
    if (!workspaces.some((workspace) => workspace.role === 'owner')) {
      throw new AppError(403, 'Only an owner can create a backup')
    }
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const dir = join(process.env.BACKUP_DIR || 'backups', stamp)
    await mkdir(dir, { recursive: true })
    await dumpDatabase(join(dir, 'database.sql'))
    return { ok: true, path: dir }
  }

  private async removeAttachment(id: string) {
    const [attachment] = await this.db.select().from(attachments).where(eq(attachments.id, id)).limit(1)
    if (!attachment) return
    await this.db.delete(attachments).where(and(eq(attachments.id, id)))
    try {
      await deleteObject(this.storage, attachment.storageKey)
    } catch (error) {
      console.error('Could not delete stored photo', error)
    }
  }
}

function dumpDatabase(file: string) {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new AppError(500, 'DATABASE_URL is not configured')
  return new Promise<void>((resolve, reject) => {
    const child = spawn('pg_dump', ['--dbname', databaseUrl, '--clean', '--if-exists', '--no-owner'], {
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const chunks: Buffer[] = []
    let errorText = ''
    child.stdout.on('data', (chunk: Buffer) => chunks.push(chunk))
    child.stderr.on('data', (chunk: Buffer) => {
      errorText += chunk.toString()
    })
    child.on('error', () => {
      reject(new AppError(501, 'pg_dump is not available. Run scripts/backup.sh from a host with PostgreSQL client tools.'))
    })
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new AppError(500, errorText.trim() || 'Backup failed'))
        return
      }
      writeFile(file, Buffer.concat(chunks))
        .then(() => resolve())
        .catch(reject)
    })
  })
}
