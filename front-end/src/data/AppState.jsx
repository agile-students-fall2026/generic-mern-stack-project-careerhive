import { useCallback, useEffect, useRef, useState } from 'react'
import { AppStateContext } from './useAppState.js'

import {
  getApplications,
  createApplication,
  postApplicationUpdate,
  deleteApplication,
  getDiscussions,
  getMatch,
  getProfile,
  saveProfile as postProfile,
} from './api.js'

function AppState(props) {
  const [status, setStatus] = useState('loading')
  const [message, setMessage] = useState('')
  const [original, setOriginal] = useState(null)
  const [profile, setProfile] = useState(null)
  const [applications, setApplications] = useState([])
  const applicationWriteQueues = useRef(new Map())
  const [posts, setPosts] = useState([])

  useEffect(() => {
    let active = true
    Promise.all([getProfile(), getApplications(), getDiscussions()])
      .then(([profile, applications, posts]) => {
        if (!active) return
        if (!profile || !Array.isArray(applications) || !Array.isArray(posts)) {
          throw new Error('Required CareerHive data is missing')
        }
        const firstCopy = { profile, applications, posts }
        setOriginal(structuredClone(firstCopy))
        setProfile(profile)
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
    const saved = await postProfile(nextProfile)
    setProfile(saved)
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

  function addPost(jobId, post) {
    const nextPost = {
      id: 'post-' + crypto.randomUUID(),
      jobId: jobId,
      topic: post.topic,
      body: post.body,
      anonymous: Boolean(post.anonymous),
      author: post.author,
      createdAt: new Date().toISOString(),
    }
    setPosts((previous) => [nextPost, ...previous])
  }

  function resetAll() {
    if (!original) return
    const copy = structuredClone(original)
    setProfile(copy.profile)
    
    setPosts(copy.posts)
    setStatus('ready')
    setMessage('')
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
