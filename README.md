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
| `admin/` | **Application d’administration** (connexion, gestion, réponses, référentiels) |
| `api/` | Fonctions Vercel : assistant Apex IA (`chat`), aide à la rédaction du CV (`ia`), envoi des formulaires par e-mail (`inscription`) |
| `package.json` | Dépendance des fonctions (`@anthropic-ai/sdk`) |
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
| `config` | Admin (Paramètres, Référentiels) | lit `config/referentiels` | tout |
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
- **Référentiels** : secteurs (et leur icône), métiers par secteur, besoins, apports, tranches d’âge, centres d’intérêt, familles d’église. Une entrée par ligne. **Renommer une valeur** met aussi à jour tous les profils et offres qui la portent. Le formulaire d’inscription, les filtres et l’annuaire suivent automatiquement.
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

## Fonctions Vercel (`api/`)

Reconstruites d’après ce que le site leur envoie (le code d’origine n’était pas public). Même contrat, mêmes réponses `405`/`501` que la production : tant qu’une fonction n’est pas configurée, le site masque la fonctionnalité ou bascule sur WhatsApp, e-mail ou copie.

| Fonction | Rôle | Variables d’environnement (Vercel › Settings › Environment Variables) |
|---|---|---|
| `/api/chat` | Questions libres posées à l’assistant Apex IA | `ANTHROPIC_API_KEY` |
| `/api/ia` | « Améliorer la formulation » sur la page CV | `ANTHROPIC_API_KEY` |
| `/api/inscription` | Envoi par e-mail des formulaires quand Firestore est indisponible | `RESEND_API_KEY`, `MISI_EMAIL_DESTINATAIRE` (une ou plusieurs adresses séparées par des virgules), `MISI_EMAIL_EXPEDITEUR` (ex. `Annuaire MISI <annuaire@votre-domaine>`, domaine vérifié chez Resend) |

Facultatif : `MISI_IA_MODELE` (modèle Claude, par défaut `claude-opus-5-5`), `MISI_ORIGINES` (autres domaines autorisés à appeler les fonctions, séparés par des virgules).

Garde-fous : appels acceptés seulement depuis le site (en-tête `Origin`), limite par adresse IP (20 questions, 30 reformulations, 5 formulaires par 10 minutes et par instance), textes tronqués, pot de miel anti-robots. **Fixez aussi un plafond de dépense dans la console Anthropic** : c’est le seul quota global.

### Relier ce dépôt à Vercel

1. Dans le projet Vercel existant, ouvrir *Settings › Environment Variables* et **noter les variables déjà présentes** : celles de l’ancienne version peuvent porter d’autres noms. Créer celles du tableau ci-dessus.
2. *Settings › Git* : connecter `bystanislas/Misi--icc`, branche `main`. Aucun réglage de build : pas de commande, répertoire racine `./`.
3. Vérifier sur l’URL de prévisualisation : l’assistant répond, « Améliorer la formulation » apparaît sur la page CV, `/admin/` s’ouvre.

## Points d’attention

- Les sources de build (`scripts/build-data.mjs`, configuration Tailwind) ne sont pas dans le dépôt : `assets/app.css` est le CSS compilé de production. Ne pas ajouter de classes Tailwind absentes de ce fichier dans les pages publiques ; l’admin a sa propre feuille `admin/admin.css`.
- `data/membres.json` reste le repli quand Firestore est vide ou injoignable : le régénérer de temps en temps depuis l’admin (**Membres › Exporter membres.json**) et le commiter.
- Les correspondances de l’assistant entre types d’aide et secteurs (`assets/js/chatbot.js`, `accompagnement.js`) citent les noms de secteurs : après un renommage de secteur, les mettre à jour à la main.
