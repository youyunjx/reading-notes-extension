interface Props {
  variant: 'no-notes' | 'no-results';
  query?: string;
}

export function EmptyState({ variant, query }: Props) {
  if (variant === 'no-results') {
    return (
      <div className="empty-state">
        <div className="emoji" aria-hidden>
          🔍
        </div>
        <h2>No matches</h2>
        <p>
          Nothing found for “{query}”. Try a different word.
        </p>
      </div>
    );
  }

  return (
    <div className="empty-state">
      <div className="emoji" aria-hidden>
        ✍️
      </div>
      <h2>No notes yet</h2>
      <p>
        Select text on any web page, click <strong>Add note</strong>, and jot down your
        insight. Your notes will appear here with their source.
      </p>
    </div>
  );
}
