// Sistema de Banco de Dados com Supabase - JurisControl
// Implementação robusta para sincronização de dados entre dispositivos

class SupabaseDatabase {
  constructor() {
    this.isInitialized = false;
    this.isOnline = navigator.onLine;
    this.syncQueue = [];
    this.config = window.SUPABASE_CONFIG || {};
    this.retryAttempts = 0;
    this.maxRetries = 3;
    
    // Configurar listeners de conectividade
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());
    
    console.log('🗄️ SupabaseDatabase inicializado');
  }

  // ===== INICIALIZAÇÃO =====

  async initialize() {
    if (this.isInitialized) return true;

    try {
      console.log('🚀 Inicializando sistema de banco de dados...');
      
      // Inicializar IndexedDB local (sempre disponível)
      await this.initializeLocalDB();
      
      // Tentar conectar com Supabase se disponível
      if (this.config.supabase?.enabled && this.isOnline) {
        await this.initializeSupabase();
      }
      
      // Carregar fila de sincronização
      this.loadSyncQueue();
      
      this.isInitialized = true;
      console.log('✅ Sistema de banco de dados pronto!');
      
      return true;
      
    } catch (error) {
      console.error('❌ Erro na inicialização do banco:', error);
      // Continuar apenas com IndexedDB local
      this.isInitialized = true;
      return false;
    }
  }

  async initializeLocalDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('JurisControlDB_v2', 2);
      
      request.onerror = () => reject(new Error('Erro ao abrir IndexedDB'));
      
      request.onsuccess = (event) => {
        this.localDB = event.target.result;
        console.log('📦 IndexedDB local inicializado');
        resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        const stores = ['users', 'processos', 'calendario', 'documentos', 'versoes', 'modelos', 'emissores', 'leis', 'config', 'sync_queue'];
        
        stores.forEach(storeName => {
          if (!db.objectStoreNames.contains(storeName)) {
            const store = db.createObjectStore(storeName, { keyPath: 'id' });
            
            // Adicionar índices úteis
            if (storeName === 'processos') {
              store.createIndex('status', 'status', { unique: false });
              store.createIndex('dataEntrada', 'dataEntrada', { unique: false });
            }
            if (storeName === 'calendario') {
              store.createIndex('data', 'data', { unique: false });
            }
          }
        });
        
        // Store especial para configurações
        if (db.objectStoreNames.contains('config')) {
          db.deleteObjectStore('config');
        }
        db.createObjectStore('config', { keyPath: 'key' });
      };
    });
  }

  async initializeSupabase() {
    // Para este exemplo, vamos simular a conexão com Supabase
    // Em produção, você usaria a biblioteca oficial do Supabase
    console.log('☁️ Conectando com Supabase...');
    
    try {
      // Simular verificação de conectividade
      const response = await fetch(this.config.supabase.url + '/rest/v1/', {
        method: 'HEAD',
        headers: {
          'apikey': this.config.supabase.key,
          'Authorization': `Bearer ${this.config.supabase.key}`
        }
      });
      
      if (response.ok) {
        this.supabaseConnected = true;
        console.log('✅ Conectado ao Supabase');
      } else {
        throw new Error('Falha na conexão com Supabase');
      }
      
    } catch (error) {
      console.warn('⚠️ Supabase indisponível, usando apenas armazenamento local');
      this.supabaseConnected = false;
    }
  }

  // ===== MÉTODOS DE DADOS =====

  async saveData(collection, data, id = null) {
    try {
      // Preparar dados com timestamps
      const timestamp = new Date().toISOString();
      const dataWithMeta = {
        ...data,
        id: id || data.id || this.generateId(),
        updatedAt: timestamp,
        createdAt: data.createdAt || timestamp,
        syncStatus: 'pending'
      };

      // Salvar localmente primeiro (sempre)
      await this.saveToLocal(collection, dataWithMeta);
      
      // Tentar salvar na nuvem se disponível
      if (this.supabaseConnected && this.isOnline) {
        try {
          await this.saveToSupabase(collection, dataWithMeta);
          dataWithMeta.syncStatus = 'synced';
          await this.saveToLocal(collection, dataWithMeta);
        } catch (error) {
          console.warn('Erro ao salvar na nuvem:', error);
          this.addToSyncQueue('save', collection, dataWithMeta);
        }
      } else {
        this.addToSyncQueue('save', collection, dataWithMeta);
      }

      return dataWithMeta;
      
    } catch (error) {
      console.error('Erro ao salvar dados:', error);
      throw error;
    }
  }

  async loadData(collection, id = null) {
    try {
      // Tentar carregar da nuvem primeiro se disponível
      if (this.supabaseConnected && this.isOnline) {
        try {
          const cloudData = await this.loadFromSupabase(collection, id);
          if (cloudData) {
            // Atualizar cache local
            if (Array.isArray(cloudData)) {
              for (const item of cloudData) {
                await this.saveToLocal(collection, { ...item, syncStatus: 'synced' });
              }
            } else {
              await this.saveToLocal(collection, { ...cloudData, syncStatus: 'synced' });
            }
            return cloudData;
          }
        } catch (error) {
          console.warn('Erro ao carregar da nuvem:', error);
        }
      }

      // Fallback para dados locais
      return await this.loadFromLocal(collection, id);
      
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      return id ? null : [];
    }
  }

  async deleteData(collection, id) {
    try {
      // Deletar localmente
      await this.deleteFromLocal(collection, id);
      
      // Tentar deletar da nuvem
      if (this.supabaseConnected && this.isOnline) {
        try {
          await this.deleteFromSupabase(collection, id);
        } catch (error) {
          console.warn('Erro ao deletar da nuvem:', error);
          this.addToSyncQueue('delete', collection, null, id);
        }
      } else {
        this.addToSyncQueue('delete', collection, null, id);
      }
      
      return true;
      
    } catch (error) {
      console.error('Erro ao deletar dados:', error);
      throw error;
    }
  }

  // ===== MÉTODOS LOCAIS (IndexedDB) =====

  async saveToLocal(collection, data) {
    return new Promise((resolve, reject) => {
      const transaction = this.localDB.transaction([collection], 'readwrite');
      const store = transaction.objectStore(collection);
      const request = store.put(data);
      
      request.onsuccess = () => resolve(data);
      request.onerror = () => reject(request.error);
    });
  }

  async loadFromLocal(collection, id = null) {
    return new Promise((resolve, reject) => {
      const transaction = this.localDB.transaction([collection], 'readonly');
      const store = transaction.objectStore(collection);
      
      if (id) {
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      } else {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      }
    });
  }

  async deleteFromLocal(collection, id) {
    return new Promise((resolve, reject) => {
      const transaction = this.localDB.transaction([collection], 'readwrite');
      const store = transaction.objectStore(collection);
      const request = store.delete(id);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // ===== MÉTODOS SUPABASE =====

  async saveToSupabase(collection, data) {
    const url = `${this.config.supabase.url}/rest/v1/${collection}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': this.config.supabase.key,
        'Authorization': `Bearer ${this.config.supabase.key}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error(`Erro HTTP: ${response.status}`);
    }

    return data;
  }

  async loadFromSupabase(collection, id = null) {
    let url = `${this.config.supabase.url}/rest/v1/${collection}`;
    
    if (id) {
      url += `?id=eq.${id}`;
    }
    
    const response = await fetch(url, {
      headers: {
        'apikey': this.config.supabase.key,
        'Authorization': `Bearer ${this.config.supabase.key}`
      }
    });

    if (!response.ok) {
      throw new Error(`Erro HTTP: ${response.status}`);
    }

    const data = await response.json();
    return id ? (data[0] || null) : data;
  }

  async deleteFromSupabase(collection, id) {
    const url = `${this.config.supabase.url}/rest/v1/${collection}?id=eq.${id}`;
    
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'apikey': this.config.supabase.key,
        'Authorization': `Bearer ${this.config.supabase.key}`
      }
    });

    if (!response.ok) {
      throw new Error(`Erro HTTP: ${response.status}`);
    }
  }

  // ===== SINCRONIZAÇÃO =====

  async handleOnline() {
    this.isOnline = true;
    console.log('🌐 Conexão restaurada');
    
    if (this.config.supabase?.enabled) {
      await this.initializeSupabase();
      await this.processSyncQueue();
    }
  }

  handleOffline() {
    this.isOnline = false;
    this.supabaseConnected = false;
    console.log('📴 Modo offline');
  }

  async processSyncQueue() {
    if (this.syncQueue.length === 0) return;

    console.log(`🔄 Processando ${this.syncQueue.length} itens da fila de sincronização`);
    
    const failedItems = [];
    
    for (const item of this.syncQueue) {
      try {
        switch (item.action) {
          case 'save':
            await this.saveToSupabase(item.collection, item.data);
            // Atualizar status local
            await this.saveToLocal(item.collection, { ...item.data, syncStatus: 'synced' });
            break;
          case 'delete':
            await this.deleteFromSupabase(item.collection, item.id);
            break;
        }
        console.log(`✅ Sincronizado: ${item.action} ${item.collection}`);
      } catch (error) {
        console.error(`❌ Falha na sincronização: ${item.action} ${item.collection}`, error);
        failedItems.push(item);
      }
    }
    
    this.syncQueue = failedItems;
    this.saveSyncQueue();
    
    if (failedItems.length === 0) {
      this.showNotification('Todos os dados foram sincronizados!', 'success');
    } else {
      this.showNotification(`${failedItems.length} itens não puderam ser sincronizados`, 'warning');
    }
  }

  addToSyncQueue(action, collection, data, id = null) {
    const item = {
      id: this.generateId(),
      action,
      collection,
      data,
      itemId: id,
      timestamp: Date.now()
    };
    
    this.syncQueue.push(item);
    this.saveSyncQueue();
    
    console.log(`📝 Adicionado à fila: ${action} ${collection}`);
  }

  saveSyncQueue() {
    try {
      localStorage.setItem('supabase_sync_queue', JSON.stringify(this.syncQueue));
    } catch (error) {
      console.error('Erro ao salvar fila de sincronização:', error);
    }
  }

  loadSyncQueue() {
    try {
      const saved = localStorage.getItem('supabase_sync_queue');
      this.syncQueue = saved ? JSON.parse(saved) : [];
      console.log(`📋 Fila de sincronização carregada: ${this.syncQueue.length} itens`);
    } catch (error) {
      console.error('Erro ao carregar fila de sincronização:', error);
      this.syncQueue = [];
    }
  }

  // ===== UTILITÁRIOS =====

  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  showNotification(message, type = 'info') {
    if (window.showToast) {
      window.showToast(message, type);
    } else {
      console.log(`🔔 ${message}`);
    }
  }

  getStatus() {
    return {
      initialized: this.isInitialized,
      online: this.isOnline,
      supabaseConnected: this.supabaseConnected,
      pendingSync: this.syncQueue.length,
      localDB: !!this.localDB
    };
  }

  // ===== MÉTODOS DE COMPATIBILIDADE =====

  // Métodos para manter compatibilidade com o código existente
  async get(storeName, key) {
    return await this.loadData(storeName, key);
  }

  async getAll(storeName) {
    return await this.loadData(storeName);
  }

  async put(storeName, item) {
    return await this.saveData(storeName, item, item.id);
  }

  async delete(storeName, key) {
    return await this.deleteData(storeName, key);
  }

  async clear(storeName) {
    // Implementar limpeza completa se necessário
    const allItems = await this.loadData(storeName);
    for (const item of allItems) {
      await this.deleteData(storeName, item.id);
    }
  }
}

// Instância global
const supabaseDatabase = new SupabaseDatabase();

// Disponibilizar globalmente
window.supabaseDatabase = supabaseDatabase;

// Inicializar quando o DOM estiver pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => supabaseDatabase.initialize());
} else {
  supabaseDatabase.initialize();
}

console.log('🔗 SupabaseDatabase carregado');

export default supabaseDatabase;
