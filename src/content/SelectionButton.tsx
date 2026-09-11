interface Props {
  anchor: { x: number; y: number };
  onClick: () => void;
}

/** Small floating "Add note" affordance shown just below a text selection. */
export function SelectionButton({ anchor, onClick }: Props) {
  const left = Math.min(Math.max(anchor.x, 8), window.innerWidth - 130);
  const top = Math.min(anchor.y + 8, window.innerHeight - 44);

  return (
    <button
      onMouseDown={(e) => {
        // Prevent the button from stealing focus / clearing the selection.
        e.preventDefault();
      }}
      onClick={onClick}
      style={{
        position: 'fixed',
        left,
        top,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '7px 12px',
        background: '#2B6FCF',
        color: '#fff',
        border: 'none',
        borderRadius: 8,
        fontFamily: 'system-ui, sans-serif',
        fontSize: 13,
        fontWeight: 600,
        cursor: 'pointer',
        boxShadow: '0 4px 14px rgba(43,111,207,0.35)',
        zIndex: 2147483647,
      }}
    >
      <span aria-hidden style={{ fontSize: 14, lineHeight: 1 }}>
        ✎
      </span>
      Add note
    </button>
  );
}
