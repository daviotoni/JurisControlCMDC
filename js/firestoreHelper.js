// js/firestoreHelper.js
// Helper completo para Firestore e Firebase Storage
// Inclui:
//   1. window.dbHelper / window.dbHelperFs — compatibilidade com IndexedDB (substitui IndexedDB por Firestore)
//   2. window.firestoreHelper — CRUD avançado com filtros, ordenação, escuta em tempo real
//   3. Helpers de Storage — upload, download URL, exclusão de arquivos
//
// Deve ser carregado APÓS firebase-firestore-compat.js e firebase-storage-compat.js
// e ANTES de js/firebase.js

// ============================================
// PARTE 1 — dbHelper (compatibilidade IndexedDB → Firestore)
// Substitui o dbHelper baseado em IndexedDB de forma transparente.
// Todas as chamadas existentes a dbHelper.get/put/delete/clear/getAll
// passam a usar o Firestore automaticamente.
// ============================================
(function () {
  function getCollection(storeName) {
    return window.db.collection(storeName);
  }

  window.dbHelperFs = {
    /** Inicialização — mantida por compatibilidade de API, não faz nada. */
    async init() {
      return Promise.resolve();
    },

    /** Busca um documento pelo ID (chave). */
    async get(storeName, key) {
      const docRef = getCollection(storeName).doc(String(key));
      const docSnap = await docRef.get();
      return docSnap.exists ? docSnap.data() : null;
    },

    /** Retorna todos os documentos da coleção. */
    async getAll(storeName) {
      const snapshot = await getCollection(storeName).get();
      return snapshot.docs.map(doc => doc.data());
    },

    /**
     * Cria ou atualiza um documento.
     * O objeto deve ter a propriedade `id` ou `key`.
     */
    async put(storeName, value) {
      if (!value || (!value.id && !value.key)) {
        throw new Error('O objeto deve ter a propriedade `id` ou `key`.');
      }
      const id = String(value.id || value.key);
      await getCollection(storeName).doc(id).set(value);
      return id;
    },

    /** Remove um documento pelo ID. */
    async delete(storeName, key) {
      await getCollection(storeName).doc(String(key)).delete();
    },

    /** Remove todos os documentos da coleção. */
    async clear(storeName) {
      const snapshot = await getCollection(storeName).get();
      const batch = window.db.batch();
      snapshot.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
    }
  };

  // Substitui o dbHelper (IndexedDB) pelo Firestore de forma transparente
  window.dbHelper = window.dbHelperFs;

  console.log("✅ dbHelper → Firestore (compatibilidade IndexedDB ativada)");
})();


// ============================================
// PARTE 2 — firestoreHelper (CRUD avançado)
// API de alto nível para operações no Firestore e Storage.
// ============================================
window.firestoreHelper = (function () {

  function _db() {
    if (!window.db) throw new Error('Firestore não inicializado. Verifique a ordem dos scripts.');
    return window.db;
  }

  function _storage() {
    if (!window.storage) throw new Error('Storage não inicializado. Verifique a ordem dos scripts.');
    return window.storage;
  }

  // ---------- FIRESTORE ----------

  /** Retorna todos os documentos de uma coleção. */
  async function listar(colecao) {
    try {
      const snapshot = await _db().collection(colecao).get();
      return snapshot.docs.map(doc => ({ _id: doc.id, ...doc.data() }));
    } catch (err) {
      console.error(`❌ firestoreHelper.listar(${colecao}):`, err);
      throw err;
    }
  }

  /** Retorna um único documento pelo ID. */
  async function buscarPorId(colecao, id) {
    try {
      const doc = await _db().collection(colecao).doc(id).get();
      if (!doc.exists) return null;
      return { _id: doc.id, ...doc.data() };
    } catch (err) {
      console.error(`❌ firestoreHelper.buscarPorId(${colecao}, ${id}):`, err);
      throw err;
    }
  }

  /**
   * Busca documentos com filtros e ordenação.
   * @param {string} colecao
   * @param {Array}  filtros  Ex: [['status','==','Pendente']]
   * @param {string} [ordenarPor]
   * @param {string} [direcao]  'asc' | 'desc'
   */
  async function buscar(colecao, filtros = [], ordenarPor = null, direcao = 'asc') {
    try {
      let query = _db().collection(colecao);
      for (const [campo, op, valor] of filtros) {
        query = query.where(campo, op, valor);
      }
      if (ordenarPor) query = query.orderBy(ordenarPor, direcao);
      const snapshot = await query.get();
      return snapshot.docs.map(doc => ({ _id: doc.id, ...doc.data() }));
    } catch (err) {
      console.error(`❌ firestoreHelper.buscar(${colecao}):`, err);
      throw err;
    }
  }

  /** Adiciona um novo documento (ID automático). Retorna o ID gerado. */
  async function adicionar(colecao, dados) {
    try {
      const agora = firebase.firestore.FieldValue.serverTimestamp();
      const docRef = await _db().collection(colecao).add({
        ...dados,
        criadoEm: agora,
        atualizadoEm: agora
      });
      console.log(`✅ firestoreHelper.adicionar(${colecao}): ID=${docRef.id}`);
      return docRef.id;
    } catch (err) {
      console.error(`❌ firestoreHelper.adicionar(${colecao}):`, err);
      throw err;
    }
  }

  /** Cria ou substitui um documento com ID específico. */
  async function definir(colecao, id, dados) {
    try {
      const agora = firebase.firestore.FieldValue.serverTimestamp();
      await _db().collection(colecao).doc(id).set({ ...dados, atualizadoEm: agora });
      console.log(`✅ firestoreHelper.definir(${colecao}, ${id})`);
    } catch (err) {
      console.error(`❌ firestoreHelper.definir(${colecao}, ${id}):`, err);
      throw err;
    }
  }

  /** Atualiza campos específicos de um documento existente. */
  async function atualizar(colecao, id, dados) {
    try {
      const agora = firebase.firestore.FieldValue.serverTimestamp();
      await _db().collection(colecao).doc(id).update({ ...dados, atualizadoEm: agora });
      console.log(`✅ firestoreHelper.atualizar(${colecao}, ${id})`);
    } catch (err) {
      console.error(`❌ firestoreHelper.atualizar(${colecao}, ${id}):`, err);
      throw err;
    }
  }

  /** Remove um documento da coleção. */
  async function excluir(colecao, id) {
    try {
      await _db().collection(colecao).doc(id).delete();
      console.log(`✅ firestoreHelper.excluir(${colecao}, ${id})`);
    } catch (err) {
      console.error(`❌ firestoreHelper.excluir(${colecao}, ${id}):`, err);
      throw err;
    }
  }

  /**
   * Escuta mudanças em tempo real de uma coleção.
   * Retorna a função de cancelamento (unsubscribe).
   */
  function escutar(colecao, callback, filtros = []) {
    let query = _db().collection(colecao);
    for (const [campo, op, valor] of filtros) {
      query = query.where(campo, op, valor);
    }
    return query.onSnapshot(
      snapshot => callback(snapshot.docs.map(doc => ({ _id: doc.id, ...doc.data() }))),
      err => console.error(`❌ firestoreHelper.escutar(${colecao}):`, err)
    );
  }

  // ---------- STORAGE ----------

  /**
   * Faz upload de um arquivo para o Firebase Storage.
   * @param {File}     arquivo
   * @param {string}   caminho    Ex: 'documentos/2024/contrato.pdf'
   * @param {Function} [progresso]  Callback com percentual 0–100
   * @returns {Promise<string>}  URL pública de download
   */
  async function uploadArquivo(arquivo, caminho, progresso = null) {
    return new Promise((resolve, reject) => {
      const ref  = _storage().ref(caminho);
      const task = ref.put(arquivo);
      task.on('state_changed',
        snapshot => {
          const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          if (progresso) progresso(pct);
        },
        err => { console.error('❌ firestoreHelper.uploadArquivo:', err); reject(err); },
        async () => {
          const url = await task.snapshot.ref.getDownloadURL();
          console.log(`✅ firestoreHelper.uploadArquivo: ${caminho}`);
          resolve(url);
        }
      );
    });
  }

  /** Retorna a URL pública de download de um arquivo no Storage. */
  async function getUrlDownload(caminho) {
    try {
      return await _storage().ref(caminho).getDownloadURL();
    } catch (err) {
      console.error('❌ firestoreHelper.getUrlDownload:', err);
      throw err;
    }
  }

  /** Remove um arquivo do Firebase Storage. */
  async function excluirArquivo(caminho) {
    try {
      await _storage().ref(caminho).delete();
      console.log(`✅ firestoreHelper.excluirArquivo: ${caminho}`);
    } catch (err) {
      console.error('❌ firestoreHelper.excluirArquivo:', err);
      throw err;
    }
  }

  return {
    // Firestore
    listar, buscarPorId, buscar, adicionar, definir, atualizar, excluir, escutar,
    // Storage
    uploadArquivo, getUrlDownload, excluirArquivo
  };

})();

console.log("✅ firestoreHelper carregado — CRUD Firestore + Storage prontos");
