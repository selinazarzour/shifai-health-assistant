import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { FileText, Calendar, AlertTriangle, Stethoscope, Loader2, User } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { getPatientDataForAI } from "@/lib/firebase";

interface PatientReportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  patientName: string;
  patientEmail: string;
}

interface ClinicalReport {
  patientId: string;
  summary: string;
  timeline: string;
  riskAnalysis: string;
  recommendations: string;
  generatedAt: Date;
}

export function PatientReportModal({ 
  open, 
  onOpenChange, 
  patientId, 
  patientName, 
  patientEmail 
}: PatientReportModalProps) {
  const [report, setReport] = useState<ClinicalReport | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [patientData, setPatientData] = useState<any>(null);

  const generateReport = async () => {
    setIsGenerating(true);
    try {
      // First, get comprehensive patient data
      const data = await getPatientDataForAI(patientId);
      setPatientData(data);

      // Generate AI report
      const response = await fetch(`/api/doctor/generate-report/${patientId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });

      const reportData = await response.json();

      setReport({
        ...reportData,
        generatedAt: new Date(reportData.generatedAt)
      });
    } catch (error) {
      console.error('Error generating report:', error);
      // Fallback report
      setReport({
        patientId,
        summary: "Unable to generate AI report. Please review patient data manually.",
        timeline: "Automated timeline unavailable",
        riskAnalysis: "Manual review required",
        recommendations: "Conduct comprehensive patient evaluation",
        generatedAt: new Date()
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const getRiskColor = (analysis: string) => {
    if (analysis.includes('HIGH PRIORITY')) return 'destructive';
    if (analysis.includes('MODERATE')) return 'default';
    return 'secondary';
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center space-x-3">
            <FileText className="w-6 h-6 text-primary" />
            <div>
              <DialogTitle className="text-xl">Clinical Report</DialogTitle>
              <DialogDescription>
                AI-generated summary for {patientName}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6">
          {/* Patient Information */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center space-x-2">
                <User className="w-5 h-5" />
                <span>Patient Information</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Name</label>
                  <p className="font-medium">{patientName}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Email</label>
                  <p className="text-sm">{patientEmail}</p>
                </div>
                {patientData?.profile && (
                  <>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Age</label>
                      <p>{patientData.profile.age || 'Not specified'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Gender</label>
                      <p>{patientData.profile.gender || 'Not specified'}</p>
                    </div>
                    {patientData.profile.medicalConditions?.length > 0 && (
                      <div className="md:col-span-2">
                        <label className="text-sm font-medium text-muted-foreground">Medical Conditions</label>
                        <p>{patientData.profile.medicalConditions.join(', ')}</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Generate Report Button */}
          {!report && (
            <div className="text-center py-8">
              <Button 
                onClick={generateReport} 
                disabled={isGenerating}
                size="lg"
                className="space-x-2"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Generating AI Report...</span>
                  </>
                ) : (
                  <>
                    <Stethoscope className="w-5 h-5" />
                    <span>Generate AI Clinical Report</span>
                  </>
                )}
              </Button>
              <p className="text-sm text-muted-foreground mt-2">
                This will analyze the patient's symptom history and generate a clinical summary
              </p>
            </div>
          )}

          {/* AI Generated Report */}
          {report && (
            <div className="space-y-6">
              {/* Clinical Summary */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Clinical Summary</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Generated on {formatDate(report.generatedAt)}
                  </p>
                </CardHeader>
                <CardContent>
                  <p className="leading-relaxed">{report.summary}</p>
                </CardContent>
              </Card>

              {/* Risk Analysis */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center space-x-2">
                    <AlertTriangle className="w-5 h-5" />
                    <span>Risk Analysis</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Badge variant={getRiskColor(report.riskAnalysis)} className="mb-3">
                    {report.riskAnalysis.includes('HIGH') ? 'HIGH PRIORITY' :
                     report.riskAnalysis.includes('MODERATE') ? 'MODERATE RISK' : 'LOW RISK'}
                  </Badge>
                  <p className="leading-relaxed">{report.riskAnalysis}</p>
                </CardContent>
              </Card>

              {/* Timeline */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center space-x-2">
                    <Calendar className="w-5 h-5" />
                    <span>Symptom Timeline</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {report.timeline.split('\n').map((entry, index) => {
                      if (!entry.trim()) return null;
                      const [date, ...rest] = entry.split(': ');
                      const content = rest.join(': ');
                      
                      return (
                        <div key={index} className="flex items-start space-x-3 p-3 border-l-2 border-muted">
                          <div className="text-sm font-medium text-muted-foreground min-w-24">
                            {date}
                          </div>
                          <div className="flex-1 text-sm">
                            {content}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Recommendations */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Clinical Recommendations</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="leading-relaxed">{report.recommendations}</p>
                </CardContent>
              </Card>

              {/* AI Disclaimer */}
              <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg border border-yellow-200 dark:border-yellow-800">
                <p className="text-sm text-yellow-800 dark:text-yellow-200 font-medium">
                  ⚠️ This is AI-generated analysis and should be used as a clinical decision support tool. 
                  Always combine with professional medical judgment and direct patient assessment.
                </p>
              </div>
            </div>
          )}
        </div>

        <Separator />
        
        <div className="flex justify-end space-x-2 pt-4">
          {report && (
            <Button variant="outline" onClick={() => window.print()}>
              Print Report
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}