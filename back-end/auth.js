import express from 'express'
import { readFileSync } from 'node:fs'
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto'

const demo = JSON.parse(readFileSync(new URL('./data/profile.json', import.meta.url), 'utf8'))
const fixtures = JSON.parse(readFileSync(new URL('./data/accounts.json', import.meta.url), 'utf8'))
const cookieName = 'careerhive-session'
const cookieOptions = { httpOnly: true, sameSite: 'lax', path: '/api' }
// shortcut: accounts and sessions last until server restart; MongoDB/JWT belong to Sprint 3.
const sessions = new Map()
const accounts = new Map(fixtures.map(account => {
  const salt = randomBytes(16)
  return [account.email.toLowerCase(), { salt, hash: scryptSync(account.password, salt, 32),
    profile: account.email === demo.email ? structuredClone(demo) : blankProfile(account.name ?? '', account.email) }]
}))

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

auth.all(['/signup', '/login', '/logout'], (req, res, next) => {
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
  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    || typeof password !== 'string' || !password
    || (req.path === '/signup' && (typeof name !== 'string' || !name.trim()))) {
    return res.status(400).json({ error: 'Enter a valid name, email and password.' })
  }
  const address = email.trim().toLowerCase()
  const existing = accounts.get(address)
  if (req.path === '/login') {
    if (!existing || !timingSafeEqual(existing.hash, scryptSync(password, existing.salt, 32))) {
      return res.status(401).json({ error: 'Incorrect email or password. Please try again.' })
    }
    return startSession(req, res, existing, 200)
  }
  if (existing) return res.status(409).json({ error: 'Email in use. Please sign in.' })
  const salt = randomBytes(16)
  const account = { salt, hash: scryptSync(password, salt, 32), profile: blankProfile(name.trim(), address) }
  accounts.set(address, account)
  startSession(req, res, account, 201)
})

auth.post('/logout', (req, res) => {
  sessions.delete(sessionId(req))
  res.clearCookie(cookieName, cookieOptions).json({ ok: true, profile: guestProfile })
})

auth.use((error, req, res, next) => {
  if (error.type !== 'entity.parse.failed' && error.type !== 'entity.too.large') return next(error)
  res.status(error.status).json({ error: 'Invalid account request.' })
})
