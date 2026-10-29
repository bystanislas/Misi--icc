/* Page Mise en relation — moteur de suggestion transparent.
 *
 * Chaque intention est reliée soit à ce qu'un membre peut apporter (déduit de
 * son expérience), soit à ce qu'il déclare rechercher — la réciprocité étant
 * la seule mise en relation honnête que permettent les données du formulaire.
 */

const INTENTIONS = [
  {
    id: "mentor",
    label: "Un mentor, un accompagnement",
    apport: "mentorat",
    motif: "Peut accompagner (expérience confirmée)",
  },
  { id: "conseil", label: "Un conseil, une expertise", apport: "conseil", motif: "Peut conseiller sur son domaine" },
  { id: "formateur", label: "Un formateur", apport: "formation", motif: "Peut former sur son domaine" },
  {
    id: "collaborateur",
    label: "Un collaborateur pour une mission",
    apport: "collaboration",
    besoin: "collaboration",
    motif: "Ouvert à une collaboration professionnelle",
  },
  {
    id: "partenaire",
    label: "Un partenaire d’affaires",
    besoin: "partenariat",
    apport: "partenariat",
    motif: "Recherche lui-même un partenaire d’affaires",
  },
  { id: "recruter", label: "Quelqu’un à recruter", besoin: "emploi", motif: "Recherche une opportunité d’emploi" },
  {
    id: "equipiers",
    label: "Des équipiers pour un projet",
    besoin: "projet",
    apport: "projet",
    motif: "Cherche à s’engager sur un projet",
  },
  {
    id: "aFinancer",
    label: "Un porteur de projet à financer",
    besoin: "investissement",
    motif: "Recherche un investisseur",
  },
];

const q = (s) => document.querySelector(s);
const critere = { intention: "mentor", secteur: "", metier: "", niveau: -1, ville: "", zone: "", mots: "" };

function evaluer(m) {
  const it = INTENTIONS.find((i) => i.id === critere.intention);
  const raisons = [];
  let s = 0;

  // 1. Correspondance de l'intention (critère bloquant)
  const parBesoin = it.besoin && m.besoins.includes(it.besoin);
  const parApport = it.apport && m.apports.includes(it.apport);
  if (!parBesoin && !parApport) return null;
  s += 45;
  raisons.push(parBesoin ? it.motif : "Peut apporter : " + Data.libApport(it.apport).label);

  // 2. Secteur
  if (critere.secteur) {
    if (!m.secteurs.includes(critere.secteur)) return null;
    s += 25;
    raisons.push("Secteur " + critere.secteur);
  }

  // 2 bis. Métier précis
  if (critere.metier) {
    if (!m.metiers.includes(critere.metier)) return null;
    s += 30;
    raisons.push("Métier : " + critere.metier);
  }

  // 3. Niveau d'expérience
  if (critere.niveau >= 0) {
    if (m.rang < critere.niveau) return null;
    s += 15;
    raisons.push("Expérience : " + m.experience);
  } else {
    s += m.rang * 3;
  }

  // 4. Proximité géographique
  if (critere.ville) {
    if (m.ville !== critere.ville) return null;
    s += 6;
  }
  if (critere.zone) {
    if (m.commune === critere.zone) {
      s += 12;
      raisons.push("Même commune : " + m.commune);
    } else return null;
  }

  // 5. Mots-clés libres
  const mots = sansAccent(critere.mots).split(/\s+/).filter(Boolean);
  if (mots.length) {
    const idx = sansAccent([m.nom, m.metier, ...m.metiers, ...m.secteurs, m.departement, m.commune, m.quartier].join(" "));
    const touches = mots.filter((w) => idx.includes(w));
    if (!touches.length) return null;
    s += touches.length * 10;
    raisons.push("Mot-clé : " + touches.join(", "));
  }

  return { membre: m, score: s, raisons };
}

function ligne(r, max) {
  const m = r.membre;
  const pct = Math.round((r.score / max) * 100);
  // Échelle relative au meilleur résultat de la recherche en cours :
  // le score absolu du moteur de compatibilité n'a pas la même amplitude ici.
  const niv =
    pct >= 85
      ? { label: "Très forte", classe: "text-emerald-700" }
      : pct >= 60
        ? { label: "Forte", classe: "text-brand-700" }
        : { label: "Possible", classe: "text-ink-500" };
  return `
  <article class="card card-hover flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
    <button class="flex min-w-0 flex-1 items-center gap-3.5 text-left" data-profil="${m.id}">
      ${avatar(m)}
      <span class="min-w-0">
        <span class="block truncate font-display text-[15.5px] font-semibold text-ink-900">${esc(m.nom)}</span>
        <span class="mt-0.5 block truncate text-[13px] text-ink-500">
          ${esc(m.metiers.join(" · ") || m.metier || m.secteurs.join(" · "))}
        </span>
        <span class="mt-2 flex flex-wrap gap-1.5">
          ${r.raisons
            .map(
              (x) =>
                `<span class="badge-emerald">${icon("check", "h-3 w-3")}${esc(x)}</span>`,
            )
            .join("")}
        </span>
      </span>
    </button>

    <div class="flex shrink-0 items-center gap-4 sm:flex-col sm:items-end">
      <div class="w-32">
        <div class="flex items-baseline justify-between gap-2">
          <span class="text-[11px] font-semibold text-ink-400 uppercase">Pertinence</span>
          <span class="text-[12px] font-bold ${niv.classe}">${niv.label}</span>
        </div>
        <div class="mt-1.5 h-1.5 overflow-hidden rounded-full bg-ink-100">
          <div class="h-full rounded-full bg-brand-500" style="width:${pct}%"></div>
        </div>
      </div>
      <div class="flex gap-2">
        <button class="btn-primary btn-sm" data-relation="${m.id}">Mettre en relation</button>
        <button class="btn-secondary btn-sm" data-partage="${m.id}" aria-label="Partager sur WhatsApp">
          ${icon("partage", "h-4 w-4")}
        </button>
      </div>
    </div>
  </article>`;
}

function rendre() {
  const res = Data.membres.map(evaluer).filter(Boolean).sort((a, b) => b.score - a.score);
  const it = INTENTIONS.find((i) => i.id === critere.intention);
  const max = res[0]?.score || 1;

  q("[data-resume]").innerHTML = res.length
    ? `<strong class="font-semibold text-ink-900">${res.length}</strong> profil${res.length > 1 ? "s" : ""} correspond${res.length > 1 ? "ent" : ""} à « ${esc(it.label.toLowerCase())} »${critere.secteur ? " en " + esc(critere.secteur) : ""}.`
    : "";
  q("[data-resultats]").innerHTML = res.slice(0, 24).map((r) => ligne(r, max)).join("");
  q("[data-vide]").classList.toggle("hidden", res.length > 0);
}

Data.charger().then(() => {
  q("[data-intentions]").innerHTML = INTENTIONS.map(
    (i, k) => `
    <label class="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 hover:bg-ink-50">
      <input type="radio" name="intention" value="${i.id}" ${k === 0 ? "checked" : ""}
             class="h-4 w-4 shrink-0 border-ink-300 text-brand-600 focus:ring-brand-600">
      <span class="text-[13.5px] text-ink-700">${esc(i.label)}</span>
    </label>`,
  ).join("");

  q("#m-secteur").innerHTML =
    `<option value="">Tous les secteurs</option>` +
    Data.secteurs().map(([s, n]) => `<option value="${esc(s)}">${esc(s)} (${n})</option>`).join("");

  q("#m-metier").innerHTML =
    `<option value="">Tous les métiers</option>` +
    Data.metiersUtilises().map(([x, n]) => `<option value="${esc(x)}">${esc(x)} (${n})</option>`).join("");

  q("#m-ville").innerHTML =
    `<option value="">Toutes les villes</option>` +
    Data.villes()
      .filter(([v]) => v !== "Non précisée")
      .map(([v, n]) => `<option value="${esc(v)}">${esc(v)} (${n})</option>`)
      .join("");

  q("#m-zone").innerHTML =
    `<option value="">Toutes les communes</option>` +
    Data.communes()
      .filter(([z]) => z !== "Non précisée")
      .map(([z, n]) => `<option value="${esc(z)}">${esc(z)} (${n})</option>`)
      .join("");

  rendre();

  const maj = q("[data-maj]");
  if (maj)
    maj.textContent =
      "Mis à jour le " +
      new Date(Data.genereLe).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });

  const form = q("[data-form-matching]");
  form.addEventListener("change", () => {
    critere.intention = form.querySelector("input[name=intention]:checked").value;
    critere.secteur = q("#m-secteur").value;
    critere.metier = q("#m-metier").value;
    critere.niveau = Number(q("#m-niveau").value);
    critere.ville = q("#m-ville").value;
    critere.zone = q("#m-zone").value;
    rendre();
  });

  let t;
  q("#m-mots").addEventListener("input", (e) => {
    clearTimeout(t);
    t = setTimeout(() => {
      critere.mots = e.target.value;
      rendre();
    }, 180);
  });

  form.addEventListener("reset", () => {
    setTimeout(() => {
      Object.assign(critere, { intention: "mentor", secteur: "", metier: "", niveau: -1, ville: "", zone: "", mots: "" });
      rendre();
    }, 0);
  });
});
