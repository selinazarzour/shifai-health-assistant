import { HfInference } from "@huggingface/inference";

// Initialize Hugging Face Inference with free tier
const hf = new HfInference();

// Medical AI Models Configuration - using free models
const MODELS = {
  // Chat interface - Meta Llama for open conversations
  CHAT: "meta-llama/Llama-2-7b-chat-hf",
  // Clinical reports - Mistral for medical analysis
  CLINICAL: "mistralai/Mistral-7B-Instruct-v0.1",
  // Fallback model
  FALLBACK: "microsoft/DialoGPT-medium",
};

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  language: string;
}

export interface PatientContext {
  uid: string;
  name: string;
  recentSymptoms: Array<{
    symptoms: string;
    triageLevel: string;
    timestamp: Date;
  }>;
  language: string;
}

export interface ClinicalReport {
  patientId: string;
  summary: string;
  timeline: string;
  riskAnalysis: string;
  recommendations: string;
  generatedAt: Date;
}

// Build conversational prompt for open medical discussions
function buildChatPrompt(
  message: string,
  context: PatientContext,
  chatHistory: ChatMessage[],
): string {
  
  const systemRole = `You are ShifAI, an expert medical AI assistant serving patients in Lebanon and Tunisia. Provide comprehensive healthcare guidance including:

MEDICAL EXPERTISE:
- Specific medication recommendations with dosages
- Prevention strategies and lifestyle modifications
- Home remedies and self-care instructions
- Treatment options and symptom management
- Clear guidance on when to seek immediate vs routine care

COMMUNICATION STYLE:
- Be direct, helpful, and conversational like ChatGPT
- Provide practical medical advice patients need
- Respond in ${context.language === 'ar' ? 'Arabic' : context.language === 'fr' ? 'French' : 'English'}
- Use patient's name: ${context.name}

PATIENT CONTEXT:
${context.recentSymptoms.length > 0 ? `Recent health history: ${context.recentSymptoms.map((s) => `${s.symptoms} (${s.triageLevel} priority, ${s.timestamp.toLocaleDateString()})`).join('; ')}` : 'No recent symptom history available'}

RECENT CONVERSATION:
${chatHistory.slice(-3).map((msg) => `${msg.role === 'user' ? 'Patient' : 'ShifAI'}: ${msg.content}`).join('\n')}

Provide helpful medical guidance with specific actionable advice.`;

  return `${systemRole}\n\nUser: ${message}\nAssistant:`;
}

// Build clinical report prompt
function buildClinicalPrompt(patientData: any): string {
  const entries = patientData.entries || [];
  const profile = patientData.profile || {};

  return `Generate a comprehensive clinical summary for this patient:

Patient Information:
- Name: ${profile.displayName || "Unknown"}
- Age: ${profile.age || "Not specified"}
- Gender: ${profile.gender || "Not specified"}

Symptom History (${entries.length} entries):
${entries
  .map(
    (entry: any, index: number) =>
      `${index + 1}. ${entry.timestamp.toLocaleDateString()} - ${entry.symptoms} (Triage: ${entry.triageLevel})`,
  )
  .join("\n")}

Medical Background:
- Conditions: ${profile.medicalConditions?.join(", ") || "None reported"}
- Allergies: ${profile.allergies?.join(", ") || "None reported"}
- Medications: ${profile.medications?.join(", ") || "None reported"}

Please provide:
1. CLINICAL SUMMARY: A professional paragraph summarizing the patient's condition
2. TIMELINE ANALYSIS: Key patterns in symptom progression
3. RISK ASSESSMENT: Current risk level and concerning patterns
4. RECOMMENDATIONS: Suggested follow-up actions for healthcare provider

Format as a structured medical report. Be concise but thorough.`;
}

// Generate AI chat response
export async function generateChatResponse(
  message: string,
  context: PatientContext,
  chatHistory: ChatMessage[],
): Promise<string> {
  try {
    const prompt = buildChatPrompt(message, context, chatHistory);

    const response = await hf.textGeneration({
      model: MODELS.CHAT,
      inputs: prompt,
      parameters: {
        max_new_tokens: 300,
        temperature: 0.7,
        top_p: 0.9,
        repetition_penalty: 1.1,
        return_full_text: false,
      },
    });

    let generatedText = response.generated_text?.trim() || "";

    // Clean up the response
    if (generatedText.startsWith("ShifAI:") || generatedText.startsWith("Assistant:")) {
      generatedText = generatedText.replace(/^(ShifAI:|Assistant:)\s*/i, '');
    }

    return generatedText || "I'm here to help with your health questions. Could you tell me more about what you're experiencing?";
  } catch (error) {
    console.error("Error generating chat response:", error);

    // Intelligent fallback based on message content
    const lowerMessage = message.toLowerCase();
    const userName = context.name.split(' ')[0];
    
    // Provide helpful fallback responses based on message type
    if (lowerMessage.includes('hi') || lowerMessage.includes('hello') || lowerMessage.includes('hey')) {
      const greetings = {
        en: `Hi ${userName}! I'm ShifAI, your health assistant. How can I help you today?`,
        fr: `Salut ${userName}! Je suis ShifAI, votre assistant santé. Comment puis-je vous aider?`,
        ar: `مرحباً ${userName}! أنا شفاء الذكي، مساعدك الصحي. كيف يمكنني مساعدتك؟`
      };
      return greetings[context.language as keyof typeof greetings] || greetings.en;
    }

    if (lowerMessage.includes('pain') || lowerMessage.includes('hurt')) {
      const painAdvice = {
        en: `For pain management, try rest, gentle movement, and staying hydrated. Monitor your symptoms and seek medical care if pain is severe or persistent.`,
        fr: `Pour la gestion de la douleur, essayez le repos, les mouvements doux et restez hydraté. Surveillez vos symptômes et consultez un médecin si la douleur est sévère.`,
        ar: `لإدارة الألم، جرب الراحة والحركة اللطيفة والترطيب. راقب أعراضك واطلب الرعاية الطبية إذا كان الألم شديدًا أو مستمرًا.`
      };
      return painAdvice[context.language as keyof typeof painAdvice] || painAdvice.en;
    }

    // General fallback responses
    const fallbackResponses = {
      en: `I understand your concern, ${userName}. For your health questions, I recommend consulting with a healthcare professional who can provide proper evaluation.`,
      fr: `Je comprends votre préoccupation, ${userName}. Pour vos questions de santé, je recommande de consulter un professionnel de la santé.`,
      ar: `أفهم قلقك، ${userName}. لأسئلتك الصحية، أنصح باستشارة أخصائي الرعاية الصحية.`
    };

    return fallbackResponses[context.language as keyof typeof fallbackResponses] || fallbackResponses.en;
  }
}

// Generate clinical report for doctors
export async function generateClinicalReport(
  patientData: any,
): Promise<ClinicalReport> {
  try {
    const prompt = buildClinicalPrompt(patientData);

    const response = await hf.textGeneration({
      model: MODELS.CLINICAL,
      inputs: prompt,
      parameters: {
        max_new_tokens: 600,
        temperature: 0.3,
        top_p: 0.8,
        repetition_penalty: 1.05,
        return_full_text: false,
      },
    });

    const generatedText = response.generated_text?.trim() || "";

    // Parse the structured report
    const sections = parseReportSections(generatedText);

    return {
      patientId: patientData.profile?.uid || "",
      summary: sections.summary || "Unable to generate summary at this time.",
      timeline: sections.timeline || "Timeline analysis unavailable.",
      riskAnalysis: sections.risk || "Risk assessment pending.",
      recommendations:
        sections.recommendations || "Please review patient history manually.",
      generatedAt: new Date(),
    };
  } catch (error) {
    console.error("Error generating clinical report:", error);

    // Fallback structured report
    return {
      patientId: patientData.profile?.uid || "",
      summary: `Patient has submitted ${patientData.entries?.length || 0} symptom entries. Manual review recommended.`,
      timeline:
        "Automated timeline analysis unavailable. Please review entries chronologically.",
      riskAnalysis: "Risk assessment requires manual clinical evaluation.",
      recommendations:
        "Recommend comprehensive patient evaluation and symptom pattern analysis.",
      generatedAt: new Date(),
    };
  }
}

// Parse report sections from generated text
function parseReportSections(text: string) {
  const sections: any = {};
  
  // Simple parsing for structured sections
  const summaryMatch = text.match(/CLINICAL SUMMARY:?\s*(.*?)(?=TIMELINE|$)/s);
  const timelineMatch = text.match(/TIMELINE ANALYSIS:?\s*(.*?)(?=RISK|$)/s);
  const riskMatch = text.match(/RISK ASSESSMENT:?\s*(.*?)(?=RECOMMENDATIONS|$)/s);
  const recommendationsMatch = text.match(/RECOMMENDATIONS:?\s*(.*?)$/s);

  sections.summary = summaryMatch?.[1]?.trim() || "";
  sections.timeline = timelineMatch?.[1]?.trim() || "";
  sections.risk = riskMatch?.[1]?.trim() || "";
  sections.recommendations = recommendationsMatch?.[1]?.trim() || "";

  return sections;
}

// Check AI service health
export async function checkAIServiceHealth(): Promise<boolean> {
  try {
    // Simple test request to verify service is working
    const response = await hf.textGeneration({
      model: MODELS.FALLBACK,
      inputs: "Test",
      parameters: {
        max_new_tokens: 10,
        temperature: 0.1,
      },
    });
    return !!response.generated_text;
  } catch (error) {
    console.error("AI service health check failed:", error);
    return false;
  }
}