import { useState } from 'react';
import type { Citation, Note, SavedSource } from '../../lib/types';
import { emptyCitation, formatCitation } from '../../lib/citation';
import { CitationFields } from './CitationFields';

interface Props {
  note: Note;
  sources: SavedSource[];
  /** DOM id for scroll-to-note targeting. */
  domId?: string;
  /** Briefly highlight the card (e.g. when focused from an on-page marker). */
  flash?: boolean;
  onDelete: (id: string) => void;
  onSaveEdit: (
    id: string,
    insight: string,
    quote: string,
    citation: Citation,
  ) => void;
  onSaveSource: (citation: Citation) => void;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function NoteCard({
  note,
  sources,
  domId,
  flash,
  onDelete,
  onSaveEdit,
  onSaveSource,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [insight, setInsight] = useState(note.insight);
  const [quote, setQuote] = useState(note.quote);
  const [citation, setCitation] = useState<Citation>(
    note.citation ?? emptyCitation(),
  );
  const [confirming, setConfirming] = useState(false);

  function save() {
    onSaveEdit(note.id, insight, quote, citation);
    setEditing(false);
  }

  function cancel() {
    setInsight(note.insight);
    setQuote(note.quote);
    setCitation(note.citation ?? emptyCitation());
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="note">
        <label style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700 }}>QUOTE</label>
        <textarea
          value={quote}
          onChange={(e) => setQuote(e.target.value)}
          rows={2}
          style={{ marginTop: 4, marginBottom: 8 }}
        />
        <label style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700 }}>INSIGHT</label>
        <textarea
          value={insight}
          onChange={(e) => setInsight(e.target.value)}
          rows={4}
          autoFocus
          style={{ marginTop: 4, marginBottom: 8 }}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') save();
            if (e.key === 'Escape') cancel();
          }}
        />
        <CitationFields
          citation={citation}
          onChange={setCitation}
          sources={sources}
          onSaveSource={onSaveSource}
        />
        <div className="edit-actions">
          <button className="btn" onClick={cancel}>
            Cancel
          </button>
          <button className="btn primary" onClick={save}>
            Save
          </button>
        </div>
      </div>
    );
  }

  const citationText = note.citation ? formatCitation(note.citation) : '';

  return (
    <div className={`note${flash ? ' note--flash' : ''}`} id={domId}>
      <blockquote>{note.quote}</blockquote>
      <p className={`insight${note.insight ? '' : ' empty'}`}>
        {note.insight || 'No insight yet — click Edit to add one.'}
      </p>
      {citationText && <p className="citation-line">📚 {citationText}</p>}
      <div className="note-footer">
        <span className="date">{formatDate(note.createdAt)}</span>
        <span className="spacer" />
        {confirming ? (
          <>
            <span className="date">Delete?</span>
            <button className="icon-btn danger" onClick={() => onDelete(note.id)}>
              Yes
            </button>
            <button className="icon-btn" onClick={() => setConfirming(false)}>
              No
            </button>
          </>
        ) : (
          <>
            <button className="icon-btn" onClick={() => setEditing(true)}>
              Edit
            </button>
            <button className="icon-btn danger" onClick={() => setConfirming(true)}>
              Delete
            </button>
          </>
        )}
      </div>
    </div>
  );
}
