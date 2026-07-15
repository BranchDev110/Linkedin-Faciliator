const FILE_SELECT_HOOK_FLAG = '__liFacilitatorFileSelectHook';
const LIF_DOWNLOAD_ROOT = 'Lif';

function isResumeFileName(fileName: string): boolean {
  return /\.(docx|pdf|doc|rtf)$/i.test(fileName.trim());
}

function sanitizeCapturedFolderName(folderName: string): string {
  return folderName.trim().replace(/[\\/:*?"<>|]/g, '_');
}

function isDateFolderName(folderName: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(folderName.trim());
}

function normalizeResumeFolderName(folderName: string): string | null {
  const trimmed = folderName.trim();
  if (!trimmed) {
    return null;
  }

  // Legacy server-style folders: Resume_<applicationId>
  if (/^Resume_/i.test(trimmed)) {
    return sanitizeCapturedFolderName(trimmed);
  }

  // Legacy flat folders: YYYY-MM-DD_Company_Role
  if (/^\d{4}-\d{2}-\d{2}_/.test(trimmed)) {
    return sanitizeCapturedFolderName(trimmed);
  }

  // Current job folder: Company_Role (under Lif/<date>/)
  if (trimmed.includes('_') && !isDateFolderName(trimmed)) {
    return sanitizeCapturedFolderName(trimmed);
  }

  return null;
}

function folderNameFromPathParts(parts: string[]): string | null {
  if (parts.length < 2) {
    return null;
  }

  const fileIndex = parts.length - 1;
  const parentFolder = parts[fileIndex - 1];
  const lifIndex = parts.findIndex(
    (segment) => segment.toLowerCase() === LIF_DOWNLOAD_ROOT.toLowerCase(),
  );

  // Lif/<profile>/<date>/<company_role>/<file>
  if (lifIndex >= 0 && lifIndex + 3 === fileIndex - 1) {
    const profileFolder = parts[lifIndex + 1];
    const dateFolder = parts[lifIndex + 2];
    const jobFolder = parts[lifIndex + 3];
    if (profileFolder && isDateFolderName(dateFolder)) {
      const normalizedJobFolder = normalizeResumeFolderName(jobFolder);
      if (normalizedJobFolder) {
        return `${sanitizeCapturedFolderName(profileFolder)}/${dateFolder}/${normalizedJobFolder}`;
      }
    }
  }

  // Legacy: Lif/<date>/<company_role>/<file>
  if (lifIndex >= 0 && lifIndex + 2 === fileIndex - 1) {
    const dateFolder = parts[lifIndex + 1];
    const jobFolder = parts[lifIndex + 2];
    if (isDateFolderName(dateFolder)) {
      const normalizedJobFolder = normalizeResumeFolderName(jobFolder);
      if (normalizedJobFolder) {
        return `${dateFolder}/${normalizedJobFolder}`;
      }
    }
  }

  // Lif/<legacy-or-job-folder>/<file>
  if (lifIndex >= 0 && lifIndex < fileIndex - 1) {
    const lifJobFolder = parts[lifIndex + 1];
    const normalizedLifFolder = normalizeResumeFolderName(lifJobFolder);
    if (normalizedLifFolder) {
      return normalizedLifFolder;
    }
  }

  return normalizeResumeFolderName(parentFolder);
}

function parseResumeFolderFromInput(
  input: HTMLInputElement,
  file: File,
): { resumeFolderName: string; resumeFileName: string } | null {
  const fileName = file.name?.trim() || '';
  if (!fileName || !isResumeFileName(fileName)) {
    return null;
  }

  const relativePath = file.webkitRelativePath?.trim();
  if (relativePath) {
    const parts = relativePath.split(/[/\\]/).filter(Boolean);
    const folderName = folderNameFromPathParts(parts);
    if (folderName) {
      return { resumeFolderName: folderName, resumeFileName: parts[parts.length - 1] };
    }
  }

  const value = input.value?.trim() || '';
  if (value) {
    const segments = value.split(/[/\\]/).filter(Boolean);
    const folderName = folderNameFromPathParts(segments);
    if (folderName) {
      return {
        resumeFolderName: folderName,
        resumeFileName: segments[segments.length - 1] || fileName,
      };
    }
  }

  return { resumeFolderName: '', resumeFileName: fileName };
}

function isExtensionRuntimeValid(): boolean {
  try {
    return Boolean(chrome.runtime?.id);
  } catch {
    return false;
  }
}

function shouldInitialize(): boolean {
  const flag = (window as Window & { [FILE_SELECT_HOOK_FLAG]?: boolean })[
    FILE_SELECT_HOOK_FLAG
  ];
  if (!flag) return true;
  return !isExtensionRuntimeValid();
}

if (!shouldInitialize()) {
  // Already initialized in this frame.
} else {
  (window as Window & { [FILE_SELECT_HOOK_FLAG]?: boolean })[FILE_SELECT_HOOK_FLAG] = true;

  document.addEventListener(
    'change',
    (event) => {
      if (!isExtensionRuntimeValid()) return;

      const target = event.target;
      if (!(target instanceof HTMLInputElement)) return;
      if (target.type !== 'file') return;

      const file = target.files?.[0];
      if (!file) return;

      const parsed = parseResumeFolderFromInput(target, file);
      if (!parsed) return;

      chrome.runtime
        .sendMessage({
          type: 'RESUME_FILE_SELECTED',
          pageUrl: window.location.href,
          resumeFolderName: parsed.resumeFolderName,
          resumeFileName: parsed.resumeFileName,
        })
        .catch(() => {});
    },
    true,
  );
}
