/* ==================================================================
 * Utilitaires partagés des fonctions Vercel (api/*.js).
 * Le préfixe « _ » empêche Vercel d'exposer ce fichier comme une route.
 *
 * Contrat attendu par le site (assets/js) :
 *  - réponse JSON ; en cas d'erreur { erreur: "message en français" } ;
 *  - 501 quand la fonction n'est pas configurée : le site masque alors
 *    la fonctionnalité ou bascule sur son repli (WhatsApp, e-mail, copie).
 * ================================================================== */

import Anthropic from "@anthropic-ai/sdk";

export function repondre(res, statut, corps) {
  res.statusCode = statut;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(corps));
}

/** Seul POST est accepté, comme sur la version d'origine. */
export function exigerPost(req, res) {
  if (req.method === "POST") return true;
  res.setHeader("Allow", "POST");
  repondre(res, 405, { erreur: "Méthode non autorisée" });
  return false;
}

/**
 * Refuse les appels venant d'un autre site. Un navigateur envoie toujours
 * l'en-tête Origin sur un POST ; MISI_ORIGINES (liste séparée par des
 * virgules) autorise d'autres domaines que celui du déploiement.
 * Ne remplace pas une vraie authentification : freine les abus simples.
 */
export function origineAutorisee(req, res) {
  const origine = req.headers.origin;
  const autorisees = (process.env.MISI_ORIGINES || "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  let ok = false;
  try {
    ok = Boolean(origine) && (new URL(origine).host === req.headers.host || autorisees.includes(origine));
  } catch {
    ok = false;
  }
  if (!ok) repondre(res, 403, { erreur: "Origine non autorisée." });
  return ok;
}

/**
 * Limiteur de débit par adresse IP, en mémoire. Chaque instance Vercel a
 * sa propre mémoire : c'est un garde-fou contre les rafales, pas un quota
 * global (pour cela, plafonner la dépense dans la console Anthropic).
 */
const compteurs = new Map();
export function limiter(req, res, { cle, max, fenetreMs }) {
  const ip = String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "?").split(",")[0].trim();
  const id = cle + ":" + ip;
  const maintenant = Date.now();
  const c = compteurs.get(id);
  if (!c || maintenant - c.debut > fenetreMs) {
    compteurs.set(id, { debut: maintenant, n: 1 });
    if (compteurs.size > 5000) compteurs.clear(); // borne la mémoire
    return true;
  }
  if (++c.n <= max) return true;
  res.setHeader("Retry-After", String(Math.ceil((c.debut + fenetreMs - maintenant) / 1000)));
  repondre(res, 429, { erreur: "Trop de demandes. Réessayez dans quelques minutes." });
  return false;
}

/** Corps JSON (Vercel le décode déjà quand le Content-Type est correct). */
export function corpsJson(req) {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) return req.body;
  try {
    return JSON.parse(Buffer.isBuffer(req.body) ? req.body.toString("utf8") : req.body || "{}");
  } catch {
    return {};
  }
}

const texte = (v, max) => (typeof v === "string" ? v.slice(0, max) : "");

/* ---------------------------------------------------------------- *
 * Claude (Apex IA)
 * ---------------------------------------------------------------- */
export const iaConfiguree = () => Boolean(process.env.ANTHROPIC_API_KEY);

let client = null;
const claude = () =>
  (client ||= new Anthropic({
    // Réponse attendue en quelques secondes ; au-delà, le site affiche son repli.
    timeout: 25_000,
    maxRetries: 1,
  }));

/**
 * Appelle Claude et renvoie { statut, corps } prêt à être servi.
 * Les refus et erreurs sont traduits en messages pour le visiteur ; le
 * détail technique ne part que dans les journaux Vercel.
 */
export async function demanderAClaude({ system, messages, maxTokens }) {
  try {
    const reponse = await claude().beta.messages.create({
      model: process.env.MISI_IA_MODELE || "claude-opus-5-5",
      max_tokens: maxTokens,
      // Réponses courtes et directes : effort bas, adapté au dialogue.
      output_config: { effort: "low" },
      // Repli côté serveur si un filtre de sécurité décline la demande.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system,
      messages,
    });

    if (reponse.stop_reason === "refusal") {
      return {
        statut: 200,
        corps: {
          texte:
            "Je ne peux pas répondre à cette demande. Pour toute question, le secrétariat MISI reste à votre disposition.",
        },
      };
    }

    const sortie = reponse.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    if (!sortie) return { statut: 502, corps: { erreur: "Réponse vide du moteur." } };
    return { statut: 200, corps: { texte: sortie } };
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError || e instanceof Anthropic.APIConnectionError) {
      console.warn("Claude momentanément indisponible :", e.message);
      return { statut: 503, corps: { erreur: "L’assistant est très sollicité. Réessayez dans un instant." } };
    }
    if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) {
      console.error("Clé ANTHROPIC_API_KEY refusée :", e.message);
      return { statut: 503, corps: { erreur: "Assistant momentanément indisponible." } };
    }
    if (e instanceof Anthropic.APIError) {
      console.error(`Erreur API Claude ${e.status} :`, e.message);
      return { statut: 502, corps: { erreur: "Assistant momentanément indisponible." } };
    }
    console.error("Erreur inattendue :", e);
    return { statut: 500, corps: { erreur: "Erreur interne." } };
  }
}

export { texte };
