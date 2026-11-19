import express from 'express'
import { readFileSync } from 'node:fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const jobs = JSON.parse(readFileSync(new URL('./data/jobs.json', import.meta.url), 'utf8'))
const matches = JSON.parse(readFileSync(new URL('./data/matches.json', import.meta.url), 'utf8'))
const demoProfile = JSON.parse(readFileSync(new URL('./data/profile.json', import.meta.url), 'utf8'))

app.get('/api/health', (req, res) => {
  res.json({ ok: true })
})

app.use('/api/jobs', (req, res) => {
  res.set('Cache-Control', 'no-store')
  if (req.method !== 'GET') {
    return res.set('Allow', 'GET').status(405).json({ error: 'Method not allowed' })
  }
  if (req.originalUrl.split('?')[0] === '/api/jobs') return res.json(jobs)
  let id
  try {
    id = decodeURIComponent(req.path.slice(1))
  } catch {
    return res.status(400).json({ error: 'Invalid job identifier' })
  }
  const job = jobs.find(item => item.id === id)
  res.status(job ? 200 : 404).json(job ?? { error: 'Job not found' })
})

app.use('/api/matches', (req, res, next) => {
  res.set('Cache-Control', 'no-store')
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.set('Allow', 'GET, POST').status(405).json({ error: 'Method not allowed' })
  }
  next()
})

app.use(express.json())

app.use('/api/matches', (req, res) => {
  const saved = req.body?.profile
  if (req.method === 'POST' && (!saved || saved.id !== demoProfile.id || !Number.isInteger(saved.revision) || saved.revision < 1
    || ![saved.major, saved.graduationDate, saved.workAuthorization].every(value => typeof value === 'string' && value.trim())
    || !Array.isArray(saved.skills) || !saved.skills.length
    || !saved.skills.every(skill => typeof skill === 'string' && skill.trim()))) {
    return res.status(400).json({ error: 'A complete saved demo profile is required' })
  }
  let jobId
  try {
    jobId = decodeURIComponent(req.path.slice(1))
  } catch {
    return res.status(400).json({ error: 'Invalid job identifier' })
  }
  const match = jobs.some(job => job.id === jobId) && matches.find(item => item.jobId === jobId)
  if (!match) return res.status(404).json({ error: 'Match not found' })
  if (req.method === 'GET') return res.json(match)
  const skills = new Set(saved.skills.map(skill => skill.trim().toLowerCase()))
  // Fixture weights make profile edits observable; they are not a live AI score.
  const criteria = Object.entries(match.skillWeights)
  const present = criteria.filter(([skill]) => skills.has(skill.toLowerCase()))
  res.json({
    jobId,
    profileId: saved.id,
    profileRevision: saved.revision,
    score: present.reduce((total, [, weight]) => total + weight, 0),
    summary: present.length
      ? 'Mock match based on your saved skills: ' + present.map(([skill]) => skill).join(', ') + '.'
      : "None of this role's listed skills are in your saved profile yet.",
    fitExplanation: present.map(([skill]) => 'Your saved profile includes ' + skill + '.'),
    missingSkills: criteria.filter(([skill]) => !skills.has(skill.toLowerCase())).map(([skill]) => skill),
    keyQualifications: match.keyQualifications,
  })
}, (error, req, res, next) => {
  if (error.type !== 'entity.parse.failed' && error.type !== 'entity.too.large') return next(error)
  res.status(error.status).json({ error: error.type === 'entity.too.large'
    ? 'Match request is too large' : 'A complete saved demo profile is required' })
})

// Static: serve the built front end
const dist = path.join(__dirname, '..', 'front-end', 'dist')
app.use(express.static(dist))
app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(dist, 'index.html'))
})

export default app
