'use client';

import { type ChangeEvent, useState } from 'react';
import { useParams } from 'next/navigation';
import { TopNav } from '@/components/top-nav';
import { apiUrl } from '@/lib/api';

interface Document {
  id: string;
  title: string;
}

interface Code {
  name: string;
  description?: string;
}

interface Coding {
  id: string;
  snippet: string;
  startIndex: number;
  endIndex: number;
  code?: Code;
}

interface Theme {
  id: string;
  name: string;
  layer: number;
  documentId?: string | null;
  codingLinks: Array<{ codingId: string }>;
  parentThemeLinks: Array<{ parentThemeId: string }>;
}

interface ReportTheme {
  id: string;
  name: string;
  codes: Array<{ id: string; name: string }>;
  sourceCount?: number;
  reportContent: string;
}

interface ReportThemesResponse {
  layer: number | null;
  themes: ReportTheme[];
}

interface ExportRow {
  document_id: number;
  document_name: string;
  analyzed_text: string;
  start_string: string;
  end_string: string;
  code: string;
  code_description: string;
  'document theme': string;
  'doc theme layer 2': string;
  'doc theme layer 3': string;
  'global theme': string;
  'global theme layer 2': string;
  'global theme layer 3': string;
}

const EXPORT_COLUMNS: Array<keyof ExportRow> = [
  'document_id',
  'document_name',
  'analyzed_text',
  'start_string',
  'end_string',
  'code',
  'code_description',
  'document theme',
  'doc theme layer 2',
  'doc theme layer 3',
  'global theme',
  'global theme layer 2',
  'global theme layer 3'
];

const IMPORT_FIELDS = [
  { key: 'codeName', label: 'Code' },
  { key: 'snippet', label: 'Marked text' },
  { key: 'codeDescription', label: 'Code description' },
  { key: 'startIndex', label: 'Start string/index' },
  { key: 'endIndex', label: 'End string/index' }
] as const;

type ImportField = (typeof IMPORT_FIELDS)[number]['key'];
type ColumnMapping = Record<ImportField, string>;
type CsvRow = Record<string, string>;

const REQUIRED_IMPORT_FIELDS: ImportField[] = ['codeName', 'snippet', 'startIndex', 'endIndex'];
const EMPTY_MAPPING: ColumnMapping = {
  codeName: '',
  snippet: '',
  codeDescription: '',
  startIndex: '',
  endIndex: ''
};

const FIELD_COLUMN_HINTS: Record<ImportField, string[]> = {
  codeName: ['code', 'code_name', 'kod', 'kód'],
  snippet: ['analyzed_text', 'marked_text', 'selected_text', 'snippet', 'text', 'označený text', 'oznaceny text'],
  codeDescription: ['code_description', 'description', 'code_desc', 'popis', 'popis kódu', 'popis kodu'],
  startIndex: ['start_string', 'start_index', 'start', 'začiatok', 'zaciatok'],
  endIndex: ['end_string', 'end_index', 'end', 'koniec']
};

function escapeCsvCell(value: string | number) {
  const stringValue = String(value);
  if (!/[",\n\r]/.test(stringValue)) return stringValue;
  return `"${stringValue.replace(/"/g, '""')}"`;
}

function escapeXml(value: string | number) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const nextCharacter = text[index + 1];

    if (character === '"' && inQuotes && nextCharacter === '"') {
      cell += '"';
      index += 1;
      continue;
    }

    if (character === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (character === ',' && !inQuotes) {
      row.push(cell);
      cell = '';
      continue;
    }

    if ((character === '\n' || character === '\r') && !inQuotes) {
      if (character === '\r' && nextCharacter === '\n') index += 1;
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = '';
      continue;
    }

    cell += character;
  }

  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);

  const [headerRow, ...dataRows] = rows;
  if (!headerRow) return { headers: [], rows: [] };

  const headers = headerRow.map((header) => header.trim().replace(/^\uFEFF/, ''));
  return {
    headers,
    rows: dataRows.map((dataRow) =>
      Object.fromEntries(headers.map((header, index) => [header, dataRow[index]?.trim() ?? '']))
    )
  };
}

function inferMapping(headers: string[]): ColumnMapping {
  const mapping = { ...EMPTY_MAPPING };
  const normalizedHeaders = headers.map((header) => ({ raw: header, normalized: header.trim().toLowerCase() }));

  for (const field of IMPORT_FIELDS) {
    const match = normalizedHeaders.find((header) => FIELD_COLUMN_HINTS[field.key].includes(header.normalized));
    if (match) mapping[field.key] = match.raw;
  }

  return mapping;
}

function parseIndex(value: string, fallback: number) {
  const trimmedValue = value.trim();
  const parsed = Number.parseInt(trimmedValue, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function buildCsv(rows: ExportRow[]) {
  const header = EXPORT_COLUMNS.join(',');
  const body = rows.map((row) => EXPORT_COLUMNS.map((column) => escapeCsvCell(row[column])).join(','));
  return `\uFEFF${[header, ...body].join('\n')}`;
}

function getThemeNames(themes: Theme[]) {
  return themes
    .map((theme) => theme.name)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b))
    .join(', ');
}

function getChildThemes(themes: Theme[], parentThemes: Theme[], layer: number, documentId?: string | null) {
  const parentIds = new Set(parentThemes.map((theme) => theme.id));
  if (parentIds.size === 0) return [];

  return themes.filter(
    (theme) =>
      theme.layer === layer &&
      (documentId === undefined || (theme.documentId ?? null) === documentId) &&
      theme.parentThemeLinks.some((link) => parentIds.has(link.parentThemeId))
  );
}

const CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writeUint16(bytes: number[], value: number) {
  bytes.push(value & 0xff, (value >>> 8) & 0xff);
}

function writeUint32(bytes: number[], value: number) {
  bytes.push(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff);
}

function createZip(files: Array<{ name: string; content: string }>) {
  const encoder = new TextEncoder();
  const bytes: number[] = [];
  const centralDirectory: number[] = [];

  for (const file of files) {
    const nameBytes = encoder.encode(file.name);
    const contentBytes = encoder.encode(file.content);
    const checksum = crc32(contentBytes);
    const localHeaderOffset = bytes.length;

    writeUint32(bytes, 0x04034b50);
    writeUint16(bytes, 20);
    writeUint16(bytes, 0);
    writeUint16(bytes, 0);
    writeUint16(bytes, 0);
    writeUint16(bytes, 0);
    writeUint32(bytes, checksum);
    writeUint32(bytes, contentBytes.length);
    writeUint32(bytes, contentBytes.length);
    writeUint16(bytes, nameBytes.length);
    writeUint16(bytes, 0);
    bytes.push(...nameBytes, ...contentBytes);

    writeUint32(centralDirectory, 0x02014b50);
    writeUint16(centralDirectory, 20);
    writeUint16(centralDirectory, 20);
    writeUint16(centralDirectory, 0);
    writeUint16(centralDirectory, 0);
    writeUint16(centralDirectory, 0);
    writeUint16(centralDirectory, 0);
    writeUint32(centralDirectory, checksum);
    writeUint32(centralDirectory, contentBytes.length);
    writeUint32(centralDirectory, contentBytes.length);
    writeUint16(centralDirectory, nameBytes.length);
    writeUint16(centralDirectory, 0);
    writeUint16(centralDirectory, 0);
    writeUint16(centralDirectory, 0);
    writeUint16(centralDirectory, 0);
    writeUint32(centralDirectory, 0);
    writeUint32(centralDirectory, localHeaderOffset);
    centralDirectory.push(...nameBytes);
  }

  const centralDirectoryOffset = bytes.length;
  bytes.push(...centralDirectory);
  writeUint32(bytes, 0x06054b50);
  writeUint16(bytes, 0);
  writeUint16(bytes, 0);
  writeUint16(bytes, files.length);
  writeUint16(bytes, files.length);
  writeUint32(bytes, centralDirectory.length);
  writeUint32(bytes, centralDirectoryOffset);
  writeUint16(bytes, 0);

  return new Uint8Array(bytes);
}

function buildXlsx(rows: ExportRow[]) {
  const sheetRows = [
    EXPORT_COLUMNS.map((column) => String(column)),
    ...rows.map((row) => EXPORT_COLUMNS.map((column) => row[column]))
  ];

  const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
    ${sheetRows
      .map(
        (row, rowIndex) => `<row r="${rowIndex + 1}">
      ${row
        .map(
          (cell) => `<c t="inlineStr"><is><t>${escapeXml(cell)}</t></is></c>`
        )
        .join('')}
    </row>`
      )
      .join('')}
  </sheetData>
</worksheet>`;

  const files = [
    {
      name: '[Content_Types].xml',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`
    },
    {
      name: '_rels/.rels',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`
    },
    {
      name: 'xl/workbook.xml',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Coding Export" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`
    },
    {
      name: 'xl/worksheets/sheet1.xml',
      content: sheetXml
    }
  ];

  return new Blob([createZip(files)], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
}

type DocxParagraphStyle = 'Title' | 'Heading1' | 'Heading2';

function createDocxParagraph(
  text: string,
  options: { style?: DocxParagraphStyle; italic?: boolean; bold?: boolean } = {}
) {
  const paragraphProperties = options.style ? `<w:pPr><w:pStyle w:val="${options.style}"/></w:pPr>` : '';
  const runProperties = options.italic || options.bold ? `<w:rPr>${options.bold ? '<w:b/>' : ''}${options.italic ? '<w:i/>' : ''}</w:rPr>` : '';

  return `<w:p>${paragraphProperties}<w:r>${runProperties}<w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`;
}

function createDocxPageBreak() {
  return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
}

function createDocxTextBlock(text: string) {
  const lines = text.trim() ? text.trim().split(/\n/) : ['No report text saved for this theme.'];
  return lines
    .map((line) => (line.trim() ? createDocxParagraph(line.trim()) : '<w:p/>'))
    .join('');
}

function createReportDocx(themes: ReportTheme[]) {
  const body: string[] = [
    createDocxParagraph('Thematic Analysis report', { style: 'Title' }),
    createDocxParagraph('List of themes', { style: 'Heading1' })
  ];

  themes.forEach((theme, index) => {
    body.push(createDocxParagraph(`${index + 1}. ${theme.name}`));
  });

  themes.forEach((theme, index) => {
    const codes = theme.codes.map((code) => code.name).join(', ') || 'No codes';
    const meta = [`Codes: ${codes}`];
    if (typeof theme.sourceCount === 'number') meta.push(`Sources: ${theme.sourceCount}`);

    body.push(
      createDocxPageBreak(),
      createDocxParagraph(`${index + 1}. ${theme.name}`, { style: 'Heading1' }),
      createDocxParagraph(meta.join(' / '), { italic: true }),
      createDocxTextBlock(theme.reportContent)
    );
  });

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${body.join('\n')}
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;

  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:qFormat/>
    <w:pPr><w:spacing w:after="160" w:line="276" w:lineRule="auto"/></w:pPr>
    <w:rPr><w:sz w:val="24"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Title">
    <w:name w:val="Title"/>
    <w:basedOn w:val="Normal"/>
    <w:qFormat/>
    <w:pPr><w:spacing w:after="320"/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="36"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
    <w:basedOn w:val="Normal"/>
    <w:qFormat/>
    <w:pPr><w:spacing w:before="240" w:after="160"/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="30"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="heading 2"/>
    <w:basedOn w:val="Normal"/>
    <w:qFormat/>
    <w:pPr><w:spacing w:before="200" w:after="120"/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="26"/></w:rPr>
  </w:style>
</w:styles>`;

  const files = [
    {
      name: '[Content_Types].xml',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`
    },
    {
      name: '_rels/.rels',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
    },
    {
      name: 'word/_rels/document.xml.rels',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`
    },
    {
      name: 'word/document.xml',
      content: documentXml
    },
    {
      name: 'word/styles.xml',
      content: stylesXml
    }
  ];

  return new Blob([createZip(files)], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  });
}

type PdfTextItem = {
  text: string;
  x: number;
  y: number;
  size: number;
  font: 'regular' | 'bold' | 'italic';
};

type PdfLinkItem = {
  rect: [number, number, number, number];
  themeIndex: number;
  targetPageIndex: number;
};

type PdfPage = {
  texts: PdfTextItem[];
  links: PdfLinkItem[];
};

const PDF_WIDTH = 595.28;
const PDF_HEIGHT = 841.89;
const PDF_MARGIN = 56;
const PDF_BOTTOM = 56;

function escapePdfText(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function estimatePdfTextWidth(value: string, size: number) {
  return value.length * size * 0.48;
}

function wrapPdfText(value: string, maxWidth: number, size: number) {
  const paragraphs = value.split(/\n/);
  const lines: string[] = [];

  for (const paragraph of paragraphs) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push('');
      continue;
    }

    let line = '';
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (estimatePdfTextWidth(candidate, size) <= maxWidth || !line) {
        line = candidate;
      } else {
        lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
  }

  return lines;
}

function createReportPdf(themes: ReportTheme[]) {
  const pages: PdfPage[] = [{ texts: [], links: [] }];
  const chapterPageIndexes: number[] = [];
  let currentPage = pages[0];
  let y = PDF_HEIGHT - PDF_MARGIN;

  const addPage = () => {
    const page = { texts: [], links: [] };
    pages.push(page);
    currentPage = page;
    y = PDF_HEIGHT - PDF_MARGIN;
    return page;
  };

  const addText = (
    text: string,
    x: number,
    currentY: number,
    size: number,
    font: 'regular' | 'bold' | 'italic' = 'regular'
  ) => {
    currentPage.texts.push({ text, x, y: currentY, size, font });
  };

  const addWrappedText = (
    text: string,
    size: number,
    lineHeight: number,
    font: 'regular' | 'bold' | 'italic' = 'regular'
  ) => {
    const maxWidth = PDF_WIDTH - PDF_MARGIN * 2;
    for (const line of wrapPdfText(text, maxWidth, size)) {
      if (y < PDF_BOTTOM + lineHeight) addPage();
      addText(line, PDF_MARGIN, y, size, font);
      y -= lineHeight;
    }
  };

  addText('Thematic Analysis report', PDF_MARGIN, y, 18, 'bold');
  y -= 28;
  addText('List of themes', PDF_MARGIN, y, 16, 'bold');
  y -= 30;
  themes.forEach((theme, index) => {
    if (y < PDF_BOTTOM + 24) addPage();
    const label = `${index + 1}. ${theme.name}`;
    addText(label, PDF_MARGIN, y, 12, 'regular');
    currentPage.links.push({
      rect: [PDF_MARGIN, y - 3, PDF_MARGIN + Math.min(430, estimatePdfTextWidth(label, 12) + 8), y + 13],
      themeIndex: index,
      targetPageIndex: -1
    });
    y -= 20;
  });

  themes.forEach((theme, index) => {
    const page = addPage();
    chapterPageIndexes[index] = pages.length - 1;
    const title = `${index + 1}. ${theme.name}`;
    addText(title, (PDF_WIDTH - estimatePdfTextWidth(title, 15)) / 2, y, 15, 'bold');
    y -= 28;

    const codes = theme.codes.map((code) => code.name).join(', ');
    addWrappedText(`(${codes || 'No codes'})`, 11, 16, 'italic');
    y -= 12;
    addWrappedText(theme.reportContent.trim() || 'No report text saved for this theme.', 12, 18);
  });

  for (const page of pages) {
    for (const link of page.links) {
      link.targetPageIndex = chapterPageIndexes[link.themeIndex] ?? 0;
    }
  }

  const encoder = new TextEncoder();
  const pagesObjectId = 4;
  const catalogObjectId = 5;
  let nextObjectId = 6;
  const pageObjectIds = pages.map(() => nextObjectId++);
  const contentObjectIds = pages.map(() => nextObjectId++);
  const annotationObjectIds = pages.map((page) => page.links.map(() => nextObjectId++));
  const objects = new Map<number, string>();

  objects.set(1, '<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman >>');
  objects.set(2, '<< /Type /Font /Subtype /Type1 /BaseFont /Times-Bold >>');
  objects.set(3, '<< /Type /Font /Subtype /Type1 /BaseFont /Times-Italic >>');
  objects.set(catalogObjectId, `<< /Type /Catalog /Pages ${pagesObjectId} 0 R >>`);

  pages.forEach((page, pageIndex) => {
    const stream = page.texts
      .map((item) => {
        const fontName = item.font === 'bold' ? 'F2' : item.font === 'italic' ? 'F3' : 'F1';
        return `BT /${fontName} ${item.size} Tf ${item.x.toFixed(2)} ${item.y.toFixed(2)} Td (${escapePdfText(item.text)}) Tj ET`;
      })
      .join('\n');
    const streamBytes = encoder.encode(stream);
    objects.set(contentObjectIds[pageIndex], `<< /Length ${streamBytes.length} >>\nstream\n${stream}\nendstream`);

    const annots = annotationObjectIds[pageIndex];
    objects.set(
      pageObjectIds[pageIndex],
      `<< /Type /Page /Parent ${pagesObjectId} 0 R /MediaBox [0 0 ${PDF_WIDTH} ${PDF_HEIGHT}] /Resources << /Font << /F1 1 0 R /F2 2 0 R /F3 3 0 R >> >> /Contents ${contentObjectIds[pageIndex]} 0 R${
        annots.length > 0 ? ` /Annots [${annots.map((id) => `${id} 0 R`).join(' ')}]` : ''
      } >>`
    );

    page.links.forEach((link, linkIndex) => {
      const targetPageObjectId = pageObjectIds[link.targetPageIndex] ?? pageObjectIds[0];
      objects.set(
        annots[linkIndex],
        `<< /Type /Annot /Subtype /Link /Rect [${link.rect.map((value) => value.toFixed(2)).join(' ')}] /Border [0 0 0] /A << /S /GoTo /D [${targetPageObjectId} 0 R /Fit] >> >>`
      );
    });
  });

  objects.set(pagesObjectId, `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`);

  let pdf = '%PDF-1.7\n%\u00e2\u00e3\u00cf\u00d3\n';
  const offsets: number[] = [0];
  const sortedObjectIds = Array.from(objects.keys()).sort((a, b) => a - b);
  for (const objectId of sortedObjectIds) {
    offsets[objectId] = encoder.encode(pdf).length;
    pdf += `${objectId} 0 obj\n${objects.get(objectId)}\nendobj\n`;
  }
  const xrefOffset = encoder.encode(pdf).length;
  const maxObjectId = Math.max(...sortedObjectIds);
  pdf += `xref\n0 ${maxObjectId + 1}\n0000000000 65535 f \n`;
  for (let objectId = 1; objectId <= maxObjectId; objectId += 1) {
    pdf += `${String(offsets[objectId] ?? 0).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${maxObjectId + 1} /Root ${catalogObjectId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return new Blob([encoder.encode(pdf)], { type: 'application/pdf' });
}

export default function ImportExportPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [importDocumentName, setImportDocumentName] = useState('');
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<CsvRow[]>([]);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>(EMPTY_MAPPING);

  const fetchExportRows = async (): Promise<ExportRow[]> => {
    const token = localStorage.getItem('accessToken');
    const headers = { Authorization: `Bearer ${token}` };
    const [documentsRes, themesRes] = await Promise.all([
      fetch(apiUrl(`/projects/${projectId}/documents`), { headers }),
      fetch(apiUrl(`/projects/${projectId}/themes`), { headers })
    ]);

    if (!documentsRes.ok) throw new Error('Failed to fetch documents for export');
    if (!themesRes.ok) throw new Error('Failed to fetch themes for export');

    const documents: Document[] = await documentsRes.json();
    const themes: Theme[] = await themesRes.json();
    const rows: ExportRow[] = [];

    for (const [index, document] of documents.entries()) {
      const codingsRes = await fetch(apiUrl(`/projects/${projectId}/documents/${document.id}/codings`), {
        headers
      });

      if (!codingsRes.ok) throw new Error(`Failed to fetch codings for ${document.title}`);

      const codings: Coding[] = await codingsRes.json();
      for (const coding of codings) {
        const documentLayer1Themes = themes.filter(
          (theme) =>
            theme.documentId === document.id &&
            theme.layer === 1 &&
            theme.codingLinks.some((link) => link.codingId === coding.id)
        );
        const documentLayer2Themes = getChildThemes(themes, documentLayer1Themes, 2, document.id);
        const documentLayer3Themes = getChildThemes(themes, documentLayer2Themes, 3, document.id);
        const topDocumentLayerThemes =
          documentLayer3Themes.length > 0
            ? documentLayer3Themes
            : documentLayer2Themes.length > 0
              ? documentLayer2Themes
              : documentLayer1Themes;
        const globalLayer1Themes = getChildThemes(themes, topDocumentLayerThemes, 1, null);
        const globalLayer2Themes = getChildThemes(themes, globalLayer1Themes, 2, null);
        const globalLayer3Themes = getChildThemes(themes, globalLayer2Themes, 3, null);

        rows.push({
          document_id: index + 1,
          document_name: document.title,
          analyzed_text: coding.snippet,
          start_string: String(coding.startIndex),
          end_string: String(coding.endIndex),
          code: coding.code?.name ?? '',
          code_description: coding.code?.description ?? '',
          'document theme': getThemeNames(documentLayer1Themes),
          'doc theme layer 2': getThemeNames(documentLayer2Themes),
          'doc theme layer 3': getThemeNames(documentLayer3Themes),
          'global theme': getThemeNames(globalLayer1Themes),
          'global theme layer 2': getThemeNames(globalLayer2Themes),
          'global theme layer 3': getThemeNames(globalLayer3Themes)
        });
      }
    }

    return rows;
  };

  const handleExportCsv = async () => {
    try {
      setIsExporting(true);
      setError('');
      setSuccess('');
      const rows = await fetchExportRows();
      downloadBlob(new Blob([buildCsv(rows)], { type: 'text/csv;charset=utf-8' }), 'open-ta-codings.csv');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportXlsx = async () => {
    try {
      setIsExporting(true);
      setError('');
      setSuccess('');
      const rows = await fetchExportRows();
      downloadBlob(buildXlsx(rows), 'open-ta-codings.xlsx');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportReportPdf = async () => {
    try {
      setIsExporting(true);
      setError('');
      setSuccess('');
      const token = localStorage.getItem('accessToken');
      const res = await fetch(apiUrl(`/projects/${projectId}/reports/global-themes`), {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) throw new Error('Failed to fetch report content');
      const data: ReportThemesResponse = await res.json();
      if (data.themes.length === 0) throw new Error('No global themes available for report export');

      downloadBlob(createReportPdf(data.themes), 'open-ta-report.pdf');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportReportDocx = async () => {
    try {
      setIsExporting(true);
      setError('');
      setSuccess('');
      const token = localStorage.getItem('accessToken');
      const res = await fetch(apiUrl(`/projects/${projectId}/reports/global-themes`), {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) throw new Error('Failed to fetch report content');
      const data: ReportThemesResponse = await res.json();
      if (data.themes.length === 0) throw new Error('No global themes available for report export');

      downloadBlob(createReportDocx(data.themes), 'open-ta-report.docx');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setError('');
      setSuccess('');
      const parsed = parseCsv(await file.text());
      if (parsed.headers.length === 0) throw new Error('CSV file does not contain a header row');
      setCsvHeaders(parsed.headers);
      setCsvRows(parsed.rows);
      setColumnMapping(inferMapping(parsed.headers));
      if (!importDocumentName.trim()) {
        setImportDocumentName(file.name.replace(/\.csv$/i, ''));
      }
    } catch (err) {
      setCsvHeaders([]);
      setCsvRows([]);
      setColumnMapping(EMPTY_MAPPING);
      setError((err as Error).message);
    } finally {
      event.target.value = '';
    }
  };

  const updateMapping = (field: ImportField, value: string) => {
    setColumnMapping((prev) => ({ ...prev, [field]: value }));
  };

  const handleImportCodings = async () => {
    const missingField = REQUIRED_IMPORT_FIELDS.find((field) => !columnMapping[field]);
    if (missingField) {
      setError(`Map the ${IMPORT_FIELDS.find((field) => field.key === missingField)?.label} column before importing`);
      return;
    }

    if (!importDocumentName.trim()) {
      setError('Add a document name for the imported codes');
      return;
    }

    try {
      setIsImporting(true);
      setError('');
      setSuccess('');

      const rows = csvRows
        .map((row, index) => {
          const snippet = row[columnMapping.snippet]?.trim() ?? '';
          return {
            codeName: row[columnMapping.codeName]?.trim() ?? '',
            snippet,
            codeDescription: columnMapping.codeDescription
              ? row[columnMapping.codeDescription]?.trim() || undefined
              : undefined,
            startIndex: parseIndex(row[columnMapping.startIndex] ?? '', index),
            endIndex: parseIndex(row[columnMapping.endIndex] ?? '', index + snippet.length)
          };
        })
        .filter((row) => row.codeName && row.snippet);

      if (rows.length === 0) throw new Error('No importable rows found in the CSV');

      const token = localStorage.getItem('accessToken');
      const res = await fetch(apiUrl(`/projects/${projectId}/documents/import-codings`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          title: importDocumentName.trim(),
          rows
        })
      });

      if (!res.ok) {
        const message = await res.text();
        throw new Error(message || 'Failed to import coded rows');
      }

      setSuccess(`Imported ${rows.length} coded excerpts into "${importDocumentName.trim()}".`);
      setCsvHeaders([]);
      setCsvRows([]);
      setColumnMapping(EMPTY_MAPPING);
      setImportDocumentName('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <main>
      <TopNav />
      <section className="container page-stack">
        <header className="page-heading">
          <div>
            <h2>Import / Export</h2>
            <p>Import mapped CSV coding data or export coded excerpts for spreadsheet tools.</p>
          </div>
        </header>

        {error && <p style={{ color: 'var(--accent-2)' }}>{error}</p>}
        {success && <p style={{ color: 'var(--accent)' }}>{success}</p>}

        <div className="card import-card">
          <div>
            <strong>Import coded CSV</strong>
            <p style={{ color: 'var(--muted)' }}>
              Upload a CSV, map its columns, name the imported document, then add its codings to Data View.
            </p>
          </div>

          <label className="panel-label">
            CSV file
            <input type="file" accept=".csv,text/csv" onChange={handleImportFile} />
          </label>

          {csvHeaders.length > 0 && (
            <>
              <label className="panel-label">
                Imported document name
                <input
                  type="text"
                  value={importDocumentName}
                  onChange={(event) => setImportDocumentName(event.target.value)}
                  placeholder="Document name in OPEN_TA"
                />
              </label>

              <div className="mapping-grid">
                {IMPORT_FIELDS.map((field) => (
                  <label key={field.key}>
                    {field.label}
                    <select value={columnMapping[field.key]} onChange={(event) => updateMapping(field.key, event.target.value)}>
                      <option value="">Select CSV column</option>
                      {csvHeaders.map((header) => (
                        <option value={header} key={header}>
                          {header}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>

              <div className="import-preview">
                <small>{csvRows.length} CSV rows found</small>
                {csvRows.slice(0, 3).map((row, index) => (
                  <div key={`${index}-${row[csvHeaders[0]] ?? ''}`}>
                    <strong>{columnMapping.codeName ? row[columnMapping.codeName] : 'Code preview'}</strong>
                    <span>{columnMapping.snippet ? row[columnMapping.snippet] : 'Marked text preview'}</span>
                  </div>
                ))}
              </div>

              <button type="button" onClick={handleImportCodings} disabled={isImporting}>
                {isImporting ? 'Importing...' : 'Import mapped codings'}
              </button>
            </>
          )}
        </div>

        <div className="card" style={{ display: 'grid', gap: '0.8rem' }}>
          <div>
            <strong>Coding results</strong>
            <p style={{ color: 'var(--muted)' }}>
              Columns: document_id, document_name, analyzed_text, start_string, end_string, code,
              code_description, document theme, doc theme layer 2, doc theme layer 3, global theme,
              global theme layer 2, global theme layer 3.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button type="button" onClick={handleExportCsv} disabled={isExporting}>
              {isExporting ? 'Exporting...' : 'Export CSV'}
            </button>
            <button type="button" onClick={handleExportXlsx} disabled={isExporting}>
              {isExporting ? 'Exporting...' : 'Export XLSX'}
            </button>
          </div>
        </div>

        <div className="card" style={{ display: 'grid', gap: '0.8rem' }}>
          <div>
            <strong>Finished report</strong>
            <p style={{ color: 'var(--muted)' }}>
              Export the saved report sections from the latest global theme layer as a PDF or Word document.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button type="button" onClick={handleExportReportPdf} disabled={isExporting}>
              {isExporting ? 'Exporting...' : 'Export report PDF'}
            </button>
            <button type="button" onClick={handleExportReportDocx} disabled={isExporting}>
              {isExporting ? 'Exporting...' : 'Export report DOCX'}
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
