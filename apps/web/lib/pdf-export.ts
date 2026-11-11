import { t, getLocale } from './i18n';
async function createPdf(landscape = false) {
  const { jsPDF } = await import('jspdf');
  const response = await fetch('/fonts/NotoSans-Regular.ttf');
  if (!response.ok) throw new Error(t('Failed to load PDF font'));
  const bytes = new Uint8Array(await response.arrayBuffer());
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  const pdf = new jsPDF({ orientation: landscape ? 'landscape' : 'portrait' });
  pdf.addFileToVFS('NotoSans.ttf', btoa(binary));
  pdf.addFont('NotoSans.ttf', 'NotoSans', 'normal');
  pdf.setFont('NotoSans');
  pdf.setLanguage(getLocale());
  return pdf;
}
export async function exportTablePdf(title: string, headers: string[], rows: (string | number)[][], filename: string, note = '') {
  const [pdf, { autoTable }] = await Promise.all([createPdf(true), import('jspdf-autotable')]);
  pdf.setProperties({ title });
  pdf.setFontSize(15); pdf.text(title, 14, 16);
  pdf.setFontSize(9);
  const noteLines = pdf.splitTextToSize(note, 265);
  if (note) pdf.text(noteLines, 14, 23);
  autoTable(pdf, {
    head: [headers], body: rows, startY: 27 + noteLines.length * 4,
    styles: { font: 'NotoSans', fontStyle: 'normal', fontSize: 9, cellWidth: 45, overflow: 'linebreak' },
    headStyles: { fontStyle: 'normal', fillColor: [17, 94, 89] },
    columnStyles: { 0: { cellWidth: 60 } },
    horizontalPageBreak: true, horizontalPageBreakRepeat: 0, showHead: 'everyPage',
    margin: { top: 14, bottom: 18, left: 14, right: 14 }
  });
  for (let page = 1; page <= pdf.getNumberOfPages(); page++) {
    pdf.setPage(page); pdf.setFontSize(8); pdf.text(`${page} / ${pdf.getNumberOfPages()}`, 280, 202, { align: 'right' });
  }
  pdf.save(filename);
}
export async function exportReportPdf(themes: Array<{ name: string; codes: Array<{ name: string; excerpts?: Array<{ documentTitle: string }> }>; reportContent: string }>) {
  const pdf = await createPdf();
  const write = (text: string, size = 11) => {
    pdf.setFontSize(size);
    const lines: string[] = pdf.splitTextToSize(text, 180);
    for (const line of lines) { if (y > 278) { pdf.addPage(); y = 20; } pdf.text(line, 15, y); y += size * 0.5; }
    y += 4;
  };
  let y = 20;
  pdf.setProperties({ title: t('Thematic Analysis report') });
  write(t('Thematic Analysis report'), 18); write(t('List of themes'), 14);
  const toc: Array<{ page: number; y: number; index: number }> = [];
  themes.forEach((theme, index) => { if (y > 260) { pdf.addPage(); y = 20; } toc.push({ page: pdf.getNumberOfPages(), y, index }); write(`${index + 1}. ${theme.name}`); });
  const chapters: number[] = [];
  themes.forEach((theme, index) => {
    pdf.addPage(); y = 20; chapters.push(pdf.getNumberOfPages());
    write(`${index + 1}. ${theme.name}`, 16);
    write(`${t('Codes')}: ${theme.codes.map((code) => code.name).join(', ') || t('No codes')}`);
    const titles = [...new Set(theme.codes.flatMap((code) => code.excerpts?.map((excerpt) => excerpt.documentTitle) ?? []))];
    write(`${t('Source documents')}: ${titles.join(', ') || t('No documents')}`);
    write(theme.reportContent || t('No report text saved for this theme.'));
  });
  for (const entry of toc) { pdf.setPage(entry.page); pdf.link(15, entry.y - 4, 180, 6, { pageNumber: chapters[entry.index] }); }
  pdf.save('open-ta-report.pdf');
}
