
import { useEffect, useRef, useState } from "react"
import { formatJobDate } from '../jobs/formatters.js'
import './Tracker.css'

const stages = [
  "Saved",
  "Preparing",
  "Applied",
  "Interview",
  "Rejected",
  "Offer",
]

function formatDate(date) 

{
  if (!date) {
    return "None"
  }

  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function ApplicationDetails({
  application,
  job,
  onBack,
  onStageChange,
  onNoteSave,
  onRemove,
}) {
  const [draftStage, setDraftStage] = useState(
    application.stage
  )

  const stageChanged = draftStage !== application.stage

  const [draftNote, setDraftNote] = useState(
    application.note ?? ""
  )

  const savedNote = application.note ?? ""

  const noteChanged = draftNote !== savedNote

  const [actionError, setActionError] = useState('')
  const [dialog, setDialog] = useState(null)
  const dialogRef = useRef(null)
  const writing = useRef(false)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (!dialog) return
    const modal = dialogRef.current
    const trigger = document.activeElement
    const overflow = document.body.style.overflow
    modal.showModal()
    document.body.style.overflow = 'hidden'
    return () => {
      modal.close()
      document.body.style.overflow = overflow
      const target = trigger?.isConnected && trigger !== document.body ? trigger : document.querySelector('main h1[tabindex="-1"]')
      target?.focus({ preventScroll: true })
    }
  }, [dialog])

  async function runAction(action, close = false) {
    if (writing.current) return false
    writing.current = true
    setPending(true)
    setActionError('')

    try {
      await action()
      if (close) setDialog(null)
      return true
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : 'Unable to update application.'
      )
      return false
    } finally {
      writing.current = false
      setPending(false)
    }
  }

  async function handleUpdateStage() {
    if (!stageChanged) return

    await runAction(() => onStageChange(draftStage), true)
  }

  function handleCancelStage() {
    if (writing.current) return
    setDraftStage(application.stage)
    setActionError('')
    setDialog(null)
  }

  async function handleSaveNote() {
    await runAction(() => onNoteSave(draftNote))
  }

  async function handleClearNote() {
    if (await runAction(() => onNoteSave(''))) setDraftNote('')
  }

  async function handleRemove() {
    await runAction(() => onRemove())

  }

  return (
    <section className="application-details">
      <button className="ui-button ui-button-secondary" disabled={pending} onClick={onBack}>
        Back to Tracker
      </button>

      <h1>Application Details</h1>
      {actionError && !dialog ? <p role="alert">{actionError}</p> : null}

      <h2>{job?.title || "Unknown job"}</h2>
      <p>{job?.company || "Unknown company"}</p>
      <a href={`#/jobs/${encodeURIComponent(application.jobId)}`}
        onClick={() => window.history.replaceState(null, '', '#/tracker?application=' + encodeURIComponent(application.id))}>
        View job listing
      </a>
      <section>
        <h3>Current Stage</h3>
        <p>{application.stage}</p>
        <button className="ui-button ui-button-secondary" disabled={pending} onClick={() => {
          setDraftStage(application.stage); setActionError(''); setDialog('stage')
        }}>Update Stage</button>
      </section>

      <section>
        <h3>Deadline</h3>
        <p>{formatJobDate(job?.deadline) ?? "None"}</p>
      </section>

      <section>
        <h3>Last Updated</h3>
        <p>{formatDate(application.updatedAt)}</p>
      </section>

      <section>
        <h3>Stage History</h3>

        {application.history.map((item, index) => (
          <div
            key={`${item.stage}-${item.at}-${index}`}
          >
            <strong>{item.stage}</strong>
            <p>{formatDate(item.at)}</p>
          </div>
        ))}
      </section>

      <section>
        <h3>Notes</h3>

        <textarea
          id="application-note"
          aria-label="Application notes"
          className="ui-field"
          disabled={pending}
          value={draftNote}
          onChange={(event) =>
            setDraftNote(event.target.value)
          }
          rows="5"
          placeholder="Add notes about this application"
        />

        <div className="application-actions">
          <button
            className="ui-button"
            onClick={handleSaveNote}
            disabled={pending || !noteChanged}
          >
            Save Note
          </button>

          <button
            className="ui-button ui-button-secondary"
            onClick={handleClearNote}
            disabled={
              pending || (draftNote === "" && savedNote === "")
            }
          >
            Clear Note
          </button>
        </div>
      </section>

      <section>
        <h3>Remove Application</h3>

        <p>
          Removing this application will remove it from your Tracker.
        </p>

        <button className="ui-button ui-button-secondary" disabled={pending} onClick={() => {
          setActionError(''); setDialog('remove')
        }}>Remove Application</button>
      </section>
      {dialog && (
        <dialog className="application-dialog" ref={dialogRef} aria-labelledby="application-dialog-title"
          onCancel={event => { event.preventDefault(); handleCancelStage() }}>
          <h2 id="application-dialog-title">{dialog === 'stage' ? 'Update Stage' : 'Remove Application'}</h2>
          {dialog === 'stage' ? (
            <>
              <label htmlFor="application-stage">Application Stage</label>
              <select id="application-stage" className="ui-field" value={draftStage} disabled={pending}
                onChange={event => setDraftStage(event.target.value)}>
                {stages.map(stage => <option key={stage} value={stage}>{stage}</option>)}
              </select>
            </>
          ) : <p>Remove this application and its notes from your Tracker? This cannot be undone.</p>}
          {actionError && <p role="alert">{actionError}</p>}
          <div className="application-actions">
            <button className="ui-button ui-button-secondary" disabled={pending} onClick={handleCancelStage}>Cancel</button>
            <button className="ui-button" disabled={pending || (dialog === 'stage' && !stageChanged)}
              onClick={dialog === 'stage' ? handleUpdateStage : handleRemove}>
              {dialog === 'stage' ? (pending ? 'Updating…' : 'Update') : (pending ? 'Removing…' : 'Yes, remove')}
            </button>
          </div>
        </dialog>
      )}
    </section>
  )
}

export default ApplicationDetails
