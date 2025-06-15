import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertSymptomEntrySchema } from "@shared/schema";
import { z } from "zod";

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

  const httpServer = createServer(app);
  return httpServer;
}
