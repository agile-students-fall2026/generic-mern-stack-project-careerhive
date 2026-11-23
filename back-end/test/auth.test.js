import { expect } from 'chai'
import app from '../app.js'

describe('account profiles', () => {
  let server, origin
  before(async () => {
    server = app.listen(0, '127.0.0.1')
    await new Promise(resolve => server.once('listening', resolve))
    origin = 'http://127.0.0.1:' + server.address().port
  })
  after(() => new Promise(resolve => server.close(resolve)))

  async function send(path, body, cookie) {
    const res = await fetch(origin + '/api/' + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie.split(';')[0] } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    return { status: res.status, data: await res.json().catch(() => null), cookie: res.headers.get('set-cookie') }
  }
  const account = name => ({ name, email: name.toLowerCase() + '@example.test', password: 'demo-password' })

  it('creates a canonical blank profile from signup and keeps it on reload', async () => {
    const input = account('Signup')
    const created = await send('signup', input)
    expect(created.status).to.equal(201)
    expect(created.cookie).to.include('HttpOnly').and.include('SameSite=Lax')
    const profile = created.data.profile
    expect(profile).to.include({ name: input.name, email: input.email, revision: 1 })
    expect(profile.id).to.be.a('string')
    for (const field of ['photo', 'degree', 'major', 'school', 'graduationDate', 'workAuthorization']) {
      expect(profile[field]).to.equal('')
    }
    for (const field of ['skills', 'locations', 'lookingFor']) expect(profile[field]).to.deep.equal([])
    expect((await send('profile', undefined, created.cookie)).data).to.deep.equal(profile)
    expect(created.data).not.to.have.property('password')
    expect(profile).not.to.have.property('password')
  })

  it('restores the right saved profile on login without mixing browser accounts or match identities', async () => {
    const first = await send('signup', account('First'))
    const second = await send('signup', account('Second'))
    const edited = await send('profile', { ...first.data.profile, name: 'Updated First', email: 'unrelated@example.test',
      major: 'Computer Science', graduationDate: '2028-05-01', workAuthorization: 'Demo option', skills: ['Python'] }, first.cookie)
    expect(edited.status).to.equal(200)
    expect(edited.data).to.include({ id: first.data.profile.id, revision: 2 })
    expect(edited.data.email).to.equal(first.data.profile.email)
    expect((await send('profile', undefined, second.cookie)).data).to.deep.equal(second.data.profile)
    const login = await send('login', { ...account('First'), email: ' FIRST@EXAMPLE.TEST ' }, second.cookie)
    expect(login.status).to.equal(200)
    expect(login.data.profile).to.deep.equal(edited.data)
    expect((await send('profile', undefined, login.cookie)).data).to.deep.equal(edited.data)
    const result = await send('matches/brightspace-software-intern', { profile: edited.data }, login.cookie)
    expect(result.status).to.equal(200)
    expect(result.data).to.include({ profileId: edited.data.id, profileRevision: 2, score: 46 })
    expect((await send('matches/brightspace-software-intern', { profile: edited.data }, second.cookie)).status).to.equal(400)
    expect((await send('profile', { ...edited.data, id: second.data.profile.id }, login.cookie)).status).to.equal(400)
  })

  it('keeps the current profile on failed login, duplicate signup and invalid input', async () => {
    const input = account('Failures')
    const session = await send('signup', input)
    expect(session.status).to.equal(201)
    for (const [path, body, status] of [
      ['login', { ...input, password: 'wrong' }, 401],
      ['signup', { ...input, name: 'Replacement', email: ' FAILURES@EXAMPLE.TEST ' }, 409],
      ['signup', { ...input, name: '' }, 400],
      ['signup', { ...input, email: 'invalid' }, 400],
      ['signup', { ...input, password: '' }, 400],
      ['login', { email: [], password: {} }, 400],
    ]) {
      const result = await send(path, body, session.cookie)
      expect(result.status).to.equal(status)
      expect(result.data.error).to.be.a('string')
      expect(result.cookie).to.equal(null)
      expect((await send('profile', undefined, session.cookie)).data).to.deep.equal(session.data.profile)
    }
  })

  it('logs out without exposing the previous identity or allowing stale sessions to save it', async () => {
    const session = await send('signup', account('Logout'))
    const result = await send('logout', {}, session.cookie)
    expect(result.status).to.equal(200)
    expect(result.data.profile).to.include({ name: '', email: '' })
    for (const cookie of [undefined, session.cookie, 'careerhive-session=invalid']) {
      expect((await send('profile', undefined, cookie)).data).to.include({ name: '', email: '' })
      expect((await send('profile', session.data.profile, cookie)).status).to.equal(401)
    }
    expect((await send('matches/brightspace-software-intern', { profile: {
      revision: 1, major: 'CS', graduationDate: '2028', workAuthorization: 'Demo', skills: ['Python'],
    } })).status).to.equal(400)
  })

  it('returns readable JSON for malformed account input and rejects unsupported methods', async () => {
    for (const path of ['signup', 'login', 'logout']) {
      const result = await send(path)
      expect(result.status).to.equal(405)
      expect(result.data.error).to.be.a('string')
    }
    const res = await fetch(origin + '/api/signup', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{',
    })
    expect(res.status).to.equal(400)
    expect((await res.json()).error).to.be.a('string')
  })
})
