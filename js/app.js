document.addEventListener('DOMContentLoaded', () => {

  // ===== Helpers =====
  const $=(s,sc=document)=>sc.querySelector(s);
  const $$=(s,sc=document)=>Array.from(sc.querySelectorAll(s));
  const fmtBR=(d)=>{ if(!d) return '—'; const dt = new Date(d); return dt.toLocaleDateString('pt-BR',{timeZone:'UTC'}); };
  const parse=(d)=>{ if(!d) return null; const [y,m,dd]=d.split('-').map(Number); return new Date(Date.UTC(y,(m||1)-1,(dd||1))); };
  const todayUTC=()=>{ const d=new Date(); return new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate())); };
  const diffDays=(a,b)=> Math.ceil((b-a)/86400000);
  function ymd(d){ const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,'0'), dd=String(d.getDate()).padStart(2,'0'); return `${y}-${m}-${dd}`; }

  const sanitizeHTML = (str) => {
    if (!str) return '';
    const temp = document.createElement('div');
    temp.textContent = str;
    return temp.innerHTML;
  };

  // Whitelist de valores válidos para classes CSS dinâmicas (evita injeção via Firestore)
  const VALID_STATS = new Set(['pendente','em-analise','aguardando-documentacao','em-diligencia','finalizado','arquivado']);
  const VALID_ACAO  = new Set(['criado','editado','excluido','parecer-criado','parecer-editado','parecer-emitido','parecer-reaberto']);
  const VALID_CAT   = new Set(['g','a','r','p','u','e','o']);
  const safeCSSClass = (value, whitelist) => whitelist.has(value) ? value : '';

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
  let DB_USERS = [], DB = [], CAL = [], DB_DOCS = [], DB_VERSOES = [], DB_MODELOS = [], DB_EMISSORES = [], DB_LEIS = [];
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
      
      DB_USERS = await dbHelper.getAll('users');
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

  const cryptoHelper = {
    bufferToHex(buffer) {
        return [...new Uint8Array(buffer)].map(b => b.toString(16).padStart(2, '0')).join('');
    },
    hexToBuffer(hex) {
        const bytes = new Uint8Array(hex.length / 2);
        for (let i = 0; i < hex.length; i += 2) {
            bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
        }
        return bytes.buffer;
    },
    async hashPassword(password) {
        const salt = window.crypto.getRandomValues(new Uint8Array(16));
        const encoder = new TextEncoder();
        const keyMaterial = await window.crypto.subtle.importKey(
            'raw',
            encoder.encode(password),
            { name: 'PBKDF2' },
            false,
            ['deriveBits', 'deriveKey']
        );
        const derivedKey = await window.crypto.subtle.deriveBits(
            { name: 'PBKDF2', salt: salt, iterations: 100000, hash: 'SHA-256' },
            keyMaterial,
            256
        );
        return {
            salt: this.bufferToHex(salt),
            hash: this.bufferToHex(derivedKey)
        };
    },
    async verifyPassword(password, saltHex, hashHex) {
        const salt = this.hexToBuffer(saltHex);
        const encoder = new TextEncoder();
        const keyMaterial = await window.crypto.subtle.importKey(
            'raw',
            encoder.encode(password),
            { name: 'PBKDF2' },
            false,
            ['deriveBits', 'deriveKey']
        );
        const derivedKey = await window.crypto.subtle.deriveBits(
            { name: 'PBKDF2', salt: salt, iterations: 100000, hash: 'SHA-256' },
            keyMaterial,
            256
        );
        return this.bufferToHex(derivedKey) === hashHex;
    }
  };

  async function initializeUsers() {
      // CORREÇÃO: Detecta o formato antigo de senha (sem 'salt') e força a recriação.
      if (DB_USERS.length === 0 || !DB_USERS[0].salt) {
          console.warn("Formato de senha antigo detectado ou nenhum usuário encontrado. Redefinindo para o padrão seguro.");
          
          // A notificação só será visível após o login, então a colocamos para depois.
          
          // Limpa os usuários antigos e inseguros do banco de dados
          await dbHelper.clear('users');

          const { salt, hash } = await cryptoHelper.hashPassword('admin');
          const defaultUser = { 
              id: Date.now(), 
              name: 'Administrador', 
              login: 'admin', 
              salt: salt,
              hashedPassword: hash, 
              role: 'admin' 
          };
          await dbHelper.put('users', defaultUser);
          DB_USERS = [defaultUser];
          
          // Usamos um truque para mostrar a notificação após o login bem-sucedido
          sessionStorage.setItem('showResetToast', 'true');
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
    if (sidebar && CFG.sidebarCollapsed) sidebar.classList.add('collapsed');
    renderDashboard();
    showTab('dashboard');

    // CORREÇÃO: Mostra a notificação de reset se necessário
    if (sessionStorage.getItem('showResetToast')) {
        showToast("Banco de usuários atualizado para novo padrão de segurança. Login redefinido para admin/admin.", "info");
        sessionStorage.removeItem('showResetToast');
    }
  }

  function showLogin() {
    loginOverlay.style.display = 'flex';
    loginErro.textContent = '';
    loginPass.value = '';
    appLayout.style.display = 'none';
    welcomeMsg.textContent = '';
    loginUser.focus();
  }

  async function fazerLogout() {
    sessionStorage.removeItem('loggedInUser');
    try { await logoutFirebase(); } catch (e) { console.warn('Erro ao encerrar sessão no Firebase:', e); }
    showLogin();
  }

  async function tentarEntrar() {
    const email = loginUser.value.trim();
    const senha = loginPass.value;

    loginErro.textContent = '';
    btnEntrar.disabled = true;

    try {
        // === LOGIN PELO FIREBASE ===
        const firebaseUser = await loginComFirebase(email, senha);

        // Cria um objeto simples de sessão
        const userSession = {
            id: firebaseUser.uid,
            name: firebaseUser.email.split('@')[0],
            login: firebaseUser.email,
            role: 'user'
        };

        sessionStorage.setItem('loggedInUser', JSON.stringify(userSession));
        showApp(userSession);

    } catch (error) {
        console.error(error);
        loginErro.textContent = 'Login ou senha inválidos';
        btnEntrar.disabled = false;
    }
  }

  // Sessão do app é validada contra o estado real do Firebase Auth (persistente entre reloads/deploys),
  // não só contra o sessionStorage — senão um simples refresh de página (ex.: após um deploy) desloga o usuário.
  function checkLoginState(firebaseUser) {
      if (!firebaseUser) {
          sessionStorage.removeItem('loggedInUser');
          showLogin();
          return;
      }
      const stored = sessionStorage.getItem('loggedInUser');
      let loggedInUser = stored ? JSON.parse(stored) : null;
      if (!loggedInUser) {
          loggedInUser = {
              id: firebaseUser.uid,
              name: firebaseUser.email.split('@')[0],
              login: firebaseUser.email,
              role: 'user'
          };
          sessionStorage.setItem('loggedInUser', JSON.stringify(loggedInUser));
      }
      showApp(loggedInUser);
  }
  
  const getDoc = (docId) => DB_DOCS.find(d => d.id === docId);
  const getVersion = (versionId) => DB_VERSOES.find(v => v.id === versionId);
  const getModelo = (modeloId) => DB_MODELOS.find(m => m.id === modeloId);
  const getVersionsOfDoc = (docId) => DB_VERSOES.filter(v => v.idDocumento === docId).sort((a,b) => b.versao - a.versao);
  const getCurrentVersion = (docId) => {
      const doc = getDoc(docId);
      if (!doc) return null;
      return getVersion(doc.idVersaoAtual);
  };
  
  function base64ToArrayBuffer(base64) {
      try {
        const binaryString = window.atob(base64.split(',')[1]);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) { bytes[i] = binaryString.charCodeAt(i); }
        return bytes.buffer;
      } catch (e) {
        console.error("Erro ao decodificar base64:", e);
        return new ArrayBuffer(0); // Retorna buffer vazio em caso de erro
      }
  }
  
  function getMimeType(filename) {
      const extension = filename.split('.').pop().toLowerCase();
      switch (extension) {
        case 'doc': return 'application/msword';
        case 'pdf': return 'application/pdf';
        default: return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      }
  }

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
    
  function normalizeParecerParaLista(item, tipo) {
      if (tipo === 'estruturado') {
          return {
              id: `pz-${item.id}`, tipo: 'estruturado',
              titulo: `Parecer — Processo ${item.processoNum || 's/ nº'}`,
              status: item.status, dataRef: item.atualizadoEm || item.criadoEm, ref: item
          };
      }
      return { id: `doc-${item.id}`, tipo: 'legado', titulo: item.nomePrincipal, status: null, dataRef: item.criadoEm, ref: item };
  }

  function buildPareceresListaCombinada() {
      const legado = DB_DOCS.map(d => normalizeParecerParaLista(d, 'legado'));
      const estruturados = DB_PARECERES.map(pz => normalizeParecerParaLista(pz, 'estruturado'));
      return [...legado, ...estruturados].sort((a, b) => new Date(b.dataRef) - new Date(a.dataRef));
  }

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
  const getParecerVersoes = (parecerId) => DB_PARECER_VERSOES.filter(v => String(v.parecerId) === String(parecerId)).sort((a, b) => b.versao - a.versao);

  // Accessor único de "qual é o parecer deste processo" (estruturado > Word legado > nenhum).
  // Devolve só dados normalizados (não HTML) — usado por openProcDetails e os dois fluxos de PDF,
  // pra não repetir essa decisão em cada lugar. NÃO é usado no gráfico do dashboard (getChartConfigs)
  // porque aquela contagem é "por registro" (independente de o processo ainda existir), não "por
  // processo vivo" como este accessor — ver comentário em getChartConfigs.
  function getParecerInfo(processo) {
      const estruturado = getParecer(processo.id);
      if (estruturado) {
          const emitido = estruturado.status === 'emitido';
          return {
              tipo: 'estruturado',
              emitido,
              label: emitido ? 'Emitido' : 'Rascunho',
              dataRef: emitido ? estruturado.emitidoEm : (estruturado.atualizadoEm || estruturado.criadoEm),
              nomeDocumento: `Parecer redigido no sistema (${emitido ? 'Emitido' : 'Rascunho'})`,
              parecer: estruturado,
              docLegado: null
          };
      }
      if (processo.docId) {
          const docLegado = getDoc(processo.docId);
          if (docLegado) {
              return {
                  tipo: 'legado', emitido: null, label: null,
                  dataRef: docLegado.criadoEm, nomeDocumento: docLegado.nomePrincipal,
                  parecer: null, docLegado
              };
          }
          return { tipo: 'legado-orfao', emitido: null, label: null, dataRef: null, nomeDocumento: null, parecer: null, docLegado: null };
      }
      return null;
  }

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
    if(key==='cfg') { renderUsers(); renderEmissores(); }
  }

  const statusMap = {'pendente':'Pendente','em-analise':'Em Análise','aguardando-documentacao':'Aguardando Documentação','em-diligencia':'Em Diligência', 'finalizado':'Finalizado','arquivado':'Arquivado'};
  const fieldLabels = { num: 'Nº Processo', int: 'Interessado', tipo: 'Tipo', obj: 'Objeto', acao: 'Ação Tomada', stat: 'Status', setorOrigem: 'Setor de Origem', dest: 'Setor Enviado', ent: 'Data de Entrada', prazo: 'Prazo Final', saida: 'Data de Saída' };

  function getChanges(oldRec, newRec) {
      const trackFields = ['num','int','tipo','obj','acao','stat','setorOrigem','dest','ent','prazo','saida'];
      return trackFields
          .filter(f => String(oldRec[f] || '') !== String(newRec[f] || ''))
          .map(f => ({ campo: f, de: oldRec[f] || '', para: newRec[f] || '' }));
  }

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

    function filterSort() {
        let L = DB.slice();
        const t = (q.value || '').toLowerCase().trim();
        if (t) L = L.filter(p => [p.num, p.int, p.obj, p.setorOrigem, p.dest, p.acao, statusMap[p.stat]].some(v => String(v || '').toLowerCase().includes(t)));
        if (initialFilter?.status) L = L.filter(p => p.stat === initialFilter.status);
        if (initialFilter?.prazo === 'alerta') L = L.filter(p => p.prazo && p.stat !== 'finalizado' && p.stat !== 'arquivado' && diffDays(todayUTC(), parse(p.prazo)) <= 5 && diffDays(todayUTC(), parse(p.prazo)) >= 0);
        if (initialFilter?.prazo === 'vencido') L = L.filter(p => p.prazo && p.stat !== 'finalizado' && p.stat !== 'arquivado' && diffDays(todayUTC(), parse(p.prazo)) < 0);
        if (initialFilter?.month !== undefined) L = L.filter(p => p.ent && parse(p.ent).getUTCMonth() === initialFilter.month);
        if (filtroStatus.value) L = L.filter(p => p.stat === filtroStatus.value);
        if (filtroSetor.value) L = L.filter(p => p.setorOrigem === filtroSetor.value || p.dest === filtroSetor.value);
        if (filtroTipo.value) L = L.filter(p => p.tipo === filtroTipo.value);
        if (filtroEmissor.value) L = L.filter(p => String(p.emissorId || '') === filtroEmissor.value);
        if (filtroEntradaDe.value) { const de = parse(filtroEntradaDe.value); L = L.filter(p => p.ent && parse(p.ent) >= de); }
        if (filtroEntradaAte.value) { const ate = parse(filtroEntradaAte.value); L = L.filter(p => p.ent && parse(p.ent) <= ate); }
        if (ord.value === 'prazo') L.sort((a, b) => { const A = parse(a.prazo), B = parse(b.prazo); return (A ? A.getTime() : Infinity) - (B ? B.getTime() : Infinity); });
        else if (ord.value === 'status') L.sort((a, b) => (a.stat || '').localeCompare(b.stat || ''));
        else L.sort((a, b) => { const A = parse(a.ent), B = parse(b.ent); return (B ? B.getTime() : 0) - (A ? A.getTime() : 0); });
        return L;
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

  // Brasão oficial do município de Duque de Caxias (extraído de um parecer real emitido pela
  // Procuradoria), usado no timbre do PDF do parecer (drawParecerTimbre). Imagem PNG 338x418.
  const BRASAO_DUQUE_DE_CAXIAS_B64 = 'data:image/png;base64,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';

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
          await dbHelper.put('leis', rec); m.style.display = 'none'; renderLeis(); showToast('Lei salva com sucesso!');
      };
      del.onclick = async () => {
          const idVal = Number(form.elements.id.value); if (!idVal) return;
          if (confirm('Tem certeza?')) {
              DB_LEIS = DB_LEIS.filter(l => l.id != idVal); await dbHelper.delete('leis', idVal);
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

  async function openUserModal(mode, id = null) {
    const m = $('#m_user'); m.style.display = 'flex';
    $('#m_user_t').textContent = mode === 'new' ? 'Novo Usuário' : 'Editar Usuário';
    const form = $('#f_user'), del = $('#fu_del'); form.reset(); $('#fu_pass').placeholder = mode === 'new' ? 'Defina uma senha' : 'Deixe em branco para não alterar';

    if (mode === 'edit') {
        const user = DB_USERS.find(u => u.id == id); if (!user) return;
        form.elements.id.value = user.id; form.elements.name.value = user.name; form.elements.login.value = user.login; form.elements.role.value = user.role; del.style.display = 'inline-flex';
    } else { form.elements.id.value = ''; del.style.display = 'none'; }

    form.onsubmit = async (e) => {
        e.preventDefault(); const formData = new FormData(form); const idVal = formData.get('id'); const isNew = !idVal;
        const rec = { id: isNew ? Date.now() : Number(idVal), name: formData.get('name'), login: formData.get('login'), role: formData.get('role')};
        const newPass = formData.get('pass');
        if (isNew && !newPass) { showToast('Senha é obrigatória para novos usuários.', 'danger'); return; }
        
        if (newPass) { 
            const { salt, hash } = await cryptoHelper.hashPassword(newPass);
            rec.salt = salt;
            rec.hashedPassword = hash;
        }

        const idx = DB_USERS.findIndex(u => u.id == rec.id);
        if (idx > -1) { 
            if (!rec.hashedPassword) { 
                rec.salt = DB_USERS[idx].salt;
                rec.hashedPassword = DB_USERS[idx].hashedPassword;
            }
            DB_USERS[idx] = rec; 
        } else { DB_USERS.push(rec); }
        
        await dbHelper.put('users', rec); m.style.display = 'none'; renderUsers(); showToast('Usuário salvo!');
    };
    del.onclick = async () => {
        const idVal = Number(form.elements.id.value); if (!idVal) return;
        if (DB_USERS.length <= 1) { showToast('Não é possível excluir o único usuário.', 'danger'); return; }
        if (confirm('Tem certeza?')) {
            DB_USERS = DB_USERS.filter(u => u.id != idVal); await dbHelper.delete('users', idVal); m.style.display = 'none'; renderUsers(); showToast('Usuário excluído.', 'danger');
        }
    }; $$('[data-close-user]').forEach(x => x.onclick = () => m.style.display = 'none');
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
        await dbHelper.put('emissores', rec); m.style.display = 'none'; renderEmissores(); showToast('Emissor salvo!');
    };
    del.onclick = async () => {
        const idVal = Number(form.elements.id.value); if (!idVal) return;
        if (confirm('Tem certeza?')) { DB_EMISSORES = DB_EMISSORES.filter(e => e.id != idVal); await dbHelper.delete('emissores', idVal); m.style.display = 'none'; renderEmissores(); showToast('Emissor excluído.', 'danger'); }
    }; $$('[data-close-emissor]').forEach(x => x.onclick = () => m.style.display = 'none');
}

  function renderUsers() {
    const listEl = $('#userList'); listEl.innerHTML = '';
    DB_USERS.forEach(user => { 
        const item = document.createElement('div'); 
        item.className = 'user-item'; 
        item.innerHTML = `<span>${sanitizeHTML(user.name)} (${sanitizeHTML(user.role)})</span><div><button class="btn secondary" data-edit-user="${user.id}">Editar</button></div>`; 
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
        await dbHelper.put('calendario', r); m.style.display='none'; drawView(); showToast('Compromisso salvo!');
    };
    dl.onclick= async ()=>{
        const idVal = Number(id.value); if(!idVal)return;
        if(confirm('Certeza?')){ CAL=CAL.filter(x=>String(x.id)!==String(idVal)); await dbHelper.delete('calendario', idVal); m.style.display='none'; drawView(); showToast('Compromisso excluído.', 'danger'); }
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
    btnEntrar.onclick = tentarEntrar;
    loginOverlay.onkeydown = (e) => { if (e.key === 'Enter') tentarEntrar(); };
    btnSair.onclick = fazerLogout;

    setupEnhancedNav();

    $$('.tab').forEach(b => b.onclick = (e) => { e.preventDefault(); showTab(b.dataset.tab); if (window.closeMobileMenu) window.closeMobileMenu(); });
    $('#btnAddUser').onclick = () => openUserModal('new');
    $('#userList').onclick = (e) => { if (e.target.closest('[data-edit-user]')) openUserModal('edit', e.target.closest('[data-edit-user]').dataset.editUser); };
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
            renderModelos(true);
            showToast('Modelo adicionado!');
        };
        reader.readAsDataURL(file); e.target.value = '';
    };

    $('#modeloList').onclick = async (e) => {
      const delBtn = e.target.closest('[data-del-modelo]'); const downloadBtn = e.target.closest('[data-download-modelo]');
      if (delBtn) { const modeloId = Number(delBtn.dataset.delModelo); if (confirm('Excluir este modelo?')) { DB_MODELOS = DB_MODELOS.filter(m => m.id !== modeloId); await dbHelper.delete('modelos', modeloId); renderModelos(true); showToast('Modelo excluído.', 'danger'); } }
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
              const versionsToDelete = getVersionsOfDoc(docId); DB_DOCS = DB_DOCS.filter(d => d.id !== docId); DB_VERSOES = DB_VERSOES.filter(v => v.idDocumento !== docId);
              const procsToUpdate = DB.filter(p => String(p.docId) === String(docId));
              await dbHelper.delete('documentos', docId); for(const v of versionsToDelete) await dbHelper.delete('versoes', v.id); for(const p of procsToUpdate) { p.docId = null; await dbHelper.put('processos', p); }
              DB = await dbHelper.getAll('processos'); currentlyDisplayedPareceres = buildPareceresListaCombinada();
              $('#buscaConteudo').value = ''; drawPareceres(true); showToast('Parecer excluído.', 'danger');
          }
      }
      if (versionsBtn) openVersionsModal(Number(versionsBtn.dataset.versionsFor));
      if (downloadBtn) { const version = getVersion(Number(downloadBtn.dataset.downloadVersion)); if (version) handleDownload(version.data, version.nomeArquivo); }
    };

    if(mVersoes) mVersoes.onclick = (e) => { if (e.target.matches('.modal') || e.target.closest('[data-close-versoes]')) { mVersoes.style.display = 'none'; } };
    $('#lista_versoes').onclick = (e) => { const downloadBtn = e.target.closest('[data-download-version]'); if (downloadBtn) { const version = getVersion(Number(downloadBtn.dataset.downloadVersion)); if (version) handleDownload(version.data, version.nomeArquivo); } };

    $('#bk_csv').onclick = () => exportCSV(DB);

    $('#bk_down').onclick = async () => {
        try {
            const backupData = {
                users: await dbHelper.getAll('users'),
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
                if (!backupData.processos || !backupData.users) {
                    throw new Error('Arquivo de backup inválido ou corrompido.');
                }
                
                setTimeout(async () => {
                    await dbHelper.init();

                    // Coleções restauráveis (o Firestore substituiu o IndexedDB;
                    // 'config' é tratado à parte logo abaixo).
                    const COLECOES = ['users', 'processos', 'calendario', 'documentos', 'versoes', 'modelos', 'emissores', 'leis', 'pareceres', 'parecerVersoes'];
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

              // Aguarda autenticação Firebase e carrega dados
              observarAuth(async (user) => {
                          if (user) {
                                        try {
                                                        await loadAllData();
                                                                        initTheme();
                                                        await initializeUsers();
                                                        checkLoginState(user);
                                        } catch (err) {
                                                        console.error('Erro ao carregar dados após autenticação:', err);
                                                        showLogin();
                                        }
                          } else {
                                        checkLoginState(null);
                          }
              });
    } catch (error) {
        console.error("Falha na inicialização do aplicativo:", error);
        document.body.innerHTML = '<h1>Ocorreu um erro crítico ao carregar a aplicação.</h1><p>Por favor, verifique o console para mais detalhes.</p>';
    }
  }

  init();
});
