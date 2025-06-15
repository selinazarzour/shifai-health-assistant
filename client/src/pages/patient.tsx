import { useState } from "react";
import { Button } from "@/components/ui/button";
import { UserRound, Heart, Settings, LogOut } from "lucide-react";
import { FirebaseSymptomForm } from "@/components/firebase-symptom-form";
import { TriageResultDisplay } from "@/components/triage-result";
import { FirebasePatientHistory } from "@/components/firebase-patient-history";
import { LanguageToggle } from "@/components/language-toggle";
import { DoctorLoginModal } from "@/components/doctor-login-modal";
import { PatientProfile } from "@/components/patient-profile";
import { useLanguage } from "@/hooks/use-language";
import { useAuth } from "@/hooks/use-auth";
import type { TriageResult } from "@shared/schema";

export default function PatientPage() {
  const { t } = useLanguage();
  const { user, profile, loading, signIn, signOut } = useAuth();
  const [triageResult, setTriageResult] = useState<TriageResult | null>(null);
  const [symptoms, setSymptoms] = useState<string>("");
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [historyKey, setHistoryKey] = useState(0);

  const handleTriageResult = (result: TriageResult, symptomsText: string) => {
    setTriageResult(result);
    setSymptoms(symptomsText);
  };

  const handleHistoryUpdate = () => {
    setHistoryKey(prev => prev + 1);
  };

  const handleDoctorLoginSuccess = () => {
    window.location.href = '/doctor';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
            <Heart className="w-6 h-6 text-white animate-pulse" />
          </div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                <Heart className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">{t('app_title')}</h1>
                <p className="text-sm text-gray-600">{t('app_subtitle')}</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <LanguageToggle />
              
              {user ? (
                <div className="flex items-center space-x-2">
                  <img 
                    src={profile?.photoURL || user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile?.displayName || user.displayName || user.email || '')}&background=3b82f6&color=fff`}
                    alt="Profile"
                    className="w-8 h-8 rounded-full"
                  />
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setShowProfileModal(true)}
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    Profile
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={signOut}
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Sign Out
                  </Button>
                </div>
              ) : (
                <Button onClick={signIn}>
                  Sign In with Google
                </Button>
              )}
              
              <Button onClick={() => setShowLoginModal(true)}>
                <UserRound className="w-4 h-4 mr-2" />
                {t('doctor_dashboard')}
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        <FirebaseSymptomForm 
          onResult={handleTriageResult}
          onHistoryUpdate={handleHistoryUpdate}
        />
        
        {triageResult && (
          <TriageResultDisplay result={triageResult} symptoms={symptoms} />
        )}
        
        <FirebasePatientHistory key={historyKey} />
      </main>

      <DoctorLoginModal
        open={showLoginModal}
        onOpenChange={setShowLoginModal}
        onSuccess={handleDoctorLoginSuccess}
      />

      <PatientProfile
        open={showProfileModal}
        onOpenChange={setShowProfileModal}
      />
    </div>
  );
}
