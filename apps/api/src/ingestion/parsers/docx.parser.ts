import { DocumentParser, ParsedDocument } from './document-parser.interface.js';

type ZipEntry = {
  name: string;
  compressionMethod: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
};

function readUInt16(buffer: Buffer, offset: number) {
  return buffer.readUInt16LE(offset);
}

function readUInt32(buffer: Buffer, offset: number) {
  return buffer.readUInt32LE(offset);
}

function parseZipEntries(buffer: Buffer) {
  const entries: ZipEntry[] = [];
  let offset = buffer.length - 22;

  while (offset >= 0 && readUInt32(buffer, offset) !== 0x06054b50) {
    offset -= 1;
  }

  if (offset < 0) {
    throw new Error('Invalid DOCX file');
  }

  const entryCount = readUInt16(buffer, offset + 10);
  let centralDirectoryOffset = readUInt32(buffer, offset + 16);

  for (let index = 0; index < entryCount; index += 1) {
    if (readUInt32(buffer, centralDirectoryOffset) !== 0x02014b50) {
      throw new Error('Invalid DOCX central directory');
    }

    const compressionMethod = readUInt16(buffer, centralDirectoryOffset + 10);
    const compressedSize = readUInt32(buffer, centralDirectoryOffset + 20);
    const uncompressedSize = readUInt32(buffer, centralDirectoryOffset + 24);
    const fileNameLength = readUInt16(buffer, centralDirectoryOffset + 28);
    const extraLength = readUInt16(buffer, centralDirectoryOffset + 30);
    const commentLength = readUInt16(buffer, centralDirectoryOffset + 32);
    const localHeaderOffset = readUInt32(buffer, centralDirectoryOffset + 42);
    const name = buffer
      .subarray(centralDirectoryOffset + 46, centralDirectoryOffset + 46 + fileNameLength)
      .toString('utf-8');

    entries.push({ name, compressionMethod, compressedSize, uncompressedSize, localHeaderOffset });
    centralDirectoryOffset += 46 + fileNameLength + extraLength + commentLength;
  }

  return entries;
}

async function inflateRaw(buffer: Buffer) {
  const { inflateRawSync } = await import('node:zlib');
  return inflateRawSync(buffer);
}

async function readZipEntry(buffer: Buffer, entry: ZipEntry) {
  const headerOffset = entry.localHeaderOffset;
  if (readUInt32(buffer, headerOffset) !== 0x04034b50) {
    throw new Error('Invalid DOCX local header');
  }

  const fileNameLength = readUInt16(buffer, headerOffset + 26);
  const extraLength = readUInt16(buffer, headerOffset + 28);
  const dataOffset = headerOffset + 30 + fileNameLength + extraLength;
  const compressedData = buffer.subarray(dataOffset, dataOffset + entry.compressedSize);

  if (entry.compressionMethod === 0) return compressedData;
  if (entry.compressionMethod === 8) return inflateRaw(compressedData);

  throw new Error(`Unsupported DOCX compression method: ${entry.compressionMethod}`);
}

function decodeXmlText(value: string) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function documentXmlToText(xml: string) {
  const textTags = xml
    .replace(/<w:tab\/>/g, '\t')
    .replace(/<w:br\/>/g, '\n')
    .replace(/<\/w:p>/g, '\n')
    .match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g);

  return textTags
    ?.map((tag) => decodeXmlText(tag.replace(/<w:t[^>]*>/, '').replace(/<\/w:t>$/, '')))
    .join(' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim() ?? '';
}

export class DocxParser implements DocumentParser {
  readonly type = 'DOCX' as const;

  async parse(fileBuffer: Buffer): Promise<ParsedDocument> {
    const documentEntry = parseZipEntries(fileBuffer).find((entry) => entry.name === 'word/document.xml');

    if (!documentEntry) {
      throw new Error('Could not find document text in DOCX file');
    }

    const documentXml = (await readZipEntry(fileBuffer, documentEntry)).toString('utf-8');
    const plainText = documentXmlToText(documentXml);

    if (!plainText) {
      throw new Error('No text could be extracted from DOCX file');
    }

    return {
      plainText,
      metadata: {
        sourceType: 'DOCX'
      }
    };
  }
}
