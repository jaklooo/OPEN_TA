import { DocumentParser, ParsedDocument } from './document-parser.interface.js';

export class TxtParser implements DocumentParser {
  readonly type = 'TXT' as const;

  async parse(fileBuffer: Buffer): Promise<ParsedDocument> {
    const plainText = fileBuffer.toString('utf-8').replace(/\r\n/g, '\n').trim();

    return {
      plainText,
      metadata: {
        sourceType: 'TXT'
      }
    };
  }
}
