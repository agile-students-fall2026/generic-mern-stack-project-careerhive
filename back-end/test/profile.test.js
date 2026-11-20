import { readFileSync } from 'node:fs'
import { use, expect } from 'chai'
import { default as chaiHttp, request } from 'chai-http'
import app from '../app.js'

use(chaiHttp)
const profile = JSON.parse(readFileSync(new URL('../data/profile.json', import.meta.url), 'utf8'))
const roles = JSON.parse(readFileSync(new URL('../data/roles.json', import.meta.url), 'utf8'))

describe('profile routes', () => {
    it('returns the saved profile', async () => {
        const res = await request.execute(app).get('/api/profile')
        expect(res).to.have.status(200)
        expect(res).to.be.json
        expect(res.headers['cache-control']).to.equal('no-store')
        expect(res.body).to.deep.equal(profile)
  })

    it('returns the role list', async () => {
        const res = await request.execute(app).get('/api/roles')
        expect(res).to.have.status(200)
        expect(res).to.be.json
        expect(res.body).to.deep.equal(roles)
    })

    it('rejects a profile with a role that is not in the list', async () => {
        const res = await request.execute(app).post('/api/profile').send({ ...profile, lookingFor: ['Nope'] })
        expect(res).to.have.status(400)
        expect(res.body).to.deep.equal({ error: 'Profile is not valid' })
        const current = await request.execute(app).get('/api/profile')
        expect(current.body).to.deep.equal(profile)
    })

    it('saves a valid profile and returns it', async () => {
        const posted = { ...profile, major: 'Information Systems' }
        const res = await request.execute(app).post('/api/profile').send(posted)
        expect(res).to.have.status(200)
        expect(res.body.major).to.equal('Information Systems')
        expect(res.body.id).to.equal(profile.id)
        expect(res.body.revision).to.equal(profile.revision + 1)
        const current = await request.execute(app).get('/api/profile')
        expect(current.body).to.deep.equal(res.body)
    })
})