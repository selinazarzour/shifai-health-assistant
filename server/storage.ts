import { users, symptomEntries, type User, type InsertUser, type SymptomEntry, type InsertSymptomEntry } from "@shared/schema";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Symptom entries
  createSymptomEntry(entry: InsertSymptomEntry): Promise<SymptomEntry>;
  getSymptomEntriesByUser(userId: string): Promise<SymptomEntry[]>;
  getAllSymptomEntries(): Promise<SymptomEntry[]>;
  getSymptomEntriesByTriageLevel(level: string): Promise<SymptomEntry[]>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private symptomEntries: Map<number, SymptomEntry>;
  currentUserId: number;
  currentEntryId: number;

  constructor() {
    this.users = new Map();
    this.symptomEntries = new Map();
    this.currentUserId = 1;
    this.currentEntryId = 1;
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async createSymptomEntry(insertEntry: InsertSymptomEntry): Promise<SymptomEntry> {
    const id = this.currentEntryId++;
    const entry: SymptomEntry = {
      ...insertEntry,
      id,
      timestamp: new Date(),
    };
    this.symptomEntries.set(id, entry);
    return entry;
  }

  async getSymptomEntriesByUser(userId: string): Promise<SymptomEntry[]> {
    return Array.from(this.symptomEntries.values())
      .filter(entry => entry.userId === userId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  async getAllSymptomEntries(): Promise<SymptomEntry[]> {
    return Array.from(this.symptomEntries.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  async getSymptomEntriesByTriageLevel(level: string): Promise<SymptomEntry[]> {
    return Array.from(this.symptomEntries.values())
      .filter(entry => entry.triageLevel === level)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }
}

export const storage = new MemStorage();
