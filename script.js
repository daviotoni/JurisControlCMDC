import { auth, signInWithEmailAndPassword } from './firebase.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js';

document.addEventListener('DOMContentLoaded', () => {

  // ===== Helpers =====
  const $=(s,sc=document)=>sc.querySelector(s);
  const $$=(s,sc=document)=>Array.from(sc.querySelectorAll(s));
  const fmtBR=(d)=>{ if(!d) return '—'; const dt = new Date(d); return dt.toLocaleDateString('pt-BR',{timeZone:'UTC'}); };
  const parse=(d)=>{ if(!d) return null; const [y,m,dd]=d.split('-').map(Number); return new Date(Date.UTC(y,(m||1)-1,(dd||1))); };
  const todayUTC=()=>{ const d=new Date(); return new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate())); };
  const diffDays=(a,b)=> Math.ceil((b-a)/86400000);
  function ymd(d){ const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,'0'), dd=String(d.getDate()).padStart(2,'0'); return `${y}-${m}-${dd}`; }
  
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
      toast.innerHTML = `${TOAST_ICONS[type] || ''} <p>${message}</p>`;
      
      container.appendChild(toast);

      toast.addEventListener('animationend', (e) => {
          if (e.animationName === 'toast-fade-out') {
              toast.remove();
          }
      });
  }

  // ===== INÍCIO: Lógica do IndexedDB =====
  const DB_NAME = 'JurisControlDB_v1';
  const DB_VERSION = 1;
  const STORES = ['users', 'processos', 'calendario', 'documentos', 'versoes', 'modelos', 'emissores', 'leis', 'config'];
  let db;

  const dbHelper = {
      async init() {
          return new Promise((resolve, reject) => {
              const request = indexedDB.open(DB_NAME, DB_VERSION);
              request.onerror = (event) => reject("Erro ao abrir o IndexedDB");
              request.onsuccess = (event) => {
                  db = event.target.result;
                  resolve(db);
              };
              request.onupgradeneeded = (event) => {
                  const db = event.target.result;
                  STORES.forEach(storeName => {
                      if (!db.objectStoreNames.contains(storeName)) {
                          db.createObjectStore(storeName, { keyPath: 'id' });
                      }
                  });
                  if(db.objectStoreNames.contains('config')) db.deleteObjectStore('config');
                  db.createObjectStore('config', { keyPath: 'key' });
              };
          });
      },
      async get(storeName, key) {
          return new Promise((resolve, reject) => {
              const transaction = db.transaction(storeName, 'readonly');
              const store = transaction.objectStore(storeName);
              const request = store.get(key);
              request.onsuccess = () => resolve(request.result);
              request.onerror = () => reject(request.error);
          });
      },
      async getAll(storeName) {
          return new Promise((resolve, reject) => {
              const transaction = db.transaction(storeName, 'readonly');
              const store = transaction.objectStore(storeName);
              const request = store.getAll();
              request.onsuccess = () => resolve(request.result);
              request.onerror = () => reject(request.error);
          });
      },
      async put(storeName, item) {
          return new Promise((resolve, reject) => {
              const transaction = db.transaction(storeName, 'readwrite');
              const store = transaction.objectStore(storeName);
              const request = store.put(item);
              request.onsuccess = () => resolve(request.result);
              request.onerror = () => reject(request.error);
          });
      },
      async delete(storeName, key) {
          return new Promise((resolve, reject) => {
              const transaction = db.transaction(storeName, 'readwrite');
              const store = transaction.objectStore(storeName);
              const request = store.delete(key);
              request.onsuccess = () => resolve(request.result);
              request.onerror = () => reject(request.error);
          });
      },
      async clear(storeName) {
           return new Promise((resolve, reject) => {
              const transaction = db.transaction(storeName, 'readwrite');
              const store = transaction.objectStore(storeName);
              const request = store.clear();
              request.onsuccess = () => resolve();
              request.onerror = () => reject(request.error);
          });
      }
  };
  // ===== FIM: Lógica do IndexedDB =====

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
      const defaultConfig = { sync: true, rowH: 140, theme: 'light', readNotifications: [], dismissedNotifications: [], sidebarCollapsed: false };
      
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

  // ===== Lógica de Login & Usuários =====
  function simpleHash(str) {
    let hash = 0;
    if (typeof str !== 'string' || str.length === 0) return hash;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash |= 0;
    }
    return 'h' + Math.abs(hash).toString(36);
  }

  async function initializeUsers() {
      // Usuários são gerenciados pelo Firebase; nenhum usuário padrão é criado.
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
    welcomeMsg.textContent = `Bem-vindo, ${user.name}`;
    renderDashboard();
    showTab('dashboard');
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
    const login = loginUser.value.trim();
    const pass = loginPass.value;
    try {
      await signInWithEmailAndPassword(login, pass);
    } catch (error) {
      loginErro.textContent = 'Login ou senha inválidos';
      loginPass.select();
      loginPass.focus();
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
      const binaryString = window.atob(base64.split(',')[1]);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) { bytes[i] = binaryString.charCodeAt(i); }
      return bytes.buffer;
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
    
  function updateModeloSelect(){
    // Esta função foi mantida caso seja usada em outro local, mas não é mais usada no formulário de processo
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
        list.innerHTML = `<div style="padding:8px; color:var(--text-muted)">Nenhum parecer encontrado.</div>`;
        return;
    }

    const pageItems = currentlyDisplayedPareceres.slice((parecerCurrentPage - 1) * itemsPerPageDocs, parecerCurrentPage * itemsPerPageDocs);

    pageItems.forEach(doc=>{
        const currentVersion = getCurrentVersion(doc.id);
        const allVersions = getVersionsOfDoc(doc.id);
        
        // NOVO: Encontrar o processo vinculado
        const processoVinculado = DB.find(proc => String(proc.docId) === String(doc.id));
        const processoInfo = processoVinculado 
            ? `<span style="font-size: 0.8em; color: var(--text-muted); display: block; margin-top: 4px;">Proc: ${processoVinculado.num}</span>`
            : `<span style="font-size: 0.8em; color: var(--text-muted); display: block; margin-top: 4px;">Não vinculado</span>`;

        const item=document.createElement('div');
        item.className='doc-item';
        item.innerHTML = `
        <div>
          <span class="name" title="${doc.nomePrincipal}">${doc.nomePrincipal}</span>
          ${processoInfo}
        </div>
        <div class="actions">
          <button class="btn" data-download-version="${currentVersion.id}">Abrir Atual</button> 
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
            <span class="v-name">${isCurrent ? '▶ ' : ''}V${v.versao}: ${v.nomeArquivo} ${isCurrent ? '(Atual)' : ''}</span>
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
        list.innerHTML = `<div style="padding:8px; color:var(--text-muted)">Nenhum modelo cadastrado.</div>`;
        return;
    }

    const pageItems = sortedModelos.slice((modeloCurrentPage - 1) * itemsPerPageDocs, modeloCurrentPage * itemsPerPageDocs);

    pageItems.forEach(modelo => {
        const item = document.createElement('div');
        item.className = 'doc-item';
        item.innerHTML = `<span class="name" title="${modelo.name}">${modelo.name}</span>
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
              const result = await mammoth.extractRawText({ arrayBuffer: buffer });
              const text = result.value || '';
              if (text.toLowerCase().includes(searchTerm)) matchingDocIds.add(version.idDocumento);
          } catch (e) { console.warn(`Erro ao ler ${version.nomeArquivo}:`, e); }
      }
      currentlyDisplayedPareceres = DB_DOCS.filter(d => matchingDocIds.has(d.id));
      drawPareceres(true);
  };

  const sections={dashboard: $('#secDashboard'), proc:$('#secProc'), cal:$('#secCal'), docs:$('#secDoc'), leis: $('#secLeis'), cfg:$('#secCfg')};
  
  // Acessa elementos do menu mobile para o JS
  const mobileMenuToggle = $('#mobile-menu-toggle');
  const topNav = $('#top-nav');
  const overlay = $('#mobile-menu-overlay');

  function showTab(key, options = {}){
    Object.values(sections).forEach(s=> { if(s) s.style.display='none'; });
    if(sections[key]) sections[key].style.display='block';
    
    $$('.tab').forEach(t=> {
        const isActive = t.dataset.tab === key;
        t.classList.toggle('active', isActive);
        if (isActive) {
            t.setAttribute('aria-current', 'page');
        } else {
            t.removeAttribute('aria-current');
        }
    });
    
    // Fecha o menu mobile ao selecionar uma opção
    if(topNav.classList.contains('mobile-open')) {
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

  // ===== Lógica de Processos =====
  const statusMap = {'pendente':'Pendente','em-analise':'Em Análise','aguardando-documentacao':'Aguardando Documentação','em-diligencia':'Em Diligência', 'finalizado':'Finalizado','arquivado':'Arquivado'};
  
  function renderProc(reset = false, initialFilter = null) {
    const q = $('#q'), ord = $('#ord'), tbody = $('#tbl-body'), mobileContainer = $('#mobile-cards-container'), paginationProcessesContainer = $('#pagination-container');

    let currentPage = 1;
    const itemsPerPage = 10;

    if (initialFilter) {
        q.value = '';
        if(initialFilter.text) q.value = initialFilter.text;
    }

    function filterSort() {
        let L = DB.slice();
        const t = (q.value || '').toLowerCase().trim();
        if (t) L = L.filter(p => [p.num, p.int, p.obj, p.setorOrigem, p.acao, statusMap[p.stat]].some(v => String(v || '').toLowerCase().includes(t)));
        if (initialFilter?.status) L = L.filter(p => p.stat === initialFilter.status);
        if (initialFilter?.prazo === 'alerta') L = L.filter(p => p.prazo && p.stat !== 'finalizado' && p.stat !== 'arquivado' && diffDays(todayUTC(), parse(p.prazo)) <= 5 && diffDays(todayUTC(), parse(p.prazo)) >= 0);
        if (initialFilter?.prazo === 'vencido') L = L.filter(p => p.prazo && p.stat !== 'finalizado' && p.stat !== 'arquivado' && diffDays(todayUTC(), parse(p.prazo)) < 0);
        if (initialFilter?.month !== undefined) L = L.filter(p => p.ent && parse(p.ent).getUTCMonth() === initialFilter.month);
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
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text-muted); padding:2rem;">Nenhum processo encontrado.</td></tr>`;
            mobileContainer.innerHTML = `<p style="text-align:center; color:var(--text-muted); padding:2rem;">Nenhum processo encontrado.</p>`;
        } else {
            const pageItems = L.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
            pageItems.forEach(p => {
                const sTxt = statusMap[p.stat] || p.stat;
                // Render Table Row
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>
                        <div style="font-weight: 700; color: var(--text-primary);">${p.num}</div>
                        <div>${p.int}</div>
                    </td>
                    <td>${p.obj || '—'}</td>
                    <td style="text-align:center"><span class="status ${p.stat}">${sTxt}</span></td>
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

                // Render Mobile Card
                const card = document.createElement('div');
                card.className = 'proc-card';
                card.innerHTML = `
                    <div class="proc-card-header">
                        <span class="num">${p.num}</span>
                        <span class="status ${p.stat}">${sTxt}</span>
                    </div>
                    <div class="proc-card-body">
                        <div class="item"><strong>Interessado:</strong> ${p.int}</div>
                        <div class="item"><strong>Objeto:</strong> ${p.obj || '—'}</div>
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
    
    q.oninput = () => draw(true); ord.onchange = () => draw(true);
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
            const id = Number(delBtn.dataset.delProc);
            if (confirm('Tem certeza que deseja excluir este processo?')) {
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
      optionsArray.forEach(s => selectElement.innerHTML += `<option value="${s}">${s}</option>`);
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
        
        const idx = DB.findIndex(p => p.id == rec.id);
        if (idx > -1) {
            rec.docId = DB[idx].docId; // Preserva o docId existente ao editar
            DB[idx] = rec;
        }
        else DB.unshift(rec);
        
        await dbHelper.put('processos', rec);
        m.style.display = 'none';
        renderProc(true);
        renderDashboard();
        showToast('Processo salvo com sucesso!');
    };
    del.onclick = async () => {
        const idVal = Number(form.elements.id.value);
        if (!idVal) return;
        if (confirm('Tem certeza?')) {
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
    $('#view_proc_title').textContent = `Detalhes do Processo ${p.num}`;
    const content = $('#view-details-content');

    const diasTramitacao = (p.ent) ? `${diffDays(parse(p.ent), p.saida ? parse(p.saida) : todayUTC())} dia(s)` : '—';
    
    content.innerHTML = `
      <div class="view-section">
        <h4>Identificação</h4>
        <div class="view-grid">
          <div class="view-item"><strong>Nº Processo</strong><p>${p.num || '—'}</p></div>
          <div class="view-item"><strong>Tipo</strong><p>${p.tipo === 'administrativo' ? 'Administrativo' : 'Judicial'}</p></div>
          <div class="view-item" style="grid-column: 1 / -1;"><strong>Interessado</strong><p>${p.int || '—'}</p></div>
          <div class="view-item" style="grid-column: 1 / -1;"><strong>Objeto</strong><p>${p.obj || '—'}</p></div>
          <div class="view-item" style="grid-column: 1 / -1;"><strong>Ação Tomada</strong><p>${p.acao || '—'}</p></div>
        </div>
      </div>
      <div class="view-section">
        <h4>Tramitação e Parecer</h4>
        <div class="view-grid">
          <div class="view-item"><strong>Status</strong><p><span class="status ${p.stat}">${statusMap[p.stat] || '—'}</span></p></div>
          <div class="view-item"><strong>Prazo Final</strong><p>${fmtBR(p.prazo)}</p></div>
          <div class="view-item"><strong>Setor de Origem</strong><p>${p.setorOrigem || '—'}</p></div>
          <div class="view-item"><strong>Destino Final</strong><p>${p.dest || '—'}</p></div>
          <div class="view-item"><strong>Data de Entrada</strong><p>${fmtBR(p.ent)}</p></div>
          <div class="view-item"><strong>Data de Saída</strong><p>${fmtBR(p.saida)}</p></div>
          <div class="view-item"><strong>Dias de Tramitação</strong><p>${diasTramitacao}</p></div>
          <div class="view-item" style="grid-column: 1 / -1;">
            <strong>Parecer Vinculado</strong>
            <div id="view-parecer-details" style="display: flex; align-items: center; gap: 1rem; margin-top: 0.5rem;">
                <!-- O conteúdo será preenchido pelo JavaScript -->
            </div>
            <input type="file" id="anexarParecerFile" class="sr-only" accept=".doc,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document">
          </div>
        </div>
      </div>
    `;
    
    // NOVA LÓGICA PARA GERENCIAR O PARECER
    const parecerContainer = $('#view-parecer-details');
    if (p.docId) {
        const parecerDoc = getDoc(p.docId);
        if (parecerDoc) {
            const currentVersion = getCurrentVersion(parecerDoc.id);
            parecerContainer.innerHTML = `
                <p style="margin:0; font-weight: 600;">${parecerDoc.nomePrincipal}</p>
                <button class="btn secondary" data-download-version="${currentVersion.id}">Ver Parecer</button>
                <button class="btn" data-versions-for="${parecerDoc.id}">Histórico</button>
            `;
            // Adiciona listeners para os botões recém-criados
            parecerContainer.querySelector('[data-download-version]').onclick = (e) => { const v = getVersion(Number(e.target.dataset.downloadVersion)); if(v) handleDownload(v.data, v.nomeArquivo); };
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
    
    // LÓGICA PARA O INPUT DE ARQUIVO
    $('#anexarParecerFile').onchange = async (e) => {
        const file = e.target.files[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = async (ev) => {
            const docId = Date.now();
            const newDoc = { id: docId, nomePrincipal: file.name, criadoEm: new Date().toISOString(), idVersaoAtual: null };
            const versionId = Date.now() + 1; // Garante ID único
            const newVersion = { id: versionId, idDocumento: docId, versao: 1, nomeArquivo: file.name, data: ev.target.result, adicionadoEm: new Date().toISOString() };
            newDoc.idVersaoAtual = versionId;

            DB_DOCS.push(newDoc); DB_VERSOES.push(newVersion);
            await dbHelper.put('documentos', newDoc);
            await dbHelper.put('versoes', newVersion);

            p.docId = docId; await dbHelper.put('processos', p);
            
            showToast('Parecer anexado e vinculado com sucesso!', 'success');
            openProcDetails(id); // Reabre o modal para refletir a mudança
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

    modal.style.display = 'flex';
    $$('[data-close-view]').forEach(b => b.onclick = () => modal.style.display = 'none');

    $('#btnGerarPdf').onclick = async () => {
        const selectedEmissorId = $('#pdf_emissor_select_view').value;
        generateProcessPDF(id, selectedEmissorId);
    };
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

            drawSection('DADOS DO PROCESSO', () => { drawDataRow('Nº DO PROCESSO:', p.num); drawDataRow('TIPO:', p.tipo === 'administrativo' ? 'Administrativo' : 'Judicial'); drawDataRow('SETOR DE ORIGEM:', p.setorOrigem); drawDataRow('DESTINO:', p.dest); drawDataRow('INTERESSADO:', p.int); });
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
        const headers = ['Nº Processo', 'Interessado', 'Tipo', 'Status', 'Objeto', 'Ação Tomada', 'Data Entrada', 'Prazo Final', 'Data Saída'];
        const rows = data.map(p => [ `"${p.num || ''}"`, `"${p.int || ''}"`, `"${p.tipo || ''}"`, `"${statusMap[p.stat] || ''}"`, `"${(p.obj || '').replace(/"/g, '""')}"`, `"${(p.acao || '').replace(/"/g, '""')}"`, `"${p.ent ? fmtBR(p.ent) : ''}"`, `"${p.prazo ? fmtBR(p.prazo) : ''}"`, `"${p.saida ? fmtBR(p.saida) : ''}"` ].join(','));
        const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows].join('\n');
        const link = document.createElement("a"); link.setAttribute("href", encodeURI(csvContent)); link.setAttribute("download", "processos.csv");
        document.body.appendChild(link); link.click(); document.body.removeChild(link); showToast('Dados exportados para CSV!');
    }

    async function exportXLSX(data) {
        showToast('Iniciando exportação para Excel...', 'info');
        try {
            if (typeof XLSX === 'undefined') throw new Error('Biblioteca XLSX não carregada.');
            const dataForSheet = data.map(p => ({
                'Nº Processo': p.num || '', 'Interessado': p.int || '', 'Tipo': p.tipo ? (p.tipo.charAt(0).toUpperCase() + p.tipo.slice(1)) : '', 'Status': statusMap[p.stat] || '', 'Objeto': p.obj || '', 'Entrada': p.ent ? fmtBR(p.ent) : '', 'Prazo': p.prazo ? fmtBR(p.prazo) : '', 'Saída': p.saida ? fmtBR(p.saida) : '', 'Dias Tramit.': (p.ent && p.saida) ? diffDays(parse(p.ent), parse(p.saida)) : (p.ent ? diffDays(parse(p.ent), todayUTC()) : '')
            }));
            const worksheet = XLSX.utils.json_to_sheet(dataForSheet);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Processos');
            XLSX.writeFile(workbook, 'processos.xlsx');
            showToast('Exportação para Excel concluída!');
        } catch (error) { console.error("Erro ao exportar para Excel:", error); showToast(error.message || 'Erro ao exportar para Excel.', 'danger'); }
    }
  
  // ===== Lógica de Leis =====
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
      if (leisFiltradas.length === 0) { grid.innerHTML = `<p style="grid-column: 1 / -1; text-align: center; color: var(--text-muted);">Nenhuma lei encontrada.</p>`; return; }
      leisFiltradas.forEach(lei => {
          const card = document.createElement('div'); card.className = 'card lei-card';
          card.innerHTML = `<div class="lei-card-header">${lei.tipo} Nº ${lei.numero}/${lei.ano}</div><p class="lei-card-ementa">${lei.ementa}</p>
              <div class="lei-card-actions">
                  ${lei.link ? `<a href="${lei.link}" target="_blank" class="btn secondary">Ver Link</a>` : ''}
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

  // ===== Lógica de Configurações =====
  function openUserModal(mode, id = null) {
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
        if (isNew && !formData.get('pass')) { showToast('Senha é obrigatória para novos usuários.', 'danger'); return; }
        if (formData.get('pass')) { rec.hashedPassword = simpleHash(formData.get('pass')); }

        const idx = DB_USERS.findIndex(u => u.id == rec.id);
        if (idx > -1) { if (!rec.hashedPassword) rec.hashedPassword = DB_USERS[idx].hashedPassword; DB_USERS[idx] = rec; } else { DB_USERS.push(rec); }
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
    const m = $('#m_emissor'); m.style.display = 'flex'; $('#m_emissor_t').textContent = mode === 'new' ? 'Novo Emissor' : 'Editar Emissor';
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
    DB_USERS.forEach(user => { const item = document.createElement('div'); item.className = 'user-item'; item.innerHTML = `<span>${user.name} (${user.role})</span><div><button class="btn secondary" data-edit-user="${user.id}">Editar</button></div>`; listEl.appendChild(item); });
  }

  function renderEmissores() {
    const listEl = $('#emissorList'); listEl.innerHTML = '';
    DB_EMISSORES.forEach(emissor => { const item = document.createElement('div'); item.className = 'emissor-item'; item.innerHTML = `<span>${emissor.name}</span><div><button class="btn secondary" data-edit-emissor="${emissor.id}">Editar</button></div>`; listEl.appendChild(item); });
  }

  function updateEmissorSelect(){
    const sel = $('#fp_emissor'); if(!sel) return; sel.innerHTML='<option value="">Usuário Logado</option>';
    DB_EMISSORES.forEach(emissor => { const o=document.createElement('option'); o.value = emissor.id; o.textContent = emissor.name; sel.appendChild(o); });
  }

  // ===== Lógica do Calendário =====
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
            const dot = document.createElement('div'); dot.className = `event-dot ${evt.cat}`; dot.textContent = initialsMap[evt.cat] || '?'; dot.title = evt.desc;
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

  // ===== Lógica do Dashboard =====
  let chartInstances = {};
  const statusColorMap = {'pendente': '#ef4444', 'em-analise': '#f59e0b', 'aguardando-documentacao': '#3b82f6', 'em-diligencia': '#8b5cf6', 'finalizado': '#22c55e', 'arquivado': '#64748b'};
  const colorPalette = ['#3b82f6', '#f59e0b', '#22c55e', '#ef4444', '#8b5cf6', '#64748b', '#0ea5e9', '#f97316', '#a16207', '#16a34a'];
  const mesesMap = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const sMapKeys = Object.keys(statusMap);
   function getChartConfigs(data) {
    const isDark = CFG.theme === 'dark', gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)', textColor = isDark ? '#f8fafc' : '#1a202c', cardColor = getComputedStyle(document.body).getPropertyValue('--card-bg').trim();
    Chart.defaults.color = textColor; Chart.defaults.font.family = "'Inter', sans-serif";
    const labels = mesesMap, dadosAdm = Array(12).fill(0), dadosJud = Array(12).fill(0);
    data.forEach(p => { if(p.ent){ const m = parse(p.ent).getUTCMonth(); if(p.tipo==='administrativo')dadosAdm[m]++; else dadosJud[m]++; }});
    const sCounts={}; data.forEach(p=>sCounts[p.stat]=(sCounts[p.stat]||0)+1);
    const entradasConfig = { type: 'line', data: { labels, datasets: [{ label: 'Administrativo', data: dadosAdm, borderColor: colorPalette[0], backgroundColor: 'rgba(59, 130, 246, 0.1)', tension: 0.3, fill: true },{ label: 'Judicial', data: dadosJud, borderColor: colorPalette[1], backgroundColor: 'rgba(245, 158, 11, 0.1)', tension: 0.3, fill: true }] }, options: { responsive: true, maintainAspectRatio: false, scales: { y: { grid: { color: gridColor, drawBorder: false } }, x: { grid: { display: false } } }, onClick: (e, els) => { if(els.length > 0) showTab('proc', { filterBy: { month: els[0].index } }) } }};
    const statusConfig = { type: 'doughnut', data: { labels: Object.values(statusMap), datasets: [{ data: sMapKeys.map(k=>sCounts[k]||0), backgroundColor: sMapKeys.map(key => statusColorMap[key]), borderWidth: 2, borderColor: cardColor }] }, options: { responsive: true, maintainAspectRatio: false, onClick: (e, els) => { if (els.length > 0) { const statusKey = sMapKeys[els[0].index]; showTab('proc', { filterBy: { status: statusKey } }) } } }};
    
    const pareceresPorMes = Array(12).fill(0);
    DB.forEach(p => {
        if (p.docId && p.saida) { // Conta qualquer processo com parecer e data de saída
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
          li.innerHTML=`<div class="prazo-date"><span class="month">${mes}</span><span class="day">${dia}</span></div><div class="prazo-info"><span class="type type-${item.tipo}">${item.tipo.toUpperCase()}</span><div class="desc">${item.desc}</div></div>`;
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
    alertas.forEach(item => { const li = document.createElement('li'); li.innerHTML = `<div class="prazo-info"><span class="type">${item.tipo.toUpperCase()}</span><div class="desc">${item.desc}</div></div>`; listEl.appendChild(li); });
  }
  function renderDashboard() {
      const kpiData = calculateGlobalStats(); const kpiContainer = $('#dashboard-kpis'); if (!kpiContainer) return;
      kpiContainer.innerHTML = `
        <div class="kpi" data-kpi-filter="total" style="border-left-color: #2196F3;"><h4>Total 📊</h4><div class="v">${kpiData.total}</div></div>
        <div class="kpi" data-kpi-filter="pendente" style="border-left-color: #FFEB3B;"><h4>Pendentes ⏳</h4><div class="v">${kpiData.pend}</div></div>
        <div class="kpi" data-kpi-filter="em-analise" style="border-left-color: #FF9800;"><h4>Em Análise 🔎</h4><div class="v">${kpiData.anal}</div></div>
        <div class="kpi" data-kpi-filter="finalizado" style="border-left-color: #4CAF50;"><h4>Finalizados ✅</h4><div class="v">${kpiData.fin}</div></div>
        <div class="kpi" data-kpi-filter="alerta" style="border-left-color: #FF7043;"><h4>Vencendo ≤5d ⏰</h4><div class="v">${kpiData.alert}</div></div>
        <div class="kpi" data-kpi-filter="vencido" style="border-left-color: #F44336;"><h4>Vencidos ❌</h4><div class="v">${kpiData.venc}</div></div>
      `;
      kpiContainer.onclick = (e) => {
          const kpi = e.target.closest('[data-kpi-filter]'); if(!kpi) return;
          const filter = kpi.dataset.kpiFilter, filterBy = {};
          if (filter === 'total') { showTab('proc'); return; }
          if (filter === 'alerta' || filter === 'vencido') { filterBy.prazo = filter; } else { filterBy.status = filter; }
          showTab('proc', { filterBy });
      };
      const chartConfigs = getChartConfigs(DB); renderCharts(chartConfigs); renderProximosPrazos(); renderAlertasInteligentes(); updateAllNotifications();
  }
  
    // ===== Lógica de Notificações =====
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
                li.innerHTML = `<div class="icon-wrapper">${ICONS[item.type]}</div><div class="notification-content" data-nav-type="${item.navInfo.type}" data-nav-value="${item.navInfo.num || item.navInfo.date}"><div class="title">${item.title}</div><div class="subtitle">${item.subtitle}</div></div><button class="notification-close-btn" title="Dispensar"><svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"></path></svg></button>`;
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

  // ===== Lógica de Tema (Modo Escuro) =====
  function applyTheme(theme) {
    document.body.dataset.theme = theme;
    $('.sun').style.display = theme === 'dark' ? 'none' : 'block';
    $('.moon').style.display = theme === 'dark' ? 'block' : 'none';
    if (Object.keys(chartInstances).length > 0 && sections.dashboard.style.display !== 'none') {
        const chartConfigs = getChartConfigs(DB); renderCharts(chartConfigs);
    }
  }

  async function initTheme() {
    const themeToggleButton = $('#theme-toggle-btn');
    const isDark = CFG.theme === 'dark';
    
    themeToggleButton.setAttribute('aria-pressed', String(isDark));
    themeToggleButton.setAttribute('aria-label', isDark ? 'Ativar modo claro' : 'Ativar modo escuro');
    applyTheme(CFG.theme);

    themeToggleButton.addEventListener('click', async () => {
        const isPressed = themeToggleButton.getAttribute('aria-pressed') === 'true';
        CFG.theme = !isPressed ? 'dark' : 'light';
        applyTheme(CFG.theme);
        themeToggleButton.setAttribute('aria-pressed', String(!isPressed));
        themeToggleButton.setAttribute('aria-label', !isPressed ? 'Ativar modo claro' : 'Ativar modo escuro');
        await saveCFG();
    });
  }
  
  // ===== MELHORIA: Lógica do Menu Mobile, Header Compacto e Acessibilidade =====
  function setupEnhancedNav() {
    // Header compacto ao rolar
    const mainContent = $('.main-content');
    const appHeader = $('.app-header');
    if (mainContent && appHeader) {
        mainContent.addEventListener('scroll', () => {
            appHeader.classList.toggle('header-compact', mainContent.scrollTop > 8);
        }, { passive: true });
    }

    // Lógica do menu mobile
    const focusableElementsSelector = 'a[href], button:not([disabled])';
    let focusableElements = [], firstFocusableElement, lastFocusableElement;

    function handleFocusTrap(e) {
        if (e.key !== 'Tab') return;
        if (e.shiftKey) { // Shift + Tab
            if (document.activeElement === firstFocusableElement) { lastFocusableElement.focus(); e.preventDefault(); }
        } else { // Tab
            if (document.activeElement === lastFocusableElement) { firstFocusableElement.focus(); e.preventDefault(); }
        }
    }
    
    window.openMobileMenu = function() {
        topNav.classList.add('mobile-open');
        overlay.classList.add('active');
        mobileMenuToggle.setAttribute('aria-expanded', 'true');
        
        focusableElements = Array.from(topNav.querySelectorAll(focusableElementsSelector));
        firstFocusableElement = focusableElements[0];
        lastFocusableElement = focusableElements[focusableElements.length - 1];
        setTimeout(() => firstFocusableElement?.focus(), 100);
        document.addEventListener('keydown', handleFocusTrap);
    }
    
    window.closeMobileMenu = function() {
        topNav.classList.remove('mobile-open');
        overlay.classList.remove('active');
        mobileMenuToggle.setAttribute('aria-expanded', 'false');
        document.removeEventListener('keydown', handleFocusTrap);
        mobileMenuToggle.focus();
    }
    
    mobileMenuToggle.onclick = () => {
        const isMenuOpen = topNav.classList.contains('mobile-open');
        if (isMenuOpen) closeMobileMenu(); else openMobileMenu();
    };
    
    overlay.onclick = closeMobileMenu;

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && topNav.classList.contains('mobile-open')) {
            closeMobileMenu();
        }
    });
  }
  
  // ===== Event Listeners Centralizados =====
  function setupEventListeners() {
    btnEntrar.onclick = tentarEntrar;
    loginOverlay.onkeydown = (e) => { if (e.key === 'Enter') tentarEntrar(); };
    btnSair.onclick = showLogin;

    setupEnhancedNav(); // Inicializa as novas funcionalidades de navegação

    $$('.tab').forEach(b => b.onclick = (e) => { e.preventDefault(); showTab(b.dataset.tab); });
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

    // ===== AÇÕES AVANÇADAS E BACKUP =====
    $('#btnHardReset').onclick = async () => {
        if (confirm('ATENÇÃO!\n\nEsta ação apagará TODOS os dados do JurisControl neste navegador (processos, usuários, documentos, etc.).\n\nEsta ação é IRREVERSÍVEL.\n\nDeseja continuar?')) {
            try {
                if (db) {
                    db.close(); // Fecha a conexão antes de deletar
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

    // Backup e Restauração
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
                
                if (db) db.close(); // Fecha a conexão atual para evitar bloqueios

                // Espera um pouco para garantir que a conexão foi fechada
                setTimeout(async () => {
                    await dbHelper.init(); // Reabre a conexão

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
        await loadAllData();
        await initTheme();
          await initializeUsers();
          setupEventListeners();
          onAuthStateChanged(auth, (user) => {
              if (user) {
                  const localUser = DB_USERS.find(u => u.login === user.email) || { name: user.email };
                  showApp(localUser);
              } else {
                  showLogin();
              }
          });
      } catch (error) {
          console.error("Falha na inicialização do aplicativo:", error);
          document.body.innerHTML = '<h1>Ocorreu um erro crítico ao carregar a aplicação.</h1>';
      }
    }

  init();
});