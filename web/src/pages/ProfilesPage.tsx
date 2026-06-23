import { ChangeEvent, FormEvent, forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { useAuthScope } from '../hooks/useAuthScope';
import { useToast } from '../components/Toast';
import { apiRequest } from '../lib/api';
import { uploadProfileResumeTemplate } from '../lib/profile-template';
import { CreateProfileInput, Profile, ProfileCompany } from '../types';
import './ProfilesPage.css';

function profileDisplayName(profile: Profile): string {
  const full = [profile.firstName, profile.lastName].filter(Boolean).join(' ');
  return full || profile.profileName;
}

function ProfileCompaniesEditor({
  companies,
  onChange,
}: {
  companies: ProfileCompany[];
  onChange: (companies: ProfileCompany[]) => void;
}) {
  const [name, setName] = useState('');
  const [prompt, setPrompt] = useState('');
  const [bulletCount, setBulletCount] = useState(1);

  const addCompany = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (companies.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) return;

    onChange([
      ...companies,
      {
        name: trimmed,
        prompt: prompt.trim(),
        bulletCount: Math.max(1, bulletCount || 1),
      },
    ]);
    setName('');
    setPrompt('');
    setBulletCount(1);
  };

  const updateCompany = (index: number, updates: Partial<ProfileCompany>) => {
    onChange(
      companies.map((company, i) =>
        i === index ? { ...company, ...updates } : company,
      ),
    );
  };

  const removeCompany = (index: number) => {
    onChange(companies.filter((_, i) => i !== index));
  };

  return (
    <div className="form-group">
      <label>Companies</label>
      <p className="field-help">
        Add each employer with a company-specific prompt and default bullet count.
      </p>

      {companies.length > 0 && (
        <div className="company-editor-list">
          {companies.map((company, index) => (
            <div key={`${company.name}-${index}`} className="company-editor-card">
              <div className="company-editor-card-header">
                <strong>{company.name}</strong>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => removeCompany(index)}
                >
                  Remove
                </button>
              </div>
              <div className="form-grid company-editor-grid">
                <div className="form-group">
                  <label>Bullet Count</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={company.bulletCount}
                    onChange={(e) =>
                      updateCompany(index, {
                        bulletCount: Math.max(1, Number(e.target.value) || 1),
                      })
                    }
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Company-Specific Prompt</label>
                <textarea
                  value={company.prompt}
                  onChange={(e) =>
                    updateCompany(index, { prompt: e.target.value })
                  }
                  placeholder="Instructions specific to this company (role, projects, tone, keywords)..."
                  rows={3}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="company-editor-add card">
        <div className="form-grid">
          <div className="form-group">
            <label>Company Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Google"
            />
          </div>
          <div className="form-group">
            <label>Default Bullet Count</label>
            <input
              type="number"
              min={1}
              max={10}
              value={bulletCount}
              onChange={(e) => setBulletCount(Math.max(1, Number(e.target.value) || 1))}
            />
          </div>
        </div>
        <div className="form-group">
          <label>Company-Specific Prompt</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="What should bullets for this company emphasize?"
            rows={3}
          />
        </div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={addCompany}>
          Add Company
        </button>
      </div>
    </div>
  );
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

export type ResumeTemplateSectionHandle = {
  savePendingTemplate: () => Promise<Profile | null>;
};

const ResumeTemplateSection = forwardRef<
  ResumeTemplateSectionHandle,
  {
    token: string;
    initialTemplate?: string;
    initialFileName?: string;
    initialFormat?: Profile['resumeTemplateFormat'];
    companies: ProfileCompany[];
    onUploaded: (profile: Profile) => void;
  }
>(function ResumeTemplateSection(
  {
    token,
    initialTemplate,
    initialFileName,
    initialFormat,
    companies,
    onUploaded,
  },
  ref,
) {
  const { showToast } = useToast();
  const [template, setTemplate] = useState(initialTemplate || '');
  const [fileName, setFileName] = useState(initialFileName || '');
  const [templateFormat, setTemplateFormat] = useState<'text' | 'docx' | ''>(
    initialFormat || '',
  );
  const [templateDocxBase64, setTemplateDocxBase64] = useState('');
  const [previewText, setPreviewText] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    setTemplate(initialTemplate || '');
    setFileName(initialFileName || '');
    setTemplateFormat(initialFormat || '');
    setTemplateDocxBase64('');
    setPreviewText('');
  }, [initialTemplate, initialFileName, initialFormat]);

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const lowerName = file.name.toLowerCase();

      if (lowerName.endsWith('.docx')) {
        const mammoth = await import('mammoth');
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        setTemplateDocxBase64(arrayBufferToBase64(arrayBuffer));
        setTemplateFormat('docx');
        setTemplate('');
        setPreviewText(result.value);
        setFileName(file.name);
      } else {
        const text = await file.text();
        setTemplate(text);
        setTemplateFormat('text');
        setTemplateDocxBase64('');
        setPreviewText('');
        setFileName(file.name);
      }
    } catch {
      showToast('Could not read that file. Use .txt, .md, or .docx.', 'error');
    }
  };

  const savePendingTemplate = useCallback(async (): Promise<Profile | null> => {
    const isDocx = templateFormat === 'docx';

    if (isDocx) {
      if (!templateDocxBase64) {
        return null;
      }
    } else if (!template.trim()) {
      return null;
    } else if (
      template.trim() === (initialTemplate || '').trim() &&
      initialFormat === 'text'
    ) {
      return null;
    }

    const updated = await uploadProfileResumeTemplate(
      token,
      isDocx
        ? { format: 'docx', templateDocxBase64, fileName }
        : { format: 'text', template, fileName },
    );
    onUploaded(updated);
    return updated;
  }, [
    fileName,
    initialFormat,
    initialTemplate,
    onUploaded,
    template,
    templateDocxBase64,
    templateFormat,
    token,
  ]);

  useImperativeHandle(ref, () => ({ savePendingTemplate }), [savePendingTemplate]);

  const uploadTemplate = async () => {
    setUploading(true);
    try {
      const updated = await savePendingTemplate();
      if (!updated) {
        const isDocx = templateFormat === 'docx';
        if (isDocx && !templateDocxBase64 && initialFormat === 'docx') {
          showToast('Word template is already saved.');
          return;
        }
        if (isDocx && !templateDocxBase64) {
          showToast('Upload a .docx template before saving.', 'error');
          return;
        }
        if (!isDocx && !template.trim()) {
          showToast('Add a resume template before saving.', 'error');
          return;
        }
        showToast('Resume template is already up to date.');
        return;
      }
      showToast('Resume template saved.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save template', 'error');
    } finally {
      setUploading(false);
    }
  };

  const companyPlaceholders = companies.map((c) => `{{${c.name}}}`).join(', ');

  return (
    <div className="form-group template-section">
      <label>Resume Template</label>
      <p className="field-help">
        Upload a Word (.docx) template to keep formatting. Use {'{{summary}}'}, {'{{skills}}'}, and
        company placeholders
        {companyPlaceholders ? ` such as ${companyPlaceholders}` : ' like {{ForeFlight}}'}.
        Plain .txt/.md is also supported. Saved together when you click Save Profile.
      </p>
      {fileName ? <p className="field-help">Current file: {fileName}</p> : null}
      {templateFormat === 'docx' && !templateDocxBase64 && initialFormat === 'docx' ? (
        <p className="field-help">Word template saved on server.</p>
      ) : null}
      <input
        type="file"
        accept=".txt,.md,.docx,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        onChange={handleFile}
      />
      {templateFormat === 'docx' ? (
        previewText ? (
          <pre className="template-preview">{previewText}</pre>
        ) : null
      ) : (
        <textarea
          value={template}
          onChange={(e) => setTemplate(e.target.value)}
          placeholder={'SUMMARY\n{{summary}}\n\nSKILLS\n{{skills}}\n\nEXPERIENCE\n{{ForeFlight}}\n{{Google}}'}
          rows={14}
          className="template-textarea"
        />
      )}
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        onClick={uploadTemplate}
        disabled={uploading}
      >
        {uploading ? 'Saving template...' : 'Save Resume Template'}
      </button>
    </div>
  );
});

export default function ProfilesPage() {
  const { userId, token } = useAuthScope();
  const { showToast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [linkedin, setLinkedin] = useState('');
  const [generalPrompt, setGeneralPrompt] = useState('');
  const [companies, setCompanies] = useState<ProfileCompany[]>([]);
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const templateRef = useRef<ResumeTemplateSectionHandle>(null);

  const applyProfileToForm = useCallback((data: Profile) => {
    setProfileName(data.profileName || '');
    setFirstName(data.firstName || '');
    setLastName(data.lastName || '');
    setEmail(data.email || '');
    setPhoneNumber(data.phoneNumber || '');
    setLinkedin(data.linkedin || '');
    setGeneralPrompt(data.generalPrompt || '');
    setCompanies(data.companies || []);
    setCity(data.address?.city || '');
    setState(data.address?.state || '');
  }, []);

  const loadProfile = useCallback(async () => {
    if (!token || !userId) {
      setProfile(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const data = await apiRequest<Profile>('/profiles/me', { token });
      setProfile(data);
      applyProfileToForm(data);
    } catch (err) {
      setProfile(null);
      showToast(err instanceof Error ? err.message : 'Failed to load profile', 'error');
    } finally {
      setLoading(false);
    }
  }, [applyProfileToForm, showToast, token, userId]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;

    const payload: CreateProfileInput = {
      profileName,
      firstName,
      lastName,
      email,
      phoneNumber,
      linkedin,
      generalPrompt,
      companies,
      address: { city, state },
    };

    setSaving(true);
    try {
      const updated = await apiRequest<Profile>('/profiles/me', {
        method: 'PATCH',
        token,
        body: JSON.stringify(payload),
      });

      let finalProfile = updated;
      try {
        const templateProfile = await templateRef.current?.savePendingTemplate();
        if (templateProfile) {
          finalProfile = templateProfile;
        }
      } catch (err) {
        showToast(
          err instanceof Error ? err.message : 'Profile saved, but template upload failed',
          'error',
        );
        setProfile(updated);
        applyProfileToForm(updated);
        return;
      }

      setProfile(finalProfile);
      applyProfileToForm(finalProfile);
      showToast('Profile saved.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save profile', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>My Profile</h1>
          <p>
            Customize your resume settings, companies, and template for tailored resume generation
          </p>
        </div>
        <button
          className="btn btn-secondary"
          onClick={() => void loadProfile()}
          disabled={loading}
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {loading ? (
        <div className="card empty-state">
          <p>Loading profile...</p>
        </div>
      ) : (
        <div className="card profile-settings-card">
          {profile ? (
            <p className="field-help profile-settings-intro">
              Signed in as {profileDisplayName(profile)}
              {profile.email ? ` · ${profile.email}` : ''}
            </p>
          ) : null}

          <form onSubmit={handleSave}>
            <div className="form-grid">
              <div className="form-group">
                <label>Display Name *</label>
                <input
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  placeholder="e.g. Kevin - Software Engineer"
                  required
                />
              </div>
              <div className="form-group">
                <label>First Name</label>
                <input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Last Name</label>
                <input value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>
              <div className="form-group">
                <label>Phone Number</label>
                <input
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+1 (555) 000-0000"
                />
              </div>
              <div className="form-group">
                <label>LinkedIn</label>
                <input
                  value={linkedin}
                  onChange={(e) => setLinkedin(e.target.value)}
                  placeholder="https://linkedin.com/in/..."
                />
              </div>
              <div className="form-group">
                <label>City</label>
                <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="San Francisco" />
              </div>
              <div className="form-group">
                <label>State</label>
                <input value={state} onChange={(e) => setState(e.target.value)} placeholder="CA" />
              </div>
            </div>

            <div className="form-group">
              <label>General Resume Prompt</label>
              <p className="field-help">
                High-level instructions for how every resume bullet should be written (tone, structure, style).
              </p>
              <textarea
                value={generalPrompt}
                onChange={(e) => setGeneralPrompt(e.target.value)}
                placeholder="Example: Use past tense, start with action verbs, keep bullets to one line, emphasize leadership and measurable impact..."
                rows={4}
              />
            </div>

            <ProfileCompaniesEditor companies={companies} onChange={setCompanies} />

            {token ? (
              <ResumeTemplateSection
                ref={templateRef}
                token={token}
                initialTemplate={profile?.resumeTemplate}
                initialFileName={profile?.resumeTemplateFileName}
                initialFormat={profile?.resumeTemplateFormat}
                companies={companies}
                onUploaded={(updated) => {
                  setProfile(updated);
                  applyProfileToForm(updated);
                }}
              />
            ) : null}

            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Saving...' : 'Save Profile'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
