import { readFileSync } from 'node:fs'
import { use, expect } from 'chai'
import { default as chaiHttp, request } from 'chai-http'
import app from '../app.js'

use(chaiHttp)
const jobs = JSON.parse(readFileSync(new URL('../data/jobs.json', import.meta.url), 'utf8'))

describe('job routes', () => {
  it('returns the complete listing feed with stable IDs and no caching', async () => {
    const res = await request.execute(app).get('/api/jobs')
    expect(res).to.have.status(200)
    expect(res).to.be.json
    expect(res.headers['cache-control']).to.equal('no-store')
    expect(res.body).to.deep.equal(jobs)
    expect(new Set(res.body.map(job => job.id)).size).to.equal(jobs.length)
  })

  it('returns the selected listing unchanged, including an encoded job ID', async () => {
    for (const job of [jobs[0], jobs.at(-1)]) {
      const id = '%' + job.id.charCodeAt(0).toString(16) + job.id.slice(1)
      const res = await request.execute(app).get('/api/jobs/' + id)
      expect(res).to.have.status(200)
      expect(res).to.be.json
      expect(res.headers['cache-control']).to.equal('no-store')
      expect(res.body).to.deep.equal(job)
    }
  })

  it('rejects unsupported methods without changing listings', async () => {
    for (const path of ['/api/jobs', '/api/jobs/' + jobs[0].id]) {
      for (const method of ['post', 'patch', 'delete', 'head', 'options']) {
        const res = await request.execute(app)[method](path)
        expect(res).to.have.status(405)
        expect(res.headers.allow).to.equal('GET')
        if (method !== 'head') expect(res.body).to.deep.equal({ error: 'Method not allowed' })
      }
    }
    const invalidWrite = await request.execute(app).post('/api/jobs')
      .set('Content-Type', 'application/json').send('{')
    expect(invalidWrite).to.have.status(405)
    expect(invalidWrite.body).to.deep.equal({ error: 'Method not allowed' })
    const res = await request.execute(app).get('/api/jobs')
    expect(res.body).to.deep.equal(jobs)
  })

  it('returns JSON 404 for missing listings and decodes identifiers only once', async () => {
    for (const id of ['', 'does-not-exist', jobs[0].id + '/extra', '%2562' + jobs[0].id.slice(1)]) {
      const res = await request.execute(app).get('/api/jobs/' + id)
      expect(res).to.have.status(404)
      expect(res).to.be.json
      expect(res.body).to.deep.equal({ error: 'Job not found' })
    }
  })

  it('returns JSON 400 for malformed identifier encoding and stays available', async () => {
    const res = await request.execute(app).get('/api/jobs/%E0%A4%A')
    expect(res).to.have.status(400)
    expect(res).to.be.json
    expect(res.body).to.deep.equal({ error: 'Invalid job identifier' })
    expect((await request.execute(app).get('/api/jobs')).status).to.equal(200)
  })
})
