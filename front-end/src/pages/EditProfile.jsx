import { useEffect, useRef, useState } from 'react'
import { useAppState } from '../data/useAppState.js'
import './EditProfile.css'
import { getRoles } from '../data/api.js'
import ProfileSelect from '../components/ProfileSelect.jsx'
import { majorChoices, graduationChoices, workChoices, stateChoices } from '../data/profileChoices.js'

function EditProfile() {
    const appState = useAppState()
    if (appState.status === 'error') return <p role="alert">{appState.message}</p>
    if (appState.status === 'loading' || !appState.profile) return <p>Loading profile…</p>
    return <EditProfileForm key={appState.profile.id} profile={appState.profile} onSave={appState.saveProfile} />
}

function EditProfileForm({ profile, onSave }) {
    const formRef = useRef(null)
    const [draft, setDraft] = useState(() => ({ ...profile }))
    const [photoOpen, setPhotoOpen] = useState(false)
    const [photoChoice, setPhotoChoice] = useState('')
    const [skillInput, setSkillInput] = useState('')
    const [saveError, setSaveError] = useState('')
    const [roles, setRoles] = useState([])
    const [rolesError, setRolesError] = useState('')
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
    function changeSkillInput(event) {
        setSkillInput(event.target.value)
    }
    function addSkill(event) {
        if (event.key !== 'Enter') return
        event.preventDefault()
        const skill = skillInput.trim()
        if (skill === '') return
        if (!draft.skills.includes(skill)) {
            setDraft({ ...draft, skills: draft.skills.concat(skill) })
        }
        setSkillInput('')
    }
    function removeSkill(skill) {
        setDraft({ ...draft, skills: draft.skills.filter((item) => item !== skill) })
    }
    function addLocation(event) {
        const location = event.target.value
        if (!stateChoices.some(choice => choice.value === location)) return
        if (!draft.locations.includes(location)) {
            setDraft({ ...draft, locations: draft.locations.concat(location) })
        }
    }

    function removeLocation(location) {
        setDraft({ ...draft, locations: draft.locations.filter((item) => item !== location) })
    }

    function toggleRole(role) {
        const lookingFor = draft.lookingFor.includes(role)
            ? draft.lookingFor.filter((item) => item !== role)
            : draft.lookingFor.concat(role)
        setDraft({ ...draft, lookingFor: lookingFor })
    }

    function openPhoto() {
        setPhotoChoice('')
        setPhotoOpen(true)
    }

    function closePhoto() {
        setPhotoChoice('')
        setPhotoOpen(false)
    }

    function takePhoto() {
        setPhotoChoice('https://picsum.photos/seed/careerhive-camera/80/80')
    }

    function chooseAlbum() {
        setPhotoChoice('https://picsum.photos/seed/careerhive-album/80/80')
    }

    function updatePhoto() {
        if (photoChoice !== '') {
            setDraft({ ...draft, photo: photoChoice })
        }
        closePhoto()
    }

    async function saveEdit() {
        if (saving) return
        setSaving(true)
        setSaveError('')
        try {
            await onSave(draft)
            if (formRef.current) window.location.hash = '#/profile'
        } catch (problem) {
            setSaveError(problem.message)
        } finally {
            setSaving(false)
        }
    }

    function cancelEdit() {
        window.location.hash = '#/profile'
    }

    return (
        <section className="edit-profile" ref={formRef}>
            <a className="ui-button ui-button-secondary profile-back" href="#/profile">Back to profile</a>
            <h1>Edit Profile</h1>
            <fieldset className="profile-fields" disabled={saving}>
            <div className="edit-photo">
                {draft.photo && <img src={draft.photo} alt="" width="72" height="72" />}
                <button type="button" className="ui-button ui-button-secondary" onClick={openPhoto}>Change photo</button>
            </div>
    
            <section className="edit-card">
                <h2>Details</h2>
                <label>
                    Full name
                    <input className="ui-field" name="name" value={draft.name} onChange={changeField} />
                </label>
                <ProfileSelect label="Major" name="major" value={draft.major} onChange={changeField} options={majorChoices} />
                <ProfileSelect label="Graduation date" name="graduationDate" value={draft.graduationDate} onChange={changeField} options={graduationChoices} />
                <ProfileSelect label="Work authorization" name="workAuthorization" value={draft.workAuthorization} onChange={changeField} options={workChoices} />
            </section>
    
            <section className="edit-card">
                <h2>Skills</h2>
                <label>
                    Add a skill
                    <input className="ui-field" value={skillInput} onChange={changeSkillInput} onKeyDown={addSkill} />
                </label>
                <p className="edit-hint">Press Enter to add one. Click a tag to remove it.</p>
                <ul className="skill-tags">
                    {draft.skills.map((skill) => (
                        <li key={skill}>
                            <button type="button" onClick={() => removeSkill(skill)}>{skill}</button>
                        </li>
                    ))}
                </ul>
            </section>
    
            <section className="edit-card">
                <h2>Locations</h2>
                <ProfileSelect label="Preferred locations" name="locations" value="" onChange={addLocation} options={stateChoices} />
                <p className="edit-hint">Choose a state to add it. Click a tag to remove it.</p>
                <ul className="skill-tags">
                    {draft.locations.map((location) => (
                        <li key={location}>
                            <button type="button" onClick={() => removeLocation(location)}>{location}</button>
                        </li>
                    ))}
                </ul>
            </section>
    
            <section className="edit-card">
                <h2>Looking for</h2>
                <fieldset className="edit-roles">
                    {rolesError ? <p role="alert">{rolesError}</p> : null}
                    {roles.map((role) => (
                        <label key={role}>
                            <input type="checkbox" checked={draft.lookingFor.includes(role)} onChange={() => toggleRole(role)} />
                            {role}
                        </label>
                    ))}
                </fieldset>
            </section>
    
            {saveError ? <p className="edit-error" role="alert">{saveError}</p> : null}
            <div className="edit-actions">
                <button type="button" className="ui-button ui-button-secondary" onClick={cancelEdit}>Cancel</button>
                <button type="button" className="ui-button" onClick={saveEdit}>{saving ? 'Saving…' : 'Save Changes'}</button>
            </div>
            {photoOpen && (
                <div className="photo-dialog">
                    <div className="photo-panel">
                        {(photoChoice || draft.photo) && <img src={photoChoice || draft.photo} alt="" width="72" height="72" />}
                        <button type="button" className="ui-button ui-button-secondary" onClick={takePhoto}>Take Photo Now</button>
                        <button type="button" className="ui-button ui-button-secondary" onClick={chooseAlbum}>Choose from Album</button>
                        <div className="edit-actions">
                            <button type="button" className="ui-button ui-button-secondary" onClick={closePhoto}>Cancel</button>
                            <button type="button" className="ui-button" onClick={updatePhoto}>Update</button>
                        </div>
                    </div>
                </div>
            )}
            </fieldset>
        </section>
    )
}

export default EditProfile
