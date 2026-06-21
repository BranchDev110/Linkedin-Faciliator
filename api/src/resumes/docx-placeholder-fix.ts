import PizZip from 'pizzip';

const DOCX_XML_PATTERN = /^word\/(document|header\d*|footer\d*)\.xml$/;
const PARAGRAPH_BODY_TOKEN =
  /<w:proofErr\b[^>]*\/>|<w:r\b[\s\S]*?<\/w:r>|<w:hyperlink\b[\s\S]*?<\/w:hyperlink>/g;

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function normalizePlaceholders(text: string): string {
  return text.replace(/\{\{\s+([^}]+?)\s+\}\}/g, '{{$1}}');
}

function extractRunText(runXml: string): string {
  return [...runXml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)]
    .map((match) => match[1])
    .join('');
}

function extractRunRPr(runXml: string): string {
  return runXml.match(/<w:rPr[\s\S]*?<\/w:rPr>/)?.[0] ?? '';
}

function runHasTab(runXml: string): boolean {
  return /<w:tab\b[^>]*\/>/.test(runXml);
}

function hasPlaceholderFragment(text: string): boolean {
  return text.includes('{{') || text.includes('}}');
}

function isPlaceholderMergeComplete(combinedText: string): boolean {
  const normalized = normalizePlaceholders(combinedText);
  if (!/\{\{[^{}]+\}\}/.test(normalized)) {
    return false;
  }

  let remainder = normalized;
  while (true) {
    const start = remainder.indexOf('{{');
    if (start === -1) {
      return true;
    }

    const end = remainder.indexOf('}}', start);
    if (end === -1) {
      return false;
    }

    remainder = remainder.slice(end + 2);
  }
}

function buildMergedPlaceholderRun(runXmlParts: string[]): string {
  const mergedText = normalizePlaceholders(
    runXmlParts.map(extractRunText).join(''),
  );
  const rPr = extractRunRPr(runXmlParts[0]);

  return `<w:r>${rPr}<w:t xml:space="preserve">${escapeXml(mergedText)}</w:t></w:r>`;
}

function tokenizeParagraphBody(body: string): string[] {
  const tokens: string[] = [];
  let lastIndex = 0;

  for (const match of body.matchAll(PARAGRAPH_BODY_TOKEN)) {
    if (match.index! > lastIndex) {
      tokens.push(body.slice(lastIndex, match.index));
    }
    tokens.push(match[0]);
    lastIndex = match.index! + match[0].length;
  }

  if (lastIndex < body.length) {
    tokens.push(body.slice(lastIndex));
  }

  return tokens;
}

function mergeSplitPlaceholderRuns(body: string): string {
  const output: string[] = [];
  const mergeRuns: string[] = [];

  const flushMerge = () => {
    if (mergeRuns.length === 0) {
      return;
    }

    output.push(buildMergedPlaceholderRun(mergeRuns));
    mergeRuns.length = 0;
  };

  for (const token of tokenizeParagraphBody(body)) {
    if (token.startsWith('<w:proofErr')) {
      if (mergeRuns.length === 0) {
        output.push(token);
      }
      continue;
    }

    if (!token.startsWith('<w:r')) {
      flushMerge();
      if (token.trim()) {
        output.push(token);
      }
      continue;
    }

    if (runHasTab(token)) {
      flushMerge();
      output.push(token);
      continue;
    }

    const text = extractRunText(token);
    const merging = mergeRuns.length > 0;

    if (!merging && !hasPlaceholderFragment(text)) {
      output.push(token);
      continue;
    }

    mergeRuns.push(token);

    if (isPlaceholderMergeComplete(mergeRuns.map(extractRunText).join(''))) {
      flushMerge();
    }
  }

  flushMerge();
  return output.join('');
}

export function fixParagraphPlaceholders(xml: string): string {
  return xml.replace(/<w:p\b[\s\S]*?<\/w:p>/g, (paragraph) => {
    if (!/\{\{|\}\}/.test(paragraph)) {
      return paragraph;
    }

    const paragraphOpen = paragraph.match(/^<w:p\b([^>]*)>/);
    const paragraphAttrs = paragraphOpen ? paragraphOpen[1] : '';
    const paragraphProps =
      paragraph.match(/<w:pPr[\s\S]*?<\/w:pPr>/)?.[0] ?? '';

    let body = paragraph.slice(paragraphOpen?.[0]?.length ?? 0);
    body = body.replace(/<\/w:p>$/, '');
    if (paragraphProps) {
      body = body.replace(paragraphProps, '');
    }

    return `<w:p${paragraphAttrs}>${paragraphProps}${mergeSplitPlaceholderRuns(body)}</w:p>`;
  });
}

export function prepareDocxTemplateForRendering(templateBuffer: Buffer): PizZip {
  const zip = new PizZip(templateBuffer);

  for (const fileName of Object.keys(zip.files)) {
    if (!DOCX_XML_PATTERN.test(fileName)) {
      continue;
    }

    const xml = zip.file(fileName)?.asText();
    if (!xml) {
      continue;
    }

    zip.file(fileName, fixParagraphPlaceholders(xml));
  }

  return zip;
}
