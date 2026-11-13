// The fortress card is GlimStone's own, unchanged: every file of the card's copy target in
// glimstone.json is byte for byte the file GlimStone has at tag v<version>, or on rel/<version>
// until that release is tagged, so all the plugins of a fortress draw the same card and an edit
// here cannot drift from it.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const card = JSON.parse(fs.readFileSync(path.join(ROOT, 'glimstone.json'), 'utf8'))
  .targets.find((t) => t.mode === 'copy' && t.name === 'fortress card') || { files: [] };

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };

async function glimstoneFile(version, file) {
  for (const ref of ['v' + version, 'rel/' + version]) {
    const url = 'https://raw.githubusercontent.com/junkerderprovinz/glimstone/' + ref + '/' + file;
    const r = await fetch(url);
    if (r.status === 404) continue;
    if (!r.ok) throw new Error(url + ' answered HTTP ' + r.status);
    return { ref, body: Buffer.from(await r.arrayBuffer()) };
  }
  throw new Error('GlimStone has ' + file + ' neither at v' + version + ' nor on rel/' + version);
}

console.log("\nThe fortress card is GlimStone's own, unchanged");
(async () => {
  ok('glimstone.json has a fortress card copy target with the card\'s two files', /^\d+\.\d+\.\d+$/.test(card.version) && card.files.length === 2, card.version);
  for (const { from, to } of card.files) {
    let source = null, why = '';
    try {
      source = await glimstoneFile(card.version, from);
    } catch (e) {
      why = e.message;
    }
    const copy = fs.readFileSync(path.join(ROOT, to));
    ok(to + ' is ' + from + ' of GlimStone ' + card.version,
      source !== null && Buffer.compare(source.body, copy) === 0,
      source === null ? why : 'it differs from GlimStone ' + source.ref + ', copy ' + from + ' again instead of editing it here');
  }
  console.log(fail ? '\nFAIL  ' + fail + ' failed, ' + pass + ' passed' : '\nOK  ' + pass + ' passed');
  process.exit(fail ? 1 : 0);
})();
