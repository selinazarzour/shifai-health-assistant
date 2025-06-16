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
    patientName: z.string()
  });

  app.post("/api/chat", async (req, res) => {
    try {
      const { message, uid, language, patientName } = chatMessageSchema.parse(req.body);
      
      // Get patient context and history
      const recentSymptoms = await storage.getSymptomEntriesByUser(uid);
      const context: PatientContext = {
        uid,
        name: patientName,
        recentSymptoms: recentSymptoms.slice(0, 3).map(entry => ({
          symptoms: entry.symptoms,
          triageLevel: entry.triageLevel,
          timestamp: new Date(entry.timestamp)
        })),
        language
      };

      // Generate response using local logic with medical disclaimers
      const response = generateLocalChatResponse(message, context, language);
      
      res.json({ response });
    } catch (error) {
      console.error('Chat API error:', error);
      res.status(500).json({ error: "Failed to generate response" });
    }
  });

  // Clinical Report Generation
  app.post("/api/doctor/generate-report/:patientId", async (req, res) => {
    try {
      const { patientId } = req.params;
      const entries = await storage.getSymptomEntriesByUser(patientId);
      
      // Generate structured clinical report
      const report = generateLocalClinicalReport(entries, patientId);
      
      res.json(report);
    } catch (error) {
      console.error('Report generation error:', error);
      res.status(500).json({ error: "Failed to generate clinical report" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

// Local response generation with medical guidance
function generateLocalChatResponse(message: string, context: PatientContext, language: string): string {
  const disclaimers = {
    en: "⚠️ This is AI-generated advice and is not a substitute for medical diagnosis.",
    fr: "⚠️ Ceci est un conseil généré par IA et ne remplace pas un diagnostic médical.",
    ar: "⚠️ هذه نصيحة مولدة بالذكاء الاصطناعي وليست بديلاً عن التشخيص الطبي."
  };

  const responses = {
    en: {
      greeting: "I understand your concern about your health.",
      symptoms_reference: context.recentSymptoms.length > 0 
        ? `Based on your recent symptoms of ${context.recentSymptoms[0].symptoms}, ` 
        : "",
      general_advice: "I recommend monitoring your symptoms closely and consulting with a healthcare professional for proper evaluation.",
      emergency: "If you experience severe symptoms like difficulty breathing, chest pain, or loss of consciousness, seek immediate medical attention."
    },
    fr: {
      greeting: "Je comprends votre préoccupation concernant votre santé.",
      symptoms_reference: context.recentSymptoms.length > 0 
        ? `Basé sur vos symptômes récents de ${context.recentSymptoms[0].symptoms}, ` 
        : "",
      general_advice: "Je recommande de surveiller attentivement vos symptômes et de consulter un professionnel de la santé pour une évaluation appropriée.",
      emergency: "Si vous ressentez des symptômes graves comme une difficulté à respirer, des douleurs thoraciques ou une perte de conscience, consultez immédiatement un médecin."
    },
    ar: {
      greeting: "أفهم قلقك بشأن صحتك.",
      symptoms_reference: context.recentSymptoms.length > 0 
        ? `بناءً على أعراضك الأخيرة من ${context.recentSymptoms[0].symptoms}، ` 
        : "",
      general_advice: "أنصح بمراقبة أعراضك عن كثب واستشارة أخصائي الرعاية الصحية للحصول على تقييم مناسب.",
      emergency: "إذا كنت تعاني من أعراض شديدة مثل صعوبة في التنفس أو ألم في الصدر أو فقدان الوعي، اطلب العناية الطبية الفورية."
    }
  };

  const lang = language as keyof typeof responses;
  const langResponses = responses[lang] || responses.en;
  
  let response = langResponses.greeting + " " + langResponses.symptoms_reference + langResponses.general_advice;
  
  // Add emergency advice for urgent keywords
  const urgentKeywords = ['chest pain', 'difficulty breathing', 'unconscious', 'severe pain', 'bleeding'];
  if (urgentKeywords.some(keyword => message.toLowerCase().includes(keyword))) {
    response += " " + langResponses.emergency;
  }
  
  return response + "\n\n" + disclaimers[lang as keyof typeof disclaimers];
}

function generateLocalClinicalReport(entries: any[], patientId: string) {
  const totalEntries = entries.length;
  const urgentEntries = entries.filter(e => e.triageLevel === 'urgent').length;
  const monitorEntries = entries.filter(e => e.triageLevel === 'monitor').length;
  const safeEntries = entries.filter(e => e.triageLevel === 'safe').length;
  
  const latestEntry = entries[0];
  const timespan = entries.length > 1 
    ? `over ${Math.ceil((Date.now() - new Date(entries[entries.length - 1].timestamp).getTime()) / (1000 * 60 * 60 * 24))} days`
    : 'recently';

  return {
    patientId,
    summary: `Patient has submitted ${totalEntries} symptom entries ${timespan}. Latest reported symptoms: "${latestEntry?.symptoms || 'None'}". Risk distribution shows ${urgentEntries} urgent, ${monitorEntries} monitor, and ${safeEntries} safe classifications.`,
    timeline: entries.map((entry, index) => 
      `${new Date(entry.timestamp).toLocaleDateString()}: ${entry.symptoms} (${entry.triageLevel})`
    ).join('\n'),
    riskAnalysis: urgentEntries > 0 
      ? `HIGH PRIORITY: ${urgentEntries} urgent entries require immediate attention.`
      : monitorEntries > 0 
        ? `MODERATE: ${monitorEntries} entries require monitoring.`
        : `LOW RISK: Most entries classified as safe.`,
    recommendations: urgentEntries > 0 
      ? 'Immediate clinical evaluation recommended for urgent symptoms.'
      : monitorEntries > 0 
        ? 'Schedule follow-up appointment to monitor symptoms.'
        : 'Continue routine care and monitoring.',
    generatedAt: new Date()
  };
}
