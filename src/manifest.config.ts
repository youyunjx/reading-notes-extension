import { defineManifest } from '@crxjs/vite-plugin';
import pkg from '../package.json';

export default defineManifest({
  manifest_version: 3,
  name: 'Reading Notes',
  version: pkg.version,
  description: pkg.description,
  // sidePanel needs Chrome 114+; match_origin_as_fallback needs 119+.
  minimum_chrome_version: '119',
  // Pins a stable extension ID regardless of which folder it's loaded from, so
  // your saved notes (keyed by extension ID in chrome.storage.local) survive
  // reinstalling or moving the extension. The matching private key is in
  // .keys/extension-private-key.pem (gitignored) — keep it if you ever pack/publish.
  key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA1xQVO402XI6wh81QDoeRT0wzXxh+T2NEFwGEYBnG3D4dA5HZNEvSAu9y716X85u0HVk09ik5rvNda2XN03h6sk54wvJt6Up7QD26WDA7awzuGAGL5zBs0hqtnB+6aV3WsjtY0Dka7BfABiQBQ97lhFZ7GVAXkQfKrNZX28nuy6grpPWQ9MkH2ro7gX/laxQkFJGP7Bj8Hg8TSPwTYykLYVU+gYMXBHUZSwLscvviK/hQMpg4kfOb6EwDqUvhgQ+VSmp8RPiKZU6ahBC4d17dYbx46jcopjErkgRrXQ+HK5U/LsoD6uAlbsaR3sZSXP5ToxzJYrgTTA7WOjOA/JvLGwIDAQAB',
  icons: {
    16: 'icons/icon16.png',
    48: 'icons/icon48.png',
    128: 'icons/icon128.png',
  },
  action: {
    default_title: 'Open Reading Notes',
    default_icon: {
      16: 'icons/icon16.png',
      48: 'icons/icon48.png',
      128: 'icons/icon128.png',
    },
  },
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  content_scripts: [
    {
      matches: ['<all_urls>'],
      js: ['src/content/index.tsx'],
      run_at: 'document_idle',
      // Also run inside iframes so text selected in embedded content (readers,
      // article frames, etc.) is captured. On sites that disable text
      // selection/copy the selection is simply empty, so we stay inactive.
      all_frames: true,
      match_about_blank: true,
      // Many e-book readers (epub.js and friends) render each chapter inside an
      // iframe whose URL is blob:/data:/about:srcdoc. Those opaque-origin frames
      // are NOT covered by `<all_urls>` + all_frames alone; this flag injects the
      // content script into them based on the initiating page's origin.
      // (Valid MV3 key since Chrome 119; not yet in the crxjs manifest types,
      // hence the spread.)
      ...({ match_origin_as_fallback: true } as object),
    },
  ],
  side_panel: {
    default_path: 'src/sidepanel/index.html',
  },
  permissions: ['storage', 'activeTab', 'contextMenus', 'sidePanel', 'downloads'],
});
