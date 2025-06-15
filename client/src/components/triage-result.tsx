import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, Circle } from "lucide-react";
import { useLanguage } from "@/hooks/use-language";
import type { TriageResult } from "@shared/schema";

interface TriageResultProps {
  result: TriageResult;
  symptoms: string;
}

export function TriageResultDisplay({ result, symptoms }: TriageResultProps) {
  const { t } = useLanguage();

  const getColorClasses = (color: string) => {
    switch (color) {
      case 'red':
        return {
          card: 'bg-red-50 border-red-200',
          icon: 'bg-red-100 text-red-600',
          title: 'text-red-800',
          description: 'text-red-700',
          advice: 'text-red-700'
        };
      case 'yellow':
        return {
          card: 'bg-yellow-50 border-yellow-200',
          icon: 'bg-yellow-100 text-yellow-600',
          title: 'text-yellow-800',
          description: 'text-yellow-700',
          advice: 'text-yellow-700'
        };
      case 'green':
        return {
          card: 'bg-green-50 border-green-200',
          icon: 'bg-green-100 text-green-600',
          title: 'text-green-800',
          description: 'text-green-700',
          advice: 'text-green-700'
        };
      default:
        return {
          card: 'bg-gray-50 border-gray-200',
          icon: 'bg-gray-100 text-gray-600',
          title: 'text-gray-800',
          description: 'text-gray-700',
          advice: 'text-gray-700'
        };
    }
  };

  const colors = getColorClasses(result.color);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('assessment_result')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className={`p-6 rounded-lg ${colors.card}`}>
          <div className="flex items-center mb-3">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center mr-4 ${colors.icon}`}>
              <Circle className="w-6 h-6" />
            </div>
            <div>
              <h4 className={`text-lg font-semibold ${colors.title}`}>{result.title}</h4>
              <p className={`text-sm ${colors.description}`}>{result.description}</p>
            </div>
          </div>
          <div className={`text-sm leading-relaxed ${colors.advice}`}>
            {result.advice}
          </div>
        </div>

        {result.level === 'urgent' && (
          <Alert className="border-red-200 bg-red-50">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <AlertTitle className="text-red-800">{t('emergency_warning')}</AlertTitle>
            <AlertDescription className="text-red-700">
              {t('seek_help_immediately')}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
