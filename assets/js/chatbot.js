/* ==================================================================
 * Apex IA — assistant de la plateforme MISI
 *
 * Deux étages :
 *  1. un moteur LOCAL qui connaît le site et interroge réellement les
 *     données de l'annuaire (métiers, secteurs, communes, profils) ;
 *  2. le moteur Apex IA via /api/chat, pour les questions libres, dès
 *     que APEX_IA_URL est configuré.
 *
 * Sans Apex IA l'assistant reste utile : il cherche, il oriente, il
 * répond aux questions courantes. Il ne devient jamais muet.
 * ================================================================== */

const Apex = {
  ouvert: false,
  identifie: false,
  iaDisponible: null,
  historique: [],
  contact: null,
  projet: null, // parcours guidé de création de projet, quand il est lancé

  /* Domaines d'aide — même liste que la page Projets, en version courte. */
  aidesProjet: [
    ["juridique", "Aide juridique", ["Droit"]],
    ["financement", "Financement", ["Banque / Finance"]],
    ["strategie", "Business plan & stratégie", ["Entrepreneuriat"]],
    ["gestion", "Comptabilité & gestion", ["Banque / Finance"]],
    ["technique", "Technique & digital", ["Technologie", "Ingénierie"]],
    ["communication", "Communication & marketing", ["Communication", "Média"]],
    ["equipe", "Recrutement & équipe", ["Autre", "Education"]],
    ["terrain", "Mise en œuvre terrain", ["Bâtiment", "Commerce", "Agriculture"]],
  ],

  STADES: ["Une idée à explorer", "Étude en cours", "Prêt à lancer", "Déjà lancé", "En difficulté"],
  FORMATS_RDV: ["Appel téléphonique", "WhatsApp", "Visioconférence", "En présentiel après le culte"],
  DELAIS: ["Dès que possible", "Dans la semaine", "Dans les deux semaines", "Pas urgent"],

  /* ---------------------------------------------------------------- *
   * Connaissance du site — chaque entrée sait vers où renvoyer.
   * ---------------------------------------------------------------- */
  savoir: [
    {
      id: "trouver",
      mots: ["trouver", "cherche", "recherche", "besoin de", "qui peut", "competence", "professionnel", "quelqu un"],
      titre: "Trouver une compétence",
      reponse:
        "L’annuaire se cherche par nom, métier, secteur, commune — mais aussi par ce que la personne recherche ou peut apporter.",
      liens: [["Ouvrir l’annuaire", "annuaire.html"], ["Décrire mon besoin", "connexion.html"]],
    },
    {
      id: "confidentialite",
      mots: ["numero", "telephone", "contact", "email", "adresse", "coordonnees", "joindre", "appeler", "confidentialite", "prive"],
      titre: "Coordonnées et confidentialité",
      reponse:
        "Aucun téléphone, e-mail ou adresse n’est publié sur le site — c’est un choix assumé. Pour joindre un membre, on passe par le bouton « Demander une mise en relation » : le secrétariat MISI transmet votre message et fait le lien si la personne accepte.",
      liens: [["Parcourir les profils", "annuaire.html"]],
    },
    {
      id: "inscription",
      mots: ["inscrire", "inscription", "rejoindre", "ajouter mon profil", "m enregistrer", "figurer", "adherer"],
      titre: "S’inscrire à l’annuaire",
      reponse:
        "Le formulaire prend environ cinq minutes : identité, département, secteurs, métier précis, expérience et ce que vous recherchez. Vos coordonnées restent privées, seul le reste est publié.",
      liens: [["Inscrire mon profil", "rejoindre.html"]],
    },
    {
      id: "cv",
      mots: ["cv", "curriculum", "resume", "pdf", "word", "modele de cv", "faire un cv", "creer un cv"],
      titre: "Créer un CV",
      reponse:
        "Le générateur produit un CV professionnel en A4 : six modèles, couleurs, polices et densité réglables, export PDF et Word. Tout se passe dans votre navigateur, rien n’est envoyé au site.",
      liens: [["Créer mon CV", "cv.html"]],
    },
    {
      id: "emploi",
      mots: ["emploi", "travail", "poste", "embauche", "recrutement", "candidature", "postuler", "job", "stage", "chomage", "sans emploi"],
      titre: "Chercher ou proposer un emploi",
      reponse:
        "L’espace emploi rassemble les membres qui cherchent un poste, les offres en cours, et permet de déposer une candidature spontanée. Le secrétariat MISI la transmet dès qu’un besoin correspond.",
      liens: [["Espace emploi", "emploi.html"], ["Déposer ma candidature", "emploi.html#publier"]],
    },
    {
      id: "recruter",
      mots: ["recruter", "embaucher", "je cherche un employe", "offre d emploi", "publier une offre", "besoin de personnel"],
      titre: "Recruter dans la communauté",
      reponse:
        "Vous pouvez publier une offre, mais commencez par parcourir la CVthèque : les candidats y sont filtrables par métier, secteur, commune et niveau d’expérience.",
      liens: [["Voir les candidats", "emploi.html#candidats"], ["Publier une offre", "emploi.html#publier"]],
    },
    {
      id: "accompagnement",
      mots: ["projet", "monter un projet", "entreprendre", "entrepreneur", "creer mon entreprise",
             "juridique", "avocat", "statuts", "contrat", "financement", "business plan",
             "accompagnement", "aide", "conseil pour mon projet", "rendez vous", "rdv", "appel"],
      titre: "Accompagnement de projet",
      reponse:
        "Si vous portez un projet, décrivez-le et dites où vous bloquez — juridique, financement, business plan, technique, communication. Le secrétariat MISI cherche la compétence dans l’annuaire puis dans le réseau de l’église, et organise un appel ou un rendez-vous sur vos créneaux.",
      liens: [["Demander un accompagnement", "accompagnement.html#demande"], ["Voir les types d’aide", "accompagnement.html#aides"]],
      rapides: [["Décrire mon projet ici", "__projet__"], ["Voir les types d’aide", "types d aide projet"]],
    },
    {
      id: "opportunites",
      mots: ["opportunite", "partenaire", "partenariat", "projet", "investisseur", "investissement", "collaboration", "association"],
      titre: "Opportunités",
      reponse:
        "Chaque besoin déclaré par un membre devient une opportunité, classée par type : partenariat, projet, collaboration, investissement, formation, emploi.",
      liens: [["Voir les opportunités", "opportunites.html"], ["Proposer une collaboration", "opportunites.html#publier"]],
    },
    {
      id: "mentorat",
      mots: ["mentor", "mentorat", "accompagnement", "conseil", "expert", "formation", "former", "apprendre", "coach"],
      titre: "Mentorat et formation",
      reponse:
        "L’outil de mise en relation classe les membres selon ce que vous cherchez — un mentor, un conseil d’expert, un formateur — et explique pourquoi chaque profil vous est proposé.",
      liens: [["Trouver un mentor", "connexion.html"], ["Membres expérimentés", "annuaire.html?apport=mentorat"]],
    },
    {
      id: "matching",
      mots: ["matching", "compatible", "suggestion", "algorithme", "comment ca marche", "mise en relation"],
      titre: "Comment fonctionne la mise en relation",
      reponse:
        "Le classement croise vos besoins avec ce que chaque membre peut apporter, puis pondère par le métier, le secteur, la proximité géographique et l’écart d’expérience. Ce n’est pas une IA : c’est un calcul qui explique toujours ses suggestions.",
      liens: [["Essayer la mise en relation", "connexion.html"]],
    },
    {
      id: "modifier",
      mots: ["modifier", "corriger", "supprimer", "retirer", "erreur sur mon profil", "changer mes informations"],
      titre: "Corriger ou retirer un profil",
      reponse:
        "Les corrections passent par le secrétariat MISI. Écrivez-lui votre demande : elle est appliquée à la prochaine mise à jour de l’annuaire.",
      liens: [["Nous écrire", "rejoindre.html"]],
    },
    {
      id: "application",
      mots: ["application", "app", "mobile", "telephone portable", "tablette", "installer", "hors ligne"],
      titre: "Installer l’application",
      reponse:
        "Le site s’installe comme une application sur mobile et tablette : icône sur l’écran d’accueil, plein écran, et consultation possible sans connexion. Depuis votre navigateur, choisissez « Ajouter à l’écran d’accueil ».",
      liens: [["Retour à l’accueil", "index.html"]],
    },
    {
      id: "misi",
      mots: ["misi", "qui etes vous", "c est quoi", "ministere", "icc", "riviera", "eglise", "presentation"],
      titre: "Le MISI",
      reponse:
        "Le MISI — Ministère de l’Innovation et des Sphères d’Influences — porte cet annuaire pour l’Impact Centre Chrétien de Riviera 2. Son objectif : identifier, connecter et valoriser les compétences professionnelles des membres.",
      liens: [["Découvrir la plateforme", "index.html"]],
    },
  ],

  /* ---------------------------------------------------------------- *
   * Recherche réelle dans les données de l'annuaire
   * ---------------------------------------------------------------- */
  /* Mots trop courants pour discriminer : « cherche » remontait tous les
     membres dont le métier est « En recherche d'emploi ». */
  motsVides: new Set([
    "cherche", "recherche", "rechercher", "trouver", "veux", "voudrais", "besoin", "aide",
    "aider", "quelqu", "quelquun", "personne", "membre", "membres", "profil", "profils",
    "comment", "faire", "savoir", "peux", "pouvez", "avez", "avec", "pour", "dans", "sur",
    "les", "des", "une", "quelque", "quelques", "bonjour", "bonsoir", "salut", "merci",
    "plait", "svp", "site", "plateforme", "annuaire", "connais", "connaissez", "existe",
  ]),

  chercherProfils(texte, limite = 3) {
    if (!Data.membres.length) return [];
    const mots = sansAccent(texte)
      .split(/[^a-z0-9]+/)
      .filter((m) => m.length > 2 && !this.motsVides.has(m));
    if (!mots.length) return [];

    const notes = Data.membres.map((m) => {
      const metiers = sansAccent(m.metiers.join(" ") + " " + m.metier);
      const secteurs = sansAccent(m.secteurs.join(" "));
      const lieu = sansAccent([m.commune, m.quartier, m.ville].join(" "));
      // « Pertinence » = ce que la personne SAIT FAIRE. Le lieu n'est qu'un
      // bonus : sans cette séparation, « un comptable à Cocody » remontait
      // n'importe quel habitant de Cocody.
      let pertinence = 0;
      let bonus = 0;
      mots.forEach((mot) => {
        if (metiers.includes(mot)) pertinence += 10;
        if (secteurs.includes(mot)) pertinence += 7;
        if (sansAccent(m.nom).includes(mot)) pertinence += 9;
        if (lieu.includes(mot)) bonus += 4;
      });
      return { m, pertinence, note: pertinence + bonus + m.rang * 0.5 };
    });

    return notes
      .filter((x) => x.pertinence >= 7)
      .sort((a, b) => b.note - a.note)
      .slice(0, limite)
      .map((x) => x.m);
  },

  /**
   * Repère un métier du référentiel cité dans le message.
   * Sert à répondre honnêtement « personne n'exerce ce métier ici »
   * au lieu de proposer un profil sans rapport.
   */
  metierCite(texte) {
    if (!Data.ref?.metiers) return null;
    const n = sansAccent(texte);
    let trouve = null;
    for (const [secteur, liste] of Object.entries(Data.ref.metiers)) {
      for (const [metier] of liste) {
        // On compare sur le premier mot significatif du métier
        // (« Peintre en bâtiment » → « peintre »).
        const cle = sansAccent(metier).split(/[\s/(]/)[0];
        if (cle.length > 4 && n.includes(cle) && (!trouve || cle.length > trouve.cle.length))
          trouve = { metier, secteur, cle };
      }
    }
    return trouve;
  },

  /** Le sujet du savoir qui correspond le mieux au message. */
  trouverSujet(texte) {
    const n = sansAccent(texte);
    let meilleur = null;
    this.savoir.forEach((s) => {
      const note = s.mots.reduce((acc, mot) => acc + (n.includes(sansAccent(mot)) ? mot.length : 0), 0);
      if (note && (!meilleur || note > meilleur.note)) meilleur = { s, note };
    });
    return meilleur?.s || null;
  },

  /* ---------------------------------------------------------------- *
   * Interface
   * ---------------------------------------------------------------- */
  init() {
    if (document.querySelector("[data-apex]")) return;

    const el = document.createElement("div");
    el.dataset.apex = "1";
    el.className = "sans-impression";
    el.innerHTML = `
      <button data-apex-ouvrir
              class="fixed bottom-5 right-5 z-40 flex items-center gap-2.5 rounded-full bg-brand-600 py-3 pl-4 pr-5
                     text-white shadow-lift transition hover:bg-brand-700 focus-visible:outline-2
                     focus-visible:outline-offset-2 focus-visible:outline-brand-600"
              aria-label="Ouvrir l’assistant Apex IA">
        ${icon("etincelle", "h-5 w-5")}
        <span class="text-[14px] font-semibold">Apex IA</span>
      </button>

      <div data-apex-panneau
           class="fixed inset-0 z-50 hidden sm:inset-auto sm:bottom-5 sm:right-5 sm:h-[min(640px,calc(100dvh-2.5rem))] sm:w-[400px]"
           role="dialog" aria-modal="true" aria-label="Assistant Apex IA">
        <div class="flex h-full flex-col overflow-hidden bg-white shadow-2xl ring-1 ring-ink-200 sm:rounded-xl2">

          <header class="flex items-center gap-3 border-b border-ink-200 bg-brand-600 px-4 py-3.5 text-white">
            <span class="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/15">
              ${icon("etincelle", "h-5 w-5")}
            </span>
            <div class="min-w-0 flex-1">
              <p class="font-display text-[15px] font-bold leading-tight">Apex IA</p>
              <p class="text-[12px] text-brand-100" data-apex-etat>Assistant de la plateforme MISI</p>
            </div>
            <button data-apex-fermer class="rounded-lg p-1.5 transition hover:bg-white/15" aria-label="Fermer">
              ${icon("fermer", "h-5 w-5")}
            </button>
          </header>

          <div class="flex-1 space-y-3 overflow-y-auto bg-ink-50 px-4 py-4" data-apex-fil></div>

          <div class="border-t border-ink-200 bg-white px-3 py-2.5" data-apex-actions></div>

          <form class="flex items-end gap-2 border-t border-ink-200 bg-white px-3 py-3" data-apex-form>
            <textarea rows="1" data-apex-saisie
              class="field max-h-28 flex-1 resize-none py-2.5 text-[14px]"
              placeholder="Posez votre question…" aria-label="Votre message"></textarea>
            <button class="btn-primary shrink-0 px-3 py-2.5" aria-label="Envoyer">
              ${icon("fleche", "h-5 w-5")}
            </button>
          </form>
        </div>
      </div>`;
    document.body.appendChild(el);

    this.panneau = el.querySelector("[data-apex-panneau]");
    this.fil = el.querySelector("[data-apex-fil]");
    this.actions = el.querySelector("[data-apex-actions]");
    this.saisie = el.querySelector("[data-apex-saisie]");

    el.querySelector("[data-apex-ouvrir]").addEventListener("click", () => this.basculer(true));
    el.querySelector("[data-apex-fermer]").addEventListener("click", () => this.basculer(false));
    document.addEventListener("keydown", (e) => e.key === "Escape" && this.ouvert && this.basculer(false));

    el.querySelector("[data-apex-form]").addEventListener("submit", (e) => {
      e.preventDefault();
      const t = this.saisie.value.trim();
      if (!t) return;
      this.saisie.value = "";
      this.saisie.style.height = "auto";
      this.envoyer(t);
    });

    this.saisie.addEventListener("input", () => {
      this.saisie.style.height = "auto";
      this.saisie.style.height = Math.min(this.saisie.scrollHeight, 112) + "px";
    });
    this.saisie.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        el.querySelector("[data-apex-form]").requestSubmit();
      }
    });

    // Délégation des boutons de réponse rapide.
    this.actions.addEventListener("click", (e) => {
      const b = e.target.closest("[data-apex-rapide]");
      if (b) this.envoyer(b.dataset.apexRapide, b.textContent.trim());
    });

    this.testerIA();
  },

  testerIA() {
    fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: "ping" }),
    })
      .then((r) => (this.iaDisponible = r.status !== 501 && r.status !== 404))
      .catch(() => (this.iaDisponible = false));
  },

  basculer(ouvrir) {
    this.ouvert = ouvrir;
    this.panneau.classList.toggle("hidden", !ouvrir);
    document.body.style.overflow = ouvrir && innerWidth < 640 ? "hidden" : "";
    if (ouvrir && !this.fil.children.length) this.demarrer();
    if (ouvrir) setTimeout(() => this.saisie.focus(), 120);
  },

  /* --- Rendu des bulles --- */
  bulle(role, html) {
    const d = document.createElement("div");
    d.className = role === "user" ? "flex justify-end" : "flex";
    d.innerHTML =
      role === "user"
        ? `<div class="max-w-[85%] rounded-xl2 rounded-br-sm bg-brand-600 px-3.5 py-2.5 text-[14px] leading-relaxed text-white">${html}</div>`
        : `<div class="max-w-[92%] rounded-xl2 rounded-bl-sm bg-white px-3.5 py-2.5 text-[14px] leading-relaxed text-ink-800 ring-1 ring-ink-200">${html}</div>`;
    this.fil.appendChild(d);
    this.fil.scrollTop = this.fil.scrollHeight;
    return d;
  },

  reflexion() {
    const d = this.bulle(
      "bot",
      `<span class="flex gap-1 py-1" aria-label="Apex IA rédige">
         <span class="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-300" style="animation-delay:0ms"></span>
         <span class="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-300" style="animation-delay:150ms"></span>
         <span class="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-300" style="animation-delay:300ms"></span>
       </span>`,
    );
    return d;
  },

  /** Transforme [texte](page.html) en vrais boutons de redirection. */
  formater(texte) {
    const liens = [];
    let corps = esc(texte).replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, lib, url) => {
      liens.push([lib, url]);
      return `<strong class="font-semibold">${lib}</strong>`;
    });
    corps = corps.replace(/\n/g, "<br>");
    if (liens.length) corps += this.boutonsLiens(liens);
    return corps;
  },

  boutonsLiens(liens) {
    return `<span class="mt-3 flex flex-wrap gap-1.5">${liens
      .map(
        ([lib, url]) =>
          `<a class="btn-secondary btn-sm" href="${esc(url)}">${esc(lib)} ${icon("fleche", "h-3.5 w-3.5")}</a>`,
      )
      .join("")}</span>`;
  },

  carteProfil(m) {
    const c = teinte(m.nom);
    return `
      <button class="mt-2 flex w-full items-center gap-2.5 rounded-xl border border-ink-200 p-2.5 text-left
                     transition hover:border-brand-300 hover:bg-brand-50/50" data-profil="${m.id}">
        <span class="avatar h-9 w-9 text-[12px]" style="background:${c.bg};color:${c.tx}">${esc(m.initiales)}</span>
        <span class="min-w-0 flex-1">
          <span class="block truncate text-[13.5px] font-semibold text-ink-900">${esc(m.nom)}</span>
          <span class="block truncate text-[12px] text-ink-500">
            ${esc(m.metiers[0] || m.metier || m.secteur)} · ${esc(m.zone)}
          </span>
        </span>
      </button>`;
  },

  rapides(choix) {
    this.actions.innerHTML = choix.length
      ? `<div class="flex flex-wrap gap-1.5">${choix
          .map(([lib, envoi]) => `<button class="chip" data-apex-rapide="${esc(envoi || lib)}">${esc(lib)}</button>`)
          .join("")}</div>`
      : "";
  },

  /* ---------------------------------------------------------------- *
   * Scénario d'ouverture
   * ---------------------------------------------------------------- */
  demarrer() {
    this.bulle(
      "bot",
      "Bienvenue sur la plateforme du MISI, je suis <strong>Apex IA</strong>. Comment puis-je vous aider aujourd’hui dans vos recherches ?",
    );
    this.demanderIdentite();
  },

  demanderIdentite() {
    const d = this.bulle(
      "bot",
      `Pour que le secrétariat MISI puisse vous recontacter si nécessaire, vous pouvez vous présenter.
       <em class="text-ink-500">C’est facultatif — vous pouvez explorer sans rien renseigner.</em>
       <form class="mt-3 grid gap-2" data-apex-identite>
         <div class="grid grid-cols-2 gap-2">
           <input class="field py-2 text-[13.5px]" name="prenom" placeholder="Prénom" autocomplete="given-name" />
           <input class="field py-2 text-[13.5px]" name="nom" placeholder="Nom" autocomplete="family-name" />
         </div>
         <input class="field py-2 text-[13.5px]" name="email" type="email" placeholder="E-mail" autocomplete="email" />
         <input class="field py-2 text-[13.5px]" name="telephone" type="tel" placeholder="Téléphone" autocomplete="tel" />
         <div class="flex gap-2">
           <button class="btn-primary btn-sm flex-1" type="submit">Enregistrer</button>
           <button class="btn-secondary btn-sm" type="button" data-apex-passer>Passer</button>
         </div>
       </form>`,
    );

    const form = d.querySelector("[data-apex-identite]");
    const suite = () => {
      this.identifie = true;
      this.proposerMenu();
    };

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = new FormData(form);
      this.contact = {
        prenom: (f.get("prenom") || "").trim(),
        nom: (f.get("nom") || "").trim(),
        email: (f.get("email") || "").trim(),
        telephone: (f.get("telephone") || "").trim(),
      };
      if (!this.contact.prenom && !this.contact.nom && !this.contact.email && !this.contact.telephone) return suite();

      form.outerHTML = `<p class="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-[13px] text-emerald-800">
          Merci ${esc(this.contact.prenom || this.contact.nom)}. Vos coordonnées restent privées&nbsp;:
          elles ne servent qu’au secrétariat MISI pour vous répondre.</p>`;

      // Enregistrement discret, sans bloquer la conversation.
      if (typeof FB !== "undefined" && firebaseActif()) {
        FB.enregistrerDemande({ ...this.contact, origine: location.pathname }).catch(() => {});
      }
      suite();
    });

    form.querySelector("[data-apex-passer]").addEventListener("click", () => {
      form.outerHTML = `<p class="mt-2 text-[13px] text-ink-500">Très bien, continuons.</p>`;
      suite();
    });
  },

  proposerMenu() {
    this.bulle("bot", "Que souhaitez-vous faire ?");
    this.rapides([
      ["Trouver une compétence"],
      ["Chercher un emploi"],
      ["Créer mon CV"],
      ["M’inscrire à l’annuaire"],
      ["Trouver un mentor"],
      ["J’ai un projet, j’ai besoin d’aide", "__projet__"],
      ["Proposer une offre ou un projet"],
    ]);
  },

  /* ---------------------------------------------------------------- *
   * Parcours guidé « décrire mon projet »
   *
   * Le formulaire de la page Projets, mais en conversation : une question
   * à la fois, et l'envoi part vers la même collection Firestore.
   * ---------------------------------------------------------------- */
  lancerProjet() {
    this.projet = { etape: "titre", d: { aides: [] } };
    this.bulle(
      "bot",
      "Très bien, décrivons votre projet ensemble — six questions, deux minutes. " +
        "<strong>Comment s’appelle votre projet ?</strong>",
    );
    this.rapides([["Finalement, non", "__annuler_projet__"]]);
    this.saisie.placeholder = "Ex. Atelier de couture à Yopougon";
    this.saisie.focus();
  },

  arreterProjet(message) {
    this.projet = null;
    this.saisie.placeholder = "Posez votre question…";
    if (message) this.bulle("bot", message);
    this.rapides([["Trouver une compétence"], ["Chercher un emploi"], ["Créer mon CV"]]);
  },

  /** Traite un message dans le parcours projet. Renvoie true s'il l'a consommé. */
  async etapeProjet(texte) {
    if (!this.projet) return false;
    if (texte === "__annuler_projet__") {
      this.arreterProjet("Pas de souci, on arrête là. Le formulaire complet reste disponible quand vous voulez." +
        this.boutonsLiens([["Page Projets", "accompagnement.html"]]));
      return true;
    }

    const p = this.projet;
    const d = p.d;

    switch (p.etape) {
      case "titre":
        if (texte.length < 3) {
          this.bulle("bot", "Donnez-lui un nom, même provisoire.");
          return true;
        }
        d.titre = texte;
        p.etape = "description";
        this.bulle(
          "bot",
          `« ${esc(texte)} », noté. <strong>Décrivez-le en quelques phrases</strong> : ce que vous voulez faire, pour qui, et surtout <strong>ce qui vous bloque aujourd’hui</strong>.`,
        );
        this.saisie.placeholder = "Quelques phrases suffisent…";
        return true;

      case "description":
        if (texte.length < 20) {
          this.bulle("bot", "Encore un peu de détail : c’est ce qui permettra d’orienter vers la bonne personne.");
          return true;
        }
        d.description = texte;
        p.etape = "stade";
        this.bulle("bot", "<strong>Où en êtes-vous ?</strong>");
        this.rapides(this.STADES.map((x) => [x]).concat([["Annuler", "__annuler_projet__"]]));
        this.saisie.placeholder = "Ou répondez librement…";
        return true;

      case "stade":
        d.stade = texte;
        p.etape = "aides";
        this.bulle("bot", "<strong>De quelle aide avez-vous besoin ?</strong> Cochez tout ce qui s’applique.");
        this.chipsAides();
        return true;

      case "format":
        d.format = texte;
        p.etape = "delai";
        this.bulle("bot", "<strong>Sous quel délai</strong> souhaitez-vous cet échange ?");
        this.rapides(this.DELAIS.map((x) => [x]));
        return true;

      case "delai":
        d.delai = texte;
        return this.finirProjet();

      default:
        return true;
    }
  },

  /** Étape à choix multiples : des puces qui se cochent, puis « C'est bon ». */
  chipsAides() {
    const p = this.projet;
    const dispo = (secteurs) => Data.membres.filter((m) => m.secteurs.some((s) => secteurs.includes(s))).length;

    const dessiner = () => {
      this.actions.innerHTML = `
        <div class="flex flex-wrap gap-1.5">
          ${this.aidesProjet
            .map(([id, lib, secteurs]) => {
              const n = dispo(secteurs);
              const actif = p.d.aides.includes(id);
              return `<button class="chip" data-aide="${id}" aria-pressed="${actif}">
                        ${esc(lib)}<span class="text-[11px] opacity-70">${n}</span></button>`;
            })
            .join("")}
          <button class="chip bg-brand-600 text-white ring-brand-600 hover:text-white" data-aides-fini>
            C’est bon${p.d.aides.length ? ` (${p.d.aides.length})` : ""}
          </button>
        </div>`;
    };
    dessiner();

    this.actions.onclick = (e) => {
      const b = e.target.closest("[data-aide]");
      if (b) {
        const id = b.dataset.aide;
        const i = p.d.aides.indexOf(id);
        i >= 0 ? p.d.aides.splice(i, 1) : p.d.aides.push(id);
        return dessiner();
      }
      if (e.target.closest("[data-aides-fini]")) {
        this.actions.onclick = null;
        const libs = p.d.aides.map((id) => this.aidesProjet.find((a) => a[0] === id)[1]);
        this.bulle("user", esc(libs.join(", ") || "Je ne sais pas encore"));
        this.proposerAccompagnateurs();
      }
    };
  },

  /** Montre qui, dans l'annuaire, pourrait aider — avant même l'envoi. */
  proposerAccompagnateurs() {
    const p = this.projet;
    const secteurs = new Set(
      p.d.aides.flatMap((id) => this.aidesProjet.find((a) => a[0] === id)[2]),
    );
    const liste = secteurs.size
      ? Data.membres
          .filter((m) => m.secteurs.some((s) => secteurs.has(s)))
          .sort((a, b) => b.rang - a.rang)
          .slice(0, 3)
      : [];

    let html = liste.length
      ? "Dans l’annuaire, ces membres pourraient vous accompagner&nbsp;:" +
        liste.map((m) => this.carteProfil(m)).join("") +
        `<p class="mt-2.5 text-[12px] leading-relaxed text-ink-500">
           C’est le secrétariat MISI qui les sollicite — ils restent libres d’accepter.</p>`
      : "Aucun membre de l’annuaire ne couvre exactement ces domaines. Le secrétariat MISI ira chercher la compétence dans le réseau de l’église.";

    html += "<br><br><strong>Comment préférez-vous échanger ?</strong>";
    this.bulle("bot", html);
    p.etape = "format";
    this.rapides(this.FORMATS_RDV.map((x) => [x]));
  },

  /** Dernière étape : coordonnées si besoin, puis envoi. */
  finirProjet() {
    const p = this.projet;
    const c = this.contact;

    if (c && c.email && c.telephone) {
      Object.assign(p.d, { prenom: c.prenom, nom: c.nom, email: c.email, telephone: c.telephone });
      return this.envoyerProjet();
    }

    const bulle = this.bulle(
      "bot",
      `Dernière étape : <strong>comment vous joindre ?</strong>
       <form class="mt-3 grid gap-2" data-projet-contact>
         <div class="grid grid-cols-2 gap-2">
           <input class="field py-2 text-[13.5px]" name="prenom" placeholder="Prénom" required value="${esc(c?.prenom || "")}" />
           <input class="field py-2 text-[13.5px]" name="nom" placeholder="Nom" required value="${esc(c?.nom || "")}" />
         </div>
         <input class="field py-2 text-[13.5px]" name="email" type="email" placeholder="E-mail" required value="${esc(c?.email || "")}" />
         <input class="field py-2 text-[13.5px]" name="telephone" type="tel" placeholder="Téléphone / WhatsApp" required value="${esc(c?.telephone || "")}" />
         <label class="flex cursor-pointer gap-2 pt-1">
           <input type="checkbox" required class="mt-0.5 h-4 w-4 shrink-0 rounded border-ink-300 text-brand-600" />
           <span class="text-[12px] leading-relaxed text-ink-500">
             J’autorise le secrétariat MISI à lire ma demande et à me mettre en relation.
           </span>
         </label>
         <button class="btn-primary btn-sm mt-1" type="submit">Envoyer ma demande</button>
       </form>`,
    );
    this.rapides([]);

    bulle.querySelector("[data-projet-contact]").addEventListener("submit", (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      Object.assign(p.d, {
        prenom: (f.get("prenom") || "").trim(),
        nom: (f.get("nom") || "").trim(),
        email: (f.get("email") || "").trim(),
        telephone: (f.get("telephone") || "").trim(),
      });
      e.target.outerHTML = `<p class="mt-2 text-[13px] text-ink-500">Merci, j’envoie votre demande…</p>`;
      this.envoyerProjet();
    });
    return true;
  },

  async envoyerProjet() {
    const d = this.projet.d;
    const libs = d.aides.map((id) => this.aidesProjet.find((a) => a[0] === id)[1]);
    const attente = this.reflexion();

    let enregistre = false;
    try {
      if (typeof FB !== "undefined" && firebaseActif()) {
        enregistre = await FB.enregistrerAccompagnement({
          titre: d.titre,
          description: d.description,
          stade: d.stade || "—",
          aides: libs,
          formats: d.format ? [d.format] : [],
          delai: d.delai || "—",
          prenom: d.prenom,
          nom: d.nom,
          email: d.email,
          telephone: d.telephone,
          origine: "assistant Apex IA",
        });
      }
    } catch {
      enregistre = false;
    }
    attente.remove();

    if (enregistre) {
      this.bulle(
        "bot",
        `C’est envoyé. Le secrétariat MISI revient vers vous par <strong>${esc(d.format || "le canal indiqué")}</strong> ` +
          `pour caler le rendez-vous — délai souhaité&nbsp;: ${esc((d.delai || "").toLowerCase())}.` +
          `<p class="mt-2.5 text-[12px] leading-relaxed text-ink-500">
             Votre description de projet reste confidentielle : elle n’apparaît nulle part sur le site.</p>` +
          this.boutonsLiens([["Parcourir l’annuaire", "annuaire.html"], ["Voir les opportunités", "opportunites.html"]]),
      );
    } else {
      // Sans base configurée, on ne perd pas la saisie : on la rend copiable.
      const texte =
        `Demande d’accompagnement de projet — via Apex IA\n\n` +
        `Projet : ${d.titre}\nStade : ${d.stade || "—"}\n\n${d.description}\n\n` +
        `Aides : ${libs.join(", ") || "—"}\nFormat : ${d.format || "—"}\nDélai : ${d.delai || "—"}\n\n` +
        `${d.prenom} ${d.nom} · ${d.email} · ${d.telephone}`;
      this.bulle(
        "bot",
        "Je n’arrive pas à enregistrer la demande depuis ici. Votre saisie n’est pas perdue&nbsp;: " +
          "copiez-la et transmettez-la au secrétariat MISI, ou reprenez-la sur la page Projets." +
          `<span class="mt-3 flex flex-wrap gap-1.5">
             <button class="btn-secondary btn-sm" data-copier-projet>Copier ma demande</button>
             <a class="btn-secondary btn-sm" href="accompagnement.html#demande">Page Projets ${icon("fleche", "h-3.5 w-3.5")}</a>
           </span>`,
      );
      const b = this.fil.querySelector("[data-copier-projet]");
      b?.addEventListener("click", () => {
        navigator.clipboard?.writeText(texte);
        b.textContent = "Copié ✓";
      });
    }

    this.projet = null;
    this.saisie.placeholder = "Posez votre question…";
    this.rapides([["Autre chose"], ["Parcourir l’annuaire", "trouver une compétence"]]);
    return true;
  },

  /* ---------------------------------------------------------------- *
   * Traitement d'un message
   * ---------------------------------------------------------------- */
  async envoyer(texte, affichage) {
    // Déclencheur explicite du parcours projet.
    if (texte === "__projet__") {
      this.bulle("user", esc(affichage || "Décrire mon projet"));
      this.rapides([]);
      return this.lancerProjet();
    }

    if (this.projet) {
      if (texte !== "__annuler_projet__") this.bulle("user", esc(affichage || texte));
      this.rapides([]);
      return this.etapeProjet(texte);
    }

    this.bulle("user", esc(affichage || texte));
    this.rapides([]);
    this.historique.push({ role: "user", content: texte });

    const attente = this.reflexion();
    const locale = this.reponseLocale(texte);

    // Le moteur local répond dès qu'il reconnaît le sujet ou trouve des
    // profils : c'est plus rapide et plus juste qu'une réponse générique.
    if (locale) {
      await new Promise((r) => setTimeout(r, 320));
      attente.remove();
      this.bulle("bot", locale.html);
      this.historique.push({ role: "assistant", content: locale.brut });
      this.rapides(locale.rapides || []);
      return;
    }

    if (this.iaDisponible === false) {
      attente.remove();
      this.bulle(
        "bot",
        "Je n’ai pas trouvé de réponse précise à cette question. Voici les pages qui contiennent l’information&nbsp;:" +
          this.boutonsLiens([
            ["Annuaire", "annuaire.html"],
            ["Espace emploi", "emploi.html"],
            ["Opportunités", "opportunites.html"],
          ]),
      );
      this.rapides([["Trouver une compétence"], ["Chercher un emploi"], ["Créer mon CV"]]);
      return;
    }

    try {
      const rep = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: texte, historique: this.historique, contexte: this.instantane() }),
      });
      const j = await rep.json().catch(() => ({}));
      attente.remove();

      if (!rep.ok) throw new Error(j.erreur || "indisponible");

      this.bulle("bot", this.formater(j.texte));
      this.historique.push({ role: "assistant", content: j.texte });
      this.rapides([["Autre chose"], ["Parler à quelqu’un du MISI", "contacter le secrétariat"]]);
    } catch {
      attente.remove();
      this.bulle(
        "bot",
        "Je n’arrive pas à joindre le moteur pour le moment. En attendant, ces pages répondent à l’essentiel&nbsp;:" +
          this.boutonsLiens([
            ["Annuaire", "annuaire.html"],
            ["Espace emploi", "emploi.html"],
          ]),
      );
    }
  },

  instantane() {
    return {
      membres: Data.membres.length,
      secteurs: Data.secteurs().length,
      metiers: Data.metiersUtilises().length,
      candidats: Data.membres.filter((m) => m.besoins.includes("emploi")).length,
      opportunites: typeof construireOpportunites === "function" ? construireOpportunites().length : undefined,
      topSecteurs: Data.secteurs().slice(0, 6).map(([s, n]) => `${s} (${n})`),
      topMetiers: Data.metiersUtilises().slice(0, 12).map(([m, n]) => `${m} (${n})`),
      topCommunes: Data.communes().filter(([c]) => c !== "Non précisée").slice(0, 8).map(([c, n]) => `${c} (${n})`),
    };
  },

  /** Réponse construite localement : sujet reconnu et/ou profils trouvés. */
  reponseLocale(texte) {
    const sujet = this.trouverSujet(texte);
    const profils = this.chercherProfils(texte);

    // Métier connu du référentiel, mais aucun membre ne l'exerce :
    // le dire franchement vaut mieux qu'une suggestion approximative.
    if (!profils.length) {
      const cite = this.metierCite(texte);
      if (cite) {
        const dansSecteur = Data.membres.filter((m) => m.secteurs.includes(cite.secteur)).length;
        return {
          html:
            `Aucun membre n’est référencé comme <strong>${esc(cite.metier.toLowerCase())}</strong> pour l’instant. ` +
            (dansSecteur
              ? `En revanche, ${dansSecteur} membre${dansSecteur > 1 ? "s sont" : " est"} du secteur ${esc(cite.secteur)} — il y a peut-être un profil proche.`
              : `Le secteur ${esc(cite.secteur)} n’est pas encore représenté.`) +
            `<p class="mt-2.5 text-[12px] leading-relaxed text-ink-500">
               L’annuaire se remplit au fil des inscriptions : publier votre besoin le rend
               visible auprès des membres concernés.</p>` +
            this.boutonsLiens([
              ["Voir le secteur " + cite.secteur, "annuaire.html?secteur=" + encodeURIComponent(cite.secteur)],
              ["Publier mon besoin", "opportunites.html#publier"],
            ]),
          brut: `Aucun ${cite.metier} référencé ; secteur ${cite.secteur} proposé.`,
          rapides: [["Chercher autre chose"], ["Voir tous les profils", "trouver une compétence"]],
        };
      }
    }

    if (!sujet && !profils.length) return null;

    let html = "";
    let brut = "";

    if (sujet) {
      html += esc(sujet.reponse);
      brut = sujet.reponse;
    }

    if (profils.length) {
      const intro = sujet
        ? "<br><br>Voici des membres qui correspondent&nbsp;:"
        : `J’ai trouvé ${profils.length} profil${profils.length > 1 ? "s" : ""} qui correspond${profils.length > 1 ? "ent" : ""} à votre recherche&nbsp;:`;
      html += intro + profils.map((m) => this.carteProfil(m)).join("");
      brut += (brut ? " " : "") + "Profils proposés : " + profils.map((m) => m.nom).join(", ");
      html += `<p class="mt-2.5 text-[12px] leading-relaxed text-ink-500">
        Les coordonnées ne sont pas affichées&nbsp;: utilisez « Demander une mise en relation »
        depuis la fiche du membre.</p>`;
    }

    if (sujet) html += this.boutonsLiens(sujet.liens);
    else html += this.boutonsLiens([["Affiner dans l’annuaire", "annuaire.html?q=" + encodeURIComponent(texte.slice(0, 60))]]);

    const rapides = sujet
      ? sujet.rapides || [["Autre chose"], ["Voir tous les profils", "trouver une compétence"]]
      : [["Affiner ma recherche"], ["Chercher un emploi"], ["Créer mon CV"]];

    return { html, brut, rapides };
  },
};

/* Le widget n'apparaît pas sur le générateur de CV : la place y est
   déjà prise par l'aperçu et la planche de travail. */
document.addEventListener("DOMContentLoaded", () => {
  if (document.body.dataset.sansAssistant !== undefined) return;
  Data.charger().then(() => Apex.init());
});
