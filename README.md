# JurisControl CMDC

Sistema de controle de processos jurídicos da Procuradoria da Câmara Municipal de Duque de Caxias.

O repositório reúne o sistema web/desktop estático, as regras Firebase, Cloud Functions de apoio, a versão mobile em Expo/React Native e o build web publicado do app mobile.

## Visão geral

- **Web/desktop**: aplicação HTML/CSS/JavaScript estática servida a partir de `index.html`, `style.css` e `js/`.
- **Mobile**: app React Native/Expo em `mobile/`, com documentação própria em `mobile/README.md`.
- **App mobile publicado na web**: build gerado em `app/`, servido em `/app/` pelo GitHub Pages.
- **Backend**: Firebase Auth, Firestore e Storage no projeto `juriscontrolcmdc`.
- **Segurança**: regras em `firestore.rules` e `storage.rules`, com controle de acesso por perfil aprovado.
- **Functions**: integrações e rotinas de apoio em `functions/`.

## Funcionalidades principais

- Cadastro e acompanhamento de processos jurídicos.
- Controle de status, prazos e alertas de vencimento.
- Agenda com eventos e prazos de processos ativos.
- Gestão de pareceres estruturados, versões e documentos legados.
- Histórico por processo e auditoria central.
- Gestão de usuários com aprovação por administrador.
- Interface web/desktop e app mobile usando o mesmo backend.

## Estrutura do repositório

```text
.
├── index.html                 # Entrada do sistema web/desktop
├── style.css                  # Estilos do sistema web/desktop
├── js/                        # Lógica do sistema web e helpers Firebase
├── firestore.rules            # Regras de acesso do Firestore
├── storage.rules              # Regras de acesso do Firebase Storage
├── functions/                 # Cloud Functions e normalizadores
├── mobile/                    # App Expo/React Native
├── app/                       # Build web publicado do app mobile
├── test/                      # Testes web, mobile e regras Firebase
├── package.json               # Scripts de lint/test da raiz
└── DEPLOY.md                  # Notas de deploy
```

## Desenvolvimento local

Instale as dependências da raiz:

```bash
npm install
```

Rode a suíte de testes principal:

```bash
npm test -- --run
```

Rode o lint do JavaScript web:

```bash
npm run lint
```

Para testes das regras Firebase, use:

```bash
npm run test:rules
```

Esse comando usa emuladores do Firebase para validar `firestore.rules` e `storage.rules`.

## App mobile

O app mobile fica em `mobile/` e reutiliza o mesmo backend Firebase do sistema web.

```bash
cd mobile
npm install
npx expo start
```

Para atualizar o build web do app mobile publicado em `/app/`:

```bash
cd mobile
npm run build:site
```

Depois, commite as alterações geradas em `app/` junto com as mudanças do app.

## Modelo de acesso

O sistema usa Firebase Auth e a coleção `perfis/{uid}` para controle de acesso:

- Usuários autenticados criam um perfil próprio no primeiro login.
- Novos perfis comuns começam pendentes.
- Um administrador aprova usuários na área de configurações.
- Usuários aprovados acessam os dados de trabalho.
- Administradores gerenciam perfis, auditoria, restauração e segredos.

As regras do Firestore não usam regra curinga permissiva: coleções novas devem ser adicionadas explicitamente em `firestore.rules` antes de uso em produção.

## Segurança operacional

- Mantenha a lista de administradores bootstrap sincronizada entre `js/app.js` e `firestore.rules`.
- Evite publicar novas coleções sem regras específicas.
- Rode os testes de regras antes de alterações em permissões.
- Não armazene segredos no código-fonte; use a coleção/infraestrutura prevista para integrações administrativas.
- Revise periodicamente os fluxos de fallback de autenticação para garantir que falhas de configuração não concedam privilégios indevidos.

## Deploy

Consulte `DEPLOY.md` para o fluxo de publicação do sistema web e das regras.

Resumo operacional:

1. Rode testes e lint.
2. Se alterar o mobile, regenere `app/` com `npm run build:site` dentro de `mobile/`.
3. Publique alterações estáticas via GitHub Pages conforme a branch configurada.
4. Publique regras Firebase com as ferramentas oficiais do Firebase quando houver alterações em `firestore.rules` ou `storage.rules`.

## Qualidade

Scripts úteis da raiz:

- `npm test -- --run`: executa a suíte Vitest principal.
- `npm run lint`: valida `js/` com ESLint.
- `npm run test:rules`: executa testes das regras Firestore/Storage nos emuladores Firebase.
