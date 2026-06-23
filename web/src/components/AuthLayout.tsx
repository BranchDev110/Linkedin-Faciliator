import { ReactNode } from 'react';
import '../pages/AuthPage.css';

function AuthHeroPanel() {
  return (
    <div className="auth-panel-right">
      <div className="auth-hero">
        <h2>Apply smarter on LinkedIn</h2>
        <p>
          Extract job details, generate tailored resumes with AI, and track
          every application from one dashboard.
        </p>
        <div className="auth-hero-features">
          <div className="auth-hero-feature">
            <span className="auth-hero-feature-dot" />
            Chrome extension for instant job capture
          </div>
          <div className="auth-hero-feature">
            <span className="auth-hero-feature-dot" />
            Multiple profiles for different career paths
          </div>
          <div className="auth-hero-feature">
            <span className="auth-hero-feature-dot" />
            AI-tailored resumes stored on your server
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="auth-page">
      <div className="auth-panel-left">{children}</div>
      <AuthHeroPanel />
    </div>
  );
}
