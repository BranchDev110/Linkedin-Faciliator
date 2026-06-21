import { ChangeEvent, FormEvent, useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { apiRequest } from '../lib/api';
import { CreateProfileInput, Profile, ProfileCompany } from '../types';
import './ProfilesPage.css';

function profileDisplayName(profile: Profile): string {
  const full = [profile.firstName, profile.lastName].filter(Boolean).join(' ');
  return full || profile.profileName;
}

function profileLocation(profile: Profile): string {
  return [profile.address?.city, profile.address?.state].filter(Boolean).join(', ');
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

function profileHasTemplate(profile: Profile): boolean {
  if (profile.resumeTemplateFormat === 'docx') {
    return Boolean(profile.resumeTemplateFilePath?.trim());
  }
  return Boolean(profile.resumeTemplate?.trim());
}

function ResumeTemplateSection({
  profileId,
  token,
  initialTemplate,
  initialFileName,
  initialFormat,
  companies,
  onUploaded,
}: {
  profileId: string;
  token: string;
  initialTemplate?: string;
  initialFileName?: string;
  initialFormat?: Profile['resumeTemplateFormat'];
  companies: ProfileCompany[];
  onUploaded: (profile: Profile) => void;
}) {
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
  }, [initialTemplate, initialFileName, initialFormat, profileId]);

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

  const uploadTemplate = async () => {
    const isDocx = templateFormat === 'docx';
    if (isDocx && !templateDocxBase64) {
      showToast('Upload a .docx template before saving.', 'error');
      return;
    }
    if (!isDocx && !template.trim()) {
      showToast('Add a resume template before saving.', 'error');
      return;
    }

    setUploading(true);
    try {
      const body = isDocx
        ? { format: 'docx', templateDocxBase64, fileName }
        : { format: 'text', template, fileName };

      const updated = await apiRequest<Profile>(`/profiles/${profileId}/resume-template`, {
        method: 'POST',
        token,
        body: JSON.stringify(body),
      });
      onUploaded(updated);
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
        Plain .txt/.md is also supported.
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
}

function ProfileForm({
  initial,
  token,
  saving,
  onSave,
  onCancel,
  onTemplateUploaded,
}: {
  initial?: Profile;
  token: string;
  saving: boolean;
  onSave: (data: CreateProfileInput) => void;
  onCancel: () => void;
  onTemplateUploaded?: (profile: Profile) => void;
}) {
  const [profileName, setProfileName] = useState(initial?.profileName || '');
  const [firstName, setFirstName] = useState(initial?.firstName || '');
  const [lastName, setLastName] = useState(initial?.lastName || '');
  const [email, setEmail] = useState(initial?.email || '');
  const [phoneNumber, setPhoneNumber] = useState(initial?.phoneNumber || '');
  const [linkedin, setLinkedin] = useState(initial?.linkedin || '');
  const [generalPrompt, setGeneralPrompt] = useState(initial?.generalPrompt || '');
  const [companies, setCompanies] = useState<ProfileCompany[]>(initial?.companies || []);
  const [city, setCity] = useState(initial?.address?.city || '');
  const [state, setState] = useState(initial?.address?.state || '');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSave({
      profileName,
      firstName,
      lastName,
      email,
      phoneNumber,
      linkedin,
      generalPrompt,
      companies,
      address: { city, state },
    });
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content modal-content-wide" onClick={(e) => e.stopPropagation()}>
        <h2>{initial ? 'Edit Profile' : 'Create Profile'}</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="form-group">
              <label>Profile Name *</label>
              <input
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                placeholder="e.g. Software Engineer - Bay Area"
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

          {initial?.id && onTemplateUploaded ? (
            <ResumeTemplateSection
              profileId={initial.id}
              token={token}
              initialTemplate={initial.resumeTemplate}
              initialFileName={initial.resumeTemplateFileName}
              initialFormat={initial.resumeTemplateFormat}
              companies={companies}
              onUploaded={onTemplateUploaded}
            />
          ) : (
            <p className="field-help">Save the profile first, then edit it to upload a resume template.</p>
          )}

          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : initial ? 'Save Changes' : 'Create Profile'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ProfilesPage() {
  const { token } = useAuth();
  const { showToast } = useToast();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Profile | undefined>();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadProfiles = useCallback(async (options?: { notify?: boolean }) => {
    if (!token) return;

    setLoading(true);
    try {
      const data = await apiRequest<Profile[]>('/profiles', { token });
      setProfiles(data);
      if (options?.notify) {
        showToast(
          data.length
            ? `Loaded ${data.length} profile${data.length === 1 ? '' : 's'}.`
            : 'No profiles yet.',
        );
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load profiles', 'error');
      setProfiles([]);
    } finally {
      setLoading(false);
    }
  }, [showToast, token]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await loadProfiles({ notify: true });
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

  const handleCreate = async (data: CreateProfileInput) => {
    setSaving(true);
    try {
      const created = await apiRequest<Profile>('/profiles', {
        method: 'POST',
        token,
        body: JSON.stringify(data),
      });
      setProfiles((prev) => [created, ...prev.filter((p) => p.id !== created.id)]);
      setShowForm(false);
      showToast('Profile created.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to create profile', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (data: CreateProfileInput) => {
    if (!editing) return;

    setSaving(true);
    try {
      const updated = await apiRequest<Profile>(`/profiles/${editing.id}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify(data),
      });
      setProfiles((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      setEditing(undefined);
      showToast('Profile updated.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update profile', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this profile?')) return;

    try {
      await apiRequest(`/profiles/${id}`, { method: 'DELETE', token });
      setProfiles((prev) => prev.filter((p) => p.id !== id));
      if (expanded === id) setExpanded(null);
      showToast('Profile deleted.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete profile', 'error');
    }
  };

  const handleTemplateUploaded = (profile: Profile) => {
    setProfiles((prev) => prev.map((p) => (p.id === profile.id ? profile : p)));
    if (editing?.id === profile.id) {
      setEditing(profile);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Profiles</h1>
          <p>Manage application profiles for tailored resume generation</p>
        </div>
        <div className="page-header-actions">
          <button
            className="btn btn-secondary"
            onClick={() => void handleRefresh()}
            disabled={refreshing || loading}
          >
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>
            New Profile
          </button>
        </div>
      </div>

      {loading ? (
        <div className="card empty-state">
          <p>Loading profiles...</p>
        </div>
      ) : profiles.length === 0 ? (
        <div className="card empty-state">
          <h3>No profiles yet</h3>
          <p>Create a profile to configure resume generation settings.</p>
          <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => setShowForm(true)}>
            Create Profile
          </button>
        </div>
      ) : (
        <div className="profiles-list">
          {profiles.map((profile) => (
            <div key={profile.id} className="card profile-list-item">
              <div
                className="profile-list-header"
                onClick={() => setExpanded(expanded === profile.id ? null : profile.id)}
              >
                <div className="profile-list-main">
                  <div className="profile-avatar">
                    {(profile.firstName || profile.profileName).charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3>{profile.profileName}</h3>
                    <p className="profile-meta">
                      {[profileDisplayName(profile), profile.email].filter(Boolean).join(' · ') ||
                        'No contact info'}
                    </p>
                  </div>
                </div>
                <div className="profile-list-end">
                  <span className="profile-company-count">
                    {(profile.companies?.length || 0)} companies
                  </span>
                  <span className={`expand-chevron${expanded === profile.id ? ' open' : ''}`}>
                    ›
                  </span>
                </div>
              </div>

              {expanded === profile.id && (
                <div className="profile-details">
                  <div className="profile-list-actions">
                    <button className="btn btn-secondary btn-sm" onClick={() => setEditing(profile)}>
                      Edit
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(profile.id)}>
                      Delete
                    </button>
                  </div>
                  <div className="detail-grid">
                    <div className="detail-item">
                      <span className="detail-label">First Name</span>
                      <span>{profile.firstName || '—'}</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Last Name</span>
                      <span>{profile.lastName || '—'}</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Email</span>
                      <span>{profile.email || '—'}</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Phone</span>
                      <span>{profile.phoneNumber || '—'}</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Location</span>
                      <span>{profileLocation(profile) || '—'}</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">LinkedIn</span>
                      {profile.linkedin ? (
                        <a href={profile.linkedin} target="_blank" rel="noopener noreferrer">
                          {profile.linkedin}
                        </a>
                      ) : (
                        <span>—</span>
                      )}
                    </div>
                  </div>

                  <div className="detail-block">
                    <span className="detail-label">General Resume Prompt</span>
                    <p className="detail-text">{profile.generalPrompt || '—'}</p>
                  </div>

                  <div className="detail-block">
                    <span className="detail-label">Resume Template</span>
                    {profileHasTemplate(profile) ? (
                      <>
                        <p className="detail-text">
                          {profile.resumeTemplateFileName || 'Custom template uploaded'}
                          {profile.resumeTemplateFormat === 'docx' ? ' (Word)' : ''}
                        </p>
                        {profile.resumeTemplate ? (
                          <pre className="template-preview">{profile.resumeTemplate.slice(0, 500)}
                            {profile.resumeTemplate.length > 500 ? '...' : ''}
                          </pre>
                        ) : profile.resumeTemplateFormat === 'docx' ? (
                          <p className="detail-text">Stored as Word document on server.</p>
                        ) : null}
                      </>
                    ) : (
                      <span className="detail-text">No template uploaded</span>
                    )}
                  </div>

                  <div className="detail-block">
                    <span className="detail-label">Companies</span>
                    {profile.companies && profile.companies.length > 0 ? (
                      <div className="company-view-list">
                        {profile.companies.map((company) => (
                          <div key={company.name} className="company-view-card">
                            <div className="company-view-header">
                              <strong>{company.name}</strong>
                              <span className="company-view-meta">
                                {company.bulletCount} bullet{company.bulletCount === 1 ? '' : 's'}
                              </span>
                            </div>
                            <p className="detail-text">
                              {company.prompt || 'No company-specific prompt'}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="detail-text">—</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showForm && token && (
        <ProfileForm
          token={token}
          saving={saving}
          onSave={handleCreate}
          onCancel={() => setShowForm(false)}
        />
      )}
      {editing && token && (
        <ProfileForm
          initial={editing}
          token={token}
          saving={saving}
          onSave={handleUpdate}
          onCancel={() => setEditing(undefined)}
          onTemplateUploaded={handleTemplateUploaded}
        />
      )}
    </div>
  );
}
