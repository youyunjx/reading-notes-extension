import { useEffect, useRef, useState } from 'react';

interface SourceOption {
  key: string;
  label: string;
  count: number;
}

interface Props {
  options: SourceOption[];
  selected: string[];
  onToggle: (key: string) => void;
  onClear: () => void;
}

/**
 * Multi-select source filter as a dropdown of checkboxes. No boxes checked means
 * "show all sources"; checking one or more narrows to just those.
 */
export function SourceFilter({ options, selected, onToggle, onClear }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDocMouseDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const summary =
    selected.length === 0
      ? 'All sources'
      : selected.length === 1
        ? options.find((o) => o.key === selected[0])?.label ?? '1 source'
        : `${selected.length} sources selected`;

  return (
    <div className="source-filter" ref={ref}>
      <button
        type="button"
        className="source-filter-button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="source-filter-summary">🔖 {summary}</span>
        <span className="source-filter-caret" aria-hidden>
          ▾
        </span>
      </button>

      {open && (
        <div className="source-filter-menu" role="listbox">
          <div className="source-filter-menu-head">
            <span>Filter by source</span>
            {selected.length > 0 && (
              <button type="button" className="source-filter-clear" onClick={onClear}>
                Clear
              </button>
            )}
          </div>
          <div className="source-filter-options">
            {options.map((o) => (
              <label key={o.key} className="source-filter-option" title={o.label}>
                <input
                  type="checkbox"
                  checked={selected.includes(o.key)}
                  onChange={() => onToggle(o.key)}
                />
                <span className="source-filter-option-label">{o.label}</span>
                <span className="source-filter-option-count">{o.count}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
