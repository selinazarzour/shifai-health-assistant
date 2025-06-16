import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertSymptomEntrySchema } from "@shared/schema";
import { z } from "zod";
import { generateChatResponse, generateClinicalReport, type PatientContext } from "./ai-service";

const DOCTOR_PASSWORD = "doctor123";

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Submit symptom entry
  app.post("/api/symptoms", async (req, res) => {
    try {
      const validatedData = insertSymptomEntrySchema.parse(req.body);
      const entry = await storage.createSymptomEntry(validatedData);
      res.json(entry);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid input", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to create symptom entry" });
      }
    }
  });

  // Get user's symptom history
  app.get("/api/symptoms/user/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const entries = await storage.getSymptomEntriesByUser(userId);
      res.json(entries);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch symptom entries" });
    }
  });

  // Doctor authentication
  app.post("/api/doctor/login", async (req, res) => {
    try {
      const { password } = req.body;
      if (password === DOCTOR_PASSWORD) {
        res.json({ success: true });
      } else {
        res.status(401).json({ error: "Invalid password" });
      }
    } catch (error) {
      res.status(500).json({ error: "Login failed" });
    }
  });

  // Get all symptom entries for doctor dashboard
  app.get("/api/doctor/symptoms", async (req, res) => {
    try {
      const { level } = req.query;
      let entries;
      
      if (level && level !== "all") {
        entries = await storage.getSymptomEntriesByTriageLevel(level as string);
      } else {
        entries = await storage.getAllSymptomEntries();
      }
      
      res.json(entries);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch symptom entries" });
    }
  });

  // Get dashboard statistics
  app.get("/api/doctor/stats", async (req, res) => {
    try {
      const allEntries = await storage.getAllSymptomEntries();
      const stats = {
        totalPatients: new Set(allEntries.map(e => e.userId)).size,
        urgentCases: allEntries.filter(e => e.triageLevel === 'urgent').length,
        monitorCases: allEntries.filter(e => e.triageLevel === 'monitor').length,
        safeCases: allEntries.filter(e => e.triageLevel === 'safe').length,
      };
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch statistics" });
    }
  });

  // AI Chat API Routes
  const chatMessageSchema = z.object({
    message: z.string().min(1),
    uid: z.string(),
    language: z.string(),
    patientName: z.string(),
    profileData: z.object({
      age: z.number().nullable().optional(),
      gender: z.string().nullable().optional(),
      medicalConditions: z.array(z.string()).optional(),
      allergies: z.array(z.string()).optional(),
      medications: z.array(z.string()).optional()
    }).optional(),
    recentSymptoms: z.array(z.object({
      symptoms: z.string(),
      triageLevel: z.string(),
      timestamp: z.string()
    })).optional()
  });

  app.post("/api/chat", async (req, res) => {
    try {
      const { message, uid, language, patientName, profileData, recentSymptoms } = chatMessageSchema.parse(req.body);
      
      // Use actual profile data from request with proper null handling
      const patientProfile = profileData ? {
        name: patientName,
        age: profileData.age || null,
        gender: profileData.gender || null,
        medicalConditions: profileData.medicalConditions || [],
        allergies: profileData.allergies || [],
        medications: profileData.medications || []
      } : {
        name: patientName,
        age: null,
        gender: null,
        medicalConditions: [],
        allergies: [],
        medications: []
      };
      
      // Create context with real Firebase symptom data
      const context: PatientContext = {
        uid,
        name: patientName,
        recentSymptoms: (recentSymptoms || []).map(symptom => ({
          symptoms: symptom.symptoms,
          triageLevel: symptom.triageLevel,
          timestamp: new Date(symptom.timestamp)
        })),
        language
      };

      // Generate personalized response with real profile context
      const response = generateLocalChatResponse(message, context, language, patientProfile);
      
      res.json({ response });
    } catch (error) {
      console.error('Chat API error:', error);
      
      // Provide fallback response with proper medical disclaimer
      const fallbackResponses = {
        en: `I understand your health concerns. Please consider consulting with a healthcare professional for proper evaluation and guidance.

⚠️ This is AI-generated advice and is not a substitute for medical diagnosis.`,
        fr: `Je comprends vos préoccupations de santé. Veuillez consulter un professionnel de la santé pour une évaluation et des conseils appropriés.

⚠️ Ceci est un conseil généré par IA et ne remplace pas un diagnostic médical.`,
        ar: `أفهم مخاوفك الصحية. يرجى استشارة أخصائي الرعاية الصحية للحصول على تقييم وإرشادات مناسبة.

⚠️ هذه نصيحة مولدة بالذكاء الاصطناعي وليست بديلاً عن التشخيص الطبي.`
      };

      const fallback = fallbackResponses[req.body.language as keyof typeof fallbackResponses] || fallbackResponses.en;
      res.json({ response: fallback });
    }
  });

  // Clinical Report Generation - Enhanced with Firebase data
  app.post("/api/doctor/generate-report/:patientId", async (req, res) => {
    try {
      const { patientId } = req.params;
      const { patientName, patientEmail, patientData } = req.body;
      
      // Generate report with real Firebase data
      const report = generateEnhancedClinicalReport(patientId, patientName, patientEmail, patientData);
      
      res.json(report);
    } catch (error) {
      console.error('Report generation error:', error);
      res.status(500).json({ error: "Failed to generate clinical report" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

// Enhanced local response generation with profile personalization
function generateLocalChatResponse(message: string, context: PatientContext, language: string, patientProfile?: any): string {
  const disclaimers = {
    en: "⚠️ This is AI-generated advice and is not a substitute for medical diagnosis.",
    fr: "⚠️ Ceci est un conseil généré par IA et ne remplace pas un diagnostic médical.",
    ar: "⚠️ هذه نصيحة مولدة بالذكاء الاصطناعي وليست بديلاً عن التشخيص الطبي."
  };

  // Personalized greeting based on profile
  const personalizedGreeting = {
    en: `Hello ${context.name.split(' ')[0]}, I understand your health concerns.`,
    fr: `Bonjour ${context.name.split(' ')[0]}, je comprends vos préoccupations de santé.`,
    ar: `مرحباً ${context.name.split(' ')[0]}، أفهم مخاوفك الصحية.`
  };

  // Enhanced responses with profile awareness
  const responses = {
    en: {
      greeting: personalizedGreeting.en,
      symptoms_reference: context.recentSymptoms.length > 0 
        ? `Looking at your symptom history: ${context.recentSymptoms.map(s => `"${s.symptoms}" (${s.triageLevel} level, ${s.timestamp.toLocaleDateString()})`).join(', ')}.` 
        : "",
      profile_context: patientProfile ? generateProfileContext(patientProfile, 'en') : "",
      general_advice: "I recommend monitoring your symptoms closely and consulting with a healthcare professional for proper evaluation.",
      emergency: "If you experience severe symptoms like difficulty breathing, chest pain, or loss of consciousness, seek immediate medical attention.",
      specific_advice: generateSpecificAdvice(message, context, patientProfile, 'en')
    },
    fr: {
      greeting: personalizedGreeting.fr,
      symptoms_reference: context.recentSymptoms.length > 0 
        ? `En examinant votre historique de symptômes: ${context.recentSymptoms.map(s => `"${s.symptoms}" (niveau ${s.triageLevel}, ${s.timestamp.toLocaleDateString()})`).join(', ')}.` 
        : "",
      profile_context: patientProfile ? generateProfileContext(patientProfile, 'fr') : "",
      general_advice: "Je recommande de surveiller attentivement vos symptômes et de consulter un professionnel de la santé pour une évaluation appropriée.",
      emergency: "Si vous ressentez des symptômes graves comme une difficulté à respirer, des douleurs thoraciques ou une perte de conscience, consultez immédiatement un médecin.",
      specific_advice: generateSpecificAdvice(message, context, patientProfile, 'fr')
    },
    ar: {
      greeting: personalizedGreeting.ar,
      symptoms_reference: context.recentSymptoms.length > 0 
        ? `بالنظر إلى تاريخ أعراضك: ${context.recentSymptoms.map(s => `"${s.symptoms}" (مستوى ${s.triageLevel}، ${s.timestamp.toLocaleDateString()})`).join('، ')}.` 
        : "",
      profile_context: patientProfile ? generateProfileContext(patientProfile, 'ar') : "",
      general_advice: "أنصح بمراقبة أعراضك عن كثب واستشارة أخصائي الرعاية الصحية للحصول على تقييم مناسب.",
      emergency: "إذا كنت تعاني من أعراض شديدة مثل صعوبة في التنفس أو ألم في الصدر أو فقدان الوعي، اطلب العناية الطبية الفورية.",
      specific_advice: generateSpecificAdvice(message, context, patientProfile, 'ar')
    }
  };

  const lang = language as keyof typeof responses;
  const langResponses = responses[lang] || responses.en;
  
  let response = langResponses.greeting + " " + langResponses.symptoms_reference + langResponses.profile_context + langResponses.specific_advice;
  
  // Add emergency advice for urgent keywords
  const urgentKeywords = ['chest pain', 'difficulty breathing', 'unconscious', 'severe pain', 'bleeding', 'suicide', 'overdose'];
  if (urgentKeywords.some(keyword => message.toLowerCase().includes(keyword))) {
    response += "\n\n" + langResponses.emergency;
  } else {
    response += " " + langResponses.general_advice;
  }
  
  return response + "\n\n" + disclaimers[lang as keyof typeof disclaimers];
}

// Generate profile-specific context
function generateProfileContext(profile: any, language: string): string {
  if (!profile) return "";
  
  const contextParts = [];
  
  if (profile.age) {
    const ageContext = {
      en: `Given your age of ${profile.age}, `,
      fr: `Étant donné votre âge de ${profile.age} ans, `,
      ar: `نظراً لعمرك ${profile.age} سنة، `
    };
    contextParts.push(ageContext[language as keyof typeof ageContext] || ageContext.en);
  }
  
  if (profile.medicalConditions && profile.medicalConditions.length > 0) {
    const conditionsContext = {
      en: `considering your medical history of ${profile.medicalConditions.join(', ')}, `,
      fr: `en tenant compte de vos antécédents médicaux de ${profile.medicalConditions.join(', ')}, `,
      ar: `مع الأخذ في الاعتبار تاريخك الطبي من ${profile.medicalConditions.join('، ')}، `
    };
    contextParts.push(conditionsContext[language as keyof typeof conditionsContext] || conditionsContext.en);
  }
  
  return contextParts.join('');
}

// Generate specific advice based on message content and context
function generateSpecificAdvice(message: string, context: PatientContext, profile: any, language: string): string {
  const lowerMessage = message.toLowerCase();
  const userQuestion = message.trim();
  const recentSymptoms = context.recentSymptoms;
  const hasRecentSymptoms = recentSymptoms.length > 0;
  
  // Analyze specific patterns in user questions for personalized responses
  if (lowerMessage.includes('worsening') || lowerMessage.includes('worse') || lowerMessage.includes('getting worse')) {
    if (hasRecentSymptoms) {
      const urgentSymptoms = recentSymptoms.filter(s => s.triageLevel === 'urgent' || s.triageLevel === 'monitor');
      if (urgentSymptoms.length > 0) {
        return language === 'en' ? 
          `Since you've reported worsening symptoms, especially your ${urgentSymptoms[0].symptoms}, I strongly recommend seeking immediate medical attention. Worsening symptoms should not be ignored.` :
        language === 'fr' ?
          `Puisque vous avez signalé des symptômes qui s'aggravent, en particulier votre ${urgentSymptoms[0].symptoms}, je recommande fortement de consulter immédiatement un médecin.` :
          `نظرًا لأنك أبلغت عن تفاقم الأعراض، خاصة ${urgentSymptoms[0].symptoms}، أنصح بشدة بطلب العناية الطبية الفورية.`;
      }
    }
  }
  
  if (lowerMessage.includes('should i see') || lowerMessage.includes('doctor') || lowerMessage.includes('hospital')) {
    const urgentCount = recentSymptoms.filter(s => s.triageLevel === 'urgent').length;
    const monitorCount = recentSymptoms.filter(s => s.triageLevel === 'monitor').length;
    
    if (urgentCount > 0) {
      return language === 'en' ? 
        `Yes, based on your urgent-level symptoms, you should seek immediate medical attention. Don't delay.` :
      language === 'fr' ?
        `Oui, basé sur vos symptômes de niveau urgent, vous devriez consulter immédiatement un médecin.` :
        `نعم، بناءً على أعراضك العاجلة، يجب أن تطلب العناية الطبية الفورية.`;
    } else if (monitorCount > 0) {
      return language === 'en' ? 
        `Given your monitor-level symptoms, scheduling an appointment with your doctor within the next few days would be wise.` :
      language === 'fr' ?
        `Étant donné vos symptômes de niveau surveillance, prendre rendez-vous avec votre médecin dans les prochains jours serait sage.` :
        `نظرًا لأعراضك التي تحتاج للمراقبة، سيكون من الحكمة تحديد موعد مع طبيبك خلال الأيام القليلة القادمة.`;
    }
  }
  
  if (lowerMessage.includes('what should i do') || lowerMessage.includes('next steps')) {
    if (hasRecentSymptoms) {
      const latestSymptom = recentSymptoms[0];
      return language === 'en' ? 
        `For your ${latestSymptom.symptoms} (${latestSymptom.triageLevel} level), I recommend: 1) Continue monitoring symptoms, 2) Rest and hydration, 3) Contact healthcare provider if symptoms worsen, 4) Keep a symptom diary.` :
      language === 'fr' ?
        `Pour votre ${latestSymptom.symptoms} (niveau ${latestSymptom.triageLevel}), je recommande: 1) Continuer à surveiller les symptômes, 2) Repos et hydratation, 3) Contacter un professionnel de santé si les symptômes s'aggravent.` :
        `بالنسبة لـ ${latestSymptom.symptoms} (مستوى ${latestSymptom.triageLevel})، أنصح بـ: 1) مواصلة مراقبة الأعراض، 2) الراحة والترطيب، 3) الاتصال بمقدم الرعاية الصحية إذا تفاقمت الأعراض.`;
    }
  }
  
  // Pain-related advice with context
  if (lowerMessage.includes('pain') || lowerMessage.includes('hurt') || lowerMessage.includes('ache')) {
    const painContext = hasRecentSymptoms && recentSymptoms.some(s => s.symptoms.toLowerCase().includes('pain')) ? 
      ` Given your recent pain reports, ` : ' ';
    const painAdvice = {
      en: `For pain management,${painContext}consider rest, proper hydration, and gentle movement if tolerated. Monitor pain levels and seek care if severe.`,
      fr: `Pour la gestion de la douleur,${painContext}considérez le repos, une hydratation adéquate et des mouvements doux si tolérés.`,
      ar: `لإدارة الألم،${painContext}فكر في الراحة والترطيب المناسب والحركة اللطيفة إذا كان ذلك مقبولاً.`
    };
    return painAdvice[language as keyof typeof painAdvice] || painAdvice.en;
  }
  if (lowerMessage.includes('stress') || lowerMessage.includes('anxiety') || lowerMessage.includes('worried')) {
    const stressAdvice = {
      en: "Consider stress management techniques like deep breathing, meditation, or gentle exercise. If anxiety persists, professional support can be very helpful.",
      fr: "Considérez des techniques de gestion du stress comme la respiration profonde, la méditation ou l'exercice léger. Si l'anxiété persiste, un soutien professionnel peut être très utile.",
      ar: "فكر في تقنيات إدارة الإجهاد مثل التنفس العميق والتأمل أو التمارين اللطيفة. إذا استمر القلق، يمكن أن يكون الدعم المهني مفيداً جداً."
    };
    return stressAdvice[language as keyof typeof stressAdvice] || stressAdvice.en;
  }
  
  // General wellness advice
  const generalAdvice = {
    en: "Focus on rest, proper nutrition, and staying hydrated while monitoring your symptoms.",
    fr: "Concentrez-vous sur le repos, une nutrition appropriée et rester hydraté tout en surveillant vos symptômes.",
    ar: "ركز على الراحة والتغذية المناسبة والحفاظ على الترطيب أثناء مراقبة أعراضك."
  };
  
  return generalAdvice[language as keyof typeof generalAdvice] || generalAdvice.en;
}

function generateEnhancedClinicalReport(patientId: string, patientName: string, patientEmail: string, patientData: any) {
  const entries = patientData?.entries || [];
  const profile = patientData?.profile || {};
  
  const totalEntries = entries.length;
  const urgentEntries = entries.filter((e: any) => e.triageLevel === 'urgent').length;
  const monitorEntries = entries.filter((e: any) => e.triageLevel === 'monitor').length;
  const safeEntries = entries.filter((e: any) => e.triageLevel === 'safe').length;

  // Enhanced summary with real patient data
  const symptomsList = entries.slice(0, 5).map((e: any) => `"${e.symptoms}" (${e.triageLevel})`).join(', ');
  const ageContext = profile.age ? ` Age: ${profile.age}.` : '';
  const conditionsContext = profile.medicalConditions?.length > 0 ? ` Medical history: ${profile.medicalConditions.join(', ')}.` : '';
  
  // Timeline analysis
  const sortedEntries = entries.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  const timelineEvents = sortedEntries.slice(0, 5).map((e: any) => 
    `${new Date(e.timestamp).toLocaleDateString()}: ${e.symptoms} (${e.triageLevel})`
  ).join('\n');

  // Risk assessment based on patterns
  let riskLevel = 'LOW';
  let riskDetails = 'Symptoms appear manageable with routine care.';
  
  if (urgentEntries > 0) {
    riskLevel = 'HIGH PRIORITY';
    riskDetails = `${urgentEntries} urgent-level symptoms detected. Immediate evaluation required.`;
  } else if (monitorEntries > 1) {
    riskLevel = 'MODERATE';
    riskDetails = `Multiple monitor-level symptoms (${monitorEntries}) suggest ongoing health concerns requiring professional assessment.`;
  } else if (monitorEntries === 1) {
    riskLevel = 'MODERATE';
    riskDetails = 'Single monitor-level symptom warrants medical consultation within 2-3 days.';
  }

  // Personalized recommendations
  let recommendations = 'Continue symptom monitoring and maintain regular healthcare check-ups.';
  if (urgentEntries > 0) {
    recommendations = 'IMMEDIATE ACTION: Urgent medical evaluation required. Consider emergency care if symptoms persist or worsen.';
  } else if (monitorEntries > 0) {
    recommendations = `Schedule medical appointment within 48-72 hours. Monitor for symptom progression.${profile.age && profile.age > 65 ? ' Given patient age, prioritize prompt evaluation.' : ''}`;
  }

  return {
    patientId,
    summary: `Patient ${patientName} (${patientEmail}) has submitted ${totalEntries} symptom entries.${ageContext}${conditionsContext} Recent symptoms include: ${symptomsList || 'No recent symptoms recorded'}.`,
    timeline: totalEntries > 0 ? `Recent symptom progression:\n${timelineEvents}` : 'No symptom timeline available.',
    riskAnalysis: `${riskLevel}: ${riskDetails} Distribution: ${urgentEntries} urgent, ${monitorEntries} monitor, ${safeEntries} safe.`,
    recommendations: recommendations,
    generatedAt: new Date()
  };
}
