// Firestore-based helper functions to replace IndexedDB logic
// This script defines a global dbHelperFs object and overrides the existing dbHelper.
// All existing calls to dbHelper will transparently use Firestore collections
// instead of IndexedDB object stores. Each store corresponds to a Firestore
// collection, and documents are keyed by their `id` property.

(function () {
  /**
   * Get a reference to a Firestore collection by name.
   * @param {string} storeName
   * @returns {firebase.firestore.CollectionReference}
   */
  function getCollection(storeName) {
    return window.db.collection(storeName);
  }

  window.dbHelperFs = {
    /**
     * Initialise the helper. This function is kept for API parity but does
     * nothing because Firestore does not require explicit initialisation beyond
     * firebase.initializeApp().
     * @returns {Promise<void>}
     */
    async init() {
      return Promise.resolve();
    },

    /**
     * Get a single document by key from the specified collection.
     * @param {string} storeName
     * @param {string|number} key
     * @returns {Promise<object|null>}
     */
    async get(storeName, key) {
      const docRef = getCollection(storeName).doc(String(key));
      const docSnap = await docRef.get();
      return docSnap.exists ? docSnap.data() : null;
    },

    /**
     * Get all documents from the specified collection.
     * @param {string} storeName
     * @returns {Promise<Array<object>>}
     */
    async getAll(storeName) {
      const snapshot = await getCollection(storeName).get();
      return snapshot.docs.map(doc => doc.data());
    },

    /**
     * Put (create or update) a document in the specified collection.
     * The value must include an `id` property used as the document ID.
     * @param {string} storeName
     * @param {object} value
     * @returns {Promise<string>} The ID of the document saved.
     */
    async put(storeName, value) {
      if (!value || (!value.id && !value.key)) {
        throw new Error('value must include an `id` or `key` property');
      }
      const id = String(value.id || value.key);
      await getCollection(storeName).doc(id).set(value);
      return id;
    },

    /**
     * Delete a document by key from the specified collection.
     * @param {string} storeName
     * @param {string|number} key
     */
    async delete(storeName, key) {
      await getCollection(storeName).doc(String(key)).delete();
    },

    /**
     * Clear (delete) all documents from the specified collection.
     * @param {string} storeName
     */
    async clear(storeName) {
      const snapshot = await getCollection(storeName).get();
      const batch = window.db.batch();
      snapshot.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
    }
  };

  // Override the existing dbHelper (IndexedDB-based) with our Firestore implementation.
  // This assumes that dbHelper is defined in the page; if not, this assignment
  // simply defines dbHelper for the first time.
  window.dbHelper = window.dbHelperFs;
})();
