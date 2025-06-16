import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User } from "firebase/auth";
import { getFirestore, doc, setDoc, getDoc, collection, query, where, orderBy, getDocs, limit, enableNetwork, disableNetwork } from "firebase/firestore";

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
    const userRef = doc(db, 'users', user.uid);
    const existingDoc = await getDoc(userRef);
    const existingData = existingDoc.exists() ? existingDoc.data() as Partial<PatientProfile> : {};
    
    const firstName = additionalData.firstName || existingData?.firstName || '';
    const lastName = additionalData.lastName || existingData?.lastName || '';
    const fullName = firstName && lastName ? `${firstName} ${lastName}` : user.displayName || '';

    const profileData = {
      uid: user.uid,
      email: user.email || '',
      displayName: fullName,
      photoURL: user.photoURL || null,
      firstName: firstName || null,
      lastName: lastName || null,
      age: additionalData.age !== undefined ? additionalData.age : (existingData?.age || null),
      gender: additionalData.gender || existingData?.gender || null,
      phoneNumber: additionalData.phoneNumber || existingData?.phoneNumber || null,
      emergencyContact: additionalData.emergencyContact || existingData?.emergencyContact || null,
      medicalConditions: additionalData.medicalConditions || existingData?.medicalConditions || [],
      allergies: additionalData.allergies || existingData?.allergies || [],
      medications: additionalData.medications || existingData?.medications || [],
      createdAt: existingData?.createdAt || new Date(),
      updatedAt: new Date(),
    };

    await setDoc(userRef, profileData, { merge: true });
    return profileData as PatientProfile;
  } catch (error: any) {
    console.error('Firebase profile error:', error);
    throw error;
  }
};

export const getPatientProfile = async (uid: string): Promise<PatientProfile | null> => {
  try {
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
      return userSnap.data() as PatientProfile;
    }
    return null;
  } catch (error) {
    console.error('Error fetching profile:', error);
    return null;
  }
};

export const saveSymptomEntry = async (uid: string, entry: {
  symptoms: string;
  age?: number;
  gender?: string;
  language: string;
  triageLevel: string;
  triageResult: string;
}) => {
  try {
    const entriesRef = collection(db, 'symptomEntries');
    const docRef = doc(entriesRef);
    
    // Get patient profile for patient name
    const patientProfile = await getPatientProfile(uid);
    
    const entryData = {
      uid,
      symptoms: entry.symptoms,
      age: entry.age || null,
      gender: entry.gender || null,
      language: entry.language,
      triageLevel: entry.triageLevel,
      triageResult: entry.triageResult,
      patientName: patientProfile?.displayName || 'Unknown Patient',
      patientEmail: patientProfile?.email || '',
      timestamp: new Date(),
      id: docRef.id,
    };
    
    await setDoc(docRef, entryData);
    return docRef.id;
  } catch (error) {
    console.error('Error saving symptom entry:', error);
    throw error;
  }
};

export const getPatientSymptomHistory = async (uid: string) => {
  try {
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
  } catch (error: any) {
    // If composite index is missing, fallback to simple query and sort in memory
    if (error.code === 'failed-precondition') {
      console.warn('Firestore composite index missing, using fallback query');
      const entriesRef = collection(db, 'symptomEntries');
      const q = query(entriesRef, where('uid', '==', uid));
      
      const querySnapshot = await getDocs(q);
      const entries = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp.toDate(),
      }));
      
      // Sort in memory by timestamp descending
      return entries.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    }
    throw error;
  }
};

// Doctor dashboard functions
export const getAllSymptomEntries = async () => {
  try {
    const entriesRef = collection(db, 'symptomEntries');
    const q = query(entriesRef, orderBy('timestamp', 'desc'));
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp.toDate(),
    }));
  } catch (error: any) {
    // Fallback to simple query if index is missing
    if (error.code === 'failed-precondition') {
      console.warn('Firestore index missing for getAllSymptomEntries, using fallback');
      const entriesRef = collection(db, 'symptomEntries');
      const querySnapshot = await getDocs(entriesRef);
      const entries = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp.toDate(),
      }));
      
      return entries.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    }
    throw error;
  }
};

export const getSymptomEntriesByTriageLevel = async (level: string) => {
  try {
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
  } catch (error: any) {
    // Fallback for missing composite index
    if (error.code === 'failed-precondition') {
      console.warn('Firestore index missing for getSymptomEntriesByTriageLevel, using fallback');
      const entriesRef = collection(db, 'symptomEntries');
      const q = query(entriesRef, where('triageLevel', '==', level));
      
      const querySnapshot = await getDocs(q);
      const entries = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp.toDate(),
      }));
      
      return entries.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    }
    throw error;
  }
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

// Chat and AI Report Functions
export interface ChatMessage {
  id: string;
  uid: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  language: string;
}

export interface ClinicalReport {
  id: string;
  patientId: string;
  generatedBy: string; // doctor uid
  summary: string;
  timeline: string;
  riskAnalysis: string;
  recommendations: string;
  generatedAt: Date;
}

// Save chat message to Firebase
export const saveChatMessage = async (message: Omit<ChatMessage, 'id'>) => {
  try {
    const messagesRef = collection(db, 'chatMessages');
    const docRef = doc(messagesRef);
    
    const messageData = {
      ...message,
      timestamp: new Date(),
      id: docRef.id,
    };
    
    await setDoc(docRef, messageData);
    return docRef.id;
  } catch (error) {
    console.error('Error saving chat message:', error);
    throw error;
  }
};

// Get chat history for a patient
export const getChatHistory = async (uid: string): Promise<ChatMessage[]> => {
  try {
    const messagesRef = collection(db, 'chatMessages');
    const q = query(
      messagesRef,
      where('uid', '==', uid),
      orderBy('timestamp', 'desc'),
      limit(50)
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      ...doc.data(),
      timestamp: doc.data().timestamp.toDate(),
    })) as ChatMessage[];
  } catch (error: any) {
    // Fallback for missing index
    if (error.code === 'failed-precondition') {
      const messagesRef = collection(db, 'chatMessages');
      const q = query(messagesRef, where('uid', '==', uid));
      
      const querySnapshot = await getDocs(q);
      const messages = querySnapshot.docs.map(doc => ({
        ...doc.data(),
        timestamp: doc.data().timestamp.toDate(),
      })) as ChatMessage[];
      
      return messages
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, 50);
    }
    throw error;
  }
};

// Save clinical report
export const saveClinicalReport = async (report: Omit<ClinicalReport, 'id'>) => {
  try {
    const reportsRef = collection(db, 'clinicalReports');
    const docRef = doc(reportsRef);
    
    const reportData = {
      ...report,
      generatedAt: new Date(),
      id: docRef.id,
    };
    
    await setDoc(docRef, reportData);
    return docRef.id;
  } catch (error) {
    console.error('Error saving clinical report:', error);
    throw error;
  }
};

// Get clinical report for a patient
export const getClinicalReport = async (patientId: string): Promise<ClinicalReport | null> => {
  try {
    const reportsRef = collection(db, 'clinicalReports');
    const q = query(
      reportsRef,
      where('patientId', '==', patientId),
      orderBy('generatedAt', 'desc'),
      limit(1)
    );
    
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) return null;
    
    const doc = querySnapshot.docs[0];
    return {
      ...doc.data(),
      generatedAt: doc.data().generatedAt.toDate(),
    } as ClinicalReport;
  } catch (error: any) {
    // Fallback for missing index
    if (error.code === 'failed-precondition') {
      const reportsRef = collection(db, 'clinicalReports');
      const q = query(reportsRef, where('patientId', '==', patientId));
      
      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) return null;
      
      const reports = querySnapshot.docs.map(doc => ({
        ...doc.data(),
        generatedAt: doc.data().generatedAt.toDate(),
      })) as ClinicalReport[];
      
      return reports.sort((a, b) => b.generatedAt.getTime() - a.generatedAt.getTime())[0];
    }
    throw error;
  }
};

// Get comprehensive patient data for AI analysis
export const getPatientDataForAI = async (uid: string) => {
  try {
    const [profile, symptomEntries, chatHistory] = await Promise.all([
      getPatientProfile(uid),
      getPatientSymptomHistory(uid),
      getChatHistory(uid)
    ]);

    return {
      profile,
      entries: symptomEntries,
      chatHistory: chatHistory.filter(msg => msg.role === 'user').slice(0, 10) // Recent user messages
    };
  } catch (error) {
    console.error('Error fetching patient data for AI:', error);
    throw error;
  }
};