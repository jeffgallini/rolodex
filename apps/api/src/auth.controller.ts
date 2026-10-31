import {
  AppError,
  appPasswordSchema,
  beginOauth,
  createAppPassword,
  deletePushSubscription,
  exchangeOauthCode,
  finishOauth,
  listAppPasswords,
  loginSchema,
  loginUser,
  logoutUser,
  oauthExchangeSchema,
  parseBody,
  publicOauth,
  pushPublic,
  pushSubscriptionSchema,
  acceptInvite,
  passwordResetSchema,
  previewInvite,
  registrationPolicy,
  registerSchema,
  registerUser,
  resetPassword,
  revokeAppPassword,
  savePushSubscription,
} from '@rolodex/core'
import type { Database } from '@rolodex/db'
import { Body, Controller, Delete, Get, Inject, Param, Post, Query, Req, Res, UseGuards } from '@nestjs/common'
import type { Response } from 'express'
import { AuthGuard, clearSessionCookie, DB, loginLimiter, sessionCookie, type AuthedRequest } from './http'

@Controller()
export class AuthController {
  constructor(@Inject(DB) private readonly db: Database) {}

  @Get('health')
  health() {
    return { ok: true }
  }

  @Get('auth/registration')
  registration() {
    return registrationPolicy(this.db)
  }

  @Get('auth/invites/preview')
  invitePreview(@Query('token') token: string | undefined) {
    return previewInvite(this.db, token ?? '')
  }

  @Post('auth/reset')
  reset(@Body() body: unknown, @Req() req: AuthedRequest) {
    if (!loginLimiter(req.ip || 'local')) throw new AppError(429, 'Too many attempts. Try again in a minute.')
    return resetPassword(this.db, parseBody(passwordResetSchema, body))
  }

  @Post('auth/register')
  async register(@Body() body: unknown, @Req() req: AuthedRequest, @Res({ passthrough: true }) res: Response) {
    if (!loginLimiter(req.ip || 'local')) throw new AppError(429, 'Too many attempts. Try again in a minute.')
    const input = parseBody(registerSchema, body)
    if (!input.invite && (await registrationPolicy(this.db)).inviteOnly) throw new AppError(403, 'Registration requires an invitation')
    const result = input.invite ? await acceptInvite(this.db, input) : await registerUser(this.db, input)
    res.setHeader('Set-Cookie', sessionCookie(result.token, 30 * 24 * 60 * 60))
    return result
  }

  @Get('auth/oauth')
  oauth() {
    return publicOauth(this.db)
  }

  @Get('auth/oauth/start')
  async startOauth(@Query('client') client: string | undefined, @Res() res: Response) {
    const location = await beginOauth(this.db, client === 'mobile' ? 'mobile' : 'web')
    res.redirect(location)
  }

  @Get('auth/oauth/callback')
  async oauthCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Res() res: Response,
  ) {
    const location = await finishOauth(this.db, { code: code ?? '', state: state ?? '', error: error ?? '' })
    res.redirect(location)
  }

  @Post('auth/oauth/exchange')
  async exchangeOauth(@Body() body: unknown, @Res({ passthrough: true }) res: Response) {
    const input = parseBody(oauthExchangeSchema, body)
    const result = await exchangeOauthCode(this.db, input.code)
    res.setHeader('Set-Cookie', sessionCookie(result.token, 30 * 24 * 60 * 60))
    return result
  }

  @Get('notifications/push')
  @UseGuards(AuthGuard)
  push(@Req() _req: AuthedRequest) {
    return pushPublic(this.db)
  }

  @Post('notifications/push')
  @UseGuards(AuthGuard)
  subscribePush(@Req() req: AuthedRequest, @Body() body: unknown) {
    return savePushSubscription(this.db, req.user.id, parseBody(pushSubscriptionSchema, body))
  }

  @Delete('notifications/push')
  @UseGuards(AuthGuard)
  unsubscribePush(@Req() req: AuthedRequest, @Body() body: unknown) {
    const input = parseBody(pushSubscriptionSchema.pick({ endpoint: true }), body)
    return deletePushSubscription(this.db, req.user.id, input.endpoint)
  }

  @Post('auth/login')
  async login(@Body() body: unknown, @Req() req: AuthedRequest, @Res({ passthrough: true }) res: Response) {
    if (!loginLimiter(req.ip || 'local')) throw new AppError(429, 'Too many attempts. Try again in a minute.')
    const input = parseBody(loginSchema, body)
    const result = await loginUser(this.db, input.email, input.password)
    res.setHeader('Set-Cookie', sessionCookie(result.token, 30 * 24 * 60 * 60))
    return result
  }

  @Post('auth/logout')
  @UseGuards(AuthGuard)
  async logout(@Req() req: AuthedRequest, @Res({ passthrough: true }) res: Response) {
    await logoutUser(this.db, req.token)
    res.setHeader('Set-Cookie', clearSessionCookie())
    return { ok: true }
  }

  @Get('auth/me')
  @UseGuards(AuthGuard)
  me(@Req() req: AuthedRequest) {
    return {
      user: req.user,
      carddavUrl: process.env.PUBLIC_CARDDAV_URL || 'http://localhost:3001',
    }
  }

  @Get('app-passwords')
  @UseGuards(AuthGuard)
  listPasswords(@Req() req: AuthedRequest) {
    return listAppPasswords(this.db, req.user.id)
  }

  @Post('app-passwords')
  @UseGuards(AuthGuard)
  createPassword(@Req() req: AuthedRequest, @Body() body: unknown) {
    const input = parseBody(appPasswordSchema, body)
    return createAppPassword(this.db, req.user.id, input.label)
  }

  @Delete('app-passwords/:id')
  @UseGuards(AuthGuard)
  async revokePassword(@Req() req: AuthedRequest, @Param('id') id: string) {
    await revokeAppPassword(this.db, req.user.id, id)
    return { ok: true }
  }
}
