const fs = require('fs');
const path = require('path');
const {
  AlignmentType,
  Document,
  Packer,
  Paragraph,
  TextRun,
} = require('docx');

const sectionHeading = (text) =>
  new Paragraph({
    spacing: { before: 240, after: 120 },
    children: [
      new TextRun({
        text,
        bold: true,
        size: 24,
        allCaps: true,
      }),
    ],
  });

const body = (text) =>
  new Paragraph({
    spacing: { after: 120 },
    children: [new TextRun({ text, size: 22 })],
  });

const doc = new Document({
  sections: [
    {
      properties: {},
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 80 },
          children: [
            new TextRun({
              text: 'KEVIN GRANT',
              bold: true,
              size: 36,
            }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 80 },
          children: [
            new TextRun({
              text: 'Senior Software Engineer',
              size: 24,
            }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 240 },
          children: [
            new TextRun({
              text: 'kevin.grant@email.com | (555) 123-4567 | linkedin.com/in/kevingrant | San Francisco, CA',
              size: 20,
            }),
          ],
        }),
        sectionHeading('Professional Summary'),
        body('{{summary}}'),
        sectionHeading('Technical Skills'),
        body('{{skills}}'),
        sectionHeading('Professional Experience'),
        body('ForeFlight'),
        body('{{exp1}}'),
        body('Revolution Parts'),
        body('{{exp2}}'),
        body('Sandoval Agency'),
        body('{{exp3}}'),
        body('Google'),
        body('{{exp4}}'),
      ],
    },
  ],
});

async function main() {
  const buffer = await Packer.toBuffer(doc);
  const outPath = path.join(
    __dirname,
    '../src/data/sample-resume-template-kevin-grant.docx',
  );
  fs.writeFileSync(outPath, buffer);
  console.log(`Wrote ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
