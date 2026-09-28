/*
 * js/motion.js — camada de movimento do JurisControl (v2).
 *
 * Poucos momentos, bem coreografados, em vez de efeito em tudo:
 *  1. Marcador da barra lateral que desliza até a aba ativa.
 *  2. Troca de aba: conteúdo sobe em cascata; KPIs contam até o valor.
 *  3. Troca de tema: revelação circular a partir do botão de tema.
 *  4. Login: botão com indicador de carregamento e saída em dissolução.
 *
 * Princípios:
 *  - É opcional. Todo o CSS da camada fica atrás da classe `jc-motion` no
 *    <html>, que só este arquivo liga. Se ele não carregar, o app fica
 *    exatamente como era, sem nada preso invisível.
 *  - Liga/desliga por dispositivo em Configurações → Aparência
 *    (localStorage). `prefers-reduced-motion: reduce` desliga sempre.
 *  - Não conhece o estado do app: observa o DOM. O js/app.js só chama
 *    JCMotion.hideLogin e JCMotion.themeTransition, ambos com fallback.
 *  - Nunca anima `transform` na própria `.sidebar`: abaixo de 992px ela usa
 *    `transform` para o menu-gaveta (foi o bug da versão anterior).
 */
(function () {
    'use strict';

    var CHAVE = 'jc-motion';
    var root = document.documentElement;
    var reduceQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;

    function preferenciaLigada() {
        try { return localStorage.getItem(CHAVE) !== 'off'; } catch { return true; }
    }
    function ativo() {
        return preferenciaLigada() && !(reduceQuery && reduceQuery.matches);
    }
    function sincronizarClasse() {
        root.classList.toggle('jc-motion', ativo());
    }
    // Liga já, antes do primeiro paint do app, para a entrada não "pular".
    sincronizarClasse();
    if (reduceQuery && reduceQuery.addEventListener) reduceQuery.addEventListener('change', sincronizarClasse);

    var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
    var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };

    /* ---------------------------------------------------------------
     * 1. Marcador deslizante da barra lateral
     *
     * Um único elemento (.jc-nav-ink) atrás dos links. Ele é filho da
     * <ul>, não da .sidebar, então o menu-gaveta segue intacto. offsetTop
     * ignora transforms, então a posição vale com a gaveta aberta ou não.
     * ------------------------------------------------------------- */
    function ligarMarcador() {
        var nav = $('#sidebar-nav');
        var ul = nav && $('ul', nav);
        if (!ul) return;

        var ink = document.createElement('span');
        ink.className = 'jc-nav-ink';
        ink.setAttribute('aria-hidden', 'true');
        ul.insertBefore(ink, ul.firstChild);
        nav.classList.add('has-ink');

        function posicionar(instantaneo) {
            var ativa = $('a.tab.active', ul);
            if (!ativa) { ink.style.opacity = '0'; return; }
            if (instantaneo) ink.classList.add('no-anim');
            ink.style.opacity = '1';
            ink.style.height = ativa.offsetHeight + 'px';
            // A <ul> é position: relative, então offsetTop já é relativo a ela.
            ink.style.transform = 'translateY(' + ativa.offsetTop + 'px)';
            if (instantaneo) {
                void ink.offsetWidth;
                ink.classList.remove('no-anim');
            }
        }

        posicionar(true);
        new MutationObserver(function () { posicionar(false); })
            .observe(ul, { attributes: true, attributeFilter: ['class'], subtree: true });
        // Colapsar/expandir a barra muda a altura dos links: reposiciona seco.
        if (window.ResizeObserver) new ResizeObserver(function () { posicionar(true); }).observe(ul);
    }

    /* ---------------------------------------------------------------
     * 2. Troca de aba
     *
     * O js/app.js já recoloca `.section-enter` na seção exibida. O CSS usa
     * essa classe para a cascata; aqui numeramos os blocos (--jc-i) e
     * tiramos a classe quando a entrada acaba — senão qualquer re-render
     * posterior (salvar um processo, buscar) repetiria a coreografia.
     * ------------------------------------------------------------- */
    var DURACAO_ENTRADA = 1100;

    // Os "blocos" que sobem em cascata: filhos de primeiro nível da seção,
    // descendo para dentro de grades/colunas que só agrupam cartões. Os KPIs
    // entram um a um, e não como uma faixa só.
    function blocosDe(el) {
        if (el.classList.contains('dash-kpis')) return $$(':scope > .kpi', el);
        if (!el.classList.contains('card') && $(':scope > .card', el)) {
            return Array.prototype.concat.apply([], $$(':scope > *', el).map(blocosDe));
        }
        return [el];
    }
    function blocosDaSecao(secao) {
        return Array.prototype.concat.apply([], $$(':scope > *', secao).map(blocosDe));
    }

    function prepararSecao(secao) {
        blocosDaSecao(secao).forEach(function (el, i) {
            el.classList.add('jc-rise');
            el.style.setProperty('--jc-i', String(Math.min(i, 9)));
        });
        clearTimeout(secao._jcTimer);
        secao._jcTimer = setTimeout(function () {
            secao.classList.remove('section-enter');
        }, DURACAO_ENTRADA);
    }

    function observarSecoes() {
        var secoes = $$('main > section');
        var obs = new MutationObserver(function (muts) {
            muts.forEach(function (m) {
                var s = m.target;
                if (s.classList.contains('section-enter') && (m.oldValue || '').indexOf('section-enter') === -1) {
                    if (ativo()) prepararSecao(s);
                }
            });
        });
        secoes.forEach(function (s) {
            obs.observe(s, { attributes: true, attributeFilter: ['class'], attributeOldValue: true });
        });
    }

    /* Contador dos KPIs: só na entrada da aba, não a cada re-render. */
    function contarAte(el, alvo) {
        var inicio = null;
        var DUR = 900;
        function passo(agora) {
            if (inicio === null) inicio = agora;
            var t = Math.min((agora - inicio) / DUR, 1);
            var e = 1 - Math.pow(1 - t, 4); // easeOutQuart: assenta devagar
            el.textContent = String(Math.round(alvo * e));
            if (t < 1) requestAnimationFrame(passo);
            else el.textContent = String(alvo);
        }
        requestAnimationFrame(passo);
    }

    function observarKpis() {
        var container = $('#dashboard-kpis');
        var secao = $('#secDashboard');
        if (!container || !secao) return;
        new MutationObserver(function () {
            if (!ativo() || !secao.classList.contains('section-enter')) return;
            $$('.kpi .v', container).forEach(function (el, i) {
                var alvo = parseInt(el.textContent, 10);
                if (!isFinite(alvo) || alvo <= 0 || String(alvo) !== el.textContent.trim()) return;
                el.textContent = '0';
                setTimeout(function () { contarAte(el, alvo); }, 60 + i * 55);
            });
        }).observe(container, { childList: true });
    }

    /* Luz que acompanha o cursor nos cartões clicáveis (KPIs e radar). */
    function ligarHoloforte() {
        document.addEventListener('pointermove', function (e) {
            if (!ativo() || e.pointerType !== 'mouse') return;
            var alvo = e.target.closest && e.target.closest('.kpi, .radar-day');
            if (!alvo) return;
            var r = alvo.getBoundingClientRect();
            alvo.style.setProperty('--jc-mx', (e.clientX - r.left) + 'px');
            alvo.style.setProperty('--jc-my', (e.clientY - r.top) + 'px');
        }, { passive: true });
    }

    /* Gráficos: barras crescem em sequência, da esquerda para a direita. */
    function configurarGraficos() {
        if (!window.Chart || !Chart.defaults) return;
        if (!ativo()) { Chart.defaults.animation = false; return; }
        Chart.defaults.animation = Object.assign({}, Chart.defaults.animation, {
            duration: 800,
            easing: 'easeOutQuart',
            delay: function (ctx) {
                return ctx.type === 'data' && ctx.mode === 'default' ? ctx.dataIndex * 35 + ctx.datasetIndex * 90 : 0;
            }
        });
    }

    /* ---------------------------------------------------------------
     * 3. Troca de tema com revelação circular (View Transitions API)
     *
     * Chamado pelo js/app.js. `aplicar` precisa ser síncrono o bastante
     * para a captura: não esperamos o salvamento no banco.
     * ------------------------------------------------------------- */
    function themeTransition(origem, aplicar) {
        if (!ativo() || !document.startViewTransition) { aplicar(); return; }
        var ref = $('#theme-toggle-btn') || origem;
        var r = ref ? ref.getBoundingClientRect() : { left: innerWidth, top: 0, width: 0, height: 0 };
        var x = r.left + r.width / 2;
        var y = r.top + r.height / 2;
        var raio = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
        // Fecha o menu de tema na hora, para ele não ficar congelado no
        // "antes" da captura enquanto o círculo abre.
        var menu = $('#theme-menu');
        if (menu) {
            menu.style.transition = 'none';
            menu.classList.remove('active');
            void menu.offsetWidth;
            menu.style.transition = '';
        }
        root.classList.add('jc-vt-theme');
        var vt;
        try {
            vt = document.startViewTransition(function () { aplicar(); });
        } catch {
            root.classList.remove('jc-vt-theme');
            aplicar();
            return;
        }
        vt.ready.then(function () {
            root.animate(
                { clipPath: ['circle(0px at ' + x + 'px ' + y + 'px)', 'circle(' + raio + 'px at ' + x + 'px ' + y + 'px)'] },
                { duration: 650, easing: 'cubic-bezier(0.65, 0, 0.35, 1)', pseudoElement: '::view-transition-new(root)' }
            );
        }).catch(function () { /* transição pulada: tema já aplicado */ });
        vt.finished.finally(function () { root.classList.remove('jc-vt-theme'); });
    }

    /* ---------------------------------------------------------------
     * 4. Login
     * ------------------------------------------------------------- */
    function observarLogin() {
        var btn = $('#btnEntrar');
        if (!btn) return;
        // O app desabilita o botão enquanto autentica: vira "carregando".
        new MutationObserver(function () {
            btn.classList.toggle('is-loading', btn.disabled);
        }).observe(btn, { attributes: true, attributeFilter: ['disabled'] });
    }

    /* Chamado pelo js/app.js ao autenticar: dissolve o login e dispara a
       entrada do app. Sempre esconde o overlay, com ou sem animação. */
    function hideLogin(overlay) {
        if (!overlay) return;
        var layout = $('.app-layout');
        if (!ativo() || overlay.style.display === 'none') { overlay.style.display = 'none'; return; }
        overlay.classList.add('jc-leaving');
        if (layout) layout.classList.add('jc-app-enter');
        var feito = false;
        function encerrar() {
            if (feito) return;
            feito = true;
            overlay.classList.remove('jc-leaving');
            overlay.style.display = 'none';
        }
        overlay.addEventListener('animationend', function (e) { if (e.target === overlay) encerrar(); });
        setTimeout(encerrar, 700); // garante o fim mesmo sem animationend
        setTimeout(function () { if (layout) layout.classList.remove('jc-app-enter'); }, 1400);
    }

    /* ---------------------------------------------------------------
     * Preferência em Configurações → Aparência
     * ------------------------------------------------------------- */
    function ligarPreferencia() {
        var chk = $('#cfgAnimacoes');
        if (!chk) return;
        chk.checked = preferenciaLigada();
        var nota = $('#cfgAnimacoesNota');
        function atualizarNota() {
            if (!nota) return;
            nota.textContent = reduceQuery && reduceQuery.matches
                ? 'Seu sistema pede movimento reduzido, então as animações ficam desligadas mesmo com esta opção marcada.'
                : '';
        }
        atualizarNota();
        chk.addEventListener('change', function () {
            try { localStorage.setItem(CHAVE, chk.checked ? 'on' : 'off'); } catch { /* sem storage: vale só nesta visita */ }
            sincronizarClasse();
            configurarGraficos();
            atualizarNota();
        });
    }

    /* ------------------------------------------------------------- */
    function iniciar() {
        try { ligarMarcador(); } catch { /* segue sem marcador */ }
        try { observarSecoes(); } catch { /* segue sem cascata */ }
        try { observarKpis(); } catch { /* segue sem contador */ }
        try { ligarHoloforte(); } catch { /* segue sem luz */ }
        try { configurarGraficos(); } catch { /* segue com a animação padrão */ }
        try { observarLogin(); } catch { /* segue sem indicador */ }
        try { ligarPreferencia(); } catch { /* segue sem a opção */ }
    }

    window.JCMotion = { hideLogin: hideLogin, themeTransition: themeTransition, ativo: ativo };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', iniciar);
    } else {
        iniciar();
    }
})();
