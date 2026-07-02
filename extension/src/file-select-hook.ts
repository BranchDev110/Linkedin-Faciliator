const FILE_SELECT_HOOK_FLAG = '__liFacilitatorFileSelectHook';

function isResumeFileName(fileName: string): boolean {
  return /\.(docx|pdf|doc|rtf)$/i.test(fileName.trim());
}

function normalizeResumeFolderName(folderName: string): string | null {
  const trimmed = folderName.trim();
  if (!/^Resume_/i.test(trimmed)) {
    return null;
  }

  return trimmed.replace(/[\\/:*?"<>|]/g, '_');
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
    if (parts.length >= 2) {
      const folderName = normalizeResumeFolderName(parts[parts.length - 2]);
      if (folderName) {
        return { resumeFolderName: folderName, resumeFileName: parts[parts.length - 1] };
      }
    }
  }

  const value = input.value?.trim() || '';
  if (value) {
    const segments = value.split(/[/\\]/).filter(Boolean);
    const folderIndex = segments.findIndex((segment) => /^Resume_/i.test(segment));
    if (folderIndex >= 0) {
      const folderName = normalizeResumeFolderName(segments[folderIndex]);
      if (folderName) {
        return {
          resumeFolderName: folderName,
          resumeFileName: segments[segments.length - 1] || fileName,
        };
      }
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
