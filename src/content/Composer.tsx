import { useEffect, useRef, useState } from 'react';
import type { Citation, SavedSource } from '../lib/types';
import type { RuntimeResponse } from '../lib/messages';
import { getSources } from '../lib/storage';
import { applySourceToCitation, citationHasData, emptyCitation, sourceLabel } from '../lib/citation';

interface Props {
  anchor: { x: number; y: number };
  quote: string;
  onSave: (insight: string, citation?: Citation) => Promise<RuntimeResponse>;
  onCancel: () => void;
}

const CARD_WIDTH = 320;

/** Inline card where the user types their insight for the selected quote. */
export function Composer({ anchor, quote, onSave, onCancel }: Props) {
  const [insight, setInsight] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sources, setSources] = useState<SavedSource[]>([]);
  const [citation, setCitation] = useState<Citation>(emptyCitation);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
    getSources().then(setSources);
  }, []);

  const left = Math.min(Math.max(anchor.x, 8), window.innerWidth - CARD_WIDTH - 8);
  const top = Math.min(anchor.y + 8, window.innerHeight - 300);

  function applySource(id: string) {
    const source = sources.find((s) => s.id === id);
    setCitation((prev) =>
      source ? applySourceToCitation(prev, source.citation) : emptyCitation(),
    );
  }

  async function submit() {
    if (saving) return;
    setSaving(true);
    setError(null);
    const res = await onSave(insight, citationHasData(citation) ? citation : undefined);
    // On success the composer is unmounted by the parent; only handle failure.
    if (!res.ok) {
      setSaving(false);
      setError(res.error || 'Could not save. Please try again.');
    }
  }

  const selectStyle: React.CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    marginTop: 10,
    padding: '7px 8px',
    border: '1px solid #d1d5db',
    borderRadius: 8,
    fontSize: 13,
    fontFamily: 'inherit',
    color: '#111827',
    background: '#fff',
  };

  return (
    <div
      onMouseDown={(e) => e.stopPropagation()}
      style={{
        position: 'fixed',
        left,
        top,
        width: CARD_WIDTH,
        background: '#ffffff',
        border: '1px solid #e5e7eb',
        borderRadius: 12,
        boxShadow: '0 10px 30px rgba(0,0,0,0.18)',
        fontFamily: 'system-ui, sans-serif',
        zIndex: 2147483647,
        overflow: 'hidden',
      }}
    >
      <div style={{ padding: '12px 14px' }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 0.4,
            textTransform: 'uppercase',
            color: '#6b7280',
            marginBottom: 6,
          }}
        >
          Selected text
        </div>
        <blockquote
          style={{
            margin: 0,
            padding: '8px 10px',
            background: '#f8fafc',
            borderLeft: '3px solid #2B6FCF',
            borderRadius: 4,
            fontSize: 13,
            lineHeight: 1.5,
            color: '#111827',
            maxHeight: 84,
            overflowY: 'auto',
          }}
        >
          {quote}
        </blockquote>

        <textarea
          ref={textareaRef}
          value={insight}
          onChange={(e) => setInsight(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') submit();
            if (e.key === 'Escape') onCancel();
          }}
          placeholder="Your insight… (⌘/Ctrl + Enter to save)"
          rows={4}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            marginTop: 10,
            padding: '8px 10px',
            border: '1px solid #d1d5db',
            borderRadius: 8,
            fontSize: 13,
            fontFamily: 'inherit',
            lineHeight: 1.5,
            resize: 'vertical',
            color: '#111827',
            outline: 'none',
          }}
        />

        {sources.length > 0 && (
          <select
            style={selectStyle}
            defaultValue=""
            onChange={(e) => applySource(e.target.value)}
            title="Attach a book you've already saved (manage sources in the side panel)"
          >
            <option value="">📚 Attach a saved source…</option>
            {sources.map((s) => (
              <option key={s.id} value={s.id}>
                {sourceLabel(s.citation)}
              </option>
            ))}
          </select>
        )}
        {citationHasData(citation) && (
          <div style={{ marginTop: 6, fontSize: 11, color: '#2B6FCF', fontWeight: 600 }}>
            ✓ {sourceLabel(citation)}
          </div>
        )}
        {error && (
          <div
            style={{
              marginTop: 8,
              padding: '6px 8px',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: 6,
              fontSize: 12,
              color: '#b91c1c',
            }}
          >
            {error}
          </div>
        )}
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 8,
          padding: '10px 14px',
          borderTop: '1px solid #f1f5f9',
          background: '#fafafa',
        }}
      >
        <button
          onClick={onCancel}
          style={{
            padding: '7px 12px',
            background: 'transparent',
            border: '1px solid #d1d5db',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 500,
            color: '#374151',
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
        <button
          onClick={submit}
          disabled={saving}
          style={{
            padding: '7px 14px',
            background: '#2B6FCF',
            border: 'none',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            color: '#fff',
            cursor: saving ? 'default' : 'pointer',
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? 'Saving…' : 'Save note'}
        </button>
      </div>
    </div>
  );
}
