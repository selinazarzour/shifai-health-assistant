import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search } from "lucide-react";
import { useLanguage } from "@/hooks/use-language";
import { useAuth } from "@/hooks/use-auth";
import { analyzeSymptoms } from "@/lib/triage";
import { saveSymptomEntry } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import type { TriageResult } from "@shared/schema";

const symptomFormSchema = z.object({
  symptoms: z.string().min(10, "Please provide more detailed symptoms"),
  age: z.number().min(1).max(120).optional(),
  gender: z.string().optional(),
});

type SymptomFormData = z.infer<typeof symptomFormSchema>;

interface FirebaseSymptomFormProps {
  onResult: (result: TriageResult, symptoms: string) => void;
  onHistoryUpdate: () => void;
}

export function FirebaseSymptomForm({ onResult, onHistoryUpdate }: FirebaseSymptomFormProps) {
  const { t, language } = useLanguage();
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const form = useForm<SymptomFormData>({
    resolver: zodResolver(symptomFormSchema),
    defaultValues: {
      symptoms: "",
      age: profile?.age || undefined,
      gender: profile?.gender || "",
    },
  });

  const onSubmit = async (data: SymptomFormData) => {
    if (!user) {
      toast({
        title: "Sign In Required",
        description: "Please sign in to save your symptom assessment.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const triageResult = analyzeSymptoms(data.symptoms, language);
      onResult(triageResult, data.symptoms);
      
      // Save to Firebase
      await saveSymptomEntry(user.uid, {
        symptoms: data.symptoms,
        age: data.age,
        gender: data.gender,
        language,
        triageLevel: triageResult.level,
        triageResult: JSON.stringify(triageResult),
      });

      form.reset({
        symptoms: "",
        age: profile?.age || undefined,
        gender: profile?.gender || "",
      });

      onHistoryUpdate();

      toast({
        title: "Assessment Complete",
        description: "Your symptom assessment has been saved to your history.",
      });
    } catch (error) {
      console.error('Error saving symptom entry:', error);
      toast({
        title: "Save Error",
        description: "Could not save your assessment. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">{t('describe_symptoms')}</CardTitle>
        <p className="text-muted-foreground">{t('symptom_instructions')}</p>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="symptoms"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('symptoms_label')}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe your symptoms here... / Décrivez vos symptômes ici... / صف أعراضك هنا..."
                      rows={6}
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="age"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('age_label')}</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="1"
                        max="120"
                        placeholder="Your age"
                        {...field}
                        onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="gender"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('gender_label')}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('select_gender')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="male">{t('male')}</SelectItem>
                        <SelectItem value="female">{t('female')}</SelectItem>
                        <SelectItem value="other">{t('other')}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            {!user && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> Sign in with Google to save your assessments and track your health history.
                </p>
              </div>
            )}
            
            <Button 
              type="submit" 
              className="w-full sm:w-auto"
              disabled={isSubmitting}
            >
              <Search className="w-4 h-4 mr-2" />
              {t('analyze_symptoms')}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}