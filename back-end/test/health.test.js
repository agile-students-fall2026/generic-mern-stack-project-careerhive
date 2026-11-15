import { use, expect } from 'chai'
import { default as chaiHttp, request } from 'chai-http'
import app from '../app.js'

use(chaiHttp)

describe('GET /api/health', () => {
  it('responds with ok', async () => {
    const res = await request.execute(app).get('/api/health')
    expect(res).to.have.status(200)
    expect(res.body).to.deep.equal({ ok: true })
  })
})
