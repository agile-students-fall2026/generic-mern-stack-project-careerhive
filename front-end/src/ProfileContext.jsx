import { createContext } from "react";
import { filledProfile } from "./profileData";

const ProfileContext = createContext(filledProfile);

export default ProfileContext;