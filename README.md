# Annuaire des compétences — ICC Riviera 2 · MISI

Site public : <https://misi-icc.vercel.app> · Administration : `/admin/`

Site statique (HTML + JS vanilla + Tailwind compilé), données dans **Firebase Firestore** (projet `misi-icc`), avec repli sur les fichiers `data/*.json`.

## Structure

| Chemin | Rôle |
|---|---|
| `*.html`, `assets/` | Site public (instantané de la production) |
| `assets/js/firebase-config.js` | Configuration web Firebase (publique par conception) |
| `assets/js/firebase.js` | Accès Firestore du site public (lecture membres/offres, dépôts de formulaires) |
| `data/membres.json` | Référentiels + membres. Repli quand Firestore est vide ou injoignable |
| `data/offres.json` | Repli des offres d’emploi |
| `admin/` | **Application d’administration** (connexion, gestion, réponses) |
| `firestore.rules` | Règles de sécurité : c’est ce fichier qui protège les données |
| `firebase.json`, `.firebaserc` | Déploiement des règles avec la CLI Firebase |

## Collections Firestore

| Collection | Alimentée par | Public | Admin |
|---|---|---|---|
| `membres` | Admin (import, création, validation d’inscription) | lit les `publie == true` | tout |
| `offres` | Admin | lit les `publie == true` | tout |
| `inscriptions` | Page *Rejoindre* | dépôt seul | lire, valider, répondre, supprimer |
| `accompagnements` | Page *Projets* | dépôt seul | idem |
| `demandes` | Assistant Apex IA | dépôt seul | idem |
| `candidatures` | Page *Emploi* (candidature spontanée) | dépôt seul | idem |
| `offres_proposees` | Page *Emploi* (proposer une offre) | dépôt seul | idem + « Publier comme offre » |
| `admins` | Admin / console | — | gestion des accès |
| `config` | Admin (écran Paramètres) | — | tout |
| `mail` | Admin (envoi direct) → extension *Trigger Email* | — | dépôt et suivi de délivrance |

Les coordonnées (e-mail, téléphone) restent dans les dépôts : elles ne sont **jamais** copiées dans `membres`, qui est lisible publiquement.

## Mise en service de l’administration (une seule fois)

1. **Activer la connexion** : console Firebase › *Authentication* › *Sign-in method* › activer **E-mail/Mot de passe**.
2. **Créer votre compte** : *Authentication* › *Users* › *Add user* (e-mail + mot de passe). Copier l’**UID** affiché.
3. **Vous déclarer administrateur** : *Firestore Database* › *Démarrer une collection* `admins` › ID du document = **votre UID** › un champ `email` (texte) avec votre adresse.
4. **Déployer les règles** :
   ```bash
   npx firebase-tools login
   npx firebase-tools deploy --only firestore:rules
   ```
5. Ouvrir `https://<site>/admin/`, se connecter, puis **Tableau de bord › Importer les 52 profils**.
   Tant que `membres` est vide, le site affiche `data/membres.json` ; dès le premier profil en base, il affiche Firestore. D’où l’import en premier.

Les administrateurs suivants s’ajoutent depuis l’écran **Administrateurs** (création du compte incluse).

## Ce que permet l’administration

- **Tableau de bord** : compteurs, file « à traiter », mises à jour en temps réel.
- **Membres** : rechercher, créer, modifier, masquer/publier, supprimer ; import du fichier statique ; export d’un `membres.json` à jour (repli statique).
- **Inscriptions** : fiche complète, *Valider → créer le profil* (pré-rempli, inscription liée), refuser, notes internes.
- **Accompagnements, demandes Apex IA, candidatures, offres proposées** : statut, notes, suppression.
- **Répondre** : modèles de message personnalisés, envoi par e-mail (`mailto:`) ou WhatsApp (`wa.me`, indicatif +225 par défaut) ; chaque réponse est consignée (date, canal, auteur) et le statut avance.
- **Envoi direct des e-mails** (facultatif) : le message part du serveur sans ouvrir de messagerie, et son état (*en attente*, *délivré*, *échec*) s’affiche dans l’historique et dans le journal de l’écran **Paramètres**. Voir ci-dessous.
- **Paramètres** : activation de l’envoi direct, adresse de réponse (Reply-To), signature des messages.
- **Offres d’emploi** : création, édition, date d’expiration, brouillon/en ligne. La page *Emploi* les lit dans Firestore.

## Envoi direct des e-mails (facultatif)

Sans code serveur : l’admin dépose le message dans la collection `mail`, l’extension officielle Firebase l’envoie en SMTP et y inscrit le résultat (`delivery.state`).

1. Passer le projet au forfait **Blaze** (paiement à l’usage ; le volume d’un secrétariat reste dans la gratuité des fonctions).
2. Console Firebase › *Extensions* › installer **Trigger Email from Firestore** (`firebase/firestore-send-email`) :
   - *Email documents collection* : `mail`
   - *SMTP connection URI* : par ex. Resend `smtps://resend:<CLÉ_API>@smtp.resend.com:465`, ou Gmail `smtps://<adresse>:<mot-de-passe-application>@smtp.gmail.com:465`
   - *Default FROM address* : l’expéditeur, par ex. `Secrétariat MISI <secretariat@votre-domaine>` (domaine vérifié chez le fournisseur)
3. Dans l’admin › **Paramètres** : cocher « Envoyer les e-mails directement », renseigner le Reply-To, enregistrer.

Le bouton **Envoyer l’e-mail** apparaît alors dans « Répondre » ; « Ouvrir dans ma messagerie » et WhatsApp restent disponibles. Si l’extension manque ou est mal configurée, l’écran Paramètres le signale (e-mails non pris en charge après 10 minutes).

## Développement local

```bash
python3 -m http.server 8000   # puis http://localhost:8000/ et /admin/
```

## Points d’attention

- **Fonctions serverless absentes du dépôt.** La production expose `/api/chat`, `/api/ia` et `/api/inscription` (Apex IA, e-mail Resend), dont le code n’est pas public et n’a donc pas pu être récupéré. **Ne pas relier ce dépôt au projet Vercel actuel** avant d’y avoir ajouté le dossier `api/` d’origine, sinon ces fonctions disparaîtraient au prochain déploiement.
- Les sources de build (`scripts/build-data.mjs`, configuration Tailwind) ne sont pas non plus dans le dépôt : `assets/app.css` est le CSS compilé de production. L’admin a donc sa propre feuille `admin/admin.css`.
- Les référentiels (secteurs, métiers, besoins…) restent dans `data/membres.json`.
