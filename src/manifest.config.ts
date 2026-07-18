import { defineManifest } from '@crxjs/vite-plugin';
import pkg from '../package.json';

export default defineManifest({
  manifest_version: 3,
  name: 'Reading Notes',
  version: pkg.version,
  description: pkg.description,
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
