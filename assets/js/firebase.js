/* ==================================================================
 * Accès Firestore — chargé à la demande.
 *
 * Le SDK Firebase (~300 Ko) n'est téléchargé que si la configuration est
 * remplie ET qu'une opération le nécessite. Sans Firebase, le site
 * continue de fonctionner sur le fichier statique : aucune page ne casse.
 * ================================================================== */

const FB = {
  _sdk: null,

  /** Charge le SDK modulaire une seule fois. */
  async _charger() {
    if (this._sdk) return this._sdk;
    const base = "https://www.gstatic.com/firebasejs/10.14.1";
    const [app, store] = await Promise.all([
      import(`${base}/firebase-app.js`),
      import(`${base}/firebase-firestore.js`),
    ]);
    const instance = app.getApps?.().length ? app.getApp() : app.initializeApp(FIREBASE);
    this._sdk = { ...store, db: store.getFirestore(instance) };
    return this._sdk;
  },

  /**
   * Lit les membres publiés.
   * Renvoie null si Firestore est indisponible ou vide — l'appelant
   * retombe alors sur data/membres.json.
   */
  /** Coupe-circuit : une fois Firestore constaté injoignable, on n'y revient
   *  plus avant le prochain onglet. Évite de télécharger 300 Ko de SDK et
   *  d'attendre un échec à chaque page. */
  _horsService() {
    try {
      return sessionStorage.getItem("misi-firestore-ko") === "1";
    } catch {
      return false;
    }
  },
  _marquerHorsService() {
    try {
      sessionStorage.setItem("misi-firestore-ko", "1");
    } catch {
      /* navigation privée : on retentera, sans conséquence */
    }
  },

  async chargerMembres() {
    if (!firebaseActif() || this._horsService()) return null;
    try {
      // Plafond de patience : au-delà, le fichier statique prend le relais.
      const lecture = (async () => {
        const { db, collection, getDocs, query, where } = await this._charger();
        const q = query(collection(db, FIREBASE_COLLECTIONS.membres), where("publie", "==", true));
        const snap = await getDocs(q);
        return snap.empty ? null : snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      })();

      const limite = new Promise((_, rejeter) =>
        setTimeout(() => rejeter(new Error("délai dépassé")), 2500),
      );

      const membres = await Promise.race([lecture, limite]);
      if (!membres) this._marquerHorsService(); // base vide : inutile d'insister
      return membres;
    } catch (e) {
      this._marquerHorsService();
      console.warn("Firestore indisponible, repli sur le fichier statique.", e.message);
      return null;
    }
  },

  /**
   * Enregistre une inscription.
   * Les règles Firestore n'autorisent que la création : personne ne peut
   * relire les coordonnées depuis le navigateur.
   */
  async enregistrerInscription(donnees) {
    if (!firebaseActif()) return false;
    const { db, collection, addDoc, serverTimestamp } = await this._charger();
    await addDoc(collection(db, FIREBASE_COLLECTIONS.inscriptions), {
      ...donnees,
      statut: "a_valider",
      creeLe: serverTimestamp(),
    });
    return true;
  },

  /**
   * Coordonnées laissées dans l'assistant Apex IA.
   * Même règle que les inscriptions : on dépose, on ne relit pas.
   */
  async enregistrerDemande(donnees) {
    if (!firebaseActif()) return false;
    const { db, collection, addDoc, serverTimestamp } = await this._charger();
    await addDoc(collection(db, "demandes"), { ...donnees, creeLe: serverTimestamp() });
    return true;
  },

  /**
   * Offres d'emploi publiées depuis l'administration.
   * Renvoie null si Firestore est indisponible ou vide — la page retombe
   * alors sur data/offres.json. Pas de coupe-circuit ici : il est posé par
   * chargerMembres quand la collection membres est vide, ce qui ne dit rien
   * des offres.
   */
  async chargerOffres() {
    if (!firebaseActif()) return null;
    try {
      const lecture = (async () => {
        const { db, collection, getDocs, query, where } = await this._charger();
        const snap = await getDocs(query(collection(db, "offres"), where("publie", "==", true)));
        return snap.empty ? null : snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      })();
      const limite = new Promise((_, rejeter) =>
        setTimeout(() => rejeter(new Error("délai dépassé")), 2500),
      );
      return await Promise.race([lecture, limite]);
    } catch (e) {
      console.warn("Offres Firestore indisponibles, repli sur le fichier statique.", e.message);
      return null;
    }
  },

  /** Candidature spontanée ou offre proposée (page « Emploi »). */
  async enregistrerEmploi(nomCollection, donnees) {
    if (!firebaseActif()) return false;
    const { db, collection, addDoc, serverTimestamp } = await this._charger();
    await addDoc(collection(db, nomCollection), {
      ...donnees,
      statut: "a_traiter",
      creeLe: serverTimestamp(),
    });
    return true;
  },

  /** Demande d'accompagnement de projet (page « Projets »). */
  async enregistrerAccompagnement(donnees) {
    if (!firebaseActif()) return false;
    const { db, collection, addDoc, serverTimestamp } = await this._charger();
    await addDoc(collection(db, "accompagnements"), {
      ...donnees,
      statut: "a_traiter",
      creeLe: serverTimestamp(),
    });
    return true;
  },
};
