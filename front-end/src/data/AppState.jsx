import { useCallback, useEffect, useRef, useState } from 'react'
import { AppStateContext } from './useAppState.js'

import {
  getApplications,
  createApplication,
  postApplicationUpdate,
  deleteApplication,
  getDiscussions,
  createDiscussionPost,
  getMatch,
  getProfile,
  logIn as postLogIn,
  signUp as postSignUp,
  logOut as postLogOut,
  saveProfile as postProfile,
} from './api.js'

function AppState(props) {
  const [status, setStatus] = useState('loading')
  const [message, setMessage] = useState('')
  const [profile, setProfile] = useState(null)
  const [applications, setApplications] = useState([])
  const applicationWriteQueues = useRef(new Map())
  const [posts, setPosts] = useState([])
  const profileVersion = useRef(0)
  const profileSaving = useRef(false)
  const accountQueue = useRef(Promise.resolve())

  useEffect(() => {
    let active = true
    const version = profileVersion.current
    Promise.all([getProfile(), getApplications(), getDiscussions()])
      .then(([profile, applications, posts]) => {
        if (!active) return
        if (!profile || !Array.isArray(applications) || !Array.isArray(posts)) {
          throw new Error('Required CareerHive data is missing')
        }
        if (version === profileVersion.current) setProfile(profile)
        setApplications(applications)
        setPosts(posts)
        setStatus('ready')
      })
      .catch(() => {
        if (!active) return
        setStatus('error')
        setMessage('Could not load CareerHive data. Reload the page to try again.')
      })
    return () => { active = false }
  }, [])

  async function saveProfile(nextProfile) {
    if (profileSaving.current) throw new Error('Your profile is already saving. Please wait and try again.')
    profileSaving.current = true
    const version = profileVersion.current
    try {
      const saved = await postProfile(nextProfile)
      if (version !== profileVersion.current) throw new Error('Your account changed. Please try again.')
      setProfile(saved)
    } finally {
      profileSaving.current = false
    }
  }

  function changeAccount(action) {
    const next = accountQueue.current.catch(() => {}).then(async () => {
      const saved = await action()
      profileVersion.current++
      setProfile(saved)
    })
    accountQueue.current = next
    return next
  }

  function enqueueApplicationWrite(applicationId, task) {
    const queues = applicationWriteQueues.current
    const previous = queues.get(applicationId) ?? Promise.resolve()

    // An earlier failure must not block later writes.
    const next = previous.catch(() => {}).then(task)
    queues.set(applicationId, next)

    const cleanup = () => {
      if (queues.get(applicationId) === next) {
        queues.delete(applicationId)
      }
    }

    next.then(cleanup, cleanup)
    return next
  }

  function updateApplication(applicationId, change) {
    return enqueueApplicationWrite(applicationId, async () => {
      const updated = await postApplicationUpdate(applicationId, change)

      setApplications((previous) =>
        previous.map((application) =>
          application.id === applicationId ? updated : application
        )
      )

      return updated
    })
  }


  function removeApplication(applicationId) {
    return enqueueApplicationWrite(applicationId, async () => {
      await deleteApplication(applicationId)

      setApplications((previous) =>
        previous.filter((application) => application.id !== applicationId)
      )
    })
  }



  async function addApplication(jobId, stage = 'Saved', note = '') {
    if (status !== 'ready' || !jobId) {
      throw new Error('Tracker is currently unavailable.')
    }

    const alreadySaved = applications.some(
      (application) => application.jobId === jobId
    )

    if (alreadySaved) {
      return false
    }

    const saved = await createApplication(jobId, stage, note.trim())

    setApplications((previous) => {
      if (previous.some(
        (application) => application.jobId === saved.jobId
      )) {
        return previous
      }

      return [saved, ...previous]
    })

    return true
  }

  async function addPost(jobId, post) {
    const saved = await createDiscussionPost(jobId, post)
    setPosts((previous) => [saved, ...previous])
  }

  async function resetAll() {
    await changeAccount(postLogOut)
  }

  const matchFor = useCallback(async (jobId, options) => {
    if (!profile || !profile.major?.trim() || !profile.graduationDate?.trim()
      || !profile.workAuthorization?.trim() || !profile.skills?.some((skill) => skill.trim())) {
      return { status: 'incomplete-profile' }
    }
    const match = await getMatch(jobId, profile, options)
    return { status: 'ready', data: match }
  }, [profile])

  const value = {
    status,
    message,
    profile,
    applications,
    posts,
    saveProfile,
    logIn: (email, password) => changeAccount(() => postLogIn(email, password)),
    signUp: account => changeAccount(() => postSignUp(account)),
    updateApplication,
    addApplication,
    addPost,
    resetAll,
    matchFor,
    removeApplication,
  }

  return (
    <AppStateContext.Provider value={value}>
      {props.children}
    </AppStateContext.Provider>
  )
}


export default AppState
