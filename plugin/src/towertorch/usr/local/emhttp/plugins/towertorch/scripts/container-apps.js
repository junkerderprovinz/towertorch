/* The apps TowerTorch knows a container by, with the logo the Docker tab shows for a container
 * whose template brings no icon. The files in ../container-app-marks/ are Dashboard Icons' own,
 * and the README there says which file each one is. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.TTContainerApps = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // Each app with the images it stands for. An entry with an owner is that exact image. One
  // without is the official image of that name and what the repackagers publish under it, and
  // the app's own id always counts as one.
  var CONTAINER_APPS = {
    "adguard-home": ["adguard/adguardhome", "adguardhome"],
    audiobookshelf: ["advplyr/audiobookshelf"],
    authentik: ["goauthentik/server", "beryju/authentik"],
    bazarr: [],
    "calibre-web": [],
    cloudflared: ["cloudflare/cloudflared"],
    couchdb: [],
    crowdsec: ["crowdsecurity/crowdsec"],
    deluge: ["delugevpn"],
    dozzle: ["amir20/dozzle"],
    duplicati: ["duplicati/duplicati"],
    emby: ["emby/embyserver", "embyserver"],
    filebrowser: ["filebrowser/filebrowser", "hurlenko/filebrowser"],
    forgejo: ["forgejo/forgejo"],
    freshrss: ["freshrss/freshrss"],
    frigate: ["blakeblackshear/frigate"],
    gitea: ["gitea/gitea"],
    grafana: ["grafana/grafana", "grafana/grafana-oss", "grafana/grafana-enterprise"],
    heimdall: [],
    homarr: ["ajnart/homarr", "homarr-labs/homarr"],
    "home-assistant": ["homeassistant/home-assistant", "home-assistant/home-assistant", "homeassistant"],
    immich: ["immich-app/immich-server", "altran1502/immich-server"],
    influxdb: [],
    jellyfin: ["jellyfin/jellyfin"],
    jellyseerr: ["fallenbagel/jellyseerr"],
    kavita: ["jvmilazz0/kavita", "kizaing/kavita"],
    komga: ["gotson/komga"],
    lidarr: [],
    mariadb: [],
    mealie: ["hkotel/mealie", "mealie-recipes/mealie"],
    minio: ["minio/minio"],
    mongodb: ["mongo"],
    mosquitto: ["eclipse-mosquitto"],
    mysql: [],
    n8n: ["n8nio/n8n"],
    navidrome: ["deluan/navidrome", "navidrome/navidrome"],
    nextcloud: [],
    nginx: [],
    "nginx-proxy-manager": ["jc21/nginx-proxy-manager"],
    "node-red": ["nodered/node-red"],
    nzbget: ["nzbgetcom/nzbget"],
    ollama: ["ollama/ollama"],
    "open-webui": ["open-webui/open-webui"],
    overseerr: ["sctx/overseerr"],
    "paperless-ngx": ["paperless-ngx/paperless-ngx"],
    photoprism: ["photoprism/photoprism"],
    "pi-hole": ["pihole/pihole"],
    plex: ["plexinc/pms-docker"],
    portainer: ["portainer/portainer-ce", "portainer/portainer-ee", "portainer/portainer"],
    postgresql: ["postgres", "immich-app/postgres"],
    prometheus: ["prom/prometheus"],
    prowlarr: [],
    qbittorrent: ["qbittorrentofficial/qbittorrent-nox", "qbittorrentvpn"],
    radarr: [],
    readarr: [],
    redis: [],
    sabnzbd: ["sabnzbdvpn"],
    sonarr: [],
    "stirling-pdf": ["stirlingtools/stirling-pdf", "frooodle/s-pdf"],
    syncthing: ["syncthing/syncthing"],
    tailscale: ["tailscale/tailscale"],
    tautulli: ["tautulli/tautulli"],
    traefik: [],
    transmission: [],
    unifi: ["jacobalberty/unifi", "unifi-network-application", "unifi-controller"],
    "uptime-kuma": ["louislam/uptime-kuma"],
    vaultwarden: ["vaultwarden/server"],
    vikunja: ["vikunja/vikunja"],
    watchtower: ["containrrr/watchtower"],
    wireguard: []
  };

  // The logos with ink that would vanish on a dark page, which have a second file drawn for one.
  var DARK = ["bazarr", "cloudflared", "frigate", "heimdall", "minio", "ollama", "open-webui", "photoprism", "plex", "portainer", "sabnzbd", "sonarr", "syncthing", "tailscale", "unifi", "vaultwarden"];

  // The publishers who build other projects' apps under the apps' own names.
  var REPACKAGERS = ["linuxserver", "hotio", "binhex", "imagegenius"];

  // The prefixes the icon search drops from a container's name, see internal/iconsrc.
  var VENDOR_PREFIXES = ["binhex-", "binhex", "linuxserver-", "lsio-", "ls-", "official-", "docker-", "hotio-"];

  var exact = {}, named = {}, squashed = {};
  Object.keys(CONTAINER_APPS).forEach(function (id) {
    named[id] = id;
    squashed[id.replace(/-/g, "")] = id;
    CONTAINER_APPS[id].forEach(function (image) {
      if (image.indexOf("/") >= 0) exact[image] = id;
      else { named[image] = id; squashed[image.replace(/-/g, "")] = id; }
    });
  });
  function own(map, k) { return Object.prototype.hasOwnProperty.call(map, k) ? map[k] : ""; }

  // The image's owner and name: no registry, tag or digest, and an official image by its bare name.
  function imagePath(ref) {
    var parts = String(ref == null ? "" : ref).trim().toLowerCase().split("@")[0].split("/");
    parts[parts.length - 1] = parts[parts.length - 1].split(":")[0];
    if (parts.length > 1 && /[.:]|^localhost$/.test(parts[0])) parts.shift();
    if (parts.length > 1 && parts[0] === "library") parts.shift();
    return parts.join("/");
  }

  function appForImage(ref) {
    var p = imagePath(ref);
    if (own(exact, p)) return exact[p];
    var parts = p.split("/"), name = "";
    if (parts.length === 1) name = parts[0];
    else if (parts.length === 2 && REPACKAGERS.indexOf(parts[0]) >= 0) name = parts[1].replace(/^arch-/, "");
    return own(named, name);
  }

  // Anyone may call a container anything, so the name only counts when the image says nothing.
  // It is read like the icon search reads it: vendor prefix off, then the name and its shorter
  // forms with trailing words dropped, so "Plex-Media-Server" is Plex.
  function appForName(name) {
    var s = String(name == null ? "" : name).trim().toLowerCase();
    for (var i = 0; i < VENDOR_PREFIXES.length; i++) {
      var p = VENDOR_PREFIXES[i];
      if (s.indexOf(p) === 0 && s.length > p.length + 1) { s = s.slice(p.length); break; }
    }
    var toks = s.split(/[^a-z0-9]+/).filter(Boolean);
    for (var n = toks.length; n >= 1 && toks.length - n < 4; n--) {
      var v = toks.slice(0, n);
      var hit = own(named, v.join("-")) || own(squashed, v.join(""));
      if (hit) return hit;
    }
    return "";
  }

  function appFor(image, name) { return appForImage(image) || appForName(name); }

  function markFile(id, darkPage) { return id + (darkPage && DARK.indexOf(id) >= 0 ? ".dark.svg" : ".svg"); }

  return { CONTAINER_APPS: CONTAINER_APPS, appForImage: appForImage, appForName: appForName, appFor: appFor, markFile: markFile };
});
