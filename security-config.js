// Configurações de Segurança para JurisControl
// Este arquivo contém configurações e utilitários de segurança

(function() {
  'use strict';

  // Configurações de segurança
  const SECURITY_CONFIG = {
    // Configurações de sessão
    SESSION_TIMEOUT: 30 * 60 * 1000, // 30 minutos em millisegundos
    MAX_LOGIN_ATTEMPTS: 5,
    LOCKOUT_DURATION: 15 * 60 * 1000, // 15 minutos
    
    // Configurações de senha
    MIN_PASSWORD_LENGTH: 8,
    REQUIRE_SPECIAL_CHARS: true,
    REQUIRE_NUMBERS: true,
    REQUIRE_UPPERCASE: true,
    
    // Configurações de dados
    MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
    ALLOWED_FILE_TYPES: ['.pdf', '.doc', '.docx', '.txt', '.jpg', '.jpeg', '.png'],
    
    // Configurações de backup
    AUTO_BACKUP_INTERVAL: 24 * 60 * 60 * 1000, // 24 horas
    MAX_BACKUP_FILES: 7
  };

  // Utilitários de segurança
  const SecurityUtils = {
    
    // Validação de senha forte
    validatePassword(password) {
      const errors = [];
      
      if (password.length < SECURITY_CONFIG.MIN_PASSWORD_LENGTH) {
        errors.push(`Senha deve ter pelo menos ${SECURITY_CONFIG.MIN_PASSWORD_LENGTH} caracteres`);
      }
      
      if (SECURITY_CONFIG.REQUIRE_UPPERCASE && !/[A-Z]/.test(password)) {
        errors.push('Senha deve conter pelo menos uma letra maiúscula');
      }
      
      if (SECURITY_CONFIG.REQUIRE_NUMBERS && !/\d/.test(password)) {
        errors.push('Senha deve conter pelo menos um número');
      }
      
      if (SECURITY_CONFIG.REQUIRE_SPECIAL_CHARS && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
        errors.push('Senha deve conter pelo menos um caractere especial');
      }
      
      return {
        isValid: errors.length === 0,
        errors: errors
      };
    },

    // Sanitização de entrada
    sanitizeInput(input) {
      if (typeof input !== 'string') return input;
      
      return input
        .replace(/[<>]/g, '') // Remove < e >
        .replace(/javascript:/gi, '') // Remove javascript:
        .replace(/on\w+=/gi, '') // Remove event handlers
        .trim();
    },

    // Validação de arquivo
    validateFile(file) {
      const errors = [];
      
      if (file.size > SECURITY_CONFIG.MAX_FILE_SIZE) {
        errors.push(`Arquivo muito grande. Máximo: ${SECURITY_CONFIG.MAX_FILE_SIZE / 1024 / 1024}MB`);
      }
      
      const extension = '.' + file.name.split('.').pop().toLowerCase();
      if (!SECURITY_CONFIG.ALLOWED_FILE_TYPES.includes(extension)) {
        errors.push(`Tipo de arquivo não permitido. Permitidos: ${SECURITY_CONFIG.ALLOWED_FILE_TYPES.join(', ')}`);
      }
      
      return {
        isValid: errors.length === 0,
        errors: errors
      };
    },

    // Geração de hash simples para senhas (para demonstração)
    async hashPassword(password) {
      const encoder = new TextEncoder();
      const data = encoder.encode(password + 'juriscontrol_salt_2024');
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    },

    // Verificação de tentativas de login
    checkLoginAttempts(username) {
      const key = `login_attempts_${username}`;
      const attempts = JSON.parse(localStorage.getItem(key) || '{"count": 0, "lastAttempt": 0}');
      
      const now = Date.now();
      const timeSinceLastAttempt = now - attempts.lastAttempt;
      
      // Reset contador se passou do tempo de lockout
      if (timeSinceLastAttempt > SECURITY_CONFIG.LOCKOUT_DURATION) {
        attempts.count = 0;
      }
      
      return {
        isLocked: attempts.count >= SECURITY_CONFIG.MAX_LOGIN_ATTEMPTS && 
                 timeSinceLastAttempt < SECURITY_CONFIG.LOCKOUT_DURATION,
        attemptsRemaining: Math.max(0, SECURITY_CONFIG.MAX_LOGIN_ATTEMPTS - attempts.count),
        lockoutTimeRemaining: attempts.count >= SECURITY_CONFIG.MAX_LOGIN_ATTEMPTS ? 
                             Math.max(0, SECURITY_CONFIG.LOCKOUT_DURATION - timeSinceLastAttempt) : 0
      };
    },

    // Registrar tentativa de login
    recordLoginAttempt(username, success) {
      const key = `login_attempts_${username}`;
      const attempts = JSON.parse(localStorage.getItem(key) || '{"count": 0, "lastAttempt": 0}');
      
      if (success) {
        // Reset contador em caso de sucesso
        localStorage.removeItem(key);
      } else {
        // Incrementar contador em caso de falha
        attempts.count++;
        attempts.lastAttempt = Date.now();
        localStorage.setItem(key, JSON.stringify(attempts));
      }
    },

    // Verificação de sessão ativa
    checkSession() {
      const session = JSON.parse(localStorage.getItem('userSession') || 'null');
      if (!session) return false;
      
      const now = Date.now();
      const sessionAge = now - session.loginTime;
      
      if (sessionAge > SECURITY_CONFIG.SESSION_TIMEOUT) {
        localStorage.removeItem('userSession');
        return false;
      }
      
      // Atualizar timestamp da sessão
      session.lastActivity = now;
      localStorage.setItem('userSession', JSON.stringify(session));
      
      return true;
    },

    // Logout seguro
    secureLogout() {
      // Limpar dados sensíveis
      localStorage.removeItem('userSession');
      localStorage.removeItem('currentUser');
      
      // Limpar cache se necessário
      if ('caches' in window) {
        caches.keys().then(names => {
          names.forEach(name => {
            if (name.includes('juriscontrol')) {
              caches.delete(name);
            }
          });
        });
      }
      
      console.log('🔒 Logout seguro realizado');
    }
  };

  // Monitoramento de segurança
  const SecurityMonitor = {
    
    // Detectar tentativas de manipulação do console
    detectConsoleManipulation() {
      let devtools = false;
      const threshold = 160;
      
      setInterval(() => {
        if (window.outerHeight - window.innerHeight > threshold || 
            window.outerWidth - window.innerWidth > threshold) {
          if (!devtools) {
            devtools = true;
            console.warn('🔍 Ferramentas de desenvolvedor detectadas');
            // Aqui você pode adicionar ações adicionais se necessário
          }
        } else {
          devtools = false;
        }
      }, 500);
    },

    // Log de ações de segurança
    logSecurityEvent(event, details = {}) {
      const logEntry = {
        timestamp: new Date().toISOString(),
        event: event,
        details: details,
        userAgent: navigator.userAgent,
        url: window.location.href
      };
      
      console.log('🔐 Evento de segurança:', logEntry);
      
      // Armazenar logs localmente (em produção, enviar para servidor)
      const logs = JSON.parse(localStorage.getItem('security_logs') || '[]');
      logs.push(logEntry);
      
      // Manter apenas os últimos 100 logs
      if (logs.length > 100) {
        logs.splice(0, logs.length - 100);
      }
      
      localStorage.setItem('security_logs', JSON.stringify(logs));
    }
  };

  // Disponibilizar globalmente
  window.SECURITY_CONFIG = SECURITY_CONFIG;
  window.SecurityUtils = SecurityUtils;
  window.SecurityMonitor = SecurityMonitor;

  // Inicializar monitoramento
  SecurityMonitor.detectConsoleManipulation();
  SecurityMonitor.logSecurityEvent('security_system_initialized');

  console.log('🛡️ Sistema de segurança JurisControl inicializado');

})();
