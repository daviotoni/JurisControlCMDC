# JurisControl — Notas para o Claude

## ⭐ DEPLOY / HOSPEDAGEM — LEIA SEMPRE (ver DEPLOY.md para detalhes)

O domínio real **https://juriscontrolcmdc.com.br é servido pelo GitHub Pages a
partir da branch `main`**. Ele só atualiza quando há push na `main` (o GitHub
Pages reconstrói sozinho). **`firebase deploy` NÃO atualiza o `.com.br`.**

- `juriscontrolcmdc.com.br`  → GitHub Pages (branch `main`)  ← domínio de produção
- `juriscontrolcmdc.web.app` → Firebase Hosting (`firebase deploy`)
- `procuradoriacmdc.web.app` → Firebase Hosting — **redundante, será excluído** (quota acabando)

**Regra de ouro:** se "o site não atualizou", quase sempre é porque a mudança
não chegou na `main`. Mergeie na `main` e dê push.

**Cache busting:** ao mudar `js/app.js` ou `style.css`, atualize o `?v=...` na
tag correspondente do `index.html`, senão o navegador serve a versão em cache.

## Deploy Firebase (manual)

```bash
firebase deploy --only hosting --token "<TOKEN>" --project juriscontrolcmdc
```
`firebase.json` é multi-site (array). Obs: `procuradoriacmdc` deve ser removido
do array quando o site for excluído.

## Login

Painel azul com a marca no topo e o brasão grande ao centro (a abertura
pousa o brasão em `.login-hero-shield`); formulário com título em EB
Garamond. Em telas largas porém em pé (celular em "site para computador")
o layout empilha: brasão em cima, formulário embaixo.

## Visual das páginas internas — `html.ui-v3` ("tinta")

Padrão desde o redesenho inspirado no Harvey/Mercury. Bloco "VISUAL NOVO"
no fim do `style.css`, tudo atrás de `.ui-v3` (ligada no `<head>`, a menos
que `localStorage['jc-ui'] === 'classico'` — opção "Usar o visual clássico"
em Configurações → Aparência). Princípios: títulos de página e números
grandes em EB Garamond; barra lateral azul-tinta com grupos e usuário no
rodapé (`#sidebarUser`); quase nenhuma cor (só vencidos/vencendo); sem
emojis na interface; gráficos com a paleta `statusColorMapV3`.

## App de celular (`mobile/` → `/app`)

Mesma linguagem "tinta": paleta em `mobile/src/theme/tokens.ts` (sincronizar
com o web), cabeçalho azul-tinta liso (`NavyHeader`), títulos e números em
EB Garamond (`fonts.serif` / `fonts.serifRegular`, só os pesos 400 e 500 são
importados em `App.tsx`). Depois de mudar o `mobile/`, rodar
`cd mobile && npm run build:site` e commitar a pasta `/app`.

## Stack

App estático (HTML/CSS/JS puro) + Firebase (Auth, Firestore, Storage).
Arquivos principais: `index.html`, `style.css`, `js/app.js`.

### Camada de movimento (animações)

Opcional e desligável — se falhar ou for desligada, o app fica igual ao de antes:

- `js/motion.js` — marcador deslizante da barra lateral, cascata na troca de
  aba, contador dos KPIs, revelação circular do tema, carregamento do login.
- `style.css`, bloco final "CAMADA DE MOVIMENTO (v2)" — todo atrás de
  `html.jc-motion`, que só o motion.js (e o script inline do `<head>`) liga.
- Abertura com o brasão (`#jcIntro` no `index.html`, SVG vetorizado de
  `img/brasao-shield.png`): uma vez por sessão (`sessionStorage['jc-intro-visto']`),
  some sozinha em 5s se o JS falhar; o js/app.js avisa o destino via
  `JCMotion.loginPronto()` / `JCMotion.hideLogin()`.
- Desliga com `prefers-reduced-motion` ou em Configurações → Aparência
  (`localStorage['jc-motion'] = 'off'`, por navegador).
- **Nunca** animar `transform` na `.sidebar`: abaixo de 992px ela usa
  `transform` para o menu-gaveta (foi o bug da primeira versão, revertida).
