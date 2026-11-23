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
  dom = new JSDOM('<div id="root"></div>', { url: origin + '/#/signup' })
  globalThis.window = dom.window; globalThis.document = dom.window.document
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  window.scrollTo = () => {}
  window.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  window.HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
  globalThis.fetch = async (url, options = {}) => {
    if (['/api/signup', '/api/login'].includes(url)) outgoingAuth.push(url)
    if (url === '/api/logout' && failLogout) return new Response(JSON.stringify({ error: 'Logout unavailable' }), { status: 503 })
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
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(input, text)
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
