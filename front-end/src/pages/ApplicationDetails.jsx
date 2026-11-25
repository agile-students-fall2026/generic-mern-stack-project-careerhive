
import { useState } from "react"
import { formatJobDate } from '../jobs/formatters.js'

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
  const [confirmingRemove, setConfirmingRemove] = useState(false)

  async function runAction(action) {
    setActionError('')

    try {
      await action()
      return true
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : 'Unable to update application.'
      )
      return false
    }
  }

  async function handleUpdateStage() {
    if (!stageChanged) return

    await runAction(() => onStageChange(draftStage))
  }

  function handleCancelStage() {

  setDraftStage(application.stage)
  
  }

  async function handleSaveNote() {
    await runAction(() => onNoteSave(draftNote))
  }

  async function handleClearNote() {
    const previousNote = draftNote
    setDraftNote('')

    const saved = await runAction(() => onNoteSave(''))

    if (!saved) {
      setDraftNote(previousNote)
    }
  }

  async function handleRemove() {
    await runAction(() => onRemove())

  }

  return (
    <main className="app">
      <button onClick={onBack}>
        Back to Tracker
      </button>

      <h1>Application Details</h1>
      {actionError ? <p role="alert">{actionError}</p> : null}

      <h2>{job?.title || "Unknown job"}</h2>
      <p>{job?.company || "Unknown company"}</p>
      <a href={`#/jobs/${encodeURIComponent(application.jobId)}`}>
        View job listing
      </a>
      <section>
        <h3>Current Stage</h3>

        <label htmlFor="application-stage">
          Application Stage
        </label>

        <select
          id="application-stage"
          value={draftStage}
          onChange={(event) =>
            setDraftStage(event.target.value)
          }
        >
          {stages.map((stage) => (
            <option
              key={stage}
              value={stage}
            >
              {stage}
            </option>
          ))}
        </select>

        <div>
          <button
            type="button"
            onClick={handleUpdateStage}
            disabled={!stageChanged}
          >
            Update
          </button>

          <button
            type="button"
            onClick={handleCancelStage}
            disabled={!stageChanged}
          >
            Cancel
          </button>
        </div>
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
          value={draftNote}
          onChange={(event) =>
            setDraftNote(event.target.value)
          }
          rows="5"
          placeholder="Add notes about this application"
        />

        <div>
          <button
            onClick={handleSaveNote}
            disabled={!noteChanged}
          >
            Save Note
          </button>

          <button
            onClick={handleClearNote}
            disabled={
              draftNote === "" && savedNote === ""
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

                {confirmingRemove ? (
          <div role="alertdialog" aria-labelledby="remove-confirm-text">
            <p id="remove-confirm-text">
              Remove this application from your Tracker?
            </p>

            <button type="button" onClick={handleRemove}>
              Yes, remove
            </button>

            <button
              type="button"
              onClick={() => setConfirmingRemove(false)}
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmingRemove(true)}
          >
            Remove Application
          </button>
        )}
      </section>
    </main>
  )
}

export default ApplicationDetails
