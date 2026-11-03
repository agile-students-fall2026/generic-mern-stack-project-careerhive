import { useContext } from "react";
import { useNavigate } from "react-router-dom";
import ProfileContext from "./ProfileContext";
import "./ProfileContext.css";

const ProfileSetup = () => {
  const { profile, setProfile } = useContext(ProfileContext);
  const navigate = useNavigate();

  const skipProfile = () => {
    navigate("/home");
  }

  return (
    <main className="profile-setup">
        <h1 className="profile-heading">Set Up Your Profile</h1>
        <p className="profile-note">This helps us match you with the right roles!</p>

        <label className="profile-label">
            Major
            <input className="profile-input" type="text" value={profile.major} readOnly />
        </label>

        <section className="profile-section">
            <h2 className="profile-label">Skills</h2>
            <ul className="profile-tags">
                {profile.skills.map(skill => (
                    <li className="profile-tag" key={skill}>{skill}</li>
                ))}
            </ul>
        </section>

        <section className="profile-section">
            <h2 className="profile-label">Looking For</h2>
            <label className="profile-choice">
                <input type="checkbox" checked={profile.lookingFor.includes("Internships")} />
                Internships
            </label>
        </section>

        <section className="profile-section">
            <h2 className="profile-label">Preferred locations</h2>
            <ul className="profile-tags">
            {profile.locations.map(location => (
                <li className="profile-tag" key={location}>{location}</li>
            ))}
            </ul>
        </section>

        <label className="profile-label">
            Work Authorization
            <input className="profile-input" type="text" value={profile.workAuthorization.join(", ")} readOnly />
        </label>

        <button className="profile-save" type="button">Save and Continue</button>
        <button className="profile-skip" type="button" onClick={skipProfile}>Skip for now</button>
    </main>
    )
};

export default ProfileSetup;