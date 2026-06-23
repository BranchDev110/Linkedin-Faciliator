import { useEffect, useState } from 'react';
import {
  downloadAuthenticatedFile,
  fetchAuthenticatedFile,
  fileNameFromDownloadUrl,
  filePathFromDownloadUrl,
} from '../lib/api';
import './ResumeViewerModal.css';

interface ResumeViewerModalProps {
  resumeUrl: string;
  title?: string;
  token: string;
  onClose: () => void;
}

export default function ResumeViewerModal({
  resumeUrl,
  title = 'Resume',
  token,
  onClose,
}: ResumeViewerModalProps) {
  const [html, setHtml] = useState<string | null>(null);
  const [textContent, setTextContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const filePath = filePathFromDownloadUrl(resumeUrl);
  const fileName = fileNameFromDownloadUrl(resumeUrl);
  const isDocx = fileName.toLowerCase().endsWith('.docx');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!filePath) {
        setError('Resume file URL is invalid.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');
      setHtml(null);
      setTextContent('');

      try {
        const blob = await fetchAuthenticatedFile(filePath, token);
        if (cancelled) return;

        if (isDocx) {
          const mammoth = await import('mammoth');
          const arrayBuffer = await blob.arrayBuffer();
          const result = await mammoth.convertToHtml({ arrayBuffer });
          setHtml(result.value);
        } else {
          setTextContent(await blob.text());
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
  }, [filePath, isDocx, token]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content modal-content-wide resume-viewer-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="resume-viewer-header">
          <div>
            <h2>{title}</h2>
            <p className="resume-viewer-subtitle">{fileName}</p>
          </div>
          <div className="resume-viewer-actions">
            {filePath ? (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() =>
                  downloadAuthenticatedFile(filePath, token, fileName)
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

        {!loading && !error && textContent ? (
          <pre className="resume-viewer-text">{textContent}</pre>
        ) : null}

        {!loading && !error && !html && !textContent ? (
          <p className="resume-viewer-empty">No resume content available.</p>
        ) : null}
      </div>
    </div>
  );
}
