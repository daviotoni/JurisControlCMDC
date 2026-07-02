# JurisControl CMDC — App Mobile

App mobile (React Native / Expo) do JurisControl, sistema de controle de
processos jurídicos da Procuradoria da Câmara Municipal de Duque de Caxias.
Implementa em alta fidelidade os designs "Navy Hero" do handoff
(`design_handoff_mobile_app`), incluindo dark mode.

> ⚠️ O sistema web/desktop (`index.html`, `style.css`, `js/` na raiz do
> repositório) **não foi alterado** — este app vive inteiramente em `mobile/`
> e apenas **reutiliza o mesmo backend Firebase** (Auth, Firestore, Storage,
> projeto `juriscontrolcmdc`).

## Rodando

```bash
cd mobile
npm install
npx expo start        # abre no Expo Go (Android/iOS) ou emulador
```

Login: as mesmas credenciais (e-mail/senha) do Firebase Auth usadas no site.

## Versão web (publicada no site)

O mesmo código roda como web app em **https://juriscontrolcmdc.com.br/app/**
(pasta `/app` na raiz do repositório, servida pelo GitHub Pages da `main`).
Para atualizar o site após mudar o código do app:

```bash
cd mobile
npm run build:site    # regenera a pasta ../app
# commit + push na main (o GitHub Pages publica sozinho)
```

O arquivo `.nojekyll` na raiz do repositório é obrigatório — sem ele o
GitHub Pages ignora a pasta `app/_expo` (prefixo `_`).

## Stack

- **Expo SDK 57** / React Native 0.86 / TypeScript
- **React Navigation** (bottom tabs com barra flutuante custom + native stack)
- **Firebase JS SDK v12** — Auth com persistência em AsyncStorage, Firestore
  em tempo real (`onSnapshot`)
- **IBM Plex Sans** (expo-google-fonts) e ícones Feather (@expo/vector-icons)

## Espelhamento do modelo de dados do web

Os documentos são gravados exatamente como o desktop (`js/firestoreHelper.js`):
doc id = `String(rec.id)`, objeto completo via `set`. Coleções usadas:
`processos`, `calendario`, `leis`, `users`, `emissores`, `modelos`,
`pareceres`, `parecerVersoes`, `historico` e `config/main_cfg`
(notificações lidas). Regras de negócio espelhadas de `js/app.js`:

- **Status e cores** de processo idênticos (pendente, em-análise, aguardando
  documentação, em diligência, finalizado, arquivado).
- **Prazos**: vencido (< 0 dias), alerta (≤ 5 dias; na lista < 3), KPI
  "Vencendo (≤5 dias)", recalculados a partir da data atual.
- **Alertas inteligentes**: processos vencidos + sem movimentação há +20 dias.
- **Notificações** derivadas de prazos + eventos dos próximos 7 dias (não é
  coleção própria); "Marcar lidas" persiste em `config/main_cfg`.
- **Agenda** com os prazos dos processos ativos injetados como eventos
  `pr-<id>` (categoria "Término de prazo"), somente leitura — tocar abre o
  processo.
- **Histórico** de criação/edição/exclusão gravado na coleção `historico`
  com os mesmos campos rastreados do web.

## Estrutura

```
mobile/
  App.tsx                     # fontes + providers + navegação
  src/
    theme/tokens.ts           # design tokens do handoff (claro/escuro/status)
    theme/ThemeContext.tsx    # tema persistido (AsyncStorage)
    lib/firebase.ts           # mesmo projeto Firebase do web
    lib/types.ts              # tipos espelhando o modelo do web
    lib/dates.ts, model.ts    # datas UTC + regras de prazo/KPI/notificações
    lib/files.ts              # exportar/compartilhar arquivos
    data/DataContext.tsx      # auth + listeners Firestore + CRUD
    navigation/               # tabs flutuantes + stack
    components/               # NavyHeader, pills, segmented, FAB, forms…
    screens/                  # Login, Dashboard, Processos (lista/kanban/
                              # detalhe/form), Notificações, Agenda (mês/
                              # semana/dia), Perfil, Documentos, Leis, Config
```

## Adaptações mobile (documentadas)

- **Kanban**: mover card entre colunas = **toque longo** no card → escolher a
  coluna (equivalente touch do drag-and-drop do web; persiste no Firestore).
- **Pareceres**: a redação/emissão (editor Quill) permanece no desktop; o
  app exibe status, ementa e busca no conteúdo, e vincula ao processo.
- **Downloads** (modelos .docx, CSV, backup .json) usam a folha de
  compartilhar do sistema (expo-sharing).
- A tela de **Login é sempre clara**, como no web; o restante segue o toggle
  de tema escuro do Perfil.
