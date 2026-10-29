/* Page d'accueil — sections alimentées par les données de l'annuaire. */

Data.charger().then(() => {
  const membres = Data.membres;

  /* --- Chiffres clés ------------------------------------------- */
  const stats = [
    ["Membres référencés", membres.length],
    ["Secteurs d’activité", Data.secteurs().length],
    ["Métiers identifiés", Data.metiersUtilises().length],
    ["Communes couvertes", Data.communes().filter(([c]) => c !== "Non précisée").length],
  ];
  document.querySelector("[data-stats]").innerHTML = stats
    .map(
      ([lib, val]) => `
      <div class="px-2 py-3 text-center">
        <p class="font-display text-4xl font-extrabold text-brand-600">${val}</p>
        <p class="mt-1 text-[13px] font-medium text-ink-500">${lib}</p>
      </div>`,
    )
    .join("");

  /* --- Suggestions de recherche -------------------------------- */
  const suggestions = [
    ...Data.metiersUtilises().slice(0, 4).map(([m]) => m),
    ...Data.secteurs().slice(0, 3).map(([s]) => s),
    "Mentorat",
  ];
  document.querySelector("[data-suggestions]").innerHTML = suggestions
    .map((s) => `<a class="chip" href="annuaire.html?q=${encodeURIComponent(s)}">${esc(s)}</a>`)
    .join("");

  /* --- Secteurs (carrousel) ------------------------------------ */
  const cartesSecteurs = Data.secteurs().map(([s, n]) => {
    const c = teinte(s);
    return `
      <a href="annuaire.html?secteur=${encodeURIComponent(s)}" class="card card-hover flex h-full flex-col p-5">
        <span class="avatar h-12 w-12" style="background:${c.bg};color:${c.tx}">
          ${icon(Data.picto(s), "h-6 w-6")}
        </span>
        <span class="mt-4 block font-display text-[16px] font-bold text-ink-900">${esc(s)}</span>
        <span class="mt-0.5 block text-[13px] text-ink-500">${n} membre${n > 1 ? "s" : ""}</span>
        <span class="mt-4 flex items-center gap-1.5 text-[13px] font-semibold text-brand-600">
          Voir les profils ${icon("fleche", "h-4 w-4")}
        </span>
      </a>`;
  });
  document.querySelector("[data-secteurs]").innerHTML = carrousel(cartesSecteurs, {
    classe: "w-[210px]",
    etiquette: "Secteurs d’activité",
  });

  /* --- Métiers par secteur (carrousel) ------------------------- */
  const cartesMetiers = Data.metiersParSecteur()
    .map(([secteur, liste]) => {
      const c = teinte(secteur);
      const total = liste.reduce((s, [, n]) => s + n, 0);
      // Les métiers déjà représentés passent devant le reste du référentiel.
      const tries = [...liste].sort((a, b) => b[1] - a[1]);
      return {
        total,
        html: `
        <div class="card flex h-full flex-col p-5">
          <div class="flex items-center gap-3">
            <span class="avatar h-10 w-10" style="background:${c.bg};color:${c.tx}">
              ${icon(Data.picto(secteur), "h-5 w-5")}
            </span>
            <div class="min-w-0">
              <p class="truncate font-display text-[15px] font-bold text-ink-900">${esc(secteur)}</p>
              <p class="text-[12px] text-ink-500">${liste.length} métiers · ${total} profil${total > 1 ? "s" : ""}</p>
            </div>
          </div>
          <div class="mt-4 flex flex-wrap gap-1.5">
            ${tries
              .slice(0, 8)
              .map(
                ([m, n]) => `
              <a href="annuaire.html?secteur=${encodeURIComponent(secteur)}&metier=${encodeURIComponent(m)}"
                 class="${n ? "badge-brand" : "badge-neutral"} transition hover:ring-brand-300">
                ${esc(m)}${n ? ` <span class="opacity-60">${n}</span>` : ""}
              </a>`,
              )
              .join("")}
            ${tries.length > 8 ? `<span class="badge-neutral">+${tries.length - 8}</span>` : ""}
          </div>
          <a href="annuaire.html?secteur=${encodeURIComponent(secteur)}"
             class="mt-auto flex items-center gap-1.5 pt-4 text-[13px] font-semibold text-brand-600">
            Explorer ${icon("fleche", "h-4 w-4")}
          </a>
        </div>`,
      };
    })
    .sort((a, b) => b.total - a.total)
    .map((x) => x.html);

  document.querySelector("[data-metiers]").innerHTML = carrousel(cartesMetiers, {
    classe: "w-[300px] sm:w-[340px]",
    etiquette: "Métiers par secteur",
  });

  /* --- Réseau : besoins / apports ------------------------------ */
  const barre = (label, n, total, lien, ton) => `
    <a href="${lien}" class="group block rounded-lg px-3 py-2.5 transition hover:bg-white/10">
      <span class="flex items-baseline justify-between gap-3">
        <span class="text-[14px] font-medium text-white">${esc(label)}</span>
        <span class="text-[12.5px] font-semibold ${ton === "orange" ? "text-orange-300" : "text-brand-300"}">${n}</span>
      </span>
      <span class="mt-2 block h-1.5 overflow-hidden rounded-full bg-white/10">
        <span class="block h-full rounded-full ${ton === "orange" ? "bg-orange-500" : "bg-brand-500"}"
              style="width:${Math.round((n / total) * 100)}%"></span>
      </span>
    </a>`;

  const bes = Data.besoins();
  document.querySelector("[data-besoins]").innerHTML = bes
    .map(([id, n]) => barre(Data.libBesoin(id).label, n, bes[0][1], `annuaire.html?besoin=${id}`, "orange"))
    .join("");

  const app = Data.apports();
  document.querySelector("[data-apports]").innerHTML = app
    .map(([id, n]) => barre(Data.libApport(id).label, n, app[0][1], `annuaire.html?apport=${id}`, "brand"))
    .join("");

  /* --- Profils les plus expérimentés (carrousel automatique) --- */
  const vedettes = [...membres]
    .sort((a, b) => b.rang - a.rang || b.metiers.length - a.metiers.length || b.secteurs.length - a.secteurs.length)
    .slice(0, 12);
  document.querySelector("[data-profils]").innerHTML = carrousel(
    vedettes.map((m) => carteMembre(m)),
    { auto: true, classe: "w-[280px] sm:w-[310px]", etiquette: "Profils expérimentés" },
  );

  /* --- Aperçu des opportunités (carrousel) --------------------- */
  const cartesOpp = construireOpportunites(membres)
    .slice(0, 10)
    .map(
      (o) => `
      <article class="card flex h-full flex-col p-5">
        <div class="flex flex-wrap items-center gap-1.5">
          <span class="badge-orange">${esc(o.typeLabel)}</span>
          <span class="badge-neutral">${esc(o.membre.secteur)}</span>
        </div>
        <p class="mt-3 font-display text-[16px] leading-snug font-bold text-ink-900">${esc(o.titre)}</p>
        <p class="mt-2 text-[13.5px] leading-relaxed text-ink-500">${esc(o.resume)}</p>
        <div class="mt-auto flex items-center gap-2.5 pt-5">
          ${avatar(o.membre, "h-9 w-9 text-[12px]")}
          <span class="min-w-0 flex-1">
            <span class="block truncate text-[13.5px] font-semibold text-ink-800">${esc(o.membre.nom)}</span>
            <span class="block text-[12px] text-ink-500">${esc(o.membre.zone)}</span>
          </span>
          <button class="btn-secondary btn-sm" data-relation="${o.membre.id}">Répondre</button>
        </div>
      </article>`,
    );
  document.querySelector("[data-opportunites]").innerHTML = carrousel(cartesOpp, {
    classe: "w-[280px] sm:w-[320px]",
    etiquette: "Opportunités ouvertes",
  });

  activerCarrousels();

  /* --- Date de mise à jour ------------------------------------- */
  const maj = document.querySelector("[data-maj]");
  if (maj)
    maj.textContent =
      "Données mises à jour le " +
      new Date(Data.genereLe).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
});
