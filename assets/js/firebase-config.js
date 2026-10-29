/* ==================================================================
 * Configuration Firebase — Annuaire MISI
 *
 * Ces clés ne sont PAS secrètes : la configuration web Firebase est
 * publique par conception. C'est le fichier `firestore.rules` qui
 * protège réellement les données (voir la racine du dépôt).
 *
 * Comment la remplir :
 *   1. console.firebase.google.com → Créer un projet « annuaire-misi »
 *   2. Build → Firestore Database → Créer une base (mode production,
 *      région europe-west1 ou nam5)
 *   3. Paramètres du projet ⚙️ → Vos applications → Web (</>) →
 *      « Enregistrer l'application »
 *   4. Copier l'objet firebaseConfig affiché et le coller ci-dessous
 *   5. Déployer les règles :  npx firebase deploy --only firestore:rules
 *
 * Tant que `projectId` est vide, le site fonctionne exactement comme
 * aujourd'hui : lecture du fichier statique, et formulaire d'inscription
 * qui bascule sur WhatsApp / e-mail / copie.
 * ================================================================== */

const FIREBASE = {
  apiKey: "AIzaSyBLrNC1R-kYe2euINIRQccnftHigesqKE4",
  authDomain: "misi-icc.firebaseapp.com",
  projectId: "misi-icc",
  storageBucket: "misi-icc.firebasestorage.app",
  messagingSenderId: "43900168104",
  appId: "1:43900168104:web:f27331fa039a2c5dc9df9d",
};

/** Collections utilisées. */
const FIREBASE_COLLECTIONS = {
  membres: "membres", // lecture publique, écriture réservée à l'administration
  inscriptions: "inscriptions", // création publique, lecture réservée à l'administration
};

/** Le site bascule sur Firestore uniquement si la configuration est remplie. */
const firebaseActif = () => Boolean(FIREBASE.projectId && FIREBASE.apiKey);
