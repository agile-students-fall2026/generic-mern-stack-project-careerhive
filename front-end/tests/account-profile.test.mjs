import assert from 'node:assert/strict'
import { before, after, beforeEach, afterEach, test } from 'node:test'
import { once } from 'node:events'
import { fileURLToPath } from 'node:url'
import { act, createElement, StrictMode, useEffect } from 'react'
import { JSDOM } from 'jsdom'
import { createServer } from 'vite'
import app from '../../back-end/app.js'

const originalFetch = globalThis.fetch
let vite, backend, origin, App, AppState, useAppState, root, dom, state, cookie, calls
let holdStartup, releaseStartup
let holdSave, releaseSave, heldSaves, failLogout
let holdAuth, releaseAuth, heldAuth, outgoingAuth
let failProfile
before(async () => {
  backend = app.listen(0, '127.0.0.1')
  await once(backend, 'listening')
  backend.on('request', req => calls.push(req.method + ' ' + req.originalUrl))
  vite = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)),
    server: { host: '127.0.0.1', port: 0, hmr: false, watch: null,
      proxy: { '/api': 'http://127.0.0.1:' + backend.address().port } }, logLevel: 'silent' })
  await vite.listen()
  origin = 'http://127.0.0.1:' + vite.httpServer.address().port
  ;({ default: App } = await vite.ssrLoadModule('/src/App.jsx'))
  ;({ default: AppState } = await vite.ssrLoadModule('/src/data/AppState.jsx'))
  ;({ useAppState } = await vite.ssrLoadModule('/src/data/useAppState.js'))
})
beforeEach(async () => {
  cookie = ''; calls = []; holdStartup = false; holdSave = false; heldSaves = 0; failLogout = false
  holdAuth = false; heldAuth = 0; outgoingAuth = []
  failProfile = false
  dom = new JSDOM('<div id="root"></div>', { url: origin + '/#/signup' })
  globalThis.window = dom.window; globalThis.document = dom.window.document
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  window.scrollTo = () => {}
  window.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  window.HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
  globalThis.fetch = async (url, options = {}) => {
    if (['/api/signup', '/api/login'].includes(url)) outgoingAuth.push(url)
    if (url === '/api/logout' && failLogout) return new Response(JSON.stringify({ error: 'Logout unavailable' }), { status: 503 })
    if (url === '/api/profile' && options.method === 'POST' && failProfile) return new Response(JSON.stringify({ error: 'Profile unavailable' }), { status: 503 })
    const held = url === '/api/profile' ? (options.method === 'POST' ? holdSave : holdStartup)
      : url === '/api/signup' && holdAuth
    const result = await originalFetch(new URL(url, origin), { ...options,
      headers: { ...options.headers, ...(cookie ? { Cookie: cookie } : {}) } })
    const nextCookie = result.headers.get('set-cookie')
    if (nextCookie) cookie = nextCookie.split(';')[0]
    if (held) {
      if (url === '/api/profile' && options.method === 'POST') heldSaves++
      if (url === '/api/signup') heldAuth++
      await held
    }
    return result
  }
  const { createRoot } = await import('react-dom/client')
  root = createRoot(document.getElementById('root'))
})
afterEach(async () => {
  releaseStartup?.(); releaseStartup = null; releaseSave?.(); releaseSave = null
  releaseAuth?.(); releaseAuth = null
  await act(async () => root.unmount())
  dom.window.close(); globalThis.fetch = originalFetch
  delete globalThis.window; delete globalThis.document; delete globalThis.IS_REACT_ACT_ENVIRONMENT
})
after(async () => {
  await vite.close()
  await new Promise(resolve => backend.close(resolve))
})
function Capture() { const next = useAppState(); useEffect(() => { state = next }, [next]); return null }
const tick = () => new Promise(resolve => setTimeout(resolve, 10))
async function waitFor(check) {
  for (let i = 0; i < 150; i++) { if (check()) return; await act(tick) }
  assert.fail(document.body.textContent)
}
async function mount() { await act(async () => root.render(createElement(StrictMode, null,
  createElement(AppState, null, createElement(Capture), createElement(App))))) }
async function navigate(path) { await act(async () => { window.location.hash = '#' + path; await tick() }) }
async function click(text) {
  const button = [...document.querySelectorAll('button,a')].find(item => item.textContent.trim() === text)
  assert.ok(button, text)
  await act(async () => { button.click(); await tick() })
}
async function type(input, text) {
  assert.ok(input)
  await act(async () => {
    const prototype = input.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(input, text)
    input.dispatchEvent(new window.Event('input', { bubbles: true })); await tick()
  })
}
async function submit(values) {
  for (const [id, value] of Object.entries(values)) await type(document.getElementById(id), value)
  await act(async () => {
    document.querySelector('form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }))
    await tick()
  })
}
const signup = name => submit({ 'signup-name': name, 'signup-email': name + '@example.test',
  'signup-password': 'demo-password', 'signup-confirm': 'demo-password' })

test('requests and completes password recovery through Express with retry and link errors', async () => {
  const email = 'ui-recovery@example.test'
  let link, release, requestCount = 0, resetCount = 0
  const held = new Promise(resolve => { release = resolve })
  const fetchThroughVite = globalThis.fetch
  app.locals.passwordResetDemo = { email, origin, deliver: url => { link = url } }
  globalThis.fetch = async (path, options) => {
    if (path === '/api/forgot-password' && ++requestCount === 1) {
      await held
      return Response.json({ error: 'Please try again.' }, { status: 503 })
    }
    if (path === '/api/reset-password') {
      resetCount++
      assert.deepEqual(Object.keys(JSON.parse(options.body)).sort(), ['confirmPassword', 'password', 'token'])
    }
    return fetchThroughVite(path, options)
  }

  try {
    await fetchThroughVite('/api/signup', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'UI Recovery', email, password: 'demo-password' }) })
    await mount()
    await navigate('/login')
    await click('Forgot password?')
    await waitFor(() => document.querySelector('h1')?.textContent === 'Forgot Password')
    await submit({ 'recovery-email': email })
    assert.equal(document.querySelector('button[type="submit"]').disabled, true)
    release()
    await waitFor(() => document.querySelector('[role="alert"]')?.textContent === 'Please try again.')
    assert.equal(document.getElementById('recovery-email').value, email)
    await click('Send reset link')
    await waitFor(() => document.querySelector('[role="status"]')?.textContent.includes('check your inbox'))
    assert.ok(calls.includes('POST /api/forgot-password'))

    await navigate('/reset-password')
    assert.ok(document.querySelector('a[href="#/forgot-password"]'))
    assert.equal(document.querySelector('form'), null)
    await navigate('/reset-password?token=invalid')
    const passwords = { 'recovery-password': 'new-password', 'recovery-confirm': 'new-password' }
    await submit({ ...passwords, 'recovery-confirm': 'different' })
    assert.equal(resetCount, 0)
    assert.match(document.querySelector('[role="alert"]').textContent, /match/i)
    await submit(passwords)
    await waitFor(() => document.querySelector('[role="alert"]')?.textContent.includes('invalid or has expired'))
    await navigate(new URL(link).hash.slice(1))
    assert.equal(document.getElementById('recovery-password').value, '')
    await submit(passwords)
    await waitFor(() => document.querySelector('[role="status"]')?.textContent.includes('password has been reset'))
    assert.equal(resetCount, 2)
    assert.equal(document.querySelector('form'), null)
    await click('Log In')
    await waitFor(() => window.location.hash === '#/login')
  } finally {
    release()
    delete app.locals.passwordResetDemo
    globalThis.fetch = fetchThroughVite
  }
})

test('discussion posts await Express, preserve failed drafts and survive a fresh read', async () => {
  await mount(); await waitFor(() => state.status === 'ready')
  await signup('DiscussionWriter'); await waitFor(() => window.location.hash === '#/profile-setup')
  let jobs
  await act(async () => { jobs = await (await fetch('/api/jobs')).json() })
  const path = '/api/discussions/' + jobs[0].id
  await navigate('/jobs/' + jobs[0].id + '/discussion')
  await click('New Post')
  await type(document.querySelector('#new-post-body'), 'A synthetic discussion update.')
  const count = state.posts.length
  const send = globalThis.fetch
  let release, attempts = 0, fail = true
  globalThis.fetch = (url, options = {}) => {
    if (url === path && options.method === 'POST') {
      attempts++
      if (fail) return new Promise(resolve => { release = resolve })
    }
    return send(url, options)
  }
  await click('Post')
  assert.equal(attempts, 1)
  assert.equal(document.querySelector('#new-post-body').disabled, true)
  assert.equal(state.posts.length, count)
  await act(async () => release(new Response(JSON.stringify({ error: 'Posting unavailable' }), { status: 503 })))
  await waitFor(() => document.body.textContent.includes('Posting unavailable'))
  assert.equal(document.querySelector('#new-post-body').value, 'A synthetic discussion update.')
  assert.equal(state.posts.length, count)
  fail = false; await click('Post')
  await waitFor(() => !document.querySelector('#new-post-body'))
  assert.equal(state.posts.length, count + 1)
  assert.equal(state.posts[0].author, 'DiscussionWriter')
  let saved
  await act(async () => { saved = await (await fetch(path)).json() })
  assert.equal(saved[0].id, state.posts[0].id)
  assert.equal(saved[0].body, 'A synthetic discussion update.')
  assert.ok(calls.includes('POST ' + path))
})

const field = name => document.querySelector(`[name="${name}"]`)
async function select(name, value) {
  const input = field(name)
  assert.equal(input?.tagName, 'SELECT', name + ' must be a dropdown')
  assert.equal(input.labels[0].textContent.trim(), { major: 'Major', graduationDate: 'Graduation date', workAuthorization: 'Work authorization', locations: 'Preferred locations' }[name])
  await act(async () => {
    input.value = value
    input.dispatchEvent(new window.Event('change', { bubbles: true }))
  })
}

test('signup dropdowns save through Express, retain failed drafts and reopen in Edit Profile', async () => {
  await mount(); await waitFor(() => state.status === 'ready')
  await signup('Dropdowns'); await waitFor(() => window.location.hash === '#/profile-setup')
  const graduation = `${new Date().getFullYear() + 2}-05-01`
  await select('major', 'Computer Science')
  await select('graduationDate', graduation)
  await select('workAuthorization', 'Authorized to work; future sponsorship needed (OPT)')
  const choices = [...field('workAuthorization').options].map(option => option.value)
  assert.ok(choices.includes('Canadian citizen'))
  assert.ok(choices.includes('Authorized to work; future sponsorship needed (STEM OPT)'))
  assert.ok(choices.includes('Requires visa sponsorship (e.g., H-1B)'))
  assert.ok(!choices.includes('Prefer not to say'))
  await select('locations', 'New York')
  await select('locations', 'California')
  await select('locations', 'New York')
  assert.equal(field('locations').options.length, 51)
  assert.ok(![...field('locations').options].some(option => option.value === 'Remote'))
  assert.equal(document.querySelector('input[name="locations"]'), null)
  failProfile = true; await click('Save and continue')
  await waitFor(() => document.querySelector('[role="alert"]'))
  assert.equal(state.profile.major, '')
  assert.equal(field('major').value, 'Computer Science')
  assert.match(document.body.textContent, /Profile unavailable/)
  failProfile = false; await click('Save and continue')
  await waitFor(() => window.location.hash === '#/home')
  let saved
  await act(async () => { saved = await (await fetch('/api/profile')).json(); await tick() })
  assert.equal(saved.major, 'Computer Science')
  assert.equal(saved.graduationDate, graduation)
  assert.equal(saved.workAuthorization, choices.find(value => value.endsWith('(OPT)')))
  assert.deepEqual(saved.locations, ['New York', 'California'])
  await navigate('/profile/edit')
  assert.equal(field('major').value, saved.major)
  assert.equal(field('graduationDate').value, saved.graduationDate)
  assert.deepEqual([...field('workAuthorization').options].map(option => option.value), choices)
  await select('locations', 'Texas')
  await click('New York')
  await select('major', 'Data Science'); await click('Cancel')
  assert.equal(state.profile.major, saved.major)
  assert.deepEqual(state.profile.locations, saved.locations)
  await navigate('/profile/edit')
  await select('locations', 'Texas'); await click('California')
  await click('Save Changes'); await waitFor(() => window.location.hash === '#/profile')
  assert.deepEqual(state.profile.locations, ['New York', 'Texas'])
  await navigate('/profile-setup')
  await select('major', 'Business')
  const writes = calls.filter(call => call === 'POST /api/profile').length
  await click('Skip for now'); await waitFor(() => window.location.hash === '#/home')
  assert.equal(calls.filter(call => call === 'POST /api/profile').length, writes)
  assert.equal(state.profile.major, saved.major)
})

test('dropdowns preserve existing profile values that are outside the demo choices', async () => {
  await mount(); await waitFor(() => state.status === 'ready')
  await signup('Existingchoices'); await waitFor(() => window.location.hash === '#/profile-setup')
  await act(async () => state.saveProfile({ ...state.profile, major: 'Physics', graduationDate: '2035-07-15', workAuthorization: 'Existing saved status', locations: ['Remote'] }))
  await navigate('/profile/edit')
  for (const [name, value] of Object.entries({ major: 'Physics', graduationDate: '2035-07-15', workAuthorization: 'Existing saved status' })) {
    assert.equal(field(name).tagName, 'SELECT')
    assert.equal(field(name).value, value)
  }
  await click('Save Changes'); await waitFor(() => window.location.hash === '#/profile')
  assert.equal(state.profile.major, 'Physics')
  assert.equal(state.profile.graduationDate, '2035-07-15')
  assert.deepEqual(state.profile.locations, ['Remote'])
  await navigate('/profile/edit')
  assert.ok(![...field('locations').options].some(option => option.value === 'Remote'))
  await click('Remote'); await click('Save Changes')
  await waitFor(() => window.location.hash === '#/profile')
  assert.deepEqual(state.profile.locations, [])
})

test('Setup and Edit Profile prevent another edit or save while a profile write is pending', async () => {
  await mount(); await waitFor(() => state.status === 'ready')
  await signup('Pendingchoices'); await waitFor(() => window.location.hash === '#/profile-setup')
  for (const [path, save, leave, destination] of [
    ['/profile-setup', 'Save and continue', 'Skip for now', '#/home'],
    ['/profile/edit', 'Save Changes', 'Cancel', '#/profile'],
  ]) {
    await navigate(path)
    holdSave = new Promise(resolve => { releaseSave = resolve })
    const before = heldSaves
    await click(save); await waitFor(() => heldSaves === before + 1)
    assert.equal(field('major').matches(':disabled'), true)
    assert.equal([...document.querySelectorAll('button')].find(button => button.textContent === leave).matches(':disabled'), true)
    await click('Saving…')
    assert.equal(heldSaves, before + 1)
    await act(async () => { releaseSave(); await tick() })
    await waitFor(() => window.location.hash === destination)
    holdSave = false
  }
})

test('leaving and reopening Edit Profile cannot bypass an in-flight save or cause stale navigation', async () => {
  await mount(); await waitFor(() => state.status === 'ready')
  await signup('Reopenchoices'); await waitFor(() => window.location.hash === '#/profile-setup')
  await click('Skip for now'); await waitFor(() => window.location.hash === '#/home')
  await navigate('/profile/edit'); await select('major', 'Computer Science')
  holdSave = new Promise(resolve => { releaseSave = resolve })
  await click('Save Changes'); await waitFor(() => heldSaves === 1)
  await click('Back to profile'); await waitFor(() => window.location.hash === '#/profile')
  await click('Edit Profile'); await select('major', 'Business')
  await click('Save Changes')
  assert.equal(heldSaves, 1)
  assert.match(document.body.textContent, /already saving/)
  await act(async () => { releaseSave(); await tick() })
  assert.equal(window.location.hash, '#/profile/edit')
  assert.equal(field('major').value, 'Business')
  holdSave = false; await click('Save Changes')
  await waitFor(() => window.location.hash === '#/profile')
  assert.equal(state.profile.major, 'Business')
})

test('signup, edit, reload, logout and login keep the account identity through Express', async () => {
  await mount()
  await waitFor(() => state.status === 'ready')
  await signup('Journey')
  await waitFor(() => window.location.hash === '#/profile-setup')
  assert.equal(state.profile.name, 'Journey')
  assert.equal(state.profile.email, 'journey@example.test')
  assert.equal(state.profile.major, '')
  const id = state.profile.id
  await click('Skip for now')
  await navigate('/profile')
  assert.match(document.querySelector('.profile-header').textContent, /Journey.*journey@example.test/s)
  await click('Edit Profile')
  await waitFor(() => document.querySelector('input[name="name"]'))
  assert.equal(document.querySelectorAll('img[src=""]').length, 0)
  await type(document.querySelector('input[name="name"]'), 'Edited Journey')
  await click('Save Changes')
  await waitFor(() => window.location.hash === '#/profile')
  assert.equal(state.profile.revision, 2)
  await act(async () => root.render(null))
  await mount()
  await waitFor(() => state.status === 'ready' && document.querySelector('.profile-name'))
  assert.equal(document.querySelector('.profile-name').textContent, 'Edited Journey')
  assert.equal(state.profile.id, id)
  await click('Menu'); await click('Log Out')
  await waitFor(() => window.location.hash === '#/welcome')
  assert.equal(state.profile.email, '')
  await navigate('/login')
  await submit({ 'login-email': 'journey@example.test', 'login-password': 'wrong' })
  await waitFor(() => document.querySelector('[role="alert"]'))
  assert.equal(state.profile.email, '')
  await submit({ 'login-email': ' JOURNEY@example.test ', 'login-password': 'demo-password' })
  await waitFor(() => window.location.hash === '#/home')
  assert.equal(state.profile.name, 'Edited Journey')
  assert.equal(state.profile.id, id)
  await navigate('/signup'); await signup('Another')
  await waitFor(() => window.location.hash === '#/profile-setup')
  assert.equal(state.profile.name, 'Another')
  assert.notEqual(state.profile.id, id)
  assert.equal(state.profile.major, '')
  for (const path of ['signup', 'login', 'logout', 'profile']) assert.ok(calls.includes('POST /api/' + path), path)
})

test('late startup profile reads cannot replace a newly signed-up identity', async () => {
  holdStartup = new Promise(resolve => { releaseStartup = resolve })
  await mount()
  await signup('Startup')
  await waitFor(() => window.location.hash === '#/profile-setup')
  assert.equal(state.profile.name, 'Startup')
  await act(async () => { releaseStartup(); await tick() })
  assert.equal(state.profile.name, 'Startup')
})

test('a late profile save cannot replace an account selected afterwards', async () => {
  await mount(); await waitFor(() => state.status === 'ready')
  await signup('Oldaccount'); await waitFor(() => state.profile.name === 'Oldaccount')
  holdSave = new Promise(resolve => { releaseSave = resolve })
  let save
  await act(async () => { save = state.saveProfile({ ...state.profile, name: 'Old edited name' }).catch(error => error) })
  await waitFor(() => heldSaves === 1)
  await navigate('/signup'); await signup('Newaccount')
  await waitFor(() => state.profile.name === 'Newaccount')
  let result
  await act(async () => { releaseSave(); result = await save })
  assert.match(result.message, /account changed/)
  assert.equal(state.profile.name, 'Newaccount')
})

test('failed logout keeps the profile and shows the error inside the open menu', async () => {
  await mount(); await waitFor(() => state.status === 'ready')
  await signup('Logoutfailure'); await waitFor(() => state.profile.name === 'Logoutfailure')
  await click('Menu'); failLogout = true; await click('Log Out')
  await waitFor(() => document.querySelector('dialog [role="alert"]'))
  assert.equal(document.querySelector('dialog [role="alert"]').textContent, 'Logout unavailable')
  assert.equal(state.profile.name, 'Logoutfailure')
  assert.notEqual(window.location.hash, '#/welcome')
  failLogout = false; await click('Log Out')
  await waitFor(() => window.location.hash === '#/welcome')
  assert.equal(state.profile.email, '')
})

test('overlapping auth requests stay ordered and a later failed login preserves the successful identity', async () => {
  await mount(); await waitFor(() => state.status === 'ready')
  holdAuth = new Promise(resolve => { releaseAuth = resolve })
  let signupResult, loginResult
  await act(async () => {
    signupResult = state.signUp({ name: 'Overlap', email: 'overlap@example.test', password: 'demo-password' }).catch(error => error)
  })
  await waitFor(() => heldAuth === 1)
  await act(async () => { loginResult = state.logIn('missing@example.test', 'wrong').catch(error => error) })
  assert.deepEqual(outgoingAuth, ['/api/signup'])
  let results
  await act(async () => { releaseAuth(); results = await Promise.all([signupResult, loginResult]) })
  assert.equal(results[0], undefined)
  assert.match(results[1].message, /Incorrect email or password/)
  assert.equal(state.profile.name, 'Overlap')
  const saved = await (await fetch('/api/profile')).json()
  assert.equal(saved.id, state.profile.id)
})
