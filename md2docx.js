// Markdown to Word (.docx) converter for RFP proposals.
// Usage: node md2docx.js <input.md> <output.docx> "<Document Title>" "<Subtitle>"

const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, LevelFormat, HeadingLevel, BorderStyle,
  WidthType, ShadingType, VerticalAlign, PageNumber, PageBreak,
} = require('docx');

const [,, inputPath, outputPath, docTitle, docSubtitle] = process.argv;
if (!inputPath || !outputPath) {
  console.error('Usage: node md2docx.js <input.md> <output.docx> [title] [subtitle]');
  process.exit(1);
}

const md = fs.readFileSync(inputPath, 'utf8');

// --- Inline parser: returns TextRun[] ---
// Handles **bold**, *italic*, `code`, and flags [PLACEHOLDER: ...] with yellow highlight.
function parseInline(text, baseProps = {}) {
  const runs = [];
  // First, split on PLACEHOLDER brackets
  const placeholderRe = /\[PLACEHOLDER:[^\]]*\]/g;
  let lastIdx = 0;
  let m;
  const segments = [];
  while ((m = placeholderRe.exec(text)) !== null) {
    if (m.index > lastIdx) segments.push({ text: text.slice(lastIdx, m.index), placeholder: false });
    segments.push({ text: m[0], placeholder: true });
    lastIdx = m.index + m[0].length;
  }
  if (lastIdx < text.length) segments.push({ text: text.slice(lastIdx), placeholder: false });

  for (const seg of segments) {
    if (seg.placeholder) {
      runs.push(new TextRun({ ...baseProps, text: seg.text, highlight: 'yellow', italics: true, color: '7A5D00' }));
      continue;
    }
    // Tokenize **bold**, *italic*, `code`
    const tokenRe = /(\*\*[^*]+\*\*)|(\*[^*]+\*)|(`[^`]+`)/g;
    let idx = 0;
    let tm;
    while ((tm = tokenRe.exec(seg.text)) !== null) {
      if (tm.index > idx) runs.push(new TextRun({ ...baseProps, text: seg.text.slice(idx, tm.index) }));
      const tok = tm[0];
      if (tok.startsWith('**')) {
        runs.push(new TextRun({ ...baseProps, text: tok.slice(2, -2), bold: true }));
      } else if (tok.startsWith('`')) {
        runs.push(new TextRun({ ...baseProps, text: tok.slice(1, -1), font: 'Consolas', size: 20 }));
      } else {
        runs.push(new TextRun({ ...baseProps, text: tok.slice(1, -1), italics: true }));
      }
      idx = tm.index + tok.length;
    }
    if (idx < seg.text.length) runs.push(new TextRun({ ...baseProps, text: seg.text.slice(idx) }));
  }
  if (runs.length === 0) runs.push(new TextRun({ ...baseProps, text: '' }));
  return runs;
}

// --- Block-level parser ---
// Normalize lines
const rawLines = md.replace(/\r\n/g, '\n').split('\n');
// Pre-pass: drop blank lines sandwiched between two pipe-table rows so
// tables authored with doubled spacing still parse as a single table.
const joined = [];
for (let k = 0; k < rawLines.length; k++) {
  const cur = rawLines[k];
  if (cur.trim() === '') {
    let j = k + 1;
    while (j < rawLines.length && rawLines[j].trim() === '') j++;
    const prev = joined.length ? joined[joined.length - 1] : '';
    const next = j < rawLines.length ? rawLines[j] : '';
    if (prev.includes('|') && next.includes('|')) {
      k = j - 1;
      continue;
    }
  }
  joined.push(cur);
}
// Collapse 2+ blanks elsewhere.
const lines = [];
let blankRun = 0;
for (const l of joined) {
  if (l.trim() === '') {
    blankRun++;
    if (blankRun <= 1) lines.push('');
  } else {
    blankRun = 0;
    lines.push(l);
  }
}

const blocks = []; // { type, ... }
let i = 0;
while (i < lines.length) {
  const line = lines[i];
  const trimmed = line.trim();

  if (trimmed === '') { i++; continue; }

  // Horizontal rule
  if (/^---+$/.test(trimmed) || /^\*\*\*+$/.test(trimmed)) {
    blocks.push({ type: 'hr' });
    i++;
    continue;
  }

  // Headings
  const hMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
  if (hMatch) {
    blocks.push({ type: 'heading', level: hMatch[1].length, text: hMatch[2] });
    i++;
    continue;
  }

  // Blockquote
  if (trimmed.startsWith('>')) {
    const qlines = [];
    while (i < lines.length && lines[i].trim().startsWith('>')) {
      qlines.push(lines[i].trim().replace(/^>\s?/, ''));
      i++;
    }
    blocks.push({ type: 'blockquote', text: qlines.join(' ') });
    continue;
  }

  // Table (line containing | and next line is separator like |---|---|)
  if (trimmed.includes('|') && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/.test(lines[i+1])) {
    const headerCells = splitRow(trimmed);
    i += 2; // skip separator
    const rows = [];
    while (i < lines.length && lines[i].trim().includes('|') && lines[i].trim() !== '') {
      rows.push(splitRow(lines[i].trim()));
      i++;
    }
    blocks.push({ type: 'table', header: headerCells, rows });
    continue;
  }

  // Bullet list
  if (/^[-*]\s+/.test(trimmed)) {
    const items = [];
    while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
      items.push(lines[i].replace(/^\s*[-*]\s+/, ''));
      i++;
    }
    blocks.push({ type: 'ul', items });
    continue;
  }

  // Numbered list
  if (/^\d+\.\s+/.test(trimmed)) {
    const items = [];
    while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
      items.push(lines[i].replace(/^\s*\d+\.\s+/, ''));
      i++;
    }
    blocks.push({ type: 'ol', items });
    continue;
  }

  // Paragraph: collect until blank line or block-starter
  const pLines = [line];
  i++;
  while (i < lines.length) {
    const nxt = lines[i];
    const nt = nxt.trim();
    if (nt === '') break;
    if (/^#{1,6}\s/.test(nt)) break;
    if (/^---+$/.test(nt)) break;
    if (nt.startsWith('>')) break;
    if (/^[-*]\s+/.test(nt)) break;
    if (/^\d+\.\s+/.test(nt)) break;
    // table start check
    if (nt.includes('|') && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}:?/.test(lines[i+1])) break;
    pLines.push(nxt);
    i++;
  }
  blocks.push({ type: 'paragraph', text: pLines.join(' ') });
}

function splitRow(row) {
  let r = row.trim();
  if (r.startsWith('|')) r = r.slice(1);
  if (r.endsWith('|')) r = r.slice(0, -1);
  return r.split('|').map(s => s.trim());
}

// --- Render to docx ---
const BRAND = '1F3864'; // deep blue
const ACCENT = '2E74B5';
const MUTED = '595959';

const tableBorder = { style: BorderStyle.SINGLE, size: 4, color: 'BFBFBF' };
const cellBorders = { top: tableBorder, bottom: tableBorder, left: tableBorder, right: tableBorder };

const docChildren = [];

// Cover block
if (docTitle) {
  docChildren.push(new Paragraph({ spacing: { before: 2400, after: 120 }, alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: docTitle, bold: true, size: 56, color: BRAND, font: 'Calibri' })] }));
}
if (docSubtitle) {
  docChildren.push(new Paragraph({ spacing: { after: 360 }, alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: docSubtitle, size: 28, color: MUTED, font: 'Calibri' })] }));
  docChildren.push(new Paragraph({
    border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: BRAND, space: 4 } },
    spacing: { after: 240 }, children: [new TextRun('')],
  }));
}
if (docTitle) {
  docChildren.push(new Paragraph({ children: [new PageBreak()] }));
}

for (const b of blocks) {
  if (b.type === 'heading') {
    // Map: H1 -> Title style for top title; H2 -> Heading1; H3 -> Heading2; H4+ -> Heading3
    if (b.level === 1) {
      // Skip a redundant top-level title if we already rendered cover
      if (docTitle && docChildren.length <= 4) continue;
      docChildren.push(new Paragraph({
        heading: HeadingLevel.TITLE,
        children: parseInline(b.text),
      }));
    } else if (b.level === 2) {
      docChildren.push(new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: parseInline(b.text),
      }));
    } else if (b.level === 3) {
      docChildren.push(new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: parseInline(b.text),
      }));
    } else {
      docChildren.push(new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: parseInline(b.text),
      }));
    }
  } else if (b.type === 'paragraph') {
    docChildren.push(new Paragraph({
      spacing: { after: 160, line: 300 },
      alignment: AlignmentType.JUSTIFIED,
      children: parseInline(b.text),
    }));
  } else if (b.type === 'blockquote') {
    // source/citation styling
    docChildren.push(new Paragraph({
      spacing: { after: 160 },
      indent: { left: 360 },
      border: { left: { style: BorderStyle.SINGLE, size: 12, color: ACCENT, space: 8 } },
      children: parseInline(b.text.replace(/^\*|\*$/g, ''), { italics: true, color: MUTED, size: 20 }),
    }));
  } else if (b.type === 'hr') {
    docChildren.push(new Paragraph({
      spacing: { before: 120, after: 120 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'BFBFBF', space: 1 } },
      children: [new TextRun('')],
    }));
  } else if (b.type === 'ul') {
    for (const it of b.items) {
      docChildren.push(new Paragraph({
        numbering: { reference: 'bullets', level: 0 },
        spacing: { after: 80 },
        children: parseInline(it),
      }));
    }
  } else if (b.type === 'ol') {
    for (const it of b.items) {
      docChildren.push(new Paragraph({
        numbering: { reference: 'numbers', level: 0 },
        spacing: { after: 80 },
        children: parseInline(it),
      }));
    }
  } else if (b.type === 'table') {
    const colCount = b.header.length;
    const usable = 9360;
    const colW = Math.floor(usable / colCount);
    const widths = new Array(colCount).fill(colW);

    const buildCell = (text, isHeader) => new TableCell({
      borders: cellBorders,
      width: { size: colW, type: WidthType.DXA },
      shading: isHeader ? { fill: BRAND, type: ShadingType.CLEAR, color: 'auto' } : undefined,
      verticalAlign: VerticalAlign.CENTER,
      children: [new Paragraph({
        spacing: { before: 40, after: 40 },
        alignment: isHeader ? AlignmentType.LEFT : AlignmentType.LEFT,
        children: parseInline(text, isHeader ? { bold: true, color: 'FFFFFF', size: 20 } : { size: 20 }),
      })],
    });

    const rows = [];
    rows.push(new TableRow({
      tableHeader: true,
      children: b.header.map(h => buildCell(h, true)),
    }));
    for (const r of b.rows) {
      const padded = r.concat(new Array(Math.max(0, colCount - r.length)).fill(''));
      rows.push(new TableRow({ children: padded.slice(0, colCount).map(c => buildCell(c, false)) }));
    }

    docChildren.push(new Table({
      columnWidths: widths,
      margins: { top: 80, bottom: 80, left: 120, right: 120 },
      rows,
    }));
    docChildren.push(new Paragraph({ spacing: { after: 120 }, children: [new TextRun('')] }));
  }
}

const doc = new Document({
  creator: 'Acme Solutions',
  title: docTitle || 'Proposal',
  styles: {
    default: { document: { run: { font: 'Calibri', size: 22 } } }, // 11pt
    paragraphStyles: [
      { id: 'Title', name: 'Title', basedOn: 'Normal',
        run: { size: 52, bold: true, color: BRAND, font: 'Calibri' },
        paragraph: { spacing: { before: 0, after: 200 }, alignment: AlignmentType.LEFT } },
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 30, bold: true, color: BRAND, font: 'Calibri' },
        paragraph: { spacing: { before: 320, after: 160 }, outlineLevel: 0,
          border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: BRAND, space: 4 } } } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 26, bold: true, color: ACCENT, font: 'Calibri' },
        paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 1 } },
      { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 22, bold: true, color: MUTED, font: 'Calibri' },
        paragraph: { spacing: { before: 200, after: 80 }, outlineLevel: 2 } },
    ],
  },
  numbering: {
    config: [
      { reference: 'bullets',
        levels: [
          { level: 0, format: LevelFormat.BULLET, text: '\u2022', alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 540, hanging: 270 } } } },
          { level: 1, format: LevelFormat.BULLET, text: '\u25E6', alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 1080, hanging: 270 } } } },
        ] },
      { reference: 'numbers',
        levels: [
          { level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 540, hanging: 270 } } } },
        ] },
    ],
  },
  sections: [{
    properties: { page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
    headers: {
      default: new Header({ children: [new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [new TextRun({ text: docTitle || 'Proposal', color: MUTED, size: 18, font: 'Calibri' })],
      })] }),
    },
    footers: {
      default: new Footer({ children: [new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({ text: 'Page ', color: MUTED, size: 18, font: 'Calibri' }),
          new TextRun({ children: [PageNumber.CURRENT], color: MUTED, size: 18, font: 'Calibri' }),
          new TextRun({ text: ' of ', color: MUTED, size: 18, font: 'Calibri' }),
          new TextRun({ children: [PageNumber.TOTAL_PAGES], color: MUTED, size: 18, font: 'Calibri' }),
        ],
      })] }),
    },
    children: docChildren,
  }],
});

Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync(outputPath, buf);
  console.log('wrote', outputPath, buf.length, 'bytes');
});
