import express from 'express'
import { readFileSync } from 'node:fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const jobs = JSON.parse(readFileSync(new URL('./data/jobs.json', import.meta.url), 'utf8'))

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

app.use(express.json())

// Static: serve the built front end
const dist = path.join(__dirname, '..', 'front-end', 'dist')
app.use(express.static(dist))
app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(dist, 'index.html'))
})

export default app
