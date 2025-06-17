import { HfInference } from "@huggingface/inference";

// Initialize Hugging Face Inference with free tier
const hf = new HfInference();

// Medical AI Models Configuration - using compatible free models
const MODELS = {
  // Chat interface - Compatible text generation model
  CHAT: "HuggingFaceH4/zephyr-7b-beta",
  // Clinical reports - Compatible medical analysis model
  CLINICAL: "microsoft/BioGPT-Large",
  // Fallback model for chat
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
  
  // Intelligent symptom analysis and natural language processing
  const analyzeSymptomHistory = (symptoms: any[]) => {
    if (symptoms.length === 0) return { summary: '', fullHistory: '', primarySymptoms: [] };
    
    const symptomTypes = new Map();
    const allSymptoms = [];
    
    symptoms.forEach(entry => {
      const text = entry.symptoms.toLowerCase();
      allSymptoms.push({ text, level: entry.triageLevel, date: entry.timestamp });
      
      // Extract specific symptom types
      if (text.includes('pain')) {
        if (text.includes('back')) symptomTypes.set('back pain', (symptomTypes.get('back pain') || 0) + 1);
        if (text.includes('foot') || text.includes('leg')) symptomTypes.set('lower extremity pain', (symptomTypes.get('lower extremity pain') || 0) + 1);
        if (text.includes('stomach') || text.includes('abdomen')) symptomTypes.set('abdominal pain', (symptomTypes.get('abdominal pain') || 0) + 1);
        if (text.includes('head')) symptomTypes.set('headaches', (symptomTypes.get('headaches') || 0) + 1);
      }
      if (text.includes('focus') || text.includes('concentrat') || text.includes('attention')) {
        symptomTypes.set('concentration difficulties', (symptomTypes.get('concentration difficulties') || 0) + 1);
      }
      if (text.includes('eye') && text.includes('burn')) {
        symptomTypes.set('eye strain', (symptomTypes.get('eye strain') || 0) + 1);
      }
      if (text.includes('nausea') || text.includes('sick')) {
        symptomTypes.set('nausea', (symptomTypes.get('nausea') || 0) + 1);
      }
      if (text.includes('numb')) {
        symptomTypes.set('numbness', (symptomTypes.get('numbness') || 0) + 1);
      }
    });
    
    // Create natural summary
    const primarySymptoms = Array.from(symptomTypes.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([symptom]) => symptom);
    
    let summary = '';
    if (primarySymptoms.length === 1) {
      summary = primarySymptoms[0];
    } else if (primarySymptoms.length === 2) {
      summary = `${primarySymptoms[0]} and ${primarySymptoms[1]}`;
    } else if (primarySymptoms.length >= 3) {
      summary = `${primarySymptoms[0]}, ${primarySymptoms[1]}, and ${primarySymptoms[2]}`;
    }
    
    // Create detailed history for AI context
    const recentSymptoms = symptoms.slice(0, 3).map(s => {
      const text = s.symptoms.toLowerCase();
      let cleanDescription = '';
      
      if (text.includes('focus') || text.includes('concentrat')) {
        cleanDescription = 'difficulty concentrating';
      } else if (text.includes('back') && text.includes('pain')) {
        cleanDescription = 'back pain';
      } else if (text.includes('foot') && text.includes('pain')) {
        cleanDescription = 'foot pain';
      } else if (text.includes('stomach') && text.includes('pain')) {
        cleanDescription = 'stomach pain';
      } else if (text.includes('eye') && text.includes('burn')) {
        cleanDescription = 'eye strain/burning';
      } else if (text.includes('head')) {
        cleanDescription = 'headache';
      } else {
        // Simplify complex descriptions
        cleanDescription = text.length > 30 ? 'multiple symptoms' : text;
      }
      
      return { description: cleanDescription, level: s.triageLevel };
    });
    
    return { 
      summary, 
      fullHistory: recentSymptoms.map(s => `${s.description} (${s.level})`).join(', '),
      primarySymptoms,
      recentSymptoms
    };
  };

  const symptomAnalysis = analyzeSymptomHistory(context.recentSymptoms);

  const systemRole = `You are ShifAI, an expert medical AI with complete access to ${context.name}'s health profile and symptom history. You understand their medical context without needing to ask.

PATIENT PROFILE: ${context.name}
${context.profile ? `Age: ${context.profile.age || 'Unknown'} | Gender: ${context.profile.gender || 'Unknown'}
Current Medications: ${context.profile.medications.length > 0 ? context.profile.medications.join(', ') : 'None'}
Allergies: ${context.profile.allergies.length > 0 ? context.profile.allergies.join(', ') : 'None'}
Medical Conditions: ${context.profile.medicalConditions.length > 0 ? context.profile.medicalConditions.join(', ') : 'None'}` : ''}

ANALYZED SYMPTOM HISTORY:
${symptomAnalysis.summary ? `Primary Concerns: ${symptomAnalysis.summary}
Recent Episodes: ${symptomAnalysis.fullHistory}` : 'No recent symptoms reported'}

KEY INSTRUCTIONS:
- When user asks about specific symptoms (like "focusing" or "pain"), reference their relevant symptom history
- Provide specific medications with dosages and explain what each treats
- Be conversational and direct - you already know their medical background
- Consider their allergies and current medications for safety
- If they mention a symptom they previously reported, acknowledge the connection
- Always explain WHY you recommend specific treatments
- Respond in ${context.language === 'ar' ? 'Arabic' : context.language === 'fr' ? 'French' : 'English'}

${chatHistory.length > 0 ? `Previous conversation context:\n${chatHistory.slice(-2).map((msg) => `${msg.role === 'user' ? context.name : 'ShifAI'}: ${msg.content}`).join('\n')}` : ''}

Provide knowledgeable medical guidance based on their complete health profile.`;

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
    (entry: any, index: number) => {
      const date = entry.timestamp instanceof Date ? entry.timestamp.toLocaleDateString() : 
                   typeof entry.timestamp === 'string' ? new Date(entry.timestamp).toLocaleDateString() : 
                   entry.timestamp?.toDate ? entry.timestamp.toDate().toLocaleDateString() : 'Unknown date';
      return `${index + 1}. ${date} - ${entry.symptoms} (Triage: ${entry.triageLevel})`;
    }
  )
  .join("\n")}

Medical Background:
- Conditions: ${profile.medicalConditions?.join(", ") || "None reported"}
- Allergies: ${profile.allergies?.join(", ") || "None reported"}
- Medications: ${profile.medications?.join(", ") || "None reported"}

Analyze this patient's data and provide a comprehensive clinical assessment:

1. CLINICAL SUMMARY: Summarize the patient's current health status, key symptoms, and overall condition in 2-3 sentences

2. TIMELINE ANALYSIS: Identify patterns in symptom progression, frequency, and severity changes over time

3. RISK ASSESSMENT: Evaluate current risk level based on symptoms, medical history, and concerning patterns. Rate as LOW/MODERATE/HIGH with justification

4. RECOMMENDATIONS: Provide specific clinical recommendations including:
   - Immediate actions needed
   - Follow-up care suggestions  
   - Diagnostic tests to consider
   - Treatment modifications

Write in professional medical language suitable for healthcare providers. Be specific and actionable.`;
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
    
    // Dynamic greetings using intelligent symptom analysis
    if (lowerMessage.includes('hi') || lowerMessage.includes('hello') || lowerMessage.includes('hey')) {
      // Inline symptom analysis for fallback
      const getSymptomSummary = (symptoms: any[]) => {
        if (symptoms.length === 0) return '';
        const text = symptoms[0].symptoms.toLowerCase();
        if (text.includes('focus') || text.includes('concentrat')) return 'concentration difficulties';
        if (text.includes('back') && text.includes('pain')) return 'back pain';
        if (text.includes('foot') && text.includes('pain')) return 'foot pain';
        if (text.includes('eye') && text.includes('burn')) return 'eye strain';
        return 'some health concerns';
      };
      
      const symptomSummary = getSymptomSummary(context.recentSymptoms);
      let symptomContext = '';
      
      if (symptomSummary) {
        symptomContext = ` I see you've been experiencing ${symptomSummary} recently.`;
      }
      
      const greetings = {
        en: `Hi ${userName}! I'm ShifAI, your personal health assistant.${symptomContext} How can I help you today?`,
        fr: `Salut ${userName}! Je suis ShifAI, votre assistant santé personnel.${symptomContext} Comment puis-je vous aider?`,
        ar: `مرحباً ${userName}! أنا شفاء الذكي، مساعدك الصحي الشخصي.${symptomContext} كيف يمكنني مساعدتك؟`
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

    // Handle specific symptom questions with context
    if (lowerMessage.includes('focus') || lowerMessage.includes('concentrat') || lowerMessage.includes('attention')) {
      const hasFocusIssues = context.recentSymptoms.some(s => 
        s.symptoms.toLowerCase().includes('focus') || 
        s.symptoms.toLowerCase().includes('concentrat') ||
        s.symptoms.toLowerCase().includes('attention')
      );
      
      if (hasFocusIssues) {
        const focusAdvice = {
          en: `For your concentration difficulties, I recommend: 1) Take regular breaks (20-20-20 rule: every 20 minutes, look at something 20 feet away for 20 seconds), 2) Consider magnesium supplements 200-400mg daily for focus, 3) Reduce screen time and blue light exposure, 4) Try ginkgo biloba 120mg twice daily for cognitive function. Given your recent eye strain symptoms, this combination should help improve both focus and eye comfort.`,
          fr: `Pour vos difficultés de concentration, je recommande: 1) Prenez des pauses régulières, 2) Considérez les suppléments de magnésium 200-400mg par jour, 3) Réduisez le temps d'écran, 4) Essayez le ginkgo biloba 120mg deux fois par jour.`,
          ar: `لصعوبات التركيز، أنصح بـ: 1) خذ فترات راحة منتظمة، 2) فكر في مكملات المغنيسيوم 200-400 ملغ يومياً، 3) قلل وقت الشاشة، 4) جرب الجنكة 120 ملغ مرتين يومياً.`
        };
        return focusAdvice[context.language as keyof typeof focusAdvice] || focusAdvice.en;
      }
    }
    
    // General intelligent fallback with clean symptom context
    const hasRecentSymptoms = context.recentSymptoms.length > 0;
    let contextMessage = '';
    if (hasRecentSymptoms) {
      const mainSymptom = context.recentSymptoms[0].symptoms.toLowerCase();
      if (mainSymptom.includes('focus')) contextMessage = ` Given your recent concentration difficulties, `;
      else if (mainSymptom.includes('pain')) contextMessage = ` Given your recent pain concerns, `;
      else contextMessage = ` Given your recent health concerns, `;
    }
    
    const fallbackResponses = {
      en: `${userName}, I'm here to help with any health question.${contextMessage}I can recommend specific medications, treatments, and prevention strategies based on your complete medical history.`,
      fr: `${userName}, je suis là pour vous aider avec toute question de santé.${contextMessage}Je peux recommander des médicaments, traitements et stratégies spécifiques.`,
      ar: `${userName}، أنا هنا لمساعدتك في أي سؤال صحي.${contextMessage}يمكنني أن أوصي بأدوية وعلاجات واستراتيجيات محددة.`
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

    // Intelligent fallback based on actual patient data
    const entries = patientData.entries || [];
    const profile = patientData.profile || {};
    
    // Analyze symptoms for patterns
    const symptomAnalysis = analyzeSymptomPatterns(entries);
    
    return {
      patientId: patientData.profile?.uid || "",
      summary: `${profile.displayName || 'Patient'} (${profile.age || 'Unknown age'}, ${profile.gender || 'Unknown gender'}) has reported ${entries.length} symptom episodes. ${symptomAnalysis.summary}`,
      timeline: symptomAnalysis.timeline,
      riskAnalysis: symptomAnalysis.riskLevel,
      recommendations: symptomAnalysis.recommendations,
      generatedAt: new Date(),
    };
  }
}

// Analyze symptom patterns for intelligent fallback reports
function analyzeSymptomPatterns(entries: any[]) {
  if (entries.length === 0) {
    return {
      summary: "No symptoms reported to date.",
      timeline: "No timeline available.",
      riskLevel: "LOW - No active symptoms reported",
      recommendations: "Routine health maintenance recommended."
    };
  }

  // Analyze symptom types and frequencies
  const symptomTypes = new Map();
  const urgentCount = entries.filter(e => e.triageLevel === 'urgent').length;
  const monitorCount = entries.filter(e => e.triageLevel === 'monitor').length;
  const safeCount = entries.filter(e => e.triageLevel === 'safe').length;

  entries.forEach(entry => {
    const symptoms = entry.symptoms.toLowerCase();
    if (symptoms.includes('pain')) {
      if (symptoms.includes('back')) symptomTypes.set('back pain', (symptomTypes.get('back pain') || 0) + 1);
      if (symptoms.includes('head')) symptomTypes.set('headache', (symptomTypes.get('headache') || 0) + 1);
      if (symptoms.includes('stomach')) symptomTypes.set('abdominal pain', (symptomTypes.get('abdominal pain') || 0) + 1);
      if (symptoms.includes('foot')) symptomTypes.set('foot pain', (symptomTypes.get('foot pain') || 0) + 1);
    }
    if (symptoms.includes('nausea')) symptomTypes.set('nausea', (symptomTypes.get('nausea') || 0) + 1);
    if (symptoms.includes('fever')) symptomTypes.set('fever', (symptomTypes.get('fever') || 0) + 1);
    if (symptoms.includes('fatigue')) symptomTypes.set('fatigue', (symptomTypes.get('fatigue') || 0) + 1);
  });

  const topSymptoms = Array.from(symptomTypes.entries())
    .sort(([,a], [,b]) => b - a)
    .slice(0, 3)
    .map(([symptom, count]) => `${symptom} (${count}x)`);

  // Generate summary
  const summary = topSymptoms.length > 0 ? 
    `Primary complaints include ${topSymptoms.join(', ')}.` :
    `Reports multiple symptom episodes requiring clinical evaluation.`;

  // Timeline analysis
  const timeline = entries.length > 1 ? 
    `Patient has reported ${entries.length} symptom episodes over time. Recent pattern shows ${urgentCount > 0 ? 'urgent symptoms requiring immediate attention' : monitorCount > 0 ? 'symptoms requiring monitoring' : 'manageable symptoms'}.` :
    `Single symptom episode reported. ${entries[0].triageLevel} priority level assigned.`;

  // Risk assessment
  let riskLevel = "LOW";
  if (urgentCount > 0) {
    riskLevel = `HIGH - ${urgentCount} urgent symptom episode(s) requiring immediate medical evaluation`;
  } else if (monitorCount > 1) {
    riskLevel = `MODERATE - ${monitorCount} symptom episodes requiring ongoing monitoring`;
  } else if (monitorCount === 1) {
    riskLevel = `MODERATE - Symptoms requiring clinical monitoring`;
  } else {
    riskLevel = `LOW - Symptoms appear manageable with routine care`;
  }

  // Recommendations
  let recommendations = "";
  if (urgentCount > 0) {
    recommendations = "IMMEDIATE: Schedule urgent medical evaluation. Consider emergency care if symptoms worsen. Follow up within 24-48 hours.";
  } else if (monitorCount > 0) {
    recommendations = "Schedule medical appointment within 1-2 weeks. Monitor symptom progression. Provide patient education on warning signs.";
  } else {
    recommendations = "Routine follow-up recommended. Lifestyle modifications and symptomatic treatment as appropriate.";
  }

  if (topSymptoms.length > 0) {
    recommendations += ` Primary focus: ${topSymptoms[0].split(' (')[0]} management.`;
  }

  return {
    summary,
    timeline,
    riskLevel,
    recommendations
  };
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