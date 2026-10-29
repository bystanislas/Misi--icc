/* Page Rejoindre — formulaire d'inscription enregistré sur le site.
 *
 * L'envoi passe par Netlify Forms : la soumission est stockée côté Netlify
 * et notifiée par e-mail au secrétariat, sans serveur à maintenir.
 * Hors Netlify (aperçu local, autre hébergeur), le formulaire bascule
 * automatiquement sur l'envoi WhatsApp / e-mail / copie.
 */

const el = (s) => document.querySelector(s);

document.addEventListener("DOMContentLoaded", () => {
  const form = el("[data-form-inscription]");
  if (!form) return;

  /* --- Les métiers dépendent des secteurs cochés ---------------- */
  const aide = form.querySelector("[data-aide-metiers]");

  function majMetiers() {
    const coches = [...form.querySelectorAll('input[name="secteurs"]:checked')].map((c) => c.value);
    let visibles = 0;
    // Requête à chaque fois : les blocs peuvent être reconstruits (référentiels).
    form.querySelectorAll("[data-metiers-de]").forEach((b) => {
      const actif = coches.includes(b.dataset.metiersDe);
      b.classList.toggle("hidden", !actif);
      if (actif) visibles++;
      // Un métier décoché avec son secteur ne doit pas rester sélectionné.
      if (!actif) b.querySelectorAll("input:checked").forEach((i) => (i.checked = false));
    });
    aide.classList.toggle("hidden", visibles > 0);
  }

  form.addEventListener("change", (e) => {
    if (e.target.name === "secteurs") majMetiers();
  });
  majMetiers();

  /* --- Listes issues des référentiels de l'administration ------- */
  // Le HTML embarque les listes du fichier statique. Si l'administration
  // les a modifiées (config/referentiels), on les reconstruit à l'identique
  // en conservant ce qui a déjà été coché.
  const zone = (nom) => form.querySelector(`input[name="${nom}"]`)?.closest(".grid");
  const zones = {
    secteurs: form.querySelector("[data-champ-secteurs]"),
    metiers: form.querySelector("[data-champ-metiers]"),
    besoins: zone("besoins"),
    interets: zone("interets"),
    age: zone("age"),
  };

  const caseHtml = (type, nom, valeur, libelle) => `
            <label class="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 hover:bg-ink-50">
              <input type="${type}" name="${nom}" value="${esc(valeur)}"
                     class="h-4 w-4 shrink-0 ${type === "checkbox" ? "rounded " : ""}border-ink-300 text-brand-600 focus:ring-brand-600" />
              <span class="text-[13.5px] text-ink-700">${esc(libelle)}</span>
            </label>`;
  const options = (select, valeurs) => {
    const actuelle = select.value;
    select.innerHTML = valeurs
      .map((v) => `<option${v === actuelle ? " selected" : ""}>${esc(v)}</option>`)
      .join("");
  };

  function reconstruire(ref) {
    const coches = new Set([...form.querySelectorAll("input:checked")].map((i) => i.name + "\u0000" + i.value));

    zones.secteurs.innerHTML = Object.keys(ref.secteurs).map((s) => caseHtml("checkbox", "secteurs", s, s)).join("");
    zones.metiers.innerHTML = Object.entries(ref.metiers)
      .map(
        ([secteur, liste]) => `
          <div class="hidden" data-metiers-de="${esc(secteur)}">
            <p class="mt-3 mb-1 text-[12px] font-bold uppercase tracking-wider text-ink-400">${esc(secteur)}</p>
            <div class="grid gap-1 sm:grid-cols-2">${liste.map(([m]) => caseHtml("checkbox", "metiers", m, m)).join("")}
            </div>
          </div>`,
      )
      .join("");
    // « Autre besoin » sert au classement interne : absent du formulaire d'origine.
    zones.besoins.innerHTML = Object.values(ref.besoins)
      .filter((b) => b.id !== "autre")
      .map((b) => caseHtml("checkbox", "besoins", b.court, b.label))
      .join("");
    zones.interets.innerHTML = ref.interets.map((x) => caseHtml("checkbox", "interets", x, x)).join("");
    zones.age.innerHTML = ref.ages.map((a) => caseHtml("radio", "age", a.id, a.label)).join("");
    options(el("#i-exp"), ref.niveaux.map((n) => n.label));
    if (ref.familles?.length) options(el("#i-famille"), ref.familles);

    form.querySelectorAll("input[name]").forEach((i) => {
      if (coches.has(i.name + "\u0000" + i.value)) i.checked = true;
    });
    majMetiers();
  }

  if (typeof Data !== "undefined") {
    const appliquer = () => Data.refSource === "firestore" && reconstruire(Data.ref);
    Data.charger().then(appliquer).catch(() => {});
    addEventListener("misi:membres", appliquer);
  }

  /* --- Les communes dépendent de la ville ----------------------- */
  const selVille = el("#i-ville");
  const selCommune = el("#i-commune");
  const optionsCommunes = [...selCommune.options];

  function majCommunes() {
    const ville = selVille.value;
    selCommune.innerHTML = "";
    optionsCommunes
      .filter((o) => !o.value || !ville || o.dataset.ville === ville)
      .forEach((o) => selCommune.appendChild(o.cloneNode(true)));
  }
  selVille.addEventListener("change", majCommunes);
  majCommunes();

  /* --- Progression visuelle des étapes -------------------------- */
  const etapes = [...form.querySelectorAll("ol li")];
  const titres = [...form.querySelectorAll("h2")];
  const observateur = new IntersectionObserver(
    (entrees) => {
      entrees.forEach((e) => {
        if (!e.isIntersecting) return;
        const i = titres.indexOf(e.target);
        etapes.forEach((li, k) => li.classList.toggle("text-brand-600", k === i));
      });
    },
    { rootMargin: "-30% 0px -60% 0px" },
  );
  titres.forEach((t) => observateur.observe(t));

  /* --- Envoi ---------------------------------------------------- */
  const zoneOk = form.querySelector("[data-ok]");
  const actions = form.querySelector("[data-actions]");

  function resume(d) {
    const multi = (n) => d.getAll(n).join(", ") || "—";
    return (
      `Inscription à l’annuaire MISI — ICC Riviera 2\n\n` +
      `Nom et prénoms : ${d.get("nom")}\n` +
      `E-mail : ${d.get("email")}\n` +
      `Téléphone : ${d.get("telephone")}\n` +
      `Ville : ${d.get("ville") || "—"}\n` +
      `Commune : ${d.get("commune") || "—"}\n` +
      `Quartier : ${d.get("quartier") || "—"}\n` +
      `Tranche d’âge : ${d.get("age") || "—"}\n\n` +
      `Département / ministère : ${d.get("departement") || "—"}\n` +
      `Famille d’église : ${d.get("famille")}\n\n` +
      `Secteurs : ${multi("secteurs")}\n` +
      `Métiers : ${multi("metiers")}\n` +
      `Autre métier : ${d.get("autre_metier") || "—"}\n` +
      `Niveau d’expérience : ${d.get("experience")}\n` +
      `Structure : ${d.get("entreprise") || "—"}\n\n` +
      `Objectifs de connexion : ${multi("besoins")}\n` +
      `Ce que je peux apporter : ${d.get("apport") || "—"}\n` +
      `Centres d’intérêt : ${multi("interets")}\n\n` +
      `Consentement à la publication : oui.`
    );
  }

  function replier(texte) {
    // Netlify indisponible : on propose les canaux manuels.
    const boutons = [];
    if (CONFIG.whatsappCoordination)
      boutons.push(
        `<a class="btn-whatsapp w-full" target="_blank" rel="noopener"
            href="https://wa.me/${CONFIG.whatsappCoordination}?text=${encodeURIComponent(texte)}">
           Envoyer via WhatsApp</a>`,
      );
    if (CONFIG.emailCoordination)
      boutons.push(
        `<a class="btn-secondary w-full"
            href="mailto:${CONFIG.emailCoordination}?subject=${encodeURIComponent("Inscription annuaire MISI")}&body=${encodeURIComponent(texte)}">
           Envoyer par e-mail</a>`,
      );
    boutons.push(`<button type="button" class="btn-secondary w-full" data-copier>Copier mes réponses</button>`);

    actions.innerHTML = boutons.join("");
    actions.querySelector("[data-copier]").addEventListener("click", (e) => {
      navigator.clipboard?.writeText(texte);
      e.target.textContent = "Copié ✓";
    });

    zoneOk.className =
      "mt-3 rounded-lg bg-orange-50 px-3.5 py-3 text-[13px] leading-relaxed text-orange-700";
    zoneOk.textContent =
      "L’enregistrement automatique n’est pas disponible sur cet hébergement. " +
      "Transmettez vos réponses au secrétariat MISI par l’un des moyens ci-dessous.";
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const bouton = form.querySelector('button[type="submit"]');
    const d = new FormData(form);

    if (bouton) {
      bouton.disabled = true;
      bouton.textContent = "Envoi en cours…";
    }

    try {
      let enregistre = false;

      // 1. Firestore — le stockage de référence dès qu'il est configuré.
      if (typeof FB !== "undefined" && firebaseActif()) {
        const objet = {};
        for (const [k, v] of d.entries()) {
          if (k === "bot-field" || k === "form-name") continue;
          if (objet[k] === undefined) objet[k] = v;
          else objet[k] = [].concat(objet[k], v); // cases à cocher multiples
        }
        enregistre = await FB.enregistrerInscription(objet);
      }

      // 2. Sinon : fonction Vercel (e-mail Resend), puis Netlify Forms.
      if (!enregistre) {
        const corps = new URLSearchParams(d).toString();
        const entete = { "Content-Type": "application/x-www-form-urlencoded" };
        let rep = await fetch("/api/inscription", { method: "POST", headers: entete, body: corps }).catch(() => null);
        if (!rep || !rep.ok) {
          rep = await fetch("/", { method: "POST", headers: entete, body: corps }).catch(() => null);
        }
        enregistre = Boolean(rep && rep.ok);
      }

      if (!enregistre) throw new Error("Aucun canal d’enregistrement disponible");

      form.reset();
      majMetiers();
      actions.innerHTML = `<a class="btn-secondary w-full" href="annuaire.html">Parcourir l’annuaire</a>`;
      zoneOk.className =
        "mt-3 rounded-lg bg-emerald-50 px-3.5 py-3 text-[13px] leading-relaxed text-emerald-800";
      zoneOk.textContent =
        "Inscription enregistrée. Le secrétariat MISI la valide, puis votre profil apparaît à la prochaine mise à jour de l’annuaire.";
      zoneOk.scrollIntoView({ behavior: "smooth", block: "center" });
    } catch {
      replier(resume(d));
      if (bouton) {
        bouton.disabled = false;
        bouton.textContent = "Envoyer mon inscription";
      }
    }
  });
});
