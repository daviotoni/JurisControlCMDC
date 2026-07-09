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

## App mobile web (/app)

A versão mobile do JurisControl vive em **https://juriscontrolcmdc.com.br/app/**.
É o app React Native/Expo de `mobile/` exportado como web estático para a pasta
`/app` da raiz (servida pelo mesmo GitHub Pages da `main`). Para atualizar:

```bash
cd mobile && npm run build:site   # regenera /app
# commit + push na main
```

O `.nojekyll` na raiz é obrigatório (sem ele o Pages ignora `app/_expo`).
Não edite `/app` na mão — é build gerado.

## Regras do Firestore (controle de acesso por papel)

As `firestore.rules` implementam acesso por papel: cada usuário tem um doc em
`perfis/{uid}` (`role: admin|user`, `aprovado: true|false`). No primeiro login
o perfil é criado **pendente**; um admin aprova em Configurações → "Usuários e
Aprovações". Sem aprovação, nada é lido/escrito.

> ⚠️ As regras **NÃO** sobem com o push na `main` — o deploy é manual:
>
> ```bash
> firebase deploy --only firestore:rules --token "<TOKEN>" --project juriscontrolcmdc
> ```
>
> **Antes do primeiro deploy destas regras**, confirme que o e-mail admin de
> bootstrap (anti-lockout) está correto em DOIS lugares: `bootstrapAdmin()`
> em `firestore.rules` e `BOOTSTRAP_ADMINS` em `js/app.js`. Esse e-mail é
> sempre admin, mesmo sem perfil — é ele que aprova os demais usuários.
>
> Enquanto as regras novas não forem publicadas, o app roda em modo de
> compatibilidade (comportamento antigo: todo autenticado tem acesso total).

Testes das regras: `npm run test:rules` (sobe o emulador do Firestore e valida
aprovação, papéis, bootstrap e o append-only da auditoria).

## Busca de jurisprudência integrada (Cloud Function `juris`)

O painel "⚖ Jurisprudência" do editor de parecer tem uma busca integrada
("Buscar aqui") que consulta o LexML (por tema) e o Datajud/CNJ (por nº de
processo) através da Cloud Function `functions/juris`. A função valida o
ID token do Firebase e exige perfil **aprovado** (mesma política das rules).

> ⚠️ **Ativação (2 passos manuais, uma única vez):**
>
> 1. **Plano Blaze**: Cloud Functions exige billing habilitado. Console →
>    https://console.firebase.google.com/project/juriscontrolcmdc/usage/details
>    → "Modificar plano" → Blaze. O uso desta função fica na faixa gratuita
>    (2 milhões de invocações/mês grátis).
> 2. **Publicar a função**:
>    ```bash
>    cd functions && npm install && cd ..
>    firebase deploy --only functions --token "<TOKEN>" --project juriscontrolcmdc
>    ```
>
> Enquanto a função não for publicada, o botão "Buscar aqui" mostra um aviso
> e os botões dos portais (STF/STJ/TJRJ/LexML/Jusbrasil) seguem funcionando.

Notas:
- A chave do Datajud usada é a chave PÚBLICA divulgada pelo próprio CNJ
  (documentação da API Pública). Se o CNJ rotacionar, atualize
  `DATAJUD_API_KEY` em `functions/index.js` e republique.
- A URL da função esperada pelo site é
  `https://us-central1-juriscontrolcmdc.cloudfunctions.net/juris`
  (constante `JURIS_FUNCTION_URL` em `js/app.js`).
- Os normalizadores de resposta têm testes offline em
  `test/web/juris-normalizadores.test.js`; a primeira chamada real às fontes
  externas deve ser validada após o deploy (o sandbox de desenvolvimento não
  alcança lexml.gov.br / datajud.cnj.br).

## Deploy no Firebase (manual)

```bash
firebase deploy --only hosting --token "<TOKEN>" --project juriscontrolcmdc
```

O `firebase.json` está configurado como multi-site (array com `juriscontrolcmdc`
e `procuradoriacmdc`), então um único `firebase deploy` publica nos dois sites
`web.app` de uma vez.
