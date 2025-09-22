// Integração Supabase - JurisControl
// Sistema simplificado para substituir o Firebase e garantir sincronização

class SupabaseIntegration {
  constructor() {
    this.isInitialized = false;
    this.database = null;
  }

  async initialize() {
    if (this.isInitialized) return;

    try {
      console.log('🔗 Inicializando integração Supabase...');
      
      // Aguardar o banco de dados estar pronto
      await this.waitForDatabase();
      
      // Substituir o dbHelper global
      this.replaceDbHelper();
      
      // Configurar sincronização automática
      this.setupAutoSync();
      
      this.isInitialized = true;
      console.log('✅ Integração Supabase inicializada');
      
      // Notificar usuário
      this.showNotification('Sistema de sincronização ativado!', 'success');
      
    } catch (error) {
      console.error('❌ Erro na integração Supabase:', error);
      this.showNotification('Erro na sincronização. Sistema funcionando localmente.', 'warning');
    }
  }

  async waitForDatabase() {
    let attempts = 0;
    const maxAttempts = 50;
    
    while (!window.supabaseDatabase && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }
    
    if (!window.supabaseDatabase) {
      throw new Error('SupabaseDatabase não disponível');
    }
    
    this.database = window.supabaseDatabase;
    
    // Aguardar inicialização do banco
    await this.database.initialize();
  }

  replaceDbHelper() {
    // Backup do dbHelper original se existir
    if (window.dbHelper) {
      this.originalDbHelper = { ...window.dbHelper };
    }

    // Substituir dbHelper com métodos do Supabase
    window.dbHelper = {
      // Método de inicialização (compatibilidade)
      async init() {
        return true; // Já inicializado pelo SupabaseDatabase
      },

      // Buscar um item específico
      async get(storeName, key) {
        try {
          return await window.supabaseDatabase.get(storeName, key);
        } catch (error) {
          console.error(`Erro ao buscar ${storeName}/${key}:`, error);
          return null;
        }
      },

      // Buscar todos os itens de uma coleção
      async getAll(storeName) {
        try {
          const data = await window.supabaseDatabase.getAll(storeName);
          return Array.isArray(data) ? data : [];
        } catch (error) {
          console.error(`Erro ao buscar todos de ${storeName}:`, error);
          return [];
        }
      },

      // Salvar/atualizar um item
      async put(storeName, item) {
        try {
          // Garantir que o item tenha um ID
          if (!item.id) {
            item.id = this.generateId();
          }
          
          const result = await window.supabaseDatabase.put(storeName, item);
          
          // Emitir evento para atualizar UI
          this.emitDataChangeEvent(storeName, 'update', item);
          
          return result;
        } catch (error) {
          console.error(`Erro ao salvar ${storeName}:`, error);
          throw error;
        }
      },

      // Deletar um item
      async delete(storeName, key) {
        try {
          await window.supabaseDatabase.delete(storeName, key);
          
          // Emitir evento para atualizar UI
          this.emitDataChangeEvent(storeName, 'delete', { id: key });
          
          return true;
        } catch (error) {
          console.error(`Erro ao deletar ${storeName}/${key}:`, error);
          return false;
        }
      },

      // Limpar uma coleção
      async clear(storeName) {
        try {
          await window.supabaseDatabase.clear(storeName);
          
          // Emitir evento para atualizar UI
          this.emitDataChangeEvent(storeName, 'clear', null);
          
          return true;
        } catch (error) {
          console.error(`Erro ao limpar ${storeName}:`, error);
          return false;
        }
      },

      // Método auxiliar para gerar IDs
      generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
      },

      // Método auxiliar para emitir eventos
      emitDataChangeEvent(collection, action, data) {
        window.dispatchEvent(new CustomEvent('dataChange', {
          detail: { collection, action, data }
        }));
      }
    };

    console.log('🔄 dbHelper substituído pela integração Supabase');
  }

  setupAutoSync() {
    // Sincronização a cada 30 segundos
    this.autoSyncInterval = setInterval(async () => {
      if (navigator.onLine && this.database.supabaseConnected) {
        await this.performAutoSync();
      }
    }, 30000);

    // Sincronizar quando a página ganha foco
    window.addEventListener('focus', async () => {
      if (navigator.onLine && this.database.supabaseConnected) {
        await this.performAutoSync();
      }
    });

    // Sincronizar quando volta online
    window.addEventListener('online', async () => {
      setTimeout(async () => {
        await this.performAutoSync();
      }, 2000); // Aguardar 2 segundos para estabilizar conexão
    });

    console.log('⏰ Sincronização automática configurada');
  }

  async performAutoSync() {
    try {
      const status = this.database.getStatus();
      
      if (status.pendingSync > 0) {
        console.log('🔄 Executando sincronização automática...');
        await this.database.processSyncQueue();
        
        // Atualizar UI se necessário
        this.refreshUIAfterSync();
      }
      
    } catch (error) {
      console.error('❌ Erro na sincronização automática:', error);
    }
  }

  refreshUIAfterSync() {
    // Emitir evento para que a UI se atualize
    window.dispatchEvent(new CustomEvent('dataSync', {
      detail: { type: 'auto_sync_completed' }
    }));
    
    // Se existir uma função de reload global, chamá-la
    if (window.loadAllData && typeof window.loadAllData === 'function') {
      setTimeout(() => {
        window.loadAllData();
      }, 500);
    }
  }

  showNotification(message, type = 'info') {
    if (window.showToast) {
      window.showToast(message, type);
    } else {
      console.log(`🔔 ${message}`);
    }
  }

  // ===== MÉTODOS DE CONTROLE =====

  async forceSync() {
    try {
      this.showNotification('Forçando sincronização...', 'info');
      await this.performAutoSync();
      this.showNotification('Sincronização concluída!', 'success');
    } catch (error) {
      console.error('Erro na sincronização forçada:', error);
      this.showNotification('Erro na sincronização', 'danger');
    }
  }

  getStatus() {
    const dbStatus = this.database ? this.database.getStatus() : null;
    
    return {
      initialized: this.isInitialized,
      database: dbStatus,
      autoSyncActive: !!this.autoSyncInterval
    };
  }

  // ===== CLEANUP =====

  destroy() {
    if (this.autoSyncInterval) {
      clearInterval(this.autoSyncInterval);
      this.autoSyncInterval = null;
    }

    // Restaurar dbHelper original se necessário
    if (this.originalDbHelper) {
      window.dbHelper = this.originalDbHelper;
    }

    this.isInitialized = false;
    console.log('🧹 SupabaseIntegration destruído');
  }
}

// Instância global
const supabaseIntegration = new SupabaseIntegration();

// Inicializar quando tudo estiver pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    // Aguardar um pouco para garantir que outros scripts carregaram
    setTimeout(() => supabaseIntegration.initialize(), 1500);
  });
} else {
  setTimeout(() => supabaseIntegration.initialize(), 1500);
}

// Disponibilizar globalmente
window.supabaseIntegration = supabaseIntegration;

// Adicionar comandos de console para debug
window.supabaseDebug = {
  status: () => supabaseIntegration.getStatus(),
  force: () => supabaseIntegration.forceSync(),
  database: () => window.supabaseDatabase?.getStatus()
};

console.log('🔗 SupabaseIntegration carregado. Use supabaseDebug no console para debug.');

export default supabaseIntegration;
