# Como o JurisControl é publicado (LEIA ANTES DE MEXER NO DEPLOY)

Este projeto é servido em **dois lugares diferentes ao mesmo tempo**. Entender
isso evita o bug clássico de "publiquei mas o site não atualizou".

## Onde cada URL é hospedada

| URL | Hospedagem | Atualiza quando... |
|-----|-----------|--------------------|
| **https://juriscontrolcmdc.com.br** (domínio real) | **GitHub Pages** | a branch **`main`** recebe um push |
| https://juriscontrolcmdc.web.app | Firebase Hosting (site `juriscontrolcmdc`) | roda `firebase deploy` |
| https://procuradoriacmdc.web.app | Firebase Hosting (site `procuradoriacmdc`) | roda `firebase deploy` |

> ⭐ **REGRA DE OURO:** para o **`juriscontrolcmdc.com.br`** atualizar, a
> correção **precisa chegar na branch `main`**. O GitHub Pages reconstrói o
> site automaticamente a cada push na `main` (workflow "pages build and
> deployment"). Fazer `firebase deploy` **NÃO** atualiza o `.com.br`.

## Fluxo correto para publicar uma mudança

1. Desenvolver e commitar na branch de feature.
2. **Mergear na `main`** (via PR ou `git merge`) e dar push em `origin/main`.
3. Aguardar 1-2 min o GitHub Pages reconstruir.
4. Abrir o `.com.br` e dar **Ctrl+Shift+R** (hard refresh) para furar o cache.
5. (Opcional) `firebase deploy --only hosting` para manter os `web.app` em dia.

## Diagnóstico rápido se "o site não atualiza"

1. **A mudança está na `main`?** `git log origin/main` — se não, é isso. Mergeie.
2. **O build do Pages rodou?** Veja em Actions → "pages build and deployment".
3. **É cache?** Teste em janela anônima. Se funcionar lá, é só limpar o cache.
4. **É bug de código?** Abra o Console do navegador (F12) e veja se há erro.

## Cache busting

`index.html` referencia `app.js?v=AAAAMMDD-xxx` e `style.css?v=...`. **Sempre
que mudar esses arquivos, atualize o número de versão** na tag, senão o
navegador serve a versão antiga em cache.

## Deploy no Firebase (manual)

```bash
firebase deploy --only hosting --token "<TOKEN>" --project juriscontrolcmdc
```

O `firebase.json` está configurado como multi-site (array com `juriscontrolcmdc`
e `procuradoriacmdc`), então um único `firebase deploy` publica nos dois sites
`web.app` de uma vez.
