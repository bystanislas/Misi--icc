/* Service worker — Annuaire MISI
 *
 * Stratégie : réseau d'abord, cache en repli.
 * Le cache ne sert que hors connexion — jamais pour accélérer au prix
 * d'une page périmée. VERSION est réécrite à chaque build par
 * scripts/build-data.mjs, ce qui purge l'ancien cache au déploiement.
 */

const VERSION = "misi-202609011411";
const COQUILLE = [
  "./",
  "index.html",
  "annuaire.html",
  "opportunites.html",
  "connexion.html",
  "rejoindre.html",
  "emploi.html",
  "accompagnement.html",
  "cv.html",
  "data/offres.json",
  "hors-ligne.html",
  "assets/app.css",
  "assets/js/site.js",
  "assets/js/cv-modeles.js",
  "assets/js/chatbot.js",
  "assets/js/accompagnement.js",
  "assets/js/firebase-config.js",
  "assets/js/firebase.js",
  "assets/logo-misi-marque.png",
  "assets/logo-misi.png",
  "assets/favicon.png",
  "assets/icone-192.png",
  "data/membres.json",
  "manifest.webmanifest",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(VERSION)
      // addAll échoue en bloc si un seul fichier manque : on tolère les absents.
      .then((c) => Promise.allSettled(COQUILLE.map((u) => c.add(u))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((cles) => Promise.all(cles.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // polices Google : laissées au navigateur

  // Réseau d'abord, cache en repli.
  // Un annuaire qui se met à jour ne doit jamais servir une page ou un script
  // périmé ; le cache n'intervient que hors connexion.
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copie = res.clone();
          caches.open(VERSION).then((c) => c.put(req, copie));
        }
        return res;
      })
      .catch(async () => {
        const cache = await caches.match(req);
        if (cache) return cache;
        if (req.mode === "navigate") return caches.match("hors-ligne.html");
        return Response.error();
      }),
  );
});
