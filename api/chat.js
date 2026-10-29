/* ==================================================================
 * POST /api/chat — Apex IA, l'assistant du site (assets/js/chatbot.js).
 *
 * Entrée  : { question, historique: [{ role, content }], contexte }
 * Sortie  : { texte }  — les liens [Libellé](page.html) deviennent des
 *           boutons dans la bulle.
 * 501 tant que ANTHROPIC_API_KEY n'est pas défini : le chatbot reste
 * alors sur son moteur local, sans erreur visible.
 * ================================================================== */

import { repondre, exigerPost, origineAutorisee, limiter, corpsJson, iaConfiguree, demanderAClaude, texte } from "./_commun.js";

const SYSTEME = `Tu es Apex IA, l'assistant de l'Annuaire des compétences de l'église ICC Riviera 2 (Abidjan), porté par le MISI — Ministère de l'Innovation et des Sphères d'Influence.

L'annuaire recense les compétences professionnelles des membres pour les connecter entre eux : emploi, partenariats, collaborations, projets, mentorat.

Pages du site (cite-les sous la forme [Libellé](page.html) quand elles aident) :
- [Annuaire](annuaire.html) : chercher un membre par compétence, métier, secteur, commune, niveau.
- [Espace emploi](emploi.html) : offres d'emploi, CVthèque, candidature spontanée, proposer une offre.
- [Projets](accompagnement.html) : demander un accompagnement pour un projet (juridique, financement, stratégie, technique…).
- [Opportunités](opportunites.html) : besoins exprimés par les membres auxquels on peut répondre.
- [Mise en relation](connexion.html) : trouver les profils compatibles avec un besoin.
- [Inscrire mon profil](rejoindre.html) : rejoindre l'annuaire.
- [Créer mon CV](cv.html) : générateur de CV gratuit (PDF et Word).

Règles :
- Réponds en français, chaleureusement et brièvement : 120 mots au plus, texte simple, sans titres ni listes à puces Markdown.
- Tu n'as pas accès aux profils individuels ni aux coordonnées des membres. N'invente jamais de nom, de numéro, d'adresse ou de chiffre : oriente vers l'annuaire ou le secrétariat MISI.
- Les coordonnées des membres sont confidentielles : une mise en relation passe par le secrétariat MISI.
- Pour une question sans rapport avec l'annuaire, la vie professionnelle ou la communauté, réponds en une phrase puis ramène vers ce que le site permet.`;

/** Garde uniquement les chiffres et listes courtes envoyés par le site. */
function contexteSur(c) {
  if (!c || typeof c !== "object") return "";
  const nombres = ["membres", "secteurs", "metiers", "candidats", "opportunites"]
    .filter((k) => Number.isFinite(c[k]))
    .map((k) => `${k} : ${c[k]}`);
  const listes = ["topSecteurs", "topMetiers", "topCommunes"]
    .filter((k) => Array.isArray(c[k]))
    .map((k) => `${k} : ${c[k].slice(0, 15).map((x) => texte(x, 80)).join(", ")}`);
  return [...nombres, ...listes].join("\n");
}

/** Historique du navigateur → messages valides pour l'API, bornés. */
function messagesSurs(historique, question) {
  const messages = (Array.isArray(historique) ? historique : [])
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-12)
    .map((m) => ({ role: m.role, content: texte(m.content, 2000) }));
  while (messages.length && messages[0].role !== "user") messages.shift();
  // Le site ajoute déjà la question à l'historique avant l'appel.
  const derniere = messages.at(-1);
  if (!derniere || derniere.role !== "user" || derniere.content !== question) messages.push({ role: "user", content: question });
  return messages;
}

export default async function handler(req, res) {
  if (!exigerPost(req, res)) return;
  if (!iaConfiguree()) return repondre(res, 501, { erreur: "Assistant IA non configuré sur ce déploiement." });
  if (!origineAutorisee(req, res)) return;

  const corps = corpsJson(req);
  const question = texte(corps.question, 1000).trim();
  if (!question) return repondre(res, 400, { erreur: "Question vide." });
  // Sonde envoyée à l'ouverture du chatbot : on ne consomme rien.
  if (question === "ping") return repondre(res, 200, { texte: "pong" });

  if (!limiter(req, res, { cle: "chat", max: 20, fenetreMs: 10 * 60e3 })) return;

  const messages = messagesSurs(corps.historique, question);
  const contexte = contexteSur(corps.contexte);
  if (contexte) {
    const derniere = messages.at(-1);
    derniere.content = [
      { type: "text", text: `Chiffres actuels de l'annuaire (fournis par le site) :\n${contexte}` },
      { type: "text", text: derniere.content },
    ];
  }

  const { statut, corps: sortie } = await demanderAClaude({ system: SYSTEME, messages, maxTokens: 2048 });
  repondre(res, statut, sortie);
}
