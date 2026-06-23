export interface ApplicationSkills {
  additionalHardSkills: string[];
  competencies: string[];
  focus: string[];
  hardSkills: string[];
  role: string;
  title: string;
  title1: string;
  title2: string;
  title3: string;
  title4: string;
}

export interface MockApplication {
  id: string;
  profileId: string;
  companyName: string;
  title: string;
  jdLink: string;
  linkedinJDLink: string;
  jd: string;
  resumeUrl: string;
  skills: ApplicationSkills;
  applied: boolean;
  recordedAt: string;
}

export interface MockProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  linkedin: string;
  resumePrompt: string;
  companies: string[];
  createdAt: string;
}

export interface ChartDataPoint {
  label: string;
  recorded: number;
  applied: number;
}

export interface DashboardStats {
  profileCount: number;
  totalRecorded: number;
  totalApplied: number;
  todayRecorded: number;
  todayApplied: number;
  yesterdayRecorded: number;
  yesterdayApplied: number;
  totalAiCostUsd: number;
}

export interface PricingChartDataPoint {
  label: string;
  skillExtraction: number;
  resumeBullets: number;
  total: number;
}

export interface CreateMockProfileInput {
  name: string;
  email: string;
  phone: string;
  linkedin: string;
  resumePrompt: string;
  companies: string[];
}

export interface ProfileAddress {
  city: string;
  state: string;
}

export interface ProfileCompany {
  name: string;
  prompt: string;
  bulletCount: number;
}

export interface Profile {
  id: string;
  userId: string;
  profileName: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  linkedin: string;
  generalPrompt: string;
  companies: ProfileCompany[];
  resumeTemplate: string;
  resumeTemplateFileName: string;
  resumeTemplateFormat: 'text' | 'docx' | '';
  resumeTemplateFilePath: string;
  address: ProfileAddress;
}

export interface Application {
  id: string;
  userId: string;
  profileId: string;
  companyName: string;
  jobTitle: string;
  jobDescription: string;
  hardSkills: string[];
  competencies: string[];
  linkedInJobUrl?: string;
  linkedInJobId?: string;
  jobId?: string;
  realJobUrl?: string;
  location?: string;
  companyLogoUrl?: string;
  companyBullets?: { company: string; bullets: string }[];
  skills?: {
    role: string;
    title: string;
    title1: string;
    title2: string;
    title3: string;
    title4: string;
    companyName: string;
    focus: string;
    hardSkills: string;
    additionalHardSkills: string;
    competencies: string;
  };
  resumeUrl?: string;
  status: 'recorded' | 'extracted' | 'resume_generated' | 'applied';
  aiCostUsd?: number;
  aiCostBreakdown?: {
    skillExtraction?: number;
    resumeBullets?: number;
  };
  createdAt: string;
  appliedAt?: string;
  updatedAt: string;
}

export interface CreateProfileInput {
  profileName: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phoneNumber?: string;
  linkedin?: string;
  generalPrompt?: string;
  companies?: ProfileCompany[];
  address?: ProfileAddress;
}

export type UserRole = 'user' | 'admin';
export type UserStatus = 'pending' | 'approved' | 'rejected';

export interface AuthUser {
  uid: string;
  email: string;
  name?: string;
  emailVerified?: boolean;
  role: UserRole;
  status: UserStatus;
  createdAt?: string;
  updatedAt?: string;
  approvedAt?: string;
}

export interface AdminUserSummary {
  uid: string;
  email: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
  approvedAt?: string;
  profileCount: number;
  applicationCount: number;
}

export interface JobRecord {
  id: string;
  linkedInJobId: string;
  companyName: string;
  jobTitle: string;
  jobDescription: string;
  skills?: Application['skills'];
  hardSkills: string[];
  competencies: string[];
  linkedInJobUrl: string;
  realJobUrl: string;
  location: string;
  companyLogoUrl: string;
  extractionCostUsd: number;
  createdAt: string;
  updatedAt: string;
}
