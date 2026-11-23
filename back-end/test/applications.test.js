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
    const res = await request.execute(app).put('/api/applications')
    expect(res).to.have.status(405)
    expect(res.headers.allow).to.equal('GET, POST')
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

describe('application write routes', () => {
  it('creates, updates and removes an application', async () => {
    const jobs = JSON.parse(
      readFileSync(new URL('../data/jobs.json', import.meta.url), 'utf8')
    )

    const availableJob = jobs.find(
      job => !applications.some(application => application.jobId === job.id)
    )

    expect(availableJob).to.exist

    const created = await request.execute(app)
      .post('/api/applications')
      .send({
        jobId: availableJob.id,
        stage: 'Preparing',
        note: 'Test application',
      })

    expect(created).to.have.status(201)
    expect(created.body.jobId).to.equal(availableJob.id)
    expect(created.body.stage).to.equal('Preparing')
    expect(created.body.history).to.have.length(1)

    const id = created.body.id

    const duplicate = await request.execute(app)
      .post('/api/applications')
      .send({ jobId: availableJob.id })

    expect(duplicate).to.have.status(409)

    const updated = await request.execute(app)
      .post('/api/applications/' + id)
      .send({ stage: 'Applied' })

    expect(updated).to.have.status(200)
    expect(updated.body.stage).to.equal('Applied')
    expect(updated.body.history).to.have.length(2)

    const noteUpdate = await request.execute(app)
      .post('/api/applications/' + id)
      .send({ note: 'Updated note' })

    expect(noteUpdate).to.have.status(200)
    expect(noteUpdate.body.note).to.equal('Updated note')
    expect(noteUpdate.body.history).to.have.length(2)

    const legacyUpdate = await request.execute(app)
      .patch('/api/applications/' + id)
      .send({ note: 'PATCH compatibility' })

    expect(legacyUpdate).to.have.status(200)
    expect(legacyUpdate.body.note).to.equal('PATCH compatibility')

    const removed = await request.execute(app)
      .delete('/api/applications/' + id)

    expect(removed).to.have.status(204)

    const missing = await request.execute(app)
      .get('/api/applications/' + id)

    expect(missing).to.have.status(404)
  })

  it('rejects invalid application data and missing records', async () => {
    const invalid = await request.execute(app)
      .post('/api/applications')
      .send({ jobId: 'unknown-job', stage: 'Saved' })

    expect(invalid).to.have.status(400)

    const missing = await request.execute(app)
      .patch('/api/applications/missing')
      .send({ stage: 'Applied' })

    expect(missing).to.have.status(404)
  })
})

})