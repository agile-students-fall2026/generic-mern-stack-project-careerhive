import { useEffect, useState } from 'react'
import { useAppState } from '../data/useAppState.js'
import { getRoles } from '../data/api.js'
import './EditProfile.css'
import './ProfileSetup.css'

const workChoices = [
    'F-1 student (will need sponsorship)',
    'U.S. citizen or permanent resident',
    'Already authorized to work in the U.S.',
]

function ProfileSetup() {
    const appState = useAppState()
    if (appState.status === 'error') return <p role="alert">{appState.message}</p>
    if (appState.status === 'loading' || !appState.profile) return <p>Loading profile…</p>
    return <ProfileSetupForm key={appState.profile.id} profile={appState.profile} onSave={appState.saveProfile} />
}

function ProfileSetupForm({ profile, onSave }) {
    const [draft, setDraft] = useState(() => ({ ...profile }))
    const [skillInput, setSkillInput] = useState('')
    const [locationInput, setLocationInput] = useState('')
    const [roles, setRoles] = useState([])
    const [rolesError, setRolesError] = useState('')
    const [saveError, setSaveError] = useState('')

    useEffect(() => {
        let active = true
        getRoles().then((list) => {
            if (!active) return
            setRoles(Array.isArray(list) ? list : [])
        }, () => {
            if (!active) return
            setRolesError('Could not load roles.')
        })
        return () => { active = false }
    }, [])

    function changeField(event) {
        setDraft({ ...draft, [event.target.name]: event.target.value })
    }

    function addSkill(event) {
        if (event.key !== 'Enter') return
        event.preventDefault()
        const skill = skillInput.trim()
        if (skill === '' || draft.skills.includes(skill)) return
        setDraft({ ...draft, skills: draft.skills.concat(skill) })
        setSkillInput('')
    }

    function removeSkill(skill) {
        setDraft({ ...draft, skills: draft.skills.filter((item) => item !== skill) })
    }

    function addLocation(event) {
        if (event.key !== 'Enter') return
        event.preventDefault()
        const location = locationInput.trim()
        if (location === '' || draft.locations.includes(location)) return
        setDraft({ ...draft, locations: draft.locations.concat(location) })
        setLocationInput('')
    }

    function removeLocation(location) {
        setDraft({ ...draft, locations: draft.locations.filter((item) => item !== location) })
    }

    function toggleRole(role) {
        const lookingFor = draft.lookingFor.includes(role)
            ? draft.lookingFor.filter((item) => item !== role)
            : draft.lookingFor.concat(role)
        setDraft({ ...draft, lookingFor })
    }

    async function saveAndContinue() {
        setSaveError('')
        try {
            await onSave(draft)
            window.location.hash = '#/home'
        } catch (problem) {
            setSaveError(problem.message)
        }
    }

    function skipProfile() {
        window.location.hash = '#/home'
    }

    const authorizationChoices = workChoices.includes(draft.workAuthorization) || draft.workAuthorization === ''
        ? workChoices
        : workChoices.concat(draft.workAuthorization)

    return (
        <section className="auth profile-setup">
            <h1>Set Up Your Profile</h1>
            <p className="auth-lead">This helps us match you with the right roles.</p>

            <label>
                Major
                <input className="ui-field" name="major" value={draft.major} onChange={changeField} />
            </label>
            <label>
                Graduation date
                <input className="ui-field" type="date" name="graduationDate" value={draft.graduationDate} onChange={changeField} />
            </label>

            <label>
                Skills
                <input className="ui-field" value={skillInput} onChange={(event) => setSkillInput(event.target.value)} onKeyDown={addSkill} />
            </label>
            <p className="edit-hint">Press Enter to add one. Click a tag to remove it.</p>
            <ul className="skill-tags">
                {draft.skills.map((skill) => (
                    <li key={skill}><button type="button" onClick={() => removeSkill(skill)}>{skill}</button></li>
                ))}
            </ul>

            <fieldset className="edit-roles">
                <legend>Looking for</legend>
                {rolesError ? <p role="alert">{rolesError}</p> : null}
                {roles.map((role) => (
                    <label key={role}>
                        <input type="checkbox" checked={draft.lookingFor.includes(role)} onChange={() => toggleRole(role)} />
                        {role}
                    </label>
                ))}
            </fieldset>

            <label>
                Preferred locations
                <input className="ui-field" value={locationInput} onChange={(event) => setLocationInput(event.target.value)} onKeyDown={addLocation} />
            </label>
            <p className="edit-hint">Press Enter to add one. Click a tag to remove it.</p>
            <ul className="skill-tags">
                {draft.locations.map((location) => (
                    <li key={location}><button type="button" onClick={() => removeLocation(location)}>{location}</button></li>
                ))}
            </ul>

            <label>
                Work authorization
                <select className="ui-field" name="workAuthorization" value={draft.workAuthorization} onChange={changeField}>
                    <option value="">Select one</option>
                    {authorizationChoices.map((choice) => <option key={choice} value={choice}>{choice}</option>)}
                </select>
            </label>

            {saveError ? <p className="auth-error" role="alert">{saveError}</p> : null}
            <div className="setup-actions">
                <button className="ui-button" type="button" onClick={saveAndContinue}>Save and continue</button>
                <button className="ui-button ui-button-secondary" type="button" onClick={skipProfile}>Skip for now</button>
            </div>
        </section>
    )
}

export default ProfileSetup