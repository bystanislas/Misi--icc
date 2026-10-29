/* Page Opportunités — rayons par besoin, filtres collants, publication.
 *
 * 147 opportunités dans une grille plate étaient illisibles : elles sont
 * désormais regroupées en rayons horizontaux, un par type de besoin, avec
 * une barre de filtres qui reste accessible pendant le défilement.
 */

const $$ = (s) => document.querySelector(s);
const filtre = { type: "tous", q: "", secteur: "", commune: "", tri: "defaut", vue: "rayons" };
let toutes = [];

/* Couleur d'accent par type de besoin — repère visuel constant. */
const TON_TYPE = {
  emploi: { hex: "#366a82", badge: "badge-brand" },
  partenariat: { hex: "#c97918", badge: "badge-orange" },
  collaboration: { hex: "#1f7a5a", badge: "badge-emerald" },
  projet: { hex: "#a81e3c", badge: "badge-brique" },
  investissement: { hex: "#3f3f6b", badge: "badge-neutral" },
  formation: { hex: "#0f5f6b", badge: "badge-neutral" },
};

const ton = (t) => TON_TYPE[t] || { hex: "#68757e", badge: "badge-neutral" };

/* ---------------------------------------------------------------- *
 * Carte d'opportunité
 * ---------------------------------------------------------------- */
function carteOpportunite(o) {
  const c = ton(o.type);
  return `
  <article class="card card-hover flex h-full flex-col overflow-hidden p-0">
    <div class="h-1" style="background:${c.hex}"></div>
    <div class="flex flex-1 flex-col p-5">
      <div class="flex flex-wrap items-center gap-1.5">
        <span class="${c.badge}">${icon("cible", "h-3.5 w-3.5")}${esc(o.typeLabel)}</span>
        <span class="badge-neutral">${icon(Data.picto(o.membre.secteur), "h-3.5 w-3.5")}${esc(o.membre.secteur)}</span>
      </div>

      <h3 class="mt-3.5 font-display text-[16.5px] leading-snug font-bold text-ink-900">${esc(o.titre)}</h3>
      <p class="mt-2 text-[13.5px] leading-relaxed text-ink-500">${esc(o.resume)}</p>

      ${
        o.membre.metiers.length
          ? `<div class="mt-3 flex flex-wrap gap-1.5">
               ${o.membre.metiers.slice(0, 2).map((m) => `<span class="badge-orange">${esc(m)}</span>`).join("")}
             </div>`
          : ""
      }

      <div class="mt-auto flex items-center gap-2.5 border-t border-ink-100 pt-4 mt-5">
        <button class="flex min-w-0 flex-1 items-center gap-2.5 text-left" data-profil="${o.membre.id}">
          ${avatar(o.membre, "h-9 w-9 text-[12px]")}
          <span class="min-w-0">
            <span class="block truncate text-[13.5px] font-semibold text-ink-800">${esc(o.membre.nom)}</span>
            <span class="block truncate text-[12px] text-ink-500">${esc(o.membre.zone)}</span>
          </span>
        </button>
        <button class="btn-primary btn-sm" data-relation="${o.membre.id}">Répondre</button>
        <button class="btn-secondary btn-sm" data-partage="${o.membre.id}" aria-label="Partager sur WhatsApp">
          ${icon("partage", "h-4 w-4")}
        </button>
      </div>
    </div>
  </article>`;
}

/* ---------------------------------------------------------------- *
 * Filtrage
 * ---------------------------------------------------------------- */
function filtrees() {
  const q = sansAccent(filtre.q);
  const liste = toutes.filter((o) => {
    if (filtre.type !== "tous" && o.type !== filtre.type) return false;
    if (filtre.secteur && !o.membre.secteurs.includes(filtre.secteur)) return false;
    if (filtre.commune && o.membre.commune !== filtre.commune) return false;
    if (q) {
      const idx = sansAccent(
        [o.titre, o.resume, o.membre.nom, ...o.membre.secteurs, ...o.membre.metiers, o.membre.commune, o.membre.quartier].join(" "),
      );
      if (!idx.includes(q)) return false;
    }
    return true;
  });

  const tris = {
    experience: (a, b) => b.membre.rang - a.membre.rang || a.membre.nom.localeCompare(b.membre.nom, "fr"),
    nom: (a, b) => a.membre.nom.localeCompare(b.membre.nom, "fr"),
  };
  // « defaut » conserve l'alternance entre membres calculée à la construction.
  if (tris[filtre.tri]) liste.sort(tris[filtre.tri]);
  return liste;
}

/* ---------------------------------------------------------------- *
 * Rendu
 * ---------------------------------------------------------------- */
function rendre() {
  const liste = filtrees();

  $$("[data-resume]").innerHTML =
    `<strong class="font-semibold text-ink-900">${liste.length}</strong> opportunité${liste.length > 1 ? "s" : ""} ouverte${liste.length > 1 ? "s" : ""}` +
    (liste.length !== toutes.length ? ` sur ${toutes.length}` : "");

  const rayons = $$("[data-rayons]");
  const grille = $$("[data-grille]");
  $$("[data-vide]").classList.toggle("hidden", liste.length > 0);

  if (filtre.vue === "grille") {
    rayons.classList.add("hidden");
    grille.classList.toggle("hidden", !liste.length);
    grille.classList.toggle("grid", liste.length > 0);
    grille.innerHTML = liste.map(carteOpportunite).join("");
    return;
  }

  grille.classList.add("hidden");
  grille.classList.remove("grid");
  rayons.classList.toggle("hidden", !liste.length);

  // Un rayon par type de besoin, dans l'ordre de leur poids réel.
  const parType = new Map();
  liste.forEach((o) => {
    if (!parType.has(o.type)) parType.set(o.type, []);
    parType.get(o.type).push(o);
  });
  const groupes = [...parType.entries()].sort((a, b) => b[1].length - a[1].length);

  rayons.innerHTML = groupes
    .map(([type, items]) => {
      const c = ton(type);
      const lib = Data.libBesoin(type);
      return `
      <section>
        <div class="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div class="flex items-center gap-3">
            <span class="h-8 w-1 rounded-full" style="background:${c.hex}"></span>
            <div>
              <h2 class="font-display text-[19px] font-bold text-ink-900">${esc(lib.label)}</h2>
              <p class="text-[13px] text-ink-500">
                ${items.length} membre${items.length > 1 ? "s" : ""} concerné${items.length > 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <button class="btn-secondary btn-sm" data-isoler="${type}">
            Voir uniquement ${icon("fleche", "h-3.5 w-3.5")}
          </button>
        </div>
        ${carrousel(items.map(carteOpportunite), {
          classe: "w-[290px] sm:w-[330px]",
          etiquette: lib.label,
        })}
      </section>`;
    })
    .join("");

  activerCarrousels(rayons);
}

/* ---------------------------------------------------------------- *
 * Démarrage
 * ---------------------------------------------------------------- */
Data.charger().then(() => {
  toutes = construireOpportunites();

  /* Puces par type */
  const parType = new Map();
  toutes.forEach((o) => parType.set(o.type, (parType.get(o.type) || 0) + 1));
  const types = [["tous", toutes.length], ...[...parType.entries()].sort((a, b) => b[1] - a[1])];
  $$("[data-types]").innerHTML = types
    .map(
      ([t, n]) => `
      <button class="chip" data-type="${t}" aria-pressed="${t === "tous"}">
        ${t === "tous" ? "" : `<span class="h-2 w-2 rounded-full" style="background:${ton(t).hex}"></span>`}
        ${t === "tous" ? "Toutes" : esc(Data.libBesoin(t).court)}
        <span class="text-[11px] opacity-70">${n}</span>
      </button>`,
    )
    .join("");

  /* Listes déroulantes */
  $$("#secteur").innerHTML =
    `<option value="">Tous les secteurs</option>` +
    Data.secteurs().map(([s, n]) => `<option value="${esc(s)}">${esc(s)} (${n})</option>`).join("");
  $$("#commune").innerHTML =
    `<option value="">Toutes les communes</option>` +
    Data.communes()
      .filter(([c]) => c !== "Non précisée")
      .map(([c, n]) => `<option value="${esc(c)}">${esc(c)} (${n})</option>`)
      .join("");

  /* Formulaire de publication */
  const optionsSecteurs = Data.secteurs().map(([s]) => `<option value="${esc(s)}">${esc(s)}</option>`).join("");
  $$("#o-secteur").innerHTML = optionsSecteurs;

  majBoutonsVue();
  rendre();

  const maj = $$("[data-maj]");
  if (maj)
    maj.textContent =
      "Mis à jour le " +
      new Date(Data.genereLe).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });

  /* --- Interactions --- */
  function majPuces() {
    document.querySelectorAll("[data-type]").forEach((x) =>
      x.setAttribute("aria-pressed", String(x.dataset.type === filtre.type)),
    );
  }

  function majBoutonsVue() {
    document.querySelectorAll("[data-vue]").forEach((b) => {
      const actif = b.dataset.vue === filtre.vue;
      b.setAttribute("aria-pressed", String(actif));
      b.classList.toggle("bg-white", actif);
      b.classList.toggle("text-ink-900", actif);
      b.classList.toggle("shadow-sm", actif);
      b.classList.toggle("text-ink-500", !actif);
    });
  }

  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-type]");
    if (t) {
      filtre.type = t.dataset.type;
      majPuces();
      return rendre();
    }
    const v = e.target.closest("[data-vue]");
    if (v) {
      filtre.vue = v.dataset.vue;
      majBoutonsVue();
      return rendre();
    }
    const iso = e.target.closest("[data-isoler]");
    if (iso) {
      filtre.type = iso.dataset.isoler;
      filtre.vue = "grille";
      majPuces();
      majBoutonsVue();
      rendre();
      return $$("[data-resume]").scrollIntoView({ behavior: "smooth", block: "start" });
    }
    if (e.target.closest("[data-reinit]")) {
      Object.assign(filtre, { type: "tous", q: "", secteur: "", commune: "" });
      $$("#q").value = "";
      $$("#secteur").value = "";
      $$("#commune").value = "";
      majPuces();
      return rendre();
    }
  });

  let t;
  $$("#q").addEventListener("input", (e) => {
    clearTimeout(t);
    t = setTimeout(() => {
      filtre.q = e.target.value;
      rendre();
    }, 160);
  });
  ["secteur", "commune", "tri"].forEach((cle) =>
    $$("#" + cle).addEventListener("change", (e) => {
      filtre[cle] = e.target.value;
      rendre();
    }),
  );

  /* ---- Formulaire de publication ---- */
  const form = $$("[data-form-opportunite]");
  const actions = form.querySelector("[data-actions]");
  const configure = CONFIG.whatsappCoordination || CONFIG.emailCoordination;

  actions.innerHTML = configure
    ? `${CONFIG.whatsappCoordination ? `<button type="submit" class="btn-whatsapp w-full" data-canal="whatsapp">${icon("partage", "h-4 w-4")} Envoyer via WhatsApp</button>` : ""}
       ${CONFIG.emailCoordination ? `<button type="submit" class="btn-secondary w-full" data-canal="email">Envoyer par e-mail</button>` : ""}`
    : `<button type="submit" class="btn-accent w-full py-3" data-canal="copie">${icon("check", "h-4 w-4")} Copier l’annonce</button>
       <p class="text-[12.5px] leading-relaxed text-ink-500">
         Le canal d’envoi automatique n’est pas encore configuré. Copiez l’annonce et
         transmettez-la au secrétariat MISI.</p>`;

  let canal = actions.querySelector("[data-canal]")?.dataset.canal || "copie";
  actions.addEventListener("click", (e) => {
    const b = e.target.closest("[data-canal]");
    if (b) canal = b.dataset.canal;
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const d = new FormData(form);
    const texte =
      `Nouvelle opportunité — Annuaire MISI\n\n` +
      `Intitulé : ${d.get("titre")}\n` +
      `Type : ${d.get("type")}\n` +
      `Secteur : ${d.get("secteur")}\n` +
      `Commune : ${d.get("zone") || "—"}\n` +
      `Proposée par : ${d.get("nom")}\n\n${d.get("description")}`;

    if (canal === "whatsapp")
      window.open(`https://wa.me/${CONFIG.whatsappCoordination}?text=${encodeURIComponent(texte)}`, "_blank", "noopener");
    else if (canal === "email")
      location.href =
        `mailto:${CONFIG.emailCoordination}?subject=` +
        encodeURIComponent("Nouvelle opportunité — " + d.get("titre")) +
        `&body=${encodeURIComponent(texte)}`;
    else navigator.clipboard?.writeText(texte);

    const ok = form.querySelector("[data-ok]");
    ok.textContent =
      canal === "copie"
        ? "Annonce copiée. Transmettez-la au secrétariat MISI pour publication."
        : "Annonce préparée dans votre application. Elle sera publiée après validation.";
    ok.className = "mt-3 rounded-lg bg-emerald-50 px-3.5 py-3 text-[13px] leading-relaxed text-emerald-800";
  });
});
