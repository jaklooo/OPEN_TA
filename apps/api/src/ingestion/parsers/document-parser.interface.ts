export type SupportedDocumentType = 'TXT' | 'PDF' | 'DOCX';

export interface ParsedDocument {
  plainText: string;
  metadata: {
    sourceType: SupportedDocumentType;
    language?: string;
    pages?: number;
    warnings?: string[];
  };
}

export interface DocumentParser {
  type: SupportedDocumentType;
  parse(fileBuffer: Buffer): Promise<ParsedDocument>;
}
