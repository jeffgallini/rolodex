import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  addHouseholdMember,
  addOrganizationMember,
  agenda,
  addressBookSchema,
  contactSchema,
  contactHouseholds,
  contactOrganizations,
  completeTask,
  completeSchema,
  createActivity,
  createAddressBook,
  createContact,
  createCustomField,
  createHousehold,
  createNote,
  createOrganization,
  createRelationship,
  createReminder,
  createTag,
  createTask,
  createWorkspace,
  customFieldSchema,
  customValueSchema,
  deleteActivity,
  deleteAddressBook,
  deleteContact,
  deleteHousehold,
  deleteNote,
  deleteOrganization,
  deleteRelationship,
  deleteTask,
  exportAddressBook,
  getContact,
  getMapSettings,
  householdMemberSchema,
  householdSchema,
  importAddressBook,
  importSchema,
  listActivities,
  listAddressBooks,
  listBookShares,
  listContacts,
  listCustomFields,
  listHouseholds,
  listMembers,
  listHouseholdNotes,
  listNotes,
  listOrganizations,
  listRelationships,
  listTags,
  listTasks,
  listWorkspaces,
  mapSettingsSchema,
  memberRoleSchema,
  memberSchema,
  noteSchema,
  organizationMemberSchema,
  organizationMembers,
  organizationSchema,
  parseBody,
  placeDetails,
  placeProviders,
  relationshipSchema,
  reminderSchema,
  reverseWorkspacePlace,
  removeHouseholdMember,
  removeOrganizationMember,
  searchPlaces,
  searchWorkspacePlaces,
  activitySchema,
  addMember,
  removeMember,
  setContactPhoto,
  setCustomValue,
  shareAddressBook,
  tagSchema,
  taskSchema,
  updateAddressBook,
  updateContact,
  updateHousehold,
  updateOrganization,
  updateMapSettings,
  unshareAddressBook,
  updateMemberRole,
  workspacePlaceDetails,
  workspaceSchema,
  AppError,
  createRateLimiter,
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
  Put,
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
const placeLimiter = createRateLimiter(30, 60_000)

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

  @Get('places')
  places(@Req() req: AuthedRequest, @Query('q') q = '', @Query('provider') provider = 'osm') {
    if (!placeLimiter(req.user.id)) throw new AppError(429, 'Too many address searches. Wait a moment.')
    return searchPlaces(q, provider === 'google' ? 'google' : 'osm')
  }

  @Get('places/providers')
  providers() {
    return placeProviders()
  }

  @Get('places/google/:placeId')
  googlePlace(@Param('placeId') placeId: string) {
    return placeDetails('google', placeId)
  }

  @Get('workspaces/:workspaceId/map')
  mapSettings(@Req() req: AuthedRequest, @Param('workspaceId') workspaceId: string) {
    return getMapSettings(this.db, req.user.id, workspaceId)
  }

  @Put('workspaces/:workspaceId/map')
  saveMap(@Req() req: AuthedRequest, @Param('workspaceId') workspaceId: string, @Body() body: unknown) {
    const input = parseBody(mapSettingsSchema, body)
    return updateMapSettings(this.db, req.user.id, workspaceId, {
      engine: input.engine,
      templateId: input.templateId ?? 'osm',
      tileUrl: input.tileUrl ?? '',
      cartoKey: input.cartoKey ?? '',
      mapboxToken: input.mapboxToken ?? '',
      googleKey: input.googleKey ?? '',
    })
  }

  @Get('workspaces/:workspaceId/places')
  workspacePlaces(@Req() req: AuthedRequest, @Param('workspaceId') workspaceId: string, @Query('q') q = '') {
    if (!placeLimiter(req.user.id)) throw new AppError(429, 'Too many address searches. Wait a moment.')
    return searchWorkspacePlaces(this.db, req.user.id, workspaceId, q)
  }

  @Get('workspaces/:workspaceId/places/details')
  workspacePlace(@Req() req: AuthedRequest, @Param('workspaceId') workspaceId: string, @Query('id') id = '') {
    if (!placeLimiter(req.user.id)) throw new AppError(429, 'Too many address searches. Wait a moment.')
    return workspacePlaceDetails(this.db, req.user.id, workspaceId, id)
  }

  @Get('workspaces/:workspaceId/places/reverse')
  reversePlace(@Req() req: AuthedRequest, @Param('workspaceId') workspaceId: string, @Query('lat') lat = '', @Query('lon') lon = '') {
    if (!placeLimiter(req.user.id)) throw new AppError(429, 'Too many address searches. Wait a moment.')
    return reverseWorkspacePlace(this.db, req.user.id, workspaceId, Number(lat), Number(lon))
  }

  @Get('workspaces/:workspaceId/agenda')
  workspaceAgenda(@Req() req: AuthedRequest, @Param('workspaceId') workspaceId: string) {
    return agenda(this.db, req.user.id, workspaceId)
  }

  @Get('workspaces/:workspaceId/contacts/:contactId/relationships')
  relationships(@Req() req: AuthedRequest, @Param('workspaceId') workspaceId: string, @Param('contactId') contactId: string) {
    return listRelationships(this.db, req.user.id, workspaceId, contactId)
  }

  @Post('workspaces/:workspaceId/contacts/:contactId/relationships')
  addRelationship(@Req() req: AuthedRequest, @Param('workspaceId') workspaceId: string, @Param('contactId') contactId: string, @Body() body: unknown) {
    return createRelationship(this.db, req.user.id, workspaceId, contactId, parseBody(relationshipSchema, body))
  }

  @Delete('workspaces/:workspaceId/relationships/:relationshipId')
  async removeRelationship(@Req() req: AuthedRequest, @Param('workspaceId') workspaceId: string, @Param('relationshipId') relationshipId: string) {
    await deleteRelationship(this.db, req.user.id, workspaceId, relationshipId)
    return { ok: true }
  }

  @Get('workspaces/:workspaceId/households')
  households(@Req() req: AuthedRequest, @Param('workspaceId') workspaceId: string) {
    return listHouseholds(this.db, req.user.id, workspaceId)
  }

  @Post('workspaces/:workspaceId/households')
  addHousehold(@Req() req: AuthedRequest, @Param('workspaceId') workspaceId: string, @Body() body: unknown) {
    return createHousehold(this.db, req.user.id, workspaceId, parseBody(householdSchema, body))
  }

  @Patch('workspaces/:workspaceId/households/:householdId')
  editHousehold(@Req() req: AuthedRequest, @Param('workspaceId') workspaceId: string, @Param('householdId') householdId: string, @Body() body: unknown) {
    return updateHousehold(this.db, req.user.id, workspaceId, householdId, parseBody(householdSchema, body))
  }

  @Delete('workspaces/:workspaceId/households/:householdId')
  async removeHousehold(@Req() req: AuthedRequest, @Param('workspaceId') workspaceId: string, @Param('householdId') householdId: string) {
    await deleteHousehold(this.db, req.user.id, workspaceId, householdId)
    return { ok: true }
  }

  @Post('workspaces/:workspaceId/households/:householdId/members')
  addToHousehold(@Req() req: AuthedRequest, @Param('workspaceId') workspaceId: string, @Param('householdId') householdId: string, @Body() body: unknown) {
    return addHouseholdMember(this.db, req.user.id, workspaceId, householdId, parseBody(householdMemberSchema, body))
  }

  @Delete('workspaces/:workspaceId/households/:householdId/members/:contactId')
  async removeFromHousehold(
    @Req() req: AuthedRequest,
    @Param('workspaceId') workspaceId: string,
    @Param('householdId') householdId: string,
    @Param('contactId') contactId: string,
  ) {
    await removeHouseholdMember(this.db, req.user.id, workspaceId, householdId, contactId)
    return { ok: true }
  }

  @Get('workspaces/:workspaceId/contacts/:contactId/households')
  personHouseholds(@Req() req: AuthedRequest, @Param('workspaceId') workspaceId: string, @Param('contactId') contactId: string) {
    return contactHouseholds(this.db, req.user.id, workspaceId, contactId)
  }

  @Get('workspaces/:workspaceId/organizations')
  organizations(@Req() req: AuthedRequest, @Param('workspaceId') workspaceId: string) {
    return listOrganizations(this.db, req.user.id, workspaceId)
  }

  @Post('workspaces/:workspaceId/organizations')
  addOrganization(@Req() req: AuthedRequest, @Param('workspaceId') workspaceId: string, @Body() body: unknown) {
    return createOrganization(this.db, req.user.id, workspaceId, parseBody(organizationSchema, body))
  }

  @Patch('workspaces/:workspaceId/organizations/:organizationId')
  editOrganization(@Req() req: AuthedRequest, @Param('workspaceId') workspaceId: string, @Param('organizationId') organizationId: string, @Body() body: unknown) {
    return updateOrganization(this.db, req.user.id, workspaceId, organizationId, parseBody(organizationSchema, body))
  }

  @Delete('workspaces/:workspaceId/organizations/:organizationId')
  async removeOrganization(@Req() req: AuthedRequest, @Param('workspaceId') workspaceId: string, @Param('organizationId') organizationId: string) {
    await deleteOrganization(this.db, req.user.id, workspaceId, organizationId)
    return { ok: true }
  }

  @Get('workspaces/:workspaceId/organizations/:organizationId/members')
  orgMembers(@Req() req: AuthedRequest, @Param('workspaceId') workspaceId: string, @Param('organizationId') organizationId: string) {
    return organizationMembers(this.db, req.user.id, workspaceId, organizationId)
  }

  @Post('workspaces/:workspaceId/organizations/:organizationId/members')
  addToOrganization(@Req() req: AuthedRequest, @Param('workspaceId') workspaceId: string, @Param('organizationId') organizationId: string, @Body() body: unknown) {
    return addOrganizationMember(this.db, req.user.id, workspaceId, organizationId, parseBody(organizationMemberSchema, body))
  }

  @Delete('workspaces/:workspaceId/organizations/:organizationId/members/:contactId')
  async removeFromOrganization(
    @Req() req: AuthedRequest,
    @Param('workspaceId') workspaceId: string,
    @Param('organizationId') organizationId: string,
    @Param('contactId') contactId: string,
  ) {
    await removeOrganizationMember(this.db, req.user.id, workspaceId, organizationId, contactId)
    return { ok: true }
  }

  @Get('workspaces/:workspaceId/contacts/:contactId/organizations')
  personOrganizations(@Req() req: AuthedRequest, @Param('workspaceId') workspaceId: string, @Param('contactId') contactId: string) {
    return contactOrganizations(this.db, req.user.id, workspaceId, contactId)
  }

  @Get('workspaces/:workspaceId/contacts/:contactId/notes')
  notes(@Req() req: AuthedRequest, @Param('workspaceId') workspaceId: string, @Param('contactId') contactId: string) {
    return listNotes(this.db, req.user.id, workspaceId, contactId)
  }

  @Get('workspaces/:workspaceId/households/:householdId/notes')
  householdNotes(@Req() req: AuthedRequest, @Param('workspaceId') workspaceId: string, @Param('householdId') householdId: string) {
    return listHouseholdNotes(this.db, req.user.id, workspaceId, householdId)
  }

  @Post('workspaces/:workspaceId/notes')
  addNote(@Req() req: AuthedRequest, @Param('workspaceId') workspaceId: string, @Body() body: unknown) {
    return createNote(this.db, req.user.id, workspaceId, parseBody(noteSchema, body))
  }

  @Delete('workspaces/:workspaceId/notes/:noteId')
  async removeNote(@Req() req: AuthedRequest, @Param('workspaceId') workspaceId: string, @Param('noteId') noteId: string) {
    await deleteNote(this.db, req.user.id, workspaceId, noteId)
    return { ok: true }
  }

  @Get('workspaces/:workspaceId/activities')
  activities(@Req() req: AuthedRequest, @Param('workspaceId') workspaceId: string, @Query('contactId') contactId?: string) {
    return listActivities(this.db, req.user.id, workspaceId, contactId)
  }

  @Post('workspaces/:workspaceId/activities')
  addActivity(@Req() req: AuthedRequest, @Param('workspaceId') workspaceId: string, @Body() body: unknown) {
    return createActivity(this.db, req.user.id, workspaceId, parseBody(activitySchema, body))
  }

  @Delete('workspaces/:workspaceId/activities/:activityId')
  async removeActivity(@Req() req: AuthedRequest, @Param('workspaceId') workspaceId: string, @Param('activityId') activityId: string) {
    await deleteActivity(this.db, req.user.id, workspaceId, activityId)
    return { ok: true }
  }

  @Get('workspaces/:workspaceId/tasks')
  tasks(@Req() req: AuthedRequest, @Param('workspaceId') workspaceId: string, @Query('contactId') contactId?: string) {
    return listTasks(this.db, req.user.id, workspaceId, contactId)
  }

  @Post('workspaces/:workspaceId/tasks')
  addTask(@Req() req: AuthedRequest, @Param('workspaceId') workspaceId: string, @Body() body: unknown) {
    return createTask(this.db, req.user.id, workspaceId, parseBody(taskSchema, body))
  }

  @Post('workspaces/:workspaceId/tasks/:taskId/complete')
  finishTask(@Req() req: AuthedRequest, @Param('workspaceId') workspaceId: string, @Param('taskId') taskId: string, @Body() body: unknown) {
    const input = parseBody(completeSchema, body)
    return completeTask(this.db, req.user.id, workspaceId, taskId, input.completed)
  }

  @Delete('workspaces/:workspaceId/tasks/:taskId')
  async removeTask(@Req() req: AuthedRequest, @Param('workspaceId') workspaceId: string, @Param('taskId') taskId: string) {
    await deleteTask(this.db, req.user.id, workspaceId, taskId)
    return { ok: true }
  }

  @Post('workspaces/:workspaceId/reminders')
  addReminder(@Req() req: AuthedRequest, @Param('workspaceId') workspaceId: string, @Body() body: unknown) {
    return createReminder(this.db, req.user.id, workspaceId, parseBody(reminderSchema, body))
  }

  @Get('workspaces/:workspaceId/contacts/:contactId/fields')
  fields(@Req() req: AuthedRequest, @Param('workspaceId') workspaceId: string, @Param('contactId') contactId: string) {
    return listCustomFields(this.db, req.user.id, workspaceId, contactId)
  }

  @Post('workspaces/:workspaceId/fields')
  addField(@Req() req: AuthedRequest, @Param('workspaceId') workspaceId: string, @Body() body: unknown) {
    return createCustomField(this.db, req.user.id, workspaceId, parseBody(customFieldSchema, body))
  }

  @Put('workspaces/:workspaceId/contacts/:contactId/fields/:definitionId')
  saveField(
    @Req() req: AuthedRequest,
    @Param('workspaceId') workspaceId: string,
    @Param('contactId') contactId: string,
    @Param('definitionId') definitionId: string,
    @Body() body: unknown,
  ) {
    return setCustomValue(this.db, req.user.id, workspaceId, contactId, definitionId, parseBody(customValueSchema, body))
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

  @Get('workspaces/:workspaceId/address-books/:bookId/shares')
  bookShares(@Req() req: AuthedRequest, @Param('bookId') bookId: string) {
    return listBookShares(this.db, req.user.id, bookId)
  }

  @Post('workspaces/:workspaceId/address-books/:bookId/shares')
  shareBook(@Req() req: AuthedRequest, @Param('bookId') bookId: string, @Body() body: unknown) {
    const input = parseBody(memberSchema, body)
    return shareAddressBook(this.db, req.user.id, bookId, input.email, input.role)
  }

  @Delete('workspaces/:workspaceId/address-books/:bookId/shares/:memberId')
  async unshareBook(@Req() req: AuthedRequest, @Param('bookId') bookId: string, @Param('memberId') memberId: string) {
    await unshareAddressBook(this.db, req.user.id, bookId, memberId)
    return { ok: true }
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
