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

## Stack

App estático (HTML/CSS/JS puro) + Firebase (Auth, Firestore, Storage).
Arquivos principais: `index.html`, `style.css`, `js/app.js`.
