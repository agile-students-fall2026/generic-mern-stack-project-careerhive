
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
})
