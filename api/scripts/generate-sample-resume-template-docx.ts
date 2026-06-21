import * as fs from 'fs';
import * as path from 'path';
import {
  AlignmentType,
  Document,
  Packer,
  Paragraph,
  TextRun,
} from 'docx';

const sectionHeading = (text: string) =>
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

const body = (text: string) =>
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
        body('{{ForeFlight}}'),
        body('Revolution Parts'),
        body('{{company:Revolution Parts}}'),
        body('Sandoval Agency'),
        body('{{Sandoval Agency}}'),
        body('Google'),
        body('{{Google}}'),
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
