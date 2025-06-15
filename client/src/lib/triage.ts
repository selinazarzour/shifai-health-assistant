import type { TriageResult } from "@shared/schema";
import type { Language } from "./translations";

export function analyzeSymptoms(symptoms: string, language: Language = 'en'): TriageResult {
  const text = symptoms.toLowerCase();
  
  // Urgent keywords (multiple languages)
  const urgentKeywords = [
    'chest pain', 'douleur thoracique', 'ألم في الصدر', 'وجع بقلبي', 'وجع القلب',
    'shortness of breath', 'essoufflement', 'ضيق في التنفس',
    'severe headache', 'mal de tête sévère', 'صداع شديد',
    'unconscious', 'inconscient', 'فقدان الوعي',
    'bleeding', 'saignement', 'نزيف',
    'heart attack', 'crise cardiaque', 'نوبة قلبية',
    'stroke', 'avc', 'سكتة دماغية',
    'difficulty breathing', 'difficulté à respirer', 'صعوبة في التنفس',
    'severe pain', 'douleur sévère', 'ألم شديد', 'وجع شديد'
  ];

  // Monitor keywords
  const monitorKeywords = [
    'fever', 'fièvre', 'حمى',
    'persistent', 'persistant', 'مستمر',
    'vomiting', 'vomissement', 'قيء',
    'severe', 'sévère', 'شديد', 'كتير', 'أوي',
    'pain', 'douleur', 'ألم', 'وجع',
    'nausea', 'nausée', 'غثيان',
    'dizziness', 'vertige', 'دوخة',
    'stomach pain', 'mal de ventre', 'وجع بطن', 'ألم في البطن'
  ];

  // Get localized messages
  const getLocalizedMessages = (level: string) => {
    const messages = {
      en: {
        urgent: {
          title: 'Urgent - Seek Immediate Care',
          description: 'Your symptoms require immediate medical attention',
          advice: 'Please visit the nearest emergency room or call emergency services immediately. Do not delay seeking medical care.'
        },
        monitor: {
          title: 'Monitor - Schedule an Appointment',
          description: 'Your symptoms should be evaluated by a healthcare provider',
          advice: 'Consider scheduling an appointment with your doctor within the next few days. Monitor your symptoms and seek immediate care if they worsen.'
        },
        safe: {
          title: 'Safe - Self-Care Recommended',
          description: 'Your symptoms appear to be minor',
          advice: 'Continue with self-care measures such as rest, hydration, and over-the-counter medications as appropriate. If symptoms persist or worsen, consult a healthcare provider.'
        }
      },
      fr: {
        urgent: {
          title: 'Urgent - Consultez Immédiatement',
          description: 'Vos symptômes nécessitent une attention médicale immédiate',
          advice: 'Veuillez vous rendre aux urgences les plus proches ou appeler les services d\'urgence immédiatement. Ne retardez pas la consultation médicale.'
        },
        monitor: {
          title: 'Surveiller - Prendre Rendez-vous',
          description: 'Vos symptômes doivent être évalués par un professionnel de santé',
          advice: 'Envisagez de prendre rendez-vous avec votre médecin dans les prochains jours. Surveillez vos symptômes et consultez immédiatement si ils s\'aggravent.'
        },
        safe: {
          title: 'Sûr - Auto-soins Recommandés',
          description: 'Vos symptômes semblent être mineurs',
          advice: 'Continuez avec des mesures d\'auto-soins comme le repos, l\'hydratation et des médicaments en vente libre si approprié. Si les symptômes persistent ou s\'aggravent, consultez un professionnel de santé.'
        }
      },
      ar: {
        urgent: {
          title: 'عاجل - اطلب العناية الطبية فوراً',
          description: 'أعراضك تتطلب عناية طبية عاجلة',
          advice: 'يرجى زيارة أقرب قسم طوارئ أو الاتصال بخدمات الطوارئ فوراً. لا تؤخر طلب الرعاية الطبية.'
        },
        monitor: {
          title: 'مراقبة - احجز موعداً',
          description: 'أعراضك تحتاج إلى تقييم من مقدم رعاية صحية',
          advice: 'فكر في حجز موعد مع طبيبك خلال الأيام القليلة القادمة. راقب أعراضك واطلب العناية الفورية إذا ازدادت سوءاً.'
        },
        safe: {
          title: 'آمن - العناية الذاتية موصى بها',
          description: 'أعراضك تبدو طفيفة',
          advice: 'استمر في إجراءات العناية الذاتية مثل الراحة والترطيب والأدوية المتاحة دون وصفة طبية حسب الحاجة. إذا استمرت الأعراض أو ازدادت سوءاً، استشر مقدم رعاية صحية.'
        }
      }
    };
    return messages[language]?.[level as keyof typeof messages.en] || messages.en[level as keyof typeof messages.en];
  };

  // Check for urgent symptoms
  if (urgentKeywords.some(keyword => text.includes(keyword))) {
    const msg = getLocalizedMessages('urgent');
    return {
      level: 'urgent',
      color: 'red',
      title: msg.title,
      description: msg.description,
      advice: msg.advice
    };
  }

  // Check for monitor symptoms
  if (monitorKeywords.some(keyword => text.includes(keyword))) {
    const msg = getLocalizedMessages('monitor');
    return {
      level: 'monitor',
      color: 'yellow',
      title: msg.title,
      description: msg.description,
      advice: msg.advice
    };
  }

  // Default to safe
  const msg = getLocalizedMessages('safe');
  return {
    level: 'safe',
    color: 'green',
    title: msg.title,
    description: msg.description,
    advice: msg.advice
  };
}
