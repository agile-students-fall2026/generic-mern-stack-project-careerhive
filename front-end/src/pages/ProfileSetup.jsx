import { useEffect, useRef, useState } from 'react'
import { useAppState } from '../data/useAppState.js'
import { getRoles } from '../data/api.js'
import './EditProfile.css'
import './ProfileSetup.css'
import ProfileSelect from '../components/ProfileSelect.jsx'
import { majorChoices, graduationChoices, workChoices, stateChoices } from '../data/profileChoices.js'

function ProfileSetup() {
    const appState = useAppState()
    if (appState.status === 'error') return <p role="alert">{appState.message}</p>
    if (appState.status === 'loading' || !appState.profile) return <p>Loading profile…</p>
    return <ProfileSetupForm key={appState.profile.id} profile={appState.profile} onSave={appState.saveProfile} />
}

function ProfileSetupForm({ profile, onSave }) {
    const formRef = useRef(null)
    const [draft, setDraft] = useState(() => ({ ...profile }))
    const [skillInput, setSkillInput] = useState('')
    const [roles, setRoles] = useState([])
    const [rolesError, setRolesError] = useState('')
    const [saveError, setSaveError] = useState('')
    const [saving, setSaving] = useState(false)

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
        const location = event.target.value
        if (!stateChoices.some(choice => choice.value === location) || draft.locations.includes(location)) return
        setDraft({ ...draft, locations: draft.locations.concat(location) })
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
        if (saving) return
        setSaving(true)
        setSaveError('')
        try {
            await onSave(draft)
            if (formRef.current) window.location.hash = '#/home'
        } catch (problem) {
            setSaveError(problem.message)
        } finally {
            setSaving(false)
        }
    }

    function skipProfile() {
        window.location.hash = '#/home'
    }

    return (
        <section className="auth profile-setup" ref={formRef}>
            <h1>Set Up Your Profile</h1>
            <p className="auth-lead">This helps us match you with the right roles.</p>

            <fieldset className="profile-fields" disabled={saving}>
            <ProfileSelect label="Major" name="major" value={draft.major} onChange={changeField} options={majorChoices} />
            <ProfileSelect label="Graduation date" name="graduationDate" value={draft.graduationDate} onChange={changeField} options={graduationChoices} />

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

            <ProfileSelect label="Preferred locations" name="locations" value="" onChange={addLocation} options={stateChoices} />
            <p className="edit-hint">Choose a state to add it. Click a tag to remove it.</p>
            <ul className="skill-tags">
                {draft.locations.map((location) => (
                    <li key={location}><button type="button" onClick={() => removeLocation(location)}>{location}</button></li>
                ))}
            </ul>

            <ProfileSelect label="Work authorization" name="workAuthorization" value={draft.workAuthorization} onChange={changeField} options={workChoices} />

            {saveError ? <p className="auth-error" role="alert">{saveError}</p> : null}
            <div className="setup-actions">
                <button className="ui-button" type="button" onClick={saveAndContinue}>{saving ? 'Saving…' : 'Save and continue'}</button>
                <button className="ui-button ui-button-secondary" type="button" onClick={skipProfile}>Skip for now</button>
            </div>
            </fieldset>
        </section>
    )
}

export default ProfileSetup
