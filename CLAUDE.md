# JurisControl — Notas para o Claude

## ⭐ DEPLOY / HOSPEDAGEM — LEIA SEMPRE (ver DEPLOY.md para detalhes)

O domínio real **https://juriscontrolcmdc.com.br é servido pelo GitHub Pages a
partir da branch `main`**. Ele só atualiza quando há push na `main` (o GitHub
Pages reconstrói sozinho). **`firebase deploy` NÃO atualiza o `.com.br`.**

- `juriscontrolcmdc.com.br`  → GitHub Pages (branch `main`)  ← domínio de produção
- `juriscontrolcmdc.web.app` → Firebase Hosting — **agora também atualiza sozinho**
  via GitHub Actions (`.github/workflows/firebase-hosting-merge.yml`) a cada push
  na `main`, desde que o secret `FIREBASE_SERVICE_ACCOUNT_JURISCONTROLCMDC` esteja
  configurado no repositório (Settings → Secrets and variables → Actions).
- `procuradoriacmdc.web.app` → Firebase Hosting — **redundante, será excluído** (quota acabando)

**Regra de ouro:** se "o site não atualizou", quase sempre é porque a mudança
não chegou na `main`. Mergeie na `main` e dê push — isso agora atualiza os dois
domínios (`.com.br` e `.web.app`) automaticamente.

**Cache busting:** ao mudar `js/app.js` ou `style.css`, atualize o `?v=...` na
tag correspondente do `index.html`, senão o navegador serve a versão em cache.

## Deploy Firebase

Automático via GitHub Actions a cada push na `main` (ver acima). Deploy manual
só é necessário se o workflow falhar ou o secret não estiver configurado:

```bash
firebase deploy --only hosting:juriscontrolcmdc --token "<TOKEN>" --project juriscontrolcmdc
```
`firebase.json` é multi-site (array). Obs: `procuradoriacmdc` deve ser removido
do array quando o site for excluído (e do workflow, se também for automatizado).

## Stack

App estático (HTML/CSS/JS puro) + Firebase (Auth, Firestore, Storage).
Arquivos principais: `index.html`, `style.css`, `js/app.js`.
