import { FormEvent, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import './AuthPage.css';

export default function AuthPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const fromExtension = searchParams.get('source') === 'extension';
  const initialMode = searchParams.get('mode') === 'signup' ? 'signup' : 'signin';

  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { signIn, signUp } = useAuth();
  const { showToast } = useToast();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (mode === 'signin') {
        await signIn(email, password);
        navigate(fromExtension ? '/profiles' : '/dashboard', { replace: true });
      } else {
        await signUp(email, password);
        navigate(fromExtension ? '/profiles' : '/auth', { replace: true });
        showToast('Account created. You are now signed in.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-panel-left">
        <div className="auth-card">
          <div className="auth-header">
            <div className="auth-header-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 114.126 0 2.063 2.063 0 01-2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
              </svg>
            </div>
            <h1>Welcome back</h1>
            <p>Sign in to manage your job applications</p>
          </div>

          {fromExtension && (
            <div className="auth-extension-notice">
              Sign in to connect your Chrome extension
            </div>
          )}

          <div className="auth-tabs">
            <button
              type="button"
              className={`auth-tab${mode === 'signin' ? ' active' : ''}`}
              onClick={() => setMode('signin')}
            >
              Sign In
            </button>
            <button
              type="button"
              className={`auth-tab${mode === 'signup' ? ' active' : ''}`}
              onClick={() => setMode('signup')}
            >
              Sign Up
            </button>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
              />
            </div>
            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                placeholder="Min. 6 characters"
              />
            </div>

            {error && <p className="error-message">{error}</p>}

            <button type="submit" className="btn btn-primary">
              {mode === 'signin' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          <p className="field-help" style={{ marginTop: '1rem', textAlign: 'center' }}>
            Create an account to get started.
          </p>
        </div>
      </div>

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
    </div>
  );
}
