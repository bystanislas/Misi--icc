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
  const r = etat.ref;
  return {
    secteurs: Object.keys(r.secteurs || {}),
    metiers: Object.values(r.metiers || {}).flatMap((l) => l.map((x) => x[0])),
    besoins: Object.values(r.besoins || {}).map((b) => [b.id, b.court || b.label]),
    apports: Object.values(r.apports || {}).map((a) => [a.id, a.label]),
    niveaux: (r.niveaux || []).map((n) => n.label),
    ages: (r.ages || []).map((a) => [a.id, a.label]),
    interets: r.interets || [],
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
    { k: "famille", label: "Famille d’église" },
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
  const niveau = (etat.ref.niveaux || []).find((n) => n.label === saisie.experience);
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
  const besoinsRef = Object.values(etat.ref.besoins || {});
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
      ${nouveau ? "" : `<button type="button" class="btn btn-danger gauche" data-supprimer>Supprimer</button>`}
      <button type="button" class="btn btn-secondaire" data-fermer>Annuler</button>
      <button type="submit" class="btn btn-primaire" value="enregistrer">${nouveau ? "Créer le profil" : "Enregistrer"}</button>`,
  });

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
    referentiels: etat.ref,
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
      ${manquants ? `<button class="btn btn-secondaire" data-importer>Importer le fichier statique (${manquants})</button>` : ""}
      <button class="btn btn-secondaire" data-exporter ${tous.length ? "" : "disabled"}>Exporter membres.json</button>
      <button class="btn btn-accent" data-nouveau>+ Nouveau membre</button>
    </div>
    ${
      !tous.length
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
  $("[data-nouveau]", v).addEventListener("click", () => editerMembre(null));
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
      ${nouveau ? "" : `<button type="button" class="btn btn-danger gauche" data-supprimer>Supprimer</button>`}
      <button type="button" class="btn btn-secondaire" data-fermer>Annuler</button>
      <button type="submit" class="btn btn-primaire" value="enregistrer">${nouveau ? "Créer l’offre" : "Enregistrer"}</button>`,
  });
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
      <button class="btn btn-accent" data-nouveau>+ Nouvelle offre</button>
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
  $("[data-nouveau]", v).addEventListener("click", () => editerOffre(null));
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
      .replace("Bonjour ,", "Bonjour,") + SIGNATURE
  );
}

function ouvrirDemande(nom, d) {
  const cfg = FILES[nom];
  const c = contactDe(d);
  const statut = statutDe(nom, d);
  const reponses = liste(d.reponses);

  const actionsSpecifiques =
    nom === "inscriptions" && statut !== "validee"
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
              .map((r) => `<li><small>${esc(dateLongue(r.le))} · ${esc(r.canal)} · ${esc(r.par || "")}</small>${esc(r.texte)}</li>`)
              .join("")}</ul>`
          : `<p class="muted">Aucune réponse pour l’instant.</p>`
      }`,
    pied: `
      <button type="button" class="btn btn-danger gauche" data-supprimer>Supprimer</button>
      ${actionsSpecifiques}
      <button type="button" class="btn btn-secondaire" data-repondre ${c.email || c.telephone ? "" : "disabled title='Aucune coordonnée'"}>Répondre</button>
      <button type="submit" class="btn btn-primaire" value="enregistrer">Enregistrer</button>`,
  });

  const form = $("[data-modale-form]", m);
  form.addEventListener("submit", async (e) => {
    if (e.submitter?.value !== "enregistrer") return;
    e.preventDefault();
    const { statut: s, notes } = lireFormulaire(form, [{ k: "statut" }, { k: "notes" }]);
    if (await action(() => updateDoc(doc(db, nom, d.id), { statut: s, notes, majLe: serverTimestamp() }), "Enregistré.")) fermerModale();
  });
  $("[data-supprimer]", m).addEventListener("click", async () => {
    if (!confirm("Supprimer définitivement cet élément ? Les coordonnées associées seront perdues.")) return;
    if (await action(() => deleteDoc(doc(db, nom, d.id)), "Supprimé.")) fermerModale();
  });
  $("[data-repondre]", m).addEventListener("click", () => repondre(nom, d));
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

function repondre(nom, d) {
  const cfg = FILES[nom];
  const c = contactDe(d);
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
      <p class="aide">L’envoi ouvre votre messagerie ou WhatsApp avec le message prêt ; la réponse est consignée dans l’historique.</p>`,
    pied: `
      <button type="button" class="btn btn-secondaire gauche" data-copier>Copier</button>
      ${c.telephone ? `<button type="button" class="btn btn-secondaire" data-canal="whatsapp">Envoyer par WhatsApp</button>` : ""}
      ${c.email ? `<button type="button" class="btn btn-primaire" data-canal="email">Envoyer par e-mail</button>` : ""}`,
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
      const lien =
        canal === "email"
          ? `mailto:${encodeURIComponent(c.email)}?subject=${encodeURIComponent(objet)}&body=${encodeURIComponent(texte)}`
          : `https://wa.me/${numeroWhatsApp(c.telephone)}?text=${encodeURIComponent(texte)}`;
      window.open(lien, "_blank", "noopener");
      const ok = await action(
        () =>
          updateDoc(doc(db, nom, d.id), {
            statut,
            majLe: serverTimestamp(),
            reponses: arrayUnion({ le: Timestamp.now(), canal, objet: canal === "email" ? objet : "", texte, par: etat.utilisateur.email }),
          }),
        "Réponse consignée.",
      );
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
function vueAdmins() {
  const lignes = docs("admins");
  return `
    <div class="entete-vue">
      <h1>Administrateurs <span class="muted">(${lignes.length})</span></h1>
      <button class="btn btn-accent" data-nouveau>+ Ajouter un administrateur</button>
    </div>
    <div class="carte table-wrap">
      <table><thead><tr><th>Compte</th><th class="col-option">UID</th><th class="col-option">Ajouté le</th><th></th></tr></thead>
      <tbody>${lignes
        .map(
          (a) => `<tr>
          <td><b>${esc(a.email || "—")}</b>${a.nom ? `<span class="sous">${esc(a.nom)}</span>` : ""}</td>
          <td class="col-option"><code>${esc(a.id)}</code></td>
          <td class="col-option">${esc(dateCourte(a.creeLe))}</td>
          <td>${
            a.id === etat.utilisateur.uid
              ? `<span class="pastille p-bleu">Vous</span>`
              : `<button class="btn btn-danger btn-sm" data-retirer="${esc(a.id)}">Retirer</button>`
          }</td></tr>`,
        )
        .join("")}</tbody></table>
    </div>`;
}

function ajouterAdmin() {
  const defs = [
    { k: "nom", label: "Nom", large: true },
    { k: "email", label: "E-mail", type: "email", requis: true },
    { k: "mdp", label: "Mot de passe provisoire", aide: "6 caractères minimum. Laisser vide si le compte existe déjà (renseigner alors l’UID)." },
    { k: "uid", label: "UID d’un compte existant", large: true, aide: "Facultatif : visible dans Firebase › Authentication, ou sur l’écran « Accès non autorisé »." },
  ];
  const m = ouvrirModale({
    titre: "Ajouter un administrateur",
    corps: `<div class="grille-form">${defs.map((d) => champ(d, "")).join("")}</div>`,
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
      await setDoc(doc(db, "admins", uid), { email: v.email, nom: v.nom, creeLe: serverTimestamp(), ajoutePar: etat.utilisateur.email });
    }, "Administrateur ajouté.");
    e.submitter.disabled = false;
    if (ok) fermerModale();
  });
}

function brancherAdmins(v) {
  $("[data-nouveau]", v).addEventListener("click", ajouterAdmin);
  $$("[data-retirer]", v).forEach((b) =>
    b.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (!confirm("Retirer les droits d’administration de ce compte ? (le compte de connexion n’est pas supprimé)")) return;
      await action(() => deleteDoc(doc(db, "admins", b.dataset.retirer)), "Droits retirés.");
    }),
  );
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
      !membres.length
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
  ...Object.fromEntries(Object.keys(FILES).map((nom) => [nom, [() => vueFile(nom), (v) => brancherFile(nom, v)]])),
};

const vueCourante = () => (VUES[location.hash.slice(1)] ? location.hash.slice(1) : "tableau");

function rendre() {
  if (!etat.utilisateur || !etat.ref) return;
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
    admin = (await getDoc(doc(db, "admins", u.uid))).exists();
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
