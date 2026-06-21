export const BULLET_LINE_PREFIX = '- ';

export function stripBulletLinePrefix(line: string): string {
  return line.trim().replace(/^[-•*–—]\s*/, '');
}

export function formatBulletLines(text: string): string {
  return text
    .split('\n')
    .map((line) => stripBulletLinePrefix(line))
    .filter(Boolean)
    .map((line) => `${BULLET_LINE_PREFIX}${line}`)
    .join('\n');
}

export function resetBulletTextareaBaseline(textarea: HTMLTextAreaElement): void {
  textarea.dataset.bulletBaseline = textarea.value;
}

export function bindBulletTextarea(
  textarea: HTMLTextAreaElement,
  onUpdate?: () => void,
): void {
  resetBulletTextareaBaseline(textarea);

  const notifyIfChanged = () => {
    const baseline = textarea.dataset.bulletBaseline ?? '';
    if (textarea.value === baseline) return;
    textarea.dataset.bulletBaseline = textarea.value;
    onUpdate?.();
  };

  textarea.addEventListener('focus', () => {
    if (!textarea.value.trim()) {
      textarea.value = BULLET_LINE_PREFIX;
      textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    }
  });

  textarea.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' || event.shiftKey) {
      return;
    }

    event.preventDefault();

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const insert = `\n${BULLET_LINE_PREFIX}`;

    textarea.value =
      textarea.value.slice(0, start) + insert + textarea.value.slice(end);

    const cursor = start + insert.length;
    textarea.setSelectionRange(cursor, cursor);
    notifyIfChanged();
  });

  textarea.addEventListener('input', notifyIfChanged);

  textarea.addEventListener('blur', () => {
    const formatted = formatBulletLines(textarea.value);
    if (formatted !== textarea.value) {
      textarea.value = formatted;
    }
    notifyIfChanged();
  });
}
