// Pins the folder import: what the preview lists and which organizer calls it
// makes for the folders another folder plugin keeps, and that a second run
// changes nothing. The plan and the new-folder lookup are pure functions of the
// organizer view and the engine's folder list, so they are sliced out of
// docker.js and driven against a small in-memory organizer.
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'src', 'towertorch', 'usr', 'local', 'emhttp', 'plugins', 'towertorch');
const DOCKER = process.argv[2] || path.join(DIR, 'scripts', 'docker.js');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };

const src = fs.readFileSync(DOCKER, 'utf8');
function grabFn(name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('function not found in docker.js: ' + name);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  throw new Error('unbalanced function: ' + name);
}
const api = new Function(
  grabFn('ttFolderImportPlan') + '\n' + grabFn('ttNewFolderId') + '\n' +
  'return { plan: ttFolderImportPlan, newId: ttNewFolderId };'
)();

// The organizer as the live Bottich answered it: a root folder named Root,
// containers with docker-style ids and names, folders with an id of their own.
function organizer(folders, containers) {
  const entries = [{ id: 'root', type: 'folder', name: 'Root', parentId: null, childrenIds: [] }];
  const add = (e) => { entries.push(e); const p = entries.find(x => x.id === e.parentId); p.childrenIds.push(e.id); };
  folders.forEach(f => add({ id: f.id, type: 'folder', name: f.name, parentId: f.parent || 'root', childrenIds: [] }));
  containers.forEach(c => add({ id: '/' + c.name, type: 'container', name: '/' + c.name, parentId: c.parent || 'root', childrenIds: [] }));
  return { id: 'default', rootId: 'root', flatEntries: entries };
}
let made = 0;
// createDockerFolderWithItems as the organizer applies it: a new folder under
// the parent, the items moved into it out of wherever they were.
function apply(view, c, parentId) {
  const v = JSON.parse(JSON.stringify(view));
  const id = 'org-' + (++made);
  v.flatEntries.forEach(e => { e.childrenIds = e.childrenIds.filter(k => c.items.indexOf(k) < 0); });
  v.flatEntries.forEach(e => { if (c.items.indexOf(e.id) >= 0) e.parentId = id; });
  v.flatEntries.push({ id: id, type: 'folder', name: c.name, parentId: parentId, childrenIds: c.items.slice() });
  v.flatEntries.find(e => e.id === parentId).childrenIds.push(id);
  return v;
}
function run(view, creates) {
  const ids = {};
  creates.forEach(c => {
    const parentId = c.parentId || ids[c.parentRef];
    const next = apply(view, c, parentId);
    ids[c.ref] = api.newId(view, next, c.name, parentId);
    view = next;
  });
  return { view, ids };
}

// The engine's answer for the nested fixture of the Go tests.
const imported = [
  { id: 'tools', name: 'Tools', members: ['plex'], gone: ['oldtool'] },
  { id: 'media', name: 'Media', color: '#ffca63', members: ['jellyfin'] },
  { id: 'arr', name: 'Arr', parent: 'media', members: ['sabnzbd', 'radarr', 'sonarr'] },
  { id: 'net', name: 'Network', members: ['adguard', 'swag'] },
  { id: 'empty', name: 'Leftovers', members: [], gone: ['ghost'] },
];
const cts = ['plex', 'jellyfin', 'sabnzbd', 'radarr', 'sonarr', 'adguard', 'swag', 'nginx'].map(n => ({ name: n }));

console.log('\nThe preview and the calls for a fresh organizer');
{
  const view = organizer([], cts);
  const p = api.plan(view, imported);
  ok('every source folder has a row, in the source order', p.rows.map(r => r.name).join() === 'Tools,Media,Arr,Network,Leftovers', p.rows.map(r => r.name).join());
  ok('a nested folder is one level deeper than its parent', p.rows[2].depth === p.rows[1].depth + 1);
  ok('the folders with containers are created, parents first', p.creates.map(c => c.name).join() === 'Tools,Media,Arr,Network', p.creates.map(c => c.name).join());
  ok('a top folder goes under the root', p.creates[0].parentId === 'root' && !p.creates[0].parentRef);
  ok('a nested folder waits for its parent\'s new id', p.creates[2].parentRef === 'media' && !p.creates[2].parentId);
  ok('the members go in by their organizer ids, in order', JSON.stringify(p.creates[2].items) === JSON.stringify(['/sabnzbd', '/radarr', '/sonarr']));
  ok('a colour rides along', p.creates[1].color === '#ffca63' && !p.creates[0].color);
  ok('a folder with nothing left is skipped and says so', p.rows[4].state === 'empty' && p.creates.every(c => c.name !== 'Leftovers'));
  ok('containers that no longer exist are listed', p.rows[0].gone.join() === 'oldtool' && p.rows[4].gone.join() === 'ghost');
}

console.log('\nWhat is already in the organizer stays as it is');
{
  const view = organizer([{ id: 'mine', name: 'media' }, { id: 'stuff', name: 'Stuff' }], [{ name: 'plex', parent: 'stuff' }].concat(cts.slice(1)));
  const p = api.plan(view, imported);
  const media = p.rows.find(r => r.name === 'Media');
  ok('a folder whose name is already there is not created again, whatever the case', media.state === 'exists' && p.creates.every(c => c.name !== 'Media'));
  const arr = p.creates.find(c => c.name === 'Arr');
  ok('a new child of an existing folder goes into that folder', arr && arr.parentId === 'mine' && !arr.parentRef);
  const tools = p.rows.find(r => r.name === 'Tools');
  ok('a container already in another folder stays there', tools.state === 'empty' && tools.elsewhere.length === 1 && tools.elsewhere[0].name === 'plex' && tools.elsewhere[0].folder === 'Stuff');
}

console.log('\nA folder named like the root');
{
  const p = api.plan(organizer([], cts), [{ id: 'r', name: 'root', members: ['plex'] }, { id: 'k', name: 'Kid', parent: 'r', members: ['swag'] }]);
  ok('is never created', p.creates.every(c => c.name.toLowerCase() !== 'root') && p.rows[0].state === 'exists');
  ok('and its children land at the top', p.creates[0].name === 'Kid' && p.creates[0].parentId === 'root');
}

console.log('\nThe new folder\'s id is read off the organizer\'s answer');
{
  const before = organizer([{ id: 'old', name: 'Media' }], []);
  const after = apply(before, { name: 'Media', items: [] }, 'root');
  ok('the folder that was not there before, by name and parent', api.newId(before, after, 'Media', 'root') === 'org-' + made);
  ok('nothing new is no id', api.newId(after, after, 'Media', 'root') === null);
}

console.log('\nA second run changes nothing');
{
  const first = api.plan(organizer([], cts), imported);
  const done = run(organizer([], cts), first.creates);
  const arr = done.view.flatEntries.find(e => e.name === 'Arr');
  ok('the nested folder landed in its parent', arr.parentId === done.ids.media);
  const again = api.plan(done.view, imported);
  ok('no folder is created twice', again.creates.length === 0, JSON.stringify(again.creates));
  ok('every row says it is already there or has nothing to take', again.rows.every(r => r.state === 'exists' || r.state === 'empty'));
}

console.log('\nThe button offers itself only while there is something to take over');
{
  ok('the gear menu checks for creates before it shows the button', /ttFolderImportPlan\(ttOrgView, importFolders\)\.creates\.length/.test(src));
  ok('the engine is asked once the organizer answers', /api\("GET", "folderimport"\)/.test(src));
}

console.log('\nThe words never name the other plugin');
{
  const texts = src.match(/importTitle: "[^"]*"|importText: "[^"]*"|importBtn: "[^"]*"/g) || [];
  ok('the strings are there in German and English', texts.length === 6, String(texts.length));
  ok('and say nothing of folder.view or FolderView', texts.every(s => !/folder\.?view/i.test(s)));
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
