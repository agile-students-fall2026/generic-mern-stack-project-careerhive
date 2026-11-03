import { useContext } from "react";
import { Link } from "react-router-dom";
import ProfileContext from "./ProfileContext";
import "./MyProfile.css";

const MyProfile = () => {
    const profile = useContext(ProfileContext)
  
  return (
    <main className="my-profile">
      <h1 className="profile-heading">My Profile</h1>

      <section className="profile-person">
        {profile.photo === "" ? (
            <div className="profile-photo">user photo</div>
        ) : (
            <img className="profile-photo" src={profile.photo} alt="Profile" />
        )}
    <div>
          <p className="profile-name">{profile.name === "" ? "Name not added yet" : profile.name}</p>
          <p className="profile-meta">{profile.email === "" ? "Email not added yet" : profile.email}</p>
          <p className="profile-meta">
            {profile.classYear === "" ? "Class year not added yet" : "Class of " + profile.classYear}
          </p>
        </div>
      </section>
      <Link className="profile-edit" to="/edit-profile">Edit Profile</Link>
      <section className="profile-block">
        <h2 className="profile-label">Education</h2>
        {profile.major === "" ? (
          <p className="profile-missing">Not added yet</p>
        ) : (
          <div>
            <p className="profile-meta">{profile.degree} {profile.major}, {profile.school}</p>
            <p className="profile-meta">Expected Graduation: {profile.graduationDate}</p>
          </div>
        )}
      </section>
      <section className="profile-block">
        <h2 className="profile-label">Skills</h2>
        {profile.skills.length === 0 ? (
          <p className="profile-missing">Not added yet</p>
        ) : (
          <ul className="profile-tags">
            {profile.skills.map(skill => (
              <li className="profile-tag" key={skill}>{skill}</li>
            ))}
          </ul>
        )}
      </section>
      <section className="profile-block">
        <h2 className="profile-label">Looking for</h2>
        {profile.lookingFor.length === 0 ? (
          <p className="profile-missing">Not added yet</p>
        ) : (
          <ul className="profile-tags">
            {profile.lookingFor.map(role => (
              <li className="profile-tag" key={role}>{role}</li>
            ))}
          </ul>
        )}
      </section>
      <section className="profile-block">
        <h2 className="profile-label">Preferred locations</h2>
        {profile.locations.length === 0 ? (
          <p className="profile-missing">Not added yet</p>
        ) : (
          <ul className="profile-tags">
            {profile.locations.map(location => (
              <li className="profile-tag" key={location}>{location}</li>
            ))}
          </ul>
        )}
      </section>
      <section className="profile-block">
        <h2 className="profile-label">Work authorization</h2>
        <p className="profile-meta">
          {profile.workAuthorization === "" ? "Not added yet" : profile.workAuthorization}
        </p>
      </section>
    </main>
  )
}
export default MyProfile