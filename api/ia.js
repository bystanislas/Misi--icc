/* ==================================================================
 * POST /api/ia — aide à la rédaction du CV (assets/js/cv.js).
 *
 * Entrée  : { tache: "accroche" | "competences" | "experience",
 *             texte, contexte (intitulé du poste visé) }
 * Sortie  : { texte } — la version améliorée, remplace le champ.
 * 501 tant que ANTHROPIC_API_KEY n'est pas défini : le bouton
 * « Améliorer la formulation » n'apparaît pas.
 * ================================================================== */

import { repondre, exigerPost, origineAutorisee, limiter, corpsJson, iaConfiguree, demanderAClaude, texte } from "./_commun.js";

const CONSIGNES = {
  accroche:
    "Réécris l'accroche (résumé professionnel en tête de CV) : 2 à 4 phrases, 60 mots au plus, style CV sans « je » répétitif, concrète et orientée vers le poste visé.",
  competences:
    "Réécris la liste de compétences : une compétence par ligne, intitulés courts et professionnels, sans puces ni numéros, regroupe les doublons, garde l'ordre d'importance.",
  experience:
    "Réécris la description d'expérience : une réalisation par ligne (3 à 6 lignes), chaque ligne commence par un verbe d'action, sans puces ni numéros.",
};

const SYSTEME = `Tu aides des membres d'une communauté ivoirienne à rédiger leur CV en français.
Tu améliores la formulation d'un champ du CV : orthographe, clarté, ton professionnel.
N'invente aucun fait : pas de chiffre, d'employeur, de diplôme, d'outil ou de résultat absent du texte d'origine.
Réponds uniquement avec le texte réécrit, sans introduction, sans guillemets, sans commentaire.`;

export default async function handler(req, res) {
  if (!exigerPost(req, res)) return;
  if (!iaConfiguree()) return repondre(res, 501, { erreur: "Assistance IA non configurée sur ce déploiement." });
  if (!origineAutorisee(req, res)) return;

  const corps = corpsJson(req);
  const consigne = CONSIGNES[corps.tache];
  if (!consigne) return repondre(res, 400, { erreur: "Tâche inconnue." });
  const original = texte(corps.texte, 3000).trim();
  // Sonde envoyée au chargement de la page CV (texte vide) : rien à faire.
  if (!original) return repondre(res, 200, { texte: "" });

  if (!limiter(req, res, { cle: "ia", max: 30, fenetreMs: 10 * 60e3 })) return;

  const poste = texte(corps.contexte, 150).trim();
  const { statut, corps: sortie } = await demanderAClaude({
    system: SYSTEME,
    maxTokens: 2048,
    messages: [
      {
        role: "user",
        content: `${consigne}${poste ? `\nPoste visé : ${poste}` : ""}\n\n<texte>\n${original}\n</texte>`,
      },
    ],
  });
  repondre(res, statut, sortie);
}
