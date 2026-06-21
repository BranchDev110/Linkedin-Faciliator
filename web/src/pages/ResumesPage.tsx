import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import ResumeViewerModal from '../components/ResumeViewerModal';
import { apiRequest, downloadAuthenticatedFile } from '../lib/api';
import { Resume } from '../types';

export default function ResumesPage() {
  const { token } = useAuth();
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewingResumeId, setViewingResumeId] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    apiRequest<Resume[]>('/resumes', { token })
      .then(setResumes)
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <div className="loading">Loading resumes...</div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Resumes</h1>
          <p>AI-generated tailored resumes stored on the server</p>
        </div>
      </div>

      {resumes.length === 0 ? (
        <div className="card empty-state">
          <h3>No resumes yet</h3>
          <p>
            Use the Chrome extension on a LinkedIn job page to extract details and
            generate a tailored resume.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {resumes.map((resume) => (
            <div key={resume.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ fontSize: 16 }}>{resume.jobTitle}</h3>
                  <p style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                    {resume.companyName} · {new Date(resume.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => setViewingResumeId(resume.id)}
                  >
                    View
                  </button>
                  {resume.filePath && token && (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() =>
                        downloadAuthenticatedFile(
                          resume.filePath!,
                          token,
                          resume.fileName || 'resume',
                        )
                      }
                    >
                      Download
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {viewingResumeId && token ? (
        <ResumeViewerModal
          resumeId={viewingResumeId}
          token={token}
          onClose={() => setViewingResumeId(null)}
        />
      ) : null}
    </div>
  );
}
