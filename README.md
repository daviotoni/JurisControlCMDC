# JurisControl CMDC

Sistema de gestão jurídica para controle de processos, clientes, agenda e financeiro.

## 🚀 Funcionalidades

- **Gestão de Processos**: Controle completo de processos jurídicos
- **Agenda Integrada**: Calendário com prazos e compromissos
- **Gestão Financeira**: Controle de honorários e despesas
- **Documentos**: Upload e organização de documentos
- **Relatórios**: Geração de relatórios em PDF e Excel
- **Backup/Restore**: Sistema de backup automático dos dados

## 🛡️ Segurança

Este projeto implementa várias camadas de segurança:

### Dados Sensíveis
- ✅ Credenciais removidas do código-fonte
- ✅ Variáveis de ambiente configuradas
- ✅ `.gitignore` configurado para proteger arquivos sensíveis

### Autenticação
- 🔐 Sistema de login com controle de tentativas
- ⏱️ Timeout de sessão automático (30 minutos)
- 🔒 Bloqueio temporário após múltiplas tentativas falhas

### Validações
- ✅ Sanitização de entradas do usuário
- ✅ Validação de tipos de arquivo
- ✅ Limite de tamanho de arquivos (10MB)

## 📁 Estrutura do Projeto

```
JurisControlCMDC/
├── index.html              # Aplicação principal
├── script.js               # Lógica da aplicação
├── style.css               # Estilos CSS
├── firebase.js             # Configuração Firebase (segura)
├── security-config.js      # Configurações de segurança
├── env-config.js           # Carregador de variáveis de ambiente
├── .env.example            # Exemplo de variáveis de ambiente
├── .gitignore              # Arquivos ignorados pelo Git
└── README.md               # Este arquivo
```

## 🔧 Configuração

### 1. Variáveis de Ambiente

Copie o arquivo `.env.example` para `.env` e configure suas credenciais:

```bash
cp .env.example .env
```

Edite o arquivo `.env` com suas credenciais reais do Firebase:

```env
FIREBASE_API_KEY=sua_api_key_aqui
FIREBASE_AUTH_DOMAIN=seu_projeto.firebaseapp.com
FIREBASE_PROJECT_ID=seu_projeto_id
FIREBASE_STORAGE_BUCKET=seu_projeto.firebasestorage.app
FIREBASE_MESSAGING_SENDER_ID=seu_sender_id
FIREBASE_APP_ID=seu_app_id
```

### 2. Incluir Scripts de Segurança

Para usar o sistema de segurança, inclua os scripts no seu HTML:

```html
<!-- Antes do firebase.js -->
<script src="env-config.js"></script>
<script src="security-config.js"></script>
<script type="module" src="firebase.js"></script>
```

### 3. Hospedagem

#### Desenvolvimento Local
- Abra o `index.html` diretamente no navegador
- As configurações de desenvolvimento serão carregadas automaticamente

#### Produção
- Configure as variáveis de ambiente no seu provedor de hospedagem
- Exemplos: Vercel, Netlify, Firebase Hosting, GitHub Pages

## 🔐 Boas Práticas de Segurança

### ❌ NUNCA faça:
- Commitar arquivos `.env` no Git
- Expor credenciais no código-fonte
- Usar senhas fracas
- Ignorar validações de entrada

### ✅ SEMPRE faça:
- Use senhas fortes (8+ caracteres, maiúsculas, números, símbolos)
- Mantenha backups regulares
- Monitore logs de segurança
- Atualize dependências regularmente

## 📊 Monitoramento

O sistema inclui monitoramento de segurança que registra:
- Tentativas de login
- Eventos de segurança
- Manipulação de ferramentas de desenvolvedor
- Ações suspeitas

Os logs são armazenados localmente e podem ser visualizados no console do navegador.

## 🆘 Suporte

Para questões de segurança ou problemas técnicos:

1. Verifique os logs de segurança no console
2. Consulte a documentação do Firebase
3. Entre em contato com o administrador do sistema

## 📝 Changelog

### v1.1.0 - Melhorias de Segurança
- ✅ Removidas credenciais do código-fonte
- ✅ Implementado sistema de variáveis de ambiente
- ✅ Adicionado sistema de segurança robusto
- ✅ Criado sistema de monitoramento
- ✅ Melhorada documentação

### v1.0.0 - Versão Inicial
- ✅ Sistema básico de gestão jurídica
- ✅ Interface responsiva
- ✅ Armazenamento local com IndexedDB

---

**⚠️ IMPORTANTE**: Este sistema lida com dados jurídicos sensíveis. Sempre siga as melhores práticas de segurança e mantenha backups regulares.
