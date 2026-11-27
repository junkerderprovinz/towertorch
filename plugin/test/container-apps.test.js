// Which app a container runs, known by its image first and by its name only when the image says
// nothing, and which of the bundled logos stands for it.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const PLUGIN = path.join(__dirname, '..', 'src', 'towertorch', 'usr', 'local', 'emhttp', 'plugins', 'towertorch');
const apps = require(path.join(PLUGIN, 'scripts', 'container-apps.js'));

test('an image is known by its repository, whatever registry and tag it comes with', () => {
  assert.equal(apps.appForImage('lscr.io/linuxserver/sonarr:latest'), 'sonarr');
  assert.equal(apps.appForImage('linuxserver/sonarr'), 'sonarr');
  assert.equal(apps.appForImage('ghcr.io/hotio/sonarr:release-4.0.9'), 'sonarr');
  assert.equal(apps.appForImage('binhex/arch-sonarr'), 'sonarr');
  assert.equal(apps.appForImage('ghcr.io/imagegenius/immich:latest'), 'immich');
  assert.equal(apps.appForImage('vaultwarden/server:1.32.0@sha256:0123abcd'), 'vaultwarden');
  assert.equal(apps.appForImage('docker.io/library/redis:7-alpine'), 'redis');
  assert.equal(apps.appForImage('redis'), 'redis');
  assert.equal(apps.appForImage('registry.example.com:5000/pihole/pihole:2024.07.0'), 'pi-hole');
  assert.equal(apps.appForImage('Ghcr.io/Immich-App/Immich-Server:v1.120.0'), 'immich');
});

test('an image of the same name from anyone else is not known', () => {
  assert.equal(apps.appForImage('someone/sonarr'), '');
  assert.equal(apps.appForImage('someone/server'), '');
  assert.equal(apps.appForImage('junkerderprovinz/filebot'), '');
});

test('a reference that names no image is not known', () => {
  assert.equal(apps.appForImage(''), '');
  assert.equal(apps.appForImage(undefined), '');
  assert.equal(apps.appForImage('sha256:4f2a9c0e7b11'), '');
});

test('a name is read the way the icon search reads it', () => {
  assert.equal(apps.appForName('binhex-sonarr'), 'sonarr');
  assert.equal(apps.appForName('Plex-Media-Server'), 'plex');
  assert.equal(apps.appForName('PiHole'), 'pi-hole');
  assert.equal(apps.appForName('Home Assistant'), 'home-assistant');
  assert.equal(apps.appForName('postgres'), 'postgresql');
  assert.equal(apps.appForName('backup'), '');
  assert.equal(apps.appForName(''), '');
});

test('a container is known by its image before its name', () => {
  assert.equal(apps.appFor('ghcr.io/hotio/radarr', 'sonarr'), 'radarr');
  assert.equal(apps.appFor('someone/mystery', 'sonarr'), 'sonarr');
  assert.equal(apps.appFor('someone/mystery', 'mystery'), '');
});

test('a logo drawn for a light page has its own file for a dark one', () => {
  assert.equal(apps.markFile('plex', false), 'plex.svg');
  assert.equal(apps.markFile('plex', true), 'plex.dark.svg');
  assert.equal(apps.markFile('radarr', true), 'radarr.svg');
});

test('every app has its logo, and every logo belongs to an app', () => {
  const dir = path.join(PLUGIN, 'container-app-marks');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.svg')).sort();
  const want = [];
  for (const id of Object.keys(apps.CONTAINER_APPS)) {
    want.push(apps.markFile(id, false));
    if (apps.markFile(id, true) !== apps.markFile(id, false)) want.push(apps.markFile(id, true));
  }
  assert.deepEqual(files, want.sort());
});
