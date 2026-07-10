document.addEventListener('DOMContentLoaded', () => {

  // ===== Helpers =====
  const $=(s,sc=document)=>sc.querySelector(s);
  const $$=(s,sc=document)=>Array.from(sc.querySelectorAll(s));
  // Helpers puros (fmtBR, parse, todayUTC, diffDays, ymd, sanitizeHTML, safeCSSClass e as
  // whitelists VALID_STATS/VALID_ACAO/VALID_CAT) foram movidos para js/utils.js, carregado
  // antes deste arquivo — ficam disponíveis aqui como globais.

  // Metadados de exibição por tipo de ação do histórico (ícone/label/texto quando não há campos alterados).
  // Chaves devem ficar em sincronia com VALID_ACAO.
  const ACAO_META = {
      criado: {
          icon: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>`,
          label: 'Processo criado', textoSemCampos: 'Processo cadastrado no sistema.'
      },
      editado: {
          icon: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
          label: 'Processo editado'
      },
      excluido: {
          icon: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`,
          label: 'Processo excluído', textoSemCampos: 'Processo removido do sistema.'
      },
      'parecer-criado': {
          icon: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>`,
          label: 'Parecer criado'
      },
      'parecer-editado': {
          icon: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
          label: 'Parecer editado'
      },
      'parecer-emitido': {
          icon: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
          label: 'Parecer emitido'
      },
      'parecer-reaberto': {
          icon: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><polyline points="3 3 3 8 8 8"/></svg>`,
          label: 'Parecer reaberto para edição'
      }
  };

  // ===== Lógica para Notificações Toast =====
  const TOAST_ICONS = {
      success: `<svg xmlns="http://www.w3.org/2000/svg" class="icon" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"></path></svg>`,
      danger: `<svg xmlns="http://www.w3.org/2000/svg" class="icon" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"></path></svg>`,
      info: `<svg xmlns="http://www.w3.org/2000/svg" class="icon" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"></path></svg>`
  };

  function showToast(message, type = 'success') {
      const container = $('#toast-container');
      if (!container) return;

      const toast = document.createElement('div');
      toast.className = `toast ${type}`;
      toast.innerHTML = `${TOAST_ICONS[type] || ''} <p>${sanitizeHTML(message)}</p>`;
      
      container.appendChild(toast);

      toast.addEventListener('animationend', (e) => {
          if (e.animationName === 'toast-fade-out') {
              toast.remove();
          }
      });
  }

  // Modal de confirmação genérico (substitui window.confirm). messageHtml já deve vir sanitizado.
  function confirmDialog(messageHtml, { title = 'Confirmar ação', confirmLabel = 'Confirmar' } = {}) {
      return new Promise((resolve) => {
          const modal = $('#m_confirm');
          if (!modal) { resolve(window.confirm(messageHtml.replace(/<[^>]+>/g, ''))); return; }
          $('#confirm-title').textContent = title;
          $('#confirm-message').innerHTML = messageHtml;
          const okBtn = $('#confirm-ok'), cancelBtn = $('#confirm-cancel');
          okBtn.textContent = confirmLabel;
          modal.style.display = 'flex';

          let settled = false;
          const cleanup = () => {
              modal.style.display = 'none';
              okBtn.removeEventListener('click', onOk);
              cancelBtn.removeEventListener('click', onCancel);
              modal.removeEventListener('click', onOverlay);
              document.removeEventListener('keydown', onKey);
          };
          const finish = (result) => { if (settled) return; settled = true; cleanup(); resolve(result); };
          const onOk = () => finish(true);
          const onCancel = () => finish(false);
          const onOverlay = (e) => { if (e.target === modal) finish(false); };
          const onKey = (e) => { if (e.key === 'Escape') finish(false); };

          okBtn.addEventListener('click', onOk);
          cancelBtn.addEventListener('click', onCancel);
          modal.addEventListener('click', onOverlay);
          document.addEventListener('keydown', onKey);
      });
  }

    // ===== Usando dbHelper do Firestore (definido em js/firestoreHelper.js) =====
      // O window.dbHelper aponta automaticamente para o Firestore via firestoreHelper.js
      const dbHelper = window.dbHelper;
  // Variáveis de dados em memória
  let DB_PERFIS = [], DB = [], CAL = [], DB_DOCS = [], DB_VERSOES = [], DB_MODELOS = [], DB_EMISSORES = [], DB_LEIS = [];
  let DB_PARECERES = [], DB_PARECER_VERSOES = [];
  let CFG;
  let allNotifications = [];
  
  let parecerCurrentPage = 1;
  let modeloCurrentPage = 1;
  const itemsPerPageDocs = 5;
  let currentlyDisplayedPareceres = [];
  
  async function saveCFG() {
      await dbHelper.put('config', { key: 'main_cfg', value: CFG });
  }
  
  async function loadAllData() {
      const defaultConfig = {
          sync: true,
          rowH: 140,
          theme: 'system',
          readNotifications: [],
          dismissedNotifications: [],
          sidebarCollapsed: false,
          procItemsPerPage: 10
      };
      
      DB = await dbHelper.getAll('processos');
      CAL = await dbHelper.getAll('calendario');
      DB_DOCS = await dbHelper.getAll('documentos');
      DB_VERSOES = await dbHelper.getAll('versoes');
      DB_MODELOS = await dbHelper.getAll('modelos');
      DB_EMISSORES = await dbHelper.getAll('emissores');
      DB_LEIS = await dbHelper.getAll('leis');
      DB_PARECERES = await dbHelper.getAll('pareceres');
      DB_PARECER_VERSOES = await dbHelper.getAll('parecerVersoes');
      
      const loadedCfg = await dbHelper.get('config', 'main_cfg');
      CFG = loadedCfg ? { ...defaultConfig, ...loadedCfg.value } : defaultConfig;
  }

  // ===== PERFIS DE USUÁRIO (controle de acesso por papel) =====
  // Cada usuário do Firebase Auth tem um doc em `perfis/{uid}` com
  // { role: 'admin'|'user', aprovado: bool }. As firestore.rules só liberam os
  // dados para perfis aprovados; um admin aprova novos usuários em Configurações.
  //
  // ⚠️ Espelhe esta lista na função bootstrapAdmin() de firestore.rules
  //    (e-mails em minúsculas). Ela evita lockout: estes e-mails são sempre admin.
  const BOOTSTRAP_ADMINS = ['dosvleite@yahoo.com.br'];

  async function carregarPerfil(firebaseUser) {
      const email = (firebaseUser.email || '').toLowerCase();
      const isBootstrap = BOOTSTRAP_ADMINS.includes(email);
      const ref = window.db.collection('perfis').doc(firebaseUser.uid);
      try {
          const snap = await ref.get();
          if (snap.exists) {
              const perfil = snap.data();
              // Garante que o admin de bootstrap nunca fique rebaixado/pendente.
              if (isBootstrap && (perfil.role !== 'admin' || perfil.aprovado !== true)) {
                  const corrigido = { ...perfil, role: 'admin', aprovado: true };
                  await ref.set(corrigido);
                  return corrigido;
              }
              return perfil;
          }
          // Primeiro login: registra o próprio perfil (pendente, salvo bootstrap).
          const novo = {
              id: firebaseUser.uid,
              uid: firebaseUser.uid,
              email,
              name: email.split('@')[0],
              role: isBootstrap ? 'admin' : 'user',
              aprovado: isBootstrap,
              criadoEm: new Date().toISOString()
          };
          await ref.set(novo);
          return novo;
      } catch (e) {
          // Modo de compatibilidade: regras antigas em produção ainda não conhecem
          // a coleção `perfis` (deploy das rules é manual). Mantém o comportamento
          // atual (todo autenticado tem acesso total) até as regras novas subirem.
          console.warn('Perfil indisponível (regras antigas em produção?). Usando modo de compatibilidade.', e);
          return { uid: firebaseUser.uid, email, name: email.split('@')[0], role: 'admin', aprovado: true, legado: true };
      }
  }

  const loginOverlay = $('#loginOverlay');
  const loginUser = $('#loginUser');
  const loginPass = $('#loginPass');
  const btnEntrar = $('#btnEntrar');
  const loginErro = $('#loginErro');
  const btnSair = $('#btnSair');
  const appLayout = $('.app-layout');
  const welcomeMsg = $('#welcomeMsg');

  function showApp(user) {
    loginOverlay.style.display = 'none';
    appLayout.style.display = 'flex';
    welcomeMsg.textContent = `Bem-vindo, ${sanitizeHTML(user.name)}`;
    applyRoleUI(user.role);
    if (sidebar && CFG.sidebarCollapsed) sidebar.classList.add('collapsed');
    renderDashboard();
    showTab('dashboard');
  }

  // Esconde os recursos de administrador (gestão de usuários, restauração de
  // backup, auditoria) para usuários comuns. As firestore.rules aplicam a mesma
  // restrição no servidor — isto aqui é só para a interface não oferecer o que
  // o usuário não pode fazer.
  function applyRoleUI(role) {
      const ehAdmin = role === 'admin';
      $$('.admin-only').forEach(el => { el.style.display = ehAdmin ? '' : 'none'; });
  }

  function isAdminSession() {
      try { return JSON.parse(sessionStorage.getItem('loggedInUser'))?.role === 'admin'; }
      catch { return false; }
  }

  function mostrarMsgLogin(msg, tipo = 'erro') {
      loginErro.textContent = msg;
      loginErro.classList.toggle('info', tipo === 'info');
  }

  // Mensagem a exibir no próximo showLogin (sobrevive ao signout do observador
  // de auth — ex.: aviso de "conta aguardando aprovação").
  let msgLoginPersistente = null;

  function showLogin() {
    loginOverlay.style.display = 'flex';
    btnEntrar.disabled = false;
    mostrarMsgLogin('');
    if (msgLoginPersistente) {
        mostrarMsgLogin(msgLoginPersistente.msg, msgLoginPersistente.tipo);
        msgLoginPersistente = null;
    }
    loginPass.value = '';
    appLayout.style.display = 'none';
    welcomeMsg.textContent = '';
    loginUser.focus();
  }

  async function fazerLogout() {
    await logAuditoria('auth', 'logout', currentUserName());
    sessionStorage.removeItem('loggedInUser');
    try { await logoutFirebase(); } catch (e) { console.warn('Erro ao encerrar sessão no Firebase:', e); }
    showLogin();
  }

  async function tentarEntrar() {
    const email = loginUser.value.trim();
    const senha = loginPass.value;

    mostrarMsgLogin('');
    btnEntrar.disabled = true;

    try {
        // === LOGIN PELO FIREBASE ===
        // O restante do fluxo (perfil, aprovação, carga de dados) acontece no
        // observador de autenticação em init() — vale para login e para reload.
        await loginComFirebase(email, senha);
        sessionStorage.setItem('registrarLoginAuditoria', 'true');
    } catch (error) {
        console.error(error);
        mostrarMsgLogin('Login ou senha inválidos');
        btnEntrar.disabled = false;
    }
  }

  // "Esqueci a senha" — envia o link de redefinição pelo Firebase Auth.
  async function esqueciSenha() {
      const email = loginUser.value.trim();
      if (!email) {
          mostrarMsgLogin('Digite seu e-mail no campo acima e clique novamente em "Esqueci a senha".');
          loginUser.focus();
          return;
      }
      try {
          await resetSenhaFirebase(email);
      } catch (e) {
          // Mensagem genérica de propósito (não revela se o e-mail existe);
          // só erros de formato/rede merecem destaque.
          if (e && e.code === 'auth/invalid-email') {
              mostrarMsgLogin('E-mail inválido. Confira o endereço digitado.');
              return;
          }
          console.warn('Redefinição de senha:', e && e.code);
      }
      mostrarMsgLogin('Se o e-mail estiver cadastrado, você receberá um link para redefinir a senha. Confira também a caixa de spam.', 'info');
  }

  // Sessão do app é validada contra o estado real do Firebase Auth (persistente entre reloads/deploys),
  // não só contra o sessionStorage — senão um simples refresh de página (ex.: após um deploy) desloga o usuário.
  function checkLoginState(firebaseUser, perfil = null) {
      if (!firebaseUser) {
          sessionStorage.removeItem('loggedInUser');
          showLogin();
          return;
      }
      const loggedInUser = {
          id: firebaseUser.uid,
          name: (perfil && perfil.name) || firebaseUser.email.split('@')[0],
          login: firebaseUser.email,
          role: (perfil && perfil.role) || 'user'
      };
      sessionStorage.setItem('loggedInUser', JSON.stringify(loggedInUser));
      showApp(loggedInUser);
  }
  
  const getDoc = (docId) => DB_DOCS.find(d => d.id === docId);
  const getVersion = (versionId) => DB_VERSOES.find(v => v.id === versionId);
  const getModelo = (modeloId) => DB_MODELOS.find(m => m.id === modeloId);
  // Delegam para funções puras em js/utils.js (versoesDoDocumento, versaoAtual).
  const getVersionsOfDoc = (docId) => versoesDoDocumento(DB_VERSOES, docId);
  const getCurrentVersion = (docId) => versaoAtual(DB_DOCS, DB_VERSOES, docId);
  
  // base64ToArrayBuffer e getMimeType foram movidos para js/utils.js (funções
  // puras, testáveis). Continuam disponíveis como globais.

  function handleDownload(base64Data, filename) {
      try {
          const buffer = base64ToArrayBuffer(base64Data);
          if (buffer.byteLength === 0) throw new Error("Buffer de dados está vazio.");
          const mimeType = getMimeType(filename);
          const blob = new Blob([buffer], { type: mimeType });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url; a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
      } catch (e) {
          console.error("Erro ao baixar:", e);
          showToast("Ocorreu um erro ao preparar o arquivo para download.", "danger");
      }
  }

  function renderPagination(container, totalItems, currentPage, itemsPerPage, onPageChange) {
        container.innerHTML = '';
        const totalPages = Math.ceil(totalItems / itemsPerPage);
        if (totalPages <= 1) return;

        // Com muitas páginas, mostra apenas uma janela ao redor da página atual (+ extremos) para não poluir a tela
        const pages = [];
        const windowSize = 1;
        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || (i >= currentPage - windowSize && i <= currentPage + windowSize)) {
                pages.push(i);
            }
        }

        let paginationHTML = `<button class="page-link ${currentPage === 1 ? 'disabled' : ''}" data-page="${currentPage - 1}">Anterior</button>`;
        let prev = 0;
        pages.forEach(i => {
            if (prev && i - prev > 1) paginationHTML += `<span class="page-link ellipsis">…</span>`;
            paginationHTML += `<button class="page-link ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
            prev = i;
        });
        paginationHTML += `<button class="page-link ${currentPage === totalPages ? 'disabled' : ''}" data-page="${currentPage + 1}">Próximo</button>`;
        container.innerHTML = paginationHTML;

        container.onclick = (e) => {
            const pageBtn = e.target.closest('[data-page]');
            if (pageBtn && !pageBtn.classList.contains('disabled')) {
                onPageChange(Number(pageBtn.dataset.page));
            }
        };
    }
    
  // normalizeParecerParaLista e a combinação da lista foram movidos para
  // js/utils.js (normalizeParecerParaLista / combinarPareceres), testáveis.
  const buildPareceresListaCombinada = () => combinarPareceres(DB_DOCS, DB_PARECERES);

  function drawPareceres(resetPage = false) {
    if (resetPage) parecerCurrentPage = 1;
    const list = $('#parecerList');
    const paginationContainer = $('#parecerPagination');
    if(!list || !paginationContainer) return;

    list.innerHTML='';
    paginationContainer.innerHTML = '';

    if(!currentlyDisplayedPareceres.length){
        list.innerHTML = `<div class="empty-state"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg><h3>Nenhum parecer encontrado</h3><p>Pareceres vinculados a processos aparecem aqui.</p></div>`;
        return;
    }

    const pageItems = currentlyDisplayedPareceres.slice((parecerCurrentPage - 1) * itemsPerPageDocs, parecerCurrentPage * itemsPerPageDocs);

    pageItems.forEach(item=>{
        const el = document.createElement('div');
        el.className = 'doc-item';

        if (item.tipo === 'estruturado') {
            const pz = item.ref;
            const emitido = pz.status === 'emitido';
            el.innerHTML = `
            <div>
              <span class="name" title="${sanitizeHTML(item.titulo)}">${sanitizeHTML(item.titulo)}</span>
              <span class="status ${emitido ? 'emitido' : 'rascunho'}" style="margin-top: 4px; display: inline-block;">${emitido ? 'Emitido' : 'Rascunho'}</span>
            </div>
            <div class="actions">
              <button class="btn" data-abrir-parecer="${pz.processoId}">Abrir</button>
            </div>`;
            list.appendChild(el);
            return;
        }

        const doc = item.ref;
        const currentVersion = getCurrentVersion(doc.id);
        const allVersions = getVersionsOfDoc(doc.id);

        const processoVinculado = DB.find(proc => String(proc.docId) === String(doc.id));
        const processoInfo = processoVinculado
            ? `<span style="font-size: 0.8em; color: var(--text-muted); display: block; margin-top: 4px;">Proc: ${sanitizeHTML(processoVinculado.num)}</span>`
            : `<span style="font-size: 0.8em; color: var(--text-muted); display: block; margin-top: 4px;">Não vinculado</span>`;

        el.innerHTML = `
        <div>
          <span class="name" title="${sanitizeHTML(doc.nomePrincipal)}">${sanitizeHTML(doc.nomePrincipal)}</span>
          ${processoInfo}
        </div>
        <div class="actions">
          ${currentVersion ? `<button class="btn" data-download-version="${currentVersion.id}">Abrir Atual</button>` : ''}
          <button class="btn secondary" data-versions-for="${doc.id}">Versões (${allVersions.length})</button>
          <button class="btn danger" data-del-doc="${doc.id}">Excluir</button>
        </div>`;
        list.appendChild(el);
    });

    renderPagination(paginationContainer, currentlyDisplayedPareceres.length, parecerCurrentPage, itemsPerPageDocs, (newPage) => {
        parecerCurrentPage = newPage;
        drawPareceres();
    });
  }
    
  const mVersoes = $('#m_versoes');
  function openVersionsModal(docId) {
      const doc = getDoc(docId); if (!doc) return;
      const versionsList = $('#lista_versoes');
      $('#m_versoes_t').textContent = `Histórico de: ${doc.nomePrincipal}`;
      versionsList.innerHTML = '';
      const versions = getVersionsOfDoc(docId);
      versions.forEach(v => {
          const item = document.createElement('div');
          item.className = 'version-item';
          const isCurrent = doc.idVersaoAtual === v.id;
          item.innerHTML = `<div class="version-item-info">
            <span class="v-name">${isCurrent ? '▶ ' : ''}V${v.versao}: ${sanitizeHTML(v.nomeArquivo)} ${isCurrent ? '(Atual)' : ''}</span>
            <span class="v-date">Adicionado em: ${fmtBR(v.adicionadoEm)}</span>
          </div> 
          <button class="btn" data-download-version="${v.id}">Baixar</button>`;
          versionsList.appendChild(item);
      });
      $('#btnNovaVersao').onclick = () => {
          $('#novaVersaoFile').click();
          $('#novaVersaoFile').onchange = (e) => {
              const file = e.target.files[0]; if (!file) return;
              const reader = new FileReader();
              reader.onload = async (ev) => {
                  const newVersionId = Date.now();
                  const lastVersionNum = versions.length > 0 ? versions[0].versao : 0;
                  const newVersion = { id: newVersionId, idDocumento: docId, versao: lastVersionNum + 1, nomeArquivo: file.name, data: ev.target.result, adicionadoEm: new Date().toISOString() };
                  DB_VERSOES.push(newVersion);
                  doc.idVersaoAtual = newVersionId;
                  
                  await dbHelper.put('versoes', newVersion);
                  await dbHelper.put('documentos', doc);

                  openVersionsModal(docId); 
                  currentlyDisplayedPareceres = buildPareceresListaCombinada();
                  drawPareceres();
                  showToast('Nova versão adicionada!');
              };
              reader.readAsDataURL(file); e.target.value = ''; $('#novaVersaoFile').onchange = null;
          };
      };
      if(mVersoes) mVersoes.style.display = 'flex';
  }

  // ===== Editor de Parecer Jurídico Interno (Fase 1 — sem PDF, ver Fase 2 no plano) =====
  const mParecer = $('#m_parecer');
  let parecerQuill = null;
  let currentParecerRecord = null;
  let currentParecerProcesso = null;
  let currentParecerIsNew = false;

  const getParecer = (processoId) => DB_PARECERES.find(pz => String(pz.processoId) === String(processoId));
  const getParecerVersoes = (parecerId) => versoesDoParecer(DB_PARECER_VERSOES, parecerId);

  // Accessor único de "qual é o parecer deste processo" (estruturado > Word legado > nenhum).
  // Devolve só dados normalizados (não HTML) — usado por openProcDetails e os dois fluxos de PDF,
  // pra não repetir essa decisão em cada lugar. NÃO é usado no gráfico do dashboard (getChartConfigs)
  // porque aquela contagem é "por registro" (independente de o processo ainda existir), não "por
  // processo vivo" como este accessor — ver comentário em getChartConfigs.
  // Delega para a função pura inferirParecerInfo (js/utils.js), testável.
  const getParecerInfo = (processo) => inferirParecerInfo(processo, DB_PARECERES, DB_DOCS);

  // Exclui de fato um processo e o parecer vinculado a ele em cascata (estruturado ou Word
  // legado, com todo o histórico de versões) — sem isso o parecer ficava "órfão" no Firestore
  // pra sempre. NÃO pede confirmação: quem chama é responsável por confirmar antes. Usado pela
  // exclusão individual (excluirProcessoEmCascata) e pela exclusão em massa.
  async function deleteProcessoCascata(id, procToDelete) {
      const parecerInfo = procToDelete ? getParecerInfo(procToDelete) : null;
      if (parecerInfo?.tipo === 'estruturado') {
          const pz = parecerInfo.parecer;
          const versoes = getParecerVersoes(pz.id);
          DB_PARECERES = DB_PARECERES.filter(x => x.id !== pz.id);
          DB_PARECER_VERSOES = DB_PARECER_VERSOES.filter(v => v.parecerId !== pz.id);
          await dbHelper.delete('pareceres', pz.id);
          for (const v of versoes) await dbHelper.delete('parecerVersoes', v.id);
      } else if (parecerInfo?.tipo === 'legado') {
          const docLegado = parecerInfo.docLegado;
          const versoes = getVersionsOfDoc(docLegado.id);
          DB_DOCS = DB_DOCS.filter(d => d.id !== docLegado.id);
          DB_VERSOES = DB_VERSOES.filter(v => v.idDocumento !== docLegado.id);
          await dbHelper.delete('documentos', docLegado.id);
          for (const v of versoes) await dbHelper.delete('versoes', v.id);
      }

      await logHistorico(id, procToDelete?.num, 'excluido');
      DB = DB.filter(p => p.id != id);
      await dbHelper.delete('processos', id);
  }

  // Confirma e exclui um único processo em cascata. Usado pelos dois pontos de exclusão de
  // processo (lista e modal de edição). Retorna true se o processo foi excluído, false se o
  // usuário cancelou.
  async function excluirProcessoEmCascata(id, procToDelete) {
      const parecerInfo = procToDelete ? getParecerInfo(procToDelete) : null;
      let avisoParecer = '';
      if (parecerInfo?.tipo === 'estruturado') {
          avisoParecer = `<br><br>Este processo tem um parecer <strong>${parecerInfo.emitido ? 'emitido' : 'em rascunho'}</strong> vinculado — ele também será excluído, junto com todo o seu histórico de versões.`;
      } else if (parecerInfo?.tipo === 'legado') {
          avisoParecer = `<br><br>Este processo tem um parecer (Word) vinculado — ele também será excluído, junto com todo o seu histórico de versões.`;
      }
      const msg = `Tem certeza que deseja excluir o processo <strong>${sanitizeHTML(procToDelete?.num || String(id))}</strong>?${avisoParecer}<br><br>Esta ação não pode ser desfeita.`;
      if (!(await confirmDialog(msg, { title: 'Excluir processo', confirmLabel: 'Excluir' }))) return false;

      await deleteProcessoCascata(id, procToDelete);
      return true;
  }

  function currentUserName() {
      try {
          const u = JSON.parse(sessionStorage.getItem('loggedInUser'));
          return u?.name || u?.login || 'Sistema';
      } catch (e) { return 'Sistema'; }
  }

  function buildParecerSeedDelta(processo) {
      const numTxt = (processo && processo.num) ? processo.num : '';
      return {
          ops: [
              { insert: 'PARECER JURÍDICO' },
              { insert: '\n', attributes: { header: 2, align: 'center' } },
              { insert: `Processo n. ${numTxt}` },
              { insert: '\n', attributes: { align: 'center' } },
              { insert: '\n' },
              { insert: 'I. RELATÓRIO', attributes: { bold: true } },
              { insert: '\n' }, { insert: '\n' },
              { insert: 'II. DA ANÁLISE JURÍDICA', attributes: { bold: true } },
              { insert: '\n' }, { insert: '\n' },
              { insert: 'III. CONCLUSÃO', attributes: { bold: true } },
              { insert: '\n' }, { insert: '\n' }
          ]
      };
  }

  function ensureParecerQuill() {
      if (parecerQuill) return parecerQuill;
      parecerQuill = new Quill('#parecerEditor', {
          theme: 'snow',
          modules: {
              toolbar: [
                  ['bold', 'italic', 'underline'],
                  [{ header: [1, 2, 3, false] }],
                  [{ align: [] }],
                  [{ list: 'ordered' }, { list: 'bullet' }],
                  ['clean']
              ]
          }
      });
      return parecerQuill;
  }

  function updateParecerModalUI(pz) {
      const emitido = pz.status === 'emitido';
      const statusEl = $('#m_parecer_status');
      statusEl.textContent = emitido ? 'Emitido' : 'Rascunho';
      statusEl.className = `status ${emitido ? 'emitido' : 'rascunho'}`;
      $('#pz_ementa').value = pz.ementa || '';
      $('#pz_ementa').disabled = emitido;
      $('#btnSalvarRascunho').style.display = emitido ? 'none' : '';
      $('#btnEmitirParecer').style.display = emitido ? 'none' : '';
      $('#btnReabrirParecer').style.display = emitido ? '' : 'none';
      $('#btnGerarPdfParecer').style.display = emitido ? '' : 'none';
      const modeloPicker = $('#parecerModeloPicker');
      if (modeloPicker) modeloPicker.style.display = emitido ? 'none' : '';
      if (parecerQuill) parecerQuill.enable(!emitido);
  }

  // Popula o <select> de modelos disponíveis para carregar como base do parecer em edição.
  function populateParecerModeloSelect() {
      const select = $('#pz_modelo_select');
      if (!select) return;
      select.innerHTML = '<option value="">Selecione um modelo...</option>' +
          DB_MODELOS.slice().sort((a, b) => a.name.localeCompare(b.name))
              .map(m => `<option value="${m.id}">${sanitizeHTML(m.name)}</option>`).join('');
  }

  // Extrai o .docx do modelo via mammoth.convertToHtml (preserva formatação básica) e substitui
  // o conteúdo do editor Quill atual pelo Delta resultante. Só deve ser chamado com o editor
  // habilitado (status !== 'emitido') — a confirmação destrutiva é responsabilidade do chamador.
  async function carregarModeloNoEditor(modelo) {
      if (!parecerQuill) return;
      try {
          const buffer = base64ToArrayBuffer(modelo.data);
          if (buffer.byteLength === 0) { showToast('Modelo vazio ou corrompido.', 'danger'); return; }
          const result = await mammoth.convertToHtml({ arrayBuffer: buffer });
          const delta = parecerQuill.clipboard.convert(result.value);
          parecerQuill.setContents(delta);
          showToast('Modelo carregado no editor.', 'success');
      } catch (e) {
          console.error('Erro ao carregar modelo no editor:', e);
          showToast('Não foi possível carregar o modelo (formato incompatível?).', 'danger');
      }
  }

  // ===== Pesquisa de jurisprudência (painel do editor de parecer) =====
  // Abre a busca já preenchida nos portais oficiais (nova aba) e monta uma
  // citação formatada para inserir no ponto do cursor no editor Quill.
  const JURIS_PORTAIS = {
      stf:       (q) => `https://jurisprudencia.stf.jus.br/pages/search?queryString=${encodeURIComponent(q)}`,
      stj:       (q) => `https://scon.stj.jus.br/SCON/pesquisar.jsp?b=ACOR&livre=${encodeURIComponent(q)}`,
      // O e-JURIS do TJRJ não aceita busca por URL — busca restrita ao domínio do tribunal.
      tjrj:      (q) => `https://www.google.com/search?q=${encodeURIComponent('site:tjrj.jus.br jurisprudência ' + q)}`,
      lexml:     (q) => `https://www.lexml.gov.br/busca/search?keyword=${encodeURIComponent(q)}`,
      jusbrasil: (q) => `https://www.jusbrasil.com.br/jurisprudencia/busca?q=${encodeURIComponent(q)}`
  };

  function montarCitacaoJuris() {
      const v = (sel) => $(sel)?.value.trim() || '';
      const partes = [];
      const trib = v('#jr_trib'), classe = v('#jr_classe'), num = v('#jr_num');
      const relator = v('#jr_relator'), orgao = v('#jr_orgao'), data = v('#jr_data');
      if (trib) partes.push(trib);
      if (classe || num) partes.push(`${classe || 'Processo'}${num ? ' nº ' + num : ''}`);
      if (relator) partes.push(`Relator(a): ${relator}`);
      if (orgao) partes.push(orgao);
      if (data) { const [a, m, d] = data.split('-'); partes.push(`julgado em ${d}/${m}/${a}`); }
      return { ementa: v('#jr_ementa'), referencia: partes.length ? `(${partes.join(', ')})` : '' };
  }

  function atualizarPreviewJuris() {
      const el = $('#jr_preview'); if (!el) return;
      const { ementa, referencia } = montarCitacaoJuris();
      if (!ementa && !referencia) { el.textContent = 'Preencha os campos acima…'; return; }
      el.innerHTML = `${ementa ? `<em>“${sanitizeHTML(ementa)}”</em><br>` : ''}${sanitizeHTML(referencia)}`;
  }

  function inserirCitacaoNoParecer() {
      const { ementa, referencia } = montarCitacaoJuris();
      if (!ementa && !referencia) { showToast('Preencha ao menos um campo da citação.', 'danger'); return; }
      const quill = ensureParecerQuill();
      if (!quill.isEnabled()) { showToast('O parecer está emitido — reabra para edição antes de inserir a citação.', 'danger'); return; }
      const range = quill.getSelection(true) || { index: quill.getLength(), length: 0 };
      let pos = range.index;
      quill.insertText(pos, '\n'); pos += 1;
      if (ementa) {
          const trecho = `“${ementa}”`;
          quill.insertText(pos, trecho, { italic: true }); pos += trecho.length;
          quill.insertText(pos, '\n', { italic: false }); pos += 1;
      }
      if (referencia) {
          quill.insertText(pos, referencia, { italic: false }); pos += referencia.length;
          quill.insertText(pos, '\n', { italic: false }); pos += 1;
      }
      quill.setSelection(pos, 0);
      $('#m_juris').style.display = 'none';
      showToast('Citação inserida no parecer!');
  }

  function openJurisModal() {
      const tema = $('#jr_tema');
      // Sugere o tema a partir da ementa do parecer ou do objeto do processo.
      if (tema && !tema.value) {
          tema.value = ($('#pz_ementa')?.value || currentParecerProcesso?.obj || '').slice(0, 120).trim();
      }
      atualizarPreviewJuris();
      $('#m_juris').style.display = 'flex';
      tema?.focus();
  }

  // ===== Busca integrada (Cloud Function `juris` — ver functions/index.js) =====
  // Consulta Jurisprudências.ai (por tema, com ementa), Datajud/CNJ (por nº de
  // processo) e LexML (legislação) sem sair do site. Se a função ainda não
  // estiver publicada (exige plano Blaze), o painel degrada com uma mensagem e
  // os botões dos portais continuam funcionando.
  const JURIS_FUNCTION_URL = 'https://us-central1-juriscontrolcmdc.cloudfunctions.net/juris';
  // Bases disponíveis por fonte (espelha TRIBUNAIS_* em functions/index.js).
  const JURIS_TRIBUNAIS = {
      jurisai: [['tjrj', 'TJRJ'], ['stj', 'STJ'], ['stf', 'STF'], ['tjsp', 'TJSP'], ['tjmg', 'TJMG'], ['tjrs', 'TJRS'], ['tjpr', 'TJPR'], ['tjsc', 'TJSC'], ['tjce', 'TJCE'], ['tjgo', 'TJGO'], ['tjma', 'TJMA'], ['tjmt', 'TJMT'], ['trf3', 'TRF3'], ['trf4', 'TRF4'], ['tst', 'TST'], ['carf', 'CARF']],
      datajud: [['tjrj', 'TJRJ'], ['stj', 'STJ'], ['stf', 'STF'], ['tjsp', 'TJSP'], ['tjmg', 'TJMG'], ['trf2', 'TRF2'], ['tst', 'TST']]
  };
  let JURIS_ULTIMOS = [];

  async function buscarJurisNoSite() {
      const alvo = $('#jurisResultados'); if (!alvo) return;
      const q = $('#jr_tema')?.value.trim();
      if (!q) { showToast('Digite o tema (ou o nº do processo) da pesquisa.', 'danger'); $('#jr_tema')?.focus(); return; }
      const fonte = $('#jr_fonte')?.value || 'jurisai';
      const tribunal = $('#jr_trib_dj')?.value || 'tjrj';
      alvo.innerHTML = '<div class="list-msg">Buscando…</div>';
      try {
          const usuarioFb = window.auth?.currentUser;
          if (!usuarioFb) throw new Error('Sessão expirada — entre novamente no sistema.');
          const token = await usuarioFb.getIdToken();
          const url = `${JURIS_FUNCTION_URL}?fonte=${encodeURIComponent(fonte)}&q=${encodeURIComponent(q)}&tribunal=${encodeURIComponent(tribunal)}`;
          const resp = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
          if (!resp.ok) {
              const corpo = await resp.json().catch(() => ({}));
              throw new Error(corpo.erro || `HTTP_${resp.status}`);
          }
          const dados = await resp.json();
          renderJurisResultados(dados.resultados || []);
      } catch (e) {
          console.warn('Busca integrada indisponível:', e);
          const rede = !e.message || /failed to fetch|networkerror|load failed|HTTP_404/i.test(e.message);
          alvo.innerHTML = `<div class="list-msg">${rede
              ? 'A busca integrada ainda não está ativa (a função de busca não foi publicada no Firebase). Enquanto isso, use os botões dos portais abaixo.'
              : sanitizeHTML(e.message)}</div>`;
      }
  }

  function renderJurisResultados(resultados) {
      const alvo = $('#jurisResultados'); if (!alvo) return;
      JURIS_ULTIMOS = resultados;
      if (!resultados.length) {
          alvo.innerHTML = '<div class="list-msg">Nenhum resultado encontrado. Refine o tema ou use os botões dos portais abaixo.</div>';
          return;
      }
      alvo.innerHTML = '';
      resultados.forEach((r, i) => {
          const item = document.createElement('div');
          item.className = 'juris-res-item';
          const ementaCurta = r.ementa ? String(r.ementa).slice(0, 220) + (String(r.ementa).length > 220 ? '…' : '') : '';
          item.innerHTML = `
              <div class="juris-res-titulo">${sanitizeHTML(r.titulo || '')}</div>
              <div class="juris-res-meta">${sanitizeHTML([r.tribunal, r.orgao, r.relator, r.data].filter(Boolean).join(' · '))}</div>
              ${ementaCurta ? `<div class="juris-res-ementa">${sanitizeHTML(ementaCurta)}</div>` : ''}
              <div class="juris-res-acoes">
                  <button type="button" class="btn secondary" data-juris-usar="${i}">Usar dados na citação</button>
                  ${r.url ? `<a class="btn secondary" href="${sanitizeHTML(r.url)}" target="_blank" rel="noopener">Abrir fonte ↗</a>` : ''}
              </div>`;
          alvo.appendChild(item);
      });
  }

  function usarResultadoJuris(i) {
      const r = JURIS_ULTIMOS[i]; if (!r) return;
      const setar = (sel, val) => { const el = $(sel); if (el && val) el.value = val; };
      setar('#jr_trib', r.tribunal);
      setar('#jr_classe', r.classe && r.classe !== 'Jurisprudência' ? r.classe : '');
      setar('#jr_num', r.numero);
      setar('#jr_relator', r.relator);
      setar('#jr_orgao', r.orgao);
      if (r.data && /^\d{4}-\d{2}-\d{2}$/.test(r.data)) setar('#jr_data', r.data);
      if (r.ementa && !String(r.ementa).startsWith('Assuntos:')) setar('#jr_ementa', r.ementa);
      atualizarPreviewJuris();
      showToast('Dados preenchidos — complete o que faltar e insira no parecer.');
  }

  function openParecerModal(processo) {
      currentParecerProcesso = processo;
      const quill = ensureParecerQuill();
      let pz = getParecer(processo.id);
      currentParecerIsNew = !pz;
      if (!pz) {
          pz = {
              id: Date.now(),
              processoId: processo.id,
              processoNum: processo.num,
              status: 'rascunho',
              ementa: '',
              delta: buildParecerSeedDelta(processo),
              textoBusca: '',
              criadoEm: new Date().toISOString(),
              criadoPor: currentUserName(),
              atualizadoEm: null,
              emitidoEm: null, emitidoPor: null,
              reabertoEm: null, reabertoPor: null
          };
      }
      currentParecerRecord = pz;
      quill.setContents(pz.delta);
      updateParecerModalUI(pz);
      if (pz.status !== 'emitido') populateParecerModeloSelect();
      $('#m_parecer_t').textContent = `Parecer Jurídico — Processo ${sanitizeHTML(processo.num || '')}`;
      mParecer.style.display = 'flex';
  }

  async function salvarRascunhoParecer(silent = false) {
      if (!currentParecerRecord || !parecerQuill) return null;
      const pz = currentParecerRecord;
      const isNew = currentParecerIsNew;
      pz.ementa = $('#pz_ementa').value.trim();
      pz.delta = { ops: parecerQuill.getContents().ops };
      pz.textoBusca = parecerQuill.getText().toLowerCase();
      pz.atualizadoEm = new Date().toISOString();
      if (isNew) DB_PARECERES.push(pz);
      await dbHelper.put('pareceres', pz);
      await logHistorico(currentParecerProcesso.id, currentParecerProcesso.num, isNew ? 'parecer-criado' : 'parecer-editado', []);
      currentParecerIsNew = false;
      if (!silent) showToast('Rascunho salvo com sucesso!');
      return pz;
  }

  async function emitirParecer() {
      if (!currentParecerRecord) return;
      const ok = await confirmDialog('Ao emitir, o parecer ficará <strong>somente leitura</strong>. Deseja continuar?', { title: 'Emitir Parecer', confirmLabel: 'Emitir' });
      if (!ok) return;
      const pz = await salvarRascunhoParecer(true);
      if (!pz) return;
      pz.status = 'emitido';
      pz.emitidoEm = new Date().toISOString();
      pz.emitidoPor = currentUserName();
      await dbHelper.put('pareceres', pz);

      const versoesExistentes = getParecerVersoes(pz.id);
      const novaVersao = {
          id: Date.now() + 1, parecerId: pz.id, versao: (versoesExistentes[0]?.versao ?? 0) + 1,
          delta: pz.delta, textoBusca: pz.textoBusca, emitidoEm: pz.emitidoEm, emitidoPor: pz.emitidoPor
      };
      DB_PARECER_VERSOES.push(novaVersao);
      await dbHelper.put('parecerVersoes', novaVersao);

      await logHistorico(currentParecerProcesso.id, currentParecerProcesso.num, 'parecer-emitido', []);
      updateParecerModalUI(pz);
      showToast('Parecer emitido com sucesso!');
      openProcDetails(currentParecerProcesso.id);
  }

  async function reabrirParecer() {
      if (!currentParecerRecord) return;
      const ok = await confirmDialog('O parecer voltará a ficar editável como rascunho. Deseja continuar?', { title: 'Reabrir Parecer', confirmLabel: 'Reabrir' });
      if (!ok) return;
      const pz = currentParecerRecord;
      pz.status = 'rascunho';
      pz.reabertoEm = new Date().toISOString();
      pz.reabertoPor = currentUserName();
      await dbHelper.put('pareceres', pz);
      await logHistorico(currentParecerProcesso.id, currentParecerProcesso.num, 'parecer-reaberto', []);
      updateParecerModalUI(pz);
      showToast('Parecer reaberto para edição.', 'info');
      openProcDetails(currentParecerProcesso.id);
  }

  $('#btnSalvarRascunho').onclick = () => salvarRascunhoParecer();
  $('#btnEmitirParecer').onclick = () => emitirParecer();
  $('#btnReabrirParecer').onclick = () => reabrirParecer();
  $('#btnGerarPdfParecer').onclick = () => generateParecerPDF(currentParecerProcesso);
  $('#btnCarregarModelo').onclick = async () => {
      const modeloId = Number($('#pz_modelo_select').value);
      if (!modeloId) { showToast('Selecione um modelo primeiro.', 'info'); return; }
      const modelo = getModelo(modeloId);
      if (!modelo) { showToast('Modelo não encontrado.', 'danger'); return; }
      const ok = await confirmDialog(
          `Isso vai <strong>substituir todo o conteúdo atual</strong> do editor pelo modelo "${sanitizeHTML(modelo.name)}". Deseja continuar?`,
          { title: 'Carregar Modelo', confirmLabel: 'Carregar e Substituir' }
      );
      if (!ok) return;
      await carregarModeloNoEditor(modelo);
  };
  $$('[data-close-parecer]').forEach(x => x.onclick = () => { mParecer.style.display = 'none'; });
  if (mParecer) mParecer.onclick = (e) => { if (e.target === mParecer) mParecer.style.display = 'none'; };

  // Painel de jurisprudência
  $('#btnJurisprudencia').onclick = openJurisModal;
  $('#btnInserirCitacao').onclick = inserirCitacaoNoParecer;
  $$('[data-juris-portal]').forEach(b => b.onclick = () => {
      const q = $('#jr_tema')?.value.trim();
      if (!q) { showToast('Digite o tema da pesquisa.', 'danger'); $('#jr_tema')?.focus(); return; }
      window.open(JURIS_PORTAIS[b.dataset.jurisPortal](q), '_blank', 'noopener');
  });
  ['#jr_trib', '#jr_classe', '#jr_num', '#jr_relator', '#jr_orgao', '#jr_data', '#jr_ementa'].forEach(sel => {
      const el = $(sel); if (el) el.oninput = atualizarPreviewJuris;
  });
  $$('[data-close-juris]').forEach(x => x.onclick = () => { $('#m_juris').style.display = 'none'; });
  const mJuris = $('#m_juris');
  if (mJuris) mJuris.onclick = (e) => { if (e.target === mJuris) mJuris.style.display = 'none'; };
  $('#btnBuscarJurisSite').onclick = buscarJurisNoSite;
  $('#jr_tema').onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); buscarJurisNoSite(); } };
  const atualizarFonteJuris = () => {
      const fonte = $('#jr_fonte').value;
      const tribEl = $('#jr_trib_dj');
      const bases = JURIS_TRIBUNAIS[fonte];
      if (bases) {
          const atual = tribEl.value;
          tribEl.innerHTML = bases.map(([id, nome]) => `<option value="${id}">${nome}</option>`).join('');
          tribEl.value = bases.some(([id]) => id === atual) ? atual : 'tjrj';
          tribEl.style.display = '';
      } else {
          tribEl.style.display = 'none'; // LexML busca na base toda
      }
      $('#jr_tema').placeholder = fonte === 'datajud'
          ? 'Ex.: 0002934-98.2018.8.19.0064'
          : 'Ex.: dispensa de licitação câmara municipal';
  };
  $('#jr_fonte').onchange = atualizarFonteJuris;
  atualizarFonteJuris();
  $('#jurisResultados').onclick = (e) => {
      const usar = e.target.closest('[data-juris-usar]');
      if (usar) usarResultadoJuris(Number(usar.dataset.jurisUsar));
  };

  function renderModelos(resetPage = false) {
    if (resetPage) modeloCurrentPage = 1;
    const list = $('#modeloList');
    const paginationContainer = $('#modeloPagination');
    if (!list || !paginationContainer) return;

    list.innerHTML = '';
    paginationContainer.innerHTML = '';

    const sortedModelos = DB_MODELOS.sort((a, b) => a.name.localeCompare(b.name));

    if (!sortedModelos.length) {
        list.innerHTML = `<div class="empty-state"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg><h3>Nenhum modelo cadastrado</h3><p>Adicione modelos .docx para usar como base.</p></div>`;
        return;
    }

    const pageItems = sortedModelos.slice((modeloCurrentPage - 1) * itemsPerPageDocs, modeloCurrentPage * itemsPerPageDocs);

    pageItems.forEach(modelo => {
        const item = document.createElement('div');
        item.className = 'doc-item';
        item.innerHTML = `<span class="name" title="${sanitizeHTML(modelo.name)}">${sanitizeHTML(modelo.name)}</span>
        <div class="actions">
            <button class="btn" data-download-modelo="${modelo.id}">Baixar</button> 
            <button class="btn danger" data-del-modelo="${modelo.id}">Excluir</button>
        </div>`;
        list.appendChild(item);
    });

    renderPagination(paginationContainer, sortedModelos.length, modeloCurrentPage, itemsPerPageDocs, (newPage) => {
        modeloCurrentPage = newPage;
        renderModelos();
    });
  }
  
  $('#buscaConteudo').oninput = async () => {
      const searchTerm = $('#buscaConteudo').value.toLowerCase().trim();
      if (!searchTerm) {
          currentlyDisplayedPareceres = buildPareceresListaCombinada();
          drawPareceres(true);
          return;
      }
      const matchingDocIds = new Set();
      for (const version of DB_VERSOES) {
          try {
              const buffer = base64ToArrayBuffer(version.data);
              if (buffer.byteLength === 0) continue;
              const result = await mammoth.extractRawText({ arrayBuffer: buffer });
              const text = result.value || '';
              if (text.toLowerCase().includes(searchTerm)) matchingDocIds.add(version.idDocumento);
          } catch (e) { console.warn(`Erro ao ler ${version.nomeArquivo}:`, e); }
      }
      const matchingLegado = DB_DOCS.filter(d => matchingDocIds.has(d.id)).map(d => normalizeParecerParaLista(d, 'legado'));
      const matchingEstruturados = DB_PARECERES
          .filter(pz => (pz.textoBusca || '').includes(searchTerm) || (pz.ementa || '').toLowerCase().includes(searchTerm))
          .map(pz => normalizeParecerParaLista(pz, 'estruturado'));
      currentlyDisplayedPareceres = [...matchingLegado, ...matchingEstruturados].sort((a, b) => new Date(b.dataRef) - new Date(a.dataRef));
      drawPareceres(true);
  };

  const sections={dashboard: $('#secDashboard'), proc:$('#secProc'), cal:$('#secCal'), docs:$('#secDoc'), leis: $('#secLeis'), cfg:$('#secCfg')};
  const tabTitles = { dashboard: 'Dashboard', proc: 'Processos', cal: 'Calendário', docs: 'Documentos', leis: 'Banco de Leis', cfg: 'Configurações' };

  const mobileMenuToggle = $('#mobile-menu-toggle');
  const sidebar = $('#sidebar');
  const overlay = $('#sidebar-overlay');

  function showTab(key, options = {}){
    Object.values(sections).forEach(s=> { if(s) s.style.display='none'; });
    if(sections[key]) {
        sections[key].style.display='block';
        sections[key].classList.remove('section-enter');
        void sections[key].offsetWidth;
        sections[key].classList.add('section-enter');
    }

    $$('.tab').forEach(t=> {
        const isActive = t.dataset.tab === key;
        t.classList.toggle('active', isActive);
        if (isActive) {
            t.setAttribute('aria-current', 'page');
        } else {
            t.removeAttribute('aria-current');
        }
    });

    const pageTitleEl = $('#page-title');
    if (pageTitleEl) pageTitleEl.textContent = tabTitles[key] || '';

    if(sidebar && sidebar.classList.contains('mobile-open')) {
        closeMobileMenu();
    }

    if(key==='dashboard') renderDashboard();
    if(key==='proc') renderProc(true, options.filterBy);
    if(key==='cal') drawView();
    if(key==='docs') {
        currentlyDisplayedPareceres = buildPareceresListaCombinada();
        drawPareceres(true);
        renderModelos(true);
    }
    if(key==='leis') renderLeis();
    if(key==='cfg') { renderUsers(); renderEmissores(); renderAuditoria(); renderJurisaiTokenCard(); }
  }

  const statusMap = {'pendente':'Pendente','em-analise':'Em Análise','aguardando-documentacao':'Aguardando Documentação','em-diligencia':'Em Diligência', 'finalizado':'Finalizado','arquivado':'Arquivado'};
  const fieldLabels = { num: 'Nº Processo', int: 'Interessado', tipo: 'Tipo', obj: 'Objeto', acao: 'Ação Tomada', stat: 'Status', setorOrigem: 'Setor de Origem', dest: 'Setor Enviado', ent: 'Data de Entrada', prazo: 'Prazo Final', saida: 'Data de Saída' };

  // getChanges foi movido para js/utils.js (função pura, testável). Continua
  // disponível como global, pois utils.js é carregado antes do app.js.

  async function logHistorico(processoId, processoNum, acao, changes = []) {
      try {
          const entry = {
              id: Date.now(),
              processoId: String(processoId),
              processoNum: processoNum || String(processoId),
              acao,
              usuario: currentUserName(),
              timestamp: new Date().toISOString(),
              campos: changes
          };
          await dbHelper.put('historico', entry);
      } catch (e) {
          console.warn('Erro ao registrar histórico:', e);
      }
      // Espelha no log central de auditoria (Configurações → Log de Auditoria).
      const modulo = String(acao).startsWith('parecer') ? 'pareceres' : 'processos';
      const detalhes = (changes || []).map(c => `${fieldLabels[c.campo] || c.campo}: "${c.de ?? ''}" → "${c.para ?? ''}"`).join('; ');
      await logAuditoria(modulo, acao, `Processo ${processoNum || processoId}`, detalhes || null);
  }

  // ===== LOG DE AUDITORIA CENTRAL =====
  // Registro append-only de quem fez o quê (coleção `auditoria`). As regras do
  // Firestore permitem criar para qualquer usuário aprovado, mas ler/limpar só
  // para admin — e ninguém edita um registro depois de criado.
  async function logAuditoria(modulo, acao, alvo, detalhes = null) {
      try {
          const u = JSON.parse(sessionStorage.getItem('loggedInUser') || 'null');
          const entry = {
              id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              modulo,
              acao,
              alvo: alvo == null ? '' : String(alvo),
              detalhes: detalhes || null,
              usuario: u?.name || u?.login || 'Sistema',
              login: u?.login || '',
              uid: u?.id || '',
              timestamp: new Date().toISOString()
          };
          await dbHelper.put('auditoria', entry);
      } catch (e) {
          // Nunca propaga: auditoria não pode derrubar a operação principal.
          console.warn('Erro ao registrar auditoria:', e);
      }
  }

  // ===== Tooltip de anotações (hover no balãozinho) =====
  (function setupAnotacoesTooltip() {
      let tipEl = null;
      const ensureTip = () => {
          if (!tipEl) {
              tipEl = document.createElement('div');
              tipEl.className = 'anot-tooltip';
              tipEl.style.display = 'none';
              document.body.appendChild(tipEl);
          }
          return tipEl;
      };
      const buildPreview = (anotacoes) => {
          const lista = (anotacoes || []).slice().sort((a, b) => b.id - a.id);
          if (!lista.length) return '';
          const shown = lista.slice(0, 3);
          const rows = shown.map(a => {
              const dt = new Date(a.dt);
              const dateStr = dt.toLocaleDateString('pt-BR') + ' ' + dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
              let texto = a.texto || '';
              if (texto.length > 160) texto = texto.slice(0, 160) + '…';
              return `<div class="anot-tip-row">
                  <div class="anot-tip-meta"><span class="anot-tip-user">${sanitizeHTML(a.usuario || 'Usuário')}</span><span class="anot-tip-date">${sanitizeHTML(dateStr)}</span></div>
                  <div class="anot-tip-text">${sanitizeHTML(texto)}</div>
              </div>`;
          }).join('');
          const restante = lista.length - shown.length;
          const more = restante > 0 ? `<div class="anot-tip-more">+${restante} anotação(ões) anterior(es)</div>` : '';
          return `<div class="anot-tip-title">Últimas anotações</div>${rows}${more}`;
      };
      const position = (badge) => {
          const r = badge.getBoundingClientRect();
          const tw = tipEl.offsetWidth, th = tipEl.offsetHeight;
          let left = r.left + r.width / 2 - tw / 2;
          left = Math.max(8, Math.min(left, window.innerWidth - tw - 8));
          let top = r.top - th - 8;
          if (top < 8) top = r.bottom + 8; // vira para baixo se não couber acima
          tipEl.style.left = left + 'px';
          tipEl.style.top = top + 'px';
      };
      const show = (badge) => {
          const p = DB.find(x => String(x.id) === String(badge.dataset.anot));
          if (!p) return;
          const html = buildPreview(p.anotacoes);
          if (!html) return;
          ensureTip().innerHTML = html;
          tipEl.style.display = 'block';
          position(badge);
      };
      const hide = () => { if (tipEl) tipEl.style.display = 'none'; };

      document.addEventListener('mouseover', (e) => {
          const badge = e.target.closest && e.target.closest('.anotacoes-badge');
          if (badge && badge.dataset.anot) show(badge);
      });
      document.addEventListener('mouseout', (e) => {
          const badge = e.target.closest && e.target.closest('.anotacoes-badge');
          if (badge && !badge.contains(e.relatedTarget)) hide();
      });
      window.addEventListener('scroll', hide, true);
  })();

  function renderProc(reset = false, initialFilter = null) {
    const q = $('#q'), ord = $('#ord'), tbody = $('#tbl-body'), mobileContainer = $('#mobile-cards-container'), paginationProcessesContainer = $('#pagination-container');
    const btnToggleFiltros = $('#btnToggleFiltros'), filtrosPanel = $('#filtrosPanel'), filtrosCount = $('#filtrosCount'), btnLimparFiltros = $('#btnLimparFiltros');
    const filtroStatus = $('#filtroStatus'), filtroSetor = $('#filtroSetor'), filtroTipo = $('#filtroTipo'), filtroEmissor = $('#filtroEmissor'), filtroEntradaDe = $('#filtroEntradaDe'), filtroEntradaAte = $('#filtroEntradaAte');
    const itemsPerPageSel = $('#itemsPerPage');

    let currentPage = 1;
    itemsPerPageSel.value = String(CFG.procItemsPerPage || 10);
    let itemsPerPage = Number(itemsPerPageSel.value) || 10;

    // Seleção múltipla (exclusão em massa) — só na visão Lista
    const bulkBar = $('#bulkBar'), bulkCount = $('#bulkCount'), bulkSelAll = $('#bulkSelAll');
    const btnSelecionar = $('#btnSelecionar'), btnBulkDelete = $('#btnBulkDelete'), btnBulkCancel = $('#btnBulkCancel');
    let selectionMode = false;
    let selectedIds = new Set();
    let lastFiltered = [];

    if (initialFilter) {
        q.value = '';
        if(initialFilter.text) q.value = initialFilter.text;
    }

    if (!filtroStatus.dataset.populated) {
        filtroStatus.dataset.populated = '1';
        Object.entries(statusMap).forEach(([value, label]) => {
            const opt = document.createElement('option'); opt.value = value; opt.textContent = label;
            filtroStatus.appendChild(opt);
        });
    }
    if (!filtroSetor.dataset.populated) {
        filtroSetor.dataset.populated = '1';
        SETORES.forEach(s => {
            const opt = document.createElement('option'); opt.value = s; opt.textContent = s;
            filtroSetor.appendChild(opt);
        });
    }
    // Emissores podem mudar entre renders (cadastro dinâmico), então repopula sempre preservando a seleção atual
    (() => {
        const current = filtroEmissor.value;
        filtroEmissor.innerHTML = '<option value="">Todos</option>';
        DB_EMISSORES.forEach(em => {
            const opt = document.createElement('option'); opt.value = em.id; opt.textContent = em.name;
            filtroEmissor.appendChild(opt);
        });
        if (current) filtroEmissor.value = current;
    })();

    function countActiveFiltros() {
        return [filtroStatus.value, filtroSetor.value, filtroTipo.value, filtroEmissor.value, filtroEntradaDe.value, filtroEntradaAte.value]
            .filter(v => v).length;
    }

    function updateFiltrosUI() {
        const n = countActiveFiltros();
        if (n > 0) {
            filtrosCount.style.display = 'inline-flex';
            filtrosCount.textContent = String(n);
            btnToggleFiltros.classList.add('active');
        } else {
            filtrosCount.style.display = 'none';
            btnToggleFiltros.classList.remove('active');
        }
    }

    // Lógica pura extraída para js/utils.js (filtrarOrdenarProcessos), testável.
    // Aqui só coletamos os valores dos controles da UI e delegamos.
    function filterSort() {
        return filtrarOrdenarProcessos(DB, {
            busca: q.value,
            initialFilter,
            status: filtroStatus.value,
            setor: filtroSetor.value,
            tipo: filtroTipo.value,
            emissor: filtroEmissor.value,
            entradaDe: filtroEntradaDe.value,
            entradaAte: filtroEntradaAte.value,
            ordem: ord.value,
            statusMap,
        });
    }

    function draw(resetPage = false) {
        if (resetPage) currentPage = 1;
        const L = filterSort();
        lastFiltered = L;
        tbody.innerHTML = '';
        mobileContainer.innerHTML = '';

        if (L.length === 0) {
            const emptyHtml = `<div class="empty-state"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="12" y1="10" x2="12" y2="16"/></svg><h3>Nenhum processo encontrado</h3><p>Tente ajustar os filtros ou clique em "Adicionar Processo".</p></div>`;
            tbody.innerHTML = `<tr><td colspan="5">${emptyHtml}</td></tr>`;
            mobileContainer.innerHTML = emptyHtml;
        } else {
            const pageItems = L.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
            pageItems.forEach(p => {
                const sTxt = statusMap[p.stat] || p.stat;
                const dias = p.prazo ? diffDays(todayUTC(), parse(p.prazo)) : null;
                const vencido = dias !== null && p.stat !== 'finalizado' && p.stat !== 'arquivado' && dias < 0;
                const alerta  = dias !== null && p.stat !== 'finalizado' && p.stat !== 'arquivado' && dias >= 0 && dias < 3;
                const urgClass = vencido ? 'row-vencido' : alerta ? 'row-alerta' : '';
                const urgIcon = (vencido || alerta) ? `<svg class="urgencia-icon" xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>` : '';
                const prazoTitle = vencido ? `title="Prazo vencido"` : alerta ? `title="Prazo próximo do vencimento"` : '';
                const badgeHtml = p.anotacoes && p.anotacoes.length > 0
                    ? `<span class="anotacoes-badge" data-anot="${p.id}" aria-label="${p.anotacoes.length} anotação(ões)"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> ${p.anotacoes.length}</span>` : '';
                const selChk = selectionMode
                    ? `<input type="checkbox" class="sel-chk" data-sel-proc="${p.id}" ${selectedIds.has(String(p.id)) ? 'checked' : ''} title="Selecionar processo">`
                    : '';
                const tr = document.createElement('tr');
                if (urgClass) tr.classList.add(urgClass);
                if (selectionMode && selectedIds.has(String(p.id))) tr.classList.add('row-selected');
                tr.innerHTML = `
                    <td>
                        <div style="font-weight: 700; color: var(--text-primary); display:flex; align-items:center; gap:0.4rem; flex-wrap:wrap;">${selChk}${sanitizeHTML(p.num)}${badgeHtml}</div>
                        <div>${sanitizeHTML(p.int)}</div>
                    </td>
                    <td>${sanitizeHTML(p.obj) || '—'}</td>
                    <td style="text-align:center"><span class="status ${safeCSSClass(p.stat, VALID_STATS)}">${sanitizeHTML(sTxt)}</span></td>
                    <td style="text-align:center" ${prazoTitle}><span class="prazo-cell ${urgClass}">${urgIcon}${p.prazo ? fmtBR(p.prazo) : '—'}</span></td>
                    <td style="text-align:center">
                        <div class="action-buttons" style="display:flex; gap: 4px; justify-content:center;">
                            <button class="icon-btn" data-view-proc="${p.id}" title="Visualizar"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>
                            <button class="icon-btn" data-edit-proc="${p.id}" title="Editar"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
                            <button class="icon-btn" data-del-proc="${p.id}" title="Excluir"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg></button>
                        </div>
                    </td>
                `;
                tbody.appendChild(tr);

                const card = document.createElement('div');
                card.className = `proc-card ${urgClass}${selectionMode && selectedIds.has(String(p.id)) ? ' row-selected' : ''}`;
                card.innerHTML = `
                    <div class="proc-card-header">
                        <span class="num" style="display:flex;align-items:center;gap:0.5rem;">${selChk}${sanitizeHTML(p.num)}</span>
                        <div style="display:flex;align-items:center;gap:0.5rem;">
                            ${p.anotacoes && p.anotacoes.length > 0 ? `<span class="anotacoes-badge" data-anot="${p.id}" aria-label="${p.anotacoes.length} anotação(ões)"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> ${p.anotacoes.length}</span>` : ''}
                            <span class="status ${safeCSSClass(p.stat, VALID_STATS)}">${sanitizeHTML(sTxt)}</span>
                        </div>
                    </div>
                    <div class="proc-card-body">
                        <div class="item"><strong>Interessado:</strong> ${sanitizeHTML(p.int)}</div>
                        <div class="item"><strong>Objeto:</strong> ${sanitizeHTML(p.obj) || '—'}</div>
                        <div class="item"><strong>Prazo:</strong> <span class="prazo-cell ${urgClass}">${urgIcon}${p.prazo ? fmtBR(p.prazo) : '—'}</span></div>
                    </div>
                    <div class="proc-card-footer">
                        <button class="btn secondary" data-view-proc="${p.id}">Ver</button>
                        <button class="btn" data-edit-proc="${p.id}">Editar</button>
                        <button class="btn danger" data-del-proc="${p.id}">Excluir</button>
                    </div>
                `;
                mobileContainer.appendChild(card);
            });
        }
        renderPagination(paginationProcessesContainer, L.length, currentPage, itemsPerPage, (newPage) => {
            currentPage = newPage;
            draw();
        });
        updateBulkUI();
    }

    // Mantém a barra de exclusão em massa em sincronia com a seleção atual
    function updateBulkUI() {
        // Remove da seleção ids que sumiram (ex.: filtro mudou) — mantém só os visíveis no filtro atual
        const validIds = new Set(lastFiltered.map(p => String(p.id)));
        selectedIds.forEach(id => { if (!validIds.has(id)) selectedIds.delete(id); });

        const n = selectedIds.size;
        bulkCount.textContent = `${n} selecionado(s)`;
        btnBulkDelete.disabled = n === 0;
        bulkSelAll.checked = lastFiltered.length > 0 && n === lastFiltered.length;
        bulkSelAll.indeterminate = n > 0 && n < lastFiltered.length;
    }

    function setSelectionMode(on) {
        selectionMode = on;
        if (!on) selectedIds.clear();
        bulkBar.style.display = on ? 'flex' : 'none';
        btnSelecionar.classList.toggle('active', on);
        draw();
    }
    
    let viewMode = 'lista';
    const kanbanContainer = $('#kanban-container');
    const paginationEl = $('#pagination-bar');

    const KANBAN_COLS = [
        { key: 'pendente',                label: 'Pendente',               color: '#b42323' },
        { key: 'em-analise',              label: 'Em Análise',             color: '#b25e09' },
        { key: 'aguardando-documentacao', label: 'Aguard. Documentação',   color: '#0a3d73' },
        { key: 'em-diligencia',           label: 'Em Diligência',          color: '#7c3aad' },
        { key: 'finalizado',              label: 'Finalizado',             color: '#2f855a' },
        { key: 'arquivado',               label: 'Arquivado',              color: '#8194ab' },
    ];

    function drawKanban() {
        const L = filterSort();
        kanbanContainer.innerHTML = KANBAN_COLS.map(col => {
            const procs = L.filter(p => p.stat === col.key);
            const cards = procs.map(p => {
                const dias = p.prazo ? diffDays(todayUTC(), parse(p.prazo)) : null;
                const vencido = dias !== null && p.stat !== 'finalizado' && p.stat !== 'arquivado' && dias < 0;
                const alerta  = dias !== null && p.stat !== 'finalizado' && p.stat !== 'arquivado' && dias >= 0 && dias <= 5;
                const prazoClass = vencido ? 'vencido' : alerta ? 'alerta' : '';
                const badgeHtml = p.anotacoes && p.anotacoes.length > 0
                    ? `<span class="anotacoes-badge" data-anot="${p.id}" aria-label="${p.anotacoes.length} anotação(ões)"><svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> ${p.anotacoes.length}</span>` : '';
                return `
                    <div class="kanban-card" data-view-proc="${p.id}" data-proc-id="${p.id}">
                        <div class="kanban-card-num">${sanitizeHTML(p.num)}</div>
                        <div class="kanban-card-int">${sanitizeHTML(p.int)}</div>
                        ${p.obj ? `<div class="kanban-card-obj">${sanitizeHTML(p.obj)}</div>` : ''}
                        <div class="kanban-card-footer">
                            ${p.prazo ? `<span class="kanban-prazo ${prazoClass}">⏱ ${fmtBR(p.prazo)}</span>` : '<span></span>'}
                            ${badgeHtml}
                        </div>
                    </div>`;
            }).join('');
            return `
                <div class="kanban-column">
                    <div class="kanban-col-header" style="border-top:3px solid ${col.color};">
                        <span class="kanban-col-title">${col.label}</span>
                        <span class="kanban-col-count">${procs.length}</span>
                    </div>
                    <div class="kanban-col-body" data-col-key="${col.key}">
                        ${cards || '<p class="kanban-empty">Sem processos</p>'}
                    </div>
                </div>`;
        }).join('');
    }

    // Move um processo para outro status (usado pelo drag & drop do Kanban)
    async function moveProcToStatus(id, newStat) {
        if (!id || !newStat || !VALID_STATS.has(newStat)) return;
        const p = DB.find(x => String(x.id) === String(id));
        if (!p || p.stat === newStat) return;
        const oldStat = p.stat;
        p.stat = newStat;
        try {
            await dbHelper.put('processos', p);
            await logHistorico(p.id, p.num, 'editado', [{ campo: 'stat', de: oldStat, para: newStat }]);
            showToast(`Processo movido para "${statusMap[newStat] || newStat}".`, 'success');
        } catch (err) {
            p.stat = oldStat; // rollback em caso de falha
            console.warn('Erro ao mover processo:', err);
            showToast('Não foi possível mover o processo.', 'danger');
        }
        drawKanban();
    }

    // Drag & drop baseado em Pointer Events (funciona com mouse e toque)
    function initKanbanDnD(container) {
        let drag = null;
        const THRESH = 8;

        container.addEventListener('pointerdown', (e) => {
            if (e.button != null && e.button > 0) return; // apenas botão principal / toque
            const card = e.target.closest('.kanban-card');
            if (!card) return;
            drag = { id: card.dataset.procId, card, startX: e.clientX, startY: e.clientY,
                     pointerId: e.pointerId, started: false, ghost: null, overBody: null };
        });

        window.addEventListener('pointermove', (e) => {
            if (!drag || e.pointerId !== drag.pointerId) return;
            const dx = e.clientX - drag.startX, dy = e.clientY - drag.startY;
            if (!drag.started) {
                if (Math.hypot(dx, dy) < THRESH) return;
                drag.started = true;
                const r = drag.card.getBoundingClientRect();
                const ghost = drag.card.cloneNode(true);
                ghost.classList.add('kanban-card-ghost');
                ghost.style.width = r.width + 'px';
                drag.gx = e.clientX - r.left;
                drag.gy = e.clientY - r.top;
                document.body.appendChild(ghost);
                drag.ghost = ghost;
                drag.card.classList.add('dragging');
                document.body.classList.add('kanban-dragging');
            }
            e.preventDefault();
            drag.ghost.style.left = (e.clientX - drag.gx) + 'px';
            drag.ghost.style.top = (e.clientY - drag.gy) + 'px';
            const under = document.elementFromPoint(e.clientX, e.clientY);
            const body = under && under.closest ? under.closest('.kanban-col-body') : null;
            container.querySelectorAll('.kanban-col-body.drag-over').forEach(el => { if (el !== body) el.classList.remove('drag-over'); });
            if (body) body.classList.add('drag-over');
            drag.overBody = body;
        }, { passive: false });

        const finish = async (e) => {
            if (!drag || e.pointerId !== drag.pointerId) return;
            const d = drag; drag = null;
            container.querySelectorAll('.kanban-col-body.drag-over').forEach(el => el.classList.remove('drag-over'));
            if (!d.started) return; // foi um toque/clique simples → deixa abrir os detalhes
            d.card.classList.remove('dragging');
            document.body.classList.remove('kanban-dragging');
            if (d.ghost) d.ghost.remove();
            // suprime o clique sintético que segue o arrasto (evita abrir "Ver")
            const supp = (ev) => { ev.stopPropagation(); ev.preventDefault(); };
            window.addEventListener('click', supp, true);
            setTimeout(() => window.removeEventListener('click', supp, true), 350);
            if (d.overBody && d.overBody.dataset.colKey) {
                await moveProcToStatus(d.id, d.overBody.dataset.colKey);
            }
        };
        window.addEventListener('pointerup', finish);
        window.addEventListener('pointercancel', (e) => {
            if (!drag || e.pointerId !== drag.pointerId) return;
            if (drag.ghost) drag.ghost.remove();
            drag.card.classList.remove('dragging');
            document.body.classList.remove('kanban-dragging');
            container.querySelectorAll('.kanban-col-body.drag-over').forEach(el => el.classList.remove('drag-over'));
            drag = null;
        });
    }
    if (kanbanContainer && !kanbanContainer.dataset.dndInit) {
        kanbanContainer.dataset.dndInit = '1';
        initKanbanDnD(kanbanContainer);
    }

    function setViewMode(mode) {
        viewMode = mode;
        const isKanban = mode === 'kanban';
        // Seleção múltipla só existe na Lista — desliga ao ir pro Kanban
        if (isKanban && selectionMode) setSelectionMode(false);
        btnSelecionar.style.display = isKanban ? 'none' : '';
        const kc = document.getElementById('kanban-container');
        const tw = document.getElementById('proc-table-wrap');
        if (kc) kc.style.display = isKanban ? 'flex' : 'none';
        if (tw) tw.style.display = isKanban ? 'none' : '';
        mobileContainer.style.display   = isKanban ? 'none' : '';
        paginationEl.style.display      = isKanban ? 'none' : '';
        document.querySelector('.main-content').style.overflowX = isKanban ? 'auto' : '';
        $('#btnViewLista').classList.toggle('active', !isKanban);
        $('#btnViewKanban').classList.toggle('active', isKanban);
        if (isKanban) drawKanban(); else draw(true);
    }

    $('#btnViewLista').onclick  = () => setViewMode('lista');
    $('#btnViewKanban').onclick = () => setViewMode('kanban');

    q.oninput = () => { if (viewMode === 'kanban') drawKanban(); else draw(true); };
    ord.onchange = () => { if (viewMode === 'kanban') drawKanban(); else draw(true); };

    const refreshView = () => { updateFiltrosUI(); if (viewMode === 'kanban') drawKanban(); else draw(true); };
    [filtroStatus, filtroSetor, filtroTipo, filtroEmissor, filtroEntradaDe, filtroEntradaAte].forEach(el => {
        el.onchange = refreshView;
    });
    btnToggleFiltros.onclick = () => {
        const open = filtrosPanel.style.display !== 'none';
        filtrosPanel.style.display = open ? 'none' : 'block';
    };
    btnLimparFiltros.onclick = () => {
        filtroStatus.value = ''; filtroSetor.value = ''; filtroTipo.value = '';
        filtroEmissor.value = ''; filtroEntradaDe.value = ''; filtroEntradaAte.value = '';
        refreshView();
    };
    updateFiltrosUI();

    itemsPerPageSel.onchange = async () => {
        itemsPerPage = Number(itemsPerPageSel.value) || 10;
        CFG.procItemsPerPage = itemsPerPage;
        await saveCFG();
        currentPage = 1;
        draw();
    };

    $('#add').onclick = () => openProc('new');
    $('#exportCsv').onclick = () => exportCSV(filterSort());
    $('#exportXlsx').onclick = () => exportXLSX(filterSort());
    
    const procContainer = $('#secProc');
    procContainer.onclick = async (e) => {
        const viewBtn = e.target.closest('[data-view-proc]');
        const editBtn = e.target.closest('[data-edit-proc]');
        const delBtn = e.target.closest('[data-del-proc]');

        if (viewBtn) openProcDetails(viewBtn.dataset.viewProc);
        if (editBtn) openProc('edit', editBtn.dataset.editProc);
        if (delBtn) {
            const rawId = delBtn.dataset.delProc;
            if (!rawId || rawId === 'undefined') { showToast('ID inválido. Recarregue a página.', 'danger'); return; }
            const id = Number(rawId);
            const procToDelete = DB.find(p => p.id == id);
            if (await excluirProcessoEmCascata(id, procToDelete)) {
                draw(true);
                renderDashboard();
                showToast('Processo excluído.', 'danger');
            }
        }
    };

    // Marca/desmarca um processo na seleção múltipla
    procContainer.addEventListener('change', (e) => {
        const chk = e.target.closest('[data-sel-proc]');
        if (!chk) return;
        const id = String(chk.dataset.selProc);
        if (chk.checked) selectedIds.add(id); else selectedIds.delete(id);
        const row = chk.closest('tr, .proc-card');
        if (row) row.classList.toggle('row-selected', chk.checked);
        updateBulkUI();
    });

    btnSelecionar.onclick = () => setSelectionMode(!selectionMode);
    btnBulkCancel.onclick = () => setSelectionMode(false);

    bulkSelAll.onchange = () => {
        if (bulkSelAll.checked) lastFiltered.forEach(p => selectedIds.add(String(p.id)));
        else selectedIds.clear();
        draw();
    };

    btnBulkDelete.onclick = async () => {
        const ids = [...selectedIds];
        if (ids.length === 0) return;
        const procs = ids.map(id => DB.find(p => String(p.id) === id)).filter(Boolean);
        const comParecer = procs.filter(p => { const info = getParecerInfo(p); return info?.tipo === 'estruturado' || info?.tipo === 'legado'; }).length;
        let avisoParecer = '';
        if (comParecer === 1) avisoParecer = `<br><br><strong>1</strong> deles tem um parecer vinculado, que também será excluído (com todo o histórico de versões).`;
        else if (comParecer > 1) avisoParecer = `<br><br><strong>${comParecer}</strong> deles têm pareceres vinculados, que também serão excluídos (com todo o histórico de versões).`;
        const msg = `Tem certeza que deseja excluir <strong>${procs.length}</strong> processo(s) selecionado(s)?${avisoParecer}<br><br>Esta ação não pode ser desfeita.`;
        if (!(await confirmDialog(msg, { title: 'Excluir processos', confirmLabel: `Excluir ${procs.length}` }))) return;

        let ok = 0;
        for (const p of procs) {
            try { await deleteProcessoCascata(p.id, p); ok++; }
            catch (err) { console.error('Erro ao excluir processo em massa:', p.id, err); }
        }
        setSelectionMode(false);
        renderDashboard();
        if (ok === procs.length) showToast(`${ok} processo(s) excluído(s).`, 'danger');
        else showToast(`${ok} de ${procs.length} excluído(s) — alguns falharam.`, 'danger');
    };

    draw(reset);
  }

  const SETORES = ['Comissões', 'Controladoria', 'CPL', 'Depto. Financeiro', 'Diretoria Geral', 'Gabinete Vereador', 'Presidência', 'Recursos Humanos', 'Secretaria Geral', 'Outros'].sort();
  function popularSelect(selectElement, optionsArray) {
      if (!selectElement) return;
      selectElement.innerHTML = '<option value="">Selecione...</option>';
      optionsArray.forEach(s => {
          const option = document.createElement('option');
          option.value = s;
          option.textContent = s;
          selectElement.appendChild(option);
      });
  }

  function openProc(mode, id) {
    const m = $('#m_proc'); m.style.display = 'flex';
    $('#m_proc_t').textContent = mode === 'new' ? 'Novo Processo' : 'Editar Processo';
    $$('[data-close-proc]').forEach(x => x.onclick = () => m.style.display = 'none');
    
    popularSelect($('#fp_origem'), SETORES);
    popularSelect($('#fp_dest'), SETORES);
    updateEmissorSelect();

    const form = $('#f_proc'), del = $('#fp_del');
    form.reset();

    if (mode === 'edit') {
        const p = DB.find(x => x.id == id); if (!p) return;
        for (const key in p) {
            if (form.elements[key]) form.elements[key].value = p[key];
        }
        del.style.display = 'inline-flex';
    } else {
        form.elements.id.value = '';
        del.style.display = 'none';
    }
    
    form.onsubmit = async (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const idVal = formData.get('id');
        const isNew = !idVal;
        const rec = { id: isNew ? Date.now() : Number(idVal) };
        for (let [key, value] of formData.entries()) {
            if (key !== 'id') rec[key] = value.trim();
        }
        
        try { const idx = DB.findIndex(p => p.id == rec.id);
        if (idx > -1) {
            const oldRec = { ...DB[idx] };
            rec.docId = DB[idx].docId ?? null;
            DB[idx] = rec;
            await dbHelper.put('processos', rec);
            await logHistorico(rec.id, rec.num, 'editado', getChanges(oldRec, rec));
        } else {
            DB.unshift(rec);
            await dbHelper.put('processos', rec);
            await logHistorico(rec.id, rec.num, 'criado');
        }
        m.style.display = 'none';
        renderProc(true);
        renderDashboard();
        showToast('Processo salvo com sucesso!'); } catch(err) { console.error('Erro ao salvar processo:', err); showToast('Erro ao salvar. Tente novamente.', 'danger'); return; }
    };
    del.onclick = async () => {
        const idVal = Number(form.elements.id.value);
        if (!idVal) return;
        const procToDelete = DB.find(p => p.id == idVal);
        if (await excluirProcessoEmCascata(idVal, procToDelete)) {
            m.style.display = 'none';
            renderProc(true);
            renderDashboard();
            showToast('Processo excluído.', 'danger');
        }
    };
  }
  function openProcDetails(id) {
    const p = DB.find(proc => proc.id == id);
    if (!p) return;

    const modal = $('#m_proc_view');
    $('#view_proc_title').textContent = `Detalhes do Processo ${sanitizeHTML(p.num)}`;
    const content = $('#view-details-content');

    const diasTramitacao = (p.ent) ? `${diffDays(parse(p.ent), p.saida ? parse(p.saida) : todayUTC())} dia(s)` : '—';
    
    const createViewItem = (label, value) => {
        const item = document.createElement('div');
        item.className = 'view-item';
        const strong = document.createElement('strong');
        strong.textContent = label;
        const pEl = document.createElement('p');
        pEl.textContent = value || '—';
        item.appendChild(strong);
        item.appendChild(pEl);
        return item;
    };
    
    const createViewItemHTML = (label, html) => {
        const item = document.createElement('div');
        item.className = 'view-item';
        const strong = document.createElement('strong');
        strong.textContent = label;
        const pEl = document.createElement('p');
        pEl.innerHTML = html;
        item.appendChild(strong);
        item.appendChild(pEl);
        return item;
    };
    
    content.innerHTML = `
      <div class="view-section">
        <h4>Identificação</h4>
        <div class="view-grid" id="details-identificacao"></div>
      </div>
      <div class="view-section">
        <h4>Tramitação e Parecer</h4>
        <div class="view-grid" id="details-tramitacao"></div>
      </div>
      <div class="view-section anotacoes-section">
        <h4>Anotações e Pendências</h4>
        <div class="anotacoes-timeline" id="anotacoes-timeline"></div>
        <div class="anotacao-nova">
          <textarea id="nova-anotacao" class="anotacao-textarea" placeholder="Registrar anotação, pendência ou atualização..."></textarea>
          <button id="btnRegistrarAnotacao" class="btn primary">Registrar</button>
        </div>
      </div>
    `;

    const idGrid = $('#details-identificacao');
    idGrid.appendChild(createViewItem('Nº Processo', p.num)).style.gridColumn = '1 / -1';
    idGrid.appendChild(createViewItem('Tipo', p.tipo === 'administrativo' ? 'Administrativo' : 'Judicial'));
    idGrid.appendChild(createViewItem('Interessado', p.int)).style.gridColumn = '1 / -1';
    idGrid.appendChild(createViewItem('Objeto', p.obj)).style.gridColumn = '1 / -1';
    idGrid.appendChild(createViewItem('Ação Tomada', p.acao)).style.gridColumn = '1 / -1';

    const tramGrid = $('#details-tramitacao');
    tramGrid.appendChild(createViewItemHTML('Status', `<span class="status ${safeCSSClass(p.stat, VALID_STATS)}">${sanitizeHTML(statusMap[p.stat]) || '—'}</span>`));
    tramGrid.appendChild(createViewItem('Prazo Final', fmtBR(p.prazo)));
    tramGrid.appendChild(createViewItem('Setor de Origem', p.setorOrigem));
    tramGrid.appendChild(createViewItem('Setor Enviado', p.dest));
    tramGrid.appendChild(createViewItem('Data de Entrada', fmtBR(p.ent)));
    tramGrid.appendChild(createViewItem('Data de Saída', fmtBR(p.saida)));
    tramGrid.appendChild(createViewItem('Dias de Tramitação', diasTramitacao));
    
    const parecerItem = document.createElement('div');
    parecerItem.className = 'view-item';
    parecerItem.style.gridColumn = '1 / -1';
    parecerItem.innerHTML = `
        <strong>Parecer Vinculado</strong>
        <div id="view-parecer-details" style="display: flex; align-items: center; gap: 1rem; margin-top: 0.5rem;"></div>
        <input type="file" id="anexarParecerFile" class="sr-only" accept=".doc,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document">
    `;
    tramGrid.appendChild(parecerItem);
    
    const parecerContainer = $('#view-parecer-details');
    const parecerInfo = getParecerInfo(p);
    if (parecerInfo?.tipo === 'estruturado') {
        const dataInfo = parecerInfo.emitido ? `Emitido em ${fmtBR(parecerInfo.dataRef)}` : `Última atualização: ${fmtBR(parecerInfo.dataRef)}`;
        parecerContainer.innerHTML = `
            <span class="status ${parecerInfo.emitido ? 'emitido' : 'rascunho'}">${parecerInfo.label}</span>
            <p style="margin:0; font-weight: 600;">${sanitizeHTML(dataInfo)}</p>
            <button id="btnAbrirParecerView" class="btn primary">${parecerInfo.emitido ? 'Ver Parecer' : 'Continuar Redigindo'}</button>
            ${parecerInfo.emitido ? '<button id="btnGerarPdfParecerView" class="btn secondary">Gerar PDF Oficial</button>' : ''}
        `;
        $('#btnAbrirParecerView').onclick = () => openParecerModal(p);
        if (parecerInfo.emitido) $('#btnGerarPdfParecerView').onclick = () => generateParecerPDF(p);
    } else if (parecerInfo?.tipo === 'legado') {
        const parecerDoc = parecerInfo.docLegado;
        const currentVersion = getCurrentVersion(parecerDoc.id);
        parecerContainer.innerHTML = `
            <p style="margin:0; font-weight: 600;">${sanitizeHTML(parecerDoc.nomePrincipal)}</p>
            ${currentVersion ? `<button class="btn secondary" data-download-version="${currentVersion.id}">Ver Parecer</button>` : ''}
            <button class="btn" data-versions-for="${parecerDoc.id}">Histórico</button>
        `;
        if(currentVersion) parecerContainer.querySelector('[data-download-version]').onclick = (e) => { const v = getVersion(Number(e.target.dataset.downloadVersion)); if(v) handleDownload(v.data, v.nomeArquivo); };
        parecerContainer.querySelector('[data-versions-for]').onclick = (e) => openVersionsModal(Number(e.target.dataset.versionsFor));
    } else if (parecerInfo?.tipo === 'legado-orfao') {
        parecerContainer.innerHTML = `<p style="margin:0;">Vinculado, mas não encontrado (ID: ${p.docId}).</p>`;
    } else {
        parecerContainer.innerHTML = `
            <p style="margin:0;">Nenhum parecer redigido para este processo.</p>
            <button id="btnRedigirParecerView" class="btn primary">Redigir Parecer</button>
            <button id="btnAnexarParecerView" class="btn secondary">Anexar Word (legado)</button>
        `;
        $('#btnRedigirParecerView').onclick = () => openParecerModal(p);
        $('#btnAnexarParecerView').onclick = () => $('#anexarParecerFile').click();
    }
    
    $('#anexarParecerFile').onchange = async (e) => {
        const file = e.target.files[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = async (ev) => {
            const docId = Date.now();
            const newDoc = { id: docId, nomePrincipal: file.name, criadoEm: new Date().toISOString(), idVersaoAtual: null };
            const versionId = Date.now() + 1;
            const newVersion = { id: versionId, idDocumento: docId, versao: 1, nomeArquivo: file.name, data: ev.target.result, adicionadoEm: new Date().toISOString() };
            newDoc.idVersaoAtual = versionId;

            DB_DOCS.push(newDoc); DB_VERSOES.push(newVersion);
            await dbHelper.put('documentos', newDoc);
            await dbHelper.put('versoes', newVersion);

            p.docId = docId; await dbHelper.put('processos', p);
            
            showToast('Parecer anexado e vinculado com sucesso!', 'success');
            openProcDetails(id);
        };
        reader.readAsDataURL(file); e.target.value = ''; 
    };
    
    const selectEmissorView = $('#pdf_emissor_select_view');
    selectEmissorView.innerHTML = '<option value="">Usuário Logado</option>';
    DB_EMISSORES.forEach(emissor => {
        const option = document.createElement('option');
        option.value = emissor.id;
        option.textContent = emissor.name;
        selectEmissorView.appendChild(option);
    });
    if (p.emissorId) { selectEmissorView.value = p.emissorId; }

    let editingAnotId = null;
    const ANOT_ICON_EDIT = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';
    const ANOT_ICON_DEL = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';

    const renderAnotacoes = () => {
        const timeline = $('#anotacoes-timeline');
        const lista = (p.anotacoes || []).slice().sort((a, b) => b.id - a.id);
        if (lista.length === 0) {
            timeline.innerHTML = '<p class="anotacoes-empty">Nenhuma anotação registrada ainda.</p>';
            return;
        }
        timeline.innerHTML = lista.map(a => {
            const dt = new Date(a.dt);
            const dateStr = dt.toLocaleDateString('pt-BR') + ' às ' + dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            const initials = sanitizeHTML(a.usuario.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase());
            const editing = String(a.id) === editingAnotId;
            const corpo = editing
                ? `<textarea class="anotacao-textarea anotacao-edit-input" data-edit-input="${a.id}">${sanitizeHTML(a.texto)}</textarea>
                   <div class="anotacao-edit-actions">
                       <button class="btn" data-cancel-anot="${a.id}">Cancelar</button>
                       <button class="btn primary" data-save-anot="${a.id}">Salvar</button>
                   </div>`
                : `<p class="anotacao-texto">${sanitizeHTML(a.texto)}</p>`;
            const acoes = editing ? '' : `<div class="anotacao-acoes">
                        <button class="anotacao-acao-btn" data-edit-anot="${a.id}" title="Editar" aria-label="Editar anotação">${ANOT_ICON_EDIT}</button>
                        <button class="anotacao-acao-btn danger" data-del-anot="${a.id}" title="Excluir" aria-label="Excluir anotação">${ANOT_ICON_DEL}</button>
                    </div>`;
            return `
                <div class="anotacao-entry">
                    <div class="anotacao-avatar">${initials}</div>
                    <div class="anotacao-body">
                        <div class="anotacao-meta">
                            <span class="anotacao-user">${sanitizeHTML(a.usuario)}</span>
                            <div class="anotacao-meta-right">
                                <span class="anotacao-date">${sanitizeHTML(dateStr)}</span>
                                ${acoes}
                            </div>
                        </div>
                        ${corpo}
                    </div>
                </div>`;
        }).join('');
    };
    renderAnotacoes();

    // Editar / excluir anotações (delegação — o container é fixo, só o innerHTML muda).
    $('#anotacoes-timeline').onclick = async (e) => {
        const editBtn = e.target.closest('[data-edit-anot]');
        const cancelBtn = e.target.closest('[data-cancel-anot]');
        const saveBtn = e.target.closest('[data-save-anot]');
        const delBtn = e.target.closest('[data-del-anot]');

        if (editBtn) {
            editingAnotId = editBtn.dataset.editAnot;
            renderAnotacoes();
            const inp = $(`[data-edit-input="${editingAnotId}"]`);
            if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
            return;
        }
        if (cancelBtn) { editingAnotId = null; renderAnotacoes(); return; }
        if (saveBtn) {
            const anotId = saveBtn.dataset.saveAnot;
            const inp = $(`[data-edit-input="${anotId}"]`);
            const novoTexto = inp ? inp.value.trim() : '';
            if (!novoTexto) { showToast('A anotação não pode ficar vazia.', 'info'); return; }
            const alvo = (p.anotacoes || []).find(a => String(a.id) === anotId);
            if (alvo) { alvo.texto = novoTexto; await dbHelper.put('processos', p); }
            editingAnotId = null;
            renderAnotacoes();
            renderProc();
            showToast('Anotação atualizada!', 'success');
            return;
        }
        if (delBtn) {
            const anotId = delBtn.dataset.delAnot;
            const ok = await confirmDialog('Esta anotação será removida permanentemente.', { title: 'Excluir anotação', confirmLabel: 'Excluir' });
            if (!ok) return;
            p.anotacoes = (p.anotacoes || []).filter(a => String(a.id) !== anotId);
            await dbHelper.put('processos', p);
            editingAnotId = null;
            renderAnotacoes();
            renderProc();
            showToast('Anotação excluída.', 'danger');
            return;
        }
    };

    $('#btnRegistrarAnotacao').onclick = async () => {
        const textarea = $('#nova-anotacao');
        const texto = textarea.value.trim();
        if (!texto) { showToast('Digite uma anotação antes de registrar.', 'info'); return; }
        const user = JSON.parse(sessionStorage.getItem('loggedInUser'));
        const entrada = { id: Date.now(), usuario: user?.name || user?.login || 'Usuário', dt: new Date().toISOString(), texto };
        if (!p.anotacoes) p.anotacoes = [];
        p.anotacoes.push(entrada);
        await dbHelper.put('processos', p);
        textarea.value = '';
        renderAnotacoes();
        renderProc();
        showToast('Anotação registrada!', 'success');
    };

    modal.style.display = 'flex'; modal.dataset.procId = id;;
    $$('[data-close-view]').forEach(b=>b.onclick=()=>modal.style.display='none'); modal.onclick=(e)=>{if(e.target===modal)modal.style.display='none';}; $$('[data-open-proc-edit]').forEach(b=>b.onclick=()=>{const pid=Number(modal.dataset.procId);modal.style.display='none';openProc('edit',pid);});

    $('#btnGerarPdf').onclick = async () => {
        const selectedEmissorId = $('#pdf_emissor_select_view').value;
        generateProcessPDF(id, selectedEmissorId);
    };

    const btnHistorico = $('#btnHistorico');
    if (btnHistorico) btnHistorico.onclick = () => openHistoricoModal(p.id, p.num);
  }

  async function openHistoricoModal(processoId, processoNum) {
      const m = $('#m_historico'); if (!m) return;
      $('#m_historico_t').textContent = `Histórico — Processo ${processoNum}`;
      const timeline = $('#historico-timeline');
      timeline.innerHTML = '<div class="historico-loading">Carregando histórico...</div>';
      m.style.display = 'flex';
      m.onclick = (e) => { if (e.target === m) m.style.display = 'none'; };
      $$('[data-close-historico]').forEach(x => x.onclick = () => m.style.display = 'none');

      try {
          const snapshot = await window.db.collection('historico')
              .where('processoId', '==', String(processoId))
              .get();
          const entries = snapshot.docs.map(d => d.data())
              .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

          if (entries.length === 0) {
              timeline.innerHTML = `
                  <div class="empty-state">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 3v5h5"/><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"/><path d="M12 7v5l4 2"/></svg>
                      <h3>Sem registros</h3>
                      <p>Nenhuma alteração registrada para este processo ainda.</p>
                  </div>`;
              return;
          }

          timeline.innerHTML = '';
          entries.forEach(entry => {
              const dt = new Date(entry.timestamp);
              const dateStr = dt.toLocaleDateString('pt-BR') + ' às ' + dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
              let changesHtml = '';
              if (entry.campos && entry.campos.length > 0) {
                  const items = entry.campos.map(c => {
                      const label = fieldLabels[c.campo] || c.campo;
                      const de = c.campo === 'stat' ? (statusMap[c.de] || c.de || '—') : (c.de || '—');
                      const para = c.campo === 'stat' ? (statusMap[c.para] || c.para || '—') : (c.para || '—');
                      return `<li><span class="campo">${sanitizeHTML(label)}:</span> <span class="de">${sanitizeHTML(de)}</span> <span style="color:var(--text-muted)">→</span> <span class="para">${sanitizeHTML(para)}</span></li>`;
                  }).join('');
                  changesHtml = `<ul class="historico-changes">${items}</ul>`;
              } else if (ACAO_META[entry.acao]?.textoSemCampos) {
                  changesHtml = `<p style="font-size:0.82rem;color:var(--text-muted);margin:0;">${ACAO_META[entry.acao].textoSemCampos}</p>`;
              }
              const div = document.createElement('div');
              div.className = 'historico-entry';
              div.innerHTML = `
                  <div class="historico-icon ${safeCSSClass(entry.acao, VALID_ACAO)}">${ACAO_META[entry.acao]?.icon || ''}</div>
                  <div class="historico-content">
                      <div class="historico-header">
                          <span class="historico-action">${sanitizeHTML(ACAO_META[entry.acao]?.label || entry.acao)}</span>
                          <span class="historico-meta">${sanitizeHTML(dateStr)} · ${sanitizeHTML(entry.usuario)}</span>
                      </div>
                      ${changesHtml}
                  </div>`;
              timeline.appendChild(div);
          });
      } catch (e) {
          console.error('Erro ao carregar histórico:', e);
          timeline.innerHTML = `<div class="empty-state"><p>Não foi possível carregar o histórico. Verifique a conexão.</p></div>`;
      }
  }

  // Brasão (base64) do timbre do PDF foi movido para js/assets.js — ver a const BRASAO_DUQUE_DE_CAXIAS_B64.

  async function generateProcessPDF(procId, emissorId) {
      try {
            const p = DB.find(proc => proc.id == procId); if (!p) { showToast('Processo não encontrado.', 'danger'); return; }
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
            doc.setFont('helvetica'); let y = 15;
            const pageW = doc.internal.pageSize.getWidth(), margin = 15;

            doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.text('Consultoria Jurídica – Câmara Municipal', pageW / 2, y, { align: 'center' }); y += 7;
            const timestamp = new Date().toLocaleString('pt-BR');
            doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(150, 150, 150); doc.text(`Emitido em: ${timestamp}`, pageW - margin, y, { align: 'right' }); y += 8;
            
            const drawSection = (title, contentCallback) => {
                if (y > 250) { doc.addPage(); y = 20; }
                doc.setFillColor(240, 240, 240); doc.roundedRect(margin, y, pageW - margin * 2, 8, 2, 2, 'F');
                doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(50, 50, 50); doc.text(title, margin + 3, y + 5.5); y += 12;
                const startContentY = y; contentCallback(); const endContentY = y;
                doc.setDrawColor(220, 220, 220); doc.setLineWidth(0.3); doc.rect(margin, startContentY - 1, pageW - margin * 2, endContentY - startContentY + 2); y += 8;
            };
            const drawDataRow = (label, value) => {
                const valueX = margin + 50, maxWidth = pageW - valueX - margin - 5;
                doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(80, 80, 80); doc.text(label, margin + 5, y + 5);
                doc.setFont('helvetica', 'normal'); doc.setTextColor(30, 30, 30); const lines = doc.splitTextToSize(String(value || '—'), maxWidth); doc.text(lines, valueX, y + 5);
                const rowHeight = lines.length * 5 + 4; doc.setDrawColor(230, 230, 230); doc.line(margin, y + rowHeight - 1, pageW - margin, y + rowHeight - 1); y += rowHeight;
            };

            drawSection('DADOS DO PROCESSO', () => { drawDataRow('Nº DO PROCESSO:', p.num); drawDataRow('TIPO:', p.tipo === 'administrativo' ? 'Administrativo' : 'Judicial'); drawDataRow('SETOR DE ORIGEM:', p.setorOrigem); drawDataRow('SETOR ENVIADO:', p.dest); drawDataRow('INTERESSADO:', p.int); });
            drawSection('OBJETO E AÇÃO TOMADA', () => { drawDataRow('OBJETO:', p.obj); drawDataRow('AÇÃO TOMADA:', p.acao); });
            drawSection('PRAZOS E ANDAMENTO', () => {
                const diasTramitacaoCalc = p.ent ? `${diffDays(parse(p.ent), p.saida ? parse(p.saida) : todayUTC())} dia(s)` : '—';
                drawDataRow('ENTRADA:', fmtBR(p.ent)); drawDataRow('SAÍDA:', fmtBR(p.saida)); drawDataRow('PRAZO FINAL:', fmtBR(p.prazo)); drawDataRow('TEMPO DE TRAMITAÇÃO:', diasTramitacaoCalc);
                const statusText = (statusMap[p.stat] || '—').toUpperCase(), statusColors = { finalizado: [34, 197, 94], arquivado: [100, 116, 139], 'em-analise': [245, 158, 11], pendente: [239, 68, 68], default: [100, 116, 139] }, statusColor = statusColors[p.stat] || statusColors.default;
                doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(80, 80, 80); doc.text('STATUS ATUAL:', margin + 5, y + 5);
                const textWidth = doc.getTextWidth(statusText); doc.setFillColor(statusColor[0], statusColor[1], statusColor[2]); doc.roundedRect(margin + 49, y + 1.5, textWidth + 6, 6, 2, 2, 'F');
                doc.setTextColor(255, 255, 255); doc.text(statusText, margin + 52, y + 5.5); y += 9;
            });
            
            const parecerInfoPdf = getParecerInfo(p);
            const parecerNomeBruto = parecerInfoPdf?.tipo === 'legado'
                ? parecerInfoPdf.nomeDocumento.replace(/\.(docx|doc)$/i, '')
                : parecerInfoPdf?.nomeDocumento;
            const parecerName = parecerNomeBruto || 'Nenhum parecer anexado';
            drawSection('PARECER', () => { drawDataRow('DOCUMENTO:', parecerName); });

            
            const pageH = doc.internal.pageSize.getHeight(), footerY = pageH - 25;
            const emitter = emissorId ? DB_EMISSORES.find(e => e.id == emissorId) : null, loggedInUser = JSON.parse(sessionStorage.getItem('loggedInUser')), emitterName = emitter ? emitter.name : (loggedInUser ? loggedInUser.name : 'Usuário');
            doc.line(margin + 40, footerY + 5, pageW - margin - 40, footerY + 5); doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.text(emitterName, pageW / 2, footerY + 10, { align: 'center' });
            
            doc.save(`ficha-processo_${p.num.replace(/[^a-zA-Z0-9]/g, '-')}.pdf`); showToast('Ficha PDF gerada com sucesso!');
      } catch (e) { console.error("Erro ao gerar PDF:", e); showToast('Ocorreu um erro ao gerar a ficha.', 'danger'); }
  }

  // ===== PDF oficial do parecer (com timbre repetido por página) =====

  // Desenha o timbre institucional (brasão + 3 linhas de cabeçalho) no topo da página atual e o
  // número da página no rodapé. Chamada uma vez na criação do doc e de novo a cada doc.addPage() —
  // diferente de generateProcessPDF, aqui o cabeçalho repete em TODA página (pedido explícito).
  // Retorna o Y inicial de conteúdo útil abaixo do timbre.
  function drawParecerTimbre(doc, pageNum) {
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 15;
      let y = 12;

      const imgY = y - 4, imgH = 20;
      doc.addImage(BRASAO_DUQUE_DE_CAXIAS_B64, 'PNG', margin, imgY, 16, imgH);

      doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(30, 30, 30);
      doc.text('ESTADO DO RIO DE JANEIRO', pageW / 2, y, { align: 'center' }); y += 5;
      doc.text('CÂMARA MUNICIPAL DE DUQUE DE CAXIAS', pageW / 2, y, { align: 'center' }); y += 5;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
      doc.text('PROCURADORIA-GERAL', pageW / 2, y, { align: 'center' }); y += 3;

      // A linha precisa ficar abaixo do brasão inteiro, não só do bloco de texto — o brasão
      // (imgH=20mm) é mais alto que o texto do cabeçalho, então usar só "y" cortava a imagem.
      const lineY = Math.max(y + 2, imgY + imgH + 2);
      doc.setDrawColor(180, 180, 180); doc.setLineWidth(0.4);
      doc.line(margin, lineY, pageW - margin, lineY);

      doc.setFontSize(8); doc.setTextColor(140, 140, 140);
      doc.text(`Página ${pageNum}`, pageW - margin, pageH - 10, { align: 'right' });

      return lineY + 8;
  }

  // Cursor de escrita com quebra de página automática, chamando drawParecerTimbre() a cada
  // nova página. Mesmo espírito do padrão `if (y > 250) { doc.addPage(); y = 20; }` já usado
  // em generateProcessPDF, mas encapsulado e reaproveitável.
  function createParecerPdfWriter(doc) {
      const margin = 15;
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const maxY = pageH - 20; // reserva espaço pro rodapé/numeração
      let pageNum = 1;
      let y = drawParecerTimbre(doc, pageNum);

      return {
          margin, pageW,
          get y() { return y; },
          set y(v) { y = v; },
          ensureSpace(neededHeight) {
              if (y + neededHeight > maxY) {
                  doc.addPage();
                  pageNum++;
                  y = drawParecerTimbre(doc, pageNum);
              }
          }
      };
  }

  // Converte um Quill Delta ({ ops: [...] }) em texto desenhado no PDF, respeitando bold/italic/
  // header(1-3)/align/list (ordered numerado de verdade, reiniciando quando a sequência quebra;
  // recuo cresce por nível de indentação — lineAttrs.indent).
  // Limitações aceitas (não são bugs): 'underline' não tem equivalente simples em texto jsPDF puro
  // (sai sem sublinhado); 'justify' vira 'left' (jsPDF não tem justificação nativa de texto);
  // a numeração de lista ordenada não reinicia por nível de indentação (contador único, achatado).
  // Simplificação assumida: se qualquer trecho da linha for bold/italic, a linha inteira sai
  // bold/italic (sem rich-text por run no jsPDF).
  function renderParecerDeltaToPdf(doc, writer, delta) {
      const ops = (delta && delta.ops) || [];
      let lineBuffer = [];
      let orderedListCounter = 0;

      function flushLine(lineAttrs) {
          if (lineBuffer.length === 0 && !lineAttrs) return;
          const header = lineAttrs && lineAttrs.header;
          const align = (lineAttrs && lineAttrs.align) || 'left';
          const listType = lineAttrs && lineAttrs.list;
          const fontSize = header === 1 ? 16 : header === 2 ? 14 : header === 3 ? 12 : 11;

          orderedListCounter = listType === 'ordered' ? orderedListCounter + 1 : 0;
          const isListItem = !!listType;
          const prefix = listType === 'bullet' ? '• ' : listType === 'ordered' ? `${orderedListCounter}. ` : '';
          const indentLevel = (lineAttrs && lineAttrs.indent) || 0;
          const indent = isListItem ? 5 + indentLevel * 5 : 0;
          const maxWidth = writer.pageW - writer.margin * 2 - indent;

          const anyBold = lineBuffer.some(r => r.bold) || !!header;
          const anyItalic = lineBuffer.some(r => r.italic);
          const fontStyle = anyBold && anyItalic ? 'bolditalic' : anyBold ? 'bold' : anyItalic ? 'italic' : 'normal';
          const text = prefix + lineBuffer.map(r => r.text).join('');

          // Mede a altura real (linhas quebradas por doc.splitTextToSize) ANTES de reservar
          // espaço — senão um parágrafo longo perto do fim da página só reserva 1 linha e
          // acaba escrito além da margem inferior em vez de quebrar pra próxima página.
          doc.setFont('helvetica', fontStyle);
          doc.setFontSize(fontSize);
          const lines = doc.splitTextToSize(text, maxWidth);
          const neededHeight = lines.length * (fontSize * 0.42) + (header ? 3 : 1.5);
          writer.ensureSpace(neededHeight);

          // ensureSpace pode ter desenhado uma página nova (o timbre mexe em font/size/cor) —
          // reaplica o estilo desta linha antes de desenhar o texto de verdade.
          doc.setFont('helvetica', fontStyle);
          doc.setFontSize(fontSize);
          doc.setTextColor(20, 20, 20);
          const x = align === 'center' ? writer.pageW / 2 : align === 'right' ? writer.pageW - writer.margin - indent : writer.margin + indent;
          doc.text(lines, x, writer.y + fontSize * 0.35, { align: align === 'justify' ? 'left' : align });
          writer.y += neededHeight;
          lineBuffer = [];
      }

      ops.forEach(op => {
          if (typeof op.insert !== 'string') return; // ignora embeds (não usados no editor hoje)
          const segments = op.insert.split('\n');
          segments.forEach((seg, i) => {
              if (seg) lineBuffer.push({ text: seg, bold: !!(op.attributes && op.attributes.bold), italic: !!(op.attributes && op.attributes.italic) });
              if (i < segments.length - 1) flushLine(op.attributes);
          });
      });
      flushLine(null);
  }

  // Gera o PDF oficial do parecer jurídico (timbre repetido por página + conteúdo formatado).
  // Só disponível para parecer estruturado já emitido.
  function generateParecerPDF(processo) {
      const info = getParecerInfo(processo);
      if (!info || info.tipo !== 'estruturado' || !info.emitido) {
          showToast('O parecer precisa estar emitido para gerar o PDF oficial.', 'danger');
          return;
      }
      const pz = info.parecer;
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
      const writer = createParecerPdfWriter(doc);
      renderParecerDeltaToPdf(doc, writer, pz.delta);
      doc.save(`parecer_${String(processo.num || pz.processoNum || '').replace(/[^a-zA-Z0-9]/g, '-')}.pdf`);
      showToast('PDF do parecer gerado com sucesso!');
  }

    function exportCSV(data) {
        if (data.length === 0) { showToast('Nenhum dado para exportar.', 'info'); return; }
        const csvEsc = (v) => `"${String(v || '').replace(/"/g, '""')}"`;
        const headers = ['Nº Processo','Tipo','Interessado','Objeto','Ação Tomada','Status','Setor de Origem','Setor Enviado','Data Entrada','Prazo Final','Data Saída','Dias Tramitação'];
        const rows = data.map(p => [
            csvEsc(p.num),
            csvEsc(p.tipo ? (p.tipo.charAt(0).toUpperCase() + p.tipo.slice(1)) : ''),
            csvEsc(p.int),
            csvEsc(p.obj),
            csvEsc(p.acao),
            csvEsc(statusMap[p.stat] || p.stat),
            csvEsc(p.setorOrigem),
            csvEsc(p.dest),
            csvEsc(p.ent ? fmtBR(p.ent) : ''),
            csvEsc(p.prazo ? fmtBR(p.prazo) : ''),
            csvEsc(p.saida ? fmtBR(p.saida) : ''),
            csvEsc((p.ent && p.saida) ? diffDays(parse(p.ent), parse(p.saida)) : (p.ent ? diffDays(parse(p.ent), todayUTC()) : ''))
        ].join(','));
        const BOM = '﻿';
        const blob = new Blob([BOM + [headers.join(','), ...rows].join('\r\n')], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `processos_${new Date().toISOString().slice(0,10)}.csv`;
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
        URL.revokeObjectURL(url);
        showToast('Dados exportados para CSV!');
    }

    async function exportXLSX(data) {
        showToast('Gerando planilha...', 'info');
        try {
            if (typeof ExcelJS === 'undefined') throw new Error('Biblioteca ExcelJS não carregada.');

            const wb = new ExcelJS.Workbook();
            wb.creator = 'JurisControl';
            wb.created = new Date();

            const hoje = new Date().toLocaleDateString('pt-BR');

            const C = {
                NAVY:        'FF1B3A5C',
                NAVY_MID:    'FF2D5986',
                BLUE_HDR:    'FF1D4ED8',
                WHITE:       'FFFFFFFF',
                BORDER:      'FFCBD5E1',
                ALT:         'FFF0F7FF',
                GRAY_LIGHT:  'FFF8FAFC',
            };

            const statusStyle = {
                'pendente':                  { bg: 'FFEF4444', fg: 'FFFFFFFF', bold: true },
                'em-analise':                { bg: 'FFF59E0B', fg: 'FF1C1917', bold: true },
                'aguardando-documentacao':   { bg: 'FF3B82F6', fg: 'FFFFFFFF', bold: true },
                'em-diligencia':             { bg: 'FF8B5CF6', fg: 'FFFFFFFF', bold: true },
                'finalizado':                { bg: 'FF22C55E', fg: 'FFFFFFFF', bold: true },
                'arquivado':                 { bg: 'FF94A3B8', fg: 'FFFFFFFF', bold: true },
            };

            const thin   = (c = C.BORDER) => ({ style: 'thin',   color: { argb: c } });
            const medium = (c = C.NAVY)   => ({ style: 'medium', color: { argb: c } });
            const borderAll  = { top: thin(), bottom: thin(), left: thin(), right: thin() };
            const borderBold = { top: medium(), bottom: medium(), left: medium(), right: medium() };

            const fill = (argb) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });

            const font = (opts = {}) => ({ name: 'Calibri', size: 10, ...opts });

            const NUM_COLS = 12;

            // ===========================
            // ABA 1 — PROCESSOS
            // ===========================
            const ws = wb.addWorksheet('Processos', {
                views: [{ state: 'frozen', xSplit: 0, ySplit: 4 }],
                properties: { tabColor: { argb: 'FF1D4ED8' } },
            });

            ws.columns = [
                { width: 18 }, { width: 14 }, { width: 30 }, { width: 42 }, { width: 36 },
                { width: 24 }, { width: 22 }, { width: 22 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 16 },
            ];

            // Linha 1 — Título institucional
            ws.mergeCells(1, 1, 1, NUM_COLS);
            const r1 = ws.getRow(1);
            r1.height = 34;
            const t1 = ws.getCell('A1');
            t1.value = 'PROCURADORIA GERAL — CÂMARA MUNICIPAL DE DUQUE DE CAXIAS';
            t1.font  = font({ bold: true, size: 13, color: { argb: C.WHITE } });
            t1.fill  = fill(C.NAVY);
            t1.alignment = { horizontal: 'center', vertical: 'middle' };
            t1.border = borderBold;

            // Linha 2 — Subtítulo
            ws.mergeCells(2, 1, 2, NUM_COLS);
            const r2 = ws.getRow(2);
            r2.height = 22;
            const t2 = ws.getCell('A2');
            t2.value = `Relatorio de Processos  |  Gerado em: ${hoje}`;
            t2.font  = font({ size: 11, color: { argb: C.WHITE } });
            t2.fill  = fill(C.NAVY_MID);
            t2.alignment = { horizontal: 'center', vertical: 'middle' };
            t2.border = borderBold;

            // Linha 3 — separador visual
            ws.mergeCells(3, 1, 3, NUM_COLS);
            ws.getRow(3).height = 6;
            ws.getCell('A3').fill = fill(C.NAVY);

            // Linha 4 — Cabeçalho das colunas
            const HEADERS = ['Nº Processo','Tipo','Interessado','Objeto','Ação Tomada','Status','Setor de Origem','Setor Enviado','Data Entrada','Prazo Final','Data Saída','Dias Tram.'];
            const hdrRow = ws.getRow(4);
            hdrRow.height = 30;
            HEADERS.forEach((h, i) => {
                const cell = hdrRow.getCell(i + 1);
                cell.value = h;
                cell.font  = font({ bold: true, size: 10, color: { argb: C.WHITE } });
                cell.fill  = fill(C.BLUE_HDR);
                cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
                cell.border = borderAll;
            });

            // Linhas de dados
            data.forEach((p, i) => {
                const row = ws.getRow(5 + i);
                row.height = 20;
                const bgFill = fill(i % 2 === 1 ? C.ALT : C.WHITE);

                const diasTram = (p.ent && p.saida)
                    ? diffDays(parse(p.ent), parse(p.saida))
                    : (p.ent ? diffDays(parse(p.ent), todayUTC()) : '');

                const values = [
                    p.num || '',
                    p.tipo ? (p.tipo.charAt(0).toUpperCase() + p.tipo.slice(1)) : '',
                    p.int  || '',
                    p.obj  || '',
                    p.acao || '',
                    statusMap[p.stat] || p.stat || '',
                    p.setorOrigem || '',
                    p.dest || '',
                    p.ent   ? fmtBR(p.ent)   : '',
                    p.prazo ? fmtBR(p.prazo)  : '',
                    p.saida ? fmtBR(p.saida)  : '',
                    diasTram,
                ];

                values.forEach((v, j) => {
                    const cell = row.getCell(j + 1);
                    cell.value  = v;
                    cell.border = borderAll;

                    if (j === 5 && statusStyle[p.stat]) {
                        const s = statusStyle[p.stat];
                        cell.fill  = fill(s.bg);
                        cell.font  = font({ bold: s.bold, color: { argb: s.fg } });
                        cell.alignment = { horizontal: 'center', vertical: 'middle' };
                    } else {
                        cell.fill = bgFill;
                        cell.font = font({ bold: j === 0 });
                        if ([8, 9, 10, 11].includes(j)) cell.alignment = { horizontal: 'center', vertical: 'middle' };
                    }
                });
            });

            // ===========================
            // ABA 2 — RESUMO
            // ===========================
            const wsR = wb.addWorksheet('Resumo', {
                properties: { tabColor: { argb: 'FF22C55E' } },
            });
            wsR.columns = [{ width: 38 }, { width: 16 }];

            const stats = calculateGlobalStats();
            const statusCounts = {};
            data.forEach(p => { statusCounts[p.stat] = (statusCounts[p.stat] || 0) + 1; });

            let rn = 1;

            const rMerge = (label, bg, fgFont, sz = 11, h = 28) => {
                wsR.mergeCells(`A${rn}:B${rn}`);
                const c = wsR.getCell(`A${rn}`);
                c.value = label;
                c.font  = font({ bold: true, size: sz, color: { argb: fgFont } });
                c.fill  = fill(bg);
                c.alignment = { horizontal: 'center', vertical: 'middle' };
                c.border = borderBold;
                wsR.getRow(rn).height = h;
                rn++;
            };

            const rData = (label, value, bgA = C.WHITE, bgB = C.WHITE, fgB = '00000000', boldA = false) => {
                const cA = wsR.getCell(`A${rn}`);
                const cB = wsR.getCell(`B${rn}`);
                cA.value = label;  cB.value = value;
                cA.font  = font({ bold: boldA });
                cB.font  = font({ bold: true, color: { argb: fgB } });
                cA.fill  = fill(bgA); cB.fill = fill(bgB);
                cA.border = borderAll; cB.border = borderAll;
                cB.alignment = { horizontal: 'center', vertical: 'middle' };
                wsR.getRow(rn).height = 22;
                rn++;
            };

            const rSep = () => {
                wsR.mergeCells(`A${rn}:B${rn}`);
                wsR.getCell(`A${rn}`).fill = fill(C.NAVY);
                wsR.getRow(rn).height = 5;
                rn++;
            };

            const rSecHdr = (label) => {
                wsR.mergeCells(`A${rn}:B${rn}`);
                const c = wsR.getCell(`A${rn}`);
                c.value = label;
                c.font  = font({ bold: true, size: 10, color: { argb: C.WHITE } });
                c.fill  = fill(C.BLUE_HDR);
                c.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
                c.border = borderAll;
                wsR.getRow(rn).height = 24;
                rn++;
            };

            rMerge('PROCURADORIA GERAL — CÂMARA MUNICIPAL DE DUQUE DE CAXIAS', C.NAVY, C.WHITE, 13, 34);
            rMerge(`Relatorio Gerencial  |  ${hoje}`, C.NAVY_MID, C.WHITE, 11, 22);
            rSep();
            wsR.getRow(rn).height = 8; rn++;

            rSecHdr('RESUMO GERAL');
            rData('Total de Processos',      stats.total,  C.GRAY_LIGHT, C.GRAY_LIGHT, 'FF1B3A5C', true);
            rData('Pendentes',               stats.pend,   'FFFEF2F2',   'FFFEF2F2',   'FFDC2626');
            rData('Em Análise',              stats.anal,   'FFFFFBEB',   'FFFFFBEB',   'FFD97706');
            rData('Finalizados',             stats.fin,    'FFF0FDF4',   'FFF0FDF4',   'FF15803D');
            rData('Vencendo em até 5 dias',  stats.alert,  'FFFFF7ED',   'FFFFF7ED',   'FFC2410C');
            rData('Vencidos',                stats.venc,   'FFFEF2F2',   'FFFEF2F2',   'FFDC2626', true);

            wsR.getRow(rn).height = 8; rn++;

            rSecHdr('DISTRIBUIÇÃO POR STATUS');
            Object.entries(statusMap).forEach(([key, label]) => {
                const s = statusStyle[key];
                if (s) {
                    const cA = wsR.getCell(`A${rn}`);
                    const cB = wsR.getCell(`B${rn}`);
                    cA.value = label;
                    cB.value = statusCounts[key] || 0;
                    cA.font  = font({ bold: true, color: { argb: s.fg } });
                    cB.font  = font({ bold: true, color: { argb: s.fg } });
                    cA.fill  = fill(s.bg); cB.fill = fill(s.bg);
                    cA.border = borderAll; cB.border = borderAll;
                    cB.alignment = { horizontal: 'center', vertical: 'middle' };
                    wsR.getRow(rn).height = 22;
                    rn++;
                }
            });

            // Gerar arquivo
            const buffer = await wb.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url  = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href  = url;
            link.download = `processos_${new Date().toISOString().slice(0, 10)}.xlsx`;
            link.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            showToast('Planilha Excel exportada com sucesso!');
        } catch (error) {
            console.error('Erro ao exportar para Excel:', error);
            showToast(error.message || 'Erro ao exportar para Excel.', 'danger');
        }
    }
  
  function openLeiModal(mode, id = null) {
      const m = $('#m_lei'); m.style.display = 'flex';
      $('#m_lei_t').textContent = mode === 'new' ? 'Adicionar Lei' : 'Editar Lei';
      const form = $('#f_lei'), del = $('#fl_del'); form.reset(); let fileData = null;

      if (mode === 'edit') {
          const lei = DB_LEIS.find(l => l.id == id); if (!lei) return;
          for (const key in lei) { if(key !== 'arquivo' && form.elements[key]) form.elements[key].value = lei[key]; }
          fileData = lei.arquivo; del.style.display = 'inline-flex';
      } else { form.elements.id.value = ''; del.style.display = 'none'; }

      form.elements.arquivo.onchange = (e) => {
          const file = e.target.files[0];
          if (file) { const reader = new FileReader(); reader.onload = (ev) => { fileData = { name: file.name, data: ev.target.result }; }; reader.readAsDataURL(file); } else { fileData = null; }
      };
      form.onsubmit = async (e) => {
          e.preventDefault(); const formData = new FormData(form); const idVal = formData.get('id'); const isNew = !idVal;
          const rec = { id: isNew ? Date.now() : Number(idVal) };
          for (let [key, value] of formData.entries()) { if (key !== 'id' && key !== 'arquivo') rec[key] = value.trim(); }
          if(fileData) rec.arquivo = fileData;

          const idx = DB_LEIS.findIndex(l => l.id == rec.id); if (idx > -1) DB_LEIS[idx] = rec; else DB_LEIS.unshift(rec);
          await dbHelper.put('leis', rec); await logAuditoria('leis', isNew ? 'criado' : 'editado', `${rec.tipo || 'Lei'} Nº ${rec.numero || rec.id}`); m.style.display = 'none'; renderLeis(); showToast('Lei salva com sucesso!');
      };
      del.onclick = async () => {
          const idVal = Number(form.elements.id.value); if (!idVal) return;
          if (confirm('Tem certeza?')) {
              const leiDel = DB_LEIS.find(l => l.id == idVal);
              DB_LEIS = DB_LEIS.filter(l => l.id != idVal); await dbHelper.delete('leis', idVal);
              await logAuditoria('leis', 'excluido', leiDel ? `${leiDel.tipo || 'Lei'} Nº ${leiDel.numero || idVal}` : idVal);
              m.style.display = 'none'; renderLeis(); showToast('Lei excluída.', 'danger');
          }
      }; $$('[data-close-lei]').forEach(x => x.onclick = () => m.style.display = 'none');
  }

  function renderLeis() {
      const grid = $('#leisGrid'); const q = $('#qLeis').value.toLowerCase().trim(); grid.innerHTML = '';
      const leisFiltradas = DB_LEIS.filter(lei => !q || [lei.tipo, lei.numero, lei.ano, lei.ementa].some(v => String(v || '').toLowerCase().includes(q)));
      if (leisFiltradas.length === 0) { grid.innerHTML = `<tr><td colspan="5"><div class="empty-state"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="m16 16 3-8 3 8c-.8.9-2 1-3 1-1 0-2.2-.1-3-1Z"/><path d="m2 16 3-8 3 8c-.8.9-2 1-3 1-1 0-2.2-.1-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/></svg><h3>Nenhuma lei encontrada</h3><p>Tente ajustar a busca ou clique em "Adicionar Lei".</p></div></td></tr>`; return; }
      leisFiltradas.forEach(lei => {
          const tr = document.createElement('tr');
          tr.innerHTML = `<td class="lei-numero">${sanitizeHTML(lei.tipo)} Nº ${sanitizeHTML(lei.numero)}</td>
              <td class="lei-ementa">${sanitizeHTML(lei.ementa)}</td>
              <td><span class="status lei-tipo-pill">${sanitizeHTML(lei.tipo)}</span></td>
              <td style="text-align:center">${sanitizeHTML(lei.ano)}</td>
              <td style="text-align:center"><div class="lei-row-actions">
                  ${lei.link ? `<a href="${sanitizeHTML(lei.link)}" target="_blank" class="btn secondary">Ver Link</a>` : ''}
                  ${lei.arquivo ? `<button class="btn secondary" data-download-lei="${lei.id}">Baixar Anexo</button>` : ''}
                  <button class="btn" data-edit-lei="${lei.id}">Editar</button>
              </div></td>`;
          grid.appendChild(tr);
      });
  }
  
  $('#qLeis').oninput = renderLeis;
  $('#leisGrid').onclick = (e) => {
      const editBtn = e.target.closest('[data-edit-lei]'); const downloadBtn = e.target.closest('[data-download-lei]');
      if (editBtn) openLeiModal('edit', editBtn.dataset.editLei);
      if (downloadBtn) { const lei = DB_LEIS.find(l => l.id == downloadBtn.dataset.downloadLei); if (lei && lei.arquivo) handleDownload(lei.arquivo.data, lei.arquivo.name); }
  };

  // Gestão de perfis (Configurações → Usuários e Aprovações).
  // A conta em si (e-mail/senha) vive no Firebase Authentication; aqui o admin
  // aprova quem entrou pela primeira vez, promove/rebaixa e revoga acesso.
  async function atualizarPerfilUsuario(uid, changes, acaoAuditoria) {
      const p = DB_PERFIS.find(x => x.uid === uid || x.id === uid);
      if (!p) return;
      const rec = { ...p, ...changes };
      try {
          await dbHelper.put('perfis', rec);
      } catch (e) {
          console.error('Erro ao atualizar perfil:', e);
          showToast('Sem permissão para alterar perfis (recurso de administrador).', 'danger');
          return;
      }
      await logAuditoria('usuarios', acaoAuditoria, rec.email || rec.name);
      renderUsers();
      showToast('Perfil atualizado!');
  }


  function openEmissorModal(mode, id = null) {
    const m = $('#m_emissor'); m.style.display = 'flex'; 
    $('#m_emissor_t').textContent = mode === 'new' ? 'Novo Emissor' : 'Editar Emissor';
    const form = $('#f_emissor'), del = $('#fe_del'); form.reset();
    if (mode === 'edit') { const emissor = DB_EMISSORES.find(e => e.id == id); if (!emissor) return; form.elements.id.value = emissor.id; form.elements.name.value = emissor.name; del.style.display = 'inline-flex'; }
    else { form.elements.id.value = ''; del.style.display = 'none'; }
    form.onsubmit = async (e) => {
        e.preventDefault(); const formData = new FormData(form); const idVal = formData.get('id'); const isNew = !idVal;
        const rec = { id: isNew ? Date.now() : Number(idVal), name: formData.get('name') };
        const idx = DB_EMISSORES.findIndex(em => em.id == rec.id); if (idx > -1) DB_EMISSORES[idx] = rec; else DB_EMISSORES.push(rec);
        await dbHelper.put('emissores', rec); await logAuditoria('emissores', isNew ? 'criado' : 'editado', rec.name); m.style.display = 'none'; renderEmissores(); showToast('Emissor salvo!');
    };
    del.onclick = async () => {
        const idVal = Number(form.elements.id.value); if (!idVal) return;
        const nomeEmissor = DB_EMISSORES.find(e => e.id == idVal)?.name || idVal;
        if (confirm('Tem certeza?')) { DB_EMISSORES = DB_EMISSORES.filter(e => e.id != idVal); await dbHelper.delete('emissores', idVal); await logAuditoria('emissores', 'excluido', nomeEmissor); m.style.display = 'none'; renderEmissores(); showToast('Emissor excluído.', 'danger'); }
    }; $$('[data-close-emissor]').forEach(x => x.onclick = () => m.style.display = 'none');
}

  async function renderUsers() {
    const listEl = $('#userList'); if (!listEl) return;
    if (!isAdminSession()) return; // o cartão inteiro fica oculto para não-admins
    listEl.innerHTML = '<div class="list-msg">Carregando usuários…</div>';
    try {
        DB_PERFIS = await dbHelper.getAll('perfis');
    } catch (e) {
        console.warn('Sem acesso à lista de perfis:', e);
        listEl.innerHTML = '<div class="list-msg">Não foi possível listar os usuários (as regras novas do Firestore já foram publicadas?).</div>';
        return;
    }
    listEl.innerHTML = '';
    if (!DB_PERFIS.length) {
        listEl.innerHTML = '<div class="list-msg">Nenhum perfil registrado ainda. Cada usuário aparece aqui após o primeiro login.</div>';
        return;
    }
    // Pendentes primeiro (é o que o admin veio resolver), depois por nome.
    DB_PERFIS.sort((a, b) => (!!a.aprovado === !!b.aprovado)
        ? String(a.name || a.email).localeCompare(String(b.name || b.email))
        : (a.aprovado ? 1 : -1));
    const meuUid = (() => { try { return JSON.parse(sessionStorage.getItem('loggedInUser'))?.id; } catch { return null; } })();
    DB_PERFIS.forEach(p => {
        const uid = p.uid || p.id;
        const item = document.createElement('div');
        item.className = 'user-item';
        const status = p.aprovado ? (p.role === 'admin' ? 'Admin' : 'Usuário') : 'Pendente';
        const badgeCls = p.aprovado ? (p.role === 'admin' ? 'badge-admin' : 'badge-user') : 'badge-pendente';
        const botoes = [];
        if (!p.aprovado) botoes.push(`<button class="btn primary" data-aprovar-perfil="${sanitizeHTML(uid)}">Aprovar</button>`);
        else if (uid !== meuUid) botoes.push(`<button class="btn secondary" data-toggle-role="${sanitizeHTML(uid)}">${p.role === 'admin' ? 'Tornar Usuário' : 'Tornar Admin'}</button>`);
        if (uid !== meuUid) botoes.push(`<button class="btn danger" data-remover-perfil="${sanitizeHTML(uid)}">Remover</button>`);
        item.innerHTML = `<span>${sanitizeHTML(p.name || p.email || uid)} <small class="user-email">${sanitizeHTML(p.email || '')}</small> <span class="user-badge ${badgeCls}">${status}</span></span><div class="user-item-actions">${botoes.join(' ')}</div>`;
        listEl.appendChild(item);
    });
  }

  function renderEmissores() {
    const listEl = $('#emissorList'); listEl.innerHTML = '';
    DB_EMISSORES.forEach(emissor => {
        const item = document.createElement('div');
        item.className = 'emissor-item';
        item.innerHTML = `<span>${sanitizeHTML(emissor.name)}</span><div><button class="btn secondary" data-edit-emissor="${emissor.id}">Editar</button></div>`;
        listEl.appendChild(item);
    });
  }

  // ===== Painel do Log de Auditoria (Configurações, admin) =====
  let AUD_ENTRIES = [];
  const AUD_MODULOS = { processos: 'Processos', pareceres: 'Pareceres', usuarios: 'Usuários', emissores: 'Emissores', leis: 'Banco de Leis', modelos: 'Modelos', calendario: 'Calendário', backup: 'Backup', auth: 'Acesso', integracoes: 'Integrações' };
  const AUD_ACOES = { criado: 'criou', editado: 'editou', excluido: 'excluiu', aprovado: 'aprovou', 'promovido-a-admin': 'promoveu a admin', 'rebaixado-a-usuario': 'rebaixou a usuário', 'acesso-revogado': 'revogou o acesso de', login: 'entrou no sistema', logout: 'saiu do sistema', exportado: 'exportou', restaurado: 'restaurou', 'parecer-criado': 'criou parecer —', 'parecer-editado': 'editou parecer —', 'parecer-emitido': 'emitiu parecer —', 'parecer-reaberto': 'reabriu parecer —' };

  // ===== Cartão do token do Jurisprudências.ai (Configurações, admin) =====
  // O token fica em segredos/jurisai (coleção admin-only nas rules); a Cloud
  // Function `juris` o lê via Admin SDK para consultar a API.
  async function renderJurisaiTokenCard() {
      const statusEl = $('#jurisaiTokenStatus'); if (!statusEl) return;
      if (!isAdminSession()) return; // o cartão fica oculto para não-admins
      try {
          const doc = await dbHelper.get('segredos', 'jurisai');
          const token = doc && doc.token ? String(doc.token) : '';
          statusEl.textContent = token
              ? `✅ Token configurado (termina em …${token.slice(-4)}). Cole um novo para substituir.`
              : 'Nenhum token configurado ainda — a busca pelo Jurisprudências.ai fica indisponível até colar um.';
      } catch (e) {
          console.warn('Sem acesso ao token do Jurisprudências.ai:', e);
          statusEl.textContent = 'Não foi possível verificar o token (as regras novas do Firestore já foram publicadas?).';
      }
  }

  async function salvarJurisaiToken() {
      const input = $('#jurisaiToken'); if (!input) return;
      const token = input.value.trim();
      if (!token.startsWith('jur_') || token.length < 20) {
          showToast('Token inválido — ele começa com "jur_". Copie-o de jurisprudencias.ai/api-tokens.', 'danger');
          input.focus();
          return;
      }
      try {
          await dbHelper.put('segredos', { id: 'jurisai', token, atualizadoEm: new Date().toISOString() });
      } catch (e) {
          console.error('Erro ao salvar token:', e);
          showToast('Sem permissão para salvar o token (recurso de administrador).', 'danger');
          return;
      }
      input.value = '';
      await logAuditoria('integracoes', 'editado', 'Token do Jurisprudências.ai');
      renderJurisaiTokenCard();
      showToast('Token salvo! A busca pelo Jurisprudências.ai já pode ser usada.');
  }

  async function renderAuditoria() {
      const listEl = $('#audList'); if (!listEl) return;
      if (!isAdminSession()) return; // o cartão fica oculto para não-admins
      listEl.innerHTML = '<div class="list-msg">Carregando registros…</div>';
      try {
          // Timestamps em ISO 8601 ordenam corretamente como texto.
          const snap = await window.db.collection('auditoria').orderBy('timestamp', 'desc').limit(200).get();
          AUD_ENTRIES = snap.docs.map(d => d.data());
      } catch (e) {
          console.warn('Sem acesso à auditoria:', e);
          listEl.innerHTML = '<div class="list-msg">Não foi possível carregar a auditoria (as regras novas do Firestore já foram publicadas?).</div>';
          return;
      }
      drawAuditoria();
  }

  function drawAuditoria() {
      const listEl = $('#audList'); if (!listEl) return;
      const q = ($('#audFiltro')?.value || '').toLowerCase().trim();
      const entries = AUD_ENTRIES.filter(en => !q || [en.usuario, en.login, en.modulo, en.acao, en.alvo, en.detalhes].some(v => String(v || '').toLowerCase().includes(q)));
      listEl.innerHTML = '';
      if (!entries.length) {
          listEl.innerHTML = '<div class="list-msg">Nenhum registro de auditoria encontrado.</div>';
          return;
      }
      entries.forEach(en => {
          const dt = new Date(en.timestamp);
          const dataStr = isNaN(dt) ? (en.timestamp || '') : dt.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
          const item = document.createElement('div');
          item.className = 'aud-item';
          item.innerHTML = `
              <div class="aud-item-top">
                  <strong>${sanitizeHTML(en.usuario || 'Sistema')}</strong>
                  <span class="aud-acao">${sanitizeHTML(AUD_ACOES[en.acao] || en.acao)}</span>
                  <span class="aud-alvo">${sanitizeHTML(en.alvo || '')}</span>
                  <span class="aud-modulo">${sanitizeHTML(AUD_MODULOS[en.modulo] || en.modulo)}</span>
              </div>
              <div class="aud-item-meta">${sanitizeHTML(dataStr)}${en.detalhes ? ' · ' + sanitizeHTML(en.detalhes) : ''}</div>`;
          listEl.appendChild(item);
      });
  }

  function exportAuditoriaCSV() {
      if (!AUD_ENTRIES.length) { showToast('Nada para exportar — o log ainda não foi carregado.', 'danger'); return; }
      const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const linhas = [['Data/Hora', 'Usuário', 'Login', 'Módulo', 'Ação', 'Item', 'Detalhes'].map(esc).join(';')];
      AUD_ENTRIES.forEach(en => linhas.push([en.timestamp, en.usuario, en.login, AUD_MODULOS[en.modulo] || en.modulo, en.acao, en.alvo, en.detalhes || ''].map(esc).join(';')));
      const blob = new Blob(['\ufeff' + linhas.join('\r\n')], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `auditoria_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('Log de auditoria exportado!');
  }

  function updateEmissorSelect(){
    const sel = $('#fp_emissor'); if(!sel) return; sel.innerHTML='<option value="">Usuário Logado</option>';
    DB_EMISSORES.forEach(emissor => { 
        const o=document.createElement('option'); 
        o.value = emissor.id; 
        o.textContent = emissor.name; 
        sel.appendChild(o); 
    });
  }

  let CUR=new Date(),VIEW='month'; const calTitle = $('#c_title'), calBody = $('#calBody');
  $('#c_prev').onclick=()=>shift(-1); $('#c_next').onclick=()=>shift(1); $('#c_today').onclick=()=>{CUR=new Date();drawView();}; 
  $('#new_evt').onclick=()=>openEvt({id:null,data:ymd(CUR),hora:'',desc:'',cat:'g'}); $$('.side input').forEach(el => el.onchange = drawView);

  function getEventList(){ const F={g:$('#f_g').checked,a:$('#f_a').checked,e:$('#f_e').checked,o:$('#f_o').checked,r:$('#f_r').checked,p:$('#f_p').checked,u:$('#f_u').checked}; let list=CAL.filter(e=>F[e.cat]); if($('#f_sync').checked){DB.forEach(pr=>{if(pr.prazo&&pr.stat!=='finalizado'&&pr.stat!=='arquivado'&&F.p)list.push({id:`pr-${pr.id}`,data:pr.prazo,hora:'',desc:`Prazo: ${pr.num}`,cat:'p',readonly:true});});} return list; }
  function shift(delta){
      if(VIEW==='month') CUR.setMonth(CUR.getMonth()+delta);
      else if(VIEW==='week') CUR.setDate(CUR.getDate()+7*delta);
      else CUR.setDate(CUR.getDate()+delta);
      drawView();
  }
  function drawView(){ calBody.innerHTML=''; if(VIEW==='month')drawMonth(); else if(VIEW==='week')drawWeek(); else drawDay(); }
  function setCalView(v){
      VIEW = v;
      $$('.cal-view-toggle .btn').forEach(b => b.classList.toggle('active', b.dataset.calView === v));
      drawView();
  }
  $('#c_view_month').onclick = () => setCalView('month');
  $('#c_view_week').onclick  = () => setCalView('week');
  $('#c_view_day').onclick   = () => setCalView('day');

  function openEventOrProc(evt){
      if (String(evt.id).startsWith('pr-')) {
          const procId = String(evt.id).replace('pr-', ''), processo = DB.find(p => p.id == procId);
          if (processo) showTab('proc', { filterBy: { text: processo.num } });
      } else {
          openEvt(evt);
      }
  }

  function startOfWeek(d){ const r=new Date(d); r.setDate(r.getDate()-r.getDay()); r.setHours(0,0,0,0); return r; }
  const MESES_ABREV = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
  function formatWeekTitle(start){
      const end=new Date(start); end.setDate(end.getDate()+6);
      const sameMonth = start.getMonth()===end.getMonth() && start.getFullYear()===end.getFullYear();
      if (sameMonth) return `${start.getDate()} – ${end.getDate()} de ${MESES_ABREV[start.getMonth()]}. ${start.getFullYear()}`;
      const sameYear = start.getFullYear()===end.getFullYear();
      if (sameYear) return `${start.getDate()} ${MESES_ABREV[start.getMonth()]}. – ${end.getDate()} ${MESES_ABREV[end.getMonth()]}. ${end.getFullYear()}`;
      return `${start.getDate()} ${MESES_ABREV[start.getMonth()]}. ${start.getFullYear()} – ${end.getDate()} ${MESES_ABREV[end.getMonth()]}. ${end.getFullYear()}`;
  }

  // Grade de horas compartilhada pelas visões Semana e Dia
  function renderTimeGrid(days){
      const list = getEventList();
      const container = document.createElement('div'); container.className = 'time-view';
      const cols = `56px repeat(${days.length}, 1fr)`;

      const head = document.createElement('div'); head.className = 'time-head'; head.style.gridTemplateColumns = cols;
      head.appendChild(document.createElement('div')).className = 'time-head-corner';
      days.forEach(d => {
          const h = document.createElement('div'); h.className = 'time-head-day';
          const tdy = ymd(new Date()) === ymd(d);
          h.innerHTML = `<span class="thd-wd">${['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'][d.getDay()]}</span><span class="thd-num ${tdy?'today':''}">${d.getDate()}</span>`;
          head.appendChild(h);
      });

      const alldayRow = document.createElement('div'); alldayRow.className = 'time-allday-row'; alldayRow.style.gridTemplateColumns = cols;
      const alldayLabel = document.createElement('div'); alldayLabel.className = 'time-allday-label'; alldayLabel.textContent = 'Dia todo'; alldayRow.appendChild(alldayLabel);
      days.forEach(d => {
          const ds = ymd(d);
          const cell = document.createElement('div'); cell.className = 'time-allday-cell';
          list.filter(e => e.data === ds && !e.hora).forEach(evt => {
              const chip = document.createElement('div'); chip.className = `time-chip ${safeCSSClass(evt.cat, VALID_CAT)}`;
              chip.textContent = evt.desc; chip.title = sanitizeHTML(evt.desc);
              chip.onclick = () => openEventOrProc(evt);
              cell.appendChild(chip);
          });
          cell.ondblclick = () => openEvt({ id: null, data: ds, hora: '', desc: '', cat: 'g' });
          alldayRow.appendChild(cell);
      });

      const grid = document.createElement('div'); grid.className = 'time-grid'; grid.style.gridTemplateColumns = cols;
      for (let hour = 0; hour < 24; hour++) {
          const label = document.createElement('div'); label.className = 'time-hour-label'; label.textContent = `${String(hour).padStart(2,'0')}:00`;
          grid.appendChild(label);
          days.forEach(d => {
              const ds = ymd(d);
              const cell = document.createElement('div'); cell.className = 'time-hour-cell';
              list.filter(e => e.data === ds && e.hora && Number(e.hora.split(':')[0]) === hour).forEach(evt => {
                  const chip = document.createElement('div'); chip.className = `time-chip ${safeCSSClass(evt.cat, VALID_CAT)}`;
                  chip.innerHTML = `<strong>${sanitizeHTML(evt.hora)}</strong> ${sanitizeHTML(evt.desc)}`;
                  chip.title = sanitizeHTML(evt.desc);
                  chip.onclick = (e) => { e.stopPropagation(); openEventOrProc(evt); };
                  cell.appendChild(chip);
              });
              cell.ondblclick = () => openEvt({ id: null, data: ds, hora: `${String(hour).padStart(2,'0')}:00`, desc: '', cat: 'g' });
              grid.appendChild(cell);
          });
      }

      container.append(head, alldayRow, grid);
      return container;
  }

  function drawWeek(){
      const start = startOfWeek(CUR);
      calTitle.textContent = formatWeekTitle(start);
      const days = Array.from({length:7}, (_,i) => { const d=new Date(start); d.setDate(d.getDate()+i); return d; });
      calBody.appendChild(renderTimeGrid(days));
  }
  function drawDay(){
      const t = CUR.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      calTitle.textContent = t.charAt(0).toUpperCase() + t.slice(1);
      calBody.appendChild(renderTimeGrid([new Date(CUR)]));
  }

  function drawMonth(){
    const y=CUR.getFullYear(),m=CUR.getMonth();const n=new Date(y,m,1).toLocaleDateString('pt-BR',{month:'long',year:'numeric'});calTitle.textContent=n.charAt(0).toUpperCase()+n.slice(1);
    const f=new Date(y,m,1);const s=new Date(f);s.setDate(f.getDate()-f.getDay());const l=new Date(y,m+1,0);const e=new Date(l);e.setDate(l.getDate()+(6-l.getDay()));
    const list=getEventList(); const w=document.createElement('div');w.className='weekdays';['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].forEach(d=>{const x=document.createElement('div');x.className='wd';x.textContent=d;w.appendChild(x);});
    const g=document.createElement('div');g.className='grid-month'; let p=new Date(s);
    while(p<=e){
        const c=document.createElement('div');c.className='cell';if(p.getMonth()!==m)c.classList.add('dim');
        const dn=document.createElement('div');dn.className='dnum';const tdy=ymd(new Date())===ymd(p);dn.innerHTML=`<span class="${tdy?'today':''}">${p.getDate()}</span>`; c.appendChild(dn);
        const eventsWrapper = document.createElement('div'); eventsWrapper.className = 'events-wrapper';
        const ds=ymd(p);const evts=list.filter(e=>e.data===ds); const initialsMap = { g: 'G', a: 'A', r: 'R', p: 'TP', u: 'U', e: 'E', o: 'OAB' };
        const dotsContainer = document.createElement('div'); dotsContainer.className = 'event-dots-container';
        evts.forEach(evt => {
            const dot = document.createElement('div'); dot.className = `event-dot ${safeCSSClass(evt.cat, VALID_CAT)}`; dot.textContent = initialsMap[evt.cat] || '?'; dot.title = sanitizeHTML(evt.desc);
            dot.onclick = () => openEventOrProc(evt);
            dotsContainer.appendChild(dot);
        });
        eventsWrapper.appendChild(dotsContainer); c.appendChild(eventsWrapper); c.ondblclick=()=>openEvt({id:null,data:ds,hora:'',desc:'',cat:'g'}); g.appendChild(c);p.setDate(p.getDate()+1);
    }
    calBody.append(w,g);
  }

  function openEvt(evt){
    const m=$('#m_evt');m.style.display='flex';
    const t=$('#m_evt_t'),id=$('#fe_id'),d=$('#fe_data'),h=$('#fe_hora'),de=$('#fe_desc'),c=$('#fe_cat'),dl=$('#fe_del');
    t.textContent=evt?.id?'Editar':'Novo';id.value=evt?.id||'';d.value=evt?.data||ymd(CUR);h.value=evt?.hora||'';de.value=evt?.desc||'';c.value=evt?.cat||'g';dl.style.display=evt?.id&&!String(evt.id).startsWith('pr-')?'inline-flex':'none';
    $$('[data-close-evt]').forEach(x=>x.onclick=()=>m.style.display='none');
    $('#f_evt').onsubmit= async (e)=>{
        e.preventDefault(); const r={id:id.value?(String(id.value).startsWith('pr-')?id.value:Number(id.value)):Date.now(),data:d.value,hora:h.value,desc:de.value.trim(),cat:c.value}; if(!r.data||!r.desc)return; if(String(r.id).startsWith('pr-')){m.style.display='none';return;}
        const i=CAL.findIndex(x=>String(x.id)===String(r.id)); if(i>-1)CAL[i]=r;else CAL.push(r);
        await dbHelper.put('calendario', r); await logAuditoria('calendario', i>-1 ? 'editado' : 'criado', `${r.data} — ${r.desc}`); m.style.display='none'; drawView(); showToast('Compromisso salvo!');
    };
    dl.onclick= async ()=>{
        const idVal = Number(id.value); if(!idVal)return;
        if(confirm('Certeza?')){ const evtDel = CAL.find(x=>String(x.id)===String(idVal)); CAL=CAL.filter(x=>String(x.id)!==String(idVal)); await dbHelper.delete('calendario', idVal); await logAuditoria('calendario', 'excluido', evtDel ? `${evtDel.data} — ${evtDel.desc}` : idVal); m.style.display='none'; drawView(); showToast('Compromisso excluído.', 'danger'); }
    }
  }

  let chartInstances = {};
  const statusColorMap = {'pendente': '#b42323', 'em-analise': '#b25e09', 'aguardando-documentacao': '#0a3d73', 'em-diligencia': '#7c3aad', 'finalizado': '#2f855a', 'arquivado': '#8194ab'};
  const colorPalette = ['#0a3d73', '#b25e09', '#2f855a', '#b42323', '#7c3aad', '#8194ab', '#1c5f9e', '#c2a14d', '#0e4a89', '#245f43'];
  const mesesMap = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const sMapKeys = Object.keys(statusMap);
   function getChartConfigs(data) {
    const isDark = document.body.dataset.theme === 'dark', gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)', textColor = isDark ? '#eef2f8' : '#132a44', cardColor = getComputedStyle(document.body).getPropertyValue('--card-bg').trim();
    Chart.defaults.color = textColor; Chart.defaults.font.family = "'IBM Plex Sans', sans-serif";
    const labels = mesesMap, dadosAdm = Array(12).fill(0), dadosJud = Array(12).fill(0);
    data.forEach(p => { if(p.ent){ const m = parse(p.ent).getUTCMonth(); if(p.tipo==='administrativo')dadosAdm[m]++; else dadosJud[m]++; }});
    const sCounts={}; data.forEach(p=>sCounts[p.stat]=(sCounts[p.stat]||0)+1);
    
    // ===== GRÁFICO DE ENTRADAS ALTERADO PARA BARRAS =====
    const entradasConfig = { 
        type: 'bar', 
        data: { 
            labels, 
            datasets: [
                { label: 'Administrativo', data: dadosAdm, backgroundColor: colorPalette[0] },
                { label: 'Judicial', data: dadosJud, backgroundColor: colorPalette[1] }
            ] 
        }, 
        options: { 
            responsive: true, 
            maintainAspectRatio: false, 
            scales: { 
                y: { 
                    beginAtZero: true,
                    ticks: { precision: 0 },
                    grid: { color: gridColor, drawBorder: false } 
                }, 
                x: { grid: { display: false } } 
            }, 
            onClick: (e, els) => { if(els.length > 0) showTab('proc', { filterBy: { month: els[0].index } }) } 
        }
    };
    // ===== FIM DA ALTERAÇÃO =====

    const statusConfig = { type: 'doughnut', data: { labels: Object.values(statusMap), datasets: [{ data: sMapKeys.map(k=>sCounts[k]||0), backgroundColor: sMapKeys.map(key => statusColorMap[key]), borderWidth: 2, borderColor: cardColor }] }, options: { responsive: true, maintainAspectRatio: false, onClick: (e, els) => { if (els.length > 0) { const statusKey = sMapKeys[els[0].index]; showTab('proc', { filterBy: { status: statusKey } }) } } }};
    
    // Nota: propositalmente NÃO usa getParecerInfo aqui. O accessor é "por processo vivo"
    // (prioriza estruturado > legado > nenhum), mas esta contagem histórica é "por registro" —
    // cada coleção (processos legado, pareceres estruturados) é somada de forma independente,
    // igual ao comportamento original. Isso preserva pareceres emitidos cujo processo já foi
    // excluído (órfãos em DB_PARECERES continuam contando) e evita um scan O(N×M) via getParecerInfo
    // dentro de um loop sobre DB inteiro.
    const pareceresPorMes = Array(12).fill(0);
    DB.forEach(p => {
        if (p.docId && p.saida) {
            const saidaDate = parse(p.saida);
            if (saidaDate) pareceresPorMes[saidaDate.getUTCMonth()]++;
        }
    });
    DB_PARECERES.forEach(pz => {
        if (pz.status === 'emitido' && pz.emitidoEm) {
            const emitidoDate = new Date(pz.emitidoEm);
            if (!isNaN(emitidoDate)) pareceresPorMes[emitidoDate.getUTCMonth()]++;
        }
    });
    const pareceresMesConfig = { type: 'bar', data: { labels, datasets: [{ label: 'Nº de Pareceres', data: pareceresPorMes, backgroundColor: '#1c5f9e' }] }, options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks: { precision: 0 } }, x: {} } } };
    return { entradasConfig, statusConfig, pareceresMesConfig };
  }
  function renderCharts(chartConfigs) {
    const chartIds = { chartEntradasDashboard: chartConfigs.entradasConfig, chartStatusDashboard: chartConfigs.statusConfig, chartPareceresMes: chartConfigs.pareceresMesConfig };
    Object.entries(chartIds).forEach(([canvasId, config]) => {
        const canvas = $('#' + canvasId); if(!canvas) return;
        if (chartInstances[canvasId]) chartInstances[canvasId].destroy();
        chartInstances[canvasId] = new Chart(canvas.getContext('2d'), config);
    });
  }
  function calculateGlobalStats(){
      const hoje=todayUTC(); let pend=0, anal=0, fin=0, alert=0, venc=0;
      DB.forEach(p=>{
        if(p.stat==='pendente') pend++; if(p.stat==='em-analise') anal++; if(p.stat==='finalizado') fin++;
        if(p.prazo && p.stat!=='finalizado'&&p.stat!=='arquivado'){ const d=parse(p.prazo); if(d){ const df=diffDays(hoje,d); if(df<0) venc++; else if(df<=5) alert++; } }
      }); return { total: DB.length, pend, anal, fin, alert, venc };
  }
  function renderProximosPrazos() {
      const listEl = $('#dashboard-prazos'); if(!listEl) return; listEl.innerHTML = '';
      const hoje = todayUTC(); const futuro = new Date(hoje); futuro.setDate(hoje.getDate() + 15);
      const prazosProc = DB.filter(p=>p.prazo&&parse(p.prazo)>=hoje&&parse(p.prazo)<=futuro&&p.stat!=='finalizado'&&p.stat!=='arquivado').map(p=>({data:p.prazo,tipo:'processo',desc:`Prazo Proc: ${p.num}`}));
      const prazosAgenda = CAL.filter(c=>c.data&&parse(c.data)>=hoje&&parse(c.data)<=futuro).map(c=>({data:c.data,tipo:'agenda',desc:c.desc}));
      const todosOsPrazos=[...prazosProc,...prazosAgenda].sort((a,b)=>a.data.localeCompare(b.data));
      if(todosOsPrazos.length===0){listEl.innerHTML='<li>Nenhum prazo nos próximos 15 dias.</li>';return;}
      todosOsPrazos.forEach(item=>{
          const data=parse(item.data); const dia=String(data.getUTCDate()).padStart(2,'0'); const mes=data.toLocaleDateString('pt-BR',{month:'short',timeZone:'UTC'}).replace('.','');
          const dias = diffDays(hoje, data);
          const urgClass = dias <= 1 ? 'prazo-date-danger' : dias <= 5 ? 'prazo-date-warning' : 'prazo-date-info';
          const li=document.createElement('li');
          li.innerHTML=`<div class="prazo-date ${urgClass}"><span class="month">${sanitizeHTML(mes)}</span><span class="day">${sanitizeHTML(dia)}</span></div><div class="prazo-info"><span class="type type-${sanitizeHTML(item.tipo)}">${sanitizeHTML(item.tipo.toUpperCase())}</span><div class="desc">${sanitizeHTML(item.desc)}</div></div>`;
          listEl.appendChild(li);
      });
  }
  function renderAlertasInteligentes() {
    const listEl = $('#dashboard-alertas'); if (!listEl) return; listEl.innerHTML = ''; const hoje = todayUTC(); const alertas = [];
    DB.filter(p => p.prazo && p.stat !== 'finalizado' && p.stat !== 'arquivado' && diffDays(hoje, parse(p.prazo)) < 0)
      .forEach(p => { alertas.push({ tipo: 'Vencido', desc: `Processo ${p.num} está vencido.` }); });
    DB.filter(p => (p.stat === 'em-analise' || p.stat === 'pendente') && diffDays(parse(p.ent), hoje) > 20)
      .forEach(p => { alertas.push({ tipo: 'Inativo', desc: `Processo ${p.num} parado há mais de 20 dias.` }); });
    if (alertas.length === 0) { listEl.innerHTML = '<li>Nenhum alerta no momento.</li>'; return; }
    alertas.forEach(item => { const li = document.createElement('li'); li.innerHTML = `<div class="prazo-info"><span class="type">${sanitizeHTML(item.tipo.toUpperCase())}</span><div class="desc">${sanitizeHTML(item.desc)}</div></div>`; listEl.appendChild(li); });
  }
  function renderDashboard() {
      const kpiData = calculateGlobalStats(); const kpiContainer = $('#dashboard-kpis'); if (!kpiContainer) return;
      const kpiItems = [
          { filter: 'total',     label: 'Total de Processos',  value: kpiData.total,  color: '#0a3d73', icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/></svg>` },
          { filter: 'pendente',  label: 'Pendentes',           value: kpiData.pend,   color: '#7c3aad', icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>` },
          { filter: 'em-analise',label: 'Em Análise',          value: kpiData.anal,   color: '#b25e09', icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>` },
          { filter: 'finalizado',label: 'Finalizados',         value: kpiData.fin,    color: '#2f855a', icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>` },
          { filter: 'alerta',    label: 'Vencendo (≤5 dias)',  value: kpiData.alert,  color: '#c2a14d', icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>` },
          { filter: 'vencido',   label: 'Vencidos',            value: kpiData.venc,   color: '#b42323', icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>` },
      ];
      kpiContainer.innerHTML = kpiItems.map(item => `
          <div class="kpi" data-kpi-filter="${item.filter}" style="border-left-color:${item.color};">
              <div class="kpi-header">
                  <h4>${item.label}</h4>
                  <div class="kpi-icon" style="color:${item.color};">${item.icon}</div>
              </div>
              <div class="v">${item.value}</div>
          </div>`).join('');
      kpiContainer.onclick = (e) => {
          const kpi = e.target.closest('[data-kpi-filter]'); if(!kpi) return;
          const filter = kpi.dataset.kpiFilter, filterBy = {};
          if (filter === 'total') { showTab('proc'); return; }
          if (filter === 'alerta' || filter === 'vencido') { filterBy.prazo = filter; } else { filterBy.status = filter; }
          showTab('proc', { filterBy });
      };
      const chartConfigs = getChartConfigs(DB); renderCharts(chartConfigs); renderProximosPrazos(); renderAlertasInteligentes(); renderUltimasAtividades(); updateAllNotifications();
  }

  async function renderUltimasAtividades() {
      const container = $('#dashboard-atividades');
      if (!container) return;
      try {
          const snap = await window.db.collection('historico').get();
          const entries = snap.docs.map(d => d.data());
          entries.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
          const recent = entries.slice(0, 8);
          if (recent.length === 0) {
              container.innerHTML = '<div style="padding:1rem 0; color:var(--text-muted); font-size:0.85rem;">Nenhuma atividade registrada.</div>';
              return;
          }
          const acaoIconMap = {
              'Criado': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14m-7-7h14"/></svg>`,
              'Editado': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
              'Excluído': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6m4-6v6"/></svg>`
          };
          const iconClass = (a) => a === 'Criado' ? 'criado' : a === 'Excluído' ? 'excluido' : 'editado';
          const fmtTS = (ts) => { try { return new Date(ts).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }); } catch(e) { return ''; } };
          container.innerHTML = recent.map(e => `
              <div class="atividade-item">
                  <div class="atividade-icon ${iconClass(e.acao)}">${acaoIconMap[e.acao] || acaoIconMap['Editado']}</div>
                  <div class="atividade-content">
                      <div class="atividade-desc">${sanitizeHTML(e.acao)} — Proc. ${sanitizeHTML(e.processoNum || String(e.processoId))}</div>
                      <div class="atividade-meta">${sanitizeHTML(e.usuario || '')} · ${fmtTS(e.timestamp)}</div>
                  </div>
              </div>`).join('');
      } catch (err) {
          console.warn('Erro ao carregar atividades:', err);
          container.innerHTML = '';
      }
  }
  
    const notificationBell = $('#notification-bell'), notificationCount = $('#notification-count'), notificationPanel = $('#notification-panel'), notificationList = $('#notification-list'), notificationFilters = $('#notification-filters');
    const ICONS = {
        prazo: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"></path></svg>`,
        evento: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V10h14v10zM9 14H7v-2h2v2zm4 0h-2v-2h2v2zm4 0h-2v-2h2v2z"/></svg>`,
        alerta: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 5.99L19.53 19H4.47L12 5.99M12 2L1 21h22L12 2zm1 14h-2v2h2v-2zm0-6h-2v4h2v-4z"></path></svg>`
    };
    function generateAllNotifications() {
        const notifications = []; const hoje = todayUTC();
        DB.filter(p => p.prazo && (p.stat !== 'finalizado' && p.stat !== 'arquivado')).forEach(p => { const prazoDate = parse(p.prazo); const df = diffDays(hoje, prazoDate); if (df < 0) { notifications.push({ id: `alert-vencido-${p.id}`, type: 'alerta', date: p.prazo, title: `Processo ${p.num}`, subtitle: `Vencido há ${Math.abs(df)} dia(s)`, navInfo: { type: 'proc', num: p.num } }); } else if (df === 0) { notifications.push({ id: `alert-fatal-${p.id}`, type: 'alerta', date: p.prazo, title: `Processo ${p.num}`, subtitle: 'Prazo fatal (hoje!)', navInfo: { type: 'proc', num: p.num } }); } else if (df > 0 && df <= 5) { notifications.push({ id: `proc-${p.id}`, type: 'prazo', date: p.prazo, title: `Processo ${p.num}`, subtitle: `Prazo em ${df} dia(s)`, navInfo: { type: 'proc', num: p.num } }); } });
        const futuroEventos = new Date(hoje); futuroEventos.setDate(hoje.getDate() + 7);
        CAL.filter(e => e.cat !== 'p').forEach(e => { const eventDate = parse(e.data); if (eventDate >= hoje && eventDate <= futuroEventos) { notifications.push({ id: `cal-${e.id}`, type: 'evento', date: e.data, title: e.desc, subtitle: `Dia ${fmtBR(e.data)}${e.hora ? ` às ${e.hora}` : ''}`, navInfo: { type: 'cal', date: e.data } }); } });
        return notifications.filter(n => !CFG.dismissedNotifications?.includes(n.id)).sort((a,b) => a.date.localeCompare(b.date));
    }
    function updateAllNotifications(filter = 'all') {
        allNotifications = generateAllNotifications();
        const filteredNotifications = filter === 'all' ? allNotifications : allNotifications.filter(n => n.type === filter);
        notificationList.innerHTML = '';

        if (filteredNotifications.length > 0) {
            filteredNotifications.forEach(item => {
                const li = document.createElement('li'); li.className = `notification-item type-${item.type}`; li.dataset.id = item.id;
                li.innerHTML = `<div class="icon-wrapper">${ICONS[item.type]}</div><div class="notification-content" data-nav-type="${item.navInfo.type}" data-nav-value="${sanitizeHTML(item.navInfo.num || item.navInfo.date)}"><div class="title">${sanitizeHTML(item.title)}</div><div class="subtitle">${sanitizeHTML(item.subtitle)}</div></div><button class="notification-close-btn" title="Dispensar"><svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"></path></svg></button>`;
                notificationList.appendChild(li);
            });
        } else { notificationList.innerHTML = `<li class="notification-item" style="cursor:default; background:transparent; box-shadow:none; justify-content:center; border: none;">Nenhuma notificação.</li>`; }
        
        const unreadCount = allNotifications.filter(n => !CFG.readNotifications?.includes(n.id)).length;
        notificationCount.textContent = unreadCount; notificationCount.style.display = unreadCount > 0 ? 'flex' : 'none';
    }
    notificationBell.addEventListener('click', async (e) => {
        e.stopPropagation(); notificationPanel.classList.toggle('active');
        if (notificationPanel.classList.contains('active')) {
            $$('.notification-filter-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.filter === 'all'));
            updateAllNotifications('all'); CFG.readNotifications = allNotifications.map(n => n.id);
            notificationCount.style.display = 'none'; await saveCFG();
        }
    });
    notificationFilters.addEventListener('click', (e) => {
        e.stopPropagation();
        if(e.target.tagName === 'BUTTON') {
            const filter = e.target.dataset.filter; $$('.notification-filter-btn').forEach(btn => btn.classList.remove('active')); e.target.classList.add('active'); updateAllNotifications(filter);
        }
    });
    document.addEventListener('click', (e) => { if (!notificationBell.contains(e.target)) { notificationPanel.classList.remove('active'); } });
    function navigateToDate(dateString) { CUR = parse(dateString); setCalView('month'); }
    notificationList.addEventListener('click', async (e) => {
        const closeBtn = e.target.closest('.notification-close-btn'), content = e.target.closest('.notification-content');
        if (closeBtn) {
            e.stopPropagation(); const item = closeBtn.closest('.notification-item'), notificationId = item.dataset.id;
            if (!CFG.dismissedNotifications) CFG.dismissedNotifications = [];
            CFG.dismissedNotifications.push(notificationId); await saveCFG();
            item.style.transition = 'opacity 0.3s ease, transform 0.3s ease'; item.style.opacity = '0'; item.style.transform = 'translateX(20px)';
            setTimeout(() => { const activeFilter = $('.notification-filter-btn.active').dataset.filter; updateAllNotifications(activeFilter); }, 300); return;
        }
        if (content) {
            const { navType, navValue } = content.dataset; if (!navType) return;
            if (navType === 'proc') { showTab('proc', { filterBy: { text: navValue } }); } else if (navType === 'cal') { showTab('cal'); navigateToDate(navValue); }
            notificationPanel.classList.remove('active');
        }
    });

  const themeToggleButton = $('#theme-toggle-btn');
  const themeMenu = $('#theme-menu');

  const themeLabels = { light: 'Claro', dark: 'Escuro', system: 'Automático' };

  function applyTheme(themeValue) {
    let finalTheme = themeValue;
    if (themeValue === 'system') {
        finalTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    document.body.dataset.theme = finalTheme;
    $('.sun').style.display = finalTheme === 'dark' ? 'none' : 'block';
    $('.moon').style.display = finalTheme === 'dark' ? 'block' : 'none';

    const themeToggleLabel = $('#theme-toggle-label');
    if (themeToggleLabel) themeToggleLabel.textContent = themeLabels[themeValue] || 'Tema';
    if (themeToggleButton) themeToggleButton.title = `Tema atual: ${themeLabels[themeValue] || themeValue}. Clique para alterar.`;

    $$('.theme-menu-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.themeValue === CFG.theme);
    });

    if (Object.keys(chartInstances).length > 0 && sections.dashboard.style.display !== 'none') {
        const chartConfigs = getChartConfigs(DB);
        renderCharts(chartConfigs);
    }
  }

  async function setTheme(themeChoice) {
    CFG.theme = themeChoice;
    applyTheme(themeChoice);
    await saveCFG();
  }
  
  function initTheme() {
    applyTheme(CFG.theme);

    themeToggleButton.addEventListener('click', (e) => {
        e.stopPropagation();
        const isActive = themeMenu.classList.toggle('active');
        themeToggleButton.setAttribute('aria-expanded', isActive);
    });

    $$('.theme-menu-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const themeValue = btn.dataset.themeValue;
            setTheme(themeValue);
            themeMenu.classList.remove('active');
            themeToggleButton.setAttribute('aria-expanded', 'false');
        });
    });

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (CFG.theme === 'system') {
            applyTheme('system');
        }
    });

    document.addEventListener('click', (e) => {
        if (!themeToggleButton.contains(e.target) && !themeMenu.contains(e.target)) {
            themeMenu.classList.remove('active');
            themeToggleButton.setAttribute('aria-expanded', 'false');
        }
    });
  }
  
  function setupEnhancedNav() {
    const mainContent = $('.main-content');
    const appHeader = $('.app-header');
    if (mainContent && appHeader) {
        mainContent.addEventListener('scroll', () => {
            appHeader.classList.toggle('header-compact', mainContent.scrollTop > 8);
        }, { passive: true });
    }

    window.openMobileMenu = function() {
        if (!sidebar) return;
        sidebar.classList.add('mobile-open');
        overlay.classList.add('active');
        mobileMenuToggle.setAttribute('aria-expanded', 'true');
    };

    window.closeMobileMenu = function() {
        if (!sidebar) return;
        sidebar.classList.remove('mobile-open');
        overlay.classList.remove('active');
        mobileMenuToggle.setAttribute('aria-expanded', 'false');
    };

    if (mobileMenuToggle) {
        mobileMenuToggle.onclick = () => {
            const isOpen = sidebar && sidebar.classList.contains('mobile-open');
            if (isOpen) closeMobileMenu(); else openMobileMenu();
        };
    }

    if (overlay) overlay.onclick = closeMobileMenu;

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && sidebar && sidebar.classList.contains('mobile-open')) {
            closeMobileMenu();
        }
    });

    const collapseBtn = $('#sidebar-collapse-btn');
    if (collapseBtn && sidebar) {
        collapseBtn.onclick = () => {
            const isCollapsed = sidebar.classList.toggle('collapsed');
            CFG.sidebarCollapsed = isCollapsed;
            saveCFG();
        };
    }
  }
  
  function setupEventListeners() {
    const loginForgotEl = $('#loginForgot');
    btnEntrar.onclick = tentarEntrar;
    loginOverlay.onkeydown = (e) => { if (e.key === 'Enter' && e.target !== loginForgotEl) tentarEntrar(); };
    btnSair.onclick = fazerLogout;

    if (loginForgotEl) {
        loginForgotEl.onclick = esqueciSenha;
        loginForgotEl.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); esqueciSenha(); } };
    }

    const audFiltroEl = $('#audFiltro');
    if (audFiltroEl) audFiltroEl.oninput = drawAuditoria;
    const audRefreshEl = $('#audRefresh');
    if (audRefreshEl) audRefreshEl.onclick = renderAuditoria;
    const audCsvEl = $('#audCsv');
    if (audCsvEl) audCsvEl.onclick = exportAuditoriaCSV;
    const btnJurisaiTk = $('#btnSalvarJurisaiToken');
    if (btnJurisaiTk) btnJurisaiTk.onclick = salvarJurisaiToken;

    setupEnhancedNav();

    $$('.tab').forEach(b => b.onclick = (e) => { e.preventDefault(); showTab(b.dataset.tab); if (window.closeMobileMenu) window.closeMobileMenu(); });
    $('#userList').onclick = async (e) => {
        const aprovar = e.target.closest('[data-aprovar-perfil]');
        const toggle = e.target.closest('[data-toggle-role]');
        const remover = e.target.closest('[data-remover-perfil]');
        if (aprovar) await atualizarPerfilUsuario(aprovar.dataset.aprovarPerfil, { aprovado: true }, 'aprovado');
        if (toggle) {
            const p = DB_PERFIS.find(x => (x.uid || x.id) === toggle.dataset.toggleRole);
            if (p) await atualizarPerfilUsuario(toggle.dataset.toggleRole, { role: p.role === 'admin' ? 'user' : 'admin' }, p.role === 'admin' ? 'rebaixado-a-usuario' : 'promovido-a-admin');
        }
        if (remover) {
            const p = DB_PERFIS.find(x => (x.uid || x.id) === remover.dataset.removerPerfil);
            if (!p) return;
            if (!confirm(`Revogar o acesso de "${p.name || p.email}"?\n\nO perfil será removido e o acesso bloqueado. A conta de e-mail continua existindo no Firebase Authentication — exclua-a por lá se quiser removê-la de vez.`)) return;
            try {
                await dbHelper.delete('perfis', p.uid || p.id);
            } catch (err) {
                console.error('Erro ao remover perfil:', err);
                showToast('Sem permissão para remover perfis.', 'danger');
                return;
            }
            await logAuditoria('usuarios', 'acesso-revogado', p.email || p.name);
            renderUsers();
            showToast('Acesso revogado.', 'danger');
        }
    };
    $('#btnAddEmissor').onclick = () => openEmissorModal('new');
    $('#emissorList').onclick = (e) => { if (e.target.closest('[data-edit-emissor]')) openEmissorModal('edit', e.target.closest('[data-edit-emissor]').dataset.editEmissor); };
    $('#btnAddLei').onclick = () => openLeiModal('new');
    $('#modeloAdd').onclick = () => $('#modeloFile').click();

    $('#modeloFile').onchange = async (e) => {
        const file = e.target.files[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = async (ev) => {
            const newModelo = { id: Date.now(), name: file.name, data: ev.target.result };
            DB_MODELOS.push(newModelo); await dbHelper.put('modelos', newModelo);
            await logAuditoria('modelos', 'criado', newModelo.name);
            renderModelos(true);
            showToast('Modelo adicionado!');
        };
        reader.readAsDataURL(file); e.target.value = '';
    };

    $('#modeloList').onclick = async (e) => {
      const delBtn = e.target.closest('[data-del-modelo]'); const downloadBtn = e.target.closest('[data-download-modelo]');
      if (delBtn) { const modeloId = Number(delBtn.dataset.delModelo); if (confirm('Excluir este modelo?')) { const nomeModelo = DB_MODELOS.find(m => m.id === modeloId)?.name || modeloId; DB_MODELOS = DB_MODELOS.filter(m => m.id !== modeloId); await dbHelper.delete('modelos', modeloId); await logAuditoria('modelos', 'excluido', nomeModelo); renderModelos(true); showToast('Modelo excluído.', 'danger'); } }
      if (downloadBtn) { const modelo = DB_MODELOS.find(m => m.id === Number(downloadBtn.dataset.downloadModelo)); if(modelo) handleDownload(modelo.data, modelo.name); }
    };
    
    $('#parecerList').onclick = async (e) => {
      const delBtn = e.target.closest('[data-del-doc]'); const versionsBtn = e.target.closest('[data-versions-for]'); const downloadBtn = e.target.closest('[data-download-version]'); const abrirParecerBtn = e.target.closest('[data-abrir-parecer]');
      if (abrirParecerBtn) {
          const proc = DB.find(p => String(p.id) === String(abrirParecerBtn.dataset.abrirParecer));
          if (proc) openParecerModal(proc); else showToast('Processo vinculado não encontrado.', 'danger');
          return;
      }
      if (delBtn) {
          const docId = Number(delBtn.dataset.delDoc); if (confirm('Excluir este parecer e TODO o seu histórico?')) {
              const nomeDocExcluido = getDoc(docId)?.name || `Documento ${docId}`;
              const versionsToDelete = getVersionsOfDoc(docId); DB_DOCS = DB_DOCS.filter(d => d.id !== docId); DB_VERSOES = DB_VERSOES.filter(v => v.idDocumento !== docId);
              const procsToUpdate = DB.filter(p => String(p.docId) === String(docId));
              await dbHelper.delete('documentos', docId); for(const v of versionsToDelete) await dbHelper.delete('versoes', v.id); for(const p of procsToUpdate) { p.docId = null; await dbHelper.put('processos', p); }
              DB = await dbHelper.getAll('processos'); currentlyDisplayedPareceres = buildPareceresListaCombinada();
              await logAuditoria('pareceres', 'excluido', nomeDocExcluido);
              $('#buscaConteudo').value = ''; drawPareceres(true); showToast('Parecer excluído.', 'danger');
          }
      }
      if (versionsBtn) openVersionsModal(Number(versionsBtn.dataset.versionsFor));
      if (downloadBtn) { const version = getVersion(Number(downloadBtn.dataset.downloadVersion)); if (version) handleDownload(version.data, version.nomeArquivo); }
    };

    if(mVersoes) mVersoes.onclick = (e) => { if (e.target.matches('.modal') || e.target.closest('[data-close-versoes]')) { mVersoes.style.display = 'none'; } };
    $('#lista_versoes').onclick = (e) => { const downloadBtn = e.target.closest('[data-download-version]'); if (downloadBtn) { const version = getVersion(Number(downloadBtn.dataset.downloadVersion)); if (version) handleDownload(version.data, version.nomeArquivo); } };

    $('#bk_csv').onclick = () => { exportCSV(DB); logAuditoria('backup', 'exportado', 'Processos (CSV)'); };

    $('#bk_down').onclick = async () => {
        try {
            const backupData = {
                perfis: await dbHelper.getAll('perfis').catch(() => []),
                users: await dbHelper.getAll('users').catch(() => []),
                processos: await dbHelper.getAll('processos'),
                calendario: await dbHelper.getAll('calendario'),
                documentos: await dbHelper.getAll('documentos'),
                versoes: await dbHelper.getAll('versoes'),
                modelos: await dbHelper.getAll('modelos'),
                emissores: await dbHelper.getAll('emissores'),
                leis: await dbHelper.getAll('leis'),
                pareceres: await dbHelper.getAll('pareceres'),
                parecerVersoes: await dbHelper.getAll('parecerVersoes'),
                config: (await dbHelper.get('config', 'main_cfg'))?.value
            };
            const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            const dateStr = new Date().toISOString().slice(0, 10);
            a.href = url;
            a.download = `juriscontrol_backup_${dateStr}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            await logAuditoria('backup', 'exportado', 'Backup completo (.json)');
            showToast('Backup completo baixado com sucesso!');
        } catch (error) {
            console.error("Erro ao criar backup:", error);
            showToast('Falha ao gerar o arquivo de backup.', 'danger');
        }
    };

    $('#bk_up').onclick = () => $('#bk_file').click();

    $('#bk_file').onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!confirm('Restaurar um backup substituirá TODOS os dados atuais. Deseja continuar?')) {
            e.target.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const backupData = JSON.parse(event.target.result);
                if (!backupData.processos) {
                    throw new Error('Arquivo de backup inválido ou corrompido.');
                }
                
                setTimeout(async () => {
                    await dbHelper.init();

                    // Coleções restauráveis (o Firestore substituiu o IndexedDB;
                    // 'config' é tratado à parte logo abaixo).
                    const COLECOES = ['perfis', 'users', 'processos', 'calendario', 'documentos', 'versoes', 'modelos', 'emissores', 'leis', 'pareceres', 'parecerVersoes'];
                    for (const storeName of COLECOES) {
                         if (backupData[storeName]) {
                            await dbHelper.clear(storeName);
                            for (const item of backupData[storeName]) {
                               await dbHelper.put(storeName, item);
                            }
                        }
                    }
                    if(backupData.config) {
                       await dbHelper.put('config', { key: 'main_cfg', value: backupData.config });
                    }

                    await logAuditoria('backup', 'restaurado', file.name);
                    showToast('Backup restaurado com sucesso! O sistema será reiniciado.', 'success');
                    setTimeout(() => location.reload(), 2000);
                }, 500);


            } catch (error) {
                console.error("Erro ao restaurar backup:", error);
                showToast(error.message || 'Erro ao processar o arquivo de backup.', 'danger');
            } finally {
                e.target.value = '';
            }
        };
        reader.readAsText(file);
    };
  }

  // ===== INICIALIZAÇÃO =====
  async function init() {
    try {
      await dbHelper.init();
              setupEventListeners();
              showLogin();

              // Aguarda autenticação Firebase, resolve o perfil e carrega dados
              observarAuth(async (user) => {
                  if (!user) { checkLoginState(null); return; }
                  try {
                      const perfil = await carregarPerfil(user);

                      // Conta ainda não aprovada por um administrador: registra o
                      // perfil pendente, encerra a sessão e avisa na tela de login.
                      if (!perfil.aprovado) {
                          sessionStorage.removeItem('loggedInUser');
                          msgLoginPersistente = {
                              msg: 'Sua conta foi registrada e aguarda aprovação de um administrador. Tente novamente mais tarde.',
                              tipo: 'info'
                          };
                          try { await logoutFirebase(); } catch { showLogin(); }
                          return;
                      }

                      // Sessão antes de loadAllData: logAuditoria usa o usuário logado.
                      sessionStorage.setItem('loggedInUser', JSON.stringify({
                          id: user.uid,
                          name: perfil.name || user.email.split('@')[0],
                          login: user.email,
                          role: perfil.role || 'user'
                      }));

                      // Auditoria de login apenas em login de verdade (não em reload).
                      if (sessionStorage.getItem('registrarLoginAuditoria')) {
                          sessionStorage.removeItem('registrarLoginAuditoria');
                          logAuditoria('auth', 'login', user.email);
                      }

                      await loadAllData();
                      initTheme();
                      checkLoginState(user, perfil);
                  } catch (err) {
                      console.error('Erro ao carregar dados após autenticação:', err);
                      showLogin();
                  }
              });
    } catch (error) {
        console.error("Falha na inicialização do aplicativo:", error);
        document.body.innerHTML = '<h1>Ocorreu um erro crítico ao carregar a aplicação.</h1><p>Por favor, verifique o console para mais detalhes.</p>';
    }
  }

  init();
});
