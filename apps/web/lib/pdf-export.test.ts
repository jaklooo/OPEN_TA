import { afterEach, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { jsPDF } from 'jspdf';
import { exportTablePdf, exportReportPdf } from './pdf-export';
const require = createRequire(import.meta.url);
const { PDFParse } = require('pdf-parse');
afterEach(() => vi.restoreAllMocks());
it('exports every row and column across pages with Czech diacritics', async () => {
  const font = readFileSync(new URL('../public/fonts/NotoSans-Regular.ttf', import.meta.url));
  vi.stubGlobal('fetch', vi.fn(async () => new Response(font)));
  let result: ArrayBuffer | undefined;
  const api = jsPDF.API as typeof jsPDF.API & { save?: (this: jsPDF) => jsPDF };
  const originalSave = api.save;
  api.save = function (this: jsPDF) { result = this.output('arraybuffer'); return this; };
  try {
    const headers = ['Téma', ...Array.from({ length: 9 }, (_, i) => `Výzkum – rok ${2020 + i}`)];
    const rows = Array.from({ length: 100 }, (_, i) => [`Příliš žluťoučký kůň ${i}`, ...Array.from({ length: 9 }, (_, j) => `${i}:${j}`)]);
    await exportTablePdf('Přehled témat', headers, rows, 'test.pdf');
    const parser = new PDFParse({ data: new Uint8Array(result!) });
    const parsed = await parser.getText();
    expect(parsed.total).toBeGreaterThan(2);
    expect(parsed.text).toContain('Příliš žluťoučký kůň 99');
    expect(parsed.text).toContain('99:8');
    expect(parsed.text).toContain('Výzkum – rok 2028');
    await parser.destroy();
    await exportReportPdf([{ name: 'Důvěra ve školu', codes: [], reportContent: 'Řešení příčin a důsledků. '.repeat(500) }]);
    const report = new PDFParse({ data: new Uint8Array(result!) });
    const reportText = await report.getText();
    expect(reportText.total).toBeGreaterThan(2);
    expect(reportText.text).toContain('Důvěra ve školu');
    expect(reportText.text).toContain('Řešení příčin');
    await report.destroy();
  } finally { if (originalSave) api.save = originalSave; else delete api.save; vi.unstubAllGlobals(); }
});
