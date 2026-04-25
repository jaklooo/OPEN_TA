import { PDFParse } from 'pdf-parse';
import { DocumentParser, ParsedDocument } from './document-parser.interface.js';

export class PdfParser implements DocumentParser {
  readonly type = 'PDF' as const;

  async parse(fileBuffer: Buffer): Promise<ParsedDocument> {
    const parser = new PDFParse({ data: fileBuffer });
    try {
      const parsed = await parser.getText();
      const info = await parser.getInfo();
      const plainText = parsed.text.replace(/\r\n/g, '\n').trim();

      if (!plainText) {
        throw new Error('No text could be extracted from PDF file');
      }

      return {
        plainText,
        metadata: {
          sourceType: 'PDF',
          pages: info.total
        }
      };
    } finally {
      await parser.destroy();
    }
  }
}
