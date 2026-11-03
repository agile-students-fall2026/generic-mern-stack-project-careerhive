import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import ProfileSetup from './ProfileSetup';
import MyProfile from './MyProfile';

function App() {
  return (
    <Router>
    <main className="app">
        <Routes>
          <Route path="/" element={
            <div>
              <h1>CareerHive</h1>
              <p><Link to="/profile-setup">Profile Setup</Link></p>
              <p><Link to="/profile">My Profile</Link></p>
            </div>
          } />
          <Route path="/profile-setup" element={<ProfileSetup />} />
          <Route path="/profile" element={<MyProfile />} />
          <Route path="/home" element={<h1>Home </h1>} />
          <Route path="/edit-profile" element={<h1>Edit Profile</h1>} />
        </Routes>
    </main>
    </Router>
  )
}

export default App
