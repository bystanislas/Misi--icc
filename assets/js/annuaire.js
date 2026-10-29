/* Page Annuaire — recherche plein texte, facettes multiples, tri, permaliens. */

const FACETTES = ["secteur", "metier", "besoin", "apport", "niveau", "ville", "commune", "age", "interet"];

const Etat = { q: "", tri: "pertinence" };
FACETTES.forEach((f) => (Etat[f] = new Set()));

const $ = (s) => document.querySelector(s);
const champQ = $("#q");

/* --- Index de recherche : tout le profil devient interrogeable ---- */
function indexer(m) {
  return sansAccent(
    [
      m.nom,
      m.metier,
      ...m.metiers,
      ...m.secteurs,
      m.experience,
      m.ville,
      m.commune,
      m.quartier,
      m.departement,
      m.famille,
      m.age ? Data.libAge(m.age) : "",
      ...(m.interets || []),
      ...m.besoins.map((b) => Data.libBesoin(b).label + " " + Data.libBesoin(b).court),
      ...m.apports.map((a) => Data.libApport(a).label),
    ].join(" "),
  );
}

/* --- Score de pertinence ----------------------------------------- */
function score(m, mots) {
  if (!mots.length) return m.rang;
  let s = 0;
  const nom = sansAccent(m.nom);
  const metiers = sansAccent(m.metiers.join(" ") + " " + m.metier);
  const secteurs = sansAccent(m.secteurs.join(" "));
  mots.forEach((mot) => {
    if (nom.startsWith(mot)) s += 12;
    else if (nom.includes(mot)) s += 8;
    if (metiers.includes(mot)) s += 9;
    if (secteurs.includes(mot)) s += 5;
    if (m._idx.includes(mot)) s += 2;
  });
  return s + m.rang * 0.1;
}

/* --- Filtrage ----------------------------------------------------- */
const VALEURS = {
  secteur: (m) => m.secteurs,
  metier: (m) => m.metiers,
  besoin: (m) => m.besoins,
  apport: (m) => m.apports,
  niveau: (m) => [m.niveau],
  ville: (m) => [m.ville],
  commune: (m) => [m.commune],
  age: (m) => (m.age ? [m.age] : []),
  interet: (m) => m.interets || [],
};

function filtrer() {
  const mots = sansAccent(Etat.q).split(/\s+/).filter(Boolean);

  const res = Data.membres.filter((m) => {
    if (mots.some((mot) => !m._idx.includes(mot))) return false;
    return FACETTES.every((f) => !Etat[f].size || VALEURS[f](m).some((v) => Etat[f].has(v)));
  });

  const tris = {
    pertinence: (a, b) => score(b, mots) - score(a, mots) || a.nom.localeCompare(b.nom, "fr"),
    nom: (a, b) => a.nom.localeCompare(b.nom, "fr"),
    experience: (a, b) => b.rang - a.rang || a.nom.localeCompare(b.nom, "fr"),
    zone: (a, b) => a.zone.localeCompare(b.zone, "fr") || a.nom.localeCompare(b.nom, "fr"),
  };
  return res.sort(tris[Etat.tri]);
}

/* --- Facettes ----------------------------------------------------- */
function bloc(titre, cle, entrees, libelle, note = "") {
  const vide = !entrees.length;
  return `
  <details class="group rounded-xl border border-ink-200 bg-white" ${Etat[cle].size ? "open" : ""}>
    <summary class="flex cursor-pointer list-none items-center justify-between px-4 py-3">
      <span class="text-[13.5px] font-semibold ${vide ? "text-ink-400" : "text-ink-900"}">${titre}</span>
      <span class="flex items-center gap-2">
        ${Etat[cle].size ? `<span class="badge-brand">${Etat[cle].size}</span>` : ""}
        <svg class="h-4 w-4 text-ink-400 transition group-open:rotate-180" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="m6 9 6 6 6-6"/></svg>
      </span>
    </summary>
    <div class="max-h-72 space-y-0.5 overflow-y-auto border-t border-ink-100 px-2 py-2">
      ${
        vide
          ? `<p class="px-2.5 py-2 text-[12.5px] leading-relaxed text-ink-500">${note}</p>`
          : entrees
              .map(
                ([val, n]) => `
        <label class="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-ink-50">
          <input type="checkbox" class="h-4 w-4 shrink-0 rounded border-ink-300 text-brand-600 focus:ring-brand-600"
                 data-facette="${cle}" value="${esc(val)}" ${Etat[cle].has(val) ? "checked" : ""}>
          <span class="min-w-0 flex-1 truncate text-[13.5px] text-ink-700">${esc(libelle(val))}</span>
          <span class="text-[12px] tabular-nums text-ink-400">${n}</span>
        </label>`,
              )
              .join("")
      }
    </div>
  </details>`;
}

/** Les métiers proposés dépendent des secteurs cochés (liste sinon trop longue). */
function entreesMetiers() {
  const utilises = new Map(Data.metiersUtilises());
  if (!Etat.secteur.size) return [...utilises.entries()].sort((a, b) => b[1] - a[1]);

  return Data.metiersParSecteur()
    .filter(([secteur]) => Etat.secteur.has(secteur))
    .flatMap(([, liste]) => liste)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "fr"));
}

function rendreFacettes() {
  const niveaux = Data.ref.niveaux
    .map((n) => [n.id, Data.membres.filter((m) => m.niveau === n.id).length])
    .filter(([, n]) => n);

  $("[data-facettes]").innerHTML = [
    bloc("Secteur d’activité", "secteur", Data.secteurs(), (v) => v),
    bloc(
      Etat.secteur.size ? "Métier (secteurs choisis)" : "Métier",
      "metier",
      entreesMetiers(),
      (v) => v,
      "Aucun métier renseigné pour l’instant.",
    ),
    bloc("Recherche…", "besoin", Data.besoins(), (v) => Data.libBesoin(v).label),
    bloc("Peut apporter…", "apport", Data.apports(), (v) => Data.libApport(v).label),
    bloc("Niveau d’expérience", "niveau", niveaux, (v) => Data.ref.niveaux.find((n) => n.id === v)?.label || v),
    bloc("Ville", "ville", Data.villes(), (v) => v),
    bloc("Commune", "commune", Data.communes(), (v) => v),
    bloc(
      "Tranche d’âge",
      "age",
      Data.ages(),
      (v) => Data.libAge(v),
      "Champ ajouté au formulaire d’inscription — il se remplira au fur et à mesure des nouvelles inscriptions.",
    ),
    bloc(
      "Centres d’intérêt",
      "interet",
      Data.interets(),
      (v) => v,
      "Champ ajouté au formulaire d’inscription — il se remplira au fur et à mesure des nouvelles inscriptions.",
    ),
  ].join("");
}

/* --- Étiquettes des filtres actifs -------------------------------- */
const LIBELLE_ACTIF = {
  secteur: (v) => v,
  metier: (v) => v,
  besoin: (v) => "Recherche : " + Data.libBesoin(v).court,
  apport: (v) => "Apporte : " + Data.libApport(v).label,
  niveau: (v) => Data.ref.niveaux.find((n) => n.id === v)?.label || v,
  ville: (v) => v,
  commune: (v) => v,
  age: (v) => Data.libAge(v),
  interet: (v) => v,
};

function rendreActifs() {
  const items = [];
  const pousser = (cle, val, texte) =>
    items.push(`<button class="chip" data-retirer="${cle}" data-val="${esc(val)}">
        ${esc(texte)} <span class="text-ink-400" data-picto="fermer" data-taille="h-3 w-3"></span></button>`);

  if (Etat.q) pousser("q", Etat.q, `« ${Etat.q} »`);
  FACETTES.forEach((f) => Etat[f].forEach((v) => pousser(f, v, LIBELLE_ACTIF[f](v))));

  const zone = $("[data-actifs]");
  zone.innerHTML = items.length
    ? items.join("") +
      `<button class="chip border-0 bg-ink-100 ring-0 hover:bg-ink-200" data-reinit>Tout effacer</button>`
    : "";
  zone.querySelectorAll("[data-picto]").forEach((el) => (el.innerHTML = icon(el.dataset.picto, el.dataset.taille)));

  const c = $("[data-compteur-filtres]");
  const n = items.length;
  c.hidden = !n;
  c.textContent = n;
}

/* --- Rendu -------------------------------------------------------- */
function rendre() {
  const res = filtrer();
  const total = Data.membres.length;

  $("[data-resume-resultats]").innerHTML =
    res.length === total
      ? `<strong class="font-semibold text-ink-900">${total}</strong> profils référencés`
      : `<strong class="font-semibold text-ink-900">${res.length}</strong> profil${res.length > 1 ? "s" : ""} sur ${total}`;

  $("[data-resultats]").innerHTML = res.map((m) => carteMembre(m, Etat.q.trim())).join("");
  $("[data-vide]").classList.toggle("hidden", res.length > 0);

  rendreActifs();
  majUrl();
}

/* --- Synchronisation avec l'URL ----------------------------------- */
function majUrl() {
  const p = new URLSearchParams();
  if (Etat.q) p.set("q", Etat.q);
  FACETTES.forEach((f) => {
    if (Etat[f].size) p.set(f, [...Etat[f]].join("|"));
  });
  if (Etat.tri !== "pertinence") p.set("tri", Etat.tri);
  history.replaceState(null, "", p.toString() ? "?" + p : location.pathname);
}

function lireUrl() {
  const p = new URLSearchParams(location.search);
  Etat.q = p.get("q") || "";
  FACETTES.forEach((f) => {
    const v = p.get(f);
    if (v) v.split("|").forEach((x) => Etat[f].add(x));
  });
  // Compatibilité avec les anciens liens ?zone=
  const zone = p.get("zone");
  if (zone) zone.split("|").forEach((x) => Etat.commune.add(x));
  Etat.tri = p.get("tri") || "pertinence";
  return p.get("p");
}

/* --- Démarrage ---------------------------------------------------- */
Data.charger().then(() => {
  Data.membres.forEach((m) => (m._idx = indexer(m)));

  const profilInitial = lireUrl();
  champQ.value = Etat.q;
  $("#tri").value = Etat.tri;

  rendreFacettes();
  rendre();

  if (profilInitial) ouvrirProfil(profilInitial);

  // Données Firestore arrivées après le premier affichage : on ré-affiche.
  addEventListener("misi:membres", () => {
    Data.membres.forEach((m) => (m._idx = indexer(m)));
    rendreFacettes();
    rendre();
  });

  const maj = $("[data-maj]");
  if (maj)
    maj.textContent =
      "Mis à jour le " +
      new Date(Data.genereLe).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });

  /* Recherche (avec anti-rebond) */
  let t;
  const boutonVider = document.querySelector("[data-vider-q]");
  champQ.addEventListener("input", () => {
    clearTimeout(t);
    t = setTimeout(() => {
      Etat.q = champQ.value;
      boutonVider.classList.toggle("hidden", !Etat.q);
      rendre();
    }, 160);
  });

  boutonVider.addEventListener("click", () => {
    champQ.value = "";
    Etat.q = "";
    boutonVider.classList.add("hidden");
    rendre();
    champQ.focus();
  });
  boutonVider.classList.toggle("hidden", !Etat.q);

  /* Cases à cocher des facettes */
  $("[data-facettes]").addEventListener("change", (e) => {
    const c = e.target.closest("[data-facette]");
    if (!c) return;
    const cle = c.dataset.facette;
    c.checked ? Etat[cle].add(c.value) : Etat[cle].delete(c.value);
    // Changer de secteur change la liste des métiers proposés.
    if (cle === "secteur") rendreFacettes();
    rendre();
  });

  /* Tri */
  $("#tri").addEventListener("change", (e) => {
    Etat.tri = e.target.value;
    rendre();
  });

  /* Retrait d'un filtre actif + réinitialisation */
  document.addEventListener("click", (e) => {
    const r = e.target.closest("[data-retirer]");
    if (r) {
      const cle = r.dataset.retirer;
      if (cle === "q") {
        Etat.q = "";
        champQ.value = "";
      } else Etat[cle].delete(r.dataset.val);
      rendreFacettes();
      return rendre();
    }
    if (e.target.closest("[data-reinit]")) {
      Etat.q = "";
      champQ.value = "";
      FACETTES.forEach((f) => Etat[f].clear());
      rendreFacettes();
      rendre();
    }
  });

  /* Panneau de filtres sur mobile */
  const bt = document.querySelector("[data-filtres-bouton]");
  bt?.addEventListener("click", () => {
    const panneau = $("[data-filtres]");
    const ouvert = panneau.classList.toggle("hidden");
    bt.setAttribute("aria-expanded", String(!ouvert));
  });
});
