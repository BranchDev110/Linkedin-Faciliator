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
  jobUrl?: string;
  linkedInJobUrl?: string;
  linkedInJobId?: string;
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
  resumeId?: string;
  status: 'recorded' | 'applied';
  aiCostUsd?: number;
  aiCostBreakdown?: {
    skillExtraction?: number;
    resumeBullets?: number;
    resumeContent?: number;
  };
  createdAt: string;
  appliedAt?: string;
  updatedAt: string;
}

export interface Resume {
  id: string;
  userId: string;
  applicationId: string;
  profileId: string;
  companyName: string;
  jobTitle: string;
  content: string;
  outputFormat?: 'text' | 'docx';
  summary?: string;
  skillsSection?: string;
  filePath?: string;
  fileName?: string;
  fileUrl?: string;
  createdAt: string;
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
