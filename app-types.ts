
export enum JobStatus {
  DETECTED = 'Detected',
  SAVED = 'Saved',
  PENDING = 'Pending',
  SUBMITTED = 'Submitted',
  APPLIED_AUTO = 'Applied (AI)',
  APPLIED_MANUAL = 'Applied',
  FAILED = 'Failed',
  RESPONSE_RECEIVED = 'Response Received',
  INTERVIEW = 'Interview Scheduled',
  REJECTED = 'Rejected',
  OFFER = 'Offered'
}

export enum ViewState {
  DASHBOARD = 'DASHBOARD',
  SELECTED_JOBS = 'SELECTED_JOBS', 
  TRACKER = 'TRACKER', 
  EMAILS = 'EMAILS',
  DISCOVERY = 'DISCOVERY',
  ANALYTICS = 'ANALYTICS',
  SETTINGS = 'SETTINGS',
  SUPPORT = 'SUPPORT',
  SUBSCRIPTION = 'SUBSCRIPTION',
  DEBUG = 'DEBUG',
  MANUAL = 'MANUAL'
}

export interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  salaryRange?: string;
  description: string;
  employmentType?: 'Full-time' | 'Part-time' | 'Contract' | 'Internship';
  source: 'Gmail' | 'LinkedIn' | 'Indeed' | 'Imported Link' | 'Google Maps' | 'Manual';
  detectedAt: string; 
  status: JobStatus;
  matchScore: number; 
  fitReason?: string;
  requirements: string[];
  coverLetter?: string;
  customizedResume?: string; 
  notes?: string;
  logoUrl?: string;
  applicationUrl?: string;
  interviewQuestions?: string[];
}

export interface UserPreferences {
  targetRoles: string[];
  targetLocations: string[];
  minSalary: string;
  remoteOnly: boolean;
  language: 'en' | 'es' | 'fr' | 'de' | 'ar';
}

export interface EmailAccount {
  id: string;
  provider: 'Gmail' | 'Outlook' | 'Yahoo' | 'IMAP';
  emailAddress: string;
  isConnected: boolean;
  lastSynced: string;
  accessToken?: string;
}

export interface UserProfile {
  id: string; 
  fullName: string;
  email: string; 
  phone: string;
  resumeContent: string; 
  resumeFileName?: string;
  preferences: UserPreferences;
  onboardedAt: string | null;
  connectedAccounts: EmailAccount[];
  plan: 'free' | 'pro';
  subscriptionExpiry?: string;
}

export const isSubscriptionValid = (profile: UserProfile | null): boolean => {
  if (!profile) return false;
  if (profile.plan === 'pro') return true;
  return false;
};
