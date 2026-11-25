
import { useEffect, useState } from "react"
import { useAppState } from "../data/useAppState.js"
import { getJobs } from "../jobs/api.js"
import ApplicationDetails from "./ApplicationDetails"
import './Tracker.css'

const stages = [
  "Saved",
  "Preparing",
  "Applied",
  "Interview",
  "Rejected",
  "Offer",
]

function formatDate(date) {
  if (!date) {
    return "None"
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const [year, month, day] = date.split("-")

    return new Date(
      Number(year),
      Number(month) - 1,
      Number(day)
    ).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function getJobForApplication(application, jobs) {
  return jobs.find(
    (job) => job.id === application.jobId
  )
}

function StageSection({
  stage,
  applications,
  jobs,
  sortBy,
  onViewDetails,
}) {
  const [expanded, setExpanded] = useState(false)

  const stageApplications = applications
    .filter(
      (application) => application.stage === stage
    )
    .sort((a, b) => {
      if (sortBy === "deadline") {
        const aJob = getJobForApplication(a, jobs)
        const bJob = getJobForApplication(b, jobs)

        const aDeadline = aJob?.deadline
          ? new Date(aJob.deadline).getTime()
          : Infinity

        const bDeadline = bJob?.deadline
          ? new Date(bJob.deadline).getTime()
          : Infinity

        return aDeadline - bDeadline
      }

      if (sortBy === "updated") {
        return (
          new Date(b.updatedAt).getTime() -
          new Date(a.updatedAt).getTime()
        )
      }

      return 0
    })

  if (stageApplications.length === 0) {
    return null
  }

  const visibleApplications = expanded
    ? stageApplications
    : stageApplications.slice(0, 2)

  const hiddenCount =
    stageApplications.length - 2

  return (
    <section className="tracker-stage">
      <h3>
        {stage} ({stageApplications.length})
      </h3>

      {visibleApplications.map((application) => {
        const job =
          getJobForApplication(application, jobs)

        if (!job) {
          return null
        }

        const latestHistory =
          application.history[
            application.history.length - 1
          ]

        return (
          <article className="tracker-card" key={application.id}>
            <h4>{job.title}</h4>

            <p>{job.company}</p>

            <p>
              Stage: {application.stage}
            </p>

            <p>
              Deadline: {formatDate(job.deadline)}
            </p>

            <p>
              Last updated:{" "}
              {formatDate(application.updatedAt)}
            </p>

            <p>
              Stage updated:{" "}
              {latestHistory
                ? formatDate(latestHistory.at)
                : "None"}
            </p>

            <button
              className="ui-button ui-button-secondary"
              onClick={() =>
                onViewDetails(application.id)
              }
            >
              View Details
            </button>
          </article>
        )
      })}

      {stageApplications.length > 2 && (
        <button
          className="ui-button ui-button-secondary"
          onClick={() =>
            setExpanded(!expanded)
          }
        >
          {expanded
            ? "Show less"
            : `Show ${hiddenCount} more`}
        </button>
      )}
    </section>
  )
}

function Tracker({ initialStage, initialApplicationId }) {
  const appState = useAppState()

  const [selectedStage, setSelectedStage] =
    useState(stages.includes(initialStage) ? initialStage : "All")

  const [sortBy, setSortBy] =
    useState("default")

  const [
    selectedApplicationId,
    setSelectedApplicationId,
  ] = useState(initialApplicationId || null)

  const [jobs, setJobs] = useState([])
  const [jobsStatus, setJobsStatus] =
    useState("loading")

  useEffect(() => {
    let active = true

    getJobs().then(
      (jobData) => {
        if (!active) {
          return
        }

        setJobs(jobData)
        setJobsStatus("ready")
      },
      () => {
        if (!active) {
          return
        }

        setJobs([])
        setJobsStatus("error")
      }
    )

    return () => {
      active = false
    }
  }, [])

  if (!appState) {
    return (
      <section className="tracker">
        <p>
          Application data is unavailable.
        </p>
      </section>
    )
  }

  if (
    appState.status === "loading" ||
    jobsStatus === "loading"
  ) {
    return (
      <section className="tracker">
        <p>Loading tracker...</p>
      </section>
    )
  }

  if (
    appState.status === "error" ||
    jobsStatus === "error"
  ) {
    return (
      <section className="tracker">
        <p>
          Could not load tracker data.
        </p>
      </section>
    )
  }

  const applications =
    appState.applications

  const selectedApplication =
    applications.find(
      (application) =>
        application.id ===
        selectedApplicationId
    )

  if (selectedApplication) {
    const selectedJob =
      getJobForApplication(
        selectedApplication,
        jobs
      )

    return (
      <ApplicationDetails
        application={selectedApplication}
        job={selectedJob}
        onBack={() =>
          initialApplicationId ? (window.location.hash = '#/tracker') : setSelectedApplicationId(null)
        }
        onStageChange={(newStage) =>
          appState.updateApplication(
            selectedApplication.id,
            { stage: newStage }
          )
        }
        onNoteSave={(note) =>
          appState.updateApplication(
            selectedApplication.id,
            { note }
          )
        }
        onRemove={async () => {
          await appState.removeApplication(selectedApplication.id)
          setSelectedApplicationId(null)
        }}
      />
    )
  }

  return (
    <section className="tracker">
      <h1 tabIndex={-1}>My Tracker</h1>

      <p>
        Total applications:{" "}
        {applications.length}
      </p>

      <div className="tracker-controls">
        <label>
          Stage:
          <select
            className="ui-field"
            value={selectedStage}
            onChange={(event) =>
              setSelectedStage(
                event.target.value
              )
            }
          >
            <option value="All">
              All stages
            </option>

            {stages.map((stage) => (
              <option
                key={stage}
                value={stage}
              >
                {stage}
              </option>
            ))}
          </select>
        </label>

        <label>
          Sort:
          <select
            className="ui-field"
            value={sortBy}
            onChange={(event) =>
              setSortBy(
                event.target.value
              )
            }
          >
            <option value="default">
              Default
            </option>

            <option value="deadline">
              Deadline
            </option>

            <option value="updated">
              Last Updated
            </option>
          </select>
        </label>
      </div>

      {!applications.some(application => selectedStage === 'All' || application.stage === selectedStage) && (
        <p role="status">{applications.length ? 'No applications in this stage.' : 'No tracked applications yet. Save a job to get started.'}</p>
      )}

      {stages
        .filter(
          (stage) =>
            selectedStage === "All" ||
            stage === selectedStage
        )
        .map((stage) => (
          <StageSection
            key={stage}
            stage={stage}
            applications={
              applications
            }
            jobs={jobs}
            sortBy={sortBy}
            onViewDetails={
              setSelectedApplicationId
            }
          />
        ))}
    </section>
  )
}

export default Tracker
