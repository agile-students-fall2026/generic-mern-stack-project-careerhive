import { readFileSync } from 'node:fs'
import { use, expect } from 'chai'
import { default as chaiHttp, request } from 'chai-http'
import app from '../app.js'

use(chaiHttp)
const profile = JSON.parse(readFileSync(new URL('../data/profile.json', import.meta.url), 'utf8'))
const fixtures = JSON.parse(readFileSync(new URL('../data/matches.json', import.meta.url), 'utf8'))
const path = '/api/matches/' + fixtures[0].jobId

describe('match routes', () => {
  let agent
  before(async () => {
    agent = request.agent(app)
    const accounts = JSON.parse(readFileSync(new URL('../data/accounts.json', import.meta.url), 'utf8'))
    const login = await agent.post('/api/login').send(accounts[0])
    expect(login).to.have.status(200)
  })
  after(() => agent.close())
  it('returns profile-aware analysis with the selected job and saved revision', async () => {
    const res = await agent.post(path).send({ profile })
    expect(res).to.have.status(200)
    expect(res).to.be.json
    expect(res.headers['cache-control']).to.equal('no-store')
    expect(res.body).to.include({ jobId: fixtures[0].jobId, profileId: profile.id,
      profileRevision: profile.revision, score: 92 })
    expect(res.body.fitExplanation).to.deep.equal(['Your saved profile includes React.', 'Your saved profile includes Python.'])
    expect(res.body.missingSkills).to.deep.equal(['Git'])
    expect(res.body.keyQualifications).to.deep.equal(fixtures[0].keyQualifications)
    expect(res.body).not.to.have.property('skillWeights')
  })

  it('recomputes saved skill changes, including duplicate skills and a real zero score', async () => {
    const full = await agent.post(path).send({ profile: { ...profile, revision: 2, skills: [' react ', 'PYTHON', 'git', 'Git'] } })
    expect(full.body).to.include({ score: 100, profileRevision: 2 })
    expect(full.body.missingSkills).to.deep.equal([])
    expect(full.body.fitExplanation).to.have.length(3)
    const zero = await agent.post(path).send({ profile: { ...profile, revision: 3, skills: ['Unrelated skill'] } })
    expect(zero.body).to.include({ score: 0, profileRevision: 3 })
    expect(zero.body.fitExplanation).to.deep.equal([])
    expect(zero.body.missingSkills).to.deep.equal(Object.keys(fixtures[0].skillWeights))
    expect((await agent.get(path)).body).to.deep.equal(fixtures[0])
  })

  it('rejects missing, foreign or incomplete demo profiles', async () => {
    const changes = [{ id: 'another-profile' }, { revision: 0 }, { revision: 1.5 },
      { major: ' ' }, { graduationDate: '' }, { workAuthorization: null },
      { skills: [] }, { skills: [' '] }, { skills: [12] }]
    for (const saved of [undefined, null, ...changes.map(change => ({ ...profile, ...change }))]) {
      const res = await agent.post(path).send({ profile: saved })
      expect(res).to.have.status(400)
      expect(res.body).to.deep.equal({ error: 'A complete saved demo profile is required' })
    }
  })

  it('preserves the legacy GET fixture for the selected job', async () => {
    for (const fixture of [fixtures[0], fixtures.at(-1)]) {
      const id = '%' + fixture.jobId.charCodeAt(0).toString(16) + fixture.jobId.slice(1)
      const res = await agent.get('/api/matches/' + id)
      expect(res).to.have.status(200)
      expect(res.body).to.deep.equal(fixture)
    }
  })

  it('returns JSON 404 for unknown jobs and JSON 400 for malformed identifiers', async () => {
    for (const method of ['get', 'post']) {
      for (const id of ['does-not-exist', '', fixtures[0].jobId + '/extra', '%2562' + fixtures[0].jobId.slice(1), '%E0%A4%A']) {
        const res = await agent[method]('/api/matches/' + id).send(method === 'post' ? { profile } : undefined)
        expect(res).to.have.status(id === '%E0%A4%A' ? 400 : 404)
        expect(res.body).to.deep.equal({ error: id === '%E0%A4%A' ? 'Invalid job identifier' : 'Match not found' })
      }
    }
  })

  it('rejects unsupported methods before parsing their body', async () => {
    for (const method of ['put', 'patch', 'delete', 'head', 'options']) {
      const res = await agent[method](path).set('Content-Type', 'application/json').send('{')
      expect(res).to.have.status(405)
      expect(res.headers.allow).to.equal('GET, POST')
      if (method !== 'head') expect(res.body).to.deep.equal({ error: 'Method not allowed' })
    }
  })

  it('keeps malformed or oversized JSON errors readable and the server available', async () => {
    for (const body of ['{', 'null', '[]', JSON.stringify({ profile: { ...profile, major: 'x'.repeat(102400) } })]) {
      const res = await agent.post(path).set('Content-Type', 'application/json').send(body)
      expect(res).to.have.status(body.length > 102400 ? 413 : 400)
      expect(res).to.be.json
      expect(res.body.error).to.be.a('string')
      expect(res.headers['cache-control']).to.equal('no-store')
    }
    expect((await agent.get(path)).status).to.equal(200)
  })
})
