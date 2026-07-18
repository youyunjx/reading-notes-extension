import { useEffect, useRef, useState } from 'react';
import type { Citation, PendingCapture, SavedSource } from '../../lib/types';
import { emptyCitation } from '../../lib/citation';
import { CitationFields } from './CitationFields';

interface Props {
  capture: PendingCapture;
  sources: SavedSource[];
  onSave: (insight: string, citation: Citation) => void;
  onSaveSource: (citation: Citation) => void;
  onCancel: () => void;
}

/**
 * Compose form shown at the top of the side panel after a right-click capture.
 * The quote is already captured; the user adds their insight and (optionally)
 * bibliographic details, then saves.
 */
export function ComposeDraft({
  capture,
  sources,
  onSave,
  onSaveSource,
  onCancel,
}: Props) {
  const [insight, setInsight] = useState('');
  const [citation, setCitation] = useState<Citation>(emptyCitation);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, [capture.at]);

  const sourceLabelText = capture.source.title || capture.source.url;

  return (
    <div className="compose-draft">
      <div className="compose-title">✍️ New note</div>
      <blockquote>{capture.quote}</blockquote>
      <textarea
        ref={textareaRef}
        value={insight}
        onChange={(e) => setInsight(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') onSave(insight, citation);
          if (e.key === 'Escape') onCancel();
        }}
        placeholder="Your insight… (⌘/Ctrl + Enter to save)"
        rows={4}
      />

      <CitationFields
        citation={citation}
        onChange={setCitation}
        sources={sources}
        onSaveSource={onSaveSource}
      />

      {sourceLabelText && (
        <div className="compose-source" title={capture.source.url}>
          From: {sourceLabelText}
        </div>
      )}
      <div className="edit-actions">
        <button className="btn" onClick={onCancel}>
          Cancel
        </button>
        <button className="btn primary" onClick={() => onSave(insight, citation)}>
          Save note
        </button>
      </div>
    </div>
  );
}
