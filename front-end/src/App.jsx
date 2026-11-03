import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import ProfileSetup from './ProfileSetup';
import MyProfile from './MyProfile';



function App() {
  return (
    <Router>
    <main className="App">
        <Routes>
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
