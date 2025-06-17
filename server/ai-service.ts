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
  profile?: {
    name: string;
    age: number | null;
    gender: string | null;
    medicalConditions: string[];
    allergies: string[];
    medications: string[];
  };
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
  
  const systemRole = `You are ShifAI (شفاء الذكي), an advanced medical AI assistant with complete access to ${context.name}'s medical history and profile. You are like a personal doctor who knows everything about this patient.

YOUR MISSION: Answer any medical question with personalized advice based on their complete health data. Provide specific medications, dosages, treatments, and prevention strategies. Be conversational, helpful, and direct like ChatGPT but with medical expertise.

PATIENT PROFILE - ${context.name}:
${context.profile ? `
👤 DEMOGRAPHICS: Age ${context.profile.age || 'Unknown'}, Gender ${context.profile.gender || 'Unknown'}
💊 MEDICATIONS: ${context.profile.medications.length > 0 ? context.profile.medications.join(', ') : 'None reported'}
🚨 ALLERGIES: ${context.profile.allergies.length > 0 ? context.profile.allergies.join(', ') : 'None reported'}  
🏥 CONDITIONS: ${context.profile.medicalConditions.length > 0 ? context.profile.medicalConditions.join(', ') : 'None reported'}
` : ''}
${context.recentSymptoms.length > 0 ? `🔍 SYMPTOM HISTORY: ${context.recentSymptoms.map((s) => `${s.symptoms} (${s.triageLevel} level, ${s.timestamp.toLocaleDateString()})`).join(' | ')}
` : ''}

COMMUNICATION RULES:
- Answer ANY medical question directly and specifically
- Use their symptom history to give personalized recommendations  
- Suggest specific medications with dosages when appropriate
- Provide prevention strategies tailored to their history
- Be conversational and helpful like a knowledgeable friend
- Always respond in ${context.language === 'ar' ? 'Arabic' : context.language === 'fr' ? 'French' : 'English'}
- Reference their past symptoms when relevant for context

RECENT CONVERSATION:
${chatHistory.slice(-3).map((msg) => `${msg.role === 'user' ? context.name : 'ShifAI'}: ${msg.content}`).join('\n')}

Give comprehensive medical advice based on their complete health profile.`;

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

    // Intelligent fallback responses using patient history
    const lowerMessage = message.toLowerCase();
    const userName = context.name.split(' ')[0];
    
    // Personalized greetings
    if (lowerMessage.includes('hi') || lowerMessage.includes('hello') || lowerMessage.includes('hey')) {
      const recentSymptomContext = context.recentSymptoms.length > 0 ? 
        ` I see you've been dealing with ${context.recentSymptoms[0].symptoms} recently.` : '';
      
      const greetings = {
        en: `Hi ${userName}! I'm ShifAI, your personal health assistant.${recentSymptomContext} What can I help you with today?`,
        fr: `Salut ${userName}! Je suis ShifAI, votre assistant santé personnel.${recentSymptomContext} Comment puis-je vous aider?`,
        ar: `مرحباً ${userName}! أنا شفاء الذكي، مساعدك الصحي الشخصي.${recentSymptomContext} كيف يمكنني مساعدتك؟`
      };
      return greetings[context.language as keyof typeof greetings] || greetings.en;
    }

    // Pain management with history context
    if (lowerMessage.includes('pain') || lowerMessage.includes('hurt')) {
      const hasRecentPain = context.recentSymptoms.some(s => s.symptoms.toLowerCase().includes('pain'));
      const painContext = hasRecentPain ? ` Given your recent pain history, ` : ` `;
      
      const painAdvice = {
        en: `For pain management,${painContext}I recommend starting with ibuprofen 400mg every 6-8 hours with food, or acetaminophen 500mg every 4-6 hours. Apply heat/cold therapy, gentle stretching, and ensure adequate rest. If pain persists beyond 3 days or worsens, consider consulting a doctor.`,
        fr: `Pour la gestion de la douleur,${painContext}je recommande de commencer par ibuprofène 400mg toutes les 6-8 heures avec de la nourriture, ou paracétamol 500mg toutes les 4-6 heures. Appliquez la thermothérapie, des étirements doux et assurez-vous d'un repos adéquat.`,
        ar: `لإدارة الألم،${painContext}أنصح بالبدء بإيبوبروفين 400 ملغ كل 6-8 ساعات مع الطعام، أو أسيتامينوفين 500 ملغ كل 4-6 ساعات. اطبق العلاج الحراري والتمدد اللطيف واحصل على راحة كافية.`
      };
      return painAdvice[context.language as keyof typeof painAdvice] || painAdvice.en;
    }

    // Medication questions
    if (lowerMessage.includes('medication') || lowerMessage.includes('medicine') || lowerMessage.includes('drug')) {
      const medAdvice = {
        en: `${userName}, I can recommend specific medications based on your symptoms. For general wellness, consider: multivitamins, omega-3 supplements, or probiotics. For specific conditions, I can suggest targeted treatments. What specific issue would you like medication advice for?`,
        fr: `${userName}, je peux recommander des médicaments spécifiques basés sur vos symptômes. Pour le bien-être général, considérez: multivitamines, suppléments d'oméga-3, ou probiotiques. Pour des conditions spécifiques, je peux suggérer des traitements ciblés.`,
        ar: `${userName}، يمكنني أن أوصي بأدوية محددة بناءً على أعراضك. للعافية العامة، فكر في: الفيتامينات المتعددة، مكملات أوميغا-3، أو البروبيوتيك. للحالات المحددة، يمكنني اقتراح علاجات مستهدفة.`
      };
      return medAdvice[context.language as keyof typeof medAdvice] || medAdvice.en;
    }

    // General health questions with personalized context
    const hasSymptomHistory = context.recentSymptoms.length > 0;
    const contextMessage = hasSymptomHistory ? 
      ` Based on your history of ${context.recentSymptoms.map(s => s.symptoms).join(', ')}, ` : ' ';
    
    const fallbackResponses = {
      en: `${userName}, I'm here to help with any health question you have.${contextMessage}Ask me about medications, treatments, prevention strategies, or any health concern. I have access to your complete medical history to give you personalized advice.`,
      fr: `${userName}, je suis là pour vous aider avec toute question de santé.${contextMessage}Demandez-moi des médicaments, des traitements, des stratégies de prévention, ou toute préoccupation de santé.`,
      ar: `${userName}، أنا هنا لمساعدتك في أي سؤال صحي.${contextMessage}اسألني عن الأدوية أو العلاجات أو استراتيجيات الوقاية أو أي مخاوف صحية.`
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
  const lines = text.split('\n');
  let currentSection = '';
  let content = '';
  
  for (const line of lines) {
    if (line.includes('CLINICAL SUMMARY')) {
      currentSection = 'summary';
      content = '';
    } else if (line.includes('TIMELINE ANALYSIS')) {
      if (currentSection === 'summary') sections.summary = content.trim();
      currentSection = 'timeline';
      content = '';
    } else if (line.includes('RISK ASSESSMENT')) {
      if (currentSection === 'timeline') sections.timeline = content.trim();
      currentSection = 'risk';
      content = '';
    } else if (line.includes('RECOMMENDATIONS')) {
      if (currentSection === 'risk') sections.risk = content.trim();
      currentSection = 'recommendations';
      content = '';
    } else {
      content += line + '\n';
    }
  }
  
  // Handle the last section
  if (currentSection === 'recommendations') sections.recommendations = content.trim();
  else if (currentSection === 'risk') sections.risk = content.trim();
  else if (currentSection === 'timeline') sections.timeline = content.trim();
  else if (currentSection === 'summary') sections.summary = content.trim();

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