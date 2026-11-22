import { readFileSync } from 'node:fs'
import { use, expect } from 'chai'
import { default as chaiHttp, request } from 'chai-http'
import app from '../app.js'

use(chaiHttp)
const applications = JSON.parse(readFileSync(new URL('../data/applications.json', import.meta.url), 'utf8'))

describe('application routes', () => {
  it('returns the application list', async () => {
    const res = await request.execute(app).get('/api/applications')
    expect(res).to.have.status(200)
    expect(res).to.be.json
    expect(res.headers['cache-control']).to.equal('no-store')
    expect(res.body).to.deep.equal(applications)
  })

  it('returns one application', async () => {
    const res = await request.execute(app).get('/api/applications/' + applications[0].id)
    expect(res).to.have.status(200)
    expect(res.body).to.deep.equal(applications[0])
  })

  it('returns 404 for a missing application', async () => {
    const res = await request.execute(app).get('/api/applications/missing')
    expect(res).to.have.status(404)
    expect(res.body).to.deep.equal({ error: 'Application not found' })
  })

  it('rejects other methods and leaves the list unchanged', async () => {
    const res = await request.execute(app).post('/api/applications')
    expect(res).to.have.status(405)
    expect(res.headers.allow).to.equal('GET')
    const current = await request.execute(app).get('/api/applications')
    expect(current.body).to.deep.equal(applications)
  })

  it('returns the required Tracker application fields', async () => {
  const res = await request.execute(app).get('/api/applications')

  expect(res).to.have.status(200)
  expect(res.body).to.be.an('array').that.is.not.empty

  for (const application of res.body) {
    expect(application).to.include.all.keys(
      'id',
      'jobId',
      'stage',
      'note',
      'updatedAt',
      'history'
    )

    expect(application.id).to.be.a('string')
    expect(application.jobId).to.be.a('string')
    expect(application.stage).to.be.a('string')
    expect(application.note).to.be.a('string')
    expect(application.updatedAt).to.be.a('string')
    expect(application.history).to.be.an('array')
  }
})

it('rejects malformed application identifiers', async () => {
  const res = await request.execute(app)
    .get('/api/applications/%ZZ')

  expect(res).to.have.status(400)
  expect(res.body).to.deep.equal({
    error: 'Invalid application identifier',
  })
})

})