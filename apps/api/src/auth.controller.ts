import {
  AppError,
  appPasswordSchema,
  createAppPassword,
  listAppPasswords,
  loginSchema,
  loginUser,
  logoutUser,
  parseBody,
  registerSchema,
  registerUser,
  revokeAppPassword,
} from '@rolodex/core'
import type { Database } from '@rolodex/db'
import { Body, Controller, Delete, Get, Inject, Param, Post, Req, Res, UseGuards } from '@nestjs/common'
import type { Response } from 'express'
import { AuthGuard, clearSessionCookie, DB, loginLimiter, sessionCookie, type AuthedRequest } from './http'

@Controller()
export class AuthController {
  constructor(@Inject(DB) private readonly db: Database) {}

  @Get('health')
  health() {
    return { ok: true }
  }

  @Post('auth/register')
  async register(@Body() body: unknown, @Req() req: AuthedRequest, @Res({ passthrough: true }) res: Response) {
    if (!loginLimiter(req.ip || 'local')) throw new AppError(429, 'Too many attempts. Try again in a minute.')
    const input = parseBody(registerSchema, body)
    const result = await registerUser(this.db, input)
    res.setHeader('Set-Cookie', sessionCookie(result.token, 30 * 24 * 60 * 60))
    return result
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
