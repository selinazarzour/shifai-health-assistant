import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ClipboardList } from "lucide-react";
import { useLanguage } from "@/hooks/use-language";
import { useAuth } from "@/hooks/use-auth";
import { getPatientSymptomHistory } from "@/lib/firebase";

interface SymptomEntry {
  id: string;
  symptoms: string;
  age?: number;
  gender?: string;
  language: string;
  triageLevel: string;
  triageResult: string;
  timestamp: Date;
}

export function FirebasePatientHistory() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [entries, setEntries] = useState<SymptomEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!user?.uid) {
        setLoading(false);
        return;
      }

      try {
        const history = await getPatientSymptomHistory(user.uid);
        setEntries(history as SymptomEntry[]);
      } catch (error) {
        console.error('Error fetching history:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [user?.uid]);

  const formatTimestamp = (timestamp: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - timestamp.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return timestamp.toLocaleDateString();
  };

  const getBadgeVariant = (level: string) => {
    switch (level) {
      case 'urgent': return 'destructive';
      case 'monitor': return 'default';
      case 'safe': return 'secondary';
      default: return 'outline';
    }
  };

  const getBorderColor = (level: string) => {
    switch (level) {
      case 'urgent': return 'border-l-red-500';
      case 'monitor': return 'border-l-yellow-500';
      case 'safe': return 'border-l-green-500';
      default: return 'border-l-gray-300';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('your_history')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('your_history')}</CardTitle>
      </CardHeader>
      <CardContent>
        {!user ? (
          <div className="text-center py-8 text-muted-foreground">
            <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Please sign in to view your medical history.</p>
          </div>
        ) : !entries || entries.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>{t('no_history')}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {entries.map((entry) => (
              <div key={entry.id} className={`border-l-4 pl-4 ${getBorderColor(entry.triageLevel)}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <Badge variant={getBadgeVariant(entry.triageLevel)}>
                      {t(entry.triageLevel)}
                    </Badge>
                    <span className="text-sm text-muted-foreground">{entry.language}</span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {formatTimestamp(entry.timestamp)}
                  </span>
                </div>
                <p className="text-sm text-foreground">
                  {entry.symptoms.length > 100 
                    ? `${entry.symptoms.substring(0, 100)}...` 
                    : entry.symptoms
                  }
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}