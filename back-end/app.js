import express from 'express'

const app = express()

app.use(express.json())

app.get('/api/health', (req, res) => {
  res.json({ ok: true })
})

// Teammates add their routes here (#120–#127)

export default app
