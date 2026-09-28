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

## Login (linguagem editorial)

Painel azul com medalhão em guilhochê (`img/guilloche-a.svg` e `-b.svg`,
gerados por curvas — duas camadas girando em sentidos opostos criam o moiré)
e citação do art. 37 da CF; título do formulário em EB Garamond. Em telas
largas porém em pé (celular em "site para computador") o layout empilha.
A abertura pousa o brasão em `.login-hero-shield`, no centro do medalhão.

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
