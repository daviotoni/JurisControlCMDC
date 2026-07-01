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
  const VALID_ACAO  = new Set(['criado','editado','excluido']);
  const VALID_CAT   = new Set(['g','a','r','p','u','e','o']);
  const safeCSSClass = (value, whitelist) => whitelist.has(value) ? value : '';

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
          sidebarCollapsed: false 
      };
      
      DB_USERS = await dbHelper.getAll('users');
      DB = await dbHelper.getAll('processos');
      CAL = await dbHelper.getAll('calendario');
      DB_DOCS = await dbHelper.getAll('documentos');
      DB_VERSOES = await dbHelper.getAll('versoes');
      DB_MODELOS = await dbHelper.getAll('modelos');
      DB_EMISSORES = await dbHelper.getAll('emissores');
      DB_LEIS = await dbHelper.getAll('leis');
      
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
    sessionStorage.removeItem('loggedInUser');
    loginUser.focus();
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

  function checkLoginState() {
      const loggedInUser = sessionStorage.getItem('loggedInUser');
      if (loggedInUser) {
          showApp(JSON.parse(loggedInUser));
      } else {
          showLogin();
      }
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

        let paginationHTML = `<button class="page-link ${currentPage === 1 ? 'disabled' : ''}" data-page="${currentPage - 1}">Anterior</button>`;
        for (let i = 1; i <= totalPages; i++) {
            paginationHTML += `<button class="page-link ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
        }
        paginationHTML += `<button class="page-link ${currentPage === totalPages ? 'disabled' : ''}" data-page="${currentPage + 1}">Próximo</button>`;
        container.innerHTML = paginationHTML;

        container.onclick = (e) => {
            const pageBtn = e.target.closest('[data-page]');
            if (pageBtn && !pageBtn.classList.contains('disabled')) {
                onPageChange(Number(pageBtn.dataset.page));
            }
        };
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

    pageItems.forEach(doc=>{
        const currentVersion = getCurrentVersion(doc.id);
        const allVersions = getVersionsOfDoc(doc.id);
        
        const processoVinculado = DB.find(proc => String(proc.docId) === String(doc.id));
        const processoInfo = processoVinculado 
            ? `<span style="font-size: 0.8em; color: var(--text-muted); display: block; margin-top: 4px;">Proc: ${sanitizeHTML(processoVinculado.num)}</span>`
            : `<span style="font-size: 0.8em; color: var(--text-muted); display: block; margin-top: 4px;">Não vinculado</span>`;

        const item=document.createElement('div');
        item.className='doc-item';
        item.innerHTML = `
        <div>
          <span class="name" title="${sanitizeHTML(doc.nomePrincipal)}">${sanitizeHTML(doc.nomePrincipal)}</span>
          ${processoInfo}
        </div>
        <div class="actions">
          ${currentVersion ? `<button class="btn" data-download-version="${currentVersion.id}">Abrir Atual</button>` : ''} 
          <button class="btn secondary" data-versions-for="${doc.id}">Versões (${allVersions.length})</button> 
          <button class="btn danger" data-del-doc="${doc.id}">Excluir</button>
        </div>`;
        list.appendChild(item);
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
                  currentlyDisplayedPareceres = DB_DOCS.sort((a,b) => new Date(b.criadoEm) - new Date(a.criadoEm));
                  drawPareceres();
                  showToast('Nova versão adicionada!');
              };
              reader.readAsDataURL(file); e.target.value = ''; $('#novaVersaoFile').onchange = null;
          };
      };
      if(mVersoes) mVersoes.style.display = 'flex';
  }
  
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
          currentlyDisplayedPareceres = DB_DOCS.sort((a,b) => new Date(b.criadoEm) - new Date(a.criadoEm));
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
      currentlyDisplayedPareceres = DB_DOCS.filter(d => matchingDocIds.has(d.id));
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
        currentlyDisplayedPareceres = DB_DOCS.sort((a,b) => new Date(b.criadoEm) - new Date(a.criadoEm));
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
          const user = JSON.parse(sessionStorage.getItem('loggedInUser'));
          const entry = {
              id: Date.now(),
              processoId: String(processoId),
              processoNum: processoNum || String(processoId),
              acao,
              usuario: user?.name || user?.login || 'Sistema',
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

    let currentPage = 1;
    const itemsPerPage = 10;

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
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>
                        <div style="font-weight: 700; color: var(--text-primary);">${sanitizeHTML(p.num)}</div>
                        <div>${sanitizeHTML(p.int)}</div>
                    </td>
                    <td>${sanitizeHTML(p.obj) || '—'}</td>
                    <td style="text-align:center"><span class="status ${safeCSSClass(p.stat, VALID_STATS)}">${sanitizeHTML(sTxt)}</span></td>
                    <td style="text-align:center">${p.prazo ? fmtBR(p.prazo) : '—'}</td>
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
                card.className = 'proc-card';
                card.innerHTML = `
                    <div class="proc-card-header">
                        <span class="num">${sanitizeHTML(p.num)}</span>
                        <div style="display:flex;align-items:center;gap:0.5rem;">
                            ${p.anotacoes && p.anotacoes.length > 0 ? `<span class="anotacoes-badge" data-anot="${p.id}" aria-label="${p.anotacoes.length} anotação(ões)"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> ${p.anotacoes.length}</span>` : ''}
                            <span class="status ${safeCSSClass(p.stat, VALID_STATS)}">${sanitizeHTML(sTxt)}</span>
                        </div>
                    </div>
                    <div class="proc-card-body">
                        <div class="item"><strong>Interessado:</strong> ${sanitizeHTML(p.int)}</div>
                        <div class="item"><strong>Objeto:</strong> ${sanitizeHTML(p.obj) || '—'}</div>
                        <div class="item"><strong>Prazo:</strong> ${p.prazo ? fmtBR(p.prazo) : '—'}</div>
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
    }
    
    let viewMode = 'lista';
    const kanbanContainer = $('#kanban-container');
    const paginationEl = $('#pagination-container');

    const KANBAN_COLS = [
        { key: 'pendente',                label: 'Pendente',               color: '#ef4444' },
        { key: 'em-analise',              label: 'Em Análise',             color: '#f59e0b' },
        { key: 'aguardando-documentacao', label: 'Aguard. Documentação',   color: '#3b82f6' },
        { key: 'em-diligencia',           label: 'Em Diligência',          color: '#8b5cf6' },
        { key: 'finalizado',              label: 'Finalizado',             color: '#22c55e' },
        { key: 'arquivado',               label: 'Arquivado',              color: '#64748b' },
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
            const msg = `Tem certeza que deseja excluir o processo <strong>${sanitizeHTML(procToDelete?.num || String(id))}</strong>?<br>Esta ação não pode ser desfeita.`;
            if (await confirmDialog(msg, { title: 'Excluir processo', confirmLabel: 'Excluir' })) {
                await logHistorico(id, procToDelete?.num, 'excluido');
                DB = DB.filter(p => p.id != id);
                await dbHelper.delete('processos', id);
                draw(true);
                renderDashboard();
                showToast('Processo excluído.', 'danger');
            }
        }
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
        const msg = `Tem certeza que deseja excluir o processo <strong>${sanitizeHTML(procToDelete?.num || String(idVal))}</strong>?<br>Esta ação não pode ser desfeita.`;
        if (await confirmDialog(msg, { title: 'Excluir processo', confirmLabel: 'Excluir' })) {
            await logHistorico(idVal, procToDelete?.num, 'excluido');
            DB = DB.filter(x => x.id != idVal);
            await dbHelper.delete('processos', idVal);
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
    if (p.docId) {
        const parecerDoc = getDoc(p.docId);
        if (parecerDoc) {
            const currentVersion = getCurrentVersion(parecerDoc.id);
            parecerContainer.innerHTML = `
                <p style="margin:0; font-weight: 600;">${sanitizeHTML(parecerDoc.nomePrincipal)}</p>
                ${currentVersion ? `<button class="btn secondary" data-download-version="${currentVersion.id}">Ver Parecer</button>` : ''}
                <button class="btn" data-versions-for="${parecerDoc.id}">Histórico</button>
            `;
            if(currentVersion) parecerContainer.querySelector('[data-download-version]').onclick = (e) => { const v = getVersion(Number(e.target.dataset.downloadVersion)); if(v) handleDownload(v.data, v.nomeArquivo); };
            parecerContainer.querySelector('[data-versions-for]').onclick = (e) => openVersionsModal(Number(e.target.dataset.versionsFor));

        } else {
            parecerContainer.innerHTML = `<p style="margin:0;">Vinculado, mas não encontrado (ID: ${p.docId}).</p>`;
        }
    } else {
        parecerContainer.innerHTML = `
            <p style="margin:0;">Nenhum parecer anexado.</p>
            <button id="btnAnexarParecerView" class="btn primary">Anexar Agora</button>
        `;
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

    const renderAnotacoes = () => {
        const timeline = $('#anotacoes-timeline');
        const lista = (p.anotacoes || []).slice().sort((a, b) => b.id - a.id);
        if (lista.length === 0) {
            timeline.innerHTML = '<p class="anotacoes-empty">Nenhuma anotação registrada ainda.</p>';
        } else {
            timeline.innerHTML = lista.map(a => {
                const dt = new Date(a.dt);
                const dateStr = dt.toLocaleDateString('pt-BR') + ' às ' + dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                const initials = sanitizeHTML(a.usuario.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase());
                return `
                    <div class="anotacao-entry">
                        <div class="anotacao-avatar">${initials}</div>
                        <div class="anotacao-body">
                            <div class="anotacao-meta">
                                <span class="anotacao-user">${sanitizeHTML(a.usuario)}</span>
                                <span class="anotacao-date">${sanitizeHTML(dateStr)}</span>
                            </div>
                            <p class="anotacao-texto">${sanitizeHTML(a.texto)}</p>
                        </div>
                    </div>`;
            }).join('');
        }
    };
    renderAnotacoes();

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

      const acaoIcons = {
          criado: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>`,
          editado: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
          excluido: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`
      };
      const acaoLabels = { criado: 'Processo criado', editado: 'Processo editado', excluido: 'Processo excluído' };

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
              } else {
                  changesHtml = `<p style="font-size:0.82rem;color:var(--text-muted);margin:0;">${entry.acao === 'criado' ? 'Processo cadastrado no sistema.' : 'Processo removido do sistema.'}</p>`;
              }
              const div = document.createElement('div');
              div.className = 'historico-entry';
              div.innerHTML = `
                  <div class="historico-icon ${safeCSSClass(entry.acao, VALID_ACAO)}">${acaoIcons[entry.acao] || ''}</div>
                  <div class="historico-content">
                      <div class="historico-header">
                          <span class="historico-action">${sanitizeHTML(acaoLabels[entry.acao] || entry.acao)}</span>
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
            
            const parecerDoc = p.docId ? getDoc(p.docId) : null;
            const parecerName = parecerDoc ? parecerDoc.nomePrincipal.replace(/\.(docx|doc)$/i, '') : 'Nenhum parecer anexado';
            drawSection('PARECER', () => { drawDataRow('DOCUMENTO:', parecerName); });

            
            const pageH = doc.internal.pageSize.getHeight(), footerY = pageH - 25;
            const emitter = emissorId ? DB_EMISSORES.find(e => e.id == emissorId) : null, loggedInUser = JSON.parse(sessionStorage.getItem('loggedInUser')), emitterName = emitter ? emitter.name : (loggedInUser ? loggedInUser.name : 'Usuário');
            doc.line(margin + 40, footerY + 5, pageW - margin - 40, footerY + 5); doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.text(emitterName, pageW / 2, footerY + 10, { align: 'center' });
            
            doc.save(`ficha-processo_${p.num.replace(/[^a-zA-Z0-9]/g, '-')}.pdf`); showToast('Ficha PDF gerada com sucesso!');
      } catch (e) { console.error("Erro ao gerar PDF:", e); showToast('Ocorreu um erro ao gerar a ficha.', 'danger'); }
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
      if (leisFiltradas.length === 0) { grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="m16 16 3-8 3 8c-.8.9-2 1-3 1-1 0-2.2-.1-3-1Z"/><path d="m2 16 3-8 3 8c-.8.9-2 1-3 1-1 0-2.2-.1-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/></svg><h3>Nenhuma lei encontrada</h3><p>Tente ajustar a busca ou clique em "Adicionar Lei".</p></div>`; return; }
      leisFiltradas.forEach(lei => {
          const card = document.createElement('div'); card.className = 'card lei-card';
          card.innerHTML = `<div class="lei-card-header">${sanitizeHTML(lei.tipo)} Nº ${sanitizeHTML(lei.numero)}/${sanitizeHTML(lei.ano)}</div><p class="lei-card-ementa">${sanitizeHTML(lei.ementa)}</p>
              <div class="lei-card-actions">
                  ${lei.link ? `<a href="${sanitizeHTML(lei.link)}" target="_blank" class="btn secondary">Ver Link</a>` : ''}
                  ${lei.arquivo ? `<button class="btn secondary" data-download-lei="${lei.id}">Baixar Anexo</button>` : ''}
                  <button class="btn" data-edit-lei="${lei.id}" style="margin-left:auto;">Editar</button>
              </div>`;
          grid.appendChild(card);
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
  function shift(delta){ if(VIEW==='month')CUR.setMonth(CUR.getMonth()+delta); else if(VIEW==='year')CUR.setFullYear(CUR.getFullYear()+delta); drawView(); }
  function drawView(){ calBody.innerHTML=''; if(VIEW==='month')drawMonth(); else drawYear();}
  
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
            dot.onclick = () => { if (String(evt.id).startsWith('pr-')) { const procId = String(evt.id).replace('pr-', ''), processo = DB.find(p => p.id == procId); if (processo) { showTab('proc', { filterBy: { text: processo.num } }); } } else { openEvt(evt); } };
            dotsContainer.appendChild(dot);
        });
        eventsWrapper.appendChild(dotsContainer); c.appendChild(eventsWrapper); c.ondblclick=()=>openEvt({id:null,data:ds,hora:'',desc:'',cat:'g'}); g.appendChild(c);p.setDate(p.getDate()+1);
    }
    calBody.append(w,g);
  }

  function drawYear() { /* ... Lógica para visão anual ... */ }
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
  const statusColorMap = {'pendente': '#ef4444', 'em-analise': '#f59e0b', 'aguardando-documentacao': '#3b82f6', 'em-diligencia': '#8b5cf6', 'finalizado': '#22c55e', 'arquivado': '#64748b'};
  const colorPalette = ['#3b82f6', '#f59e0b', '#22c55e', '#ef4444', '#8b5cf6', '#64748b', '#0ea5e9', '#f97316', '#a16207', '#16a34a'];
  const mesesMap = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const sMapKeys = Object.keys(statusMap);
   function getChartConfigs(data) {
    const isDark = document.body.dataset.theme === 'dark', gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)', textColor = isDark ? '#f8fafc' : '#1a202c', cardColor = getComputedStyle(document.body).getPropertyValue('--card-bg').trim();
    Chart.defaults.color = textColor; Chart.defaults.font.family = "'Inter', sans-serif";
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
    
    const pareceresPorMes = Array(12).fill(0);
    DB.forEach(p => {
        if (p.docId && p.saida) { 
            const saidaDate = parse(p.saida);
            if (saidaDate) { const mes = saidaDate.getUTCMonth(); pareceresPorMes[mes]++; }
        }
    });
    const pareceresMesConfig = { type: 'bar', data: { labels, datasets: [{ label: 'Nº de Pareceres', data: pareceresPorMes, backgroundColor: '#26c6da' }] }, options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks: { precision: 0 } }, x: {} } } };
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
          const li=document.createElement('li');
          li.innerHTML=`<div class="prazo-date"><span class="month">${sanitizeHTML(mes)}</span><span class="day">${sanitizeHTML(dia)}</span></div><div class="prazo-info"><span class="type type-${sanitizeHTML(item.tipo)}">${sanitizeHTML(item.tipo.toUpperCase())}</span><div class="desc">${sanitizeHTML(item.desc)}</div></div>`;
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
          { filter: 'total',     label: 'Total de Processos',  value: kpiData.total,  color: '#2196F3', icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/></svg>` },
          { filter: 'pendente',  label: 'Pendentes',           value: kpiData.pend,   color: '#f59e0b', icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>` },
          { filter: 'em-analise',label: 'Em Análise',          value: kpiData.anal,   color: '#FF9800', icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>` },
          { filter: 'finalizado',label: 'Finalizados',         value: kpiData.fin,    color: '#22c55e', icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>` },
          { filter: 'alerta',    label: 'Vencendo (≤5 dias)',  value: kpiData.alert,  color: '#FF7043', icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>` },
          { filter: 'vencido',   label: 'Vencidos',            value: kpiData.venc,   color: '#ef4444', icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>` },
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
    function navigateToDate(dateString) { CUR = parse(dateString); VIEW = 'month'; drawView(); }
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

  function applyTheme(themeValue) {
    let finalTheme = themeValue;
    if (themeValue === 'system') {
        finalTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    document.body.dataset.theme = finalTheme;
    $('.sun').style.display = finalTheme === 'dark' ? 'none' : 'block';
    $('.moon').style.display = finalTheme === 'dark' ? 'block' : 'none';
    
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
    btnSair.onclick = showLogin;

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
      const delBtn = e.target.closest('[data-del-doc]'); const versionsBtn = e.target.closest('[data-versions-for]'); const downloadBtn = e.target.closest('[data-download-version]');
      if (delBtn) {
          const docId = Number(delBtn.dataset.delDoc); if (confirm('Excluir este parecer e TODO o seu histórico?')) {
              const versionsToDelete = getVersionsOfDoc(docId); DB_DOCS = DB_DOCS.filter(d => d.id !== docId); DB_VERSOES = DB_VERSOES.filter(v => v.idDocumento !== docId);
              const procsToUpdate = DB.filter(p => String(p.docId) === String(docId));
              await dbHelper.delete('documentos', docId); for(const v of versionsToDelete) await dbHelper.delete('versoes', v.id); for(const p of procsToUpdate) { p.docId = null; await dbHelper.put('processos', p); }
              DB = await dbHelper.getAll('processos'); currentlyDisplayedPareceres = DB_DOCS.sort((a,b) => new Date(b.criadoEm) - new Date(a.criadoEm));
              $('#buscaConteudo').value = ''; drawPareceres(true); showToast('Parecer excluído.', 'danger');
          }
      }
      if (versionsBtn) openVersionsModal(Number(versionsBtn.dataset.versionsFor));
      if (downloadBtn) { const version = getVersion(Number(downloadBtn.dataset.downloadVersion)); if (version) handleDownload(version.data, version.nomeArquivo); }
    };

    if(mVersoes) mVersoes.onclick = (e) => { if (e.target.matches('.modal') || e.target.closest('[data-close-versoes]')) { mVersoes.style.display = 'none'; } };
    $('#lista_versoes').onclick = (e) => { const downloadBtn = e.target.closest('[data-download-version]'); if (downloadBtn) { const version = getVersion(Number(downloadBtn.dataset.downloadVersion)); if (version) handleDownload(version.data, version.nomeArquivo); } };

    $('#btnHardReset').onclick = async () => {
        if (confirm('ATENÇÃO!\n\nEsta ação apagará TODOS os dados do JurisControl neste navegador (processos, usuários, documentos, etc.).\n\nEsta ação é IRREVERSÍVEL.\n\nDeseja continuar?')) {
            try {
                if (db) {
                    db.close();
                }
                const deleteRequest = indexedDB.deleteDatabase(DB_NAME);
                deleteRequest.onsuccess = () => {
                    showToast('Todos os dados foram apagados. O sistema será reiniciado.', 'danger');
                    setTimeout(() => location.reload(), 2000);
                };
                deleteRequest.onerror = (e) => {
                    console.error("Erro ao deletar banco de dados:", e.target.error);
                    showToast('Não foi possível apagar os dados.', 'danger');
                };
                deleteRequest.onblocked = () => {
                     console.warn("Exclusão do banco de dados bloqueada.");
                    showToast('Feche outras abas do JurisControl e tente novamente.', 'info');
                };
            } catch (error) {
                console.error("Erro no processo de hard reset:", error);
                showToast('Ocorreu um erro inesperado.', 'danger');
            }
        }
    };

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
                
                if (db) db.close(); 

                setTimeout(async () => {
                    await dbHelper.init();

                    for (const storeName of STORES) {
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
                                                        checkLoginState();
                                        } catch (err) {
                                                        console.error('Erro ao carregar dados após autenticação:', err);
                                                        showLogin();
                                        }
                          } else {
                                        checkLoginState();
                          }
              });
    } catch (error) {
        console.error("Falha na inicialização do aplicativo:", error);
        document.body.innerHTML = '<h1>Ocorreu um erro crítico ao carregar a aplicação.</h1><p>Por favor, verifique o console para mais detalhes.</p>';
    }
  }

  init();
});
