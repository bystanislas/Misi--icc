/* ==================================================================
 * Administration — Annuaire MISI
 *
 * Application d'administration branchée sur Firestore (projet misi-icc).
 * Accès : Firebase Auth (e-mail / mot de passe) + document admins/{uid}.
 * Les droits sont appliqués côté serveur par firestore.rules : cette page
 * n'est qu'une interface, elle ne protège rien à elle seule.
 *
 * Collections gérées :
 *   membres, offres                      → création, édition, suppression
 *   inscriptions, accompagnements,
 *   demandes, candidatures,
 *   offres_proposees                     → suivi, statut, notes, réponse
 *   admins                               → gestion des accès
 *   config/admin, mail                   → paramètres, envoi direct des
 *                                          e-mails (extension Firebase
 *                                          « Trigger Email »)
 * ================================================================== */

import { initializeApp, deleteApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  writeBatch,
  arrayUnion,
  serverTimestamp,
  Timestamp,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

/* global FIREBASE */
const appFb = initializeApp(FIREBASE);
const auth = getAuth(appFb);
const db = getFirestore(appFb);
const URL_SITE = location.origin + "/";

/* ---------------------------------------------------------------- *
 * 1. Utilitaires
 * ---------------------------------------------------------------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const esc = (v) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const liste = (v) => (Array.isArray(v) ? v.filter((x) => x !== "" && x != null) : v ? [v] : []);

const sansAccents = (s) =>
  String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

const enDate = (t) => (t?.toDate ? t.toDate() : t ? new Date(t) : null);

function dateCourte(t) {
  const d = enDate(t);
  return d && !isNaN(d) ? d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : "—";
}
function dateLongue(t) {
  const d = enDate(t);
  return d && !isNaN(d) ? d.toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" }) : "—";
}
const aujourdhui = () => new Date().toISOString().slice(0, 10);

function toast(msg, erreur = false) {
  const t = $("[data-toast]");
  t.textContent = msg;
  t.classList.toggle("erreur-toast", erreur);
  t.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => (t.hidden = true), erreur ? 6000 : 3000);
}

function messageErreur(e) {
  const code = e?.code || "";
  if (code === "permission-denied")
    return "Permission refusée par Firestore : vérifiez que firestore.rules est déployé et que votre compte figure dans « admins ».";
  if (code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found")
    return "E-mail ou mot de passe incorrect.";
  if (code === "auth/too-many-requests") return "Trop de tentatives. Réessayez dans quelques minutes.";
  if (code === "auth/email-already-in-use") return "Un compte existe déjà avec cet e-mail.";
  if (code === "auth/weak-password") return "Mot de passe trop faible (6 caractères minimum).";
  if (code === "auth/operation-not-allowed")
    return "La connexion par e-mail n’est pas activée dans Firebase Authentication.";
  if (code === "auth/network-request-failed" || code === "unavailable") return "Connexion réseau impossible.";
  return e?.message || "Erreur inattendue.";
}

/** Exécute une écriture avec gestion d'erreur et retour visuel. */
async function action(fn, ok) {
  try {
    const r = await fn();
    if (ok) toast(ok);
    return r ?? true;
  } catch (e) {
    console.error(e);
    toast(messageErreur(e), true);
    return false;
  }
}

/* ---------------------------------------------------------------- *
 * 2. État et synchronisation temps réel
 * ---------------------------------------------------------------- */
const etat = {
  utilisateur: null,
  ref: null, // référentiels (data/membres.json)
  statiques: [], // membres du fichier statique
  donnees: {}, // nom de collection → tableau de documents
  filtres: {},
  abonnements: [],
};

const COLLECTIONS = [
  "membres",
  "offres",
  "inscriptions",
  "accompagnements",
  "demandes",
  "candidatures",
  "offres_proposees",
  "admins",
  "mail",
  "config",
];

function synchroniser() {
  etat.abonnements.forEach((u) => u());
  etat.abonnements = COLLECTIONS.map((nom) =>
    onSnapshot(
      collection(db, nom),
      (snap) => {
        etat.donnees[nom] = snap.docs
          .map((d) => ({ ...d.data(), id: d.id }))
          .sort((a, b) => (enDate(b.creeLe) || 0) - (enDate(a.creeLe) || 0));
        majCompteurs();
        rendre();
      },
      (e) => {
        console.error(nom, e);
        etat.donnees[nom] = etat.donnees[nom] || [];
        if (e.code === "permission-denied") toast(`Lecture de « ${nom} » refusée : ${messageErreur(e)}`, true);
      },
    ),
  );
}

const docs = (nom) => etat.donnees[nom] || [];

/* Rôles — miroir de firestore.rules, qui les applique réellement.
 * Ici, ils ne servent qu'à n'afficher que les actions permises. */
const ROLES = {
  super_admin: ["Super-administrateur", "Tous les droits, dont les administrateurs et les paramètres."],
  gestionnaire: ["Gestionnaire", "Membres, offres, référentiels, validation des inscriptions, suppressions et traitement des demandes."],
  secretariat: ["Secrétariat", "Traite les demandes : statut, notes et réponses. Ne modifie ni les membres ni les offres."],
  lecteur: ["Lecteur", "Consultation seule."],
};
const DROITS = {
  gestion: ["super_admin", "gestionnaire"],
  traitement: ["super_admin", "gestionnaire", "secretariat"],
  super: ["super_admin"],
};
// Sans champ role : super-administrateur (premier compte créé dans la console).
const roleDe = (a) => (a && ROLES[a.role] ? a.role : "super_admin");
const peut = (droit) => DROITS[droit].includes(etat.role);

/** Met une modale en consultation seule : champs figés, actions retirées. */
function lectureSeule(m) {
  $$(".modale-corps :is(input, select, textarea)", m).forEach((c) => (c.disabled = true));
  $$("[data-ecriture]", m).forEach((b) => b.remove());
}
const reglages = () => docs("config").find((d) => d.id === "admin") || {};

/** Référentiels en vigueur : ceux de l'administration, sinon le fichier statique. */
function refCourant() {
  const f = docs("config").find((d) => d.id === "referentiels");
  return f ? refDepuisFirestore(f) : etat.ref;
}

async function chargerReferentiels() {
  try {
    const r = await fetch("/data/membres.json", { cache: "no-cache" });
    const d = await r.json();
    etat.ref = d.referentiels;
    etat.statiques = d.membres || [];
    etat.fichier = d;
  } catch {
    etat.ref = { secteurs: {}, metiers: {}, besoins: {}, apports: {}, niveaux: [], ages: [], interets: [] };
    toast("Référentiels introuvables (data/membres.json).", true);
  }
}

/* ---------------------------------------------------------------- *
 * 3. Formulaires génériques
 * ---------------------------------------------------------------- */
/**
 * Champ décrit par { k, label, type, options, requis, large, aide }.
 * Types : text, email, date, textarea, select, cases (multi), case (booléen).
 * options : tableau de [valeur, libellé] ou de chaînes.
 */
function champ(def, valeur) {
  const id = "f-" + def.k;
  const opts = (def.options || []).map((o) => (Array.isArray(o) ? o : [o, o]));
  const req = def.requis ? " required" : "";
  const cls = def.large || def.type === "textarea" || def.type === "cases" ? "large" : "";
  let html;

  switch (def.type) {
    case "textarea":
      html = `<textarea class="champ" id="${id}" name="${def.k}" rows="${def.lignes || 4}"${req}>${esc(valeur)}</textarea>`;
      break;
    case "select":
      html = `<select class="champ" id="${id}" name="${def.k}"${req}>
        ${def.vide !== false ? `<option value="">— Choisir —</option>` : ""}
        ${opts.map(([v, l]) => `<option value="${esc(v)}"${v === valeur ? " selected" : ""}>${esc(l)}</option>`).join("")}
        ${valeur && !opts.some(([v]) => v === valeur) ? `<option value="${esc(valeur)}" selected>${esc(valeur)}</option>` : ""}
      </select>`;
      break;
    case "cases": {
      const choisis = new Set(liste(valeur));
      const hors = [...choisis].filter((v) => !opts.some(([o]) => o === v));
      html = `<div class="cases" id="${id}">
        ${[...opts, ...hors.map((v) => [v, v])]
          .map(
            ([v, l]) =>
              `<label><input type="checkbox" name="${def.k}" value="${esc(v)}"${choisis.has(v) ? " checked" : ""} hidden />${esc(l)}</label>`,
          )
          .join("")}
      </div>`;
      break;
    }
    case "case":
      return `<div class="${cls || "large"}"><label class="label"><input type="checkbox" name="${def.k}"${
        valeur ? " checked" : ""
      } /> ${esc(def.label)}</label>${def.aide ? `<p class="aide">${esc(def.aide)}</p>` : ""}</div>`;
    default:
      html = `<input class="champ" id="${id}" name="${def.k}" type="${def.type || "text"}" value="${esc(valeur)}"${
        def.liste ? ` list="${id}-liste"` : ""
      }${req} />${
        def.liste ? `<datalist id="${id}-liste">${def.liste.map((x) => `<option value="${esc(x)}">`).join("")}</datalist>` : ""
      }`;
  }
  return `<div class="${cls}">
    <label class="label" for="${id}">${esc(def.label)}${def.requis ? " *" : ""}</label>${html}
    ${def.aide ? `<p class="aide">${esc(def.aide)}</p>` : ""}
  </div>`;
}

function lireFormulaire(form, defs) {
  const fd = new FormData(form);
  const o = {};
  for (const def of defs) {
    if (def.type === "cases") o[def.k] = fd.getAll(def.k);
    else if (def.type === "case") o[def.k] = fd.has(def.k);
    else o[def.k] = String(fd.get(def.k) ?? "").trim();
  }
  return o;
}

/* ---------------------------------------------------------------- *
 * 4. Modale
 * ---------------------------------------------------------------- */
const modale = () => $("[data-modale]");

function ouvrirModale({ titre, corps, pied = "", sousTitre = "" }) {
  const m = modale();
  m.innerHTML = `
    <form method="dialog" data-modale-form novalidate>
      <div class="modale-tete">
        <h2>${esc(titre)}</h2>${sousTitre}
        <button type="button" class="btn btn-lien" data-croix aria-label="Fermer">✕</button>
      </div>
      <div class="modale-corps">${corps}</div>
      ${pied ? `<div class="modale-pied">${pied}</div>` : ""}
    </form>`;
  $("[data-croix]", m).addEventListener("click", fermerModale);
  // Seul le bouton « enregistrer » soumet : Entrée dans un champ ne ferme rien.
  $("[data-modale-form]", m).addEventListener("submit", (e) => {
    if (e.submitter?.value !== "enregistrer") e.preventDefault();
  });
  if (!m.open) m.showModal();
  $(".modale-corps :is(input:not([type=checkbox]), select, textarea)", m)?.focus();
  return m;
}
const fermerModale = () => modale().open && modale().close();

/* ---------------------------------------------------------------- *
 * 5. Membres
 * ---------------------------------------------------------------- */
function optionsMembre() {
  const r = refCourant();
  return {
    secteurs: Object.keys(r.secteurs || {}),
    metiers: Object.values(r.metiers || {}).flatMap((l) => l.map((x) => x[0])),
    besoins: Object.values(r.besoins || {}).map((b) => [b.id, b.court || b.label]),
    apports: Object.values(r.apports || {}).map((a) => [a.id, a.label]),
    niveaux: (r.niveaux || []).map((n) => n.label),
    ages: (r.ages || []).map((a) => [a.id, a.label]),
    interets: r.interets || [],
    familles: r.familles || FAMILLES_DEFAUT,
  };
}

function champsMembre() {
  const o = optionsMembre();
  return [
    { k: "nom", label: "Nom et prénoms", requis: true, large: true },
    { k: "secteurs", label: "Secteurs", type: "cases", options: o.secteurs },
    {
      k: "metiers",
      label: "Métiers",
      large: true,
      liste: o.metiers,
      aide: "Séparés par des virgules. Le premier est affiché en priorité.",
    },
    { k: "experience", label: "Niveau d’expérience", type: "select", options: o.niveaux, requis: true },
    { k: "age", label: "Tranche d’âge", type: "select", options: o.ages },
    { k: "ville", label: "Ville" },
    { k: "commune", label: "Commune" },
    { k: "quartier", label: "Quartier" },
    { k: "departement", label: "Département / ministère" },
    { k: "famille", label: "Famille d’église", liste: o.familles },
    { k: "besoins", label: "Recherche (besoins)", type: "cases", options: o.besoins },
    { k: "apports", label: "Peut apporter", type: "cases", options: o.apports },
    { k: "interets", label: "Centres d’intérêt", type: "cases", options: o.interets },
    {
      k: "publie",
      label: "Publié dans l’annuaire public",
      type: "case",
      aide: "Décoché : le profil reste en base mais n’apparaît plus sur le site.",
    },
  ];
}

const initiales = (nom) =>
  String(nom)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((m) => m[0].toUpperCase())
    .join("");

/** Complète les champs dérivés attendus par le site public (site.js). */
function normaliserMembre(saisie) {
  const niveau = (refCourant().niveaux || []).find((n) => n.label === saisie.experience);
  const secteurs = liste(saisie.secteurs);
  const metiers = Array.isArray(saisie.metiers)
    ? liste(saisie.metiers)
    : String(saisie.metiers || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
  return {
    nom: saisie.nom,
    initiales: initiales(saisie.nom),
    secteurs: secteurs.length ? secteurs : ["Autre"],
    secteur: secteurs[0] || "Autre",
    metiers,
    metier: metiers[0] || "",
    experience: saisie.experience || "Débutant",
    niveau: niveau?.id || "debutant",
    rang: niveau?.rang ?? 0,
    ville: saisie.ville || "",
    commune: saisie.commune || "",
    quartier: saisie.quartier || "",
    zone: saisie.quartier || saisie.commune || "Non précisée",
    departement: saisie.departement || "",
    famille: saisie.famille || "",
    besoins: liste(saisie.besoins),
    apports: liste(saisie.apports),
    age: saisie.age || "",
    interets: liste(saisie.interets),
    publie: Boolean(saisie.publie),
  };
}

/** Pré-remplit un profil à partir d'une inscription du formulaire « Rejoindre ». */
function membreDepuisInscription(i) {
  const besoinsRef = Object.values(refCourant().besoins || {});
  const besoins = liste(i.besoins)
    .map((v) => besoinsRef.find((b) => [b.id, b.court, b.label].map(sansAccents).includes(sansAccents(v)))?.id)
    .filter(Boolean);
  return {
    nom: i.nom || [i.prenom, i.nom].filter(Boolean).join(" "),
    secteurs: liste(i.secteurs),
    metiers: [...liste(i.metiers), ...liste(i.autre_metier)],
    experience: i.experience,
    age: i.age,
    ville: i.ville,
    commune: i.commune,
    quartier: i.quartier,
    departement: i.departement,
    famille: i.famille,
    besoins,
    apports: [],
    interets: liste(i.interets),
    publie: true,
  };
}

function editerMembre(membre, { depuisInscription } = {}) {
  const nouveau = !membre?.id;
  const valeurs = { publie: true, ...membre, metiers: liste(membre?.metiers).join(", ") };
  const defs = champsMembre();
  const vide = docs("membres").length === 0;

  const m = ouvrirModale({
    titre: nouveau ? "Nouveau membre" : membre.nom,
    corps: `
      ${
        vide
          ? `<p class="alerte alerte-orange">La base Firestore ne contient encore aucun membre : dès le premier profil
             publié, le site n’affichera plus que les profils Firestore. Importez d’abord le fichier statique
             depuis l’écran « Membres ».</p>`
          : ""
      }
      ${
        depuisInscription?.apport
          ? `<p class="alerte alerte-info"><span><b>Ce que la personne propose d’apporter :</b> ${esc(depuisInscription.apport)}</span></p>`
          : ""
      }
      <div class="grille-form">${defs.map((d) => champ(d, valeurs[d.k])).join("")}</div>
      <p class="aide">Les coordonnées (e-mail, téléphone) ne sont jamais copiées dans le profil public :
        elles restent dans l’inscription d’origine.</p>`,
    pied: `
      ${nouveau ? "" : `<button type="button" class="btn btn-danger gauche" data-supprimer data-ecriture>Supprimer</button>`}
      <button type="button" class="btn btn-secondaire" data-fermer>${peut("gestion") ? "Annuler" : "Fermer"}</button>
      <button type="submit" class="btn btn-primaire" value="enregistrer" data-ecriture>${nouveau ? "Créer le profil" : "Enregistrer"}</button>`,
  });
  if (!peut("gestion")) lectureSeule(m);

  const form = $("[data-modale-form]", m);
  $("[data-fermer]", m).addEventListener("click", fermerModale);
  form.addEventListener("submit", async (e) => {
    if (e.submitter?.value !== "enregistrer") return;
    e.preventDefault();
    if (!form.reportValidity()) return;
    const bouton = e.submitter;
    bouton.disabled = true;
    const donnees = { ...normaliserMembre(lireFormulaire(form, defs)), majLe: serverTimestamp() };
    const ok = await action(async () => {
      if (nouveau) {
        const ref = doc(collection(db, "membres"));
        await setDoc(ref, {
          ...donnees,
          id: ref.id,
          creeLe: serverTimestamp(),
          ...(depuisInscription ? { inscriptionId: depuisInscription.id } : {}),
        });
        if (depuisInscription)
          await updateDoc(doc(db, "inscriptions", depuisInscription.id), {
            statut: "validee",
            membreId: ref.id,
            majLe: serverTimestamp(),
          });
      } else {
        await updateDoc(doc(db, "membres", membre.id), donnees);
      }
    }, nouveau ? "Profil créé." : "Profil enregistré.");
    bouton.disabled = false;
    if (ok) fermerModale();
  });

  $("[data-supprimer]", m)?.addEventListener("click", async () => {
    if (!confirm(`Supprimer définitivement le profil de ${membre.nom} ?`)) return;
    if (await action(() => deleteDoc(doc(db, "membres", membre.id)), "Profil supprimé.")) fermerModale();
  });
}

async function importerMembres() {
  const existants = new Set(docs("membres").map((m) => m.id));
  const aImporter = etat.statiques.filter((m) => !existants.has(m.id));
  if (!aImporter.length) return toast("Tous les membres du fichier statique sont déjà en base.");
  if (!confirm(`Importer ${aImporter.length} membre(s) du fichier data/membres.json dans Firestore ?\nLes profils déjà en base ne sont pas modifiés.`))
    return;
  await action(async () => {
    for (let i = 0; i < aImporter.length; i += 400) {
      const lot = writeBatch(db);
      aImporter.slice(i, i + 400).forEach((m) =>
        lot.set(doc(db, "membres", m.id), {
          ...m,
          publie: true,
          source: "import",
          creeLe: serverTimestamp(),
          majLe: serverTimestamp(),
        }),
      );
      await lot.commit();
    }
  }, `${aImporter.length} membre(s) importé(s).`);
}

/** Régénère data/membres.json depuis Firestore (repli statique du site). */
function exporterMembres() {
  const CHAMPS = Object.keys(normaliserMembre({ nom: "" })).filter((k) => k !== "publie");
  const membres = docs("membres")
    .filter((m) => m.publie)
    .sort((a, b) => String(a.id).localeCompare(String(b.id)))
    .map((m) => Object.fromEntries([["id", m.id], ...CHAMPS.map((k) => [k, m[k] ?? ""])]));
  const fichier = {
    genereLe: new Date().toISOString(),
    confidentialite: etat.fichier?.confidentialite || "Aucune donnée de contact (email, téléphone, adresse) n'est publiée.",
    referentiels: refCourant(),
    membres,
  };
  const url = URL.createObjectURL(new Blob([JSON.stringify(fichier)], { type: "application/json" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: "membres.json" });
  a.click();
  URL.revokeObjectURL(url);
}

function vueMembres() {
  const f = (etat.filtres.membres ||= { q: "", publie: "" });
  const q = sansAccents(f.q);
  const tous = docs("membres");
  const lignes = [...tous].sort((a, b) => String(a.nom).localeCompare(String(b.nom), "fr")).filter(
    (m) =>
      (!f.publie || String(Boolean(m.publie)) === f.publie) &&
      (!q || sansAccents([m.nom, m.secteur, liste(m.metiers).join(" "), m.commune, m.quartier].join(" ")).includes(q)),
  );
  const manquants = etat.statiques.filter((s) => !tous.some((m) => m.id === s.id)).length;

  return `
    <div class="entete-vue">
      <h1>Membres <span class="muted">(${tous.length})</span></h1>
      ${manquants && peut("gestion") ? `<button class="btn btn-secondaire" data-importer>Importer le fichier statique (${manquants})</button>` : ""}
      <button class="btn btn-secondaire" data-exporter ${tous.length ? "" : "disabled"}>Exporter membres.json</button>
      ${peut("gestion") ? `<button class="btn btn-accent" data-nouveau>+ Nouveau membre</button>` : ""}
    </div>
    ${
      !tous.length && peut("gestion")
        ? `<div class="alerte alerte-orange"><p>Aucun membre en base. Le site affiche aujourd’hui les ${etat.statiques.length}
           profils du fichier <code>data/membres.json</code>. Importez-les pour pouvoir les modifier ici.</p>
           <button class="btn btn-accent" data-importer>Importer les ${etat.statiques.length} profils</button></div>`
        : ""
    }
    <div class="outils">
      <input class="champ" type="search" placeholder="Rechercher un nom, un métier, une commune…" value="${esc(f.q)}" data-filtre="q" />
      <select class="champ" data-filtre="publie">
        <option value="">Tous</option>
        <option value="true"${f.publie === "true" ? " selected" : ""}>Publiés</option>
        <option value="false"${f.publie === "false" ? " selected" : ""}>Masqués</option>
      </select>
    </div>
    <div class="carte table-wrap">
      ${
        lignes.length
          ? `<table><thead><tr><th>Nom</th><th>Secteur / métier</th><th class="col-option">Zone</th><th class="col-option">Niveau</th><th>État</th></tr></thead>
        <tbody>${lignes
          .map(
            (m) => `<tr data-id="${esc(m.id)}">
            <td><b>${esc(m.nom)}</b><span class="sous">${esc(m.departement || m.famille || "")}</span></td>
            <td>${esc(m.secteur)}<span class="sous">${esc(m.metier || "")}</span></td>
            <td class="col-option">${esc(m.zone)}</td>
            <td class="col-option">${esc(m.experience)}</td>
            <td>${m.publie ? `<span class="pastille p-vert">Publié</span>` : `<span class="pastille p-gris">Masqué</span>`}</td>
          </tr>`,
          )
          .join("")}</tbody></table>`
          : `<p class="vide">Aucun membre ne correspond.</p>`
      }
    </div>`;
}

function brancherMembres(v) {
  $$("[data-importer]", v).forEach((b) => b.addEventListener("click", importerMembres));
  $("[data-exporter]", v).addEventListener("click", exporterMembres);
  $("[data-nouveau]", v)?.addEventListener("click", () => editerMembre(null));
  $$("tbody tr", v).forEach((tr) =>
    tr.addEventListener("click", () => editerMembre(docs("membres").find((m) => m.id === tr.dataset.id))),
  );
}

/* ---------------------------------------------------------------- *
 * 6. Offres d'emploi
 * ---------------------------------------------------------------- */
const CONTRATS = ["CDI", "CDD", "Stage", "Alternance", "Mission / freelance", "Temps partiel", "Bénévolat"];

function champsOffre() {
  const o = optionsMembre();
  return [
    { k: "titre", label: "Intitulé du poste", requis: true, large: true },
    { k: "entreprise", label: "Entreprise / structure" },
    { k: "contrat", label: "Contrat", type: "select", options: CONTRATS, requis: true },
    { k: "secteur", label: "Secteur", type: "select", options: o.secteurs },
    { k: "metier", label: "Métier", liste: o.metiers },
    { k: "lieu", label: "Lieu" },
    { k: "experience", label: "Expérience demandée", type: "select", options: o.niveaux },
    { k: "publieeLe", label: "Publiée le", type: "date", requis: true },
    { k: "expireLe", label: "Expire le", type: "date", aide: "Facultatif. Passée cette date, l’offre disparaît du site." },
    { k: "description", label: "Description", type: "textarea", lignes: 6, requis: true },
    { k: "contact", label: "Contact (interne)", large: true, aide: "Non affiché sur le site." },
    { k: "publie", label: "Publiée sur la page Emploi", type: "case" },
  ];
}

function editerOffre(offre, { depuisProposition } = {}) {
  const nouveau = !offre?.id;
  const valeurs = { publie: true, publieeLe: aujourdhui(), ...offre };
  const defs = champsOffre();
  const m = ouvrirModale({
    titre: nouveau ? "Nouvelle offre" : offre.titre,
    corps: `<div class="grille-form">${defs.map((d) => champ(d, valeurs[d.k])).join("")}</div>`,
    pied: `
      ${nouveau ? "" : `<button type="button" class="btn btn-danger gauche" data-supprimer data-ecriture>Supprimer</button>`}
      <button type="button" class="btn btn-secondaire" data-fermer>${peut("gestion") ? "Annuler" : "Fermer"}</button>
      <button type="submit" class="btn btn-primaire" value="enregistrer" data-ecriture>${nouveau ? "Créer l’offre" : "Enregistrer"}</button>`,
  });
  if (!peut("gestion")) lectureSeule(m);
  const form = $("[data-modale-form]", m);
  $("[data-fermer]", m).addEventListener("click", fermerModale);
  form.addEventListener("submit", async (e) => {
    if (e.submitter?.value !== "enregistrer") return;
    e.preventDefault();
    if (!form.reportValidity()) return;
    const donnees = { ...lireFormulaire(form, defs), majLe: serverTimestamp() };
    e.submitter.disabled = true;
    const ok = await action(async () => {
      if (nouveau) {
        const ref = await addDoc(collection(db, "offres"), {
          ...donnees,
          creeLe: serverTimestamp(),
          ...(depuisProposition ? { propositionId: depuisProposition.id } : {}),
        });
        if (depuisProposition)
          await updateDoc(doc(db, "offres_proposees", depuisProposition.id), {
            statut: "publiee",
            offreId: ref.id,
            majLe: serverTimestamp(),
          });
      } else await updateDoc(doc(db, "offres", offre.id), donnees);
    }, nouveau ? "Offre créée." : "Offre enregistrée.");
    e.submitter.disabled = false;
    if (ok) fermerModale();
  });
  $("[data-supprimer]", m)?.addEventListener("click", async () => {
    if (!confirm(`Supprimer l’offre « ${offre.titre} » ?`)) return;
    if (await action(() => deleteDoc(doc(db, "offres", offre.id)), "Offre supprimée.")) fermerModale();
  });
}

function etatOffre(o) {
  if (!o.publie) return `<span class="pastille p-gris">Brouillon</span>`;
  if (o.expireLe && o.expireLe < aujourdhui()) return `<span class="pastille p-rouge">Expirée</span>`;
  return `<span class="pastille p-vert">En ligne</span>`;
}

function vueOffres() {
  const lignes = [...docs("offres")].sort((a, b) => String(b.publieeLe).localeCompare(String(a.publieeLe)));
  return `
    <div class="entete-vue">
      <h1>Offres d’emploi <span class="muted">(${lignes.length})</span></h1>
      ${peut("gestion") ? `<button class="btn btn-accent" data-nouveau>+ Nouvelle offre</button>` : ""}
    </div>
    <div class="carte table-wrap">
      ${
        lignes.length
          ? `<table><thead><tr><th>Poste</th><th>Contrat</th><th class="col-option">Lieu</th><th class="col-option">Publiée</th><th>État</th></tr></thead>
        <tbody>${lignes
          .map(
            (o) => `<tr data-id="${esc(o.id)}">
            <td><b>${esc(o.titre)}</b><span class="sous">${esc(o.entreprise || "")}</span></td>
            <td>${esc(o.contrat)}</td>
            <td class="col-option">${esc(o.lieu || "—")}</td>
            <td class="col-option">${esc(o.publieeLe || "—")}${o.expireLe ? `<span class="sous">→ ${esc(o.expireLe)}</span>` : ""}</td>
            <td>${etatOffre(o)}</td></tr>`,
          )
          .join("")}</tbody></table>`
          : `<p class="vide">Aucune offre. Les offres créées ici s’affichent sur la page Emploi du site.</p>`
      }
    </div>`;
}

function brancherOffres(v) {
  $("[data-nouveau]", v)?.addEventListener("click", () => editerOffre(null));
  $$("tbody tr", v).forEach((tr) =>
    tr.addEventListener("click", () => editerOffre(docs("offres").find((o) => o.id === tr.dataset.id))),
  );
}

/* ---------------------------------------------------------------- *
 * 7. Demandes entrantes (inscriptions, accompagnements, …)
 * ---------------------------------------------------------------- */
const SIGNATURE = "\n\nBien fraternellement,\nLe secrétariat MISI — ICC Riviera 2";

const FILES = {
  inscriptions: {
    titre: "Inscriptions",
    statuts: { a_valider: ["À valider", "orange"], validee: ["Validée", "vert"], refusee: ["Refusée", "rouge"] },
    resume: (d) => [d.nom, liste(d.secteurs).join(", ")],
    colonne: ["Commune", (d) => d.commune || d.ville],
    objet: "Votre inscription à l’Annuaire des compétences MISI",
    modeles: [
      ["Inscription validée", "Bonjour {prenom},\n\nBonne nouvelle : votre inscription à l’Annuaire des compétences ICC Riviera 2 est validée. Votre profil est visible ici : {site}annuaire.html\n\nMerci pour votre engagement au service de la communauté."],
      ["Demande de précisions", "Bonjour {prenom},\n\nMerci pour votre inscription à l’Annuaire des compétences ICC Riviera 2. Avant de publier votre profil, pourriez-vous nous préciser :\n\n- "],
      ["Inscription non retenue", "Bonjour {prenom},\n\nMerci pour votre inscription à l’Annuaire des compétences ICC Riviera 2. Nous ne pouvons pas publier votre profil en l’état, car "],
    ],
  },
  accompagnements: {
    titre: "Accompagnements de projet",
    statuts: {
      a_traiter: ["À traiter", "orange"],
      en_cours: ["En cours", "bleu"],
      planifie: ["RDV planifié", "bleu"],
      clos: ["Clos", "gris"],
    },
    resume: (d) => [d.titre || "Projet sans titre", [d.prenom, d.nom].filter(Boolean).join(" ")],
    colonne: ["Secteur", (d) => d.secteur],
    objet: "Votre demande d’accompagnement — MISI",
    modeles: [
      ["Proposition de rendez-vous", "Bonjour {prenom},\n\nNous avons bien reçu votre demande d’accompagnement pour le projet « {titre} ». Nous vous proposons un premier échange le :\n\n- \n\nMerci de nous confirmer ce créneau."],
      ["Accusé de réception", "Bonjour {prenom},\n\nNous avons bien reçu votre demande d’accompagnement pour le projet « {titre} ». Nous l’étudions et revenons vers vous très vite avec un ou plusieurs accompagnateurs."],
    ],
  },
  demandes: {
    titre: "Demandes Apex IA",
    statuts: { a_traiter: ["À traiter", "orange"], repondu: ["Répondu", "bleu"], clos: ["Clos", "gris"] },
    resume: (d) => [[d.prenom, d.nom].filter(Boolean).join(" ") || "Anonyme", d.email || d.telephone],
    colonne: ["Page", (d) => d.origine],
    objet: "Votre demande — Annuaire MISI",
    modeles: [
      ["Prise de contact", "Bonjour {prenom},\n\nVous avez laissé vos coordonnées sur l’assistant du site de l’Annuaire des compétences MISI. Comment pouvons-nous vous aider ?"],
    ],
  },
  candidatures: {
    titre: "Candidatures spontanées",
    statuts: { a_traiter: ["À traiter", "orange"], repondu: ["Répondu", "bleu"], clos: ["Clos", "gris"] },
    resume: (d) => [d.nom, d.poste],
    colonne: ["Secteur", (d) => d.secteur],
    objet: "Votre candidature — Espace emploi MISI",
    modeles: [
      ["Accusé de réception", "Bonjour {prenom},\n\nNous avons bien reçu votre candidature{poste}. Nous vous recontactons dès qu’une opportunité correspond à votre profil."],
      ["Proposition d’entretien", "Bonjour {prenom},\n\nUne opportunité pourrait correspondre à votre candidature{poste}. Seriez-vous disponible pour un échange le :\n\n- "],
    ],
  },
  offres_proposees: {
    titre: "Offres proposées",
    statuts: { a_traiter: ["À traiter", "orange"], publiee: ["Publiée", "vert"], refusee: ["Refusée", "rouge"] },
    resume: (d) => [d.titre, d.entreprise],
    colonne: ["Contrat", (d) => d.contrat],
    objet: "Votre offre d’emploi — Espace emploi MISI",
    modeles: [
      ["Offre publiée", "Bonjour,\n\nVotre offre « {titre} » est publiée sur l’Espace emploi de l’Annuaire MISI : {site}emploi.html\n\nMerci de nous prévenir dès que le poste est pourvu."],
      ["Demande de précisions", "Bonjour,\n\nMerci pour votre offre « {titre} ». Avant de la publier, pourriez-vous nous préciser :\n\n- "],
    ],
  },
};

const statutDe = (nom, d) => (d.statut && FILES[nom].statuts[d.statut] ? d.statut : Object.keys(FILES[nom].statuts)[0]);
const enAttente = (nom) => docs(nom).filter((d) => statutDe(nom, d) === Object.keys(FILES[nom].statuts)[0]).length;

function pastilleStatut(nom, d) {
  const [lib, ton] = FILES[nom].statuts[statutDe(nom, d)];
  return `<span class="pastille p-${ton}">${esc(lib)}</span>`;
}

const LIBELLES = {
  prenom: "Prénom", nom: "Nom", email: "E-mail", telephone: "Téléphone", contact: "Contact",
  titre: "Titre", entreprise: "Structure / entreprise", poste: "Poste recherché", contrat: "Contrat",
  ville: "Ville", commune: "Commune", quartier: "Quartier", lieu: "Lieu", age: "Tranche d’âge",
  departement: "Département / ministère", famille: "Famille d’église",
  secteurs: "Secteurs", secteur: "Secteur", metiers: "Métiers", metier: "Métier", autre_metier: "Autre métier",
  experience: "Expérience", disponibilite: "Disponibilité", lien_cv: "Lien CV",
  besoins: "Objectifs de connexion", apport: "Peut apporter", interets: "Centres d’intérêt",
  stade: "Stade du projet", description: "Description", blocage: "Blocage principal", aides: "Aides souhaitées",
  formats: "Formats", jours: "Jours", creneaux: "Créneaux", delai: "Délai", message: "Message",
  origine: "Page d’origine", consentement: "Consentement",
};
const INTERNES = new Set(["id", "statut", "creeLe", "majLe", "reponses", "notes", "membreId", "offreId", "inscription"]);

function fiche(d) {
  const cles = [
    ...Object.keys(LIBELLES).filter((k) => k in d),
    ...Object.keys(d).filter((k) => !(k in LIBELLES) && !INTERNES.has(k)),
  ];
  return `<dl class="fiche">${cles
    .filter((k) => liste(d[k]).length)
    .map((k) => {
      const v = liste(d[k]).join(", ");
      const lien = k === "lien_cv" && /^https?:\/\//i.test(v) ? `<a href="${esc(v)}" target="_blank" rel="noopener noreferrer">${esc(v)}</a>` : esc(v);
      return `<dt>${esc(LIBELLES[k] || k)}</dt><dd>${lien}</dd>`;
    })
    .join("")}</dl>`;
}

function contactDe(d) {
  const brut = String(d.contact || "");
  return {
    nom: [d.prenom, d.nom].filter(Boolean).join(" ") || brut.replace(/\S+@\S+|[+\d][\d\s.-]{7,}/g, "").trim(),
    prenom: d.prenom || String(d.nom || "").split(/\s+/)[0] || "",
    email: d.email || brut.match(/[^\s@]+@[^\s@]+\.[^\s@]+/)?.[0] || "",
    telephone: d.telephone || brut.match(/[+\d][\d\s.-]{7,}\d/)?.[0] || "",
  };
}

/** Numéro au format wa.me (indicatif ivoirien par défaut). */
function numeroWhatsApp(tel) {
  let n = String(tel || "").replace(/\D/g, "");
  if (n.startsWith("00")) n = n.slice(2);
  if (n.length === 10 || n.length === 8) n = "225" + n;
  return n;
}

function remplirModele(texte, d) {
  const c = contactDe(d);
  return (
    texte
      .replaceAll("{prenom}", c.prenom || "")
      .replaceAll("{titre}", d.titre || "")
      .replaceAll("{poste}", d.poste ? ` pour le poste « ${d.poste} »` : "")
      .replaceAll("{site}", URL_SITE)
      .replace("Bonjour ,", "Bonjour,") + (reglages().signature ? "\n\n" + reglages().signature : SIGNATURE)
  );
}

function ouvrirDemande(nom, d) {
  const cfg = FILES[nom];
  const c = contactDe(d);
  const statut = statutDe(nom, d);
  const reponses = liste(d.reponses);

  const actionsSpecifiques = !peut("gestion")
    ? ""
    : nom === "inscriptions" && statut !== "validee"
      ? `<button type="button" class="btn btn-accent" data-valider>Valider → créer le profil</button>`
      : nom === "inscriptions" && d.membreId
        ? `<button type="button" class="btn btn-secondaire" data-voir-membre>Voir le profil</button>`
        : nom === "offres_proposees" && statut !== "publiee"
          ? `<button type="button" class="btn btn-accent" data-publier-offre>Publier comme offre</button>`
          : "";

  const m = ouvrirModale({
    titre: cfg.resume(d)[0] || cfg.titre,
    sousTitre: pastilleStatut(nom, d),
    corps: `
      <p class="muted">Reçue le ${esc(dateLongue(d.creeLe))}${d.majLe ? ` · mise à jour le ${esc(dateLongue(d.majLe))}` : ""}</p>
      ${fiche(d)}
      <div class="grille-form">
        ${champ({ k: "statut", label: "Statut", type: "select", vide: false, options: Object.entries(cfg.statuts).map(([k, [l]]) => [k, l]) }, statut)}
        <div></div>
        ${champ({ k: "notes", label: "Notes internes", type: "textarea", lignes: 3 }, d.notes)}
      </div>
      <h3 style="margin-top:18px">Réponses envoyées (${reponses.length})</h3>
      ${
        reponses.length
          ? `<ul class="historique">${reponses
              .map(
                (r) =>
                  `<li><small>${esc(dateLongue(r.le))} · ${esc(r.canal)} · ${esc(r.par || "")} ${r.mailId ? etatEnvoi(r.mailId) : ""}</small>${esc(r.texte)}</li>`,
              )
              .join("")}</ul>`
          : `<p class="muted">Aucune réponse pour l’instant.</p>`
      }`,
    pied: `
      ${peut("gestion") ? `<button type="button" class="btn btn-danger gauche" data-supprimer>Supprimer</button>` : ""}
      ${actionsSpecifiques}
      ${peut("traitement") ? `<button type="button" class="btn btn-secondaire" data-repondre ${c.email || c.telephone ? "" : "disabled title='Aucune coordonnée'"}>Répondre</button>
      <button type="submit" class="btn btn-primaire" value="enregistrer">Enregistrer</button>` : ""}`,
  });
  if (!peut("traitement")) lectureSeule(m);

  const form = $("[data-modale-form]", m);
  form.addEventListener("submit", async (e) => {
    if (e.submitter?.value !== "enregistrer") return;
    e.preventDefault();
    const { statut: s, notes } = lireFormulaire(form, [{ k: "statut" }, { k: "notes" }]);
    if (await action(() => updateDoc(doc(db, nom, d.id), { statut: s, notes, majLe: serverTimestamp() }), "Enregistré.")) fermerModale();
  });
  $("[data-supprimer]", m)?.addEventListener("click", async () => {
    if (!confirm("Supprimer définitivement cet élément ? Les coordonnées associées seront perdues.")) return;
    if (await action(() => deleteDoc(doc(db, nom, d.id)), "Supprimé.")) fermerModale();
  });
  $("[data-repondre]", m)?.addEventListener("click", () => repondre(nom, d));
  $("[data-valider]", m)?.addEventListener("click", () => editerMembre(membreDepuisInscription(d), { depuisInscription: d }));
  $("[data-voir-membre]", m)?.addEventListener("click", () => {
    const membre = docs("membres").find((x) => x.id === d.membreId);
    membre ? editerMembre(membre) : toast("Le profil lié n’existe plus.", true);
  });
  $("[data-publier-offre]", m)?.addEventListener("click", () => {
    const { contact, consentement, statut: _s, notes: _n, reponses: _r, creeLe: _c, majLe: _m, id: _i, ...offre } = d;
    editerOffre({ ...offre, contact, publie: true, publieeLe: aujourdhui() }, { depuisProposition: d });
  });
}

const ETATS_ENVOI = {
  SUCCESS: ["Délivré", "vert"],
  ERROR: ["Échec d’envoi", "rouge"],
  PROCESSING: ["Envoi en cours", "bleu"],
  RETRY: ["Nouvel essai", "orange"],
};

/** État d'un e-mail confié à l'extension (champ delivery qu'elle renseigne). */
function etatEnvoi(mailId) {
  const mail = docs("mail").find((x) => x.id === mailId);
  if (!mail) return `<span class="pastille p-gris">Journal supprimé</span>`;
  const [lib, ton] = ETATS_ENVOI[mail.delivery?.state] || ["En attente d’envoi", "orange"];
  const erreur = mail.delivery?.state === "ERROR" && mail.delivery.error ? ` title="${esc(mail.delivery.error)}"` : "";
  return `<span class="pastille p-${ton}"${erreur}>${esc(lib)}</span>`;
}

function repondre(nom, d) {
  const cfg = FILES[nom];
  const c = contactDe(d);
  const direct = Boolean(reglages().envoiDirect && c.email);
  const modeles = [...cfg.modeles, ["Message libre", "Bonjour {prenom},\n\n"]];
  const statuts = Object.entries(cfg.statuts).map(([k, [l]]) => [k, l]);
  const suivant = { a_valider: "a_valider", a_traiter: nom === "accompagnements" ? "en_cours" : "repondu" }[statutDe(nom, d)] || statutDe(nom, d);

  const m = ouvrirModale({
    titre: `Répondre à ${c.nom || "la personne"}`,
    corps: `
      <p class="muted">${c.email ? `E-mail : <b>${esc(c.email)}</b>` : ""} ${c.telephone ? ` · Téléphone : <b>${esc(c.telephone)}</b>` : ""}</p>
      <div class="grille-form">
        ${champ({ k: "modele", label: "Modèle", type: "select", vide: false, options: modeles.map((x, i) => [String(i), x[0]]) }, "0")}
        ${champ({ k: "statut", label: "Statut après envoi", type: "select", vide: false, options: statuts }, suivant)}
        ${champ({ k: "objet", label: "Objet (e-mail)", large: true }, cfg.objet)}
        ${champ({ k: "texte", label: "Message", type: "textarea", lignes: 10 }, remplirModele(modeles[0][1], d))}
      </div>
      <p class="aide">${
        direct
          ? "« Envoyer l’e-mail » part directement depuis le serveur ; son état de délivrance s’affiche dans l’historique."
          : "L’envoi ouvre votre messagerie ou WhatsApp avec le message prêt"
      } ; la réponse est consignée dans l’historique.</p>`,
    pied: `
      <button type="button" class="btn btn-secondaire gauche" data-copier>Copier</button>
      ${c.telephone ? `<button type="button" class="btn btn-secondaire" data-canal="whatsapp">Envoyer par WhatsApp</button>` : ""}
      ${c.email ? `<button type="button" class="btn ${direct ? "btn-secondaire" : "btn-primaire"}" data-canal="email">${direct ? "Ouvrir dans ma messagerie" : "Envoyer par e-mail"}</button>` : ""}
      ${direct ? `<button type="button" class="btn btn-primaire" data-canal="direct">Envoyer l’e-mail</button>` : ""}`,
  });

  const form = $("[data-modale-form]", m);
  $("[name=modele]", m).addEventListener("change", (e) => {
    $("[name=texte]", m).value = remplirModele(modeles[Number(e.target.value)][1], d);
  });
  $("[data-copier]", m).addEventListener("click", () => {
    navigator.clipboard?.writeText($("[name=texte]", m).value);
    toast("Message copié.");
  });
  $$("[data-canal]", m).forEach((b) =>
    b.addEventListener("click", async () => {
      const { objet, texte, statut } = lireFormulaire(form, [{ k: "objet" }, { k: "texte" }, { k: "statut" }]);
      if (!texte) return toast("Le message est vide.", true);
      const canal = b.dataset.canal;
      const reponse = { le: Timestamp.now(), canal, objet: canal === "whatsapp" ? "" : objet, texte, par: etat.utilisateur.email };
      let ok;

      if (canal === "direct") {
        // Le document mail est envoyé par l'extension, qui y inscrit ensuite delivery.state.
        b.disabled = true;
        const mail = doc(collection(db, "mail"));
        const lot = writeBatch(db);
        lot.set(mail, {
          to: [c.email],
          ...(reglages().replyTo ? { replyTo: reglages().replyTo } : {}),
          message: { subject: objet, text: texte },
          source: { collection: nom, id: d.id },
          par: etat.utilisateur.email,
          creeLe: serverTimestamp(),
        });
        lot.update(doc(db, nom, d.id), {
          statut,
          majLe: serverTimestamp(),
          reponses: arrayUnion({ ...reponse, mailId: mail.id }),
        });
        ok = await action(() => lot.commit(), "E-mail confié à l’envoi.");
        b.disabled = false;
      } else {
        const lien =
          canal === "email"
            ? `mailto:${encodeURIComponent(c.email)}?subject=${encodeURIComponent(objet)}&body=${encodeURIComponent(texte)}`
            : `https://wa.me/${numeroWhatsApp(c.telephone)}?text=${encodeURIComponent(texte)}`;
        window.open(lien, "_blank", "noopener");
        ok = await action(
          () => updateDoc(doc(db, nom, d.id), { statut, majLe: serverTimestamp(), reponses: arrayUnion(reponse) }),
          "Réponse consignée.",
        );
      }
      if (ok) fermerModale();
    }),
  );
}

function vueFile(nom) {
  const cfg = FILES[nom];
  const f = (etat.filtres[nom] ||= { q: "", statut: Object.keys(cfg.statuts)[0] });
  const q = sansAccents(f.q);
  const tous = docs(nom);
  const lignes = tous.filter(
    (d) =>
      (!f.statut || statutDe(nom, d) === f.statut) &&
      (!q || sansAccents(Object.values(d).filter((v) => typeof v === "string" || Array.isArray(v)).flat().join(" ")).includes(q)),
  );
  const [libCol, valCol] = cfg.colonne;

  return `
    <div class="entete-vue"><h1>${esc(cfg.titre)} <span class="muted">(${tous.length})</span></h1></div>
    <div class="outils">
      <input class="champ" type="search" placeholder="Rechercher…" value="${esc(f.q)}" data-filtre="q" />
      <select class="champ" data-filtre="statut">
        <option value="">Tous les statuts</option>
        ${Object.entries(cfg.statuts)
          .map(([k, [l]]) => `<option value="${k}"${f.statut === k ? " selected" : ""}>${esc(l)} (${tous.filter((d) => statutDe(nom, d) === k).length})</option>`)
          .join("")}
      </select>
    </div>
    <div class="carte table-wrap">
      ${
        lignes.length
          ? `<table><thead><tr><th>Demande</th><th class="col-option">${esc(libCol)}</th><th>Statut</th><th class="col-option">Reçue</th></tr></thead>
        <tbody>${lignes
          .map((d) => {
            const [principal, sous] = cfg.resume(d);
            return `<tr data-id="${esc(d.id)}">
              <td><b>${esc(principal || "—")}</b><span class="sous">${esc(sous || "")}</span></td>
              <td class="col-option">${esc(valCol(d) || "—")}</td>
              <td>${pastilleStatut(nom, d)}${liste(d.reponses).length ? `<span class="sous">${liste(d.reponses).length} réponse(s)</span>` : ""}</td>
              <td class="col-option">${esc(dateCourte(d.creeLe))}</td></tr>`;
          })
          .join("")}</tbody></table>`
          : `<p class="vide">Rien à afficher pour ce filtre.</p>`
      }
    </div>`;
}

function brancherFile(nom, v) {
  $$("tbody tr", v).forEach((tr) =>
    tr.addEventListener("click", () => ouvrirDemande(nom, docs(nom).find((d) => d.id === tr.dataset.id))),
  );
}

/* ---------------------------------------------------------------- *
 * 8. Administrateurs
 * ---------------------------------------------------------------- */
const optionsRoles = () => Object.entries(ROLES).map(([k, [l]]) => [k, l]);

function vueAdmins() {
  const lignes = [...docs("admins")].sort((a, b) => String(a.email || "~").localeCompare(String(b.email || "~")));
  return `
    <div class="entete-vue">
      <h1>Administrateurs <span class="muted">(${lignes.length})</span></h1>
      <button class="btn btn-accent" data-nouveau>+ Ajouter un administrateur</button>
    </div>
    <div class="carte table-wrap" style="margin-bottom:16px">
      <table><thead><tr><th>Compte</th><th>Rôle</th><th class="col-option">UID</th><th class="col-option">Ajouté le</th><th></th></tr></thead>
      <tbody>${lignes
        .map((a) => {
          const moi = a.id === etat.utilisateur.uid;
          return `<tr>
          <td><b>${esc(a.email || "— compte sans e-mail —")}</b>${a.nom ? `<span class="sous">${esc(a.nom)}</span>` : ""}</td>
          <td>${
            moi
              ? `<span class="pastille p-bleu">${esc(ROLES[roleDe(a)][0])}</span>`
              : `<select class="champ" data-role="${esc(a.id)}" aria-label="Rôle de ${esc(a.email || a.id)}">
                  ${optionsRoles().map(([k, l]) => `<option value="${k}"${k === roleDe(a) ? " selected" : ""}>${esc(l)}</option>`).join("")}
                </select>`
          }</td>
          <td class="col-option"><code>${esc(a.id)}</code></td>
          <td class="col-option">${esc(dateCourte(a.creeLe))}</td>
          <td>${moi ? `<span class="pastille p-bleu">Vous</span>` : `<button class="btn btn-danger btn-sm" data-retirer="${esc(a.id)}">Retirer</button>`}</td></tr>`;
        })
        .join("")}</tbody></table>
    </div>
    <div class="carte" style="padding:16px 20px">
      <h3 style="margin-bottom:8px">Ce que permet chaque rôle</h3>
      <dl class="fiche">${Object.values(ROLES).map(([l, d]) => `<dt>${esc(l)}</dt><dd>${esc(d)}</dd>`).join("")}</dl>
      <p class="aide">Les droits sont appliqués par les règles de sécurité de la base, pas seulement par cet écran.
        Votre propre rôle ne peut être modifié que par un autre super-administrateur.</p>
    </div>`;
}

function ajouterAdmin() {
  const defs = [
    { k: "nom", label: "Nom", large: true },
    { k: "role", label: "Rôle", type: "select", vide: false, options: optionsRoles(), aide: "Modifiable ensuite depuis la liste." },
    { k: "email", label: "E-mail", type: "email", requis: true },
    { k: "mdp", label: "Mot de passe provisoire", aide: "6 caractères minimum. Laisser vide si le compte existe déjà (renseigner alors l’UID)." },
    { k: "uid", label: "UID d’un compte existant", large: true, aide: "Facultatif : visible dans Firebase › Authentication, ou sur l’écran « Accès non autorisé »." },
  ];
  const m = ouvrirModale({
    titre: "Ajouter un administrateur",
    corps: `<div class="grille-form">${defs.map((d) => champ(d, d.k === "role" ? "secretariat" : "")).join("")}</div>`,
    pied: `<button type="submit" class="btn btn-primaire" value="enregistrer">Ajouter</button>`,
  });
  const form = $("[data-modale-form]", m);
  form.addEventListener("submit", async (e) => {
    if (e.submitter?.value !== "enregistrer") return;
    e.preventDefault();
    if (!form.reportValidity()) return;
    const v = lireFormulaire(form, defs);
    if (!v.uid && !v.mdp) return toast("Renseignez un mot de passe (nouveau compte) ou un UID (compte existant).", true);
    e.submitter.disabled = true;
    const ok = await action(async () => {
      let uid = v.uid;
      if (!uid) {
        // Instance secondaire : créer le compte sans déconnecter l'admin courant.
        const secondaire = initializeApp(FIREBASE, "creation-" + Date.now());
        try {
          const cred = await createUserWithEmailAndPassword(getAuth(secondaire), v.email, v.mdp);
          uid = cred.user.uid;
          await signOut(getAuth(secondaire));
        } finally {
          await deleteApp(secondaire);
        }
      }
      if (uid === etat.utilisateur.uid) throw new Error("C’est votre propre compte : il est déjà administrateur.");
      await setDoc(doc(db, "admins", uid), {
        email: v.email,
        nom: v.nom,
        role: v.role,
        creeLe: serverTimestamp(),
        ajoutePar: etat.utilisateur.email,
      });
    }, "Administrateur ajouté.");
    e.submitter.disabled = false;
    if (ok) fermerModale();
  });
}

function brancherAdmins(v) {
  $("[data-nouveau]", v).addEventListener("click", ajouterAdmin);
  $$("[data-role]", v).forEach((sel) =>
    sel.addEventListener("change", async () => {
      const cible = docs("admins").find((a) => a.id === sel.dataset.role);
      const ancien = roleDe(cible);
      const ok = confirm(`Passer ${cible?.email || "ce compte"} de « ${ROLES[ancien][0]} » à « ${ROLES[sel.value][0]} » ?`);
      if (!ok || !(await action(() => updateDoc(doc(db, "admins", sel.dataset.role), { role: sel.value, majLe: serverTimestamp(), majPar: etat.utilisateur.email }), "Rôle modifié.")))
        sel.value = ancien;
    }),
  );
  $$("[data-retirer]", v).forEach((b) =>
    b.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (!confirm("Retirer les droits d’administration de ce compte ? (le compte de connexion n’est pas supprimé)")) return;
      await action(() => deleteDoc(doc(db, "admins", b.dataset.retirer)), "Droits retirés.");
    }),
  );
}

/* ---------------------------------------------------------------- *
 * 8 bis. Référentiels (secteurs, métiers, besoins…)
 * ---------------------------------------------------------------- */
// Pictogrammes disponibles dans site.js (jeu d'icônes du site public).
const ICONES = ["agriculture", "autre", "banque", "batiment", "com", "commerce", "droit", "education",
  "fusee", "ingenierie", "maison", "media", "politique", "sante", "tech"];
// Familles du formulaire d'inscription (rejoindre.html), absentes de membres.json.
const FAMILLES_DEFAUT = ["Famille Pierre", "Famille Paul", "Famille Jean", "Famille Jacques", "Famille André", "Invité"];

const lignes = (texte) =>
  String(texte || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
const colonnes = (ligne) => ligne.split("|").map((c) => c.trim());

/** Référentiels → texte éditable, une entrée par ligne. */
function refEnTexte(ref) {
  return {
    secteurs: Object.entries(ref.secteurs).map(([n, s]) => `${n} | ${s.icone}`).join("\n"),
    besoins: Object.values(ref.besoins).map((b) => `${b.id} | ${b.court} | ${b.label}`).join("\n"),
    apports: Object.values(ref.apports).map((a) => `${a.id} | ${a.label}`).join("\n"),
    ages: ref.ages.map((a) => `${a.id} | ${a.label}`).join("\n"),
    interets: ref.interets.join("\n"),
    familles: (ref.familles || FAMILLES_DEFAUT).join("\n"),
    ...Object.fromEntries(
      Object.keys(ref.secteurs).map((sect, i) => [
        "metiers-" + i,
        (ref.metiers[sect] || []).map(([m, mots]) => (mots.length ? `${m} | ${mots.join(", ")}` : m)).join("\n"),
      ]),
    ),
  };
}

/** Texte éditable → référentiels. Lève une Error lisible au premier problème. */
function texteEnRef(v, ancien) {
  const unique = (valeurs, quoi) => {
    const vus = new Set();
    for (const x of valeurs) {
      if (vus.has(x)) throw new Error(`${quoi} en double : « ${x} »`);
      vus.add(x);
    }
  };
  const ident = (id, quoi) => {
    if (!/^[a-z0-9+-]+$/.test(id)) throw new Error(`${quoi} : identifiant « ${id} » invalide (minuscules, chiffres, - ou +).`);
    return id;
  };

  const secteurs = lignes(v.secteurs).map((l) => {
    const [nom, icone = "autre"] = colonnes(l);
    if (!ICONES.includes(icone)) throw new Error(`Secteur « ${nom} » : icône « ${icone} » inconnue.`);
    return [nom, { icone }];
  });
  unique(secteurs.map(([n]) => n), "Secteur");

  const anciensSecteurs = Object.keys(ancien.secteurs);
  const metiers = secteurs.map(([nom]) => {
    const i = anciensSecteurs.indexOf(nom);
    const liste = i < 0 ? [] : lignes(v["metiers-" + i]).map((l) => {
      const [m, mots = ""] = colonnes(l);
      return [m, mots.split(",").map((x) => x.trim()).filter(Boolean)];
    });
    unique(liste.map(([m]) => m), `Métier (${nom})`);
    return [nom, liste];
  });

  const besoins = lignes(v.besoins).map((l) => {
    const [id, court, label] = colonnes(l);
    if (!court || !label) throw new Error(`Besoin « ${l} » : format attendu « id | libellé court | libellé ».`);
    const cle = Object.entries(ancien.besoins).find(([, b]) => b.id === id)?.[0] || court;
    return [cle, { id: ident(id, "Besoin"), label, court }];
  });
  unique(besoins.map(([, b]) => b.id), "Besoin");

  const parId = (texte, quoi) =>
    lignes(texte).map((l) => {
      const [id, label] = colonnes(l);
      if (!label) throw new Error(`${quoi} « ${l} » : format attendu « id | libellé ».`);
      return { id: ident(id, quoi), label };
    });
  const apports = parId(v.apports, "Apport");
  unique(apports.map((a) => a.id), "Apport");
  const ages = parId(v.ages, "Tranche d’âge");
  unique(ages.map((a) => a.id), "Tranche d’âge");
  const interets = lignes(v.interets);
  unique(interets, "Centre d’intérêt");
  const familles = lignes(v.familles);
  unique(familles, "Famille");

  if (!secteurs.length) throw new Error("Il faut au moins un secteur.");
  return {
    secteurs: Object.fromEntries(secteurs),
    metiers: Object.fromEntries(metiers),
    besoins: Object.fromEntries(besoins),
    apports: Object.fromEntries(apports.map((a) => [a.id, a])),
    niveaux: ancien.niveaux,
    ages,
    interets,
    familles,
  };
}

/** Valeurs retirées encore portées par des membres : [libellé, nombre]. */
function valeursOrphelines(avant, apres) {
  const membres = docs("membres");
  const retires = (a, b) => a.filter((x) => !b.includes(x));
  const metiersDe = (r) => Object.values(r.metiers).flatMap((l) => l.map(([m]) => m));
  const verifs = [
    ["Secteur", retires(Object.keys(avant.secteurs), Object.keys(apres.secteurs)), (m) => liste(m.secteurs)],
    ["Métier", retires(metiersDe(avant), metiersDe(apres)), (m) => liste(m.metiers)],
    ["Besoin", retires(Object.values(avant.besoins).map((b) => b.id), Object.values(apres.besoins).map((b) => b.id)), (m) => liste(m.besoins)],
    ["Apport", retires(Object.keys(avant.apports), Object.keys(apres.apports)), (m) => liste(m.apports)],
    ["Centre d’intérêt", retires(avant.interets, apres.interets), (m) => liste(m.interets)],
    ["Tranche d’âge", retires(avant.ages.map((a) => a.id), apres.ages.map((a) => a.id)), (m) => liste(m.age)],
  ];
  return verifs.flatMap(([quoi, valeurs, de]) =>
    valeurs.map((v) => [`${quoi} « ${v} »`, membres.filter((m) => de(m).includes(v)).length]).filter(([, n]) => n),
  );
}

async function enregistrerRef(ref, message) {
  return action(
    () =>
      setDoc(doc(db, "config", "referentiels"), {
        ...refVersFirestore(ref),
        majLe: serverTimestamp(),
        majPar: etat.utilisateur.email,
      }),
    message,
  );
}

function vueReferentiels() {
  const ref = refCourant();
  const t = refEnTexte(ref);
  const perso = docs("config").some((d) => d.id === "referentiels");
  const zoneTexte = (k, label, aide, lignesMin = 6) =>
    champ({ k, label, type: "textarea", lignes: Math.max(lignesMin, Math.min(18, lignes(t[k]).length + 1)), aide }, t[k]);

  return `
    <div class="entete-vue">
      <h1>Référentiels</h1>
      ${peut("gestion") ? `<button class="btn btn-secondaire" data-renommer>Renommer une valeur…</button>` : ""}
      ${perso && peut("gestion") ? `<button class="btn btn-danger" data-reinitialiser>Revenir au fichier statique</button>` : ""}
    </div>
    <div class="alerte alerte-info"><p>Listes utilisées par l’annuaire, les filtres et le formulaire d’inscription.
      ${perso ? "Version <b>modifiée dans l’administration</b>." : "Version actuelle : <b>fichier statique</b> (data/membres.json)."}
      Une entrée par ligne ; les colonnes sont séparées par « | ». Pour corriger un libellé déjà porté par des membres,
      utilisez <b>Renommer</b> : les profils sont mis à jour avec.</p></div>
    <form class="carte" style="padding:4px 20px 20px" data-form-ref>
      <div class="grille-form">
        ${zoneTexte("secteurs", "Secteurs — nom | icône", "Icônes : " + ICONES.join(", "))}
        ${zoneTexte("besoins", "Ce que les membres recherchent — id | libellé court | libellé", "L’id ne change plus une fois utilisé ; « autre » n’apparaît pas dans le formulaire.")}
        ${zoneTexte("apports", "Ce que les membres apportent — id | libellé", "")}
        ${zoneTexte("ages", "Tranches d’âge — id | libellé", "", 4)}
        ${zoneTexte("interets", "Centres d’intérêt", "")}
        ${zoneTexte("familles", "Familles d’église", "Liste du formulaire d’inscription.", 4)}
        <div class="large"><p class="label">Niveaux d’expérience (fixes : ils pilotent le tri et le mentorat)</p>
          <p class="muted">${ref.niveaux.map((n) => esc(n.label)).join(" · ")}</p></div>
        <h3 class="large" style="margin-top:12px">Métiers par secteur — nom | mots-clés de recherche</h3>
        ${Object.keys(ref.secteurs)
          .map((sect, i) => zoneTexte("metiers-" + i, sect, "", 3))
          .join("")}
      </div>
      <p class="aide">Un secteur ajouté reçoit sa liste de métiers après l’enregistrement.</p>
      ${peut("gestion") ? `<button class="btn btn-primaire" type="submit" style="margin-top:14px">Enregistrer les référentiels</button>` : ""}
    </form>`;
}

function brancherReferentiels(v) {
  const form = $("[data-form-ref]", v);
  if (!peut("gestion")) return $$("textarea", form).forEach((t) => (t.readOnly = true));
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const avant = refCourant();
    const valeurs = Object.fromEntries(new FormData(form));
    let apres;
    try {
      apres = texteEnRef(valeurs, avant);
    } catch (err) {
      return toast(err.message, true);
    }
    const orphelins = valeursOrphelines(avant, apres);
    if (
      orphelins.length &&
      !confirm(
        "Ces valeurs retirées sont encore portées par des membres (elles resteront sur leur profil mais disparaîtront des filtres) :\n\n" +
          orphelins.map(([l, n]) => `• ${l} : ${n} membre(s)`).join("\n") +
          "\n\nPour transférer ces membres, annulez et utilisez « Renommer ». Enregistrer quand même ?",
      )
    )
      return;
    await enregistrerRef(apres, "Référentiels enregistrés.");
  });
  $("[data-renommer]", v).addEventListener("click", renommerValeur);
  $("[data-reinitialiser]", v)?.addEventListener("click", async () => {
    if (!confirm("Supprimer les référentiels de l’administration et revenir à ceux du fichier statique ?")) return;
    await action(() => deleteDoc(doc(db, "config", "referentiels")), "Retour au fichier statique.");
  });
}

/** Renomme une valeur dans les référentiels ET sur tous les membres et offres qui la portent. */
function renommerValeur() {
  const ref = refCourant();
  const metiers = Object.values(ref.metiers).flatMap((l) => l.map(([m]) => m));
  const TYPES = {
    secteur: ["Secteur", Object.keys(ref.secteurs)],
    metier: ["Métier", [...new Set(metiers)]],
    interet: ["Centre d’intérêt", ref.interets],
    famille: ["Famille d’église", ref.familles || FAMILLES_DEFAUT],
  };
  const m = ouvrirModale({
    titre: "Renommer une valeur",
    corps: `<div class="grille-form">
      ${champ({ k: "type", label: "Liste", type: "select", vide: false, options: Object.entries(TYPES).map(([k, [l]]) => [k, l]) }, "secteur")}
      <div data-ancienne>${champ({ k: "ancienne", label: "Valeur actuelle", type: "select", requis: true, options: TYPES.secteur[1] }, "")}</div>
      ${champ({ k: "nouvelle", label: "Nouvelle valeur", requis: true, large: true })}
    </div>
    <p class="aide">Les profils et les offres qui portent la valeur actuelle sont mis à jour en même temps.</p>`,
    pied: `<button type="submit" class="btn btn-primaire" value="enregistrer">Renommer</button>`,
  });
  $("[name=type]", m).addEventListener("change", (e) => {
    $("[data-ancienne]", m).innerHTML = champ(
      { k: "ancienne", label: "Valeur actuelle", type: "select", requis: true, options: TYPES[e.target.value][1] },
      "",
    );
  });
  $("[data-modale-form]", m).addEventListener("submit", async (e) => {
    if (e.submitter?.value !== "enregistrer") return;
    e.preventDefault();
    const form = e.target;
    if (!form.reportValidity()) return;
    const { type, ancienne, nouvelle } = lireFormulaire(form, [{ k: "type" }, { k: "ancienne" }, { k: "nouvelle" }]);
    if (ancienne === nouvelle) return fermerModale();
    if (TYPES[type][1].includes(nouvelle)) return toast(`« ${nouvelle} » existe déjà dans cette liste.`, true);

    // 1. Référentiels (l'ordre est conservé).
    const r = structuredClone(ref);
    const renommer = (x) => (x === ancienne ? nouvelle : x);
    if (type === "secteur") {
      r.secteurs = Object.fromEntries(Object.entries(r.secteurs).map(([k, val]) => [renommer(k), val]));
      r.metiers = Object.fromEntries(Object.entries(r.metiers).map(([k, val]) => [renommer(k), val]));
    } else if (type === "metier") {
      for (const sect in r.metiers) r.metiers[sect] = r.metiers[sect].map(([n, mots]) => [renommer(n), mots]);
    } else if (type === "interet") r.interets = r.interets.map(renommer);
    else r.familles = (r.familles || FAMILLES_DEFAUT).map(renommer);

    // 2. Membres et offres concernés.
    const maj = [];
    for (const mb of docs("membres")) {
      const champs = {};
      if (type === "secteur" && liste(mb.secteurs).includes(ancienne)) {
        champs.secteurs = mb.secteurs.map(renommer);
        champs.secteur = renommer(mb.secteur);
      }
      if (type === "metier" && liste(mb.metiers).includes(ancienne)) {
        champs.metiers = mb.metiers.map(renommer);
        champs.metier = renommer(mb.metier);
      }
      if (type === "interet" && liste(mb.interets).includes(ancienne)) champs.interets = mb.interets.map(renommer);
      if (type === "famille" && mb.famille === ancienne) champs.famille = nouvelle;
      if (Object.keys(champs).length) maj.push(["membres", mb.id, champs]);
    }
    for (const o of docs("offres")) {
      if (type === "secteur" && o.secteur === ancienne) maj.push(["offres", o.id, { secteur: nouvelle }]);
      if (type === "metier" && o.metier === ancienne) maj.push(["offres", o.id, { metier: nouvelle }]);
    }
    if (!confirm(`Renommer « ${ancienne} » en « ${nouvelle} » ? ${maj.length} profil(s)/offre(s) seront mis à jour.`)) return;

    e.submitter.disabled = true;
    const ok = await action(async () => {
      for (let i = 0; i < maj.length; i += 400) {
        const lot = writeBatch(db);
        maj.slice(i, i + 400).forEach(([col, id, champs]) => lot.update(doc(db, col, id), { ...champs, majLe: serverTimestamp() }));
        await lot.commit();
      }
      await setDoc(doc(db, "config", "referentiels"), {
        ...refVersFirestore(r),
        majLe: serverTimestamp(),
        majPar: etat.utilisateur.email,
      });
    }, `« ${ancienne} » renommé en « ${nouvelle} » (${maj.length} mise(s) à jour).`);
    e.submitter.disabled = false;
    if (ok) fermerModale();
  });
}

/* ---------------------------------------------------------------- *
 * 8 ter. Paramètres et journal d'envoi
 * ---------------------------------------------------------------- */
const CHAMPS_REGLAGES = [
  {
    k: "envoiDirect",
    label: "Envoyer les e-mails directement depuis l’administration",
    type: "case",
    aide: "Nécessite l’extension Firebase « Trigger Email from Firestore » branchée sur la collection mail (voir README).",
  },
  {
    k: "replyTo",
    label: "Adresse de réponse (Reply-To)",
    type: "email",
    aide: "Facultatif : l’adresse où arrivent les réponses des destinataires.",
  },
  {
    k: "signature",
    label: "Signature des messages",
    type: "textarea",
    lignes: 3,
    aide: "Ajoutée à la fin de chaque modèle. Vide : signature par défaut du secrétariat MISI.",
  },
];

function vueParametres() {
  const r = reglages();
  const mails = docs("mail").slice(0, 30);
  // Un e-mail vieux de plus de 10 min jamais pris en charge : extension absente ou mal configurée.
  const bloque = docs("mail").some((m) => !m.delivery && enDate(m.creeLe) && Date.now() - enDate(m.creeLe) > 600e3);

  return `
    <div class="entete-vue"><h1>Paramètres</h1></div>
    ${
      bloque
        ? `<div class="alerte alerte-orange"><p>Des e-mails attendent depuis plus de 10 minutes sans avoir été pris en charge :
           l’extension « Trigger Email » ne semble pas installée, ou ne surveille pas la collection <code>mail</code>.</p></div>`
        : ""
    }
    <form class="carte" style="padding:4px 20px 20px;margin-bottom:20px" data-form-reglages>
      <div class="grille-form">${CHAMPS_REGLAGES.map((d) => champ(d, r[d.k])).join("")}</div>
      <button class="btn btn-primaire" type="submit" style="margin-top:14px">Enregistrer les paramètres</button>
    </form>
    <h2 style="margin-bottom:10px">Journal d’envoi des e-mails</h2>
    <div class="carte table-wrap">
      ${
        mails.length
          ? `<table><thead><tr><th>Destinataire</th><th class="col-option">Objet</th><th>État</th><th class="col-option">Envoyé</th></tr></thead>
        <tbody>${mails
          .map(
            (m) => `<tr>
            <td>${esc(liste(m.to).join(", "))}<span class="sous">${esc(m.par || "")}</span></td>
            <td class="col-option">${esc(m.message?.subject || "")}</td>
            <td>${etatEnvoi(m.id)}${m.delivery?.error ? `<span class="sous">${esc(m.delivery.error)}</span>` : ""}</td>
            <td class="col-option">${esc(dateLongue(m.creeLe))}</td></tr>`,
          )
          .join("")}</tbody></table>`
          : `<p class="vide">Aucun e-mail envoyé directement pour l’instant.</p>`
      }
    </div>`;
}

function brancherParametres(v) {
  const form = $("[data-form-reglages]", v);
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!form.reportValidity()) return;
    await action(
      () =>
        setDoc(
          doc(db, "config", "admin"),
          { ...lireFormulaire(form, CHAMPS_REGLAGES), majLe: serverTimestamp(), majPar: etat.utilisateur.email },
          { merge: true },
        ),
      "Paramètres enregistrés.",
    );
  });
}

/* ---------------------------------------------------------------- *
 * 9. Tableau de bord
 * ---------------------------------------------------------------- */
function vueTableau() {
  const membres = docs("membres");
  const publies = membres.filter((m) => m.publie).length;
  const offresEnLigne = docs("offres").filter((o) => o.publie && (!o.expireLe || o.expireLe >= aujourdhui())).length;
  const aTraiter = Object.keys(FILES)
    .flatMap((nom) => docs(nom).filter((d) => statutDe(nom, d) === Object.keys(FILES[nom].statuts)[0]).map((d) => ({ nom, d })))
    .sort((a, b) => (enDate(b.d.creeLe) || 0) - (enDate(a.d.creeLe) || 0))
    .slice(0, 10);

  const stat = (lien, n, lib) => `<a class="carte stat" href="#${lien}"><strong>${n}</strong><span>${esc(lib)}</span></a>`;

  return `
    <div class="entete-vue"><h1>Tableau de bord</h1><a class="btn btn-secondaire" href="/" target="_blank" rel="noopener">Voir le site ↗</a></div>
    ${
      !membres.length && peut("gestion")
        ? `<div class="alerte alerte-orange"><p><b>Étape 1 :</b> la base ne contient aucun membre. Le site affiche les
           ${etat.statiques.length} profils du fichier statique. Importez-les pour les gérer depuis l’administration.</p>
           <button class="btn btn-accent" data-importer>Importer les ${etat.statiques.length} profils</button></div>`
        : ""
    }
    <div class="stats">
      ${stat("membres", `${publies}<small class="muted"> / ${membres.length}</small>`, "membres publiés")}
      ${stat("inscriptions", enAttente("inscriptions"), "inscriptions à valider")}
      ${stat("accompagnements", enAttente("accompagnements"), "accompagnements à traiter")}
      ${stat("demandes", enAttente("demandes"), "demandes Apex IA à traiter")}
      ${stat("candidatures", enAttente("candidatures"), "candidatures à traiter")}
      ${stat("offres", offresEnLigne, "offres d’emploi en ligne")}
      ${stat("offres_proposees", enAttente("offres_proposees"), "offres proposées à traiter")}
    </div>
    <h2 style="margin-bottom:10px">À traiter en priorité</h2>
    <div class="carte table-wrap">
      ${
        aTraiter.length
          ? `<table><thead><tr><th>Demande</th><th>Type</th><th class="col-option">Reçue</th></tr></thead><tbody>
          ${aTraiter
            .map(({ nom, d }) => {
              const [p, s] = FILES[nom].resume(d);
              return `<tr data-nom="${nom}" data-id="${esc(d.id)}"><td><b>${esc(p || "—")}</b><span class="sous">${esc(s || "")}</span></td>
                <td>${esc(FILES[nom].titre)}</td><td class="col-option">${esc(dateCourte(d.creeLe))}</td></tr>`;
            })
            .join("")}</tbody></table>`
          : `<p class="vide">Tout est à jour. 🎉</p>`
      }
    </div>`;
}

function brancherTableau(v) {
  $("[data-importer]", v)?.addEventListener("click", importerMembres);
  $$("tbody tr", v).forEach((tr) =>
    tr.addEventListener("click", () => ouvrirDemande(tr.dataset.nom, docs(tr.dataset.nom).find((d) => d.id === tr.dataset.id))),
  );
}

/* ---------------------------------------------------------------- *
 * 10. Routage et rendu
 * ---------------------------------------------------------------- */
const VUES = {
  tableau: [vueTableau, brancherTableau],
  membres: [vueMembres, brancherMembres],
  offres: [vueOffres, brancherOffres],
  admins: [vueAdmins, brancherAdmins],
  parametres: [vueParametres, brancherParametres],
  referentiels: [vueReferentiels, brancherReferentiels],
  ...Object.fromEntries(Object.keys(FILES).map((nom) => [nom, [() => vueFile(nom), (v) => brancherFile(nom, v)]])),
};

// Écrans réservés aux super-administrateurs.
const VUES_SUPER = new Set(["admins", "parametres"]);
const vueCourante = () => {
  const nom = location.hash.slice(1);
  return VUES[nom] && (!VUES_SUPER.has(nom) || peut("super")) ? nom : "tableau";
};

function rendre() {
  if (!etat.utilisateur || !etat.ref) return;
  // Le rôle suit en direct le document admins/{uid} (changement par un super-admin).
  const moi = docs("admins").find((a) => a.id === etat.utilisateur.uid);
  if (moi) etat.role = roleDe(moi);
  $$("[data-nav] a").forEach((a) => (a.hidden = VUES_SUPER.has(a.getAttribute("href").slice(1)) && !peut("super")));
  $("[data-role-courant]").textContent = ROLES[etat.role][0];
  const nom = vueCourante();
  const v = $("[data-vue]");
  // Conserver le focus et le curseur du champ de recherche entre deux rendus.
  const actif = document.activeElement?.dataset?.filtre;
  const curseur = document.activeElement?.selectionStart;

  const [vue, brancher] = VUES[nom];
  v.innerHTML = vue();
  brancher(v);

  $$("[data-filtre]", v).forEach((c) =>
    c.addEventListener(c.tagName === "SELECT" ? "change" : "input", () => {
      (etat.filtres[nom] ||= {})[c.dataset.filtre] = c.value;
      rendre();
    }),
  );
  if (actif) {
    const c = $(`[data-filtre="${actif}"]`, v);
    c?.focus();
    if (c && curseur != null && c.setSelectionRange) c.setSelectionRange(curseur, curseur);
  }
  $$("[data-nav] a").forEach((a) => a.toggleAttribute("aria-current", a.getAttribute("href") === "#" + nom));
  $$("[data-nav] a[aria-current]").forEach((a) => a.setAttribute("aria-current", "page"));
}

function majCompteurs() {
  Object.keys(FILES).forEach((nom) => {
    const n = enAttente(nom);
    const b = $(`[data-compteur="${nom}"]`);
    if (b) b.textContent = n || "";
  });
}

function afficher(ecran) {
  $("[data-chargement]").hidden = true;
  $$("[data-ecran]").forEach((s) => (s.hidden = s.dataset.ecran !== ecran));
}

/* ---------------------------------------------------------------- *
 * 11. Authentification
 * ---------------------------------------------------------------- */
$("[data-form-connexion]").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  const err = $("[data-erreur-connexion]");
  const bouton = e.target.querySelector("[type=submit]");
  err.hidden = true;
  bouton.disabled = true;
  try {
    await signInWithEmailAndPassword(auth, String(f.get("email")).trim(), String(f.get("mdp")));
  } catch (ex) {
    err.textContent = messageErreur(ex);
    err.hidden = false;
  }
  bouton.disabled = false;
});

$("[data-mdp-oublie]").addEventListener("click", async () => {
  const email = $("#c-email").value.trim();
  if (!email) return toast("Saisissez d’abord votre e-mail.", true);
  await action(() => sendPasswordResetEmail(auth, email), "E-mail de réinitialisation envoyé.");
});

$$("[data-deconnexion]").forEach((b) => b.addEventListener("click", () => signOut(auth)));
$("[data-copier-uid]").addEventListener("click", () => {
  navigator.clipboard?.writeText(auth.currentUser?.uid || "");
  toast("UID copié.");
});

addEventListener("hashchange", () => {
  fermerModale();
  rendre();
  scrollTo(0, 0);
});

onAuthStateChanged(auth, async (u) => {
  etat.abonnements.forEach((x) => x());
  etat.abonnements = [];
  etat.donnees = {};
  etat.utilisateur = null;
  fermerModale();

  if (!u) return afficher("connexion");

  let admin = false;
  try {
    const fiche = await getDoc(doc(db, "admins", u.uid));
    admin = fiche.exists();
    if (admin) etat.role = roleDe(fiche.data());
  } catch (e) {
    console.warn("Vérification admin impossible :", e.code || e.message);
  }
  if (!admin) {
    $("[data-uid]").textContent = u.uid;
    return afficher("refuse");
  }

  etat.utilisateur = u;
  $("[data-utilisateur]").textContent = u.email;
  if (!etat.ref) await chargerReferentiels();
  afficher("app");
  rendre();
  synchroniser();
});
