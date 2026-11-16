
import { use, expect } from 'chai'

import { default as chaiHttp, request } from 'chai-http'

import app from '../app.js'

use(chaiHttp)


describe('GET /api/applications', () => {

  it('returns an array of applications', async () => {

    const res = await request.execute(app).get('/api/applications')

    expect(res).to.have.status(200)


    expect(res.body).to.be.an('array')

    expect(res.body.length).to.be.greaterThan(0)

  })

  it('returns the required application fields', async () => {

    const res = await request.execute(app).get('/api/applications')

    expect(res).to.have.status(200)
    

    for (const application of res.body) {

      expect(application).to.include.all.keys(
        'id',
        'jobId',
        'stage',
        'note',
        'updatedAt',
        'history'
      )

      expect(application.history).to.be.an('array')

    }
    
  })
})
