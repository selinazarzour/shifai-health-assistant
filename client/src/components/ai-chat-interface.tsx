import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageCircle, Send, Bot, User, Loader2 } from "lucide-react";
import { useLanguage } from "@/hooks/use-language";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { saveChatMessage, getChatHistory, type ChatMessage } from "@/lib/firebase";

interface AIChatInterfaceProps {
  visible: boolean;
}

export function AIChatInterface({ visible }: AIChatInterfaceProps) {
  const { t, language } = useLanguage();
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Load chat history when component becomes visible
  useEffect(() => {
    if (visible && user?.uid && messages.length === 0) {
      loadChatHistory();
    }
  }, [visible, user?.uid]);

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  const loadChatHistory = async () => {
    if (!user?.uid) return;

    setIsLoadingHistory(true);
    try {
      // Skip chat history loading for now due to Firebase permissions
      // const history = await getChatHistory(user.uid);
      // setMessages(history.reverse());
      setMessages([]); // Start with empty chat until Firebase rules are updated
    } catch (error) {
      console.error('Error loading chat history:', error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || !user?.uid || !profile) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      uid: user.uid,
      role: 'user',
      content: inputMessage.trim(),
      timestamp: new Date(),
      language
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage("");
    setIsLoading(true);

    try {
      // Get AI response from server with profile data
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage.content,
          uid: user.uid,
          language,
          patientName: profile.displayName || `${profile.firstName} ${profile.lastName}`,
          profileData: {
            age: profile.age,
            gender: profile.gender,
            medicalConditions: profile.medicalConditions || [],
            allergies: profile.allergies || [],
            medications: profile.medications || []
          }
        })
      });

      const responseData = await response.json();

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        uid: user.uid,
        role: 'assistant',
        content: responseData.response,
        timestamp: new Date(),
        language
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Skip Firebase saving for now - store in session only until rules are updated

    } catch (error) {
      console.error('Error sending message:', error);
      
      // Fallback response with disclaimer
      const fallbackResponses = {
        en: `I'm having trouble processing your request right now. Please consider consulting with a healthcare professional about your symptoms.

⚠️ This is AI-generated advice and is not a substitute for medical diagnosis.`,
        fr: `J'ai des difficultés à traiter votre demande en ce moment. Veuillez consulter un professionnel de la santé concernant vos symptômes.

⚠️ Ceci est un conseil généré par IA et ne remplace pas un diagnostic médical.`,
        ar: `أواجه صعوبة في معالجة طلبكم في الوقت الحالي. يرجى استشارة أخصائي الرعاية الصحية حول أعراضكم.

⚠️ هذه نصيحة مولدة بالذكاء الاصطناعي وليست بديلاً عن التشخيص الطبي.`
      };

      const fallbackMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        uid: user.uid,
        role: 'assistant',
        content: fallbackResponses[language as keyof typeof fallbackResponses] || fallbackResponses.en,
        timestamp: new Date(),
        language
      };

      setMessages(prev => [...prev, fallbackMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTimestamp = (timestamp: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - timestamp.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    return timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (!visible) return null;

  const chatTitles = {
    en: "Ask ShifAI",
    fr: "Demander à ShifAI", 
    ar: "اسأل شفاء الذكي"
  };

  const placeholders = {
    en: "Ask about your symptoms or health concerns...",
    fr: "Posez des questions sur vos symptômes ou problèmes de santé...",
    ar: "اسأل عن أعراضك أو مخاوفك الصحية..."
  };

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <MessageCircle className="w-5 h-5 text-primary" />
          <span>{chatTitles[language as keyof typeof chatTitles]}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Chat Messages */}
          <ScrollArea className="h-64 w-full border rounded-lg p-4" ref={scrollAreaRef}>
            {isLoadingHistory ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                <Bot className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">
                  {language === 'en' && "Ask me about your health concerns"}
                  {language === 'fr' && "Posez-moi des questions sur vos préoccupations de santé"}
                  {language === 'ar' && "اسألني عن مخاوفك الصحية"}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg p-3 ${
                        message.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}
                    >
                      <div className="flex items-start space-x-2">
                        {message.role === 'assistant' && (
                          <Bot className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        )}
                        {message.role === 'user' && (
                          <User className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        )}
                        <div className="flex-1">
                          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                          <p className="text-xs opacity-70 mt-1">
                            {formatTimestamp(message.timestamp)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Message Input */}
          <div className="flex space-x-2">
            <Input
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={placeholders[language as keyof typeof placeholders]}
              disabled={isLoading}
              className="flex-1"
            />
            <Button
              onClick={sendMessage}
              disabled={!inputMessage.trim() || isLoading}
              size="icon"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>

          {/* Disclaimer */}
          <div className="text-xs text-muted-foreground bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg border border-yellow-200 dark:border-yellow-800">
            <p className="font-medium text-yellow-800 dark:text-yellow-200">
              ⚠️ {language === 'en' && "This is AI-generated advice and is not a substitute for medical diagnosis."}
              {language === 'fr' && "Ceci est un conseil généré par IA et ne remplace pas un diagnostic médical."}
              {language === 'ar' && "هذه نصيحة مولدة بالذكاء الاصطناعي وليست بديلاً عن التشخيص الطبي."}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}