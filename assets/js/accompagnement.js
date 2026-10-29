/* Accompagnement de projet — types d'aide, accompagnateurs réels, demande de rendez-vous. */

const a$ = (s) => document.querySelector(s);

/**
 * Domaines d'aide, et les secteurs de l'annuaire où chercher la compétence.
 * Le compteur affiché est réel : il vaut mieux annoncer « 1 juriste » que
 * laisser croire à un vivier qui n'existe pas.
 */
const AIDES = [
  {
    id: "juridique",
    label: "Aide juridique",
    desc: "Statuts, contrats, propriété intellectuelle, litiges",
    secteurs: ["Droit"],
    picto: "droit",
  },
  {
    id: "financement",
    label: "Financement",
    desc: "Recherche de fonds, prêt, investisseurs, subventions",
    secteurs: ["Banque / Finance"],
    picto: "banque",
  },
  {
    id: "strategie",
    label: "Business plan & stratégie",
    desc: "Modèle économique, étude de marché, plan d’action",
    secteurs: ["Entrepreneuriat"],
    picto: "fusee",
  },
  {
    id: "gestion",
    label: "Comptabilité & gestion",
    desc: "Tenue des comptes, fiscalité, pilotage",
    secteurs: ["Banque / Finance"],
    picto: "banque",
  },
  {
    id: "technique",
    label: "Technique & digital",
    desc: "Site, application, outils, données, sécurité",
    secteurs: ["Technologie", "Ingénierie"],
    picto: "tech",
  },
  {
    id: "communication",
    label: "Communication & marketing",
    desc: "Identité, réseaux sociaux, campagnes, contenus",
    secteurs: ["Communication", "Média"],
    picto: "com",
  },
  {
    id: "equipe",
    label: "Recrutement & équipe",
    desc: "Constituer l’équipe, définir les postes",
    secteurs: ["Autre", "Education"],
    picto: "personnes",
  },
  {
    id: "terrain",
    label: "Mise en œuvre terrain",
    desc: "Travaux, production, logistique, distribution",
    secteurs: ["Bâtiment", "Commerce", "Agriculture"],
    picto: "batiment",
  },
];

const FORMATS = [
  "Appel téléphonique",
  "WhatsApp (message ou appel)",
  "Visioconférence",
  "En présentiel, après le culte",
];
const JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
const CRENEAUX = ["Matin (8h – 12h)", "Après-midi (12h – 17h)", "Soirée (17h – 20h)"];

/** Membres susceptibles d'accompagner sur les domaines cochés. */
function accompagnateurs(idsAides, limite = 4) {
  const secteurs = new Set(AIDES.filter((a) => idsAides.includes(a.id)).flatMap((a) => a.secteurs));
  if (!secteurs.size) return [];
  return Data.membres
    .filter((m) => m.secteurs.some((s) => secteurs.has(s)))
    // Les plus expérimentés d'abord : c'est eux qui peuvent conseiller.
    .sort((a, b) => b.rang - a.rang || a.nom.localeCompare(b.nom, "fr"))
    .slice(0, limite);
}

function compterAide(aide) {
  return Data.membres.filter((m) => m.secteurs.some((s) => aide.secteurs.includes(s))).length;
}

/* ---------------------------------------------------------------- *
 * Rendu
 * ---------------------------------------------------------------- */
function rendreCartesAides() {
  a$("[data-aides]").innerHTML = AIDES.map((aide) => {
    const n = compterAide(aide);
    const c = teinte(aide.label);
    return `
    <button type="button" class="card card-hover flex h-full flex-col p-5 text-left"
            data-choisir-aide="${aide.id}">
      <span class="avatar h-11 w-11" style="background:${c.bg};color:${c.tx}">
        ${icon(aide.picto, "h-5 w-5")}
      </span>
      <span class="mt-4 block font-display text-[15.5px] font-bold text-ink-900">${esc(aide.label)}</span>
      <span class="mt-1.5 block text-[13px] leading-relaxed text-ink-500">${esc(aide.desc)}</span>
      <span class="mt-4 flex items-center gap-1.5 pt-0.5 text-[12.5px] font-semibold ${n ? "text-brand-600" : "text-ink-400"}">
        ${n ? `${n} membre${n > 1 ? "s" : ""} dans l’annuaire` : "Aucun membre pour l’instant"}
      </span>
    </button>`;
  }).join("");
}

function rendreAccompagnateurs() {
  const coches = [...document.querySelectorAll('[data-champ-aides] input:checked')].map((i) => i.value);
  const zone = a$("[data-accompagnateurs]");
  const liste = accompagnateurs(coches);

  if (!liste.length) {
    zone.innerHTML = "";
    return;
  }

  zone.innerHTML = `
    <div class="rounded-xl2 border border-ink-200 bg-white p-5">
      <p class="flex items-center gap-2 text-[13px] font-semibold text-ink-800">
        ${icon("etincelle", "h-4 w-4 text-orange-500")} Qui pourrait vous accompagner
      </p>
      <p class="mt-1.5 text-[12px] leading-relaxed text-ink-500">
        Membres de l’annuaire dans les domaines cochés, les plus expérimentés d’abord.
      </p>
      <div class="mt-3 space-y-2">
        ${liste
          .map((m) => {
            const c = teinte(m.nom);
            return `
            <button type="button" class="flex w-full items-center gap-2.5 rounded-xl border border-ink-200 p-2.5 text-left
                           transition hover:border-brand-300 hover:bg-brand-50/50" data-profil="${m.id}">
              <span class="avatar h-9 w-9 text-[12px]" style="background:${c.bg};color:${c.tx}">${esc(m.initiales)}</span>
              <span class="min-w-0 flex-1">
                <span class="block truncate text-[13.5px] font-semibold text-ink-900">${esc(m.nom)}</span>
                <span class="block truncate text-[12px] text-ink-500">
                  ${esc(m.metiers[0] || m.secteur)} · ${esc(m.experience)}
                </span>
              </span>
            </button>`;
          })
          .join("")}
      </div>
      <p class="mt-3 text-[12px] leading-relaxed text-ink-400">
        Indicatif : c’est le secrétariat MISI qui sollicite ces personnes, et elles restent
        libres d’accepter.
      </p>
    </div>`;
}

/* ---------------------------------------------------------------- *
 * Démarrage
 * ---------------------------------------------------------------- */
Data.charger().then(() => {
  a$("[data-nb-porteurs]").textContent = Data.membres.filter((m) => m.besoins.includes("projet")).length;

  rendreCartesAides();

  /* Champs à cocher */
  const caseHtml = (nom, valeur, libelle, extra = "") => `
    <label class="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 hover:bg-ink-50">
      <input type="checkbox" name="${nom}" value="${esc(valeur)}" ${extra}
             class="h-4 w-4 shrink-0 rounded border-ink-300 text-brand-600 focus:ring-brand-600" />
      <span class="text-[13.5px] text-ink-700">${esc(libelle)}</span>
    </label>`;

  a$("[data-champ-aides]").innerHTML = AIDES.map((x) =>
    caseHtml("aides", x.id, `${x.label}${compterAide(x) ? "" : " (aucun membre)"}`),
  ).join("");

  a$("[data-champ-formats]").innerHTML = FORMATS.map((f) => caseHtml("formats", f, f)).join("");

  const puceHtml = (nom, v) => `
    <label class="chip cursor-pointer">
      <input type="checkbox" name="${nom}" value="${esc(v)}" class="sr-only" />
      <span>${esc(v)}</span>
    </label>`;
  a$("[data-champ-jours]").innerHTML = JOURS.map((j) => puceHtml("jours", j)).join("");
  a$("[data-champ-creneaux]").innerHTML = CRENEAUX.map((c) => puceHtml("creneaux", c)).join("");

  /* Les puces jour/créneau reflètent leur case cachée. */
  document.querySelectorAll("[data-champ-jours] input, [data-champ-creneaux] input").forEach((i) => {
    i.addEventListener("change", () => i.closest("label").setAttribute("aria-pressed", String(i.checked)));
  });

  /* Listes déroulantes */
  a$("#p-secteur").innerHTML =
    `<option value="">— Choisir —</option>` +
    Data.secteurs().map(([s]) => `<option value="${esc(s)}">${esc(s)}</option>`).join("");
  a$("#p-commune").innerHTML =
    `<option value="">— Choisir —</option>` +
    Data.communes().filter(([c]) => c !== "Non précisée").map(([c]) => `<option value="${esc(c)}">${esc(c)}</option>`).join("");

  const maj = a$("[data-maj]");
  if (maj)
    maj.textContent =
      "Mis à jour le " +
      new Date(Data.genereLe).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });

  /* Cocher un domaine depuis les cartes du haut */
  a$("[data-aides]").addEventListener("click", (e) => {
    const b = e.target.closest("[data-choisir-aide]");
    if (!b) return;
    const c = document.querySelector(`[data-champ-aides] input[value="${b.dataset.choisirAide}"]`);
    if (c) {
      c.checked = true;
      c.dispatchEvent(new Event("change", { bubbles: true }));
    }
    a$("#demande").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  a$("[data-champ-aides]").addEventListener("change", rendreAccompagnateurs);

  /* --- Envoi --- */
  const form = a$("[data-form-projet]");
  const actions = form.querySelector("[data-actions]");
  const ok = form.querySelector("[data-ok]");

  actions.innerHTML = `<button type="submit" class="btn-accent w-full py-3">Envoyer ma demande</button>`;

  function recapitulatif(d) {
    const multi = (n) => d.getAll(n).join(", ") || "—";
    const libAides = d
      .getAll("aides")
      .map((id) => AIDES.find((a) => a.id === id)?.label || id)
      .join(", ");
    return (
      `Demande d’accompagnement de projet — Annuaire MISI\n\n` +
      `Projet : ${d.get("titre")}\n` +
      `Secteur : ${d.get("secteur") || "—"}\n` +
      `Stade : ${d.get("stade")}\n\n` +
      `${d.get("description")}\n\n` +
      `Principal blocage : ${d.get("blocage") || "—"}\n` +
      `Aides recherchées : ${libAides || "—"}\n\n` +
      `RENDEZ-VOUS\n` +
      `Format : ${multi("formats")}\n` +
      `Jours : ${multi("jours")}\n` +
      `Créneaux : ${multi("creneaux")}\n` +
      `Délai : ${d.get("delai")}\n\n` +
      `CONTACT\n` +
      `${d.get("prenom")} ${d.get("nom")}\n` +
      `${d.get("email")} · ${d.get("telephone")}\n` +
      `Commune : ${d.get("commune") || "—"}`
    );
  }

  function replier(texte) {
    const boutons = [];
    if (CONFIG.whatsappCoordination)
      boutons.push(`<a class="btn-whatsapp w-full" target="_blank" rel="noopener"
          href="https://wa.me/${CONFIG.whatsappCoordination}?text=${encodeURIComponent(texte)}">
          ${icon("partage", "h-4 w-4")} Envoyer via WhatsApp</a>`);
    if (CONFIG.emailCoordination)
      boutons.push(`<a class="btn-secondary w-full"
          href="mailto:${CONFIG.emailCoordination}?subject=${encodeURIComponent("Demande d’accompagnement — projet")}&body=${encodeURIComponent(texte)}">
          Envoyer par e-mail</a>`);
    boutons.push(`<button type="button" class="btn-secondary w-full" data-copier>Copier ma demande</button>`);
    actions.innerHTML = boutons.join("");
    actions.querySelector("[data-copier]").addEventListener("click", (ev) => {
      navigator.clipboard?.writeText(texte);
      ev.target.textContent = "Copié ✓";
    });
    ok.className = "mt-3 rounded-lg bg-orange-50 px-3.5 py-3 text-[13px] leading-relaxed text-orange-700";
    ok.textContent =
      "L’enregistrement automatique n’est pas disponible sur cet hébergement. Transmettez votre demande au secrétariat MISI par l’un des moyens ci-dessous.";
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const d = new FormData(form);
    const bouton = form.querySelector('button[type="submit"]');
    if (bouton) {
      bouton.disabled = true;
      bouton.textContent = "Envoi en cours…";
    }

    try {
      let enregistre = false;

      if (typeof FB !== "undefined" && firebaseActif()) {
        enregistre = await FB.enregistrerAccompagnement({
          titre: d.get("titre"),
          secteur: d.get("secteur"),
          stade: d.get("stade"),
          description: d.get("description"),
          blocage: d.get("blocage"),
          aides: d.getAll("aides"),
          formats: d.getAll("formats"),
          jours: d.getAll("jours"),
          creneaux: d.getAll("creneaux"),
          delai: d.get("delai"),
          prenom: d.get("prenom"),
          nom: d.get("nom"),
          email: d.get("email"),
          telephone: d.get("telephone"),
          commune: d.get("commune"),
        });
      }

      if (!enregistre) {
        const corps = new URLSearchParams(d).toString();
        const entete = { "Content-Type": "application/x-www-form-urlencoded" };
        let rep = await fetch("/api/inscription", { method: "POST", headers: entete, body: corps }).catch(() => null);
        if (!rep || !rep.ok) rep = await fetch("/", { method: "POST", headers: entete, body: corps }).catch(() => null);
        enregistre = Boolean(rep && rep.ok);
      }

      if (!enregistre) throw new Error("aucun canal");

      form.reset();
      rendreAccompagnateurs();
      actions.innerHTML = `<a class="btn-secondary w-full" href="annuaire.html">Parcourir l’annuaire en attendant</a>`;
      ok.className = "mt-3 rounded-lg bg-emerald-50 px-3.5 py-3 text-[13px] leading-relaxed text-emerald-800";
      ok.textContent =
        "Demande transmise. Le secrétariat MISI revient vers vous pour caler le rendez-vous sur les créneaux indiqués.";
      ok.scrollIntoView({ behavior: "smooth", block: "center" });
    } catch {
      replier(recapitulatif(d));
      if (bouton) {
        bouton.disabled = false;
        bouton.textContent = "Envoyer ma demande";
      }
    }
    ok.classList.remove("hidden");
  });
});
