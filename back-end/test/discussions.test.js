
import { readFileSync } from 'node:fs'
import { use, expect } from 'chai'
import { default as chaiHttp, request } from 'chai-http'
import app from '../app.js'

use(chaiHttp)

const discussions = JSON.parse(
  readFileSync(new URL('../data/discussions.json', import.meta.url), 'utf8')
)

describe('discussion routes', () => {
  it('returns all discussions', async () => {
    const res = await request.execute(app).get('/api/discussions')

    expect(res).to.have.status(200)
    expect(res.body).to.deep.equal(discussions)
    expect(res.headers['cache-control']).to.equal('no-store')
  })

  it('filters discussions by job ID', async () => {
    const jobId = discussions[0].jobId

    const res = await request.execute(app)
      .get('/api/discussions/' + encodeURIComponent(jobId))

    expect(res).to.have.status(200)
    expect(res.body).to.deep.equal(
      discussions.filter(item => item.jobId === jobId)
    )
  })

  it('returns an empty array for an unknown job', async () => {
    const res = await request.execute(app)
      .get('/api/discussions/missing-job')

    expect(res).to.have.status(200)
    expect(res.body).to.deep.equal([])
  })

  it('rejects unsupported methods', async () => {
    const res = await request.execute(app)
      .post('/api/discussions')

    expect(res).to.have.status(405)
    expect(res.headers.allow).to.equal('GET')
  })

  it('rejects malformed job identifiers', async () => {
    const res = await request.execute(app)
      .get('/api/discussions/%ZZ')

    expect(res).to.have.status(400)
    expect(res.body).to.deep.equal({
      error: 'Invalid job identifier',
    })
  })

  it('posts with server-owned identity and returns newest-first job and startup reads', async () => {
    const agent = request.agent(app)
    try {
      const accounts = JSON.parse(readFileSync(new URL('../data/accounts.json', import.meta.url)))
      const login = await agent.post('/api/login').send(accounts[0])
      const jobId = discussions[0].jobId
      const path = '/api/discussions/' + jobId
      for (const anonymous of [false, true]) {
        const res = await agent.post(path).send({ topic: 'Update', body: '  A new update.  ', anonymous, author: 'Forged author' })
        expect(res).to.have.status(201)
        expect(res.body).to.include({ jobId, topic: 'Update', body: 'A new update.', anonymous })
        expect(res.body.id).to.be.a('string')
        expect(Number.isNaN(Date.parse(res.body.createdAt))).to.equal(false)
        expect(res.body.author).to.equal(anonymous ? 'Anonymous' : login.body.profile.name)
        const selected = await agent.get(path)
        expect(selected.body[0]).to.deep.equal(res.body)
        expect(selected.body.every(post => post.jobId === jobId)).to.equal(true)
        const all = await agent.get('/api/discussions')
        expect(all.body).to.deep.include(res.body)
      }
    } finally { agent.close() }
  })

  it('rejects unauthenticated, invalid and malformed posts without adding records', async () => {
    const path = '/api/discussions/' + discussions[0].jobId
    const input = { topic: 'Interview', body: 'An update', anonymous: false }
    expect((await request.execute(app).post(path).send(input)).status).to.equal(401)
    const agent = request.agent(app)
    try {
      const accounts = JSON.parse(readFileSync(new URL('../data/accounts.json', import.meta.url)))
      await agent.post('/api/login').send(accounts[0])
      const before = (await agent.get('/api/discussions')).body
      for (const change of [{ topic: 'Other' }, { body: ' ' }, { body: 42 }, { anonymous: 'false' }]) {
        expect((await agent.post(path).send({ ...input, ...change })).status).to.equal(400)
      }
      expect((await agent.post('/api/discussions/missing-job').send(input)).status).to.equal(404)
      const malformed = await agent.post(path).set('Content-Type', 'application/json').send('{')
      expect(malformed).to.have.status(400)
      expect(malformed).to.be.json
      const unsupported = await agent.patch(path).send(input)
      expect(unsupported).to.have.status(405)
      expect(unsupported.headers.allow).to.equal('GET, POST')
      expect((await agent.get('/api/discussions')).body).to.deep.equal(before)
    } finally { agent.close() }
  })
})
