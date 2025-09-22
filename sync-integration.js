// Sistema de Integração e Sincronização - JurisControl
// Integra o novo sistema de banco de dados com o código existente

class SyncIntegration {
  constructor() {
    this.isInitialized = false;
    this.originalDbHelper = null;
    this.syncEnabled = true;
    this.autoSyncInterval = null;
    this.conflictResolutionStrategy = 'server_wins'; // 'server_wins', 'client_wins', 'merge'
  }

  // ===== INICIALIZAÇÃO =====

  async initialize() {
    if (this.isInitialized) return;

    console.log('🔗 Inicializando integração de sincronização...');

    try {
      // Aguardar o DatabaseManager estar pronto
      await this.waitForDatabaseManager();
      
      // Fazer backup do dbHelper original
      this.backupOriginalDbHelper();
      
      // Substituir métodos do dbHelper
      this.integrateWithExistingCode();
      
      // Configurar sincronização automática
      this.setupAutoSync();
      
      // Executar migração inicial se necessário
      await this.handleInitialMigration();
      
      this.isInitialized = true;
      console.log('✅ Integração de sincronização inicializada');
      
      // Notificar usuário
      this.showNotification('Sistema de sincronização ativado! Seus dados agora são salvos na nuvem.', 'success');
      
    } catch (error) {
      console.error('❌ Erro na inicialização da integração:', error);
      this.showNotification('Erro ao ativar sincronização. Usando modo local.', 'warning');
    }
  }

  async waitForDatabaseManager() {
    let attempts = 0;
    const maxAttempts = 50; // 5 segundos
    
    while (!window.databaseManager && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }
    
    if (!window.databaseManager) {
      throw new Error('DatabaseManager não disponível');
    }
  }

  backupOriginalDbHelper() {
    if (window.dbHelper) {
      this.originalDbHelper = { ...window.dbHelper };
      console.log('💾 Backup do dbHelper original criado');
    }
  }

  // ===== INTEGRAÇÃO COM CÓDIGO EXISTENTE =====

  integrateWithExistingCode() {
    if (!window.dbHelper) {
      console.warn('⚠️ dbHelper não encontrado, criando wrapper');
      window.dbHelper = {};
    }

    // Substituir métodos do dbHelper para usar o novo sistema
    const originalMethods = { ...window.dbHelper };

    window.dbHelper.get = async (storeName, key) => {
      try {
        if (this.syncEnabled) {
          const data = await window.databaseManager.loadData(storeName, key);
          return data;
        } else {
          return originalMethods.get ? await originalMethods.get(storeName, key) : null;
        }
      } catch (error) {
        console.error(`Erro ao buscar ${storeName}/${key}:`, error);
        // Fallback para método original
        return originalMethods.get ? await originalMethods.get(storeName, key) : null;
      }
    };

    window.dbHelper.getAll = async (storeName) => {
      try {
        if (this.syncEnabled) {
          const data = await window.databaseManager.loadData(storeName);
          return Array.isArray(data) ? data : [];
        } else {
          return originalMethods.getAll ? await originalMethods.getAll(storeName) : [];
        }
      } catch (error) {
        console.error(`Erro ao buscar todos de ${storeName}:`, error);
        // Fallback para método original
        return originalMethods.getAll ? await originalMethods.getAll(storeName) : [];
      }
    };

    window.dbHelper.put = async (storeName, item) => {
      try {
        if (this.syncEnabled) {
          // Garantir que o item tenha um ID
          if (!item.id) {
            item.id = this.generateId();
          }
          
          const result = await window.databaseManager.saveData(storeName, item, item.id);
          
          // Emitir evento para atualizar UI
          this.emitDataChangeEvent(storeName, 'update', item);
          
          return result;
        } else {
          return originalMethods.put ? await originalMethods.put(storeName, item) : item;
        }
      } catch (error) {
        console.error(`Erro ao salvar ${storeName}:`, error);
        // Fallback para método original
        return originalMethods.put ? await originalMethods.put(storeName, item) : item;
      }
    };

    window.dbHelper.delete = async (storeName, key) => {
      try {
        if (this.syncEnabled) {
          await window.databaseManager.deleteData(storeName, key);
          
          // Emitir evento para atualizar UI
          this.emitDataChangeEvent(storeName, 'delete', { id: key });
          
          return true;
        } else {
          return originalMethods.delete ? await originalMethods.delete(storeName, key) : true;
        }
      } catch (error) {
        console.error(`Erro ao deletar ${storeName}/${key}:`, error);
        // Fallback para método original
        return originalMethods.delete ? await originalMethods.delete(storeName, key) : false;
      }
    };

    window.dbHelper.clear = async (storeName) => {
      try {
        if (this.syncEnabled) {
          // Buscar todos os itens e deletar um por um
          const allItems = await window.databaseManager.loadData(storeName);
          if (allItems && allItems.length > 0) {
            for (const item of allItems) {
              await window.databaseManager.deleteData(storeName, item.id);
            }
          }
          
          // Emitir evento para atualizar UI
          this.emitDataChangeEvent(storeName, 'clear', null);
          
          return true;
        } else {
          return originalMethods.clear ? await originalMethods.clear(storeName) : true;
        }
      } catch (error) {
        console.error(`Erro ao limpar ${storeName}:`, error);
        return originalMethods.clear ? await originalMethods.clear(storeName) : false;
      }
    };

    console.log('🔄 Métodos do dbHelper integrados com sincronização');
  }

  // ===== MIGRAÇÃO INICIAL =====

  async handleInitialMigration() {
    try {
      // Verificar se já foi migrado
      const migrationStatus = await window.migrationAdapter.checkMigrationStatus();
      
      if (!migrationStatus.completed) {
        console.log('🚀 Iniciando migração automática...');
        
        // Criar backup antes da migração
        await window.migrationAdapter.createBackupBeforeMigration();
        
        // Executar migração
        const result = await window.migrationAdapter.startMigration();
        
        if (result.success) {
          console.log('✅ Migração automática concluída');
          this.showNotification('Dados migrados com sucesso para a nuvem!', 'success');
          
          // Mostrar resumo
          await window.migrationAdapter.showMigrationSummary();
        } else {
          console.error('❌ Falha na migração automática:', result.message);
          this.showNotification('Erro na migração. Usando dados locais.', 'warning');
        }
      } else {
        console.log('✅ Dados já migrados anteriormente');
      }
      
    } catch (error) {
      console.error('❌ Erro na migração inicial:', error);
      this.showNotification('Erro na migração inicial. Sistema funcionando em modo local.', 'warning');
    }
  }

  // ===== SINCRONIZAÇÃO AUTOMÁTICA =====

  setupAutoSync() {
    // Sincronização a cada 5 minutos
    this.autoSyncInterval = setInterval(async () => {
      if (this.syncEnabled && navigator.onLine) {
        await this.performAutoSync();
      }
    }, 5 * 60 * 1000);

    // Sincronizar quando a página ganha foco
    window.addEventListener('focus', async () => {
      if (this.syncEnabled && navigator.onLine) {
        await this.performAutoSync();
      }
    });

    // Sincronizar quando volta online
    window.addEventListener('online', async () => {
      if (this.syncEnabled) {
        await this.performAutoSync();
      }
    });

    console.log('⏰ Sincronização automática configurada');
  }

  async performAutoSync() {
    try {
      console.log('🔄 Executando sincronização automática...');
      
      const status = window.databaseManager.getStatus();
      
      if (status.pendingSync > 0) {
        await window.databaseManager.syncPendingChanges();
        console.log(`✅ ${status.pendingSync} alterações sincronizadas`);
      }
      
      await window.databaseManager.syncFromCloud();
      
      // Atualizar UI se necessário
      this.refreshUIAfterSync();
      
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
      window.loadAllData();
    }
  }

  // ===== RESOLUÇÃO DE CONFLITOS =====

  async resolveConflict(localData, serverData, strategy = null) {
    const resolveStrategy = strategy || this.conflictResolutionStrategy;
    
    switch (resolveStrategy) {
      case 'server_wins':
        return serverData;
        
      case 'client_wins':
        return localData;
        
      case 'merge':
        return this.mergeData(localData, serverData);
        
      case 'newest_wins':
        const localTime = new Date(localData.updatedAt || localData.createdAt);
        const serverTime = new Date(serverData.updatedAt || serverData.createdAt);
        return serverTime > localTime ? serverData : localData;
        
      default:
        return serverData; // Default para server wins
    }
  }

  mergeData(localData, serverData) {
    // Estratégia simples de merge - usar dados mais recentes para cada campo
    const merged = { ...localData };
    
    Object.keys(serverData).forEach(key => {
      if (key === 'updatedAt' || key === 'createdAt') {
        // Para timestamps, usar o mais recente
        const localTime = new Date(localData[key] || 0);
        const serverTime = new Date(serverData[key] || 0);
        merged[key] = serverTime > localTime ? serverData[key] : localData[key];
      } else if (serverData[key] !== undefined && serverData[key] !== null) {
        // Para outros campos, preferir dados do servidor se existirem
        merged[key] = serverData[key];
      }
    });
    
    return merged;
  }

  // ===== UTILITÁRIOS =====

  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  emitDataChangeEvent(collection, action, data) {
    window.dispatchEvent(new CustomEvent('dataChange', {
      detail: { collection, action, data }
    }));
  }

  showNotification(message, type = 'info') {
    if (window.showToast) {
      window.showToast(message, type);
    } else {
      console.log(`🔔 ${message}`);
    }
  }

  // ===== MÉTODOS DE CONTROLE =====

  enableSync() {
    this.syncEnabled = true;
    console.log('✅ Sincronização habilitada');
    this.showNotification('Sincronização ativada', 'success');
  }

  disableSync() {
    this.syncEnabled = false;
    console.log('⏸️ Sincronização desabilitada');
    this.showNotification('Sincronização desativada - usando apenas dados locais', 'warning');
  }

  async forcSync() {
    if (!this.syncEnabled) {
      this.showNotification('Sincronização está desabilitada', 'warning');
      return;
    }

    try {
      this.showNotification('Forçando sincronização...', 'info');
      await this.performAutoSync();
      this.showNotification('Sincronização forçada concluída', 'success');
    } catch (error) {
      console.error('Erro na sincronização forçada:', error);
      this.showNotification('Erro na sincronização forçada', 'danger');
    }
  }

  getSyncStatus() {
    const dbStatus = window.databaseManager ? window.databaseManager.getStatus() : null;
    
    return {
      enabled: this.syncEnabled,
      initialized: this.isInitialized,
      online: navigator.onLine,
      databaseManager: dbStatus,
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
    console.log('🧹 SyncIntegration destruído');
  }
}

// Instância global
const syncIntegration = new SyncIntegration();

// Inicializar quando tudo estiver pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    // Aguardar um pouco para garantir que outros scripts carregaram
    setTimeout(() => syncIntegration.initialize(), 1000);
  });
} else {
  setTimeout(() => syncIntegration.initialize(), 1000);
}

// Disponibilizar globalmente
window.syncIntegration = syncIntegration;

// Adicionar comandos de console para debug
window.syncDebug = {
  status: () => syncIntegration.getSyncStatus(),
  enable: () => syncIntegration.enableSync(),
  disable: () => syncIntegration.disableSync(),
  force: () => syncIntegration.forcSync(),
  migration: () => window.migrationAdapter.showMigrationSummary()
};

console.log('🔗 SyncIntegration carregado. Use syncDebug no console para debug.');

export default syncIntegration;
