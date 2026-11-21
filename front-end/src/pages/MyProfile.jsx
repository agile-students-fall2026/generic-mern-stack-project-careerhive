import { useAppState } from '../data/useAppState.js'
import './MyProfile.css'

function MyProfile() {
    const appState = useAppState()
    const profile = appState.profile

    if (appState.status === 'error') return <p role="alert">{appState.message}</p>
    if (appState.status === 'loading' || !profile) return <p>Loading profile…</p>

    return (
        <section className="profile">
            <h1>My Profile</h1>
            <div className="profile-header">
                {profile.photo === '' ? <div className="profile-photo">user photo</div> : <img className="profile-photo" src={profile.photo} alt="" width="72" height="72" />}
                <div>
                    <p className="profile-name">{profile.name === '' ? 'Name not added yet' : profile.name}</p>
                    <p className="profile-email">{profile.email === '' ? 'Email not added yet' : profile.email}</p>
                </div>
            </div>
    
            <section className="profile-card">
                <h2>Education</h2>
                {profile.major === '' ? (
                    <p>Not added yet</p>
                ) : (
                    <p>{profile.degree} {profile.major}, {profile.school}. Expected graduation: {profile.graduationDate}</p>
                )}
            </section>
    
            <section className="profile-card">
                <h2>Skills</h2>
                {profile.skills.length === 0 ? <p>Not added yet</p> : (
                    <ul className="profile-tags">
                        {profile.skills.map((skill) => <li key={skill}>{skill}</li>)}
                    </ul>
                )}
            </section>
    
            <section className="profile-card">
                <h2>Looking for</h2>
                {profile.lookingFor.length === 0 ? <p>Not added yet</p> : (
                    <ul className="profile-tags">
                        {profile.lookingFor.map((role) => <li key={role}>{role}</li>)}
                    </ul>
                )}
            </section>
    
            <section className="profile-card">
                <h2>Preferred locations</h2>
                {profile.locations.length === 0 ? <p>Not added yet</p> : (
                    <ul className="profile-tags">
                        {profile.locations.map((location) => <li key={location}>{location}</li>)}
                    </ul>
                )}
            </section>
    
            <section className="profile-card">
                <h2>Work authorization</h2>
                <p>{profile.workAuthorization === '' ? 'Not added yet' : profile.workAuthorization}</p>
            </section>
    
            <a className="ui-button profile-edit" href="#/profile/edit">Edit Profile</a>
        </section>
    )
}

export default MyProfile;