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

interface ExportRow {
  document_id: number;
  document_name: string;
  analyzed_text: string;
  start_string: string;
  end_string: string;
  code: string;
  code_description: string;
}

const EXPORT_COLUMNS: Array<keyof ExportRow> = [
  'document_id',
  'document_name',
  'analyzed_text',
  'start_string',
  'end_string',
  'code',
  'code_description'
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
    const documentsRes = await fetch(apiUrl(`/projects/${projectId}/documents`), { headers });

    if (!documentsRes.ok) throw new Error('Failed to fetch documents for export');

    const documents: Document[] = await documentsRes.json();
    const rows: ExportRow[] = [];

    for (const [index, document] of documents.entries()) {
      const codingsRes = await fetch(apiUrl(`/projects/${projectId}/documents/${document.id}/codings`), {
        headers
      });

      if (!codingsRes.ok) throw new Error(`Failed to fetch codings for ${document.title}`);

      const codings: Coding[] = await codingsRes.json();
      for (const coding of codings) {
        rows.push({
          document_id: index + 1,
          document_name: document.title,
          analyzed_text: coding.snippet,
          start_string: String(coding.startIndex),
          end_string: String(coding.endIndex),
          code: coding.code?.name ?? '',
          code_description: coding.code?.description ?? ''
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
              code_description.
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
      </section>
    </main>
  );
}
