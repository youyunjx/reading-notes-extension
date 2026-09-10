import { createRoot } from 'react-dom/client';
import { ContentApp } from './ContentApp';

// Mount the UI inside a shadow root so the host page's CSS can never affect it
// (and vice-versa). A single host element carries both the floating button and
// the composer card.
const HOST_ID = 'jot-root';

function mount() {
  if (document.getElementById(HOST_ID)) return;

  const host = document.createElement('div');
  host.id = HOST_ID;
  // Keep the host itself out of the page layout; children use position: fixed.
  host.style.all = 'initial';
  host.style.position = 'fixed';
  host.style.top = '0';
  host.style.left = '0';
  host.style.zIndex = '2147483647';
  document.documentElement.appendChild(host);

  const shadow = host.attachShadow({ mode: 'open' });
  const container = document.createElement('div');
  shadow.appendChild(container);

  createRoot(container).render(<ContentApp />);
}

mount();
