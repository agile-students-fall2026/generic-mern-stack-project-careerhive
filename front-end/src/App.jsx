import mockApplications from "./data/mockApplications"

const stages = [
  "Saved",
  "Preparing",
  "Applied",
  "Interview",
  "Rejected",
  "Offer",
]

function StageSection({ stage, applications }) {
  const stageApplications = applications.filter(
    (application) => application.stage === stage
  )

  if (stageApplications.length === 0) {
    return null
  }

  const previewApplications = stageApplications.slice(0, 2)

  return (
    <section>
      <h3>
        {stage} ({stageApplications.length})
      </h3>

      {previewApplications.map((application) => (
        <div key={application.id}>
          <h4>{application.title}</h4>
          <p>{application.company}</p>
        </div>
      ))}
    </section>
  )
}

function App() {
  return (
    <main className="app">
      <h1>CareerHive</h1>
      <h2>My Tracker</h2>

      {stages.map((stage) => (
        <StageSection
          key={stage}
          stage={stage}
          applications={mockApplications}
        />
      ))}
    </main>
  )
}

export default App