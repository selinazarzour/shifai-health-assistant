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

// Build medical chat prompt with patient context
function buildChatPrompt(
  message: string,
  context: PatientContext,
  chatHistory: ChatMessage[],
): string {
  const disclaimerText = {
    en: "⚠️ This is AI-generated advice and is not a substitute for medical diagnosis.",
    fr: "⚠️ Ceci est un conseil généré par IA et ne remplace pas un diagnostic médical.",
    ar: "⚠️ هذه نصيحة مولدة بالذكاء الاصطناعي وليست بديلاً عن التشخيص الطبي.",
  };

  const systemPrompt = `You are ShifAI, an expert medical AI assistant serving patients in Lebanon and Tunisia. Provide comprehensive healthcare guidance including:

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

  return `${systemPrompt}\n\nUser: ${message}\nAssistant:`;
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

    // Fallback response with disclaimer
    const fallbackResponses = {
      en: `I'm having trouble processing your request right now. Please consider consulting with a healthcare professional about your symptoms.

⚠️ This is AI-generated advice and is not a substitute for medical diagnosis.`,
      fr: `J'ai des difficultés à traiter votre demande en ce moment. Veuillez consulter un professionnel de la santé concernant vos symptômes.

⚠️ Ceci est un conseil généré par IA et ne remplace pas un diagnostic médical.`,
      ar: `أواجه صعوبة في معالجة طلبكم في الوقت الحالي. يرجى استشارة أخصائي الرعاية الصحية حول أعراضكم.

⚠️ هذه نصيحة مولدة بالذكاء الاصطناعي وليست بديلاً عن التشخيص الطبي.`,
    };

    return (
      fallbackResponses[context.language as keyof typeof fallbackResponses] ||
      fallbackResponses.en
    );
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

  // Look for structured sections
  const summaryMatch = text.match(
    /CLINICAL SUMMARY:?\s*([\s\S]*?)(?=TIMELINE|$)/,
  );
  const timelineMatch = text.match(
    /TIMELINE ANALYSIS:?\s*([\s\S]*?)(?=RISK|$)/,
  );
  const riskMatch = text.match(
    /RISK ASSESSMENT:?\s*([\s\S]*?)(?=RECOMMENDATIONS|$)/,
  );
  const recMatch = text.match(/RECOMMENDATIONS:?\s*([\s\S]*)$/);

  sections.summary = summaryMatch?.[1]?.trim();
  sections.timeline = timelineMatch?.[1]?.trim();
  sections.risk = riskMatch?.[1]?.trim();
  sections.recommendations = recMatch?.[1]?.trim();

  // If structured sections not found, use the full text as summary
  if (!sections.summary) {
    sections.summary = text.substring(0, 300) + "...";
  }

  return sections;
}

// Health check for AI service
export async function checkAIServiceHealth(): Promise<boolean> {
  try {
    const testResponse = await hf.textGeneration({
      model: MODELS.FALLBACK,
      inputs: "Hello",
      parameters: { max_new_tokens: 10 },
    });
    return !!testResponse;
  } catch (error) {
    console.error("AI service health check failed:", error);
    return false;
  }
}
