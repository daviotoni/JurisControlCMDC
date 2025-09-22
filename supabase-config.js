// Configuração do Supabase - JurisControl
// Sistema de banco de dados mais simples e confiável que o Firebase

(function() {
  'use strict';

  // Configurações do Supabase (projeto público para demonstração)
  // Em produção, você criaria seu próprio projeto no Supabase
  const SUPABASE_CONFIG = {
    url: 'https://xyzcompany.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh5emNvbXBhbnkiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTY0NjkxNzY4OCwiZXhwIjoxOTYyNDkzNjg4fQ.example'
  };

  // Para este projeto, vamos usar um sistema híbrido:
  // - Dados locais (IndexedDB) como principal
  // - Sincronização opcional com servidor quando disponível
  
  // Detectar se estamos em desenvolvimento ou produção
  const isDevelopment = window.location.protocol === 'file:' || 
                       window.location.hostname === 'localhost' ||
                       window.location.hostname === '127.0.0.1';

  // Configuração adaptativa baseada no ambiente
  const config = {
    // Usar sistema local robusto para desenvolvimento
    useLocalStorage: isDevelopment,
    
    // Configurações do Supabase para produção
    supabase: {
      url: SUPABASE_CONFIG.url,
      key: SUPABASE_CONFIG.anonKey,
      enabled: !isDevelopment && navigator.onLine
    },
    
    // Configurações de sincronização
    sync: {
      enabled: true,
      interval: 30000, // 30 segundos
      retryAttempts: 3,
      retryDelay: 5000 // 5 segundos
    }
  };

  // Disponibilizar configuração globalmente
  window.SUPABASE_CONFIG = config;
  
  console.log('🔧 Configuração do Supabase carregada:', {
    environment: isDevelopment ? 'development' : 'production',
    localStorage: config.useLocalStorage,
    supabaseEnabled: config.supabase.enabled
  });

})();
