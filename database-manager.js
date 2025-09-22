// Sistema de Gerenciamento de Banco de Dados - JurisControl
// Integração com Firebase Firestore para sincronização entre dispositivos

import { 
  collection, 
  doc, 
  getDocs, 
  getDoc,
  setDoc, 
  addDoc,
  updateDoc,
  deleteDoc, 
  onSnapshot,
  query,
  where,
  orderBy,
  serverTimestamp,
  enableNetwork,
  disableNetwork
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

import { db } from './firebase.js';

class DatabaseManager {
  constructor() {
    this.isOnline = navigator.onLine;
    this.syncQueue = [];
    this.listeners = new Map();
    this.lastSyncTime = localStorage.getItem('lastSyncTime') || 0;
    
    // Monitorar status de conexão
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());
    
    console.log('🗄️ DatabaseManager inicializado');
  }

  // ===== MÉTODOS DE CONEXÃO =====
  
  async handleOnline() {
    this.isOnline = true;
    console.log('🌐 Conexão restaurada - iniciando sincronização');
    await this.syncPendingChanges();
    await this.syncFromCloud();
  }

  handleOffline() {
    this.isOnline = false;
    console.log('📴 Modo offline ativado');
  }

  // ===== MÉTODOS DE SINCRONIZAÇÃO =====

  async syncPendingChanges() {
    if (!this.isOnline || this.syncQueue.length === 0) return;

    console.log(`🔄 Sincronizando ${this.syncQueue.length} alterações pendentes`);
    
    const failedOperations = [];
    
    for (const operation of this.syncQueue) {
      try {
        await this.executeCloudOperation(operation);
        console.log('✅ Operação sincronizada:', operation.type, operation.collection);
      } catch (error) {
        console.error('❌ Falha na sincronização:', error);
        failedOperations.push(operation);
      }
    }
    
    // Manter apenas operações que falharam
    this.syncQueue = failedOperations;
    this.saveSyncQueue();
  }

  async syncFromCloud() {
    if (!this.isOnline) return;

    try {
      console.log('⬇️ Sincronizando dados da nuvem...');
      
      // Sincronizar cada coleção
      const collections = ['processos', 'calendario', 'documentos', 'users', 'config'];
      
      for (const collectionName of collections) {
        await this.syncCollection(collectionName);
      }
      
      this.lastSyncTime = Date.now();
      localStorage.setItem('lastSyncTime', this.lastSyncTime.toString());
      
      console.log('✅ Sincronização completa');
      this.showSyncNotification('Dados sincronizados com sucesso!', 'success');
      
    } catch (error) {
      console.error('❌ Erro na sincronização:', error);
      this.showSyncNotification('Erro na sincronização. Tentando novamente...', 'warning');
    }
  }

  async syncCollection(collectionName) {
    try {
      const cloudQuery = query(
        collection(db, collectionName),
        orderBy('updatedAt', 'desc')
      );
      
      const snapshot = await getDocs(cloudQuery);
      const cloudData = [];
      
      snapshot.forEach(doc => {
        cloudData.push({
          id: doc.id,
          ...doc.data()
        });
      });

      // Atualizar dados locais
      if (cloudData.length > 0) {
        await this.updateLocalData(collectionName, cloudData);
        console.log(`📥 ${collectionName}: ${cloudData.length} registros sincronizados`);
      }
      
    } catch (error) {
      console.error(`Erro ao sincronizar ${collectionName}:`, error);
    }
  }

  // ===== MÉTODOS DE DADOS =====

  async saveData(collectionName, data, id = null) {
    const timestamp = new Date().toISOString();
    const dataWithTimestamp = {
      ...data,
      updatedAt: timestamp,
      createdAt: data.createdAt || timestamp
    };

    // Salvar localmente primeiro
    await this.saveLocalData(collectionName, dataWithTimestamp, id);

    // Tentar salvar na nuvem
    if (this.isOnline) {
      try {
        await this.saveCloudData(collectionName, dataWithTimestamp, id);
        console.log(`☁️ ${collectionName} salvo na nuvem:`, id || 'novo');
      } catch (error) {
        console.error('Erro ao salvar na nuvem:', error);
        this.addToSyncQueue('save', collectionName, dataWithTimestamp, id);
      }
    } else {
      this.addToSyncQueue('save', collectionName, dataWithTimestamp, id);
    }

    return dataWithTimestamp;
  }

  async loadData(collectionName, id = null) {
    // Tentar carregar da nuvem primeiro se online
    if (this.isOnline) {
      try {
        const cloudData = await this.loadCloudData(collectionName, id);
        if (cloudData) {
          // Atualizar cache local
          await this.saveLocalData(collectionName, cloudData, id);
          return cloudData;
        }
      } catch (error) {
        console.error('Erro ao carregar da nuvem:', error);
      }
    }

    // Fallback para dados locais
    return await this.loadLocalData(collectionName, id);
  }

  async deleteData(collectionName, id) {
    // Deletar localmente
    await this.deleteLocalData(collectionName, id);

    // Tentar deletar na nuvem
    if (this.isOnline) {
      try {
        await this.deleteCloudData(collectionName, id);
        console.log(`🗑️ ${collectionName} deletado da nuvem:`, id);
      } catch (error) {
        console.error('Erro ao deletar da nuvem:', error);
        this.addToSyncQueue('delete', collectionName, null, id);
      }
    } else {
      this.addToSyncQueue('delete', collectionName, null, id);
    }
  }

  // ===== MÉTODOS LOCAIS (IndexedDB) =====

  async saveLocalData(collectionName, data, id) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('JurisControlDB_v1', 1);
      
      request.onsuccess = (event) => {
        const db = event.target.result;
        const transaction = db.transaction([collectionName], 'readwrite');
        const store = transaction.objectStore(collectionName);
        
        if (id) {
          data.id = id;
          store.put(data);
        } else {
          store.add(data);
        }
        
        transaction.oncomplete = () => resolve(data);
        transaction.onerror = () => reject(transaction.error);
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  async loadLocalData(collectionName, id) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('JurisControlDB_v1', 1);
      
      request.onsuccess = (event) => {
        const db = event.target.result;
        const transaction = db.transaction([collectionName], 'readonly');
        const store = transaction.objectStore(collectionName);
        
        if (id) {
          const getRequest = store.get(id);
          getRequest.onsuccess = () => resolve(getRequest.result);
          getRequest.onerror = () => reject(getRequest.error);
        } else {
          const getAllRequest = store.getAll();
          getAllRequest.onsuccess = () => resolve(getAllRequest.result);
          getAllRequest.onerror = () => reject(getAllRequest.error);
        }
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  async deleteLocalData(collectionName, id) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('JurisControlDB_v1', 1);
      
      request.onsuccess = (event) => {
        const db = event.target.result;
        const transaction = db.transaction([collectionName], 'readwrite');
        const store = transaction.objectStore(collectionName);
        
        const deleteRequest = store.delete(id);
        deleteRequest.onsuccess = () => resolve();
        deleteRequest.onerror = () => reject(deleteRequest.error);
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  async updateLocalData(collectionName, cloudData) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('JurisControlDB_v1', 1);
      
      request.onsuccess = (event) => {
        const db = event.target.result;
        const transaction = db.transaction([collectionName], 'readwrite');
        const store = transaction.objectStore(collectionName);
        
        // Limpar dados antigos
        store.clear();
        
        // Adicionar dados da nuvem
        cloudData.forEach(item => {
          store.add(item);
        });
        
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  // ===== MÉTODOS DA NUVEM (Firebase) =====

  async saveCloudData(collectionName, data, id) {
    const collectionRef = collection(db, collectionName);
    
    if (id) {
      const docRef = doc(collectionRef, id);
      await setDoc(docRef, {
        ...data,
        updatedAt: serverTimestamp()
      }, { merge: true });
      return id;
    } else {
      const docRef = await addDoc(collectionRef, {
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      return docRef.id;
    }
  }

  async loadCloudData(collectionName, id) {
    if (id) {
      const docRef = doc(db, collectionName, id);
      const docSnap = await getDoc(docRef);
      return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
    } else {
      const querySnapshot = await getDocs(collection(db, collectionName));
      const data = [];
      querySnapshot.forEach(doc => {
        data.push({ id: doc.id, ...doc.data() });
      });
      return data;
    }
  }

  async deleteCloudData(collectionName, id) {
    const docRef = doc(db, collectionName, id);
    await deleteDoc(docRef);
  }

  async executeCloudOperation(operation) {
    switch (operation.type) {
      case 'save':
        return await this.saveCloudData(operation.collection, operation.data, operation.id);
      case 'delete':
        return await this.deleteCloudData(operation.collection, operation.id);
      default:
        throw new Error(`Operação desconhecida: ${operation.type}`);
    }
  }

  // ===== MÉTODOS DE FILA DE SINCRONIZAÇÃO =====

  addToSyncQueue(type, collection, data, id) {
    const operation = {
      type,
      collection,
      data,
      id,
      timestamp: Date.now()
    };
    
    this.syncQueue.push(operation);
    this.saveSyncQueue();
    
    console.log(`📝 Operação adicionada à fila: ${type} ${collection}`);
  }

  saveSyncQueue() {
    localStorage.setItem('syncQueue', JSON.stringify(this.syncQueue));
  }

  loadSyncQueue() {
    const saved = localStorage.getItem('syncQueue');
    this.syncQueue = saved ? JSON.parse(saved) : [];
  }

  // ===== MÉTODOS DE NOTIFICAÇÃO =====

  showSyncNotification(message, type = 'info') {
    // Usar o sistema de toast existente se disponível
    if (window.showToast) {
      window.showToast(message, type);
    } else {
      console.log(`🔔 ${message}`);
    }
  }

  // ===== MÉTODOS DE MONITORAMENTO =====

  setupRealtimeListener(collectionName, callback) {
    if (!this.isOnline) return;

    try {
      const q = query(collection(db, collectionName), orderBy('updatedAt', 'desc'));
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const changes = [];
        snapshot.docChanges().forEach((change) => {
          changes.push({
            type: change.type,
            id: change.doc.id,
            data: change.doc.data()
          });
        });
        
        if (changes.length > 0) {
          console.log(`🔄 Mudanças em tempo real em ${collectionName}:`, changes);
          callback(changes);
        }
      });

      this.listeners.set(collectionName, unsubscribe);
      console.log(`👂 Listener em tempo real ativo para ${collectionName}`);
      
    } catch (error) {
      console.error(`Erro ao configurar listener para ${collectionName}:`, error);
    }
  }

  removeRealtimeListener(collectionName) {
    const unsubscribe = this.listeners.get(collectionName);
    if (unsubscribe) {
      unsubscribe();
      this.listeners.delete(collectionName);
      console.log(`🔇 Listener removido para ${collectionName}`);
    }
  }

  // ===== MÉTODOS DE INICIALIZAÇÃO =====

  async initialize() {
    console.log('🚀 Inicializando DatabaseManager...');
    
    // Carregar fila de sincronização
    this.loadSyncQueue();
    
    // Tentar sincronização inicial se online
    if (this.isOnline) {
      await this.syncFromCloud();
      await this.syncPendingChanges();
    }
    
    console.log('✅ DatabaseManager pronto!');
  }

  // ===== MÉTODOS DE STATUS =====

  getStatus() {
    return {
      isOnline: this.isOnline,
      pendingSync: this.syncQueue.length,
      lastSync: new Date(parseInt(this.lastSyncTime)).toLocaleString('pt-BR'),
      activeListeners: this.listeners.size
    };
  }
}

// Instância global
const databaseManager = new DatabaseManager();

// Inicializar quando o DOM estiver pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => databaseManager.initialize());
} else {
  databaseManager.initialize();
}

// Exportar para uso global
window.databaseManager = databaseManager;

export default databaseManager;
