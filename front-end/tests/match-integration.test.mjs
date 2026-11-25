import assert from 'node:assert/strict'
import { after, afterEach, before, beforeEach, test } from 'node:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { act, createElement, StrictMode, useEffect } from 'react'
import { JSDOM } from 'jsdom'
import { createServer } from 'vite'

const fixture = name => JSON.parse(readFileSync(new URL(`../mocks/${name}.json`, import.meta.url)))
const profile = fixture('profile')
const signedOutProfile = { id: 'profile-guest', revision: 1, name: '', email: '', photo: '', degree: '', major: '',
  school: '', graduationDate: '', skills: [], lookingFor: [], locations: [], workAuthorization: '' }
const applications = fixture('applications')
const posts = fixture('discussions')
const jobs = fixture('jobs')
const originalFetch = globalThis.fetch
let server, dom, root, App, AppState, useAppState, currentState
let requests, matchHandler, profileHandler
let applicationStore, profileStore, applicationCounter
const response = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }
function match(jobId, saved = profile, changes = {}) {
  return { jobId, profileId: saved.id, profileRevision: saved.revision, score: 92,
    summary: `Mock result for saved skills: ${saved.skills.join(', ')}`,
    fitExplanation: ['A supplied fixture explanation.'], missingSkills: ['Git'], keyQualifications: ['A supplied qualification.'], ...changes }
}


function mockApplication(path, options = {}) {
  const method = options.method ?? 'GET'

  if (path === '/api/applications') {
    if (method === 'GET') {
      return Promise.resolve(response(applicationStore))
    }

    if (method === 'POST') {
      const input = JSON.parse(options.body ?? '{}')

      if (!jobs.some(job => job.id === input.jobId)) {
        return Promise.resolve(response({ error: 'Invalid application data' }, 400))
      }

      if (applicationStore.some(item => item.jobId === input.jobId)) {
        return Promise.resolve(response({ error: 'Application already exists' }, 409))
      }

      const stage = input.stage ?? 'Saved'
      const at = new Date().toISOString()
      const created = {
        id: `test-application-${++applicationCounter}`,
        jobId: input.jobId,
        stage,
        note: input.note ?? '',
        updatedAt: at,
        history: [{ stage, at }],
      }

      applicationStore.push(created)
      return Promise.resolve(response(created, 201))
    }

    return Promise.resolve(response({ error: 'Method not allowed' }, 405))
  }

  const prefix = '/api/applications/'
  const id = decodeURIComponent(path.slice(prefix.length))
  const index = applicationStore.findIndex(item => item.id === id)

  if (index === -1) {
    return Promise.resolve(response({ error: 'Application not found' }, 404))
  }

  if (method === 'GET') {
    return Promise.resolve(response(applicationStore[index]))
  }

  if (method === 'DELETE') {
    applicationStore.splice(index, 1)
    return Promise.resolve(new Response(null, { status: 204 }))
  }

  if (method === 'POST' || method === 'PATCH') {
    const change = JSON.parse(options.body ?? '{}')
    const current = applicationStore[index]
    const at = new Date().toISOString()

    const stageChanged = Object.hasOwn(change, 'stage') &&
      change.stage !== current.stage

    const updated = {
      ...current,
      ...(Object.hasOwn(change, 'stage') ? { stage: change.stage } : {}),
      ...(Object.hasOwn(change, 'note') ? { note: change.note } : {}),
      updatedAt: at,
      history: stageChanged
        ? [...current.history, { stage: change.stage, at }]
        : [...current.history],
    }

    applicationStore[index] = updated
    return Promise.resolve(response(updated))
  }

  return Promise.resolve(response({ error: 'Method not allowed' }, 405))
}

function serve(url, options = {}) {
  const path = String(url)
  if (path === '/api/roles') return Promise.resolve(response(fixture('roles')))
  if (path === '/api/logout') return Promise.resolve(response({ ok: true, profile: signedOutProfile }))
  if (path === '/api/profile') {
    if (options.method === 'POST') {
      const nextProfile = JSON.parse(options.body)
      profileStore = {
        ...nextProfile,
        id: profileStore.id,
        revision: profileStore.revision + 1,
      }
      return Promise.resolve(response(profileStore))
    }
    return profileHandler()
  }

  if (path === '/api/applications' || path.startsWith('/api/applications/')) {
    return mockApplication(path, options)
  }
  if (path === '/api/discussions') return Promise.resolve(response(posts))
  if (path === '/api/jobs') return Promise.resolve(response(jobs))
  if (path.startsWith('/api/jobs/')) return Promise.resolve(response(jobs.find(job => path === `/api/jobs/${job.id}`) ?? null))
  if (path.startsWith('/api/matches/')) {
    const saved = options.body ? JSON.parse(options.body).profile : profile
    const request = { jobId: decodeURIComponent(path.slice('/api/matches/'.length)), profile: saved, options }
    requests.push(request)
    return matchHandler(request)
  }
  return Promise.resolve(response(null, 404))
}
before(async () => {
  server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), server: { middlewareMode: true, hmr: false, watch: null }, logLevel: 'silent' })
  ;({ default: App } = await server.ssrLoadModule('/src/App.jsx'))
  ;({ default: AppState } = await server.ssrLoadModule('/src/data/AppState.jsx'))
  ;({ useAppState } = await server.ssrLoadModule('/src/data/useAppState.js'))
})
beforeEach(async () => {
  dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/#/jobs' })
  globalThis.window = dom.window
  globalThis.document = dom.window.document
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  dom.window.scrollTo = () => {}
  dom.window.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  dom.window.HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
  requests = []
  applicationStore = structuredClone(applications)
  profileStore = structuredClone(profile)
  applicationCounter = 0

  profileHandler = () => Promise.resolve(response(profileStore))
  matchHandler = request => Promise.resolve(response(match(request.jobId, request.profile)))
  globalThis.fetch = serve
  const { createRoot } = await import('react-dom/client')
  root = createRoot(document.getElementById('root'))
})
afterEach(async () => {
  await act(async () => root.unmount())
  dom.window.close()
  globalThis.fetch = originalFetch
  delete globalThis.window
  delete globalThis.document
  delete globalThis.IS_REACT_ACT_ENVIRONMENT
})
after(async () => { await server.close() })
const tick = () => new Promise(resolve => setTimeout(resolve, 0))
async function waitFor(check) {
  for (let attempt = 0; attempt < 60; attempt++) { if (check()) return; await act(tick) }
  assert.fail(`Expected UI/state did not appear: ${document.body.textContent}`)
}
function Capture() {
  const state = useAppState()
  useEffect(() => { currentState = state }, [state])
  return null
}
async function mount(route = '/jobs') {
  window.history.replaceState(null, '', `#${route}`)
  await act(async () => root.render(createElement(StrictMode, null, createElement(AppState, null, createElement(Capture), createElement(App)))))
}
async function navigate(route) { await act(async () => { window.location.hash = `#${route}`; await tick() }) }
async function click(element) { assert.ok(element, 'Expected clickable control'); await act(async () => { element.click(); await tick() }) }
const button = text => Array.from(document.querySelectorAll('button')).find(item => item.textContent.trim() === text)
async function type(element, value, key) {
  assert.ok(element)
  await act(async () => {
    Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set.call(element, value)
    element.dispatchEvent(new dom.window.Event('input', { bubbles: true }))
    if (key) element.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key, bubbles: true }))
    await tick()
  })
}
const detailRoute = index => `/jobs/${encodeURIComponent(jobs[index].id)}`
const contains = text => document.body.textContent.includes(text)

test('deadline tabs exclude yesterday, retain today, and respect week/month boundaries', async (context) => {
  context.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-19T16:00:00Z') })
  const deadlines = ['2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22', '2026-11-30', '2026-12-01', null, '2026-11-20']
  const catalog = jobs.map((job, index) => ({ ...job, deadline: deadlines[index] }))
  applicationStore = catalog.map((job, index) => ({ ...applications[0], id: `deadline-${index}`, jobId: job.id, stage: 'Saved' }))
  applicationStore[8].stage = 'Offer'
  applicationStore.push({ ...applicationStore[8], id: 'rejected', stage: 'Rejected' })
  globalThis.fetch = (url, options) => String(url) === '/api/jobs' ? Promise.resolve(response(catalog)) : serve(url, options)
  await mount('/deadlines')
  await waitFor(() => document.querySelector('.deadlines'))
  const dates = () => [...document.querySelectorAll('.deadline-row')].map(row => row.firstElementChild.textContent)
  assert.deepEqual(dates(), ['Nov 19, 2026', 'Nov 20, 2026', 'Nov 21, 2026'])
  assert.match(document.querySelector('.deadline-row').textContent, /Today/)
  assert.match(document.querySelectorAll('.deadline-row')[1].textContent, /1 day left/)
  await click(button('This month'))
  assert.deepEqual(dates(), ['Nov 19, 2026', 'Nov 20, 2026', 'Nov 21, 2026', 'Nov 22, 2026', 'Nov 30, 2026'])
  await click(button('All'))
  assert.deepEqual(dates(), ['Nov 19, 2026', 'Nov 20, 2026', 'Nov 21, 2026', 'Nov 22, 2026', 'Nov 30, 2026', 'Dec 1, 2026'])
  await click([...document.querySelectorAll('.deadline-row')].at(-1))
  assert.equal(document.querySelector('h2').textContent, catalog[6].title)
  await act(async () => currentState.updateApplication('deadline-6', { stage: 'Offer' }))
  await click(button('Back to Tracker'))
  assert.equal(dates().length, 5, 'Stage changes must update the same deadline list')
  context.mock.timers.setTime(Date.parse('2027-12-31T16:00:00Z'))
  await click(button('This week'))
  assert.ok(contains('No deadlines in this range.'))
})

test('deadline week spans New Year while this month ends in December', async (context) => {
  context.mock.timers.enable({ apis: ['Date'], now: new Date('2026-12-31T16:00:00Z') })
  const deadlines = ['2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02', '2027-01-03']
  const catalog = jobs.slice(0, deadlines.length).map((job, index) => ({ ...job, deadline: deadlines[index] }))
  applicationStore = catalog.map((job, index) => ({ ...applications[0], id: `year-${index}`, jobId: job.id, stage: 'Applied' })).reverse()
  globalThis.fetch = (url, options) => String(url) === '/api/jobs' ? Promise.resolve(response(catalog)) : serve(url, options)
  await mount('/deadlines')
  await waitFor(() => document.querySelector('.deadlines'))
  const dates = () => [...document.querySelectorAll('.deadline-row')].map(row => row.firstElementChild.textContent)
  assert.deepEqual(dates(), ['Dec 31, 2026', 'Jan 1, 2027', 'Jan 2, 2027'])
  await click(button('This month'))
  assert.deepEqual(dates(), ['Dec 31, 2026'])
  await click(button('All'))
  assert.deepEqual(dates(), ['Dec 31, 2026', 'Jan 1, 2027', 'Jan 2, 2027', 'Jan 3, 2027'])
})

test('Home refreshes recommendations for the saved profile and ignores superseded results', async () => {
  const recommendations = () => document.querySelectorAll('.home-recommendation')
  await mount('/home')
  await waitFor(() => recommendations().length === 2)
  const initialRequests = requests.length
  await act(async () => currentState.updateApplication(applications[0].id, { note: 'Follow up next week.' }))
  assert.equal(requests.length, initialRequests, 'Application edits must not refetch profile matches')

  const previous = deferred(), latest = deferred()
  matchHandler = request => (request.profile.revision === 2 ? previous : latest).promise.then(() =>
    response(match(request.jobId, request.profile, { summary: `Home profile revision ${request.profile.revision}` })))
  await act(async () => currentState.saveProfile({ ...currentState.profile, skills: ['Git'] }))
  await waitFor(() => requests.some(request => request.profile.revision === 2))
  assert.ok(contains('Loading recommendations'))
  assert.equal(recommendations().length, 0)
  await act(async () => currentState.saveProfile({ ...currentState.profile, skills: ['React'] }))
  await waitFor(() => requests.some(request => request.profile.revision === 3))
  assert.ok(requests.filter(request => request.profile.revision === 2).every(request => request.options.signal.aborted))
  await act(async () => latest.resolve())
  await waitFor(() => recommendations().length === 2)
  assert.ok(contains('Home profile revision 3'))
  await act(async () => previous.resolve())
  assert.ok(!contains('Home profile revision 2'))
  await act(async () => currentState.saveProfile({ ...currentState.profile, skills: [] }))
  await waitFor(() => contains('We need your profile information'))
  assert.equal(recommendations().length, 0)
})

test('match starts loading and a network failure is retryable without leaving a loading state', async () => {
  const pending = deferred()
  matchHandler = () => pending.promise
  await mount(detailRoute(0))
  await waitFor(() => requests.length === 1)
  assert.ok(contains('Loading match analysis'))
  await act(async () => pending.resolve(response({ error: 'offline' }, 503)))
  await waitFor(() => Boolean(button('Try again')))
  assert.ok(!contains('Loading match analysis'))
  const retry = deferred()
  matchHandler = () => retry.promise
  await click(button('Try again'))
  await waitFor(() => requests.length === 2)
  assert.ok(contains('Loading match analysis'))
  await act(async () => retry.resolve(response(match(jobs[0].id))))
  await waitFor(() => Boolean(button('See full analysis')))
  assert.equal(requests[1].options.method, 'POST')
  assert.equal(requests[1].profile.id, profile.id)
})

test('switching jobs aborts the previous match and hides its score until the new result arrives', async () => {
  const later = deferred()
  await mount(detailRoute(0))
  await waitFor(() => Boolean(button('See full analysis')))
  matchHandler = () => later.promise
  await navigate(detailRoute(1))
  await waitFor(() => requests.length === 2)
  assert.ok(contains('Loading match analysis'))
  assert.ok(!contains('Mock result for saved skills:'))
  assert.equal(requests[0].options.signal.aborted, true)
  await act(async () => later.resolve(response(match(jobs[1].id, profile, { summary: 'The second job result.' }))))
  await waitFor(() => contains('The second job result.'))
})

test('an obsolete old-job response cannot replace a newer job result', async () => {
  const old = deferred()
  matchHandler = () => old.promise
  await mount(detailRoute(0))
  await waitFor(() => requests.length === 1)
  matchHandler = request => Promise.resolve(response(match(request.jobId, request.profile, { summary: 'Current job result.' })))
  await navigate(detailRoute(1))
  await waitFor(() => contains('Current job result.'))
  await act(async () => old.resolve(response(match(jobs[0].id, profile, { summary: 'Obsolete job result.' }))))
  assert.ok(contains('Current job result.'))
  assert.ok(!contains('Obsolete job result.'))
})

test('Cancel preserves saved profile while Save refreshes analysis for its new revision', async () => {
  await mount(detailRoute(0))
  await waitFor(() => Boolean(button('See full analysis')))
  await navigate('/profile/edit')
  await waitFor(() => Boolean(document.querySelector('input[name="name"]')))
  await type(Array.from(document.querySelectorAll('label')).find(label => label.textContent.trim() === 'Add a skill')?.querySelector('input'), 'Git')
  const skillInput = Array.from(document.querySelectorAll('label')).find(label => label.textContent.trim() === 'Add a skill').querySelector('input')
  await act(async () => skillInput.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true })))
  await click(button('Cancel'))
  assert.equal(currentState.profile.revision, profile.revision)
  assert.ok(!currentState.profile.skills.includes('Git'))
  await navigate('/profile/edit')
  await waitFor(() => Boolean(document.querySelector('input[name="name"]')))
  const input = Array.from(document.querySelectorAll('label')).find(label => label.textContent.trim() === 'Add a skill').querySelector('input')
  await type(input, 'Git')
  await act(async () => input.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true })))
  await click(button('Save Changes'))
  assert.ok(currentState.profile.skills.includes('Git'))
  await navigate(detailRoute(0))
  await waitFor(() => Boolean(button('See full analysis')))
  assert.equal(requests.at(-1).profile.revision, profile.revision + 1)
  assert.ok(contains('Mock result for saved skills: Python, JavaScript, SQL, React, Git'))
})

test('a late retry for an older profile cannot overwrite a saved-profile result', async () => {
  matchHandler = () => Promise.resolve(response(null, 503))
  await mount(detailRoute(0))
  await waitFor(() => Boolean(button('Try again')))
  const oldRetry = deferred()
  matchHandler = () => oldRetry.promise
  await click(button('Try again'))
  await waitFor(() => requests.length === 2)
  await act(async () => currentState.saveProfile({ ...profile, skills: [...profile.skills, 'Git'] }))
  const latest = deferred()
  // A profile update can start immediately; resolve the last request independently of its saved revision.
  matchHandler = () => latest.promise
  await navigate('/profile')
  await navigate(detailRoute(0))
  await waitFor(() => requests.at(-1).profile.revision === 2)
  await act(async () => latest.resolve(response(match(jobs[0].id, { ...profile, revision: 2, skills: [...profile.skills, 'Git'] }, { summary: 'Saved profile result.' }))))
  await waitFor(() => contains('Saved profile result.'))
  await act(async () => oldRetry.resolve(response(match(jobs[0].id, profile, { summary: 'Stale retry result.' }))))
  assert.ok(contains('Saved profile result.'))
  assert.ok(!contains('Stale retry result.'))
})

for (const [name, changes] of [
  ['another job', { jobId: 'other-job' }], ['another profile', { profileId: 'other-profile' }],
  ['old profile revision', { profileRevision: 0 }], ['invalid score', { score: 101 }],
  ['malformed details', { fitExplanation: null }],
]) {
  test(`a response for ${name} is rejected before rendering analysis`, async () => {
    matchHandler = request => Promise.resolve(response(match(request.jobId, request.profile, changes)))
    await mount(detailRoute(0))
    await waitFor(() => contains('Match analysis could not be loaded.'))
    assert.equal(button('See full analysis'), undefined)
  })
}

test('an incomplete profile offers real edit navigation without requesting a match', async () => {
  profileHandler = () => Promise.resolve(response({ ...profile, skills: [] }))
  await mount(detailRoute(0))
  await waitFor(() => Boolean(button('Complete profile')))
  assert.equal(requests.length, 0)
  await click(button('Complete profile'))
  await waitFor(() => contains('Edit Profile'))
  assert.equal(window.location.hash, '#/profile/edit')
})

test('missing startup profile shows the load error instead of an endless profile spinner', async () => {
  profileHandler = () => Promise.resolve(response(null, 404))
  await mount('/profile/edit')
  await waitFor(() => contains('Could not load CareerHive data.'))
  assert.ok(!contains('Loading profile'))
})

test('logout restores saved session records and clears Browse controls without a reload', async () => {
  await mount('/jobs')
  await waitFor(() => currentState.status === 'ready' && Boolean(document.querySelector('input[type="search"]')))
  await act(async () => {
    const profileSave = currentState.saveProfile({
      ...profile,
      name: 'Edited session name',
    })

    const applicationSave = currentState.updateApplication(
      applications[0].id,
      { note: 'Edited note' }
    )

    currentState.addPost(jobs[0].id, {
      topic: 'Interview',
      body: 'Session post',
      anonymous: true,
    })

    await Promise.all([profileSave, applicationSave])
  })
  await type(document.querySelector('input[type="search"]'), 'Brightspace')
  await click(button('Menu'))
  await click(Array.from(document.querySelectorAll('a,button')).find(item => item.textContent.trim() === 'Log Out'))
  await waitFor(() => window.location.hash === '#/welcome')
  assert.deepEqual(currentState.profile, signedOutProfile)
  assert.deepEqual(currentState.applications, applicationStore)

  assert.equal(
    currentState.applications.find(
      item => item.id === applications[0].id
    ).note,
    'Edited note'
  )
  assert.deepEqual(currentState.posts, posts)
  await navigate('/jobs')
  await waitFor(() => Boolean(document.querySelector('input[type="search"]')))
  assert.equal(document.querySelector('input[type="search"]').value, '')
})

test('a canceled StrictMode startup cannot overwrite a later saved session', async () => {
  const obsolete = deferred()
  let loads = 0
  profileHandler = () => ++loads === 1 ? obsolete.promise : Promise.resolve(response(profile))
  await mount('/profile')
  await waitFor(() => currentState.status === 'ready')
  await act(async () => currentState.saveProfile({ ...profile, name: 'Saved after startup' }))
  await act(async () => obsolete.resolve(response({ ...profile, name: 'Obsolete startup' })))
  assert.equal(currentState.profile.name, 'Saved after startup')
})

test('queued shared updates preserve earlier application changes and distinct posts', async () => {
  await mount('/profile')
  await waitFor(() => currentState.status === 'ready')
  await act(async () => {
    const stageWrite = currentState.updateApplication(
      applications[0].id, { stage: 'Applied' }
    )
    const noteWrite = currentState.updateApplication(
      applications[0].id, { note: 'Keep the new stage' }
    )

    currentState.addPost(jobs[0].id, {
      topic: 'Interview', body: 'First post', anonymous: false,
    })
    currentState.addPost(jobs[0].id, {
      topic: 'Interview', body: 'Second post', anonymous: false,
    })

    await Promise.all([stageWrite, noteWrite])
  })
  const updated = currentState.applications.find(item => item.id === applications[0].id)
  assert.equal(updated.stage, 'Applied')
  assert.equal(updated.note, 'Keep the new stage')
  assert.equal(currentState.posts.length, posts.length + 2)
  assert.notEqual(currentState.posts[0].id, currentState.posts[1].id)
})


test('application writes remain ordered when a later response is ready first', async () => {
  await mount('/profile')
  await waitFor(() => currentState.status === 'ready')

  const original = applications[0]
  const id = original.id
  const firstResponse = deferred()
  const secondResponse = deferred()
  const sent = []

  const previousFetch = globalThis.fetch
  globalThis.fetch = (url, options = {}) => {
    if (
      String(url) === '/api/applications/' + encodeURIComponent(id) &&
      options.method === 'POST'
    ) {
      const change = JSON.parse(options.body)
      sent.push(change)

      return Object.hasOwn(change, 'stage')
        ? firstResponse.promise
        : secondResponse.promise
    }

    return previousFetch(url, options)
  }

  let stageWrite
  let noteWrite

  await act(async () => {
    stageWrite = currentState.updateApplication(id, { stage: 'Applied' })
    noteWrite = currentState.updateApplication(id, { note: 'Keep both changes' })
    await tick()
  })

  // The second write must wait while the first is pending.
  assert.deepEqual(sent, [{ stage: 'Applied' }])

  const at = new Date().toISOString()
  const stageResult = {
    ...original,
    stage: 'Applied',
    updatedAt: at,
    history: [...original.history, { stage: 'Applied', at }],
  }

  // Make the second response ready before releasing the first.
  secondResponse.resolve(
    response({ ...stageResult, note: 'Keep both changes' })
  )

  await act(async () => { await tick() })
  assert.equal(sent.length, 1)

  firstResponse.resolve(response(stageResult))

  await act(async () => {
    await Promise.all([stageWrite, noteWrite])
  })

  assert.deepEqual(sent, [
    { stage: 'Applied' },
    { note: 'Keep both changes' },
  ])

  const saved = currentState.applications.find(item => item.id === id)
  assert.equal(saved.stage, 'Applied')
  assert.equal(saved.note, 'Keep both changes')
})


const roleInput = role => Array.from(document.querySelectorAll('label'))
  .find(label => label.textContent.trim() === role)?.querySelector('input[type="checkbox"]')

test('preferred role changes stay in the profile draft and Cancel preserves saved roles', async () => {
  await mount('/profile/edit')
  await waitFor(() => Boolean(roleInput('Internships')))
  assert.ok(roleInput('Internships'), 'Expected internship preference checkbox')
  assert.equal(roleInput('Internships').checked, true)
  assert.equal(roleInput('Full-time entry-level roles').checked, false)
  await click(roleInput('Full-time entry-level roles'))
  assert.equal(roleInput('Full-time entry-level roles').checked, true)
  assert.deepEqual(currentState.profile.lookingFor, profile.lookingFor)
  await click(button('Cancel'))
  assert.deepEqual(currentState.profile.lookingFor, profile.lookingFor)
  assert.equal(currentState.profile.revision, profile.revision)
  await navigate('/profile/edit')
  await waitFor(() => Boolean(document.querySelector('input[name="name"]')))
  assert.equal(roleInput('Full-time entry-level roles').checked, false)
})

test('saved role selections reopen correctly and can be cleared without changing other preferences', async () => {
  await mount('/profile/edit')
  await waitFor(() => Boolean(roleInput('Full-time entry-level roles')))
  assert.ok(roleInput('Full-time entry-level roles'), 'Expected entry-level preference checkbox')
  await click(roleInput('Full-time entry-level roles'))
  await click(button('Save Changes'))
  assert.deepEqual(currentState.profile.lookingFor, ['Internships', 'Full-time entry-level roles'])
  assert.equal(currentState.profile.revision, profile.revision + 1)
  assert.deepEqual(currentState.profile.skills, profile.skills)
  assert.deepEqual(currentState.profile.locations, profile.locations)
  await navigate('/profile/edit')
  await waitFor(() => Boolean(roleInput('Internships')))
  assert.equal(roleInput('Internships').checked, true)
  assert.equal(roleInput('Full-time entry-level roles').checked, true)
  await click(roleInput('Internships'))
  await click(roleInput('Full-time entry-level roles'))
  await click(button('Save Changes'))
  assert.deepEqual(currentState.profile.lookingFor, [])
  assert.deepEqual(currentState.profile.skills, profile.skills)
  assert.deepEqual(currentState.profile.locations, profile.locations)
})

test('a saved listing shows its current stage and opens the matching application', async () => {
  const saved = applications.find(item => item.jobId === jobs[0].id)
  await mount(detailRoute(0))
  await waitFor(() => Boolean(document.querySelector('a[target="_blank"]')))
  const trackerLink = () => [...document.querySelectorAll('a')].find(link => link.textContent === `In Tracker: ${currentState.applications.find(item => item.id === saved.id)?.stage}`)
  assert.ok(trackerLink(), 'Saved jobs must expose their current Tracker stage')
  assert.equal(button('Save to Tracker'), undefined)
  await click(trackerLink())
  await waitFor(() => contains('Application Details'))
  assert.ok(contains(jobs[0].title))
  assert.equal(document.querySelector('textarea').value, saved.note)
  assert.equal(document.querySelector('#application-stage').value, saved.stage)
  await act(async () => currentState.updateApplication(saved.id, { stage: 'Offer' }))
  await navigate(detailRoute(0))
  await waitFor(() => Boolean(trackerLink()))
  assert.equal(trackerLink().textContent, 'In Tracker: Offer')
  await act(async () => currentState.removeApplication(saved.id))
  await waitFor(() => Boolean(button('Save to Tracker')))
  assert.equal(trackerLink(), undefined)
})

test('saving a new listing links directly to its application with the selected stage and note', async () => {
  const job = jobs.find(job => !applications.some(item => item.jobId === job.id))
  await mount(`/jobs/${job.id}`)
  await waitFor(() => Boolean(button('Save to Tracker')))
  await click(button('Save to Tracker'))
  
  await act(async () => {
    const stage = document.querySelector('#save-tracker-stage')
    stage.value = 'Preparing'
    stage.dispatchEvent(new window.Event('change', { bubbles: true }))
    const note = document.querySelector('#save-tracker-note')
    Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype, 'value').set.call(note, 'Review the portfolio requirements.')
    note.dispatchEvent(new window.Event('input', { bubbles: true }))
  })
  await click(button('Save'))
  await waitFor(() =>
    currentState.applications.some(item => item.jobId === job.id)
  )
  const saved = currentState.applications.find(item => item.jobId === job.id)
  assert.ok(saved)
  const trackerLink = [...document.querySelectorAll('a')].find(link => link.textContent === 'In Tracker: Preparing')
  assert.ok(trackerLink, 'A successful save must replace the save action with a selected-application link')
  assert.equal(trackerLink.getAttribute('href'), `#/tracker?application=${encodeURIComponent(saved.id)}`)
  assert.equal(button('Save to Tracker'), undefined)
  await click(trackerLink)
  await waitFor(() => contains('Application Details'))
  assert.ok(contains(job.title))
  assert.equal(document.querySelector('#application-stage').value, 'Preparing')
  assert.equal(document.querySelector('textarea').value, 'Review the portfolio requirements.')
  await click(button('Back to Tracker'))
  await waitFor(() => contains('My Tracker'))
  await navigate('/tracker?stage=Applied')
  await waitFor(() => document.querySelector('select')?.value === 'Applied')
  await navigate('/tracker?application=missing-application')
  await waitFor(() => contains('My Tracker') && document.querySelector('select')?.value === 'All')
})


test('failed Tracker removal keeps the application and shows an error', async () => {
  const saved = applications[0]
  const original = globalThis.fetch

  globalThis.fetch = (url, options = {}) => {
    if (
      String(url) === `/api/applications/${encodeURIComponent(saved.id)}` &&
      options.method === 'DELETE'
    ) {
      return Promise.resolve(
        response({ error: 'Test deletion failed' }, 500)
      )
    }
    return original(url, options)
  }

  dom.window.confirm = () => true

  await mount(`/tracker?application=${encodeURIComponent(saved.id)}`)
  await waitFor(() => contains('Application Details'))

  const removeButton = [...document.querySelectorAll('button')]
    .find(item => /remove/i.test(item.textContent))

  await click(removeButton)
  await click(button('Yes, remove'))
  await waitFor(() => contains('Test deletion failed'))

  assert.ok(contains('Application Details'))
  assert.ok(
    currentState.applications.some(item => item.id === saved.id)
  )
})


test('failed Save to Tracker preserves the selected stage and note draft', async () => {
  const job = jobs.find(item =>
    !applications.some(application => application.jobId === item.id)
  )

  const original = globalThis.fetch

  globalThis.fetch = (url, options = {}) => {
    if (
      String(url) === '/api/applications' &&
      options.method === 'POST'
    ) {
      return Promise.resolve(
        response({ error: 'Test save failed' }, 500)
      )
    }
    return original(url, options)
  }

  await mount(`/jobs/${encodeURIComponent(job.id)}`)
  await waitFor(() => Boolean(button('Save to Tracker')))
  await click(button('Save to Tracker'))

  await act(async () => {
    const stage = document.querySelector('#save-tracker-stage')
    stage.value = 'Preparing'
    stage.dispatchEvent(new dom.window.Event('change', { bubbles: true }))

    const note = document.querySelector('#save-tracker-note')
    Object.getOwnPropertyDescriptor(
      dom.window.HTMLTextAreaElement.prototype, 'value'
    ).set.call(note, 'Important draft note')
    note.dispatchEvent(new dom.window.Event('input', { bubbles: true }))
  })

  await click(button('Save'))
  await waitFor(() => contains('Test save failed'))

  assert.equal(
    document.querySelector('#save-tracker-stage').value,
    'Preparing'
  )
  assert.equal(
    document.querySelector('#save-tracker-note').value,
    'Important draft note'
  )
  assert.equal(
    currentState.applications.some(item => item.jobId === job.id),
    false
  )
})


for (const { route, selector } of [
  { route: '/home', selector: '.home-deadline' },
  { route: '/deadlines', selector: '.deadline-row' },
]) {
  test(`failed removal from ${route} keeps Application Details open`, async () => {
    const saved = applications[0]
    const savedJob = jobs.find(job => job.id === saved.jobId)
    const originalDeadline = savedJob.deadline
    const originalFetch = globalThis.fetch

    // Ensure the saved application has an upcoming deadline.
    savedJob.deadline = '2099-12-31'

    globalThis.fetch = (url, options = {}) => {
      if (
        String(url).startsWith('/api/applications/') &&
        options.method === 'DELETE'
      ) {
        return Promise.resolve(
          response({ error: 'Test deletion failed' }, 500)
        )
      }

      return originalFetch(url, options)
    }

    dom.window.confirm = () => true

    try {
      await mount(route)

      if (route === '/deadlines') {
        await waitFor(() => Boolean(button('All')))
        await click(button('All'))
      }

      await waitFor(() => Boolean(document.querySelector(selector)))

      const originalIds = currentState.applications.map(item => item.id)

      await click(document.querySelector(selector))
      await waitFor(() => contains('Application Details'))

      const removeButton = [...document.querySelectorAll('button')]
        .find(item => /remove/i.test(item.textContent))
       
      await click(removeButton)
      await click(button('Yes, remove'))
      await waitFor(() => contains('Test deletion failed'))

      // A failed DELETE must not close Details or remove the record.
      assert.ok(contains('Application Details'))
      assert.deepEqual(
        currentState.applications.map(item => item.id),
        originalIds
      )
    } finally {
      savedJob.deadline = originalDeadline
    }
  })
}
