"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const docx_1 = require("docx");
const sectionHeading = (text) => new docx_1.Paragraph({
    spacing: { before: 240, after: 120 },
    children: [
        new docx_1.TextRun({
            text,
            bold: true,
            size: 24,
            allCaps: true,
        }),
    ],
});
const body = (text) => new docx_1.Paragraph({
    spacing: { after: 120 },
    children: [new docx_1.TextRun({ text, size: 22 })],
});
const doc = new docx_1.Document({
    sections: [
        {
            properties: {},
            children: [
                new docx_1.Paragraph({
                    alignment: docx_1.AlignmentType.CENTER,
                    spacing: { after: 80 },
                    children: [
                        new docx_1.TextRun({
                            text: 'KEVIN GRANT',
                            bold: true,
                            size: 36,
                        }),
                    ],
                }),
                new docx_1.Paragraph({
                    alignment: docx_1.AlignmentType.CENTER,
                    spacing: { after: 80 },
                    children: [
                        new docx_1.TextRun({
                            text: 'Senior Software Engineer',
                            size: 24,
                        }),
                    ],
                }),
                new docx_1.Paragraph({
                    alignment: docx_1.AlignmentType.CENTER,
                    spacing: { after: 240 },
                    children: [
                        new docx_1.TextRun({
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
    const buffer = await docx_1.Packer.toBuffer(doc);
    const outPath = path.join(__dirname, '../src/data/sample-resume-template-kevin-grant.docx');
    fs.writeFileSync(outPath, buffer);
    console.log(`Wrote ${outPath}`);
}
main().catch((err) => {
    console.error(err);
    process.exit(1);
});
//# sourceMappingURL=generate-sample-resume-template-docx.js.map