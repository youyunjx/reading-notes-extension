# Reading Notes — Chrome Extension

Take reading notes as you browse: **select any text → add your insight → save it with its
source**. Everything is stored locally on your machine and browsed from a side panel.

- **Select & capture** — highlight text on any page (with the mouse or the keyboard) and a
  floating **Add note** button appears. Works inside embedded frames too, and on any site
  that allows text selection/copy. On sites that deliberately disable selection/copy there
  is nothing to capture, so the button stays hidden — the extension never bypasses those
  restrictions.
- **Add your insight** — type your own words in an inline composer (⌘/Ctrl + Enter to save).
- **Records the source** — each note keeps the page title, URL, and favicon.
- **Bibliographic citations** — attach author, editor, book name, chapter, page, publisher,
  and year to any note. **Save a book once and reuse it**: pick it from the “Reuse a saved
  source” dropdown to auto-fill the book-level fields on later notes (just update chapter/page).
- **Browse & manage** — a side panel lists all notes grouped by source, with search,
  edit, and delete. Click a source to reopen the page.
- **Export to CSV** — one click writes all notes (including citation columns) to a CSV file
  and opens its folder.
- **Local & private** — data lives in `chrome.storage.local`; no account, no backend.

## Safety & offline guarantee

This extension runs **fully offline** and never sends your data anywhere:

- **No network calls in the shipped code** — no `fetch`, `XMLHttpRequest`, `WebSocket`, or
  `sendBeacon`. React is bundled locally; Vite's module-preload `fetch` polyfill is disabled
  (`build.modulePreload: false`). The only external URL in the bundle is React's
  error-decoder link (`reactjs.org`), which is a static string in an error message and is
  never requested.
- **No external resources** — no CDNs, web fonts, or remote images. Source favicons are
  rendered as local letter-avatars rather than fetched from the source site (fetching them
  would require network and would leak to those sites that you're reviewing the note).
- **On-device storage only** — `chrome.storage.local`, never `chrome.storage.sync`, so
  notes never leave your machine.
- **Minimal permissions** — `storage`, `activeTab`, `contextMenus`, `sidePanel`. There are
  **no** `host_permissions`, **no** `externally_connectable`, and no relaxed
  `content_security_policy`, so Chrome's default strict MV3 CSP applies (remote code and
  `eval` are blocked).
- The content script runs on all pages only so it can detect text selections; it reads the
  selection, page title, and URL locally and passes them to the extension's own background
  worker — nothing is transmitted off-device.

The only outbound navigation happens when **you click a source link** in the side panel,
which opens that page in a new tab — an explicit, user-initiated action.

## Tech stack

TypeScript · React 18 · Vite · `@crxjs/vite-plugin` · Manifest V3.

## Install on Windows — step by step (from scratch)

No coding experience needed. This takes about 10 minutes. You'll install two things
(Google Chrome and Node.js), run two commands to build the extension, then load it into
Chrome. Follow the steps in order.

### Step 1 — Install Google Chrome

If you don't already have Chrome, download and install it from
<https://www.google.com/chrome/>. (Microsoft Edge also works — see the note at the end.)

### Step 2 — Install Node.js

Node.js is the tool that builds the extension.

1. Go to <https://nodejs.org/>.
2. Click the big button that says **"LTS"** (Long Term Support) — this downloads a file
   like `node-v20.x.x-x64.msi`.
3. Double-click the downloaded `.msi` file and click **Next → Next → Install**, accepting
   all the defaults. When it finishes, click **Finish**.
4. **Verify it worked:** press the **Windows key**, type `cmd`, and press **Enter** to open
   a black **Command Prompt** window. Type this and press Enter:

   ```
   node -v
   ```

   You should see a version number like `v20.11.1`. If you do, Node.js is installed. If you
   get an error, restart your PC and try again (Windows sometimes needs a restart to pick up
   the new program).

### Step 3 — Get the project folder onto your PC

You need the project folder (the one containing `package.json`) somewhere easy to find.

- If you already have it (for example at `D:\Project\chrome-based_note_taking`), you're set —
  just note that location.
- If someone sent it to you as a **.zip** file: right-click the zip → **Extract All…** →
  choose a simple location like `C:\reading-notes` → **Extract**.

For the rest of this guide we'll assume the folder is at `C:\reading-notes`. Substitute your
actual path wherever you see it.

### Step 4 — Open a command window inside that folder

1. Open **File Explorer** and navigate into the project folder (the one that contains
   `package.json`).
2. Click the **address bar** at the top (the strip showing the folder path) so the path
   becomes highlighted/editable.
3. Type `cmd` and press **Enter**.

A black Command Prompt window opens, already pointing at your project folder. (You can
confirm — the text before the blinking cursor should show your folder path.)

### Step 5 — Install the extension's building blocks

In that Command Prompt window, type this and press **Enter**:

```
npm install
```

This downloads the libraries the project needs. It runs for a minute or two and prints a
lot of text — that's normal. Wait until you get the blinking cursor back on a fresh line.
(A warning about "vulnerabilities" is safe to ignore for this local, offline tool.)

### Step 6 — Build the extension

Now type this and press **Enter**:

```
npm run build
```

When it finishes you'll see a line like `✓ built in 900ms`. This creates a new **`dist`**
folder inside your project — that's the finished extension.

### Step 7 — Load it into Chrome

1. Open Chrome. In the address bar type `chrome://extensions` and press **Enter**.
2. In the **top-right corner**, turn on the **Developer mode** switch.
3. Three buttons appear on the left. Click **Load unpacked**.
4. A folder picker opens. Navigate into your project folder and select the **`dist`** folder
   (the one created in Step 6), then click **Select Folder**.
5. **Reading Notes** now appears in your extensions list. 🎉

### Step 8 — Pin it and try it out

1. Click the **puzzle-piece icon** 🧩 near the top-right of Chrome.
2. Find **Reading Notes** and click the **pin** icon next to it so it stays on your toolbar.
3. Go to any article, **select some text**, click the **✎ Add note** button that pops up,
   type your thought, and save.
4. Click the **Reading Notes toolbar icon** to open the side panel and see your note.

That's it — you're taking reading notes. Your notes are stored on this PC only.

### Troubleshooting

- **`'npm' is not recognized…`** — Node.js isn't installed or the terminal was open before
  you installed it. Close the Command Prompt, then redo Step 2 (or restart your PC) and open
  a fresh Command Prompt.
- **The `dist` folder isn't there** — Step 6 didn't finish successfully. Re-run
  `npm run build` and read the last lines for an error message.
- **"Load unpacked" is greyed out / missing** — you didn't turn on **Developer mode**
  (Step 7.2).
- **I updated the code and want the new version** — run `npm run build` again, then on
  `chrome://extensions` click the **circular refresh arrow** on the Reading Notes card.

### Using Microsoft Edge instead

Edge is built on the same engine, so the same `dist` folder works. Open `edge://extensions`,
turn on **Developer mode** (bottom-left), click **Load unpacked**, and pick the `dist`
folder.

---

## For developers

```bash
npm install
npm run build      # type-checks, then builds to dist/
npm run dev        # dev server with hot-reload; load dist/ as unpacked
```

Icons are pre-generated in `public/icons/`. To regenerate the placeholder icons:

```bash
node scripts/generate-icons.mjs
```

## How to use

1. On any article, **select some text**. A small **✎ Add note** button appears.
2. Click it, type your insight, and press **Save note** (or ⌘/Ctrl + Enter).
3. Click the toolbar icon to open the **side panel** and review all your notes.
4. You can also **right-click a selection → “Save selection as reading note”**. The side
   panel opens with a **New note** form — your quote is already filled in and the cursor is
   in the insight box, so you can type your thoughts and **Save** right away. This path works
   even on pages where the floating button can't appear.

### Adding book/citation details

In the **New note** form (and when you **Edit** an existing note), expand **📚 Source details**
to fill in author, editor, book name, chapter, page, publisher, and year.

To avoid retyping the same book on every note:

1. Fill in a book's details once, then click **💾 Save book for reuse**.
2. On later notes, open the **Reuse a saved source** dropdown and pick the book — its
   author/editor/book name/publisher/year fill in automatically. Just set the chapter/page
   for that particular note.

Saved books are also available from the floating composer's **📚 Attach a saved source**
dropdown, so you can cite while capturing on ordinary pages too.

## Project structure

```
src/
  manifest.config.ts     MV3 manifest (typed)
  lib/
    types.ts             Note / NoteSource data model
    storage.ts           chrome.storage.local CRUD + change subscription
    messages.ts          typed runtime messages
  background/index.ts     context menu, side-panel behavior, message routing
  content/                selection button + shadow-DOM composer (React)
  sidepanel/              notes browser UI (React): list, search, edit, delete
scripts/generate-icons.mjs  placeholder icon generator
```

## Storage model

Notes are stored under the `notes` key in `chrome.storage.local`; reusable book citations
live under the `sources` key.

```ts
interface Note {
  id: string;
  quote: string;        // the selected text
  insight: string;      // your own words
  source: { url: string; title: string; faviconUrl?: string };
  citation?: {          // optional bibliographic details
    author: string; editor: string; bookName: string;
    chapter: string; page: string; publisher: string; year: string;
  };
  createdAt: number;
  updatedAt: number;
}

// Reusable book-level citation (chapter/page left blank), stored under `sources`.
interface SavedSource {
  id: string;
  citation: Citation;   // same shape as Note.citation
  createdAt: number;
}
```

## Not included yet (possible next steps)

- Re-highlighting saved passages when you revisit a page (needs text anchoring).
- Export/import (Markdown / JSON).
- Cloud sync across devices.
- Tags, folders, and rich-text insights.
