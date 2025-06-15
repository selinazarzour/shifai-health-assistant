import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { analyzeSymptoms } from "@/lib/triage";
import { apiRequest } from "@/lib/queryClient";
import type { TriageResult } from "@shared/schema";

const symptomFormSchema = z.object({
  symptoms: z.string().min(10, "Please provide more detailed symptoms"),
  age: z.number().min(1).max(120).optional(),
  gender: z.string().optional(),
});

type SymptomFormData = z.infer<typeof symptomFormSchema>;

interface SymptomFormProps {
  userId: string;
  onResult: (result: TriageResult, symptoms: string) => void;
}

export function SymptomForm({ userId, onResult }: SymptomFormProps) {
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();
  
  const form = useForm<SymptomFormData>({
    resolver: zodResolver(symptomFormSchema),
    defaultValues: {
      symptoms: "",
      age: undefined,
      gender: "",
    },
  });

  const submitSymptomMutation = useMutation({
    mutationFn: async (data: SymptomFormData & { triageResult: TriageResult }) => {
      return apiRequest("POST", "/api/symptoms", {
        userId,
        symptoms: data.symptoms,
        age: data.age,
        gender: data.gender,
        language,
        triageLevel: data.triageResult.level,
        triageResult: JSON.stringify(data.triageResult),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/symptoms/user', userId] });
      form.reset();
    },
  });

  const onSubmit = (data: SymptomFormData) => {
    const triageResult = analyzeSymptoms(data.symptoms);
    onResult(triageResult, data.symptoms);
    
    submitSymptomMutation.mutate({
      ...data,
      triageResult,
    });
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
            
            <Button 
              type="submit" 
              className="w-full sm:w-auto"
              disabled={submitSymptomMutation.isPending}
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
