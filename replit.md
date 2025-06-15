# HealthAssist - AI Healthcare Assistant

## Overview

HealthAssist is a multilingual healthcare triage application that helps patients assess their symptoms and receive preliminary guidance on whether to seek immediate care. The application features an AI-powered symptom analysis system with support for English, French, and Arabic languages, along with a doctor dashboard for monitoring patient entries.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter for client-side routing
- **State Management**: TanStack Query (React Query) for server state management
- **Authentication**: Firebase Authentication with Google Sign-In
- **Database**: Firebase Firestore for patient profiles and symptom history
- **UI Components**: Shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom CSS variables for theming
- **Form Handling**: React Hook Form with Zod validation
- **Build Tool**: Vite for development and production builds

### Backend Architecture
- **Runtime**: Node.js with Express.js server
- **Language**: TypeScript with ES modules
- **Doctor Dashboard**: In-memory storage for demonstration purposes
- **Session Management**: Simple password-based authentication for doctors
- **Development**: TSX for TypeScript execution in development

### Database Schema
The application uses Firebase Firestore with the following collections:
- **patients**: Patient profiles with authentication and medical information
- **symptomEntries**: Patient symptom submissions with triage results and analysis

## Key Components

### Patient Interface
- **Symptom Form**: Multi-language symptom input with age/gender collection
- **Triage Analysis**: Rule-based symptom assessment with color-coded results
- **User History**: Personal symptom tracking and history view
- **Language Support**: Dynamic language switching (English, French, Arabic)

### Doctor Dashboard
- **Patient Overview**: Statistics dashboard showing case distribution
- **Entry Management**: View and filter patient symptom entries
- **Triage Filtering**: Filter by urgency level (safe, monitor, urgent)
- **Authentication**: Simple password-based access control

### Triage System
- **Rule Engine**: Keyword-based analysis in multiple languages
- **Risk Levels**: Three-tier system (safe/green, monitor/yellow, urgent/red)
- **Multilingual Support**: Symptom keywords in English, French, and Arabic

## Data Flow

1. **Patient Submission**: User inputs symptoms and demographic information
2. **Triage Analysis**: Client-side analysis determines risk level and advice
3. **Database Storage**: Entry stored with user ID, symptoms, and triage result
4. **Doctor Access**: Healthcare providers can view aggregated data and individual entries
5. **History Tracking**: Users can view their previous symptom submissions

## External Dependencies

### Core Dependencies
- **@neondatabase/serverless**: PostgreSQL database connectivity
- **drizzle-orm**: Type-safe database ORM with PostgreSQL dialect
- **@tanstack/react-query**: Server state management
- **react-hook-form**: Form handling and validation
- **zod**: Schema validation for type safety

### UI Dependencies
- **@radix-ui/***: Accessible UI component primitives
- **tailwindcss**: Utility-first CSS framework
- **class-variance-authority**: Component variant management
- **lucide-react**: Icon library

### Development Dependencies
- **vite**: Build tool and development server
- **tsx**: TypeScript execution for development
- **esbuild**: Production bundling for server code

## Deployment Strategy

### Development Environment
- **Runtime**: Node.js 20 with Replit environment
- **Database**: PostgreSQL 16 with automatic provisioning
- **Development Server**: Concurrent client (Vite) and server (Express) processes
- **Port Configuration**: Server runs on port 5000, client proxied through Vite

### Production Build
- **Client**: Vite builds React app to `dist/public`
- **Server**: ESBuild bundles Express server to `dist/index.js`
- **Database**: Drizzle migrations applied via `npm run db:push`
- **Deployment**: Autoscale deployment on Replit infrastructure

### Environment Configuration
- **DATABASE_URL**: PostgreSQL connection string (required)
- **NODE_ENV**: Environment flag for development/production modes
- **REPL_ID**: Replit-specific environment detection

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

- June 15, 2025: Enhanced Firebase authentication system with popup-based Google Sign-In
- June 15, 2025: Added mandatory firstName/lastName profile fields with automatic profile setup for new users  
- June 15, 2025: Removed age/gender inputs from symptom form - now collected only in profile section
- June 15, 2025: Fixed Firebase Firestore connection issues with proper error handling for offline scenarios
- June 15, 2025: Updated doctor dashboard to display patient names instead of IDs from Firebase collections

## Firebase Configuration Required

The application uses Firebase Firestore in production mode. Update security rules to:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /patients/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    match /symptomEntries/{entryId} {
      allow read, write: if request.auth != null && request.auth.uid == resource.data.uid;
      allow create: if request.auth != null && request.auth.uid == request.resource.data.uid;
    }
    match /symptomEntries/{entryId} {
      allow read: if request.auth != null;
    }
  }
}
```

## Changelog

Changelog:
- June 15, 2025. Initial setup
- June 15, 2025. Firebase authentication and profile system implementation