// Pins the Folder view's per-folder state: collapse persistence, the per-folder
// "Gestoppte ausblenden" filter, the auto-expand while searching, and the bulk
// action target list.
//
// Each of these is a function of localStorage and an explicit byParent entry tree,
// which is why they sit outside renderFolderView()'s closures, so this file can
// slice them out of docker.js and drive them with no DOM at all.
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'src', 'towertorch', 'usr', 'local', 'emhttp', 'plugins', 'towertorch', 'scripts');
const DOCKER = process.argv[2] || path.join(DIR, 'docker.js');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  PASS  ' + name)) : (fail++, console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : ''))); };

const store = {};
const localStorage = {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: k => { delete store[k]; },
};
const reset = () => { Object.keys(store).forEach(k => delete store[k]); };

const src = fs.readFileSync(DOCKER, 'utf8');
function grabFn(name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('function not found in docker.js: ' + name);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  throw new Error('unbalanced function: ' + name);
}
// FOLDER_COLLAPSED_KEY and FOLDER_HIDESTOPPED_KEY share one var statement, so
// grabbing either name brings both.
function grabVar(name) {
  const m = src.match(new RegExp('var ' + name + ' = [^;]+;'));
  if (!m) throw new Error('var not found in docker.js: ' + name);
  return m[0];
}

const dockerApi = new Function('localStorage',
  grabVar('FOLDER_COLLAPSED_KEY') + '\n' +
  grabFn('norm') + '\n' +
  grabFn('readIdMap') + '\n' + grabFn('writeIdMapFlag') + '\n' +
  grabFn('isFolderCollapsed') + '\n' + grabFn('setFolderCollapsed') + '\n' +
  grabFn('folderHidesStopped') + '\n' + grabFn('setFolderHideStopped') + '\n' +
  grabFn('ttFolderHidesContainer') + '\n' +
  grabFn('ttEntryMatches') + '\n' + grabFn('ttEffectiveCollapsed') + '\n' +
  grabFn('ttCollectFolderContainerNames') + '\n' +
  'return { isFolderCollapsed: isFolderCollapsed, setFolderCollapsed: setFolderCollapsed, ' +
  'folderHidesStopped: folderHidesStopped, setFolderHideStopped: setFolderHideStopped, ' +
  'ttFolderHidesContainer: ttFolderHidesContainer, ttEntryMatches: ttEntryMatches, ' +
  'ttEffectiveCollapsed: ttEffectiveCollapsed, ttCollectFolderContainerNames: ttCollectFolderContainerNames };'
)(localStorage);

console.log('\nCollapse persistence, keyed by folder id in tt.folderCollapsed');
{
  reset();
  ok('a folder never touched starts expanded', dockerApi.isFolderCollapsed('fA') === false);
  dockerApi.setFolderCollapsed('fA', true);
  ok('setFolderCollapsed(id, true) persists', localStorage.getItem('tt.folderCollapsed') === JSON.stringify({ fA: true }));
  ok('isFolderCollapsed() reads true for that id', dockerApi.isFolderCollapsed('fA') === true);
  ok('another folder id is unaffected', dockerApi.isFolderCollapsed('fB') === false);
  dockerApi.setFolderCollapsed('fA', false);
  ok('setFolderCollapsed(id, false) drops the entry rather than storing false', localStorage.getItem('tt.folderCollapsed') === JSON.stringify({}));
  ok('isFolderCollapsed() reads false again', dockerApi.isFolderCollapsed('fA') === false);
  localStorage.setItem('tt.folderCollapsed', 'not valid json {{{');
  ok('corrupted stored state degrades to nothing collapsed instead of throwing', dockerApi.isFolderCollapsed('fA') === false);
  reset();
}

console.log('\n"Gestoppte ausblenden", held per folder rather than globally');
{
  reset();
  ok('off by default for an untouched folder', dockerApi.folderHidesStopped('media') === false);
  dockerApi.setFolderHideStopped('media', true);
  ok('setFolderHideStopped(id, true) persists', dockerApi.folderHidesStopped('media') === true);
  ok('a different folder is unaffected', dockerApi.folderHidesStopped('tools') === false);
  dockerApi.setFolderHideStopped('media', false);
  ok('setFolderHideStopped(id, false) clears it', dockerApi.folderHidesStopped('media') === false);
  reset();
}

console.log('\nttFolderHidesContainer(): the actual filtering predicate used while rendering');
{
  reset();
  const running = { name: 'plex', state: 'running' };
  const stopped = { name: 'radarr', state: 'exited' };
  ok('toggle off: nothing is hidden, running or not', !dockerApi.ttFolderHidesContainer('media', running) && !dockerApi.ttFolderHidesContainer('media', stopped));
  dockerApi.setFolderHideStopped('media', true);
  ok('toggle on: a running container in that folder stays visible', !dockerApi.ttFolderHidesContainer('media', running));
  ok('toggle on: a stopped container in that folder is hidden', dockerApi.ttFolderHidesContainer('media', stopped));
  ok('toggle on: another folder is unaffected', !dockerApi.ttFolderHidesContainer('tools', stopped));
  ok('a missing container object does not throw', dockerApi.ttFolderHidesContainer('media', null) === false);
  reset();
}

// root holds the Media folder and plex, Media holds sonarr and the Nested folder,
// and Nested holds radarr.
const ROOT = 'root';
const folderMedia = { id: 'fMedia', type: 'folder', name: 'Media', parentId: ROOT };
const folderNested = { id: 'fNested', type: 'folder', name: 'Nested', parentId: 'fMedia' };
const cPlex = { id: 'cPlex', type: 'container', name: '/plex', parentId: ROOT };
const cSonarr = { id: 'cSonarr', type: 'container', name: '/sonarr', parentId: 'fMedia' };
const cRadarr = { id: 'cRadarr', type: 'container', name: '/radarr', parentId: 'fNested' };
const byParent = { [ROOT]: [folderMedia, cPlex], fMedia: [cSonarr, folderNested], fNested: [cRadarr] };

console.log('\nttEntryMatches(): search matching, down through nested folders');
{
  ok('an empty filter matches everything, so search hides nothing', dockerApi.ttEntryMatches(byParent, '', folderMedia) && dockerApi.ttEntryMatches(byParent, '', cPlex));
  ok('a container matches on its own name, with the leading slash stripped', dockerApi.ttEntryMatches(byParent, 'plex', cPlex));
  ok('a container that does not match returns false', !dockerApi.ttEntryMatches(byParent, 'zzz-nomatch', cPlex));
  ok('a folder matches on its own name too', dockerApi.ttEntryMatches(byParent, 'media', folderMedia));
  ok('a folder matches through a child container', dockerApi.ttEntryMatches(byParent, 'sonarr', folderMedia));
  ok('a folder matches through one buried in a sub-folder', dockerApi.ttEntryMatches(byParent, 'radarr', folderMedia));
  ok('the sub-folder matches on that buried container as well', dockerApi.ttEntryMatches(byParent, 'radarr', folderNested));
  ok('a folder with no match in its name or anywhere below returns false', !dockerApi.ttEntryMatches(byParent, 'zzz-nomatch', folderMedia));
}

console.log('\nttEffectiveCollapsed(): a search opens a folder without writing the stored state');
{
  reset();
  ok('nothing persisted and no filter: expanded', dockerApi.ttEffectiveCollapsed(byParent, '', folderMedia) === false);
  dockerApi.setFolderCollapsed('fMedia', true);
  ok('persisted collapsed and no search: collapsed', dockerApi.ttEffectiveCollapsed(byParent, '', folderMedia) === true);
  ok('persisted collapsed and a search matching inside it: expanded', dockerApi.ttEffectiveCollapsed(byParent, 'radarr', folderMedia) === false);
  ok('persisted collapsed and a search matching nothing in it: still collapsed', dockerApi.ttEffectiveCollapsed(byParent, 'zzz-nomatch', folderMedia) === true);
  ok('clearing the filter brings the persisted state back untouched', dockerApi.ttEffectiveCollapsed(byParent, '', folderMedia) === true);
  dockerApi.setFolderCollapsed('fMedia', false);
  ok('persisted expanded and a matching search: still expanded', dockerApi.ttEffectiveCollapsed(byParent, 'sonarr', folderMedia) === false);
  reset();
}

console.log('\nttCollectFolderContainerNames(): the bulk start and stop target list');
{
  const exists = nm => ['plex', 'sonarr', 'radarr'].indexOf(nm) >= 0; // stands in for containerByName()
  const names = dockerApi.ttCollectFolderContainerNames(byParent, 'fMedia', exists).sort();
  ok('collects the child container', names.indexOf('sonarr') >= 0, JSON.stringify(names));
  ok('collects one buried in a sub-folder too', names.indexOf('radarr') >= 0, JSON.stringify(names));
  ok('leaves out a sibling outside the folder, plex living at root', names.indexOf('plex') < 0, JSON.stringify(names));
  ok('the two containers under Media and nothing else', names.length === 2, JSON.stringify(names));
  const rootNames = dockerApi.ttCollectFolderContainerNames(byParent, ROOT, exists).sort();
  ok('from root it recurses through every folder and collects all three', rootNames.length === 3 && rootNames.join(',') === 'plex,radarr,sonarr', JSON.stringify(rootNames));
  const unknown = dockerApi.ttCollectFolderContainerNames(byParent, 'fMedia', () => false);
  ok('a container the plugin does not know is skipped', Array.isArray(unknown) && unknown.length === 0);
}

console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
process.exit(fail ? 1 : 0);
