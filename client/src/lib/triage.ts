import type { TriageResult } from "@shared/schema";

export function analyzeSymptoms(symptoms: string): TriageResult {
  const text = symptoms.toLowerCase();
  
  // Urgent keywords (multiple languages)
  const urgentKeywords = [
    'chest pain', 'douleur thoracique', 'ألم في الصدر',
    'shortness of breath', 'essoufflement', 'ضيق في التنفس',
    'severe headache', 'mal de tête sévère', 'صداع شديد',
    'unconscious', 'inconscient', 'فقدان الوعي',
    'bleeding', 'saignement', 'نزيف',
    'heart attack', 'crise cardiaque', 'نوبة قلبية',
    'stroke', 'avc', 'سكتة دماغية',
    'difficulty breathing', 'difficulté à respirer', 'صعوبة في التنفس',
    'severe pain', 'douleur sévère', 'ألم شديد'
  ];

  // Monitor keywords
  const monitorKeywords = [
    'fever', 'fièvre', 'حمى',
    'persistent', 'persistant', 'مستمر',
    'vomiting', 'vomissement', 'قيء',
    'severe', 'sévère', 'شديد',
    'pain', 'douleur', 'ألم',
    'nausea', 'nausée', 'غثيان',
    'dizziness', 'vertige', 'دوخة'
  ];

  // Check for urgent symptoms
  if (urgentKeywords.some(keyword => text.includes(keyword))) {
    return {
      level: 'urgent',
      color: 'red',
      title: 'Urgent - Seek Immediate Care',
      description: 'Your symptoms require immediate medical attention',
      advice: 'Please visit the nearest emergency room or call emergency services immediately. Do not delay seeking medical care.'
    };
  }

  // Check for monitor symptoms
  if (monitorKeywords.some(keyword => text.includes(keyword))) {
    return {
      level: 'monitor',
      color: 'yellow',
      title: 'Monitor - Schedule an Appointment',
      description: 'Your symptoms should be evaluated by a healthcare provider',
      advice: 'Consider scheduling an appointment with your doctor within the next few days. Monitor your symptoms and seek immediate care if they worsen.'
    };
  }

  // Default to safe
  return {
    level: 'safe',
    color: 'green',
    title: 'Safe - Self-Care Recommended',
    description: 'Your symptoms appear to be minor',
    advice: 'Continue with self-care measures such as rest, hydration, and over-the-counter medications as appropriate. If symptoms persist or worsen, consult a healthcare provider.'
  };
}
