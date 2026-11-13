// The fortress card is GlimStone's own, unchanged: every file glimstone.json lists under vanilla
// is byte for byte the file GlimStone has at that commit, so all the plugins of a fortress draw
// the same card and an edit here cannot drift from it.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const { ref, files } = JSON.parse(fs.readFileSync(path.join(ROOT, 'glimstone.json'), 'utf8')).vanilla;

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };

console.log("\nThe fortress card is GlimStone's own, unchanged");
(async () => {
  ok('glimstone.json names a commit and the card\'s two files', /^[0-9a-f]{7,40}$/.test(ref) && Object.keys(files).length === 2, ref);
  for (const [mine, theirs] of Object.entries(files)) {
    const url = 'https://raw.githubusercontent.com/junkerderprovinz/glimstone/' + ref + '/' + theirs;
    let source = null, why = '';
    try {
      const r = await fetch(url);
      if (r.ok) source = Buffer.from(await r.arrayBuffer());
      else why = 'HTTP ' + r.status;
    } catch (e) {
      why = e.message;
    }
    const copy = fs.readFileSync(path.join(ROOT, mine));
    ok(mine + ' is ' + theirs + ' at GlimStone ' + ref,
      source !== null && Buffer.compare(source, copy) === 0,
      source === null ? 'could not read ' + url + ': ' + why : 'it differs from GlimStone ' + ref + ', copy ' + theirs + ' again instead of editing it here');
  }
  console.log(fail ? '\nFAIL  ' + fail + ' failed, ' + pass + ' passed' : '\nOK  ' + pass + ' passed');
  process.exit(fail ? 1 : 0);
})();
