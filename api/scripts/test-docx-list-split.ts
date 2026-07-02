import { splitMultilineListParagraphs } from '../src/resumes/docx-list-split';

const sample = `<w:body>
<w:p>
  <w:pPr>
    <w:pStyle w:val="ListParagraph"/>
    <w:numPr>
      <w:ilvl w:val="0"/>
      <w:numId w:val="12"/>
    </w:numPr>
  </w:pPr>
  <w:r>
    <w:rPr><w:sz w:val="22"/></w:rPr>
    <w:t>First bullet text</w:t>
  </w:r>
  <w:r>
    <w:br/>
  </w:r>
  <w:r>
    <w:rPr><w:sz w:val="22"/></w:rPr>
    <w:t>Second bullet text</w:t>
  </w:r>
  <w:r>
    <w:br/>
  </w:r>
  <w:r>
    <w:rPr><w:sz w:val="22"/></w:rPr>
    <w:t>Third bullet text</w:t>
  </w:r>
</w:p>
</w:body>`;

const result = splitMultilineListParagraphs(sample);
const paragraphCount = (result.match(/<w:p\b/g) || []).length;

if (paragraphCount !== 3) {
  console.error(`Expected 3 list paragraphs, got ${paragraphCount}`);
  console.error(result);
  process.exit(1);
}

if (!result.includes('First bullet text') || !result.includes('Third bullet text')) {
  console.error('Missing expected bullet text');
  process.exit(1);
}

console.log('docx-list-split test passed');
