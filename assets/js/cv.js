/* ==================================================================
 * Générateur de CV — Annuaire MISI
 *
 * Le CV est fabriqué dans le navigateur : mise en page A4 réelle,
 * export PDF (impression, texte vectoriel sélectionnable) et Word
 * (tableaux, la seule mise en page que Word interprète fidèlement).
 * L'assistance à la rédaction passe par /api/ia (Apex IA), facultative.
 * ================================================================== */

const c$ = (s) => document.querySelector(s);
const CLE_STOCKAGE = "misi-cv-v2";

/* ---------------------------------------------------------------- *
 * 1. État
 * ---------------------------------------------------------------- */
const DESIGN_DEFAUT = {
  modele: "colonnes",
  couleur: "#366a82",
  police: "sans",
  densite: "normale",
  taille: "normale",
  sections: CV_SECTIONS.map((s) => ({ id: s.id, visible: true })),
};

const CV = {
  nom: "", poste: "", telephone: "", email: "", ville: "", lien: "", permis: "",
  accroche: "", experiences: [], formations: [],
  competences: "", langues: "", interets: "", references: "",
  design: structuredClone(DESIGN_DEFAUT),
};

const EXEMPLE = {
  nom: "Kouassi Marie-Laure",
  poste: "Assistante comptable",
  telephone: "+225 07 00 00 00 00",
  email: "marielaure.kouassi@exemple.ci",
  ville: "Abidjan, Cocody Riviera",
  lien: "linkedin.com/in/mlkouassi",
  permis: "Permis B",
  accroche:
    "Assistante comptable avec trois ans d'expérience en cabinet, habituée à la tenue courante et aux déclarations fiscales. Rigoureuse sur les délais et à l'aise avec SAGE. Je recherche un poste en entreprise à Abidjan.",
  experiences: [
    {
      poste: "Assistante comptable", entreprise: "Cabinet Yao & Associés", lieu: "Abidjan",
      debut: "2023", fin: "aujourd'hui",
      description:
        "- Tenue de la comptabilité générale d'un portefeuille de 12 clients\n- Rapprochements bancaires mensuels et lettrage des comptes\n- Préparation des déclarations de TVA et des états financiers annuels",
    },
    {
      poste: "Stagiaire comptabilité", entreprise: "SOTRA", lieu: "Abidjan",
      debut: "2022", fin: "2023",
      description: "- Saisie des pièces comptables\n- Classement et archivage des justificatifs",
    },
  ],
  formations: [
    { diplome: "Licence en comptabilité et gestion", etablissement: "Université Félix Houphouët-Boigny", annee: "2022" },
    { diplome: "BTS Finance-Comptabilité", etablissement: "INP-HB", annee: "2020" },
  ],
  competences: "Comptabilité générale, SAGE Saari, Excel avancé, Déclarations fiscales, Rapprochements bancaires, Reporting mensuel",
  langues: "Français — langue maternelle\nAnglais — intermédiaire",
  interets: "Chorale, lecture, bénévolat associatif",
  references: "Disponibles sur demande",
};

/* ---------------------------------------------------------------- *
 * 2. Sauvegarde locale
 * ---------------------------------------------------------------- */
let minuteurSauvegarde;

function sauvegarder() {
  clearTimeout(minuteurSauvegarde);
  minuteurSauvegarde = setTimeout(() => {
    try {
      localStorage.setItem(CLE_STOCKAGE, JSON.stringify(CV));
      const t = c$("[data-sauvegarde]");
      t.textContent = "Enregistré sur cet appareil";
      setTimeout(() => (t.textContent = ""), 2200);
    } catch {
      /* navigation privée : on continue sans sauvegarde */
    }
  }, 600);
}

function restaurer() {
  try {
    const brut = localStorage.getItem(CLE_STOCKAGE);
    if (!brut) return;
    const sauve = JSON.parse(brut);
    Object.assign(CV, sauve);
    // Un design sauvegardé par une version antérieure peut être incomplet.
    CV.design = { ...structuredClone(DESIGN_DEFAUT), ...(sauve.design || {}) };
    const connues = new Set(CV_SECTIONS.map((s) => s.id));
    CV.design.sections = (CV.design.sections || []).filter((s) => connues.has(s.id));
    CV_SECTIONS.forEach((s) => {
      if (!CV.design.sections.some((x) => x.id === s.id)) CV.design.sections.push({ id: s.id, visible: true });
    });
  } catch {
    /* données illisibles : on repart d'un CV vide */
  }
}

/* ---------------------------------------------------------------- *
 * 3. Fabrique du rendu
 * ---------------------------------------------------------------- */
const lignes = (t) =>
  String(t || "")
    .split(/\n|,(?![^(]*\))/)
    .map((x) => x.replace(/^[-•*]\s*/, "").trim())
    .filter(Boolean);

const periode = (d, f) => [d, f].filter(Boolean).join(" – ");

const contenuVide = {
  accroche: (d) => !d.accroche.trim(),
  experiences: (d) => !d.experiences.some((x) => x.poste || x.entreprise || x.description),
  formations: (d) => !d.formations.some((x) => x.diplome || x.etablissement),
  competences: (d) => !lignes(d.competences).length,
  langues: (d) => !lignes(d.langues).length,
  interets: (d) => !lignes(d.interets).length,
  references: (d) => !d.references.trim(),
};

/** Construit le contexte passé aux modèles. */
function contexte(d = CV) {
  const dz = d.design;
  const a = dz.couleur;
  const esp = CV_DENSITES.find((x) => x.id === dz.densite) || CV_DENSITES[1];
  const pt = (CV_TAILLES.find((x) => x.id === dz.taille) || CV_TAILLES[1]).pt;

  // Arrondi des tailles dérivées : sans lui le fichier Word affiche
  // « 9.450000000000001pt ».
  const T = (facteur) => Math.round(pt * facteur * 10) / 10;

  const visibles = dz.sections.filter((s) => s.visible && !contenuVide[s.id](d)).map((s) => s.id);
  const zoneDe = (id) => CV_SECTIONS.find((s) => s.id === id).zone;

  const x = {
    d, a, esp, pt, T,
    principal: visibles.filter((id) => zoneDe(id) === "principal"),
    cote: visibles.filter((id) => zoneDe(id) === "cote"),
  };

  /* --- Fragments partagés --- */
  x.contactLigne = (sep = " · ") =>
    [d.telephone, d.email, d.ville, d.lien, d.permis].filter(Boolean).map(esc).join(sep);

  x.contactEmpile = ({ sombre = false } = {}) => {
    const items = [d.telephone, d.email, d.ville, d.lien, d.permis].filter(Boolean);
    if (!items.length) return "";
    return `<div style="font-size:${T(0.9)}pt;line-height:1.55;word-break:break-word;margin-bottom:${esp.section}px;${
      sombre ? "color:#3b454c" : ""
    }">${items.map((v) => `<div style="margin-bottom:3px">${esc(v)}</div>`).join("")}</div>`;
  };

  x.enTete = ({ sansMarge = false } = {}) => `
    <h1 style="font-size:${T(2.05)}pt;font-weight:800;line-height:1.08;margin:0;color:#161d22">
      ${esc(d.nom || "Votre nom")}
    </h1>
    ${d.poste ? `<p style="margin:4px 0 0;font-size:${T(1.12)}pt;color:${a};font-weight:600">${esc(d.poste)}</p>` : ""}
    ${sansMarge ? "" : ""}`;

  const titre = (texte, { surAccent = false, filetFin = false, centre = false } = {}) => `
    <div style="margin-bottom:7px;padding-bottom:3px;font-size:${T(0.92)}pt;font-weight:700;
                letter-spacing:.09em;text-transform:uppercase;
                color:${surAccent ? "#fff" : a};
                border-bottom:${filetFin ? "1px" : "1.5px"} solid ${surAccent ? "rgba(255,255,255,.4)" : a + "55"};
                ${centre ? "text-align:center" : ""}">${texte}</div>`;

  const puceListe = (items, { surAccent = false } = {}) =>
    `<div style="font-size:${T(0.92)}pt">${items
      .map(
        (v) => `<div style="margin-bottom:3px;padding-left:9px;position:relative">
          <span style="position:absolute;left:0;top:${T(0.42)}pt;width:3px;height:3px;border-radius:50%;
                background:${surAccent ? "rgba(255,255,255,.75)" : a}"></span>${esc(v)}</div>`,
      )
      .join("")}</div>`;

  const blocExperience = (e) => {
    const puces = lignes(e.description);
    return `
    <div class="cv-bloc" style="margin-bottom:${esp.bloc}px">
      <div style="display:flex;justify-content:space-between;gap:12px;align-items:baseline">
        <div style="font-weight:700;font-size:${T(1.03)}pt">${esc(e.poste || "Poste")}</div>
        <div style="font-size:${T(0.86)}pt;color:#68757e;white-space:nowrap">${esc(periode(e.debut, e.fin))}</div>
      </div>
      ${
        e.entreprise || e.lieu
          ? `<div style="font-size:${T(0.94)}pt;color:${a};font-weight:600">
               ${esc([e.entreprise, e.lieu].filter(Boolean).join(" · "))}</div>`
          : ""
      }
      ${
        puces.length
          ? `<ul style="margin:4px 0 0;padding-left:15px">${puces
              .map((p) => `<li class="cv-puce" style="margin-bottom:2px">${esc(p)}</li>`)
              .join("")}</ul>`
          : ""
      }
    </div>`;
  };

  const blocFormation = (f) => `
    <div class="cv-bloc" style="margin-bottom:${Math.max(5, esp.bloc - 3)}px">
      <div style="display:flex;justify-content:space-between;gap:12px;align-items:baseline">
        <div style="font-weight:700;font-size:${pt}pt">${esc(f.diplome || "Diplôme")}</div>
        <div style="font-size:${T(0.86)}pt;color:#68757e;white-space:nowrap">${esc(f.annee || "")}</div>
      </div>
      ${f.etablissement ? `<div style="font-size:${T(0.94)}pt;color:${a}">${esc(f.etablissement)}</div>` : ""}
    </div>`;

  const CORPS = {
    accroche: () =>
      `<p style="margin:0;font-size:${T(0.98)}pt;line-height:${esp.ligne};color:#3b454c">${esc(d.accroche)}</p>`,
    experiences: () => d.experiences.filter((e) => e.poste || e.entreprise || e.description).map(blocExperience).join(""),
    formations: () => d.formations.filter((f) => f.diplome || f.etablissement).map(blocFormation).join(""),
    competences: (o) =>
      o.surAccent || o.enColonne
        ? puceListe(lignes(d.competences), o)
        : `<div style="display:flex;flex-wrap:wrap;gap:5px">${lignes(d.competences)
            .map(
              (v) =>
                `<span style="border:1px solid ${a}44;border-radius:4px;padding:2.5px 7px;font-size:${T(0.9)}pt">${esc(v)}</span>`,
            )
            .join("")}</div>`,
    langues: (o) =>
      `<div style="font-size:${T(0.94)}pt">${lignes(d.langues)
        .map((v) => `<div style="margin-bottom:3px">${esc(v)}</div>`)
        .join("")}</div>`,
    interets: (o) =>
      o.surAccent
        ? `<div style="font-size:${T(0.92)}pt">${lignes(d.interets).map(esc).join("<br>")}</div>`
        : `<p style="margin:0;font-size:${T(0.94)}pt">${lignes(d.interets).map(esc).join(" · ")}</p>`,
    references: () => `<p style="margin:0;font-size:${T(0.94)}pt">${esc(d.references)}</p>`,
  };

  const LIBELLES = {
    accroche: "Profil", experiences: "Expérience professionnelle", formations: "Formation",
    competences: "Compétences", langues: "Langues", interets: "Centres d’intérêt", references: "Références",
  };

  x.section = (id, options = {}) => {
    const o = { surAccent: false, filetFin: false, centre: false, enColonne: false, ...options };
    const corps = CORPS[id](o);
    if (!corps) return "";
    // L'accroche du modèle « colonnes » n'a pas besoin d'un titre.
    const sansTitre = id === "accroche" && !o.centre;
    return `<div style="margin-top:${esp.section}px">
      ${sansTitre ? "" : titre(LIBELLES[id], o)}${corps}
    </div>`;
  };

  return x;
}

function rendreCV() {
  const x = contexte();
  const police = (CV_POLICES.find((p) => p.id === CV.design.police) || CV_POLICES[0]).pile;
  const page = c$("[data-cv]");
  page.style.fontFamily = police;
  page.style.fontSize = x.pt + "pt";
  page.style.lineHeight = x.esp.ligne;
  page.innerHTML = (CV_RENDU[CV.design.modele] || CV_RENDU.colonnes)(x);
}

/* ---------------------------------------------------------------- *
 * 4. Champs répétables
 * ---------------------------------------------------------------- */
const boutonsBloc = (type, i) => `
  <div class="flex gap-1">
    <button type="button" class="btn-ghost p-1.5" data-monter="${type}" data-i="${i}" aria-label="Monter">
      <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="m6 15 6-6 6 6"/></svg>
    </button>
    <button type="button" class="btn-ghost p-1.5 text-brique-600" data-supprimer="${type}" data-i="${i}" aria-label="Supprimer">
      <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>
    </button>
  </div>`;

const CHAMPS_REPETABLES = {
  experience: {
    liste: "experiences",
    conteneur: "[data-liste-experiences]",
    vide: () => ({ poste: "", entreprise: "", lieu: "", debut: "", fin: "", description: "" }),
    html: (x, i) => `
      <div class="rounded-xl border border-ink-200 p-4">
        <div class="mb-3 flex items-center justify-between">
          <span class="text-[12px] font-bold uppercase tracking-wider text-ink-400">Expérience ${i + 1}</span>
          ${boutonsBloc("experience", i)}
        </div>
        <div class="grid gap-3 sm:grid-cols-2">
          <input class="field sm:col-span-2" data-champ="experiences.${i}.poste" value="${esc(x.poste)}" placeholder="Intitulé du poste" />
          <input class="field" data-champ="experiences.${i}.entreprise" value="${esc(x.entreprise)}" placeholder="Entreprise" />
          <input class="field" data-champ="experiences.${i}.lieu" value="${esc(x.lieu)}" placeholder="Lieu" />
          <input class="field" data-champ="experiences.${i}.debut" value="${esc(x.debut)}" placeholder="Début (ex. 2023)" />
          <input class="field" data-champ="experiences.${i}.fin" value="${esc(x.fin)}" placeholder="Fin (ou « aujourd’hui »)" />
          <textarea class="field sm:col-span-2" rows="4" data-champ="experiences.${i}.description"
            placeholder="Vos missions et résultats, une ligne par point">${esc(x.description)}</textarea>
        </div>
        <div class="mt-2 flex items-center gap-2" data-ia="experience" data-cible-champ="experiences.${i}.description"></div>
      </div>`,
  },
  formation: {
    liste: "formations",
    conteneur: "[data-liste-formations]",
    vide: () => ({ diplome: "", etablissement: "", annee: "" }),
    html: (x, i) => `
      <div class="rounded-xl border border-ink-200 p-4">
        <div class="mb-3 flex items-center justify-between">
          <span class="text-[12px] font-bold uppercase tracking-wider text-ink-400">Formation ${i + 1}</span>
          ${boutonsBloc("formation", i)}
        </div>
        <div class="grid gap-3 sm:grid-cols-2">
          <input class="field sm:col-span-2" data-champ="formations.${i}.diplome" value="${esc(x.diplome)}" placeholder="Diplôme obtenu" />
          <input class="field" data-champ="formations.${i}.etablissement" value="${esc(x.etablissement)}" placeholder="Établissement" />
          <input class="field" data-champ="formations.${i}.annee" value="${esc(x.annee)}" placeholder="Année" />
        </div>
      </div>`,
  },
};

function rendreRepetables() {
  for (const cfg of Object.values(CHAMPS_REPETABLES)) {
    c$(cfg.conteneur).innerHTML =
      CV[cfg.liste].map(cfg.html).join("") ||
      `<p class="rounded-lg bg-ink-50 px-4 py-3 text-[13px] text-ink-500">Rien pour l’instant — ajoutez votre première entrée.</p>`;
  }
  brancherIA();
  document.querySelectorAll("[data-picto]").forEach((el) => {
    if (!el.innerHTML) el.innerHTML = icon(el.dataset.picto, el.dataset.taille || "h-5 w-5");
  });
}

function ecrire(chemin, valeur) {
  const parts = chemin.split(".");
  let cible = CV;
  for (let i = 0; i < parts.length - 1; i++) cible = cible[parts[i]];
  cible[parts.at(-1)] = valeur;
}

/* ---------------------------------------------------------------- *
 * 5. Planche de travail (design)
 * ---------------------------------------------------------------- */
function rendreDesign() {
  const d = CV.design;

  c$("[data-modeles]").innerHTML = CV_MODELES.map(
    (m) => `
    <button type="button" class="rounded-xl border p-2.5 text-center transition
                   ${d.modele === m.id ? "border-brand-600 bg-brand-50 ring-1 ring-brand-600" : "border-ink-200 hover:border-ink-300"}"
            data-modele="${m.id}" aria-pressed="${d.modele === m.id}">
      <span class="block text-[15px] leading-none" style="color:${d.couleur}">${m.apercu}</span>
      <span class="mt-1.5 block text-[11.5px] font-medium text-ink-700">${m.label}</span>
    </button>`,
  ).join("");

  c$("[data-couleurs]").innerHTML = CV_COULEURS.map(
    ([hex, nom]) => `<button type="button" class="h-9 w-9 rounded-full transition"
        style="background:${hex};box-shadow:${d.couleur === hex ? `0 0 0 2px #fff, 0 0 0 4px ${hex}` : "none"}"
        data-couleur="${hex}" title="${nom}" aria-label="${nom}"></button>`,
  ).join("");
  c$("[data-couleur-libre]").value = d.couleur;

  // Préfixe « reglage- » : « data-taille » sert déjà au dimensionnement des
  // pictogrammes, la collision faisait remonter de faux boutons.
  const puces = (reglage, items, actif) =>
    items
      .map(
        (i) =>
          `<button type="button" class="chip" data-reglage="${reglage}" data-valeur="${i.id}"
                   aria-pressed="${actif === i.id}">${i.label}</button>`,
      )
      .join("");

  c$("[data-polices]").innerHTML = puces("police", CV_POLICES, d.police);
  c$("[data-densites]").innerHTML = puces("densite", CV_DENSITES, d.densite);
  c$("[data-tailles]").innerHTML = puces("taille", CV_TAILLES, d.taille);

  c$("[data-sections]").innerHTML = d.sections
    .map((s, i) => {
      const meta = CV_SECTIONS.find((x) => x.id === s.id);
      const vide = contenuVide[s.id](CV);
      return `
      <div class="flex items-center gap-2 rounded-lg border border-ink-200 px-3 py-2">
        <input type="checkbox" data-section-visible="${s.id}" ${s.visible ? "checked" : ""}
               class="h-4 w-4 shrink-0 rounded border-ink-300 text-brand-600 focus:ring-brand-600" />
        <span class="min-w-0 flex-1 truncate text-[13.5px] ${vide ? "text-ink-400" : "text-ink-700"}">
          ${meta.label}${vide ? " <span class='text-[11.5px]'>(vide)</span>" : ""}
        </span>
        <button type="button" class="btn-ghost p-1" data-section-monter="${i}" aria-label="Monter" ${i === 0 ? "disabled" : ""}>
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="m6 15 6-6 6 6"/></svg>
        </button>
        <button type="button" class="btn-ghost p-1" data-section-descendre="${i}" aria-label="Descendre" ${i === d.sections.length - 1 ? "disabled" : ""}>
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="m6 9 6 6 6-6"/></svg>
        </button>
      </div>`;
    })
    .join("");
}

/* ---------------------------------------------------------------- *
 * 6. Assistance à la rédaction (Apex IA)
 * ---------------------------------------------------------------- */
let iaDisponible = null;

async function appelIA(tache, texte, contexteTexte) {
  const rep = await fetch("/api/ia", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tache, texte, contexte: contexteTexte }),
  });
  if (rep.status === 501 || rep.status === 404) {
    iaDisponible = false;
    brancherIA();
    throw new Error("non configurée");
  }
  const j = await rep.json().catch(() => ({}));
  if (!rep.ok) throw new Error(j.erreur || "échec");
  return j.texte;
}

function brancherIA() {
  document.querySelectorAll("[data-ia]").forEach((zone) => {
    if (iaDisponible === false) {
      zone.innerHTML = "";
      return;
    }
    if (zone.dataset.pret) return;
    zone.dataset.pret = "1";
    zone.innerHTML = `
      <button type="button" class="btn-secondary btn-sm" data-lancer>
        ${icon("etincelle", "h-4 w-4 text-orange-500")} Améliorer la formulation
      </button>
      <span class="text-[12px] text-ink-400" data-etat></span>`;

    zone.querySelector("[data-lancer]").addEventListener("click", async () => {
      const cible = zone.dataset.cible
        ? c$("#" + zone.dataset.cible)
        : document.querySelector(`[data-champ="${zone.dataset.cibleChamp}"]`);
      if (!cible) return;

      const etat = zone.querySelector("[data-etat]");
      const bouton = zone.querySelector("[data-lancer]");
      const avant = cible.value;

      if (avant.trim().length < 15) {
        etat.textContent = "Écrivez d’abord quelques mots.";
        return;
      }

      bouton.disabled = true;
      etat.textContent = "Apex IA reformule…";
      try {
        const apres = await appelIA(zone.dataset.ia, avant, CV.poste);
        cible.value = apres;
        cible.dispatchEvent(new Event("input", { bubbles: true }));
        etat.innerHTML = `<button type="button" class="font-semibold text-brand-600 underline" data-annuler>Annuler</button>`;
        etat.querySelector("[data-annuler]").addEventListener("click", () => {
          cible.value = avant;
          cible.dispatchEvent(new Event("input", { bubbles: true }));
          etat.textContent = "";
        });
      } catch (e) {
        etat.textContent = e.message === "non configurée" ? "" : "Le service n’a pas répondu. Réessayez.";
      } finally {
        bouton.disabled = false;
      }
    });
  });
}

/* ---------------------------------------------------------------- *
 * 7. Exports
 * ---------------------------------------------------------------- */
const nomFichier = () =>
  "CV-" +
  (CV.nom || "annuaire-misi").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "");

/**
 * PDF : on clone la feuille dans un conteneur enfant DIRECT de <body>,
 * seul élément que la feuille de style d'impression laisse visible.
 * (Imprimer l'aperçu en place échouait : ses parents étaient masqués.)
 */
function exporterPDF() {
  document.getElementById("impression")?.remove();

  const page = c$("[data-cv]");
  const conteneur = document.createElement("div");
  conteneur.id = "impression";
  const feuille = document.createElement("div");
  feuille.className = "cv-page";
  feuille.style.cssText = page.style.cssText; // police, taille, interligne
  feuille.innerHTML = page.innerHTML;
  conteneur.appendChild(feuille);
  document.body.appendChild(conteneur);

  const titreAvant = document.title;
  document.title = nomFichier(); // nom proposé par défaut dans la boîte d'impression

  const nettoyer = () => {
    document.getElementById("impression")?.remove();
    document.title = titreAvant;
    removeEventListener("afterprint", nettoyer);
  };
  addEventListener("afterprint", nettoyer);

  // Laisse le navigateur peindre le clone avant d'ouvrir la boîte d'impression.
  requestAnimationFrame(() => {
    window.print();
    setTimeout(nettoyer, 1500); // filet de sécurité si afterprint ne part pas
  });
}

/**
 * Word : Word ignore flexbox et grid. La seule mise en page qu'il
 * interprète fidèlement est le tableau — on régénère donc le document
 * plutôt que de recopier le HTML de l'écran.
 */
function htmlWord() {
  const x = contexte();
  const a = x.a;
  const pt = x.pt;
  const T = x.T;
  const d = CV;
  const serif = CV.design.police === "serif" || CV.design.modele === "classique";
  const police = serif ? "Georgia, 'Times New Roman', serif" : "Calibri, 'Segoe UI', Arial, sans-serif";

  const titre = (t, blanc = false) =>
    `<p style="margin:14pt 0 5pt;font-size:${T(0.92)}pt;font-weight:bold;letter-spacing:1pt;
        text-transform:uppercase;color:${blanc ? "#ffffff" : a};
        border-bottom:1pt solid ${blanc ? "#ffffff" : a};padding-bottom:2pt">${t}</p>`;

  const experiences = d.experiences
    .filter((e) => e.poste || e.entreprise || e.description)
    .map(
      (e) => `
      <p style="margin:0 0 1pt;font-size:${T(1.03)}pt"><b>${esc(e.poste || "Poste")}</b>
        <span style="color:#68757e;font-size:${T(0.86)}pt">— ${esc(periode(e.debut, e.fin))}</span></p>
      ${
        e.entreprise || e.lieu
          ? `<p style="margin:0 0 3pt;font-size:${T(0.94)}pt;color:${a}"><b>${esc([e.entreprise, e.lieu].filter(Boolean).join(" · "))}</b></p>`
          : ""
      }
      ${
        lignes(e.description).length
          ? `<ul style="margin:0 0 9pt 16pt;padding:0">${lignes(e.description)
              .map((p) => `<li style="margin-bottom:1pt">${esc(p)}</li>`)
              .join("")}</ul>`
          : '<p style="margin:0 0 9pt"></p>'
      }`,
    )
    .join("");

  const formations = d.formations
    .filter((f) => f.diplome || f.etablissement)
    .map(
      (f) => `
      <p style="margin:0 0 1pt;font-size:${pt}pt"><b>${esc(f.diplome || "Diplôme")}</b>
        <span style="color:#68757e;font-size:${T(0.86)}pt">— ${esc(f.annee || "")}</span></p>
      <p style="margin:0 0 8pt;font-size:${T(0.94)}pt;color:${a}">${esc(f.etablissement || "")}</p>`,
    )
    .join("");

  const listeSimple = (t, blanc = false) =>
    `<ul style="margin:0 0 6pt 14pt;padding:0;${blanc ? "color:#ffffff" : ""}">${lignes(t)
      .map((v) => `<li style="margin-bottom:1pt;font-size:${T(0.92)}pt">${esc(v)}</li>`)
      .join("")}</ul>`;

  const visible = (id) => CV.design.sections.find((s) => s.id === id)?.visible && !contenuVide[id](d);

  const corpsPrincipal =
    (visible("accroche") ? `<p style="margin:0 0 10pt;font-size:${T(0.98)}pt;color:#3b454c">${esc(d.accroche)}</p>` : "") +
    (visible("experiences") ? titre("Expérience professionnelle") + experiences : "") +
    (visible("formations") ? titre("Formation") + formations : "");

  const corpsCote =
    (visible("competences") ? titre("Compétences", true) + listeSimple(d.competences, true) : "") +
    (visible("langues") ? titre("Langues", true) + listeSimple(d.langues, true) : "") +
    (visible("interets") ? titre("Centres d’intérêt", true) + listeSimple(d.interets, true) : "") +
    (visible("references")
      ? titre("Références", true) + `<p style="margin:0;font-size:${T(0.92)}pt;color:#ffffff">${esc(d.references)}</p>`
      : "");

  const contactEmpile = [d.telephone, d.email, d.ville, d.lien, d.permis]
    .filter(Boolean)
    .map((v) => `<p style="margin:0 0 3pt;font-size:${T(0.9)}pt;color:#ffffff">${esc(v)}</p>`)
    .join("");

  const deuxColonnes = ["colonnes", "inverse"].includes(CV.design.modele);

  const enTete = `
    <p style="margin:0;font-size:${T(2)}pt;font-weight:bold;color:#161d22">${esc(d.nom || "Votre nom")}</p>
    ${d.poste ? `<p style="margin:3pt 0 0;font-size:${T(1.12)}pt;color:${a}"><b>${esc(d.poste)}</b></p>` : ""}`;

  const corps = deuxColonnes
    ? `<table cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse">
         <tr>
           <td width="34%" valign="top" style="background:${a};padding:20pt 14pt;color:#ffffff">
             ${contactEmpile}${corpsCote}
           </td>
           <td width="66%" valign="top" style="padding:20pt 16pt">
             ${enTete}${corpsPrincipal}
           </td>
         </tr>
       </table>`
    : `<div style="padding:22pt 26pt">
         ${enTete}
         <p style="margin:7pt 0 0;font-size:${T(0.88)}pt;color:#68757e">${x.contactLigne()}</p>
         <hr style="border:none;border-top:2pt solid ${a};margin:9pt 0 0" />
         ${corpsPrincipal}
         ${corpsCote.replace(/#ffffff/g, a === "#ffffff" ? "#161d22" : "#161d22")}
       </div>`;

  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8">
<title>${esc(d.nom || "CV")}</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom>
<w:DoNotOptimizeForBrowser/></w:WordDocument></xml><![endif]-->
<style>
  @page { size: 21cm 29.7cm; margin: 0; }
  body { font-family: ${police}; font-size: ${pt}pt; color: #1b2227; margin: 0; }
  p { line-height: ${x.esp.ligne}; }
  ul { list-style-type: disc; }
</style></head>
<body>${corps}</body></html>`;
}

function exporterWord() {
  const blob = new Blob(["﻿", htmlWord()], { type: "application/msword;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomFichier() + ".doc";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ---------------------------------------------------------------- *
 * 8. Démarrage
 * ---------------------------------------------------------------- */
document.addEventListener("DOMContentLoaded", () => {
  restaurer();
  const form = c$("[data-form-cv]");

  const rafraichirTout = () => {
    rendreCV();
    rendreDesign();
    sauvegarder();
  };

  /* Champs simples */
  form.querySelectorAll("input[name], textarea[name]").forEach((el) => {
    if (CV[el.name] !== undefined) el.value = CV[el.name];
    el.addEventListener("input", () => {
      CV[el.name] = el.value;
      rafraichirTout();
    });
  });

  /* Champs répétables */
  form.addEventListener("input", (e) => {
    const el = e.target.closest("[data-champ]");
    if (!el) return;
    ecrire(el.dataset.champ, el.value);
    rafraichirTout();
  });

  /* Boutons du formulaire */
  form.addEventListener("click", (e) => {
    const ajout = e.target.closest("[data-ajouter]");
    if (ajout) {
      const cfg = CHAMPS_REPETABLES[ajout.dataset.ajouter];
      CV[cfg.liste].push(cfg.vide());
      rendreRepetables();
      return rafraichirTout();
    }
    const sup = e.target.closest("[data-supprimer]");
    if (sup) {
      const cfg = CHAMPS_REPETABLES[sup.dataset.supprimer];
      CV[cfg.liste].splice(Number(sup.dataset.i), 1);
      rendreRepetables();
      return rafraichirTout();
    }
    const haut = e.target.closest("[data-monter]");
    if (haut) {
      const cfg = CHAMPS_REPETABLES[haut.dataset.monter];
      const i = Number(haut.dataset.i);
      if (i > 0) {
        const l = CV[cfg.liste];
        [l[i - 1], l[i]] = [l[i], l[i - 1]];
        rendreRepetables();
        rafraichirTout();
      }
      return;
    }

    /* --- Planche de travail --- */
    const modele = e.target.closest("[data-modele]");
    if (modele) {
      CV.design.modele = modele.dataset.modele;
      return rafraichirTout();
    }
    const couleur = e.target.closest("[data-couleur]");
    if (couleur) {
      CV.design.couleur = couleur.dataset.couleur;
      return rafraichirTout();
    }
    const reglage = e.target.closest("[data-reglage]");
    if (reglage) {
      CV.design[reglage.dataset.reglage] = reglage.dataset.valeur;
      return rafraichirTout();
    }
    const monter = e.target.closest("[data-section-monter]");
    if (monter) {
      const i = Number(monter.dataset.sectionMonter);
      const s = CV.design.sections;
      if (i > 0) [s[i - 1], s[i]] = [s[i], s[i - 1]];
      return rafraichirTout();
    }
    const descendre = e.target.closest("[data-section-descendre]");
    if (descendre) {
      const i = Number(descendre.dataset.sectionDescendre);
      const s = CV.design.sections;
      if (i < s.length - 1) [s[i + 1], s[i]] = [s[i], s[i + 1]];
      return rafraichirTout();
    }
    if (e.target.closest("[data-reinit-design]")) {
      CV.design = structuredClone(DESIGN_DEFAUT);
      return rafraichirTout();
    }
  });

  form.addEventListener("change", (e) => {
    const v = e.target.closest("[data-section-visible]");
    if (!v) return;
    const s = CV.design.sections.find((x) => x.id === v.dataset.sectionVisible);
    if (s) s.visible = v.checked;
    rafraichirTout();
  });

  c$("[data-couleur-libre]").addEventListener("input", (e) => {
    CV.design.couleur = e.target.value;
    rendreCV();
    sauvegarder();
  });

  /* Zoom de l'aperçu */
  let echelle = Number(localStorage.getItem("misi-cv-zoom")) || 0.7;
  const appliquerZoom = () => {
    const boite = c$("[data-echelle]");
    boite.style.transform = `scale(${echelle})`;
    boite.style.height = 297 * echelle + "mm";
    c$("[data-zoom-valeur]").textContent = Math.round(echelle * 100) + " %";
    localStorage.setItem("misi-cv-zoom", String(echelle));
  };
  document.querySelectorAll("[data-zoom]").forEach((b) =>
    b.addEventListener("click", () => {
      echelle = Math.min(1.2, Math.max(0.35, echelle + (b.dataset.zoom === "+" ? 0.1 : -0.1)));
      appliquerZoom();
    }),
  );
  appliquerZoom();

  /* Barre d'actions */
  c$("[data-pdf]").addEventListener("click", exporterPDF);
  c$("[data-word]").addEventListener("click", exporterWord);

  c$("[data-exemple]").addEventListener("click", () => {
    Object.assign(CV, structuredClone(EXEMPLE));
    form.querySelectorAll("input[name], textarea[name]").forEach((el) => {
      if (CV[el.name] !== undefined) el.value = CV[el.name];
    });
    rendreRepetables();
    rafraichirTout();
  });

  c$("[data-vider]").addEventListener("click", () => {
    if (!confirm("Effacer tout le contenu du CV ? Cette action est définitive.")) return;
    Object.assign(CV, {
      nom: "", poste: "", telephone: "", email: "", ville: "", lien: "", permis: "",
      accroche: "", experiences: [], formations: [],
      competences: "", langues: "", interets: "", references: "",
    });
    form.querySelectorAll("input[name], textarea[name]").forEach((el) => (el.value = ""));
    localStorage.removeItem(CLE_STOCKAGE);
    rendreRepetables();
    rafraichirTout();
  });

  /* Premier rendu */
  if (!CV.experiences.length) CV.experiences.push(CHAMPS_REPETABLES.experience.vide());
  if (!CV.formations.length) CV.formations.push(CHAMPS_REPETABLES.formation.vide());
  rendreRepetables();
  rendreCV();
  rendreDesign();

  /* L'assistance IA n'apparaît que si le service répond. */
  fetch("/api/ia", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tache: "accroche", texte: "" }),
  })
    .then((r) => {
      iaDisponible = r.status !== 501 && r.status !== 404;
      brancherIA();
    })
    .catch(() => {
      iaDisponible = false;
      brancherIA();
    });
});
