import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { UserRound, Heart } from "lucide-react";
import { SymptomForm } from "@/components/symptom-form";
import { TriageResultDisplay } from "@/components/triage-result";
import { UserHistory } from "@/components/user-history";
import { LanguageToggle } from "@/components/language-toggle";
import { DoctorLoginModal } from "@/components/doctor-login-modal";
import { useLanguage } from "@/hooks/use-language";
import type { TriageResult } from "@shared/schema";
import { Link } from "wouter";

export default function PatientPage() {
  const { t } = useLanguage();
  const [currentUser] = useState(() => 
    'USER-' + Math.random().toString(36).substr(2, 9)
  );
  const [triageResult, setTriageResult] = useState<TriageResult | null>(null);
  const [symptoms, setSymptoms] = useState<string>("");
  const [showLoginModal, setShowLoginModal] = useState(false);

  const handleTriageResult = (result: TriageResult, symptomsText: string) => {
    setTriageResult(result);
    setSymptoms(symptomsText);
  };

  const handleDoctorLoginSuccess = () => {
    // Navigate to doctor dashboard will be handled by the router
    window.location.href = '/doctor';
  };

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
        <SymptomForm userId={currentUser} onResult={handleTriageResult} />
        
        {triageResult && (
          <TriageResultDisplay result={triageResult} symptoms={symptoms} />
        )}
        
        <UserHistory userId={currentUser} />
      </main>

      <DoctorLoginModal
        open={showLoginModal}
        onOpenChange={setShowLoginModal}
        onSuccess={handleDoctorLoginSuccess}
      />
    </div>
  );
}
