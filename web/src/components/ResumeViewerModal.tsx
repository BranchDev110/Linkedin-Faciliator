import { useEffect, useState } from 'react';
import {
  apiRequest,
  downloadAuthenticatedFile,
  fetchAuthenticatedFile,
} from '../lib/api';
import { Resume } from '../types';
import './ResumeViewerModal.css';

interface ResumeViewerModalProps {
  resumeId: string;
  token: string;
  onClose: () => void;
}

export default function ResumeViewerModal({
  resumeId,
  token,
  onClose,
}: ResumeViewerModalProps) {
  const [resume, setResume] = useState<Resume | null>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError('');
      setHtml(null);
      setResume(null);

      try {
        const data = await apiRequest<Resume>(`/resumes/${resumeId}`, { token });
        if (cancelled) return;

        setResume(data);

        if (data.outputFormat === 'docx' && data.filePath) {
          const blob = await fetchAuthenticatedFile(data.filePath, token);
          if (cancelled) return;

          const mammoth = await import('mammoth');
          const arrayBuffer = await blob.arrayBuffer();
          const result = await mammoth.convertToHtml({ arrayBuffer });
          setHtml(result.value);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load resume');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [resumeId, token]);

  const title = resume
    ? `${resume.jobTitle} at ${resume.companyName}`
    : 'Resume';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content modal-content-wide resume-viewer-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="resume-viewer-header">
          <div>
            <h2>{title}</h2>
            {resume?.fileName ? (
              <p className="resume-viewer-subtitle">{resume.fileName}</p>
            ) : null}
          </div>
          <div className="resume-viewer-actions">
            {resume?.filePath ? (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
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
            ) : null}
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
              Close
            </button>
          </div>
        </div>

        {loading ? <div className="resume-viewer-loading">Loading resume...</div> : null}
        {error ? <div className="resume-viewer-error">{error}</div> : null}

        {!loading && !error && html ? (
          <div
            className="resume-viewer-html"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : null}

        {!loading && !error && !html && resume?.content ? (
          <pre className="resume-viewer-text">{resume.content}</pre>
        ) : null}

        {!loading && !error && !html && !resume?.content ? (
          <p className="resume-viewer-empty">No resume content available.</p>
        ) : null}
      </div>
    </div>
  );
}
