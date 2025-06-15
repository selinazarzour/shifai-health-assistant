import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User } from "firebase/auth";
import { getFirestore, doc, setDoc, getDoc, collection, query, where, orderBy, getDocs, enableNetwork, disableNetwork } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: `${import.meta.env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: `${import.meta.env.VITE_FIREBASE_PROJECT_ID}.firebasestorage.app`,
  messagingSenderId: "123456789", // You can update this with your actual sender ID
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Validate Firebase configuration
const requiredKeys = ['VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_PROJECT_ID', 'VITE_FIREBASE_APP_ID'];
const missingKeys = requiredKeys.filter(key => !import.meta.env[key]);

if (missingKeys.length > 0) {
  console.error('Missing Firebase configuration:', missingKeys);
  throw new Error(`Missing Firebase configuration: ${missingKeys.join(', ')}`);
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

const provider = new GoogleAuthProvider();
provider.addScope('email');
provider.addScope('profile');

// Authentication functions
export const signInWithGoogle = () => {
  return signInWithPopup(auth, provider);
};

export const logOut = () => {
  return signOut(auth);
};

export const onAuthStateChange = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, callback);
};

// Firestore functions for patient profiles
export interface PatientProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  firstName?: string;
  lastName?: string;
  age?: number;
  gender?: string;
  phoneNumber?: string;
  emergencyContact?: string;
  medicalConditions?: string[];
  allergies?: string[];
  medications?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export const createOrUpdateProfile = async (user: User, additionalData: Partial<PatientProfile> = {}): Promise<PatientProfile> => {
  if (!user.uid) throw new Error('User UID is required');
  
  try {
    const userRef = doc(db, 'patients', user.uid);
    const existingUser = await getDoc(userRef);
    const existingData = existingUser.exists() ? existingUser.data() as PatientProfile : {} as Partial<PatientProfile>;
    
    const profileData: PatientProfile = {
      uid: user.uid,
      email: user.email || '',
      displayName: user.displayName || '',
      photoURL: user.photoURL || undefined,
      firstName: additionalData.firstName || existingData?.firstName || '',
      lastName: additionalData.lastName || existingData?.lastName || '',
      age: additionalData.age !== undefined ? additionalData.age : existingData?.age,
      gender: additionalData.gender || existingData?.gender,
      phoneNumber: additionalData.phoneNumber || existingData?.phoneNumber,
      emergencyContact: additionalData.emergencyContact || existingData?.emergencyContact,
      medicalConditions: additionalData.medicalConditions || existingData?.medicalConditions || [],
      allergies: additionalData.allergies || existingData?.allergies || [],
      medications: additionalData.medications || existingData?.medications || [],
      createdAt: existingData?.createdAt || new Date(),
      updatedAt: new Date(),
    };

    await setDoc(userRef, profileData, { merge: true });
    return profileData;
  } catch (error: any) {
    console.error('Firebase profile error:', error);
    // If offline, return a basic profile with user data
    if (error.code === 'unavailable') {
      return {
        uid: user.uid,
        email: user.email || '',
        displayName: user.displayName || '',
        photoURL: user.photoURL || undefined,
        firstName: additionalData.firstName || '',
        lastName: additionalData.lastName || '',
        age: additionalData.age,
        gender: additionalData.gender,
        phoneNumber: additionalData.phoneNumber,
        emergencyContact: additionalData.emergencyContact,
        medicalConditions: additionalData.medicalConditions || [],
        allergies: additionalData.allergies || [],
        medications: additionalData.medications || [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }
    throw error;
  }
};

export const getPatientProfile = async (uid: string): Promise<PatientProfile | null> => {
  const userRef = doc(db, 'patients', uid);
  const userSnap = await getDoc(userRef);
  
  if (userSnap.exists()) {
    return userSnap.data() as PatientProfile;
  }
  return null;
};

export const saveSymptomEntry = async (uid: string, entry: {
  symptoms: string;
  age?: number;
  gender?: string;
  language: string;
  triageLevel: string;
  triageResult: string;
}) => {
  const entriesRef = collection(db, 'symptomEntries');
  const docRef = doc(entriesRef);
  
  // Get patient profile for patient name
  const patientProfile = await getPatientProfile(uid);
  
  await setDoc(docRef, {
    ...entry,
    uid,
    patientName: patientProfile?.displayName || 'Unknown Patient',
    patientEmail: patientProfile?.email || '',
    timestamp: new Date(),
    id: docRef.id,
  });
  
  return docRef.id;
};

export const getPatientSymptomHistory = async (uid: string) => {
  const entriesRef = collection(db, 'symptomEntries');
  const q = query(
    entriesRef,
    where('uid', '==', uid),
    orderBy('timestamp', 'desc')
  );
  
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    timestamp: doc.data().timestamp.toDate(),
  }));
};

// Doctor dashboard functions
export const getAllSymptomEntries = async () => {
  const entriesRef = collection(db, 'symptomEntries');
  const q = query(entriesRef, orderBy('timestamp', 'desc'));
  
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    timestamp: doc.data().timestamp.toDate(),
  }));
};

export const getSymptomEntriesByTriageLevel = async (level: string) => {
  const entriesRef = collection(db, 'symptomEntries');
  const q = query(
    entriesRef,
    where('triageLevel', '==', level),
    orderBy('timestamp', 'desc')
  );
  
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    timestamp: doc.data().timestamp.toDate(),
  }));
};

export const getDashboardStats = async () => {
  const entriesRef = collection(db, 'symptomEntries');
  const querySnapshot = await getDocs(entriesRef);
  
  const entries = querySnapshot.docs.map(doc => doc.data());
  const uniquePatients = new Set(entries.map(entry => entry.uid)).size;
  
  return {
    totalPatients: uniquePatients,
    urgentCases: entries.filter(e => e.triageLevel === 'urgent').length,
    monitorCases: entries.filter(e => e.triageLevel === 'monitor').length,
    safeCases: entries.filter(e => e.triageLevel === 'safe').length,
  };
};