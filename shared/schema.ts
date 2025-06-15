import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const symptomEntries = pgTable("symptom_entries", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  symptoms: text("symptoms").notNull(),
  age: integer("age"),
  gender: text("gender"),
  language: text("language").notNull(),
  triageLevel: text("triage_level").notNull(), // 'safe', 'monitor', 'urgent'
  triageResult: text("triage_result").notNull(), // JSON string
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertSymptomEntrySchema = createInsertSchema(symptomEntries).omit({
  id: true,
  timestamp: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertSymptomEntry = z.infer<typeof insertSymptomEntrySchema>;
export type SymptomEntry = typeof symptomEntries.$inferSelect;

// Triage result type
export type TriageResult = {
  level: 'safe' | 'monitor' | 'urgent';
  color: 'green' | 'yellow' | 'red';
  title: string;
  description: string;
  advice: string;
};
