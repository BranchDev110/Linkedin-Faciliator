import {
  MockApplication,
  MockProfile,
  DashboardStats,
  ChartDataPoint,
} from '../types';

function daysAgo(n: number, hour = 10): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function isSameDay(a: Date, b: Date): boolean {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

export const MOCK_PROFILES: MockProfile[] = [
  {
    id: 'prof-1',
    name: 'Alex Chen',
    email: 'alex.chen@email.com',
    phone: '+1 (415) 555-0142',
    linkedin: 'https://linkedin.com/in/alexchen',
    resumePrompt:
      'Emphasize full-stack TypeScript experience, leadership in agile teams, and measurable impact on product delivery.',
    companies: ['Stripe', 'Airbnb', 'Meta'],
    createdAt: daysAgo(30),
  },
  {
    id: 'prof-2',
    name: 'Alex Chen — Backend Focus',
    email: 'alex.chen.backend@email.com',
    phone: '+1 (415) 555-0142',
    linkedin: 'https://linkedin.com/in/alexchen',
    resumePrompt:
      'Highlight NestJS, microservices, PostgreSQL optimization, and API design for high-traffic systems.',
    companies: ['Datadog', 'Shopify', 'Cloudflare'],
    createdAt: daysAgo(14),
  },
];

export const MOCK_APPLICATIONS: MockApplication[] = [
  {
    id: 'app-1',
    profileId: 'prof-1',
    companyName: 'Stripe',
    title: 'Senior Software Engineer',
    jdLink: 'https://jobs.example.com/stripe-sse',
    linkedinJDLink: 'https://linkedin.com/jobs/view/123456',
    jd: 'We are looking for a Senior Software Engineer to build payment infrastructure at scale. You will design APIs, improve reliability, and mentor engineers.',
    resumeUrl: 'https://drive.google.com/file/d/mock-stripe-resume',
    skills: {
      additionalHardSkills: ['GraphQL', 'Kafka'],
      competencies: ['System Design', 'Mentorship'],
      focus: ['Payments', 'Distributed Systems'],
      hardSkills: ['TypeScript', 'Node.js', 'PostgreSQL', 'AWS'],
      role: 'Senior Software Engineer',
      title: 'Senior Software Engineer',
      title1: 'Backend Engineer',
      title2: 'Platform Engineer',
      title3: 'Staff Engineer',
      title4: 'Principal Engineer',
    },
    applied: true,
    recordedAt: daysAgo(0, 9),
  },
  {
    id: 'app-2',
    profileId: 'prof-1',
    companyName: 'Notion',
    title: 'Full Stack Engineer',
    jdLink: 'https://jobs.example.com/notion-fse',
    linkedinJDLink: 'https://linkedin.com/jobs/view/234567',
    jd: 'Join Notion to build delightful product experiences. Work across React frontend and Node backend with a focus on performance and collaboration features.',
    resumeUrl: 'https://drive.google.com/file/d/mock-notion-resume',
    skills: {
      additionalHardSkills: ['React', 'Redis'],
      competencies: ['Product Thinking', 'Cross-functional Collaboration'],
      focus: ['Collaboration', 'Editor Performance'],
      hardSkills: ['React', 'TypeScript', 'Node.js', 'CSS'],
      role: 'Full Stack Engineer',
      title: 'Full Stack Engineer',
      title1: 'Frontend Engineer',
      title2: 'Product Engineer',
      title3: 'Senior Engineer',
      title4: 'Lead Engineer',
    },
    applied: false,
    recordedAt: daysAgo(0, 14),
  },
  {
    id: 'app-3',
    profileId: 'prof-1',
    companyName: 'Datadog',
    title: 'Backend Engineer',
    jdLink: 'https://jobs.example.com/datadog-be',
    linkedinJDLink: 'https://linkedin.com/jobs/view/345678',
    jd: 'Build observability pipelines handling billions of events per day. Strong experience with Go or Java and distributed systems required.',
    resumeUrl: 'https://drive.google.com/file/d/mock-datadog-resume',
    skills: {
      additionalHardSkills: ['Go', 'Kubernetes'],
      competencies: ['Observability', 'Scalability'],
      focus: ['Metrics', 'Logging'],
      hardSkills: ['Go', 'Java', 'Kafka', 'Docker'],
      role: 'Backend Engineer',
      title: 'Backend Engineer',
      title1: 'Infrastructure Engineer',
      title2: 'Site Reliability Engineer',
      title3: 'Senior Backend Engineer',
      title4: 'Platform Engineer',
    },
    applied: true,
    recordedAt: daysAgo(1, 11),
  },
  {
    id: 'app-4',
    profileId: 'prof-1',
    companyName: 'Figma',
    title: 'Software Engineer',
    jdLink: 'https://jobs.example.com/figma-se',
    linkedinJDLink: 'https://linkedin.com/jobs/view/456789',
    jd: 'Help us build the future of design tools. Experience with C++, WebAssembly, or high-performance rendering is a plus.',
    resumeUrl: '',
    skills: {
      additionalHardSkills: ['WebAssembly', 'C++'],
      competencies: ['Performance Optimization'],
      focus: ['Rendering', 'Canvas'],
      hardSkills: ['TypeScript', 'React', 'C++'],
      role: 'Software Engineer',
      title: 'Software Engineer',
      title1: 'Graphics Engineer',
      title2: 'Frontend Engineer',
      title3: 'Senior Software Engineer',
      title4: 'Staff Engineer',
    },
    applied: false,
    recordedAt: daysAgo(1, 16),
  },
  {
    id: 'app-5',
    profileId: 'prof-1',
    companyName: 'Shopify',
    title: 'Senior Backend Developer',
    jdLink: 'https://jobs.example.com/shopify-sbd',
    linkedinJDLink: 'https://linkedin.com/jobs/view/567890',
    jd: 'Scale commerce infrastructure for millions of merchants. Ruby, Rails, and distributed systems experience preferred.',
    resumeUrl: 'https://drive.google.com/file/d/mock-shopify-resume',
    skills: {
      additionalHardSkills: ['Ruby', 'Rails'],
      competencies: ['E-commerce', 'API Design'],
      focus: ['Checkout', 'Merchant Tools'],
      hardSkills: ['Ruby', 'PostgreSQL', 'Redis', 'Sidekiq'],
      role: 'Senior Backend Developer',
      title: 'Senior Backend Developer',
      title1: 'Backend Developer',
      title2: 'Ruby Engineer',
      title3: 'Staff Developer',
      title4: 'Principal Engineer',
    },
    applied: true,
    recordedAt: daysAgo(3),
  },
  {
    id: 'app-6',
    profileId: 'prof-1',
    companyName: 'Vercel',
    title: 'Platform Engineer',
    jdLink: 'https://jobs.example.com/vercel-pe',
    linkedinJDLink: 'https://linkedin.com/jobs/view/678901',
    jd: 'Work on edge infrastructure and developer experience. Deep knowledge of Next.js ecosystem and serverless platforms.',
    resumeUrl: 'https://drive.google.com/file/d/mock-vercel-resume',
    skills: {
      additionalHardSkills: ['Next.js', 'Edge Functions'],
      competencies: ['Developer Experience', 'DevOps'],
      focus: ['Edge', 'Deployments'],
      hardSkills: ['TypeScript', 'Node.js', 'AWS', 'Terraform'],
      role: 'Platform Engineer',
      title: 'Platform Engineer',
      title1: 'DevOps Engineer',
      title2: 'Infrastructure Engineer',
      title3: 'Senior Platform Engineer',
      title4: 'Staff Engineer',
    },
    applied: true,
    recordedAt: daysAgo(5),
  },
  {
    id: 'app-7',
    profileId: 'prof-2',
    companyName: 'Linear',
    title: 'Product Engineer',
    jdLink: 'https://jobs.example.com/linear-pe',
    linkedinJDLink: 'https://linkedin.com/jobs/view/789012',
    jd: 'Ship product features end-to-end in a small, high-impact team. Strong product sense and full-stack skills required.',
    resumeUrl: '',
    skills: {
      additionalHardSkills: ['GraphQL', 'Figma'],
      competencies: ['Product Sense', 'UX'],
      focus: ['Issue Tracking', 'Workflow'],
      hardSkills: ['React', 'TypeScript', 'Node.js'],
      role: 'Product Engineer',
      title: 'Product Engineer',
      title1: 'Full Stack Engineer',
      title2: 'Frontend Engineer',
      title3: 'Senior Product Engineer',
      title4: 'Lead Engineer',
    },
    applied: false,
    recordedAt: daysAgo(8),
  },
  {
    id: 'app-8',
    profileId: 'prof-2',
    companyName: 'Cloudflare',
    title: 'Systems Engineer',
    jdLink: 'https://jobs.example.com/cloudflare-se',
    linkedinJDLink: 'https://linkedin.com/jobs/view/890123',
    jd: 'Build systems at the edge of the internet. Low-level networking and performance engineering skills valued.',
    resumeUrl: 'https://drive.google.com/file/d/mock-cloudflare-resume',
    skills: {
      additionalHardSkills: ['Rust', 'Networking'],
      competencies: ['Low-level Systems', 'Security'],
      focus: ['CDN', 'DDoS Protection'],
      hardSkills: ['C', 'Rust', 'Linux', 'TCP/IP'],
      role: 'Systems Engineer',
      title: 'Systems Engineer',
      title1: 'Network Engineer',
      title2: 'Security Engineer',
      title3: 'Senior Systems Engineer',
      title4: 'Principal Engineer',
    },
    applied: true,
    recordedAt: daysAgo(12),
  },
  {
    id: 'app-9',
    profileId: 'prof-2',
    companyName: 'Anthropic',
    title: 'ML Infrastructure Engineer',
    jdLink: 'https://jobs.example.com/anthropic-ml',
    linkedinJDLink: 'https://linkedin.com/jobs/view/901234',
    jd: 'Scale ML training and inference infrastructure. Experience with Python, Kubernetes, and GPU clusters required.',
    resumeUrl: 'https://drive.google.com/file/d/mock-anthropic-resume',
    skills: {
      additionalHardSkills: ['Python', 'PyTorch'],
      competencies: ['ML Ops', 'Research Collaboration'],
      focus: ['Training Pipelines', 'Inference'],
      hardSkills: ['Python', 'Kubernetes', 'CUDA', 'AWS'],
      role: 'ML Infrastructure Engineer',
      title: 'ML Infrastructure Engineer',
      title1: 'MLOps Engineer',
      title2: 'Data Engineer',
      title3: 'Senior ML Engineer',
      title4: 'Staff Engineer',
    },
    applied: false,
    recordedAt: daysAgo(20),
  },
  {
    id: 'app-10',
    profileId: 'prof-2',
    companyName: 'Discord',
    title: 'Senior Frontend Engineer',
    jdLink: 'https://jobs.example.com/discord-sfe',
    linkedinJDLink: 'https://linkedin.com/jobs/view/012345',
    jd: 'Build real-time communication features used by millions. React, WebRTC, and performance optimization experience needed.',
    resumeUrl: 'https://drive.google.com/file/d/mock-discord-resume',
    skills: {
      additionalHardSkills: ['WebRTC', 'Electron'],
      competencies: ['Real-time Systems', 'Performance'],
      focus: ['Voice', 'Video'],
      hardSkills: ['React', 'TypeScript', 'WebRTC', 'CSS'],
      role: 'Senior Frontend Engineer',
      title: 'Senior Frontend Engineer',
      title1: 'Frontend Engineer',
      title2: 'UI Engineer',
      title3: 'Staff Frontend Engineer',
      title4: 'Principal Engineer',
    },
    applied: true,
    recordedAt: daysAgo(45),
  },
  {
    id: 'app-11',
    profileId: 'prof-2',
    companyName: 'Retool',
    title: 'Full Stack Engineer',
    jdLink: 'https://jobs.example.com/retool-fse',
    linkedinJDLink: 'https://linkedin.com/jobs/view/112233',
    jd: 'Help build internal tools platform. Strong full-stack skills and customer empathy required.',
    resumeUrl: '',
    skills: {
      additionalHardSkills: ['SQL', 'Low-code'],
      competencies: ['Customer Empathy', 'Internal Tools'],
      focus: ['Builder', 'Integrations'],
      hardSkills: ['React', 'Node.js', 'PostgreSQL'],
      role: 'Full Stack Engineer',
      title: 'Full Stack Engineer',
      title1: 'Backend Engineer',
      title2: 'Product Engineer',
      title3: 'Senior Engineer',
      title4: 'Staff Engineer',
    },
    applied: false,
    recordedAt: daysAgo(60),
  },
  {
    id: 'app-12',
    profileId: 'prof-2',
    companyName: 'Plaid',
    title: 'Backend Engineer',
    jdLink: 'https://jobs.example.com/plaid-be',
    linkedinJDLink: 'https://linkedin.com/jobs/view/223344',
    jd: 'Connect financial institutions to apps. API design, security, and fintech experience valued.',
    resumeUrl: 'https://drive.google.com/file/d/mock-plaid-resume',
    skills: {
      additionalHardSkills: ['OAuth', 'PCI'],
      competencies: ['Fintech', 'Security'],
      focus: ['Banking APIs', 'Data Pipelines'],
      hardSkills: ['Python', 'Go', 'PostgreSQL', 'AWS'],
      role: 'Backend Engineer',
      title: 'Backend Engineer',
      title1: 'API Engineer',
      title2: 'Security Engineer',
      title3: 'Senior Backend Engineer',
      title4: 'Staff Engineer',
    },
    applied: true,
    recordedAt: daysAgo(75),
  },
];

export function computeDashboardStats(
  profiles: MockProfile[],
  applications: MockApplication[],
): DashboardStats {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  const todayRecorded = applications.filter((a) =>
    isSameDay(new Date(a.recordedAt), now),
  ).length;
  const todayApplied = applications.filter(
    (a) => a.applied && isSameDay(new Date(a.recordedAt), now),
  ).length;
  const yesterdayRecorded = applications.filter((a) =>
    isSameDay(new Date(a.recordedAt), yesterday),
  ).length;
  const yesterdayApplied = applications.filter(
    (a) => a.applied && isSameDay(new Date(a.recordedAt), yesterday),
  ).length;

  return {
    profileCount: profiles.length,
    totalRecorded: applications.length,
    totalApplied: applications.filter((a) => a.applied).length,
    todayRecorded,
    todayApplied,
    yesterdayRecorded,
    yesterdayApplied,
  };
}

function filterByDays(applications: MockApplication[], days: number): MockApplication[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  cutoff.setHours(0, 0, 0, 0);
  return applications.filter((a) => new Date(a.recordedAt) >= cutoff);
}

function formatDayLabel(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatWeekLabel(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function buildChartData(
  applications: MockApplication[],
  period: 'week' | 'twoWeeks' | 'month' | 'quarter',
  profileId?: string,
): ChartDataPoint[] {
  const scoped = profileId
    ? applications.filter((a) => a.profileId === profileId)
    : applications;
  const periodDays = { week: 7, twoWeeks: 14, month: 30, quarter: 90 }[period];
  const filtered = filterByDays(scoped, periodDays);

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  interface Bucket {
    label: string;
    recorded: number;
    applied: number;
    sortKey: number;
  }

  const buckets: Bucket[] = [];

  if (period === 'quarter') {
    for (let i = 12; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i * 7);
      buckets.push({
        label: formatWeekLabel(d),
        recorded: 0,
        applied: 0,
        sortKey: d.getTime(),
      });
    }
  } else if (period === 'month') {
    for (let i = 29; i >= 0; i -= 3) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      buckets.push({
        label: formatDayLabel(d),
        recorded: 0,
        applied: 0,
        sortKey: d.getTime(),
      });
    }
  } else {
    for (let i = periodDays - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      buckets.push({
        label: formatDayLabel(d),
        recorded: 0,
        applied: 0,
        sortKey: d.getTime(),
      });
    }
  }

  for (const app of filtered) {
    const appDate = new Date(app.recordedAt);
    appDate.setHours(0, 0, 0, 0);

    let bucket = buckets[0];
    let minDiff = Math.abs(bucket.sortKey - appDate.getTime());

    for (const b of buckets) {
      const diff = Math.abs(b.sortKey - appDate.getTime());
      if (diff < minDiff) {
        minDiff = diff;
        bucket = b;
      }
    }

    bucket.recorded += 1;
    if (app.applied) bucket.applied += 1;
  }

  return buckets.map(({ label, recorded, applied }) => ({
    label,
    recorded,
    applied,
  }));
}

