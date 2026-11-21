import { useState } from 'react'
import { useAppState } from '../data/useAppState.js'
import './EditProfile.css'
import roleChoices from '../../mocks/roles.json'

function EditProfile() {
    const appState = useAppState()
    if (appState.status === 'error') return <p role="alert">{appState.message}</p>
    if (appState.status === 'loading' || !appState.profile) return <p>Loading profile…</p>
    return <EditProfileForm key={appState.profile.id} profile={appState.profile} onSave={appState.saveProfile} />
}

function EditProfileForm({ profile, onSave }) {
    const [draft, setDraft] = useState(() => ({ ...profile }))
    const [photoOpen, setPhotoOpen] = useState(false)
    const [photoChoice, setPhotoChoice] = useState('')
    const [skillInput, setSkillInput] = useState('')
    const [locationInput, setLocationInput] = useState('')
    const [saveError, setSaveError] = useState('')

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
    function changeLocationInput(event) {
        setLocationInput(event.target.value)
    }

    function addLocation(event) {
        if (event.key !== 'Enter') return
        event.preventDefault()
        const location = locationInput.trim()
        if (location === '') return
        if (!draft.locations.includes(location)) {
            setDraft({ ...draft, locations: draft.locations.concat(location) })
        }
        setLocationInput('')
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
        setSaveError('')
        try {
            await onSave(draft)
            window.location.hash = '#/profile'
        } catch (problem) {
            setSaveError(problem.message)
        }
    }

    function cancelEdit() {
        window.location.hash = '#/profile'
    }

    return (
        <section className="edit-profile">
            <a className="ui-button ui-button-secondary profile-back" href="#/profile">Back to profile</a>
            <h1>Edit Profile</h1>
            <div className="edit-photo">
                <img src={draft.photo} alt="" width="72" height="72" />
                <button type="button" className="ui-button ui-button-secondary" onClick={openPhoto}>Change photo</button>
            </div>
    
            <section className="edit-card">
                <h2>Details</h2>
                <label>
                    Full name
                    <input className="ui-field" name="name" value={draft.name} onChange={changeField} />
                </label>
                <label>
                    Major
                    <input className="ui-field" name="major" value={draft.major} onChange={changeField} />
                </label>
                <label>
                    Graduation date
                    <input className="ui-field" name="graduationDate" value={draft.graduationDate} onChange={changeField} />
                </label>
                <label>
                    Work authorization
                    <input className="ui-field" name="workAuthorization" value={draft.workAuthorization} onChange={changeField} />
                </label>
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
                <label>
                    Add a location
                    <input className="ui-field" value={locationInput} onChange={changeLocationInput} onKeyDown={addLocation} />
                </label>
                <p className="edit-hint">Press Enter to add one. Click a tag to remove it.</p>
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
                    {roleChoices.map((role) => (
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
                <button type="button" className="ui-button" onClick={saveEdit}>Save Changes</button>
            </div>
            {photoOpen && (
                <div className="photo-dialog">
                    <div className="photo-panel">
                        <img src={photoChoice || draft.photo} alt="" width="72" height="72" />
                        <button type="button" className="ui-button ui-button-secondary" onClick={takePhoto}>Take Photo Now</button>
                        <button type="button" className="ui-button ui-button-secondary" onClick={chooseAlbum}>Choose from Album</button>
                        <div className="edit-actions">
                            <button type="button" className="ui-button ui-button-secondary" onClick={closePhoto}>Cancel</button>
                            <button type="button" className="ui-button" onClick={updatePhoto}>Update</button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    )
}

export default EditProfile
