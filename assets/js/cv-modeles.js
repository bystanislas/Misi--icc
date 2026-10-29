/* ==================================================================
 * Modèles de CV — six mises en page, toutes en A4 réel.
 *
 * Chaque modèle reçoit un contexte `x` contenant :
 *   x.d        les données du CV
 *   x.a        la couleur d'accent
 *   x.section  (id) → le HTML d'une section, dans l'ordre choisi
 *   x.principal / x.cote   les sections déjà filtrées et ordonnées
 *   x.esp      espacements dérivés de la densité
 * ================================================================== */

const CV_MODELES = [
  { id: "colonnes", label: "Deux colonnes", apercu: "▌▐" },
  { id: "sobre", label: "Sobre", apercu: "▬" },
  { id: "bandeau", label: "Bandeau", apercu: "▄" },
  { id: "minimal", label: "Minimal", apercu: "▫" },
  { id: "inverse", label: "Colonne à droite", apercu: "▐▌" },
  { id: "classique", label: "Classique", apercu: "❦" },
];

const CV_POLICES = [
  { id: "sans", label: "Inter", pile: '"Inter", system-ui, sans-serif' },
  { id: "serif", label: "Georgia", pile: 'Georgia, "Times New Roman", serif' },
  { id: "systeme", label: "Système", pile: '-apple-system, "Segoe UI", Roboto, sans-serif' },
];

const CV_DENSITES = [
  { id: "compacte", label: "Compacte", bloc: 7, section: 11, ligne: 1.32, marge: "12mm" },
  { id: "normale", label: "Normale", bloc: 11, section: 16, ligne: 1.45, marge: "15mm" },
  { id: "aeree", label: "Aérée", bloc: 15, section: 21, ligne: 1.6, marge: "18mm" },
];

const CV_TAILLES = [
  { id: "petite", label: "Petite", pt: 9.6 },
  { id: "normale", label: "Normale", pt: 10.5 },
  { id: "grande", label: "Grande", pt: 11.4 },
];

const CV_COULEURS = [
  ["#366a82", "Bleu pétrole"],
  ["#a81e3c", "Bordeaux"],
  ["#c97918", "Orange"],
  ["#1f5f4b", "Vert"],
  ["#3f3f6b", "Indigo"],
  ["#7a3b6b", "Prune"],
  ["#0f5f6b", "Sarcelle"],
  ["#283137", "Anthracite"],
];

/** Les sections, leur libellé et leur colonne d'origine. */
const CV_SECTIONS = [
  { id: "accroche", label: "Accroche", zone: "principal" },
  { id: "experiences", label: "Expériences", zone: "principal" },
  { id: "formations", label: "Formations", zone: "principal" },
  { id: "competences", label: "Compétences", zone: "cote" },
  { id: "langues", label: "Langues", zone: "cote" },
  { id: "interets", label: "Centres d’intérêt", zone: "cote" },
  { id: "references", label: "Références", zone: "cote" },
];

/* ------------------------------------------------------------------ *
 * Modèles
 * ------------------------------------------------------------------ */

/** Bande latérale colorée à gauche. */
function cvColonnes(x) {
  return `
  <div style="display:flex;min-height:297mm">
    <aside style="width:62mm;background:${x.a};color:#fff;padding:${x.esp.marge} 8mm 10mm">
      ${x.contactEmpile()}
      ${x.cote.map((id) => x.section(id, { surAccent: true })).join("")}
    </aside>
    <section style="flex:1;padding:${x.esp.marge} 12mm 12mm 10mm">
      ${x.enTete()}
      ${x.principal.map((id) => x.section(id)).join("")}
    </section>
  </div>`;
}

/** Bande latérale à droite — même principe, hiérarchie inversée. */
function cvInverse(x) {
  return `
  <div style="display:flex;min-height:297mm">
    <section style="flex:1;padding:${x.esp.marge} 10mm 12mm 12mm">
      ${x.enTete()}
      ${x.principal.map((id) => x.section(id)).join("")}
    </section>
    <aside style="width:58mm;background:${x.a}12;border-left:2.5px solid ${x.a};padding:${x.esp.marge} 8mm 10mm">
      ${x.contactEmpile({ sombre: true })}
      ${x.cote.map((id) => x.section(id)).join("")}
    </aside>
  </div>`;
}

/** Bandeau coloré en haut, une seule colonne dessous. */
function cvBandeau(x) {
  return `
  <div>
    <header style="background:${x.a};color:#fff;padding:14mm ${x.esp.marge} 11mm">
      <h1 style="font-size:${x.T(2.1)}pt;font-weight:800;line-height:1.05;margin:0;color:#fff">
        ${esc(x.d.nom || "Votre nom")}
      </h1>
      ${x.d.poste ? `<p style="margin:5px 0 0;font-size:${x.T(1.14)}pt;opacity:.92">${esc(x.d.poste)}</p>` : ""}
      <p style="margin:10px 0 0;font-size:${x.T(0.88)}pt;opacity:.85">${x.contactLigne()}</p>
    </header>
    <div style="padding:${x.esp.marge}">
      ${[...x.principal, ...x.cote].map((id) => x.section(id)).join("")}
    </div>
  </div>`;
}

/** Une colonne, filet d'accent sous l'en-tête. */
function cvSobre(x) {
  return `
  <div style="padding:${x.esp.marge}">
    <header style="border-bottom:2.5px solid ${x.a};padding-bottom:9px">
      ${x.enTete({ sansMarge: true })}
      <p style="margin:8px 0 0;font-size:${x.T(0.9)}pt;color:#68757e">${x.contactLigne()}</p>
    </header>
    ${[...x.principal, ...x.cote].map((id) => x.section(id)).join("")}
  </div>`;
}

/** Aucun aplat : filets fins, beaucoup de blanc. Lisible par les ATS. */
function cvMinimal(x) {
  return `
  <div style="padding:${x.esp.marge}">
    <header style="margin-bottom:${x.esp.section}px">
      <h1 style="font-size:${x.T(1.9)}pt;font-weight:700;letter-spacing:-0.01em;margin:0;color:#161d22">
        ${esc(x.d.nom || "Votre nom")}
      </h1>
      ${
        x.d.poste
          ? `<p style="margin:3px 0 0;font-size:${x.T(1.05)}pt;color:#68757e;letter-spacing:.02em">${esc(x.d.poste)}</p>`
          : ""
      }
      <p style="margin:9px 0 0;font-size:${x.T(0.88)}pt;color:#68757e">${x.contactLigne(" — ")}</p>
    </header>
    ${[...x.principal, ...x.cote].map((id) => x.section(id, { filetFin: true })).join("")}
  </div>`;
}

/** Formel, centré, sérif : candidatures académiques et institutionnelles. */
function cvClassique(x) {
  return `
  <div style="padding:${x.esp.marge};font-family:Georgia,'Times New Roman',serif">
    <header style="text-align:center;border-bottom:1px solid ${x.a};padding-bottom:11px">
      <h1 style="font-size:${x.T(2)}pt;font-weight:700;margin:0;letter-spacing:.04em;color:#161d22">
        ${esc(x.d.nom || "Votre nom")}
      </h1>
      ${
        x.d.poste
          ? `<p style="margin:5px 0 0;font-size:${x.T(1.08)}pt;font-style:italic;color:${x.a}">${esc(x.d.poste)}</p>`
          : ""
      }
      <p style="margin:9px 0 0;font-size:${x.T(0.86)}pt;color:#68757e">${x.contactLigne(" • ")}</p>
    </header>
    ${[...x.principal, ...x.cote].map((id) => x.section(id, { centre: true })).join("")}
  </div>`;
}

const CV_RENDU = {
  colonnes: cvColonnes,
  inverse: cvInverse,
  bandeau: cvBandeau,
  sobre: cvSobre,
  minimal: cvMinimal,
  classique: cvClassique,
};
