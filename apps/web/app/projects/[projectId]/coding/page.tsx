'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { TopNav } from '@/components/top-nav';
import { apiUrl } from '@/lib/api';

interface Document {
  id: string;
  title: string;
  plainText: string;
  sourceType: string;
  createdAt: string;
}

interface Code {
  id: string;
  name: string;
  description?: string;
}

interface Coding {
  id: string;
  codeId: string;
  snippet: string;
  startIndex: number;
  endIndex: number;
  description?: string;
  createdAt: string;
  code?: { name: string; description?: string };
}

export default function CodingPage() {
  return (
    <Suspense fallback={<CodingFallback />}>
      <CodingWorkspace />
    </Suspense>
  );
}

function CodingFallback() {
  return (
    <main>
      <TopNav />
      <section className="coding-workspace">
        <p>Loading coding workspace...</p>
      </section>
    </main>
  );
}

function CodingWorkspace() {
  const params = useParams();
  const searchParams = useSearchParams();
  const projectId = params.projectId as string;
  const requestedDocumentId = searchParams.get('documentId');

  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocId, setSelectedDocId] = useState('');
  const [codes, setCodes] = useState<Code[]>([]);
  const [codings, setCodings] = useState<Coding[]>([]);
  const [codeName, setCodeName] = useState('');
  const [codeDescription, setCodeDescription] = useState('');
  const [editingCodingId, setEditingCodingId] = useState<string | null>(null);
  const [editingCodeName, setEditingCodeName] = useState('');
  const [editingCodeDescription, setEditingCodeDescription] = useState('');
  const [selection, setSelection] = useState<{ start: number; end: number; snippet: string } | null>(null);
  const [isMobileCodingSheetOpen, setIsMobileCodingSheetOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingCoding, setIsSavingCoding] = useState(false);
  const [error, setError] = useState('');
  const documentTextRef = useRef<HTMLDivElement | null>(null);
  const selectionReadTimerRef = useRef<number | null>(null);

  const selectedDoc = useMemo(
    () => documents.find((doc) => doc.id === selectedDocId) ?? null,
    [documents, selectedDocId]
  );
  const isImportedCodesDocument = selectedDoc?.sourceType === 'IMPORTED_CODES';
  const codeColorMap = useMemo(() => {
    const colors = [
      '#fef08a',
      '#bbf7d0',
      '#bfdbfe',
      '#fecdd3',
      '#ddd6fe',
      '#fed7aa',
      '#a7f3d0',
      '#fbcfe8',
      '#bae6fd',
      '#fde68a'
    ];

    return new Map(
      codes.map((code) => {
        const hash = [...code.id].reduce((value, character) => value + character.charCodeAt(0), 0);
        return [code.id, colors[hash % colors.length]];
      })
    );
  }, [codes]);
  const codeSuggestions = useMemo(() => {
    const search = codeName.trim().toLowerCase();
    return codes
      .filter((code) => !search || code.name.toLowerCase().includes(search))
      .slice(0, 6);
  }, [codeName, codes]);

  const highlightedText = useMemo(() => {
    if (!selectedDoc) return [];
    if (selectedDoc.sourceType === 'IMPORTED_CODES') return [{ text: 'Imported codes only' }];

    const sortedCodings = [...codings]
      .filter((coding) => coding.startIndex < coding.endIndex)
      .sort((a, b) => a.startIndex - b.startIndex);

    const parts: Array<{ text: string; coding?: Coding }> = [];
    let cursor = 0;

    for (const coding of sortedCodings) {
      const start = Math.max(0, Math.min(coding.startIndex, selectedDoc.plainText.length));
      const end = Math.max(start, Math.min(coding.endIndex, selectedDoc.plainText.length));

      if (start < cursor || start === end) continue;

      if (start > cursor) {
        parts.push({ text: selectedDoc.plainText.slice(cursor, start) });
      }

      parts.push({ text: selectedDoc.plainText.slice(start, end), coding });
      cursor = end;
    }

    if (cursor < selectedDoc.plainText.length) {
      parts.push({ text: selectedDoc.plainText.slice(cursor) });
    }

    return parts.length > 0 ? parts : [{ text: selectedDoc.plainText }];
  }, [codings, selectedDoc]);

  useEffect(() => {
    fetchDocuments();
    fetchCodes();
  }, [projectId]);

  useEffect(() => {
    if (!selectedDocId) {
      setCodings([]);
      setSelection(null);
      return;
    }

    fetchCodings(selectedDocId);
  }, [selectedDocId]);

  const fetchDocuments = async () => {
    try {
      setIsLoading(true);
      setError('');
      const token = localStorage.getItem('accessToken');
      const res = await fetch(apiUrl(`/projects/${projectId}/documents`), {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) throw new Error('Failed to fetch documents');
      const data: Document[] = await res.json();
      setDocuments(data);

      const requestedDoc = data.find((doc) => doc.id === requestedDocumentId);
      setSelectedDocId(requestedDoc?.id ?? data[0]?.id ?? '');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCodes = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(apiUrl(`/projects/${projectId}/codes`), {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) throw new Error('Failed to fetch codes');
      const data: Code[] = await res.json();
      setCodes(data);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const fetchCodings = async (documentId: string) => {
    try {
      setSelection(null);
      const token = localStorage.getItem('accessToken');
      const res = await fetch(apiUrl(`/projects/${projectId}/documents/${documentId}/codings`), {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) throw new Error('Failed to fetch codings');
      const data = await res.json();
      setCodings(data);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const findMatchingCode = (name: string, description: string) =>
    codes.find(
      (code) =>
        code.name.trim().toLowerCase() === name.trim().toLowerCase() &&
        (code.description ?? '').trim().toLowerCase() === description.trim().toLowerCase()
    );

  const createCode = async (name: string, description: string) => {
    const matchingCode = findMatchingCode(name, description);
    if (matchingCode) return matchingCode.id;

    const token = localStorage.getItem('accessToken');
    const res = await fetch(apiUrl(`/projects/${projectId}/codes`), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        name: name.trim(),
        description: description.trim() || undefined
      })
    });

    if (!res.ok) throw new Error('Failed to create code');
    const createdCode: Code = await res.json();
    setCodes((prev) => [createdCode, ...prev]);
    return createdCode.id;
  };

  const handleCreateCoding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDoc || isImportedCodesDocument || !selection || !selection.snippet.trim()) return;
    if (!codeName.trim()) return;

    try {
      setIsSavingCoding(true);
      setError('');
      const codeId = await createCode(codeName, codeDescription);
      const token = localStorage.getItem('accessToken');
      const res = await fetch(apiUrl(`/projects/${projectId}/documents/${selectedDoc.id}/codings`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          codeId,
          snippet: selection.snippet,
          startIndex: selection.start,
          endIndex: selection.end
        })
      });

      if (!res.ok) throw new Error('Failed to create coding');
      const createdCoding = await res.json();
      setCodings((prev) => [createdCoding, ...prev]);
      setSelection(null);
      setIsMobileCodingSheetOpen(false);
      setCodeName('');
      setCodeDescription('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsSavingCoding(false);
    }
  };

  const handleEditCoding = (coding: Coding) => {
    setEditingCodingId(coding.id);
    setEditingCodeName(coding.code?.name ?? '');
    setEditingCodeDescription(coding.code?.description ?? '');
  };

  const handleUpdateCoding = async (coding: Coding) => {
    if (!selectedDoc || !editingCodeName.trim()) return;

    try {
      setError('');
      const codeId = await createCode(editingCodeName, editingCodeDescription);
      const token = localStorage.getItem('accessToken');
      const res = await fetch(apiUrl(`/projects/${projectId}/documents/${selectedDoc.id}/codings/${coding.id}`), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ codeId })
      });

      if (!res.ok) throw new Error('Failed to update coding');
      const updatedCoding = await res.json();
      setCodings((prev) => prev.map((item) => (item.id === coding.id ? updatedCoding : item)));
      setEditingCodingId(null);
      setEditingCodeName('');
      setEditingCodeDescription('');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleDeleteCoding = async (codingId: string) => {
    if (!selectedDoc) return;

    try {
      setError('');
      const token = localStorage.getItem('accessToken');
      const res = await fetch(apiUrl(`/projects/${projectId}/documents/${selectedDoc.id}/codings/${codingId}`), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) throw new Error('Failed to delete coding');
      setCodings((prev) => prev.filter((coding) => coding.id !== codingId));
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const applyCodeSuggestion = (code: Code) => {
    setCodeName(code.name);
    setCodeDescription(code.description ?? '');
  };

  const renderAssignmentForm = (variant: 'desktop' | 'mobile') => (
    <form onSubmit={handleCreateCoding} className="panel-form">
      <div className="selection-card-header">
        <h3>Assign Selection</h3>
        {variant === 'mobile' && (
          <button type="button" className="ghost-button" onClick={() => setIsMobileCodingSheetOpen(false)}>
            Close
          </button>
        )}
      </div>

      <blockquote>{selection?.snippet}</blockquote>

      <label className="panel-label">
        Code name
        <input
          type="text"
          placeholder="Start typing a code..."
          value={codeName}
          onChange={(event) => setCodeName(event.target.value)}
          autoFocus={variant === 'desktop'}
        />
      </label>

      {codeSuggestions.length > 0 && (
        <div className="suggestion-list">
          {codeSuggestions.map((code) => (
            <button type="button" key={code.id} onClick={() => applyCodeSuggestion(code)}>
              <strong>{code.name}</strong>
              {code.description && <span>{code.description}</span>}
            </button>
          ))}
        </div>
      )}

      <label className="panel-label">
        Code description
        <textarea
          placeholder="What should this code mean in this context?"
          value={codeDescription}
          onChange={(event) => setCodeDescription(event.target.value)}
          rows={3}
        />
      </label>

      <button
        type="submit"
        disabled={isSavingCoding || !codeName.trim()}
      >
        {isSavingCoding ? 'Saving...' : 'Save Coding'}
      </button>
    </form>
  );

  const getTextOffset = useCallback((container: HTMLElement, node: Node, offset: number) => {
    const range = document.createRange();
    range.selectNodeContents(container);
    range.setEnd(node, offset);
    return range.toString().length;
  }, []);

  const handleTextSelection = useCallback((clearWhenEmpty = true) => {
    const container = documentTextRef.current;
    const browserSelection = window.getSelection();

    if (!container || !browserSelection || browserSelection.rangeCount === 0) {
      if (clearWhenEmpty) setSelection(null);
      return;
    }

    const range = browserSelection.getRangeAt(0);
    if (!container.contains(range.startContainer) || !container.contains(range.endContainer)) {
      return;
    }

    const start = getTextOffset(container, range.startContainer, range.startOffset);
    const end = getTextOffset(container, range.endContainer, range.endOffset);
    const normalizedStart = Math.min(start, end);
    const normalizedEnd = Math.max(start, end);

    if (normalizedStart === normalizedEnd || !selectedDoc || isImportedCodesDocument) {
      if (clearWhenEmpty) setSelection(null);
      return;
    }

    setSelection({
      start: normalizedStart,
      end: normalizedEnd,
      snippet: selectedDoc.plainText.slice(normalizedStart, normalizedEnd)
    });
    setIsMobileCodingSheetOpen(false);
    setError('');
  }, [getTextOffset, isImportedCodesDocument, selectedDoc]);

  const scheduleTextSelectionRead = useCallback((delay = 120) => {
    if (selectionReadTimerRef.current) {
      window.clearTimeout(selectionReadTimerRef.current);
    }

    selectionReadTimerRef.current = window.setTimeout(() => {
      handleTextSelection(false);
    }, delay);
  }, [handleTextSelection]);

  useEffect(() => {
    const handleSelectionChange = () => {
      scheduleTextSelectionRead(120);
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
      if (selectionReadTimerRef.current) {
        window.clearTimeout(selectionReadTimerRef.current);
      }
    };
  }, [scheduleTextSelectionRead]);

  return (
    <main>
      <TopNav />
      <section className="coding-workspace">
        <header className="coding-header">
          <div>
            <h2>Coding</h2>
            {selectedDoc && <p>{selectedDoc.title}</p>}
          </div>
          <select value={selectedDocId} onChange={(e) => setSelectedDocId(e.target.value)} disabled={documents.length === 0}>
            {documents.length === 0 ? (
              <option value="">No documents</option>
            ) : (
              documents.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.title}
                </option>
              ))
            )}
          </select>
        </header>

        {error && <p style={{ color: 'var(--accent-2)' }}>{error}</p>}

        {isLoading ? (
          <p>Loading coding workspace...</p>
        ) : !selectedDoc ? (
          <p style={{ color: 'var(--muted)' }}>Add a document before coding.</p>
        ) : (
          <div className="coding-grid">
            <article className="coding-document">
              <div
                className="coding-document-text"
                ref={documentTextRef}
                onMouseUp={() => {
                  if (!isImportedCodesDocument) scheduleTextSelectionRead(0);
                }}
                onPointerUp={() => {
                  if (!isImportedCodesDocument) scheduleTextSelectionRead(120);
                }}
                onTouchEnd={() => {
                  if (!isImportedCodesDocument) scheduleTextSelectionRead(350);
                }}
                onKeyUp={() => {
                  if (!isImportedCodesDocument) handleTextSelection();
                }}
                role="textbox"
                aria-readonly="true"
                tabIndex={0}
              >
                {highlightedText.map((part, index) =>
                  part.coding ? (
                    <mark
                      className="coding-highlight"
                      key={`${part.coding.id}-${index}`}
                      style={{ backgroundColor: codeColorMap.get(part.coding.codeId) ?? '#fef08a' }}
                      title={`${part.coding.code?.name ?? 'Code'}${part.coding.code?.description ? `: ${part.coding.code.description}` : ''}`}
                    >
                      {part.text}
                    </mark>
                  ) : (
                    <span key={`text-${index}`}>{part.text}</span>
                  )
                )}
              </div>
              <footer>
                {isImportedCodesDocument ? (
                  <span>Imported codes only. Review and analyze these excerpts in Data View.</span>
                ) : selection ? (
                  <span>
                    Selected chars: {selection.start} - {selection.end}
                  </span>
                ) : (
                  <span>Select text in the document to create a coding.</span>
                )}
              </footer>
            </article>

            <aside className="coding-panel">
              <section className="selection-card">
                {isImportedCodesDocument ? (
                  <>
                    <h3>Imported Codes</h3>
                    <p style={{ color: 'var(--muted)' }}>This document contains imported coded excerpts only.</p>
                  </>
                ) : selection ? renderAssignmentForm('desktop') : (
                  <>
                    <h3>Assign Selection</h3>
                    <p style={{ color: 'var(--muted)' }}>Select text in the document to code it.</p>
                  </>
                )}
              </section>

              <section>
                <h3>Latest Codings</h3>
                {codings.length === 0 ? (
                  <p style={{ color: 'var(--muted)' }}>No codings yet.</p>
                ) : (
                  <ol className="coding-list">
                    {codings.slice(0, 10).map((coding) => (
                      <li key={coding.id}>
                        {editingCodingId === coding.id ? (
                          <div className="coding-edit">
                            <input
                              type="text"
                              value={editingCodeName}
                              onChange={(event) => setEditingCodeName(event.target.value)}
                            />
                            <textarea
                              value={editingCodeDescription}
                              onChange={(event) => setEditingCodeDescription(event.target.value)}
                              rows={3}
                            />
                            <div className="inline-actions">
                              <button type="button" onClick={() => handleUpdateCoding(coding)}>
                                Save
                              </button>
                              <button type="button" onClick={() => setEditingCodingId(null)}>
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <strong>{coding.code?.name ?? 'Code'}</strong>
                            {coding.code?.description && <small>{coding.code.description}</small>}
                            <span>"{coding.snippet.slice(0, 90)}{coding.snippet.length > 90 ? '...' : ''}"</span>
                            <div className="inline-actions">
                              <button type="button" onClick={() => handleEditCoding(coding)}>
                                Edit
                              </button>
                              <button type="button" onClick={() => handleDeleteCoding(coding.id)}>
                                Delete
                              </button>
                            </div>
                          </>
                        )}
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            </aside>

            {selection && !isMobileCodingSheetOpen && (
              <button
                type="button"
                className="mobile-code-selection-button"
                onClick={() => setIsMobileCodingSheetOpen(true)}
              >
                Code selection
              </button>
            )}

            {selection && isMobileCodingSheetOpen && (
              <div className="mobile-coding-sheet" role="dialog" aria-modal="true" aria-label="Assign selected text">
                <button
                  type="button"
                  className="mobile-coding-backdrop"
                  aria-label="Close coding form"
                  onClick={() => setIsMobileCodingSheetOpen(false)}
                />
                <section className="selection-card mobile-coding-card">
                  {renderAssignmentForm('mobile')}
                </section>
              </div>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
