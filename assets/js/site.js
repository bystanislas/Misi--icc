/* ==================================================================
 * Annuaire des compétences séculières — ICC Riviera 2 / MISI
 * Socle commun : configuration, données, icônes, cartes, mise en relation.
 * ================================================================== */

/* ---------------------------------------------------------------- *
 * 1. Configuration — à renseigner par le coordinateur MISI
 * ---------------------------------------------------------------- */
const CONFIG = {
  // Numéro WhatsApp du secrétariat MISI qui traite les demandes de mise en
  // relation. Format international sans « + » ni espaces, ex. "2250700000000".
  // Laisser vide tant qu'il n'est pas défini : l'interface bascule alors
  // automatiquement sur « copier le message ».
  whatsappCoordination: "",

  // Adresse e-mail du secrétariat MISI (facultatif, sert de second canal).
  emailCoordination: "",

  // Lien du formulaire d'inscription (Google Form). Laisser vide pour
  // utiliser le formulaire intégré de la page « Rejoindre ».
  formulaireInscription: "",

  // Utilisé pour composer les liens de partage.
  urlSite: location.origin + location.pathname.replace(/[^/]*$/, ""),
};

/* ---------------------------------------------------------------- *
 * 2. Icônes (jeu géométrique maison, 24×24, tracé)
 * ---------------------------------------------------------------- */
const PICTOS = {
  banque: '<path d="M4 20h16"/><rect x="5" y="12" width="3.5" height="6" rx="1"/><rect x="10.25" y="8" width="3.5" height="10" rx="1"/><rect x="15.5" y="4" width="3.5" height="14" rx="1"/>',
  fusee: '<path d="M12 3c3 2 4.5 5 4.5 8.5L12 16l-4.5-4.5C7.5 8 9 5 12 3Z"/><circle cx="12" cy="9.5" r="1.6"/><path d="M9.2 15.6 7.5 20l4.5-2.2L16.5 20l-1.7-4.4"/>',
  education: '<path d="M12 4 2.5 8.5 12 13l9.5-4.5L12 4Z"/><path d="M6.5 10.6v4.7c0 1.5 2.5 2.7 5.5 2.7s5.5-1.2 5.5-2.7v-4.7"/>',
  sante: '<path d="M20 8.6c0 4.2-8 10-8 10s-8-5.8-8-10a4.3 4.3 0 0 1 8-2.3A4.3 4.3 0 0 1 20 8.6Z"/>',
  tech: '<rect x="7" y="7" width="10" height="10" rx="2"/><path d="M10 3v3M14 3v3M10 18v3M14 18v3M3 10h3M3 14h3M18 10h3M18 14h3"/>',
  com: '<path d="M4 10v4a1 1 0 0 0 1 1h3l5 4V5L8 9H5a1 1 0 0 0-1 1Z"/><path d="M17 9.6a4 4 0 0 1 0 4.8"/><path d="M19.6 7a7.5 7.5 0 0 1 0 10"/>',
  media: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M10.5 9.4 14.8 12l-4.3 2.6V9.4Z"/>',
  droit: '<path d="M12 4v16M7.5 20h9M12 7.2 5 9m7-1.8L19 9"/><path d="M5 9 2.8 14.2h4.4L5 9Zm14 0-2.2 5.2h4.4L19 9Z"/>',
  ingenierie: '<path d="M15.6 4.4a4.5 4.5 0 0 0-5.7 5.6L4 15.9V20h4.1l5.9-5.9a4.5 4.5 0 0 0 5.6-5.7l-2.6 2.6-2.2-2.2 2.8-2.4Z"/>',
  maison: '<path d="M4 10.5 12 4l8 6.5"/><path d="M6.2 9.8V19a1 1 0 0 0 1 1h9.6a1 1 0 0 0 1-1V9.8"/>',
  commerce: '<path d="M5 8h14l-1 11.4a1 1 0 0 1-1 .9H7a1 1 0 0 1-1-.9L5 8Z"/><path d="M9 8V6.6a3 3 0 0 1 6 0V8"/>',
  agriculture: '<path d="M20 4c0 8-4.5 12-9 12a5 5 0 0 1-5-5c0-4.5 5-7 14-7Z"/><path d="M12.4 11.6 5 19"/>',
  batiment: '<rect x="4" y="4" width="16" height="16" rx="1.5"/><path d="M8 8h2M14 8h2M8 12h2M14 12h2M8 16h8"/>',
  politique: '<path d="M3 20h18M6 20v-8M10 20v-8M14 20v-8M18 20v-8M12 3.2 3.6 8h16.8L12 3.2Z"/>',
  autre: '<path d="m12 4 1.9 4.9L19 10l-5.1 1.6L12 16.5l-1.9-4.9L5 10l5.1-1.1L12 4Z"/>',
  loupe: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>',
  personnes: '<circle cx="9" cy="8" r="3.2"/><path d="M2.8 19.5a6.2 6.2 0 0 1 12.4 0"/><path d="M16.2 5.3a3.2 3.2 0 0 1 0 5.6M17.5 14.2a6.2 6.2 0 0 1 3.7 5.3"/>',
  cible: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1"/>',
  cadenas: '<rect x="4.5" y="10.5" width="15" height="9.5" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
  lieu: '<path d="M12 21s6.5-5.6 6.5-10.4A6.5 6.5 0 0 0 5.5 10.6C5.5 15.4 12 21 12 21Z"/><circle cx="12" cy="10.5" r="2.4"/>',
  eclair: '<path d="M13.5 3 5.5 13.5H11L10.5 21l8-10.5H13L13.5 3Z"/>',
  fleche: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  fermer: '<path d="M6 6l12 12M18 6 6 18"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7"/>',
  partage: '<circle cx="18" cy="5.5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="18.5" r="2.5"/><path d="m8.2 10.8 7.6-4M8.2 13.2l7.6 4"/>',
  filtre: '<path d="M4 6h16M7 12h10M10 18h4"/>',
  etincelle: '<path d="m12 3 1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3Z"/><path d="M18.5 15.5 19.3 18l2.5.8-2.5.8-.8 2.5-.8-2.5L15.2 18l2.5-.8.8-1.7Z"/>',
};

function icon(nom, classe = "h-5 w-5") {
  return `<svg class="${classe}" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${
      PICTOS[nom] || PICTOS.autre
    }</svg>`;
}

/* Palette des monogrammes — teintes claires, contraste AA. */
const TEINTES = [
  { bg: "#EAE8FF", tx: "#4C33C2" },
  { bg: "#FDF7EA", tx: "#96661A" },
  { bg: "#E4F5EE", tx: "#0F766E" },
  { bg: "#E8F1FE", tx: "#1D4ED8" },
  { bg: "#FCE9F1", tx: "#BE185D" },
  { bg: "#EEF4E3", tx: "#4D7C0F" },
  { bg: "#FDEDE5", tx: "#C2410C" },
  { bg: "#E6F3F8", tx: "#0E7490" },
];

function teinte(cle) {
  let h = 0;
  for (let i = 0; i < cle.length; i++) h = (h << 5) - h + cle.charCodeAt(i);
  return TEINTES[Math.abs(h) % TEINTES.length];
}

/* ---------------------------------------------------------------- *
 * 3. Données
 * ---------------------------------------------------------------- */
const Data = {
  membres: [],
  ref: null,
  _promesse: null,

  charger() {
    if (!this._promesse) {
      // Le fichier statique fournit les référentiels ET les membres, et reste
      // le repli de toujours. Firestore (alimenté par l'administration) prend
      // le dessus :
      //  - copie locale récente (< 10 min) : affichage immédiat, rafraîchi
      //    en arrière-plan ;
      //  - sinon (première visite, copie ancienne) : on attend Firestore,
      //    plafonné à 2,5 s par FB, pour que chaque page affiche d'emblée
      //    les données à jour. Au-delà, le fichier statique s'affiche.
      this._promesse = fetch("data/membres.json", { cache: "no-cache" })
        .then((r) => {
          if (!r.ok) throw new Error("HTTP " + r.status);
          return r.json();
        })
        .then(async (d) => {
          this.ref = d.referentiels;
          this.genereLe = d.genereLe;
          this.membres = d.membres;
          this.source = "fichier";

          const cache = this._lireCache();
          if (cache) this._appliquer(cache);
          const recent = cache && Date.now() - Date.parse(cache.le) < 10 * 60e3;
          const distant = this._enrichirDepuisFirestore();
          if (!recent) await distant;
          return d;
        });
    }
    return this._promesse;
  },

  _appliquer({ le, membres, ref }) {
    if (membres?.length) {
      this.membres = membres;
      this.source = "firestore";
      this.genereLe = le;
    }
    if (ref) {
      this.ref = ref;
      this.refSource = "firestore";
    }
  },

  /**
   * Lit membres et référentiels Firestore, les applique, met la copie
   * locale à jour et prévient la page par « misi:membres » si l'affichage
   * a changé (l'annuaire se ré-affiche alors). Ne rejette jamais.
   */
  _enrichirDepuisFirestore() {
    if (typeof FB === "undefined") return Promise.resolve();
    return Promise.all([FB.chargerMembres(), FB.chargerReferentiels()])
      .then(([membres, ref]) => {
        if (!membres?.length && !ref) return;
        const avant = JSON.stringify([this.membres, this.ref]);
        const frais = { le: new Date().toISOString(), membres: membres?.length ? membres : null, ref };
        this._ecrireCache(frais);
        this._appliquer(frais);
        if (JSON.stringify([this.membres, this.ref]) !== avant)
          dispatchEvent(new CustomEvent("misi:membres", { detail: { source: "firestore" } }));
      })
      .catch(() => {
        /* déjà journalisé par FB */
      });
  },

  _lireCache() {
    try {
      const c = JSON.parse(localStorage.getItem("misi-firestore-v2") || "null");
      return c?.membres?.length || c?.ref ? c : null;
    } catch {
      return null;
    }
  },
  _ecrireCache(c) {
    try {
      localStorage.setItem("misi-firestore-v2", JSON.stringify(c));
    } catch {
      /* stockage plein ou bloqué : sans conséquence */
    }
  },

  parId(id) {
    return this.membres.find((m) => m.id === id);
  },

  /* Facettes calculées à partir des membres réellement présents. */
  secteurs() {
    const c = new Map();
    this.membres.forEach((m) => m.secteurs.forEach((s) => c.set(s, (c.get(s) || 0) + 1)));
    return [...c.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "fr"));
  },
  zones() {
    const c = new Map();
    this.membres.forEach((m) => c.set(m.zone, (c.get(m.zone) || 0) + 1));
    return [...c.entries()].sort((a, b) => b[1] - a[1]);
  },
  /** Comptage générique sur un champ simple ou multiple. */
  _compter(champ, multiple = false) {
    const c = new Map();
    this.membres.forEach((m) => {
      const v = m[champ];
      if (multiple) (v || []).forEach((x) => c.set(x, (c.get(x) || 0) + 1));
      else if (v) c.set(v, (c.get(v) || 0) + 1);
    });
    return [...c.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]), "fr"));
  },
  villes() {
    return this._compter("ville");
  },
  communes() {
    return this._compter("commune");
  },
  quartiers() {
    return this._compter("quartier");
  },
  metiersUtilises() {
    return this._compter("metiers", true);
  },
  ages() {
    return this._compter("age");
  },
  interets() {
    return this._compter("interets", true);
  },
  /** Métiers du référentiel, regroupés par secteur, avec le nombre de membres. */
  metiersParSecteur() {
    const utilises = new Map(this.metiersUtilises());
    return Object.entries(this.ref.metiers).map(([secteur, liste]) => [
      secteur,
      liste.map(([m]) => [m, utilises.get(m) || 0]),
    ]);
  },
  libAge(id) {
    return this.ref.ages.find((a) => a.id === id)?.label || id;
  },
  besoins() {
    const c = new Map();
    this.membres.forEach((m) => m.besoins.forEach((b) => c.set(b, (c.get(b) || 0) + 1)));
    return [...c.entries()].sort((a, b) => b[1] - a[1]);
  },
  apports() {
    const c = new Map();
    this.membres.forEach((m) => m.apports.forEach((a) => c.set(a, (c.get(a) || 0) + 1)));
    return [...c.entries()].sort((a, b) => b[1] - a[1]);
  },
  libBesoin(id) {
    return Object.values(this.ref.besoins).find((b) => b.id === id) || { court: id, label: id, verbe: id };
  },
  libApport(id) {
    return this.ref.apports[id] || { label: id };
  },
  picto(secteur) {
    return this.ref.secteurs[secteur]?.icone || "autre";
  },
};

/* ---------------------------------------------------------------- *
 * 4. Utilitaires
 * ---------------------------------------------------------------- */
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const sansAccent = (s) =>
  String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

/** Surligne les occurrences de la requête dans un texte déjà échappé. */
function surligner(texte, requete) {
  if (!requete) return esc(texte);
  const t = String(texte);
  const i = sansAccent(t).indexOf(sansAccent(requete));
  if (i < 0) return esc(t);
  return (
    esc(t.slice(0, i)) +
    '<mark class="bg-orange-100 text-ink-900 rounded-[3px] px-0.5">' +
    esc(t.slice(i, i + requete.length)) +
    "</mark>" +
    esc(t.slice(i + requete.length))
  );
}

/* ---------------------------------------------------------------- *
 * 5. Cartes de profil
 * ---------------------------------------------------------------- */
function avatar(m, taille = "h-12 w-12 text-[15px]") {
  const c = teinte(m.nom);
  return `<div class="avatar ${taille}" style="background:${c.bg};color:${c.tx}">${esc(m.initiales)}</div>`;
}

function carteMembre(m, requete = "") {
  const besoins = m.besoins.slice(0, 2).map((b) => Data.libBesoin(b).court);
  const reste = m.besoins.length - besoins.length;

  return `
  <article class="card card-hover group flex flex-col p-5 text-left" data-id="${m.id}">
    <button class="flex items-start gap-3.5 text-left" data-profil="${m.id}">
      ${avatar(m)}
      <span class="min-w-0 flex-1">
        <span class="block truncate font-display text-[15.5px] font-semibold text-ink-900 group-hover:text-brand-700">
          ${surligner(m.nom, requete)}
        </span>
        <span class="mt-0.5 block truncate text-[13px] text-ink-500">
          ${
            m.metiers.length
              ? surligner(m.metiers.join(" · "), requete)
              : m.metier
                ? surligner(m.metier, requete)
                : esc(m.departement === "Non précisé" ? m.famille : m.departement)
          }
        </span>
      </span>
    </button>

    <div class="mt-4 flex flex-wrap gap-1.5">
      <span class="badge-brand">${icon(Data.picto(m.secteur), "h-3.5 w-3.5")}${esc(m.secteur)}</span>
      ${m.secteurs.length > 1 ? `<span class="badge-neutral">+${m.secteurs.length - 1}</span>` : ""}
      <span class="badge-neutral">${esc(m.experience)}</span>
    </div>

    <div class="mt-3.5 flex items-center gap-1.5 text-[12.5px] text-ink-500">
      ${icon("lieu", "h-3.5 w-3.5 shrink-0 text-ink-400")}<span class="truncate">${esc(m.zone)}</span>
    </div>

    ${
      besoins.length
        ? `<div class="mt-3 border-t border-ink-100 pt-3">
             <p class="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-400">Recherche</p>
             <div class="flex flex-wrap gap-1.5">
               ${besoins.map((b) => `<span class="badge-orange">${esc(b)}</span>`).join("")}
               ${reste > 0 ? `<span class="badge-neutral">+${reste}</span>` : ""}
             </div>
           </div>`
        : ""
    }

    <div class="mt-4 flex gap-2 pt-0.5">
      <button class="btn-primary btn-sm flex-1" data-profil="${m.id}">Voir le profil</button>
      <button class="btn-secondary btn-sm" data-relation="${m.id}" title="Demander une mise en relation" aria-label="Demander une mise en relation avec ${esc(m.nom)}">
        ${icon("personnes", "h-4 w-4")}
      </button>
      <button class="btn-secondary btn-sm" data-partage="${m.id}" title="Partager sur WhatsApp" aria-label="Partager le profil de ${esc(m.nom)} sur WhatsApp">
        ${icon("partage", "h-4 w-4")}
      </button>
    </div>
  </article>`;
}

/* ---------------------------------------------------------------- *
 * 5 bis. Opportunités
 * Chaque besoin déclaré par un membre devient une opportunité à laquelle
 * la communauté peut répondre. Rien n'est inventé : la source est
 * la colonne « Objectifs de connexion » du formulaire d'inscription.
 * ---------------------------------------------------------------- */
const TITRES_OPP = {
  emploi: (s) => `Recherche un poste — ${s}`,
  partenariat: (s) => `Cherche un partenaire d’affaires — ${s}`,
  collaboration: (s) => `Ouvert à une collaboration — ${s}`,
  projet: (s) => `Cherche des équipiers pour un projet — ${s}`,
  investissement: (s) => `Recherche un investisseur — ${s}`,
  formation: (s) => `Cherche une formation ou un mentor — ${s}`,
};

function construireOpportunites(membres = Data.membres) {
  const liste = [];
  membres.forEach((m) => {
    m.besoins.forEach((b) => {
      if (!TITRES_OPP[b]) return; // « autre » : trop imprécis pour être publié
      liste.push({
        id: m.id + "-" + b,
        type: b,
        typeLabel: Data.libBesoin(b).court,
        titre: TITRES_OPP[b](m.secteur),
        resume: [m.metier, "Niveau : " + m.experience, m.zone !== "Non précisé" ? m.zone : null]
          .filter(Boolean)
          .join(" · "),
        membre: m,
      });
    });
  });
  // Alternance entre les membres : un même profil ne monopolise pas le haut de
  // la liste, même s'il a déclaré six besoins. Les plus expérimentés ouvrent
  // chaque tour.
  const parMembre = new Map();
  liste.forEach((o) => {
    if (!parMembre.has(o.membre.id)) parMembre.set(o.membre.id, []);
    parMembre.get(o.membre.id).push(o);
  });
  const groupes = [...parMembre.values()].sort(
    (a, b) => b[0].membre.rang - a[0].membre.rang || a[0].membre.nom.localeCompare(b[0].membre.nom, "fr"),
  );

  const ordonnee = [];
  for (let i = 0, encore = true; encore; i++) {
    encore = false;
    groupes.forEach((g) => {
      if (g[i]) {
        ordonnee.push(g[i]);
        encore = true;
      }
    });
  }
  return ordonnee;
}

/* ---------------------------------------------------------------- *
 * 5 ter. Moteur de compatibilité entre profils
 *
 * Automatisation, pas d'IA : le calcul tourne entièrement dans le
 * navigateur, sans clé d'API ni envoi de données. Il croise ce qu'un
 * membre déclare chercher avec ce qu'un autre peut apporter, puis
 * pondère par le métier, le secteur, la proximité et l'écart
 * d'expérience. Chaque suggestion est justifiée.
 * ---------------------------------------------------------------- */

/** Quel « apport » satisfait quel « besoin ». */
const BESOIN_VERS_APPORTS = {
  emploi: ["recrutement"],
  partenariat: ["partenariat"],
  collaboration: ["collaboration"],
  projet: ["projet", "collaboration"],
  investissement: ["investissement", "partenariat"],
  formation: ["formation", "mentorat", "conseil"],
};

function compatibilite(a, b) {
  if (a.id === b.id) return null;
  let score = 0;
  const raisons = [];

  // 1. B répond à un besoin déclaré par A
  a.besoins.forEach((bes) => {
    const requis = BESOIN_VERS_APPORTS[bes] || [];
    if (requis.some((x) => b.apports.includes(x))) {
      score += 30;
      raisons.push({ ton: "fort", texte: `Peut répondre à son besoin : ${Data.libBesoin(bes).court.toLowerCase()}` });
    }
  });

  // 2. Réciproque : A répond à un besoin de B
  b.besoins.forEach((bes) => {
    const requis = BESOIN_VERS_APPORTS[bes] || [];
    if (requis.some((x) => a.apports.includes(x))) {
      score += 15;
      raisons.push({ ton: "doux", texte: `Réciprocité : cherche ${Data.libBesoin(bes).court.toLowerCase()}` });
    }
  });

  // 3. Métier identique — le signal le plus fort après le besoin
  const metiersCommuns = a.metiers.filter((m) => b.metiers.includes(m));
  if (metiersCommuns.length) {
    score += 22;
    raisons.push({ ton: "fort", texte: "Même métier : " + metiersCommuns[0] });
  }

  // 4. Secteur commun
  const secteursCommuns = a.secteurs.filter((s) => b.secteurs.includes(s));
  if (secteursCommuns.length) {
    score += 14;
    raisons.push({ ton: "doux", texte: "Secteur " + secteursCommuns[0] });
  }

  // 5. Proximité géographique
  if (a.quartier && a.quartier === b.quartier) {
    score += 12;
    raisons.push({ ton: "doux", texte: "Même quartier : " + a.quartier });
  } else if (a.commune !== "Non précisée" && a.commune === b.commune) {
    score += 8;
    raisons.push({ ton: "doux", texte: "Même commune : " + a.commune });
  }

  // 6. Écart d'expérience : terrain naturel de mentorat
  if (a.rang >= 0 && b.rang >= 0 && Math.abs(a.rang - b.rang) >= 2) {
    score += 10;
    const senior = a.rang > b.rang ? a : b;
    raisons.push({ ton: "doux", texte: `Mentorat possible (${senior.experience})` });
  }

  // 7. Centres d'intérêt communs (dès que le champ sera renseigné)
  const interetsCommuns = (a.interets || []).filter((i) => (b.interets || []).includes(i));
  if (interetsCommuns.length) {
    score += 6 * interetsCommuns.length;
    raisons.push({ ton: "doux", texte: "Intérêt commun : " + interetsCommuns[0] });
  }

  if (score < 30) return null; // en dessous, la suggestion n'apporte rien
  return { membre: b, score, niveau: niveauAffinite(score), raisons: raisons.slice(0, 3) };
}

/** Un pourcentage donnerait une fausse précision : on qualifie l'affinité. */
function niveauAffinite(score) {
  if (score >= 85) return { label: "Très forte", classe: "text-emerald-700" };
  if (score >= 55) return { label: "Forte", classe: "text-brand-700" };
  return { label: "Possible", classe: "text-ink-500" };
}

/** Les meilleurs profils compatibles avec `m`. */
function profilsCompatibles(m, limite = 4) {
  return Data.membres
    .map((autre) => compatibilite(m, autre))
    .filter(Boolean)
    .sort((x, y) => y.score - x.score || x.membre.nom.localeCompare(y.membre.nom, "fr"))
    .slice(0, limite);
}

/* ---------------------------------------------------------------- *
 * 5 quater. Carrousel accessible
 * Défilement par accrochage natif + boutons, points, clavier, glisser.
 * L'autodéfilement respecte « prefers-reduced-motion » et se met en
 * pause au survol, au focus et quand l'onglet passe en arrière-plan.
 * ---------------------------------------------------------------- */
let compteurCarrousel = 0;

function carrousel(cartes, options = {}) {
  const { auto = false, classe = "w-[280px] sm:w-[320px]", etiquette = "Carrousel" } = options;
  const id = "car" + ++compteurCarrousel;

  return `
  <div class="relative" data-carrousel="${id}" ${auto ? 'data-auto="1"' : ""}
       role="region" aria-roledescription="carrousel" aria-label="${esc(etiquette)}">
    <div class="-mx-5 overflow-x-auto scroll-smooth px-5 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:px-0"
         data-piste tabindex="0">
      <div class="flex gap-4 [scroll-snap-type:x_mandatory]">
        ${cartes
          .map(
            (html, i) => `<div class="shrink-0 [scroll-snap-align:start] ${classe}" data-diapo="${i}">${html}</div>`,
          )
          .join("")}
      </div>
    </div>

    <button class="absolute top-1/2 -left-3 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center
                   rounded-full bg-white text-ink-700 shadow-lift ring-1 ring-ink-200 transition
                   hover:bg-ink-50 disabled:opacity-0 lg:flex"
            data-prec aria-label="Précédent">${icon("fleche", "h-4 w-4 rotate-180")}</button>
    <button class="absolute top-1/2 -right-3 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center
                   rounded-full bg-white text-ink-700 shadow-lift ring-1 ring-ink-200 transition
                   hover:bg-ink-50 disabled:opacity-0 lg:flex"
            data-suiv aria-label="Suivant">${icon("fleche", "h-4 w-4")}</button>

    <div class="mt-5 flex items-center justify-center gap-1.5" data-points></div>
  </div>`;
}

/** Active tous les carrousels présents dans `racine`. */
function activerCarrousels(racine = document) {
  const reduit = matchMedia("(prefers-reduced-motion: reduce)").matches;

  racine.querySelectorAll("[data-carrousel]").forEach((car) => {
    if (car.dataset.pret) return;
    car.dataset.pret = "1";

    const piste = car.querySelector("[data-piste]");
    const diapos = [...car.querySelectorAll("[data-diapo]")];
    const points = car.querySelector("[data-points]");
    const prec = car.querySelector("[data-prec]");
    const suiv = car.querySelector("[data-suiv]");
    if (!diapos.length) return;

    // Au-delà de huit éléments, une rangée de pastilles devient illisible :
    // on bascule sur une barre de progression.
    const modePastilles = diapos.length <= 8;
    points.innerHTML = modePastilles
      ? diapos
          .map(
            (_, i) =>
              `<button class="h-1.5 rounded-full bg-ink-300 transition-all duration-300 hover:bg-ink-400"
                   style="width:${i === 0 ? 22 : 6}px" data-point="${i}"
                   aria-label="Aller à l’élément ${i + 1}"></button>`,
          )
          .join("")
      : `<div class="h-1 w-40 overflow-hidden rounded-full bg-ink-200">
           <div class="h-full rounded-full bg-brand-500 transition-[width,margin] duration-300" data-jauge></div>
         </div>
         <span class="ml-3 text-[12px] tabular-nums text-ink-400"><span data-position>1</span> / ${diapos.length}</span>`;
    const pastilles = [...points.querySelectorAll("[data-point]")];
    const jauge = points.querySelector("[data-jauge]");
    const position = points.querySelector("[data-position]");

    const pas = () => diapos[0].getBoundingClientRect().width + 16;
    const indice = () => Math.round(piste.scrollLeft / pas());

    function majEtat() {
      const i = Math.min(indice(), diapos.length - 1);
      pastilles.forEach((p, k) => {
        p.style.width = k === i ? "22px" : "6px";
        p.classList.toggle("bg-brand-600", k === i);
        p.classList.toggle("bg-ink-300", k !== i);
      });
      if (jauge) {
        const visibles = Math.max(1, Math.round(piste.clientWidth / pas()));
        jauge.style.width = Math.min(100, (visibles / diapos.length) * 100) + "%";
        jauge.style.marginLeft = Math.min(100 - (visibles / diapos.length) * 100, (i / diapos.length) * 100) + "%";
        if (position) position.textContent = i + 1;
      }
      const max = piste.scrollWidth - piste.clientWidth - 2;
      prec.disabled = piste.scrollLeft <= 2;
      suiv.disabled = piste.scrollLeft >= max;
    }

    const aller = (i) =>
      piste.scrollTo({ left: Math.max(0, i) * pas(), behavior: reduit ? "auto" : "smooth" });

    prec.addEventListener("click", () => aller(indice() - 1));
    suiv.addEventListener("click", () => aller(indice() + 1));
    pastilles.forEach((p, i) => p.addEventListener("click", () => aller(i)));
    piste.addEventListener("scroll", majEtat, { passive: true });
    piste.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight") { e.preventDefault(); aller(indice() + 1); }
      if (e.key === "ArrowLeft") { e.preventDefault(); aller(indice() - 1); }
    });

    // Glisser-déposer à la souris (le tactile est natif)
    let tire = false, departX = 0, departScroll = 0;
    piste.addEventListener("pointerdown", (e) => {
      if (e.pointerType !== "mouse" || e.target.closest("button, a")) return;
      tire = true; departX = e.clientX; departScroll = piste.scrollLeft;
      piste.style.cursor = "grabbing";
    });
    addEventListener("pointermove", (e) => {
      if (tire) piste.scrollLeft = departScroll - (e.clientX - departX);
    });
    addEventListener("pointerup", () => { tire = false; piste.style.cursor = ""; });

    majEtat();

    if (car.dataset.auto && !reduit && diapos.length > 1) {
      let minuteur;
      const jouer = () => {
        clearInterval(minuteur);
        minuteur = setInterval(() => {
          // Le carrousel a pu être remplacé par un nouveau rendu : on arrête.
          if (!car.isConnected) return clearInterval(minuteur);
          const i = indice();
          aller(i >= diapos.length - 1 ? 0 : i + 1);
        }, 5000);
      };
      const pause = () => clearInterval(minuteur);
      car.addEventListener("pointerenter", pause);
      car.addEventListener("pointerleave", jouer);
      car.addEventListener("focusin", pause);
      car.addEventListener("focusout", jouer);
      document.addEventListener("visibilitychange", () => (document.hidden ? pause() : jouer()));
      jouer();
    }
  });
}

/* ---------------------------------------------------------------- *
 * 6. Panneau de profil + demande de mise en relation
 * ---------------------------------------------------------------- */
const Panneau = {
  el: null,

  init() {
    if (this.el) return;
    this.el = document.createElement("div");
    this.el.className = "fixed inset-0 z-50 hidden";
    this.el.innerHTML = `
      <div class="absolute inset-0 bg-ink-900/40 backdrop-blur-[2px]" data-fermer></div>
      <div class="absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-white shadow-2xl
                  transition-transform duration-300 translate-x-full" data-panneau
           role="dialog" aria-modal="true" aria-label="Profil du membre">
        <div class="flex items-center justify-between border-b border-ink-200 px-6 py-4">
          <p class="eyebrow" data-titre>Profil</p>
          <button class="btn-ghost -mr-2 p-2" data-fermer aria-label="Fermer">${icon("fermer", "h-5 w-5")}</button>
        </div>
        <div class="flex-1 overflow-y-auto px-6 py-6" data-corps></div>
      </div>`;
    document.body.appendChild(this.el);
    this.el.addEventListener("click", (e) => {
      if (e.target.closest("[data-fermer]")) this.fermer();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") this.fermer();
    });
  },

  ouvrir(html, titre = "Profil") {
    this.init();
    this.el.querySelector("[data-titre]").textContent = titre;
    this.el.querySelector("[data-corps]").innerHTML = html;
    this.el.classList.remove("hidden");
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => this.el.querySelector("[data-panneau]").classList.remove("translate-x-full"));
  },

  fermer() {
    if (!this.el || this.el.classList.contains("hidden")) return;
    this.el.querySelector("[data-panneau]").classList.add("translate-x-full");
    document.body.style.overflow = "";
    setTimeout(() => this.el.classList.add("hidden"), 300);
    const p = new URLSearchParams(location.search);
    if (p.has("p")) {
      p.delete("p");
      history.replaceState(null, "", p.toString() ? "?" + p : location.pathname);
    }
  },
};

/** Bloc « profils compatibles » affiché dans le panneau de profil. */
function blocCompatibles(m) {
  const liste = profilsCompatibles(m, 4);
  if (!liste.length) return "";

  return `
  <div class="mt-7">
    <h3 class="flex items-center gap-2 text-sm font-bold text-ink-900">
      ${icon("etincelle", "h-4 w-4 text-orange-500")} Profils compatibles
    </h3>
    <p class="mt-1 text-[12px] leading-relaxed text-ink-400">
      Rapprochements calculés automatiquement à partir des besoins, du métier,
      du secteur et de la proximité.
    </p>
    <div class="mt-3 space-y-2">
      ${liste
        .map(
          (r) => `
        <button class="flex w-full items-start gap-3 rounded-xl border border-ink-200 p-3 text-left
                       transition hover:border-brand-300 hover:bg-brand-50/40" data-profil="${r.membre.id}">
          ${avatar(r.membre, "h-10 w-10 text-[13px]")}
          <span class="min-w-0 flex-1">
            <span class="flex items-center justify-between gap-2">
              <span class="truncate text-[14px] font-semibold text-ink-900">${esc(r.membre.nom)}</span>
              <span class="shrink-0 text-[11px] font-bold ${r.niveau.classe}">Affinité ${esc(r.niveau.label.toLowerCase())}</span>
            </span>
            <span class="mt-1.5 flex flex-wrap gap-1">
              ${r.raisons
                .map(
                  (x) =>
                    `<span class="${x.ton === "fort" ? "badge-emerald" : "badge-neutral"}">${esc(x.texte)}</span>`,
                )
                .join("")}
            </span>
          </span>
        </button>`,
        )
        .join("")}
    </div>
  </div>`;
}

function ouvrirProfil(id) {
  const m = Data.parId(id);
  if (!m) return;
  const c = teinte(m.nom);

  const ligne = (libelle, valeur, picto) => `
    <div class="flex items-start gap-3 py-2.5">
      <span class="mt-0.5 text-ink-400">${icon(picto, "h-4 w-4")}</span>
      <span class="min-w-0">
        <span class="block text-[11px] font-semibold uppercase tracking-wider text-ink-400">${libelle}</span>
        <span class="block text-sm text-ink-800">${esc(valeur)}</span>
      </span>
    </div>`;

  Panneau.ouvrir(
    `
    <div class="flex items-center gap-4">
      <div class="avatar h-16 w-16 text-xl" style="background:${c.bg};color:${c.tx}">${esc(m.initiales)}</div>
      <div class="min-w-0">
        <h2 class="truncate text-xl font-bold">${esc(m.nom)}</h2>
        <p class="mt-0.5 text-sm text-ink-500">${esc(m.metier || m.secteur)}</p>
      </div>
    </div>

    <div class="mt-5 flex flex-wrap gap-1.5">
      ${m.secteurs
        .map(
          (s) =>
            `<span class="badge-brand">${icon(Data.picto(s), "h-3.5 w-3.5")}${esc(s)}</span>`,
        )
        .join("")}
      <span class="badge-neutral">${esc(m.experience)}</span>
    </div>

    ${
      m.metiers.length
        ? `<div class="mt-3 flex flex-wrap gap-1.5">
             ${m.metiers.map((x) => `<span class="badge-orange">${esc(x)}</span>`).join("")}
           </div>`
        : ""
    }

    <div class="mt-6 rounded-xl2 bg-ink-50 px-4 py-1 ring-1 ring-ink-200/70">
      ${ligne("Ville", m.ville, "lieu")}
      <div class="border-t border-ink-200/70"></div>
      ${ligne("Commune", m.commune + (m.quartier ? " · " + m.quartier : ""), "lieu")}
      <div class="border-t border-ink-200/70"></div>
      ${ligne("Département / ministère", m.departement, "personnes")}
      <div class="border-t border-ink-200/70"></div>
      ${ligne("Famille d’église", m.famille, "personnes")}
      ${
        m.age || (m.interets && m.interets.length)
          ? `<div class="border-t border-ink-200/70"></div>
             ${m.age ? ligne("Tranche d’âge", Data.libAge(m.age), "personnes") : ""}
             ${m.interets?.length ? ligne("Centres d’intérêt", m.interets.join(" · "), "etincelle") : ""}`
          : ""
      }
    </div>

    <div class="mt-6">
      <h3 class="flex items-center gap-2 text-sm font-bold text-ink-900">
        ${icon("cible", "h-4 w-4 text-orange-600")} Ce que ce membre recherche
      </h3>
      <div class="mt-2.5 flex flex-wrap gap-1.5">
        ${
          m.besoins.length
            ? m.besoins.map((b) => `<span class="badge-orange">${esc(Data.libBesoin(b).label)}</span>`).join("")
            : '<span class="text-sm text-ink-500">Non précisé.</span>'
        }
      </div>
    </div>

    <div class="mt-6">
      <h3 class="flex items-center gap-2 text-sm font-bold text-ink-900">
        ${icon("etincelle", "h-4 w-4 text-brand-600")} Ce que ce membre peut apporter
      </h3>
      <div class="mt-2.5 flex flex-wrap gap-1.5">
        ${m.apports.map((a) => `<span class="badge-brand">${esc(Data.libApport(a).label)}</span>`).join("")}
      </div>
      <p class="mt-2 text-[12px] leading-relaxed text-ink-400">
        Estimation établie à partir du niveau d’expérience et des objectifs déclarés.
        À confirmer avec le membre lors de la mise en relation.
      </p>
    </div>

    ${blocCompatibles(m)}

    <div class="mt-7 rounded-xl2 border border-ink-200 bg-white p-4">
      <p class="flex items-center gap-2 text-[13px] font-semibold text-ink-800">
        ${icon("cadenas", "h-4 w-4 text-brand-600")} Coordonnées protégées
      </p>
      <p class="mt-1.5 text-[12.5px] leading-relaxed text-ink-500">
        Le téléphone, l’e-mail et l’adresse ne sont pas publiés. Passez par une demande
        de mise en relation : le secrétariat MISI transmet votre message au membre.
      </p>
    </div>

    <div class="mt-4 flex flex-col gap-2">
      <button class="btn-primary w-full" data-relation="${m.id}">
        ${icon("personnes", "h-4 w-4")} Demander une mise en relation
      </button>
      <button class="btn-whatsapp w-full" data-partage="${m.id}">
        ${icon("partage", "h-4 w-4")} Partager ce profil sur WhatsApp
      </button>
    </div>`,
    "Profil du membre",
  );

  // Le profil ouvert devient partageable sans effacer les filtres en cours.
  const p = new URLSearchParams(location.search);
  p.set("p", m.id);
  history.replaceState(null, "", "?" + p);
}

/* --- Demande de mise en relation --------------------------------- */
function ouvrirRelation(id) {
  const m = Data.parId(id);
  if (!m) return;

  Panneau.ouvrir(
    `
    <h2 class="text-xl font-bold">Demande de mise en relation</h2>
    <p class="mt-1.5 text-sm leading-relaxed text-ink-500">
      Votre demande est transmise au secrétariat MISI, qui contacte
      <strong class="font-semibold text-ink-800">${esc(m.nom)}</strong> et fait le lien
      si le membre accepte. Aucune coordonnée n’est communiquée sans son accord.
    </p>

    <form class="mt-6 space-y-4" data-form-relation>
      <div>
        <label class="label" for="r-nom">Votre nom et prénoms</label>
        <input class="field" id="r-nom" name="nom" required autocomplete="name" placeholder="Ex. Jean Kouassi">
      </div>
      <div>
        <label class="label" for="r-motif">Objet de la demande</label>
        <select class="field" id="r-motif" name="motif">
          ${Object.values(Data.ref.besoins)
            .filter((b) => b.id !== "autre")
            .map((b) => `<option value="${esc(b.court)}">${esc(b.label)}</option>`)
            .join("")}
          <option value="Mentorat">Un mentorat / un accompagnement</option>
          <option value="Conseil">Un conseil, un avis d’expert</option>
          <option value="Autre">Autre</option>
        </select>
      </div>
      <div>
        <label class="label" for="r-msg">Votre message</label>
        <textarea class="field" id="r-msg" name="message" rows="4" required
          placeholder="Présentez brièvement votre demande…"></textarea>
      </div>
      <div class="rounded-lg bg-brand-50 px-3.5 py-3 text-[12.5px] leading-relaxed text-brand-800">
        ${icon("cadenas", "inline h-3.5 w-3.5 -mt-0.5")}
        En envoyant, vous acceptez que votre nom et votre message soient transmis au
        secrétariat MISI et au membre concerné.
      </div>
      <div class="flex flex-col gap-2 pt-1" data-actions></div>
      <p class="hidden rounded-lg bg-emerald-50 px-3.5 py-3 text-[13px] text-emerald-800" data-ok></p>
    </form>`,
    "Mise en relation",
  );

  const form = Panneau.el.querySelector("[data-form-relation]");
  const actions = form.querySelector("[data-actions]");
  const configure = CONFIG.whatsappCoordination || CONFIG.emailCoordination;

  actions.innerHTML = configure
    ? `${
        CONFIG.whatsappCoordination
          ? `<button type="submit" class="btn-whatsapp w-full" data-canal="whatsapp">
               ${icon("partage", "h-4 w-4")} Envoyer via WhatsApp</button>`
          : ""
      }
       ${
         CONFIG.emailCoordination
           ? `<button type="submit" class="btn-secondary w-full" data-canal="email">Envoyer par e-mail</button>`
           : ""
       }`
    : `<button type="submit" class="btn-primary w-full" data-canal="copie">
         ${icon("check", "h-4 w-4")} Copier la demande</button>
       <p class="text-[12.5px] leading-relaxed text-ink-500">
         Le canal d’envoi automatique n’est pas encore configuré. Copiez votre demande
         et transmettez-la au secrétariat MISI.</p>`;

  let canal = actions.querySelector("[data-canal]")?.dataset.canal || "copie";
  actions.addEventListener("click", (e) => {
    const b = e.target.closest("[data-canal]");
    if (b) canal = b.dataset.canal;
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const d = new FormData(form);
    const texte =
      `Demande de mise en relation — Annuaire MISI\n\n` +
      `Membre concerné : ${m.nom} (${m.secteur}${m.metier ? " — " + m.metier : ""})\n` +
      `Demandeur : ${d.get("nom")}\n` +
      `Objet : ${d.get("motif")}\n\n${d.get("message")}`;

    if (canal === "whatsapp") {
      window.open(`https://wa.me/${CONFIG.whatsappCoordination}?text=${encodeURIComponent(texte)}`, "_blank", "noopener");
    } else if (canal === "email") {
      location.href =
        `mailto:${CONFIG.emailCoordination}?subject=` +
        encodeURIComponent(`Mise en relation — ${m.nom}`) +
        `&body=${encodeURIComponent(texte)}`;
    } else {
      navigator.clipboard?.writeText(texte);
    }

    const ok = form.querySelector("[data-ok]");
    ok.textContent =
      canal === "copie" ? "Demande copiée. Transmettez-la au secrétariat MISI." : "Demande préparée dans votre application.";
    ok.classList.remove("hidden");
  });
}

/* --- Partage WhatsApp -------------------------------------------- */
function partagerProfil(id) {
  const m = Data.parId(id);
  if (!m) return;
  const lien = CONFIG.urlSite.replace(/[^/]*$/, "") + "annuaire.html?p=" + m.id;
  const texte =
    `${m.nom} — ${m.metier || m.secteur} (${m.experience})\n` +
    `Annuaire des compétences séculières · ICC Riviera 2 / MISI\n${lien}`;
  window.open("https://wa.me/?text=" + encodeURIComponent(texte), "_blank", "noopener");
}

/* --- Délégation globale ------------------------------------------ */
document.addEventListener("click", (e) => {
  const p = e.target.closest("[data-profil]");
  if (p) return ouvrirProfil(p.dataset.profil);
  const r = e.target.closest("[data-relation]");
  if (r) return ouvrirRelation(r.dataset.relation);
  const s = e.target.closest("[data-partage]");
  if (s) return partagerProfil(s.dataset.partage);
});

/* ---------------------------------------------------------------- *
 * 7. En-tête : menu mobile + ombre au défilement
 * ---------------------------------------------------------------- */
document.addEventListener("DOMContentLoaded", () => {
  // Hydrate les pictogrammes déclarés en HTML : <span data-picto="loupe">
  document.querySelectorAll("[data-picto]").forEach((el) => {
    el.innerHTML = icon(el.dataset.picto, el.dataset.taille || "h-5 w-5");
  });

  const annee = document.querySelector("[data-annee]");
  if (annee) annee.textContent = new Date().getFullYear();

  const entete = document.querySelector("[data-entete]");
  if (entete) {
    const maj = () => entete.classList.toggle("shadow-card", window.scrollY > 8);
    maj();
    addEventListener("scroll", maj, { passive: true });
  }
  const bouton = document.querySelector("[data-menu-bouton]");
  const menu = document.querySelector("[data-menu]");
  bouton?.addEventListener("click", () => {
    const ouvert = menu.classList.toggle("hidden");
    bouton.setAttribute("aria-expanded", String(!ouvert));
  });

  document.querySelectorAll("[data-an]").forEach((el, i) => {
    el.classList.add("animate-in");
    el.style.animationDelay = i * 45 + "ms";
  });

  activerCarrousels();
  initPWA();
});

/* ---------------------------------------------------------------- *
 * 8. Application mobile & tablette (PWA)
 * Le site s'installe sur l'écran d'accueil, se lance en plein écran
 * et reste consultable hors connexion une fois visité.
 * ---------------------------------------------------------------- */
function initPWA() {
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
  }

  // Bandeau d'installation — uniquement si le navigateur le propose et si
  // l'utilisateur ne l'a pas déjà écarté.
  let invite = null;
  addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    invite = e;
    if (localStorage.getItem("misi-install-refuse") === "1") return;
    afficherBandeauInstall();
  });

  function afficherBandeauInstall() {
    if (document.querySelector("[data-install]")) return;
    const b = document.createElement("div");
    b.dataset.install = "1";
    b.className =
      "fixed inset-x-3 bottom-3 z-50 flex items-center gap-3 rounded-xl2 bg-white p-3.5 " +
      "shadow-lift ring-1 ring-ink-200 sm:left-auto sm:w-96 animate-in";
    b.innerHTML = `
      <img src="assets/favicon.png" alt="" class="h-11 w-11 shrink-0 rounded-xl" />
      <div class="min-w-0 flex-1">
        <p class="text-[13.5px] font-semibold text-ink-900">Installer l’annuaire</p>
        <p class="text-[12px] leading-snug text-ink-500">Accès rapide sur mobile et tablette, même hors connexion.</p>
      </div>
      <button class="btn-primary btn-sm" data-installer>Installer</button>
      <button class="btn-ghost p-1.5" data-refuser aria-label="Plus tard">${icon("fermer", "h-4 w-4")}</button>`;
    document.body.appendChild(b);

    b.querySelector("[data-installer]").addEventListener("click", async () => {
      b.remove();
      invite?.prompt();
      invite = null;
    });
    b.querySelector("[data-refuser]").addEventListener("click", () => {
      localStorage.setItem("misi-install-refuse", "1");
      b.remove();
    });
  }
}
