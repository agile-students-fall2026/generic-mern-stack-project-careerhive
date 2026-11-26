import express from 'express'
import { readFileSync } from 'node:fs'
import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto'

const demo = JSON.parse(readFileSync(new URL('./data/profile.json', import.meta.url), 'utf8'))
const fixtures = JSON.parse(readFileSync(new URL('./data/accounts.json', import.meta.url), 'utf8'))
const cookieName = 'careerhive-session'
const cookieOptions = { httpOnly: true, sameSite: 'lax', path: '/api' }
const resetLifetime = 15 * 60_000
const resendCooldown = 60_000
// shortcut: accounts and sessions last until server restart; MongoDB/JWT belong to Sprint 3.
const sessions = new Map()
const accounts = new Map(fixtures.map(account => [account.email.toLowerCase(), {
  ...passwordCredentials(account.password),
  profile: account.email === demo.email ? structuredClone(demo) : blankProfile(account.name ?? '', account.email),
}]))

function passwordCredentials(password) {
  const salt = randomBytes(16)
  return { salt, hash: scryptSync(password, salt, 32) }
}

function normalizeEmail(email) {
  if (typeof email !== 'string') return null
  const address = email.trim().toLowerCase()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address) ? address : null
}

const validPassword = password => typeof password === 'string' && password.length > 0
const resetDigest = token => createHash('sha256').update(token).digest('hex')

function blankProfile(name = '', email = '') {
  return { id: 'profile-' + randomUUID(), revision: 1, name, email, photo: '', degree: '', major: '',
    school: '', graduationDate: '', skills: [], lookingFor: [], locations: [], workAuthorization: '' }
}

export const guestProfile = blankProfile()
export const auth = express.Router()
const sessionId = req => /(?:^|;\s*)careerhive-session=([^;]*)/.exec(req.headers.cookie ?? '')?.[1]

auth.use((req, res, next) => {
  req.account = sessions.get(sessionId(req))
  next()
})

const resetPaths = ['/forgot-password', '/reset-password']
auth.all(['/signup', '/login', '/logout', ...resetPaths], (req, res, next) => {
  res.set('Cache-Control', 'no-store')
  if (req.method !== 'POST') return res.set('Allow', 'POST').status(405).json({ error: 'Method not allowed' })
  next()
})

function startSession(req, res, account, status) {
  sessions.delete(sessionId(req))
  const id = randomUUID()
  sessions.set(id, account)
  res.cookie(cookieName, id, cookieOptions).status(status).json({ ok: true, profile: account.profile })
}

auth.post(['/signup', '/login'], express.json(), (req, res) => {
  const { name, email, password } = req.body ?? {}
  const address = normalizeEmail(email)
  if (!address || !validPassword(password)
    || (req.path === '/signup' && (typeof name !== 'string' || !name.trim()))) {
    return res.status(400).json({ error: 'Enter a valid name, email and password.' })
  }
  const existing = accounts.get(address)
  if (req.path === '/login') {
    if (!existing || !timingSafeEqual(existing.hash, scryptSync(password, existing.salt, 32))) {
      return res.status(401).json({ error: 'Incorrect email or password. Please try again.' })
    }
    return startSession(req, res, existing, 200)
  }
  if (existing) return res.status(409).json({ error: 'Email in use. Please sign in.' })
  const account = { ...passwordCredentials(password), profile: blankProfile(name.trim(), address) }
  accounts.set(address, account)
  startSession(req, res, account, 201)
})

auth.post(resetPaths, (req, res, next) => {
  if (!req.app.locals.passwordResetDemo) {
    return res.status(503).json({ error: 'Password recovery is unavailable right now.' })
  }
  next()
}, express.json())

auth.post('/forgot-password', (req, res) => {
  const address = normalizeEmail(req.body?.email)
  if (!address) return res.status(400).json({ error: 'Enter a valid email address.' })

  const delivery = req.app.locals.passwordResetDemo
  const account = address === delivery.email ? accounts.get(address) : null
  const now = Date.now()
  const pending = account?.passwordReset
  if (account && (!pending || now - pending.issuedAt >= resendCooldown)) {
    const token = randomBytes(32).toString('base64url')
    delivery.deliver(new URL('/#/reset-password?token=' + token, delivery.origin).href)
    account.passwordReset = { digest: resetDigest(token), expiresAt: now + resetLifetime, issuedAt: now }
  }
  return res.status(202).json({ ok: true })
})

auth.post('/reset-password', (req, res) => {
  const { token, password, confirmPassword } = req.body ?? {}
  const account = accounts.get(req.app.locals.passwordResetDemo.email)
  const reset = account?.passwordReset
  if (!reset || Date.now() >= reset.expiresAt || typeof token !== 'string'
    || !/^[A-Za-z0-9_-]{43}$/.test(token) || resetDigest(token) !== reset.digest) {
    return res.status(400).json({ error: 'This reset link is invalid or has expired.' })
  }
  if (!validPassword(password) || password !== confirmPassword) {
    return res.status(400).json({ error: 'Enter matching passwords.' })
  }

  // Consume the link and revoke sessions in the same turn as the password update.
  Object.assign(account, passwordCredentials(password))
  delete account.passwordReset
  for (const [id, owner] of sessions) {
    if (owner === account) sessions.delete(id)
  }
  return res.json({ ok: true })
})

auth.post('/logout', (req, res) => {
  sessions.delete(sessionId(req))
  res.clearCookie(cookieName, cookieOptions).json({ ok: true, profile: guestProfile })
})

auth.use((error, req, res, next) => {
  if (error.type !== 'entity.parse.failed' && error.type !== 'entity.too.large') return next(error)
  res.status(error.status).json({ error: 'Invalid account request.' })
})
