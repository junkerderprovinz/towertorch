// Unraid parses the .plg as XML before it does anything else, so a single raw
// ampersand or "<" anywhere in it, the prose of a CHANGES entry included, turns
// `plugin install` into "XML file doesn't exist or xml parse error" on every box.
// A release has already died that way on a `"Logos & Icons"` in the changelog.
//
// It walks the file character by character rather than pulling in an XML library,
// because it has to run on the same bare Node as the other WebGUI tests.
const fs = require('fs');
const path = require('path');
const PLG = process.argv[2] || path.join(__dirname, '..', 'towertorch.plg');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };

const raw = fs.readFileSync(PLG, 'utf8');

const text = raw;

console.log('\nThe plugin manifest is well-formed XML');
{
  // Every "&" must open a real entity reference, and every "<" must open a real tag,
  // a closing tag, a comment, a CDATA section, a doctype or a processing instruction.
  const badAmp = [];
  const badLt = [];
  let line = 1;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '\n') { line++; continue; }
    if (c === '&') {
      const m = /^&(#[0-9]+|#x[0-9a-fA-F]+|[A-Za-z_][A-Za-z0-9._-]*);/.exec(text.slice(i, i + 40));
      if (!m) badAmp.push({ line, near: text.slice(Math.max(0, i - 45), i + 25).replace(/\n/g, ' ') });
    } else if (c === '<') {
      const nxt = text.slice(i, i + 9);
      if (!/^<[A-Za-z/!?]/.test(nxt)) badLt.push({ line, near: text.slice(Math.max(0, i - 45), i + 25).replace(/\n/g, ' ') });
    }
  }
  ok('no raw "&" outside an entity reference', badAmp.length === 0, badAmp.length ? JSON.stringify(badAmp.slice(0, 3)) : '');
  ok('no raw "<" that does not open a tag', badLt.length === 0, badLt.length ? JSON.stringify(badLt.slice(0, 3)) : '');
}

console.log('\nThe CHANGES block Unraid renders as markdown');
{
  const m = /<CHANGES>([\s\S]*?)<\/CHANGES>/.exec(raw);
  ok('the CHANGES block exists', !!m);
  if (m) {
    const body = m[1];
    const headers = body.split('\n').filter(l => /^### /.test(l));
    ok('every version header is "### X.Y.Z"', headers.every(h => /^### \d+\.\d+\.\d+$/.test(h)), JSON.stringify(headers.filter(h => !/^### \d+\.\d+\.\d+$/.test(h)).slice(0, 3)));
    ok('there is at least one version header', headers.length > 0);

    // Only the newest entry is checked, the one this release ships. The older ones
    // installed fine as they are, and rewriting them would be editing the past.
    const lines = body.split('\n');
    const first = lines.findIndex(l => /^### \d+\.\d+\.\d+$/.test(l));
    let last = lines.length;
    for (let i = first + 1; i < lines.length; i++) { if (/^### \d+\.\d+\.\d+$/.test(lines[i])) { last = i; break; } }
    const newest = lines.slice(first, last);
    const amp = newest.filter(l => /&(?!(#[0-9]+|#x[0-9a-fA-F]+|[A-Za-z_][A-Za-z0-9._-]*);)/.test(l));
    ok('the newest entry has no unescaped "&"', amp.length === 0, JSON.stringify(amp.slice(0, 2)));
    ok('the newest entry has no raw "<"', newest.every(l => l.indexOf('<') < 0));
    // Unraid renders CHANGES as markdown, where a leading "#" opens a heading. The
    // "### X.Y.Z" version headers are the one place that is wanted.
    const badBullet = newest.filter(l => /^- \s*#/.test(l));
    ok('no bullet in the newest entry starts with "#"', badBullet.length === 0, JSON.stringify(badBullet.slice(0, 2)));
  }
}

console.log('\nThe version entity and the newest CHANGES entry agree');
{
  const v = /<!ENTITY version\s+"([^"]+)">/.exec(raw);
  ok('the version entity is a 3-digit SemVer', !!v && /^\d+\.\d+\.\d+$/.test(v[1]), v ? v[1] : 'missing');
  const m = /<CHANGES>\s*### (\d+\.\d+\.\d+)/.exec(raw);
  ok('CHANGES opens with a version header', !!m, m ? m[1] : 'missing');
  if (v && m) ok('and it names the version being released', v[1] === m[1], v[1] + ' vs ' + m[1]);
}

console.log('\nThe package is fetched from the release and checked against a hash');
{
  const stanza = /<FILE Name="&plgPath;\/&txz;"[^>]*>([\s\S]*?)<\/FILE>/.exec(raw);
  ok('the txz FILE stanza exists', !!stanza);
  if (stanza) {
    ok('it downloads from the release URL', /<URL>&pkgURL;\/&txz;<\/URL>/.test(stanza[1]));
    ok('it declares the sha256 entity', /<SHA256>&sha256;<\/SHA256>/.test(stanza[1]));
    ok('it embeds no payload', !/<INLINE>/.test(stanza[1]) && !/Type="base64"/.test(stanza[0]));
  }
  const h = /<!ENTITY sha256\s+"([^"]*)">/.exec(raw);
  ok('the sha256 entity is a 64-digit hex hash', !!h && /^[0-9a-f]{64}$/.test(h[1]), h ? h[1] : 'missing');
  ok('the manifest stays small enough for the review tooling', raw.length < 500000, String(raw.length));
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
