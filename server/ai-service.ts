import { HfInference } from '@huggingface/inference';

// Initialize Hugging Face Inference
const hf = new HfInference(process.env.HUGGINGFACE_API_TOKEN);

// Medical AI Models Configuration
const MODELS = {
  // Chat interface - Mistral 7B Instruct for multilingual medical conversations
  CHAT: "mistralai/Mistral-7B-Instruct-v0.1",
  // Clinical summarization - BioMedLM for medical report generation
  CLINICAL: "stanford-crfm/BioMedLM",
  // Fallback general model
  FALLBACK: "microsoft/DialoGPT-medium"
};

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
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
  chatHistory: ChatMessage[]
): string {
  const disclaimerText = {
    en: "⚠️ This is AI-generated advice and is not a substitute for medical diagnosis.",
    fr: "⚠️ Ceci est un conseil généré par IA et ne remplace pas un diagnostic médical.",
    ar: "⚠️ هذه نصيحة مولدة بالذكاء الاصطناعي وليست بديلاً عن التشخيص الطبي."
  };

  const systemPrompt = `You are a compassionate healthcare assistant for patients in Lebanon and Tunisia. 

IMPORTANT GUIDELINES:
- Always include this disclaimer: "${disclaimerText[context.language as keyof typeof disclaimerText] || disclaimerText.en}"
- Never diagnose or replace medical consultation
- Be warm, conversational, and supportive
- Reference past symptoms when relevant for personalized advice
- Suggest seeking medical care for concerning symptoms
- Support Arabic, French, and English languages
- Focus on general wellness and when to seek professional help

Patient Context:
- Name: ${context.name}
- Language: ${context.language}
${context.recentSymptoms.length > 0 ? `- Recent symptoms: ${context.recentSymptoms.map(s => `${s.symptoms} (${s.triageLevel} level, ${s.timestamp.toLocaleDateString()})`).join('; ')}` : '- No recent symptom history'}

Previous conversation:
${chatHistory.slice(-4).map(msg => `${msg.role}: ${msg.content}`).join('\n')}

Respond in ${context.language} in a caring, professional tone.`;

  return `${systemPrompt}\n\nUser: ${message}\nAssistant:`;
}

// Build clinical report prompt
function buildClinicalPrompt(patientData: any): string {
  const entries = patientData.entries || [];
  const profile = patientData.profile || {};
  
  return `Generate a comprehensive clinical summary for this patient:

Patient Information:
- Name: ${profile.displayName || 'Unknown'}
- Age: ${profile.age || 'Not specified'}
- Gender: ${profile.gender || 'Not specified'}

Symptom History (${entries.length} entries):
${entries.map((entry: any, index: number) => 
  `${index + 1}. ${entry.timestamp.toLocaleDateString()} - ${entry.symptoms} (Triage: ${entry.triageLevel})`
).join('\n')}

Medical Background:
- Conditions: ${profile.medicalConditions?.join(', ') || 'None reported'}
- Allergies: ${profile.allergies?.join(', ') || 'None reported'}
- Medications: ${profile.medications?.join(', ') || 'None reported'}

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
  chatHistory: ChatMessage[]
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
        return_full_text: false
      }
    });

    let generatedText = response.generated_text?.trim() || '';
    
    // Ensure disclaimer is included
    const disclaimerText = {
      en: "⚠️ This is AI-generated advice and is not a substitute for medical diagnosis.",
      fr: "⚠️ Ceci est un conseil généré par IA et ne remplace pas un diagnostic médical.",
      ar: "⚠️ هذه نصيحة مولدة بالذكاء الاصطناعي وليست بديلاً عن التشخيص الطبي."
    };

    const disclaimer = disclaimerText[context.language as keyof typeof disclaimerText] || disclaimerText.en;
    
    if (!generatedText.includes('⚠️')) {
      generatedText = `${generatedText}\n\n${disclaimer}`;
    }

    return generatedText;
  } catch (error) {
    console.error('Error generating chat response:', error);
    
    // Fallback response with disclaimer
    const fallbackResponses = {
      en: `I'm having trouble processing your request right now. Please consider consulting with a healthcare professional about your symptoms.

⚠️ This is AI-generated advice and is not a substitute for medical diagnosis.`,
      fr: `J'ai des difficultés à traiter votre demande en ce moment. Veuillez consulter un professionnel de la santé concernant vos symptômes.

⚠️ Ceci est un conseil généré par IA et ne remplace pas un diagnostic médical.`,
      ar: `أواجه صعوبة في معالجة طلبكم في الوقت الحالي. يرجى استشارة أخصائي الرعاية الصحية حول أعراضكم.

⚠️ هذه نصيحة مولدة بالذكاء الاصطناعي وليست بديلاً عن التشخيص الطبي.`
    };

    return fallbackResponses[context.language as keyof typeof fallbackResponses] || fallbackResponses.en;
  }
}

// Generate clinical report for doctors
export async function generateClinicalReport(patientData: any): Promise<ClinicalReport> {
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
        return_full_text: false
      }
    });

    const generatedText = response.generated_text?.trim() || '';
    
    // Parse the structured report
    const sections = parseReportSections(generatedText);
    
    return {
      patientId: patientData.profile?.uid || '',
      summary: sections.summary || 'Unable to generate summary at this time.',
      timeline: sections.timeline || 'Timeline analysis unavailable.',
      riskAnalysis: sections.risk || 'Risk assessment pending.',
      recommendations: sections.recommendations || 'Please review patient history manually.',
      generatedAt: new Date()
    };
  } catch (error) {
    console.error('Error generating clinical report:', error);
    
    // Fallback structured report
    return {
      patientId: patientData.profile?.uid || '',
      summary: `Patient has submitted ${patientData.entries?.length || 0} symptom entries. Manual review recommended.`,
      timeline: 'Automated timeline analysis unavailable. Please review entries chronologically.',
      riskAnalysis: 'Risk assessment requires manual clinical evaluation.',
      recommendations: 'Recommend comprehensive patient evaluation and symptom pattern analysis.',
      generatedAt: new Date()
    };
  }
}

// Parse report sections from generated text
function parseReportSections(text: string) {
  const sections: any = {};
  
  // Look for structured sections
  const summaryMatch = text.match(/CLINICAL SUMMARY:?\s*([\s\S]*?)(?=TIMELINE|$)/);
  const timelineMatch = text.match(/TIMELINE ANALYSIS:?\s*([\s\S]*?)(?=RISK|$)/);
  const riskMatch = text.match(/RISK ASSESSMENT:?\s*([\s\S]*?)(?=RECOMMENDATIONS|$)/);
  const recMatch = text.match(/RECOMMENDATIONS:?\s*([\s\S]*)$/);
  
  sections.summary = summaryMatch?.[1]?.trim();
  sections.timeline = timelineMatch?.[1]?.trim();
  sections.risk = riskMatch?.[1]?.trim();
  sections.recommendations = recMatch?.[1]?.trim();
  
  // If structured sections not found, use the full text as summary
  if (!sections.summary) {
    sections.summary = text.substring(0, 300) + '...';
  }
  
  return sections;
}

// Health check for AI service
export async function checkAIServiceHealth(): Promise<boolean> {
  try {
    const testResponse = await hf.textGeneration({
      model: MODELS.FALLBACK,
      inputs: "Hello",
      parameters: { max_new_tokens: 10 }
    });
    return !!testResponse;
  } catch (error) {
    console.error('AI service health check failed:', error);
    return false;
  }
}