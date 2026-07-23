import { createHash } from 'node:crypto';

const pub =
  'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA1xQVO402XI6wh81QDoeRT0wzXxh+T2NEFwGEYBnG3D4dA5HZNEvSAu9y716X85u0HVk09ik5rvNda2XN03h6sk54wvJt6Up7QD26WDA7awzuGAGL5zBs0hqtnB+6aV3WsjtY0Dka7BfABiQBQ97lhFZ7GVAXkQfKrNZX28nuy6grpPWQ9MkH2ro7gX/laxQkFJGP7Bj8Hg8TSPwTYykLYVU+gYMXBHUZSwLscvviK/hQMpg4kfOb6EwDqUvhgQ+VSmp8RPiKZU6ahBC4d17dYbx46jcopjErkgRrXQ+HK5U/LsoD6uAlbsaR3sZSXP5ToxzJYrgTTA7WOjOA/JvLGwIDAQAB';

function idFrom(buf) {
  const h = createHash('sha256').update(buf).digest('hex').slice(0, 32);
  return h
    .split('')
    .map((c) => String.fromCharCode(97 + parseInt(c, 16)))
    .join('');
}

console.log('KEYED id (pinned / permanent folder):', idFrom(Buffer.from(pub, 'base64')));

const paths = [
  'D:\\Project\\chrome-based_note_taking\\dist',
  'C:\\Users\\x_yuu\\ReadingNotesExtension',
  'D:\\Project\\chrome-based_note_taking',
];
for (const p of paths) {
  console.log('path utf16le', JSON.stringify(p), '->', idFrom(Buffer.from(p, 'utf16le')));
  console.log('path utf8    ', JSON.stringify(p), '->', idFrom(Buffer.from(p, 'utf8')));
}
