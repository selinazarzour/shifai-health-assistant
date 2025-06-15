import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from 'firebase/auth';
import { onAuthStateChange, handleRedirectResult, signInWithGoogle, logOut, createOrUpdateProfile, getPatientProfile, type PatientProfile } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';

interface AuthContextType {
  user: User | null;
  profile: PatientProfile | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (data: Partial<PatientProfile>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const unsubscribe = onAuthStateChange(async (user) => {
      setUser(user);
      
      if (user) {
        try {
          // Get or create profile
          let userProfile = await getPatientProfile(user.uid);
          if (!userProfile) {
            userProfile = await createOrUpdateProfile(user);
          }
          setProfile(userProfile);
        } catch (error) {
          console.error('Error fetching profile:', error);
          toast({
            title: "Profile Error",
            description: "Could not load your profile information.",
            variant: "destructive",
          });
        }
      } else {
        setProfile(null);
      }
      
      setLoading(false);
    });

    // Handle redirect result on app start
    handleRedirectResult().then((result) => {
      if (result?.user) {
        toast({
          title: "Welcome!",
          description: "Successfully signed in with Google.",
        });
      }
    }).catch((error) => {
      console.error('Redirect error:', error);
      toast({
        title: "Sign In Error",
        description: "There was an issue signing you in.",
        variant: "destructive",
      });
    });

    return unsubscribe;
  }, [toast]);

  const signIn = async () => {
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error('Sign in error:', error);
      toast({
        title: "Sign In Error",
        description: "Could not sign in with Google.",
        variant: "destructive",
      });
    }
  };

  const signOut = async () => {
    try {
      await logOut();
      setProfile(null);
      toast({
        title: "Signed Out",
        description: "You have been successfully signed out.",
      });
    } catch (error) {
      console.error('Sign out error:', error);
      toast({
        title: "Sign Out Error",
        description: "There was an issue signing you out.",
        variant: "destructive",
      });
    }
  };

  const updateProfile = async (data: Partial<PatientProfile>) => {
    if (!user) return;
    
    try {
      const updatedProfile = await createOrUpdateProfile(user, data);
      setProfile(updatedProfile);
      toast({
        title: "Profile Updated",
        description: "Your profile has been successfully updated.",
      });
    } catch (error) {
      console.error('Profile update error:', error);
      toast({
        title: "Update Error",
        description: "Could not update your profile.",
        variant: "destructive",
      });
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signOut, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}