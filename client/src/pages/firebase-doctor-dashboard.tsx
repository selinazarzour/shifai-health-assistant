import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Users, AlertTriangle, Eye, CheckCircle, FileText } from "lucide-react";
import { useLanguage } from "@/hooks/use-language";
import { LanguageToggle } from "@/components/language-toggle";
import { PatientReportModal } from "@/components/patient-report-modal";
import { getAllSymptomEntries, getSymptomEntriesByTriageLevel, getDashboardStats } from "@/lib/firebase";
import { Link } from "wouter";

interface FirebaseSymptomEntry {
  id: string;
  uid: string;
  patientName: string;
  patientEmail: string;
  symptoms: string;
  age?: number;
  gender?: string;
  language: string;
  triageLevel: string;
  triageResult: string;
  timestamp: Date;
}

interface DashboardStats {
  totalPatients: number;
  urgentCases: number;
  monitorCases: number;
  safeCases: number;
}

export default function FirebaseDoctorDashboard() {
  const { t } = useLanguage();
  const [filterLevel, setFilterLevel] = useState('all');
  const [entries, setEntries] = useState<FirebaseSymptomEntry[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showReportModal, setShowReportModal] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<{
    id: string;
    name: string;
    email: string;
  } | null>(null);

  useEffect(() => {
    fetchData();
  }, [filterLevel]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch stats
      const statsData = await getDashboardStats();
      setStats(statsData);

      // Fetch entries based on filter
      let entriesData;
      if (filterLevel === 'all') {
        entriesData = await getAllSymptomEntries();
      } else {
        entriesData = await getSymptomEntriesByTriageLevel(filterLevel);
      }
      
      setEntries(entriesData as FirebaseSymptomEntry[]);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTimestamp = (timestamp: Date) => {
    return timestamp.toLocaleString();
  };

  const getBadgeVariant = (level: string) => {
    switch (level) {
      case 'urgent': return 'destructive';
      case 'monitor': return 'default';
      case 'safe': return 'secondary';
      default: return 'outline';
    }
  };

  const getBadgeColor = (level: string) => {
    switch (level) {
      case 'urgent': return 'bg-red-100 text-red-800';
      case 'monitor': return 'bg-yellow-100 text-yellow-800';
      case 'safe': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handlePatientClick = (patientId: string, patientName: string, patientEmail: string) => {
    setSelectedPatient({
      id: patientId,
      name: patientName,
      email: patientEmail
    });
    setShowReportModal(true);
  };

  return (
    <div className="min-h-screen bg-surface">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">{t('doctor_dashboard')}</h1>
              <p className="text-sm text-gray-600">{t('dashboard_subtitle')}</p>
            </div>
            
            <div className="flex items-center space-x-4">
              <LanguageToggle />
              <Link href="/">
                <Button variant="outline">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  {t('back_to_patient')}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mr-4">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('total_patients')}</p>
                  <p className="text-2xl font-semibold">{stats?.totalPatients || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mr-4">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('urgent_cases')}</p>
                  <p className="text-2xl font-semibold text-red-600">{stats?.urgentCases || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center mr-4">
                  <Eye className="w-6 h-6 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('monitor_cases')}</p>
                  <p className="text-2xl font-semibold text-yellow-600">{stats?.monitorCases || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mr-4">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('safe_cases')}</p>
                  <p className="text-2xl font-semibold text-green-600">{stats?.safeCases || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Patient Entries Table */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>{t('patient_entries')}</CardTitle>
              <Select value={filterLevel} onValueChange={setFilterLevel}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('all_entries')}</SelectItem>
                  <SelectItem value="urgent">{t('urgent_only')}</SelectItem>
                  <SelectItem value="monitor">{t('monitor_only')}</SelectItem>
                  <SelectItem value="safe">{t('safe_only')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="animate-pulse flex space-x-4">
                    <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Patient Name</TableHead>
                      <TableHead>{t('symptoms')}</TableHead>
                      <TableHead>{t('language')}</TableHead>
                      <TableHead>{t('triage')}</TableHead>
                      <TableHead>{t('timestamp')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries?.map((entry) => (
                      <TableRow key={entry.id} className="hover:bg-muted/50">
                        <TableCell className="font-medium">
                          <div>
                            <button 
                              onClick={() => handlePatientClick(entry.uid, entry.patientName || 'Unknown Patient', entry.patientEmail)}
                              className="text-left hover:text-primary transition-colors"
                            >
                              <div className="font-medium flex items-center space-x-2">
                                <span>{entry.patientName || 'Unknown Patient'}</span>
                                <FileText className="w-4 h-4 text-muted-foreground" />
                              </div>
                              <div className="text-sm text-gray-500">{entry.patientEmail}</div>
                            </button>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-xs">
                          <div className="truncate">
                            {entry.symptoms.length > 60 
                              ? `${entry.symptoms.substring(0, 60)}...` 
                              : entry.symptoms
                            }
                          </div>
                        </TableCell>
                        <TableCell>{entry.language}</TableCell>
                        <TableCell>
                          <Badge 
                            variant={getBadgeVariant(entry.triageLevel)}
                            className={getBadgeColor(entry.triageLevel)}
                          >
                            {t(entry.triageLevel)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatTimestamp(entry.timestamp)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                
                {entries?.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>No entries found for the selected filter.</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Patient Report Modal */}
      {selectedPatient && (
        <PatientReportModal
          open={showReportModal}
          onOpenChange={setShowReportModal}
          patientId={selectedPatient.id}
          patientName={selectedPatient.name}
          patientEmail={selectedPatient.email}
        />
      )}
    </div>
  );
}