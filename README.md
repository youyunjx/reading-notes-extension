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
- **On-page flag** — when you revisit a page you've already noted, a small "📖 N notes"
  badge appears in the corner (click it to open the side panel). Computed entirely from
  local storage — no network.
- **Inline markers** — a small 📝 icon appears right after each quoted passage on the page;
  click it to open the side panel filtered to that source and jump to the note. (Best-effort:
  it locates the quote by text, so it may not appear if the page markup changed or renders
  text on a canvas.)

- **PDF annotation** — PDFs open in a built-in PDF viewer (powered by a locally bundled
  PDF.js) where you can **select text → add a comment → see it highlighted in yellow**, and
  **click a highlight to open that note**. Highlights are re-anchored by page number + text,
  so they reappear next time you open the file.

> **Restricted pages:** the in-page UI can't appear on `chrome://` pages, the Chrome Web
> Store, or other extensions' pages — Chrome does not allow content scripts there. You can
> still capture with **right-click → “Save selection as reading note”**.
- **Bibliographic citations** — attach author, editor, book name, chapter, page, publisher,
  and year to any note. **Save a book once and reuse it**: pick it from the “Reuse a saved
  source” dropdown to auto-fill the book-level fields on later notes (just update chapter/page).
- **Jump back to the source** — every note has a **↗ Go to** button that opens its document
  and scrolls straight to the quoted passage, flashing it. Works for web pages, local HTML,
  and PDFs (which open at the right page). Reuses the tab if the document is already open.
- **Browse & manage** — a side panel lists all notes grouped by source, with search,
  edit, and delete. Click a source to reopen the page.
- **Export to CSV** — one click writes all notes (including citation columns) to a CSV file
  and opens its folder.
- **Backup & restore (JSON)** — save a full JSON backup anywhere (including this project
  folder) and import it back later or into a reinstalled extension.
- **Local & private** — data lives in `chrome.storage.local`; no account, no backend.

## Safety & privacy

**Your notes never leave your device.** There is no account, no backend, and no analytics.

- **No telemetry, no third parties** — the extension never sends your notes, quotes, URLs,
  or any other data anywhere. Nothing is sold, shared, or uploaded.
- **No external resources** — no CDNs, web fonts, or remote images. React and PDF.js are
  bundled locally. Source favicons are rendered as local letter-avatars rather than fetched
  from the source site (which would leak that you're reviewing that note).
- **On-device storage only** — `chrome.storage.local`, never `chrome.storage.sync`.
- **Strict CSP** — no relaxed `content_security_policy`, so Chrome's default MV3 policy
  applies (remote code and `eval` are blocked).
- The content script runs on pages only to detect text selections; it reads the selection,
  page title, and URL locally and passes them to the extension's own background worker.

### The one network request the extension makes

The **PDF viewer downloads the PDF you opened**, from the exact URL you navigated to — the
same file Chrome would have fetched for its own viewer. That's the only request the
extension itself issues, it goes only to that file's own server, and it carries none of your
notes. Local PDFs (`file://`) and everything else in the extension involve **no network at
all**.

### Permissions

`storage`, `activeTab`, `contextMenus`, `sidePanel`, `downloads` (CSV/JSON export),
`webNavigation` (to route PDFs to the annotating viewer), and host access to
`<all_urls>` + `file:///*` (to read selections and load PDFs; `file://` also requires you to
enable *"Allow access to file URLs"*).

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

Edge is built on the same engine, so the same folder works. Open `edge://extensions`,
turn on **Developer mode** (bottom-left), click **Load unpacked**, and pick the extension
folder.

---

## Make it permanent (survives reboot)

If the extension **disappears after you restart your PC**, it's almost always one of these:

- It was loaded from a **dev build** (`npm run dev`), which depends on a running dev server
  and becomes invalid after a reboot. Always load a **production build** (`npm run build`).
- It was loaded from a folder that gets **rebuilt or cleaned** (e.g. `dist/`, or a temp
  location). Load it from a **stable, dedicated folder** instead.

A production, unpacked extension loaded from a stable folder **does** persist across reboots
as long as **Developer mode stays on** and the folder isn't deleted.

### One command to install it permanently

```bash
npm run install:local
```

This builds the extension and copies it to a dedicated folder outside the project:

```
C:\Users\<you>\ReadingNotesExtension
```

Then load **that** folder once via **Load unpacked** (see Step 7 above). Because it lives
outside the project, normal rebuilds, `git` operations, and cleanups never touch it.

> Set a different location with
> `READING_NOTES_INSTALL_DIR="D:\Apps\ReadingNotes" npm run install:local`.

> **PowerShell error `npm.ps1 cannot be loaded because running scripts is disabled`?**
> That's PowerShell's execution policy blocking npm's script wrapper — nothing to do with
> this project. Easiest fix: run the command in **Command Prompt** (type `cmd` in the File
> Explorer address bar) instead of PowerShell. Or in PowerShell call `npm.cmd run
> install:local`. Or unblock it once with
> `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.

**To update later:** run `npm run install:local` again, then click the circular refresh
arrow on the Reading Notes card in `chrome://extensions`.

### Your notes are safe across reinstalls

The extension has a pinned ID (via a `key` in the manifest), so Chrome always treats it as
the *same* extension no matter where it's loaded from. That means your saved notes — stored
under that ID in `chrome.storage.local` — **survive** reinstalling, moving, or reloading the
extension. (The signing key lives in `.keys/`, which is gitignored — keep it if you plan to
pack or publish.)

### If Chrome keeps disabling it on startup

Chrome may show a *"Disable developer-mode extensions"* prompt each launch — click the **X**
/ **Keep** to dismiss it; it does not remove the extension. For a truly unattended,
one-click install with automatic updates and no Developer mode, publish it to the Chrome
Web Store (below).

---

## Publishing to the Chrome Web Store (formal install)

This turns the extension into a real, one-click install with auto-updates and no Developer
mode. The project prepares everything; the account, the one-time **US$5** developer fee, and
the final **Submit** are steps only you can do (they need your Google account).

### 1. Build the upload package

```bash
npm run package
```

This produces `reading-notes-vX.Y.Z.zip` in the project root — a clean store build with the
dev `key` removed (the store assigns the published ID) and sourcemaps stripped.

### 2. Create a developer account (one time)

1. Go to the **Chrome Web Store Developer Dashboard**:
   <https://chrome.google.com/webstore/devconsole>
2. Sign in with your Google account and pay the one-time **US$5** registration fee.

### 3. Create the item and upload

1. Click **Add new item** → upload the `reading-notes-vX.Y.Z.zip`.
2. Fill in the **store listing** (suggested text below).
3. Fill in **Privacy practices** (see below) — required before you can submit.
4. Choose **Visibility**: **Unlisted** (anyone with the link can install — great for personal
   use / sharing) or **Public** (appears in search). You can change this later.
5. Click **Submit for review**. Review usually takes a few hours to a few days.

### 4. Suggested store listing

- **Name:** Reading Notes
- **Summary (≤132 chars):** Select text on any page, add your insight, record the source and
  citation. Private, offline, with CSV/JSON export.
- **Category:** Productivity
- **Description:**
  > Reading Notes lets you capture what matters while you read. Select text on any web page,
  > add your own insight, and it saves the quote with its source (title + URL). Add
  > bibliographic details — author, editor, book, chapter, page, publisher, year — and reuse a
  > saved book across many notes. Browse, search, and edit everything in the side panel, and
  > export to CSV or JSON. All notes are stored locally on your device — no account, no
  > servers, no tracking.
- **Screenshots (required, 1280×800 or 640×400):** capture the side panel with a few notes,
  the on-page "Add note" button, and the citation form.

### 5. Privacy practices answers

- **Single purpose:** "Take reading notes: save selected text with the user's insight, source,
  and citation, viewable in a side panel."
- **Permission justifications** (paste these into the matching boxes):
  - *host access `<all_urls>`* — the extension reads the text the user selects and the page's
    title/URL so a note can record where it came from, and loads the PDF the user opened into
    the annotating viewer. It runs on all sites because the user may take reading notes on any
    page.
  - *`file:///*`* — lets the user annotate PDFs stored on their own computer. Only active if
    they enable "Allow access to file URLs".
  - *activeTab* — access the current tab when the user invokes the extension.
  - *storage* — save notes locally on the device.
  - *contextMenus* — the right-click "Save selection as reading note" command.
  - *sidePanel* — display notes in the browser side panel.
  - *downloads* — write CSV/JSON export files when the user requests them.
  - *webNavigation* — detect when a PDF is being opened so it can be routed to the
    extension's own annotating PDF viewer (Chrome's built-in viewer cannot be annotated by
    extensions).
- **Remote code:** *No.* All code, including PDF.js, is bundled in the package. Nothing is
  fetched or evaluated at runtime.
- **Data usage:** does **not** collect or transmit user data; nothing is sold or shared. The
  only network request is the viewer downloading the PDF the user chose to open. (See
  `PRIVACY.md`.)
- **Privacy policy URL:**
  `https://github.com/youyunjx/reading-notes-extension/blob/main/PRIVACY.md`

### 6. Moving your existing notes to the published version

The Web Store version gets a **new extension ID**, so it starts with empty storage. Carry your
notes over with the built-in backup:

1. In your current (unpacked) extension: side panel → **⬇ Backup** → save the JSON.
2. Install the published extension, open its side panel → **⬆ Import** → choose that JSON.

> Once you publish, update by bumping `version` in `package.json`, running `npm run package`,
> and uploading the new zip in the dashboard.

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

### Jumping from a note back to the document

Click **↗ Go to** on any note in the side panel:

- **Web pages / local HTML** — opens (or focuses) the tab, scrolls to the quoted passage and
  flashes it in yellow.
- **PDFs** — opens the PDF at the note's page and pulses that highlight.

If the document is already open in a tab, that tab is reused and focused rather than opening
a duplicate. If the passage can no longer be found (the page changed, or it's a restricted
page where content scripts can't run), the document still opens — it just won't scroll.

### Annotating PDFs

Chrome's built-in PDF viewer is closed to extensions, so PDFs open in Reading Notes' own
viewer (powered by a locally bundled PDF.js). There you can:

1. **Select text** in the PDF → click **✎ Add note**.
2. **Type your comment** → **Save note** (or ⌘/Ctrl + Enter). The page number is recorded.
3. The passage is **highlighted in yellow**. Hover to see your comment; **click the
   highlight** to open the side panel and jump to that note.

Highlights are re-anchored by **page number + quoted text**, so they come back every time you
reopen the file.

- **Local PDFs (`file://`)** additionally require enabling **"Allow access to file URLs"** on
  the Reading Notes card in `chrome://extensions`.
- **To go back to Chrome's native PDF viewer**, untick **"Annotate PDFs in Reading Notes
  viewer"** at the top of the side panel.

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

## Backup, restore & where your data lives

Your notes live in the browser's **`chrome.storage.local`** (inside your Chrome profile),
tied to the extension's ID. A Chrome extension is sandboxed and **cannot** use an arbitrary
folder (like this project folder) as its live database — that's a browser security rule. So
to keep a copy in the project folder, use the JSON backup:

- **⬇ Backup** (side-panel toolbar) — saves a full JSON file of all notes + sources. The
  Save As dialog lets you store it wherever you like, e.g. inside this project folder.
- **⬆ Import** — restores notes/sources from a backup JSON file. Importing **merges**
  (adds anything whose id isn't already present), so it's safe to run more than once and
  won't create duplicates.

Because the extension now has a **pinned ID**, your live data already survives reinstalling
and moving the extension. The JSON backup is your portable, off-Chrome copy — keep a recent
one in the project folder.

> **Recovering notes from an older, differently-installed copy:** each unpacked extension
> loaded *without* a pinned key gets an ID derived from its folder path, and its data sits in
> `…/User Data/<Profile>/Local Extension Settings/<old-id>/` as a LevelDB. `scripts/`
> contains one-off helpers (`compute-ids.mjs`, `recover-old-notes.mjs`) used to locate such a
> folder and export it to a backup JSON you can then **Import**.

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
