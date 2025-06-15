import { createContext, useContext, useState, ReactNode } from 'react';
import { useToast } from '@/hooks/use-toast';

interface DemoUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
}

interface DemoProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
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

interface DemoAuthContextType {
  user: DemoUser | null;
  profile: DemoProfile | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (data: Partial<DemoProfile>) => Promise<void>;
}

const DemoAuthContext = createContext<DemoAuthContextType | undefined>(undefined);

export function DemoAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<DemoUser | null>(null);
  const [profile, setProfile] = useState<DemoProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const signIn = async () => {
    setLoading(true);
    try {
      // Simulate sign in
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const demoUser: DemoUser = {
        uid: 'demo-user-123',
        email: 'demo@example.com',
        displayName: 'Demo User',
        photoURL: 'https://ui-avatars.com/api/?name=Demo+User&background=3b82f6&color=fff'
      };
      
      const demoProfile: DemoProfile = {
        ...demoUser,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      setUser(demoUser);
      setProfile(demoProfile);
      
      toast({
        title: "Demo Sign In",
        description: "Signed in with demo account. Firebase auth will work once the domain is authorized.",
      });
    } catch (error) {
      toast({
        title: "Demo Sign In Error",
        description: "Could not sign in with demo account.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    setUser(null);
    setProfile(null);
    toast({
      title: "Signed Out",
      description: "Demo sign out successful.",
    });
  };

  const updateProfile = async (data: Partial<DemoProfile>) => {
    if (!user || !profile) return;
    
    try {
      const updatedProfile = {
        ...profile,
        ...data,
        updatedAt: new Date(),
      };
      
      setProfile(updatedProfile);
      toast({
        title: "Profile Updated",
        description: "Demo profile updated successfully.",
      });
    } catch (error) {
      toast({
        title: "Update Error",
        description: "Could not update demo profile.",
        variant: "destructive",
      });
    }
  };

  return (
    <DemoAuthContext.Provider value={{ user, profile, loading, signIn, signOut, updateProfile }}>
      {children}
    </DemoAuthContext.Provider>
  );
}

export function useDemoAuth() {
  const context = useContext(DemoAuthContext);
  if (context === undefined) {
    throw new Error('useDemoAuth must be used within a DemoAuthProvider');
  }
  return context;
}