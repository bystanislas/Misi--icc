/* ==================================================================
 * POST /api/inscription — transmet un formulaire du site par e-mail
 * au secrétariat (Resend). Repli quand Firestore n'est pas disponible.
 *
 * Appelée par rejoindre.js, accompagnement.js et emploi.js avec le
 * formulaire en application/x-www-form-urlencoded.
 * Sortie : { ok: true }. 501 tant que l'envoi n'est pas configuré : le
 * site propose alors WhatsApp, e-mail ou copie du récapitulatif.
 *
 * Variables : RESEND_API_KEY, MISI_EMAIL_DESTINATAIRE,
 *             MISI_EMAIL_EXPEDITEUR (adresse d'un domaine vérifié chez Resend)
 * ================================================================== */

import { repondre, exigerPost, origineAutorisee, limiter } from "./_commun.js";

const LIBELLES = {
  nom: "Nom", prenom: "Prénom", email: "E-mail", telephone: "Téléphone", contact: "Contact",
  titre: "Titre", entreprise: "Structure / entreprise", poste: "Poste recherché", contrat: "Contrat",
  ville: "Ville", commune: "Commune", quartier: "Quartier", lieu: "Lieu", age: "Tranche d’âge",
  departement: "Département / ministère", famille: "Famille d’église",
  secteurs: "Secteurs", secteur: "Secteur", metiers: "Métiers", metier: "Métier", autre_metier: "Autre métier",
  experience: "Expérience", disponibilite: "Disponibilité", lien_cv: "Lien CV",
  besoins: "Objectifs de connexion", apport: "Peut apporter", interets: "Centres d’intérêt",
  stade: "Stade du projet", description: "Description", blocage: "Blocage principal", aides: "Aides souhaitées",
  formats: "Formats", jours: "Jours", creneaux: "Créneaux", delai: "Délai", message: "Message",
  consentement: "Consentement",
};
const IGNORES = new Set(["bot-field", "form-name"]);

/** Formulaire encodé → { champ: valeur | [valeurs] }, quel que soit le décodage fait par Vercel. */
function lireFormulaire(req) {
  const brut = req.body;
  if (brut && typeof brut === "object" && !Buffer.isBuffer(brut)) return brut;
  const params = new URLSearchParams(Buffer.isBuffer(brut) ? brut.toString("utf8") : brut || "");
  const objet = {};
  for (const [k, v] of params) objet[k] = k in objet ? [].concat(objet[k], v) : v;
  return objet;
}

function typeDeFormulaire(f) {
  if (f["form-name"] === "inscription") return "Nouvelle inscription à l’annuaire";
  if (f.stade || f.aides) return "Demande d’accompagnement de projet";
  if (f.contrat) return "Nouvelle offre d’emploi proposée";
  if (f.poste || f.disponibilite) return "Candidature spontanée";
  return "Nouveau message du site";
}

const uneLigne = (v) => String(v).replace(/[\r\n]+/g, " ").trim();
const emailValide = (v) => typeof v === "string" && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(v) && v.length <= 200;

export default async function handler(req, res) {
  if (!exigerPost(req, res)) return;
  const { RESEND_API_KEY, MISI_EMAIL_DESTINATAIRE, MISI_EMAIL_EXPEDITEUR } = process.env;
  if (!RESEND_API_KEY || !MISI_EMAIL_DESTINATAIRE || !MISI_EMAIL_EXPEDITEUR)
    return repondre(res, 501, { erreur: "Envoi par e-mail non configuré sur ce déploiement." });
  if (!origineAutorisee(req, res)) return;

  const f = lireFormulaire(req);
  // Pot de miel : un robot remplit le champ caché. On fait comme si de rien n'était.
  if (f["bot-field"]) return repondre(res, 200, { ok: true });
  if (!limiter(req, res, { cle: "inscription", max: 5, fenetreMs: 10 * 60e3 })) return;

  const champs = Object.entries(f)
    .filter(([k]) => !IGNORES.has(k))
    .slice(0, 60)
    .map(([k, v]) => [k, [].concat(v).map((x) => String(x).slice(0, 5000)).join(", ").trim()])
    .filter(([, v]) => v);
  if (!champs.some(([k]) => ["nom", "prenom", "email", "telephone", "titre", "contact"].includes(k)))
    return repondre(res, 400, { erreur: "Formulaire incomplet." });

  const sujet = typeDeFormulaire(f);
  const nom = uneLigne([f.prenom, f.nom].flat().filter(Boolean).join(" ") || f.titre || "").slice(0, 80);
  const corps =
    `${sujet} — Annuaire MISI (ICC Riviera 2)\n\n` +
    champs.map(([k, v]) => `${LIBELLES[k] || k} : ${v}`).join("\n") +
    `\n\nReçu le ${new Date().toLocaleString("fr-FR", { timeZone: "Africa/Abidjan" })}.` +
    `\nÀ traiter depuis l’administration du site ou en répondant à cet e-mail.`;

  const envoi = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: MISI_EMAIL_EXPEDITEUR,
      to: MISI_EMAIL_DESTINATAIRE.split(",").map((x) => x.trim()).filter(Boolean),
      subject: nom ? `${sujet} : ${nom}` : sujet,
      text: corps,
      ...(emailValide(f.email) ? { reply_to: f.email } : {}),
    }),
  }).catch((e) => {
    console.error("Resend injoignable :", e.message);
    return null;
  });

  if (!envoi?.ok) {
    if (envoi) console.error(`Resend a refusé l’envoi (${envoi.status}) :`, await envoi.text().catch(() => ""));
    return repondre(res, 502, { erreur: "L’envoi a échoué. Réessayez ou utilisez WhatsApp." });
  }
  repondre(res, 200, { ok: true });
}
