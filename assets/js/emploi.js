/* Espace emploi — CVthèque, offres, candidature spontanée, publication d'offre. */

const e$ = (s) => document.querySelector(s);
const critereEmploi = { q: "", secteur: "", metier: "", commune: "", niveaux: new Set() };

/* ---------------------------------------------------------------- *
 * Offres publiées (public/data/offres.json)
 * ---------------------------------------------------------------- */
const CONTRATS = {
  CDI: "emerald",
  CDD: "brand",
  Stage: "orange",
  Alternance: "orange",
  "Mission / freelance": "brand",
  "Temps partiel": "neutral",
  Bénévolat: "neutral",
};

function carteOffre(o) {
  const ton = CONTRATS[o.contrat] || "neutral";
  const jours = o.publieeLe
    ? Math.round((Date.now() - new Date(o.publieeLe)) / 86400000)
    : null;

  return `
  <article class="card card-hover flex h-full flex-col p-5">
    <div class="flex flex-wrap items-center gap-1.5">
      <span class="badge-${ton}">${esc(o.contrat || "Poste")}</span>
      ${o.secteur ? `<span class="badge-neutral">${esc(o.secteur)}</span>` : ""}
    </div>
    <h3 class="mt-3.5 font-display text-[17px] leading-snug font-bold text-ink-900">${esc(o.titre)}</h3>
    ${o.entreprise ? `<p class="mt-1 text-[13.5px] font-medium text-ink-600">${esc(o.entreprise)}</p>` : ""}
    <p class="mt-2.5 line-clamp-4 text-[13.5px] leading-relaxed text-ink-500">${esc(o.description || "")}</p>

    <div class="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-[12.5px] text-ink-500">
      ${o.lieu ? `<span class="flex items-center gap-1.5">${icon("lieu", "h-3.5 w-3.5 text-ink-400")}${esc(o.lieu)}</span>` : ""}
      ${o.experience ? `<span class="flex items-center gap-1.5">${icon("etincelle", "h-3.5 w-3.5 text-ink-400")}${esc(o.experience)}</span>` : ""}
    </div>

    <div class="mt-auto flex items-center gap-2 border-t border-ink-100 pt-4 mt-5">
      <span class="flex-1 text-[12px] text-ink-400">
        ${jours === null ? "" : jours <= 0 ? "Publiée aujourd’hui" : `Publiée il y a ${jours} j`}
      </span>
      <button class="btn-primary btn-sm" data-postuler="${esc(o.id || o.titre)}">Postuler</button>
    </div>
  </article>`;
}

async function chargerOffres() {
  let offres = [];
  try {
    const r = await fetch("data/offres.json", { cache: "no-cache" });
    if (r.ok) offres = (await r.json()).offres || [];
  } catch {
    /* fichier absent : la section reste sur son état vide */
  }

  // On masque les offres expirées.
  const aujourdhui = new Date().toISOString().slice(0, 10);
  offres = offres.filter((o) => !o.expireLe || o.expireLe >= aujourdhui);
  offres.sort((a, b) => String(b.publieeLe || "").localeCompare(String(a.publieeLe || "")));

  e$("[data-offres]").innerHTML = offres.map(carteOffre).join("");
  e$("[data-offres-vide]").classList.toggle("hidden", offres.length > 0);
}

/* ---------------------------------------------------------------- *
 * CVthèque
 * ---------------------------------------------------------------- */
function candidats() {
  return Data.membres.filter((m) => m.besoins.includes("emploi"));
}

function carteCandidat(m) {
  const c = teinte(m.nom);
  const metier = m.metiers[0] || m.metier || m.secteur;

  return `
  <article class="card card-hover flex h-full flex-col p-5">
    <button class="flex items-start gap-3.5 text-left" data-profil="${m.id}">
      <span class="avatar h-12 w-12 text-[15px]" style="background:${c.bg};color:${c.tx}">${esc(m.initiales)}</span>
      <span class="min-w-0 flex-1">
        <span class="block truncate font-display text-[15.5px] font-semibold text-ink-900">${esc(m.nom)}</span>
        <span class="mt-0.5 block truncate text-[13px] text-ink-500">${esc(metier)}</span>
      </span>
    </button>

    <div class="mt-4 flex flex-wrap gap-1.5">
      <span class="badge-brand">${icon(Data.picto(m.secteur), "h-3.5 w-3.5")}${esc(m.secteur)}</span>
      <span class="badge-neutral">${esc(m.experience)}</span>
    </div>

    ${
      m.metiers.length
        ? `<div class="mt-2.5 flex flex-wrap gap-1.5">
             ${m.metiers.slice(0, 3).map((x) => `<span class="badge-orange">${esc(x)}</span>`).join("")}
           </div>`
        : ""
    }

    <div class="mt-3.5 flex items-center gap-1.5 text-[12.5px] text-ink-500">
      ${icon("lieu", "h-3.5 w-3.5 shrink-0 text-ink-400")}<span class="truncate">${esc(m.zone)}</span>
    </div>

    <div class="mt-4 border-t border-ink-100 pt-3.5">
      <p class="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-400">Ouvert à</p>
      <div class="flex flex-wrap gap-1.5">
        ${m.besoins
          .filter((b) => b !== "emploi")
          .slice(0, 3)
          .map((b) => `<span class="badge-neutral">${esc(Data.libBesoin(b).court)}</span>`)
          .join("") || '<span class="badge-neutral">Emploi</span>'}
      </div>
    </div>

    <div class="mt-auto flex gap-2 pt-4">
      <button class="btn-primary btn-sm flex-1" data-relation="${m.id}">Contacter</button>
      <button class="btn-secondary btn-sm" data-profil="${m.id}">Profil</button>
      <button class="btn-secondary btn-sm" data-partage="${m.id}" aria-label="Partager sur WhatsApp">
        ${icon("partage", "h-4 w-4")}
      </button>
    </div>
  </article>`;
}

function rendreCandidats() {
  const q = sansAccent(critereEmploi.q);
  const liste = candidats().filter((m) => {
    if (critereEmploi.secteur && !m.secteurs.includes(critereEmploi.secteur)) return false;
    if (critereEmploi.metier && !m.metiers.includes(critereEmploi.metier)) return false;
    if (critereEmploi.commune && m.commune !== critereEmploi.commune) return false;
    if (critereEmploi.niveaux.size && !critereEmploi.niveaux.has(m.niveau)) return false;
    if (q) {
      const idx = sansAccent(
        [m.nom, m.metier, ...m.metiers, ...m.secteurs, m.commune, m.quartier, m.experience].join(" "),
      );
      if (!idx.includes(q)) return false;
    }
    return true;
  });

  liste.sort((a, b) => b.rang - a.rang || a.nom.localeCompare(b.nom, "fr"));

  const total = candidats().length;
  e$("[data-resume]").innerHTML =
    liste.length === total
      ? `<strong class="font-semibold text-ink-900">${total}</strong> candidat${total > 1 ? "s" : ""} disponible${total > 1 ? "s" : ""}`
      : `<strong class="font-semibold text-ink-900">${liste.length}</strong> candidat${liste.length > 1 ? "s" : ""} sur ${total}`;

  e$("[data-candidats]").innerHTML = liste.map(carteCandidat).join("");
  e$("[data-candidats-vide]").classList.toggle("hidden", liste.length > 0);
}

/* ---------------------------------------------------------------- *
 * Envoi des formulaires (même chaîne que l'inscription)
 * ---------------------------------------------------------------- */
function brancherFormulaire(form, zoneActions, zoneOk, sujet, resume) {
  const actions = form.querySelector(zoneActions);
  const ok = form.querySelector(zoneOk);

  actions.innerHTML = `<button type="submit" class="btn-accent w-full py-3">${sujet.bouton}</button>`;

  function replier(texte) {
    const boutons = [];
    if (CONFIG.whatsappCoordination)
      boutons.push(`<a class="btn-whatsapp w-full" target="_blank" rel="noopener"
          href="https://wa.me/${CONFIG.whatsappCoordination}?text=${encodeURIComponent(texte)}">
          ${icon("partage", "h-4 w-4")} Envoyer via WhatsApp</a>`);
    if (CONFIG.emailCoordination)
      boutons.push(`<a class="btn-secondary w-full"
          href="mailto:${CONFIG.emailCoordination}?subject=${encodeURIComponent(sujet.objet)}&body=${encodeURIComponent(texte)}">
          Envoyer par e-mail</a>`);
    boutons.push(`<button type="button" class="btn-secondary w-full" data-copier>Copier le récapitulatif</button>`);
    actions.innerHTML = boutons.join("");
    actions.querySelector("[data-copier]").addEventListener("click", (ev) => {
      navigator.clipboard?.writeText(texte);
      ev.target.textContent = "Copié ✓";
    });
    ok.className = "mt-3 rounded-lg bg-orange-50 px-3.5 py-3 text-[13px] leading-relaxed text-orange-700";
    ok.textContent =
      "L’enregistrement automatique n’est pas disponible sur cet hébergement. Transmettez le récapitulatif au secrétariat MISI.";
  }

  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const d = new FormData(form);
    const bouton = form.querySelector('button[type="submit"]');
    if (bouton) {
      bouton.disabled = true;
      bouton.textContent = "Envoi en cours…";
    }

    try {
      const corps = new URLSearchParams(d).toString();
      const entete = { "Content-Type": "application/x-www-form-urlencoded" };
      let rep = await fetch("/api/inscription", { method: "POST", headers: entete, body: corps }).catch(() => null);
      if (!rep || !rep.ok) rep = await fetch("/", { method: "POST", headers: entete, body: corps }).catch(() => null);
      if (!rep || !rep.ok) throw new Error("aucun canal");

      form.reset();
      actions.innerHTML = `<a class="btn-secondary w-full" href="#candidats">Revenir aux candidats</a>`;
      ok.className = "mt-3 rounded-lg bg-emerald-50 px-3.5 py-3 text-[13px] leading-relaxed text-emerald-800";
      ok.textContent = sujet.confirmation;
      ok.scrollIntoView({ behavior: "smooth", block: "center" });
    } catch {
      replier(resume(d));
      if (bouton) {
        bouton.disabled = false;
        bouton.textContent = sujet.bouton;
      }
    }
    ok.classList.remove("hidden");
  });
}

/* ---------------------------------------------------------------- *
 * Démarrage
 * ---------------------------------------------------------------- */
Data.charger().then(() => {
  const dispo = candidats();
  e$("[data-nb-candidats]").textContent = dispo.length;

  /* Listes déroulantes — restreintes aux candidats réellement présents */
  const compter = (extraire) => {
    const c = new Map();
    dispo.forEach((m) => [].concat(extraire(m)).filter(Boolean).forEach((v) => c.set(v, (c.get(v) || 0) + 1)));
    return [...c.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "fr"));
  };

  const remplir = (sel, defaut, entrees) =>
    (e$(sel).innerHTML =
      `<option value="">${defaut}</option>` +
      entrees.map(([v, n]) => `<option value="${esc(v)}">${esc(v)} (${n})</option>`).join(""));

  remplir("#secteur", "Tous les secteurs", compter((m) => m.secteurs));
  remplir("#metier", "Tous les métiers", compter((m) => m.metiers));
  remplir(
    "#commune",
    "Toutes les communes",
    compter((m) => m.commune).filter(([v]) => v !== "Non précisée"),
  );

  /* Puces de niveau */
  e$("[data-niveaux]").innerHTML = Data.ref.niveaux
    .map((n) => [n, dispo.filter((m) => m.niveau === n.id).length])
    .filter(([, k]) => k)
    .map(
      ([n, k]) =>
        `<button class="chip" data-niveau="${n.id}" aria-pressed="false">${esc(n.label)}
           <span class="text-[11px] opacity-70">${k}</span></button>`,
    )
    .join("");

  /* Formulaires : mêmes référentiels que l'annuaire */
  const optSecteurs = Data.secteurs().map(([s]) => `<option value="${esc(s)}">${esc(s)}</option>`).join("");
  const optNiveaux = Data.ref.niveaux.map((n) => `<option>${esc(n.label)}</option>`).join("");
  e$("#c-secteur").innerHTML = optSecteurs;
  e$("#o-secteur").innerHTML = optSecteurs;
  e$("#c-exp").innerHTML = optNiveaux;
  e$("#o-exp").innerHTML = optNiveaux;
  e$("#o-metier").innerHTML =
    `<option value="">— Indifférent —</option>` +
    Data.metiersParSecteur()
      .map(
        ([secteur, liste]) =>
          `<optgroup label="${esc(secteur)}">` +
          liste.map(([m]) => `<option value="${esc(m)}">${esc(m)}</option>`).join("") +
          `</optgroup>`,
      )
      .join("");

  chargerOffres();
  rendreCandidats();

  const maj = e$("[data-maj]");
  if (maj)
    maj.textContent =
      "Mis à jour le " +
      new Date(Data.genereLe).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });

  /* Interactions de la CVthèque */
  let t;
  e$("#q").addEventListener("input", (ev) => {
    clearTimeout(t);
    t = setTimeout(() => {
      critereEmploi.q = ev.target.value;
      rendreCandidats();
    }, 160);
  });
  ["#secteur", "#metier", "#commune"].forEach((sel) =>
    e$(sel).addEventListener("change", (ev) => {
      critereEmploi[sel.slice(1)] = ev.target.value;
      rendreCandidats();
    }),
  );
  e$("[data-niveaux]").addEventListener("click", (ev) => {
    const b = ev.target.closest("[data-niveau]");
    if (!b) return;
    const actif = b.getAttribute("aria-pressed") === "true";
    b.setAttribute("aria-pressed", String(!actif));
    actif ? critereEmploi.niveaux.delete(b.dataset.niveau) : critereEmploi.niveaux.add(b.dataset.niveau);
    rendreCandidats();
  });

  /* « Postuler » sur une offre : préremplit la candidature spontanée */
  document.addEventListener("click", (ev) => {
    const b = ev.target.closest("[data-postuler]");
    if (!b) return;
    const titre = b.closest("article")?.querySelector("h3")?.textContent.trim() || "";
    const champ = e$("#c-poste");
    champ.value = titre;
    e$("[data-form-candidature]").scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => e$("#c-nom").focus(), 400);
  });

  /* Envoi des deux formulaires */
  brancherFormulaire(
    e$("[data-form-candidature]"),
    "[data-actions]",
    "[data-ok]",
    {
      bouton: "Envoyer ma candidature",
      objet: "Candidature spontanée — Annuaire MISI",
      confirmation:
        "Candidature transmise. Le secrétariat MISI vous recontacte dès qu’un besoin correspond à votre profil.",
    },
    (d) =>
      `Candidature spontanée — Annuaire MISI\n\n` +
      `Nom : ${d.get("nom")}\nE-mail : ${d.get("email")}\nTéléphone : ${d.get("telephone")}\n` +
      `Poste recherché : ${d.get("poste") || "—"}\nSecteur : ${d.get("secteur")}\n` +
      `Expérience : ${d.get("experience")}\nDisponibilité : ${d.get("disponibilite")}\n` +
      `CV : ${d.get("lien_cv") || "—"}\n\n${d.get("message")}`,
  );

  brancherFormulaire(
    e$("[data-form-offre]"),
    "[data-actions-offre]",
    "[data-ok-offre]",
    {
      bouton: "Soumettre l’offre",
      objet: "Nouvelle offre d’emploi — Annuaire MISI",
      confirmation: "Offre transmise. Le secrétariat MISI la valide puis la publie sur cette page.",
    },
    (d) =>
      `Nouvelle offre d’emploi — Annuaire MISI\n\n` +
      `Poste : ${d.get("titre")}\nEntreprise : ${d.get("entreprise") || "—"}\n` +
      `Contrat : ${d.get("contrat")}\nSecteur : ${d.get("secteur")}\nMétier : ${d.get("metier") || "—"}\n` +
      `Lieu : ${d.get("lieu") || "—"}\nExpérience : ${d.get("experience")}\n` +
      `Proposée par : ${d.get("contact")}\n\n${d.get("description")}`,
  );
});
