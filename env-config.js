// Script para carregar configurações de ambiente no frontend
// Este arquivo deve ser carregado antes do firebase.js

(function() {
  'use strict';
  
  // Configurações para desenvolvimento local
  // Em produção, essas variáveis devem ser injetadas pelo servidor ou build process
  const developmentConfig = {
    FIREBASE_API_KEY: "AIZaSyB9dx_F8splj8n_ajSJRGiAqb02u8dUvJQ",
    FIREBASE_AUTH_DOMAIN: "juriscontrolcmdc.firebaseapp.com",
    FIREBASE_PROJECT_ID: "juriscontrolcmdc",
    FIREBASE_STORAGE_BUCKET: "juriscontrolcmdc.firebasestorage.app",
    FIREBASE_MESSAGING_SENDER_ID: "570109438050",
    FIREBASE_APP_ID: "1:570109438050:web:ddb296a9863cdd294e093b"
  };
  
  // Detectar se estamos em desenvolvimento (file:// ou localhost)
  const isDevelopment = window.location.protocol === 'file:' || 
                       window.location.hostname === 'localhost' ||
                       window.location.hostname === '127.0.0.1';
  
  // Em desenvolvimento, usar as configurações locais
  // Em produção, as variáveis devem vir do servidor
  if (isDevelopment) {
    Object.assign(window, developmentConfig);
    console.log('🔧 Modo desenvolvimento: usando configurações locais do Firebase');
  } else {
    console.log('🚀 Modo produção: usando configurações do servidor');
  }
  
  // Verificar se todas as configurações necessárias estão disponíveis
  const requiredVars = [
    'FIREBASE_API_KEY',
    'FIREBASE_AUTH_DOMAIN', 
    'FIREBASE_PROJECT_ID',
    'FIREBASE_STORAGE_BUCKET',
    'FIREBASE_MESSAGING_SENDER_ID',
    'FIREBASE_APP_ID'
  ];
  
  const missingVars = requiredVars.filter(varName => !window[varName]);
  
  if (missingVars.length > 0) {
    console.error('❌ Configurações do Firebase ausentes:', missingVars);
    console.error('Verifique se as variáveis de ambiente estão configuradas corretamente.');
  } else {
    console.log('✅ Todas as configurações do Firebase estão disponíveis');
  }
})();
