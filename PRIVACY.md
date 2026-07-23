# Privacy Policy — Reading Notes

_Last updated: 2026-07-21_

Reading Notes is a browser extension for taking personal reading notes. Your privacy
is simple to describe: **the extension does not collect, transmit, or share any of your
data. Everything stays on your own device.**

## What data the extension handles

When you save a note, the extension stores — **locally, in your browser** (`chrome.storage.local`) —
only what you choose to capture:

- the text you selected,
- the insight you type,
- the page title and URL the note came from,
- optional citation details you enter (author, editor, book, chapter, page, publisher, year).

## Where the data goes

Nowhere. There are **no servers, no accounts, and no analytics**. The extension makes **no
network requests** of its own. Your notes never leave your computer unless *you* explicitly
export them (CSV or JSON) to a file you control.

## What the extension does NOT do

- It does not collect personal or sensitive information for the developer.
- It does not sell or share data with third parties.
- It does not track your browsing.
- It does not use your data for advertising or any purpose unrelated to its single function
  (taking reading notes).

## Permissions

- **storage** — save your notes on your device.
- **activeTab / host access** — read the text you select and the current page's title/URL so
  a note can record its source.
- **contextMenus** — add the right-click "Save selection as reading note" option.
- **sidePanel** — show your notes in the browser side panel.
- **downloads** — write CSV / JSON export files when you ask for them.

## Contact

Questions? Open an issue on the project's GitHub repository.
