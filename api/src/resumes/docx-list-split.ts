import PizZip from 'pizzip';

const DOCX_XML_PATTERN = /^word\/(document|header\d*|footer\d*)\.xml$/;
const LIST_STYLE_PATTERN = /<w:pStyle\b[^>]*w:val="[^"]*List[^"]*"/i;

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function isListParagraph(paragraph: string): boolean {
  return /<w:numPr\b/.test(paragraph) || LIST_STYLE_PATTERN.test(paragraph);
}

function paragraphBodyToLines(body: string): string[] {
  const lines: string[] = [''];

  for (const runMatch of body.matchAll(/<w:r\b[\s\S]*?<\/w:r>/g)) {
    const run = runMatch[0];
    const parts = run.split(/(<w:br\b[^>]*\/>)/);

    for (const part of parts) {
      if (/^<w:br\b/.test(part)) {
        lines.push('');
        continue;
      }

      for (const textMatch of part.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)) {
        lines[lines.length - 1] += textMatch[1];
      }
    }
  }

  return lines.map((line) => line.trim()).filter(Boolean);
}

function getFirstTextRunTemplate(body: string): string {
  const match = body.match(/<w:r\b[\s\S]*?<w:t[\s\S]*?<\/w:t>[\s\S]*?<\/w:r>/);
  return match?.[0] ?? '<w:r><w:t xml:space="preserve"></w:t></w:r>';
}

function buildRunWithText(runTemplate: string, text: string): string {
  const escaped = escapeXml(text);

  if (/<w:t\b/.test(runTemplate)) {
    return runTemplate.replace(
      /<w:t(?:\s[^>]*)?>[\s\S]*?<\/w:t>/,
      `<w:t xml:space="preserve">${escaped}</w:t>`,
    );
  }

  return `<w:r><w:t xml:space="preserve">${escaped}</w:t></w:r>`;
}

export function splitMultilineListParagraphs(xml: string): string {
  return xml.replace(/<w:p\b[\s\S]*?<\/w:p>/g, (paragraph) => {
    if (!isListParagraph(paragraph) || !/<w:br\b[^>]*\/>/.test(paragraph)) {
      return paragraph;
    }

    const openMatch = paragraph.match(/^<w:p\b([^>]*)>/);
    if (!openMatch) {
      return paragraph;
    }

    const paragraphOpen = openMatch[1];
    const paragraphProps = paragraph.match(/<w:pPr[\s\S]*?<\/w:pPr>/)?.[0] ?? '';
    let body = paragraph.slice(openMatch[0].length, -6);
    if (paragraphProps) {
      body = body.replace(paragraphProps, '');
    }

    const lines = paragraphBodyToLines(body);
    if (lines.length <= 1) {
      return paragraph;
    }

    const runTemplate = getFirstTextRunTemplate(body);

    return lines
      .map(
        (line) =>
          `<w:p${paragraphOpen}>${paragraphProps}${buildRunWithText(runTemplate, line)}</w:p>`,
      )
      .join('');
  });
}

export function splitListParagraphsInDocxZip(zip: PizZip): void {
  for (const fileName of Object.keys(zip.files)) {
    if (!DOCX_XML_PATTERN.test(fileName)) {
      continue;
    }

    const xml = zip.file(fileName)?.asText();
    if (!xml) {
      continue;
    }

    zip.file(fileName, splitMultilineListParagraphs(xml));
  }
}
