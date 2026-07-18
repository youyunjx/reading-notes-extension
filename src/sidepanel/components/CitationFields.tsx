import type { Citation, SavedSource } from '../../lib/types';
import { applySourceToCitation, citationHasData, sourceLabel } from '../../lib/citation';

interface Props {
  citation: Citation;
  onChange: (citation: Citation) => void;
  sources: SavedSource[];
  onSaveSource: (citation: Citation) => void;
  /** Whether the collapsible section starts open. */
  defaultOpen?: boolean;
}

interface FieldDef {
  key: keyof Citation;
  label: string;
  placeholder?: string;
  wide?: boolean;
}

const FIELDS: FieldDef[] = [
  { key: 'author', label: 'Author' },
  { key: 'editor', label: 'Editor' },
  { key: 'bookName', label: 'Book name', wide: true },
  { key: 'chapter', label: 'Chapter' },
  { key: 'page', label: 'Page' },
  { key: 'publisher', label: 'Publisher' },
  { key: 'year', label: 'Year' },
];

/**
 * Bibliographic citation editor: a dropdown to apply a previously saved source
 * (fills the book-level fields), the seven inputs, and a button to save the
 * current book details for reuse.
 */
export function CitationFields({
  citation,
  onChange,
  sources,
  onSaveSource,
  defaultOpen,
}: Props) {
  function setField(key: keyof Citation, value: string) {
    onChange({ ...citation, [key]: value });
  }

  function handleApply(id: string) {
    const source = sources.find((s) => s.id === id);
    if (source) onChange(applySourceToCitation(citation, source.citation));
  }

  const hasData = citationHasData(citation);

  return (
    <details className="citation" open={defaultOpen || hasData}>
      <summary>
        📚 Source details{hasData ? '' : ' (author, book, page…)'}
      </summary>

      <div className="citation-body">
        {sources.length > 0 && (
          <label className="citation-apply">
            <span>Reuse a saved source</span>
            <select
              value=""
              onChange={(e) => {
                handleApply(e.target.value);
                e.target.value = '';
              }}
            >
              <option value="">Choose a book…</option>
              {sources.map((s) => (
                <option key={s.id} value={s.id}>
                  {sourceLabel(s.citation)}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="citation-grid">
          {FIELDS.map((f) => (
            <label
              key={f.key}
              className={`citation-field${f.wide ? ' wide' : ''}`}
            >
              <span>{f.label}</span>
              <input
                type="text"
                value={citation[f.key]}
                onChange={(e) => setField(f.key, e.target.value)}
                placeholder={f.placeholder}
              />
            </label>
          ))}
        </div>

        <button
          type="button"
          className="citation-save-source"
          onClick={() => onSaveSource(citation)}
          disabled={!citation.bookName.trim() && !citation.author.trim()}
          title="Save the author/book/publisher/year so you can reuse it in other notes"
        >
          💾 Save book for reuse
        </button>
      </div>
    </details>
  );
}
