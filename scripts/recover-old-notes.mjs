// Reads the copied old extension LevelDB (.recovery/olddb) and writes a backup
// JSON the extension's Import feature can load. Non-destructive: only reads.
import { ClassicLevel } from 'classic-level';
import { writeFileSync } from 'node:fs';

const db = new ClassicLevel('.recovery/olddb', {
  keyEncoding: 'utf8',
  valueEncoding: 'utf8',
  createIfMissing: false,
});
await db.open();

const raw = {};
for await (const [key, value] of db.iterator()) {
  raw[key] = value;
  console.log(`key ${JSON.stringify(key)} — ${value.length} chars`);
}
await db.close();

function parseMaybe(s) {
  if (s == null) return undefined;
  try {
    return JSON.parse(s);
  } catch {
    return undefined;
  }
}

const notes = parseMaybe(raw.notes) ?? [];
const sources = parseMaybe(raw.sources) ?? [];

const backup = {
  type: 'reading-notes-backup',
  version: 1,
  exportedAt: Date.now(),
  notes,
  sources,
};

const outPath = 'reading-notes-backup.json';
writeFileSync(outPath, JSON.stringify(backup, null, 2));
console.log(
  `\n✓ Recovered ${notes.length} note(s) and ${sources.length} source(s) -> ${outPath}`,
);
if (notes[0]) {
  console.log('\nSample note:');
  console.log('  quote:  ', String(notes[0].quote ?? '').slice(0, 60));
  console.log('  insight:', String(notes[0].insight ?? '').slice(0, 60));
}
