// Adaptador de Migração - JurisControl
// Migra dados do IndexedDB local para o novo sistema com Firebase

class MigrationAdapter {
  constructor() {
    this.DB_NAME = 'JurisControlDB_v1';
    this.DB_VERSION = 1;
    this.STORES = ['users', 'processos', 'calendario', 'documentos', 'versoes', 'modelos', 'emissores', 'leis', 'config'];
    this.migrationStatus = {
      completed: false,
      collections: {},
      errors: []
    };
  }

  // ===== MÉTODOS DE MIGRAÇÃO =====

  async startMigration() {
    console.log('🔄 Iniciando migração de dados...');
    
    try {
      // Verificar se já foi migrado
      const migrationInfo = localStorage.getItem('migrationCompleted');
      if (migrationInfo) {
        console.log('✅ Migração já foi realizada anteriormente');
        return { success: true, message: 'Dados já migrados' };
      }

      // Abrir IndexedDB existente
      const oldDb = await this.openOldDatabase();
      
      // Migrar cada coleção
      for (const storeName of this.STORES) {
        await this.migrateCollection(oldDb, storeName);
      }

      // Marcar migração como completa
      localStorage.setItem('migrationCompleted', JSON.stringify({
        date: new Date().toISOString(),
        collections: this.migrationStatus.collections
      }));

      console.log('✅ Migração completa!');
      return { 
        success: true, 
        message: 'Migração realizada com sucesso',
        details: this.migrationStatus
      };

    } catch (error) {
      console.error('❌ Erro na migração:', error);
      return { 
        success: false, 
        message: 'Erro na migração: ' + error.message,
        error: error
      };
    }
  }

  async openOldDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);
      
      request.onsuccess = (event) => {
        resolve(event.target.result);
      };
      
      request.onerror = (event) => {
        reject(new Error('Erro ao abrir banco de dados antigo'));
      };
      
      request.onupgradeneeded = (event) => {
        // Se o banco não existe, não há nada para migrar
        resolve(null);
      };
    });
  }

  async migrateCollection(oldDb, storeName) {
    if (!oldDb) {
      console.log(`⚠️ Banco antigo não encontrado, pulando ${storeName}`);
      return;
    }

    try {
      console.log(`📦 Migrando coleção: ${storeName}`);
      
      // Verificar se a store existe
      if (!oldDb.objectStoreNames.contains(storeName)) {
        console.log(`⚠️ Store ${storeName} não existe no banco antigo`);
        this.migrationStatus.collections[storeName] = { count: 0, status: 'not_found' };
        return;
      }

      // Ler dados da store antiga
      const oldData = await this.readOldStore(oldDb, storeName);
      
      if (!oldData || oldData.length === 0) {
        console.log(`📭 Nenhum dado encontrado em ${storeName}`);
        this.migrationStatus.collections[storeName] = { count: 0, status: 'empty' };
        return;
      }

      // Migrar dados para o novo sistema
      let migratedCount = 0;
      const errors = [];

      for (const item of oldData) {
        try {
          // Preparar dados para o novo formato
          const migratedItem = this.prepareDataForMigration(item, storeName);
          
          // Salvar usando o novo sistema
          if (window.databaseManager) {
            await window.databaseManager.saveData(storeName, migratedItem, item.id);
            migratedCount++;
          } else {
            throw new Error('DatabaseManager não disponível');
          }
          
        } catch (error) {
          console.error(`Erro ao migrar item ${item.id} de ${storeName}:`, error);
          errors.push({ id: item.id, error: error.message });
        }
      }

      this.migrationStatus.collections[storeName] = {
        count: migratedCount,
        total: oldData.length,
        status: errors.length === 0 ? 'success' : 'partial',
        errors: errors
      };

      console.log(`✅ ${storeName}: ${migratedCount}/${oldData.length} itens migrados`);

    } catch (error) {
      console.error(`❌ Erro ao migrar ${storeName}:`, error);
      this.migrationStatus.collections[storeName] = {
        count: 0,
        status: 'error',
        error: error.message
      };
      this.migrationStatus.errors.push({ collection: storeName, error: error.message });
    }
  }

  async readOldStore(db, storeName) {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();
      
      request.onsuccess = () => {
        resolve(request.result);
      };
      
      request.onerror = () => {
        reject(new Error(`Erro ao ler dados de ${storeName}`));
      };
    });
  }

  prepareDataForMigration(item, storeName) {
    // Adicionar timestamps se não existirem
    const now = new Date().toISOString();
    
    const migratedItem = {
      ...item,
      createdAt: item.createdAt || now,
      updatedAt: now,
      migratedAt: now,
      source: 'indexeddb_migration'
    };

    // Limpeza específica por tipo de coleção
    switch (storeName) {
      case 'processos':
        return this.cleanProcessoData(migratedItem);
      case 'calendario':
        return this.cleanCalendarioData(migratedItem);
      case 'users':
        return this.cleanUserData(migratedItem);
      case 'documentos':
        return this.cleanDocumentoData(migratedItem);
      default:
        return migratedItem;
    }
  }

  cleanProcessoData(processo) {
    // Garantir que campos obrigatórios existam
    return {
      ...processo,
      numero: processo.numero || '',
      interessado: processo.interessado || '',
      status: processo.status || 'Em Andamento',
      dataEntrada: processo.dataEntrada || new Date().toISOString().split('T')[0],
      prazoFinal: processo.prazoFinal || null,
      observacoes: processo.observacoes || '',
      tags: processo.tags || [],
      prioridade: processo.prioridade || 'normal'
    };
  }

  cleanCalendarioData(evento) {
    return {
      ...evento,
      titulo: evento.titulo || '',
      data: evento.data || new Date().toISOString().split('T')[0],
      hora: evento.hora || '09:00',
      tipo: evento.tipo || 'compromisso',
      descricao: evento.descricao || '',
      concluido: evento.concluido || false
    };
  }

  cleanUserData(user) {
    return {
      ...user,
      nome: user.nome || '',
      email: user.email || '',
      tipo: user.tipo || 'colaborador',
      ativo: user.ativo !== false, // default true
      ultimoLogin: user.ultimoLogin || null
    };
  }

  cleanDocumentoData(documento) {
    return {
      ...documento,
      nome: documento.nome || '',
      tipo: documento.tipo || 'documento',
      tamanho: documento.tamanho || 0,
      processoId: documento.processoId || null,
      url: documento.url || '',
      hash: documento.hash || null
    };
  }

  // ===== MÉTODOS DE VERIFICAÇÃO =====

  async checkMigrationStatus() {
    const migrationInfo = localStorage.getItem('migrationCompleted');
    
    if (!migrationInfo) {
      return { completed: false, message: 'Migração não realizada' };
    }

    const info = JSON.parse(migrationInfo);
    return {
      completed: true,
      date: info.date,
      collections: info.collections,
      message: 'Migração já realizada'
    };
  }

  async verifyMigration() {
    console.log('🔍 Verificando integridade da migração...');
    
    const results = {};
    
    for (const storeName of this.STORES) {
      try {
        // Contar dados no sistema antigo
        const oldDb = await this.openOldDatabase();
        const oldCount = oldDb ? (await this.readOldStore(oldDb, storeName)).length : 0;
        
        // Contar dados no sistema novo
        const newData = await window.databaseManager.loadData(storeName);
        const newCount = newData ? newData.length : 0;
        
        results[storeName] = {
          oldCount,
          newCount,
          status: oldCount === newCount ? 'ok' : 'mismatch'
        };
        
      } catch (error) {
        results[storeName] = {
          status: 'error',
          error: error.message
        };
      }
    }
    
    console.log('📊 Resultado da verificação:', results);
    return results;
  }

  // ===== MÉTODOS DE BACKUP =====

  async createBackupBeforeMigration() {
    console.log('💾 Criando backup antes da migração...');
    
    try {
      const oldDb = await this.openOldDatabase();
      if (!oldDb) {
        console.log('⚠️ Nenhum banco antigo encontrado para backup');
        return null;
      }

      const backup = {
        timestamp: new Date().toISOString(),
        version: this.DB_VERSION,
        data: {}
      };

      for (const storeName of this.STORES) {
        if (oldDb.objectStoreNames.contains(storeName)) {
          backup.data[storeName] = await this.readOldStore(oldDb, storeName);
        }
      }

      // Salvar backup no localStorage (para dados pequenos) ou IndexedDB
      const backupString = JSON.stringify(backup);
      
      if (backupString.length < 5 * 1024 * 1024) { // 5MB
        localStorage.setItem('migrationBackup', backupString);
        console.log('✅ Backup salvo no localStorage');
      } else {
        await this.saveBackupToIndexedDB(backup);
        console.log('✅ Backup salvo no IndexedDB');
      }

      return backup;

    } catch (error) {
      console.error('❌ Erro ao criar backup:', error);
      throw error;
    }
  }

  async saveBackupToIndexedDB(backup) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('JurisControlBackup', 1);
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('backups')) {
          db.createObjectStore('backups', { keyPath: 'id' });
        }
      };
      
      request.onsuccess = (event) => {
        const db = event.target.result;
        const transaction = db.transaction('backups', 'readwrite');
        const store = transaction.objectStore('backups');
        
        store.put({
          id: 'migration_backup',
          ...backup
        });
        
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  // ===== MÉTODOS DE INTERFACE =====

  showMigrationProgress(message, progress = null) {
    console.log(`🔄 ${message}${progress ? ` (${progress}%)` : ''}`);
    
    // Usar sistema de toast se disponível
    if (window.showToast) {
      window.showToast(message, 'info');
    }
    
    // Emitir evento personalizado para UI
    window.dispatchEvent(new CustomEvent('migrationProgress', {
      detail: { message, progress }
    }));
  }

  async showMigrationSummary() {
    const status = await this.checkMigrationStatus();
    
    if (!status.completed) {
      console.log('📋 Migração não realizada ainda');
      return;
    }

    console.log('📋 Resumo da Migração:');
    console.log(`📅 Data: ${new Date(status.date).toLocaleString('pt-BR')}`);
    
    Object.entries(status.collections).forEach(([collection, info]) => {
      const emoji = info.status === 'success' ? '✅' : 
                   info.status === 'partial' ? '⚠️' : 
                   info.status === 'empty' ? '📭' : '❌';
      
      console.log(`${emoji} ${collection}: ${info.count || 0} itens (${info.status})`);
    });
  }
}

// Instância global
const migrationAdapter = new MigrationAdapter();

// Disponibilizar globalmente
window.migrationAdapter = migrationAdapter;

export default migrationAdapter;
