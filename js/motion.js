/*
 * js/motion.js — camada de movimento do JurisControl.
 *
 * Cuida das animações que dependem de saber *quando* algo mudou na tela:
 * cascata das linhas de tabela, contador dos KPIs, ripple nos botões,
 * shake no erro de login, sino que toca quando chega notificação.
 *
 * Princípios:
 *  - É opcional. Se este arquivo não carregar, o app funciona igual, só
 *    sem os encadeamentos dinâmicos (o CSS já cobre hover e entradas).
 *  - Não conhece o estado do app: só observa o DOM. Assim não precisa
 *    andar de mãos dadas com o js/app.js.
 *  - Respeita `prefers-reduced-motion` — quando ligado, tudo vira no-op.
 */
(function () {
    'use strict';

    var reduceQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    function reduzMovimento() { return !!(reduceQuery && reduceQuery.matches); }

    var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
    var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };

    /* ---------------------------------------------------------------
     * Ripple nos botões
     * ------------------------------------------------------------- */
    function ligarRipple() {
        document.addEventListener('pointerdown', function (e) {
            if (reduzMovimento()) return;
            var btn = e.target.closest && e.target.closest('.btn');
            if (!btn || btn.disabled || btn.classList.contains('is-loading')) return;

            var rect = btn.getBoundingClientRect();
            var tamanho = Math.max(rect.width, rect.height);
            var ink = document.createElement('span');
            ink.className = 'jc-ripple-ink';
            ink.style.width = ink.style.height = tamanho + 'px';
            ink.style.left = (e.clientX - rect.left - tamanho / 2) + 'px';
            ink.style.top = (e.clientY - rect.top - tamanho / 2) + 'px';
            btn.appendChild(ink);
            ink.addEventListener('animationend', function () { ink.remove(); });
            // Rede de segurança: se o botão sumir antes do fim da animação,
            // o animationend nunca dispara e o nó ficaria pendurado.
            setTimeout(function () { ink.remove(); }, 900);
        }, true);
    }

    /* ---------------------------------------------------------------
     * Contador animado dos KPIs (0 → valor)
     * ------------------------------------------------------------- */
    function contarAte(el, alvo, duracao) {
        var inicio = null;
        var partida = 0;
        function passo(agora) {
            if (inicio === null) inicio = agora;
            var t = Math.min((agora - inicio) / duracao, 1);
            // easeOutCubic: rápido no começo, assenta no fim.
            var eased = 1 - Math.pow(1 - t, 3);
            el.textContent = String(Math.round(partida + (alvo - partida) * eased));
            if (t < 1) requestAnimationFrame(passo);
            else el.textContent = String(alvo);
        }
        requestAnimationFrame(passo);
    }

    function animarKpis(container) {
        if (reduzMovimento()) return;
        $$('.kpi .v', container).forEach(function (el) {
            var alvo = parseInt(String(el.textContent).replace(/\D/g, ''), 10);
            if (!isFinite(alvo) || alvo <= 0) return;
            el.textContent = '0';
            contarAte(el, alvo, 750);
        });
    }

    function observarKpis() {
        var container = $('#dashboard-kpis');
        if (!container) return;
        animarKpis(container);
        new MutationObserver(function () { animarKpis(container); })
            .observe(container, { childList: true });
    }

    /* ---------------------------------------------------------------
     * Cascata nas linhas de tabela
     *
     * Re-renders em rajada (busca ao digitar, por exemplo) não recebem
     * cascata: repetir a animação a cada tecla vira pisca-pisca.
     * ------------------------------------------------------------- */
    var ULTIMO_RENDER = new WeakMap();
    var LIMITE_CASCATA = 12;

    function cascatearLinhas(tbody) {
        if (reduzMovimento()) return;
        var agora = Date.now();
        var anterior = ULTIMO_RENDER.get(tbody) || 0;
        ULTIMO_RENDER.set(tbody, agora);
        if (agora - anterior < 400) return; // rajada: entrega sem animar

        var linhas = tbody.children;
        for (var i = 0; i < linhas.length; i++) {
            var tr = linhas[i];
            tr.style.setProperty('--jc-i', String(Math.min(i, LIMITE_CASCATA)));
            tr.classList.remove('jc-row-in');
            void tr.offsetWidth; // reinicia a animação
            tr.classList.add('jc-row-in');
        }
    }

    function observarTabelas() {
        var observer = new MutationObserver(function (muts) {
            var vistos = [];
            muts.forEach(function (m) {
                var alvo = m.target;
                if (alvo.tagName !== 'TBODY' || vistos.indexOf(alvo) !== -1) return;
                vistos.push(alvo);
                cascatearLinhas(alvo);
            });
        });
        $$('tbody').forEach(function (tbody) {
            observer.observe(tbody, { childList: true });
        });
    }

    /* ---------------------------------------------------------------
     * Cascata dos cartões ao trocar de aba
     *
     * O js/app.js coloca `.section-enter` na seção exibida. Aqui só
     * numeramos os cartões (--jc-i) para o CSS escalonar os atrasos.
     * ------------------------------------------------------------- */
    function numerarCartoes(secao) {
        $$('.card', secao).forEach(function (card, i) {
            card.style.setProperty('--jc-i', String(Math.min(i, 8)));
        });
    }

    function observarSecoes() {
        var secoes = $$('main > section');
        if (!secoes.length) return;
        var observer = new MutationObserver(function (muts) {
            muts.forEach(function (m) {
                if (m.target.classList.contains('section-enter')) numerarCartoes(m.target);
            });
        });
        secoes.forEach(function (sec) {
            numerarCartoes(sec);
            observer.observe(sec, { attributes: true, attributeFilter: ['class'] });
        });
    }

    /* ---------------------------------------------------------------
     * Título da aba: troca com fade
     * ------------------------------------------------------------- */
    function observarTitulo() {
        var titulo = $('#page-title');
        if (!titulo) return;
        new MutationObserver(function () {
            if (reduzMovimento()) return;
            titulo.classList.remove('jc-swap');
            void titulo.offsetWidth;
            titulo.classList.add('jc-swap');
        }).observe(titulo, { childList: true, characterData: true, subtree: true });
    }

    /* ---------------------------------------------------------------
     * Login: spinner no botão, shake no erro, saída suave
     * ------------------------------------------------------------- */
    function observarLogin() {
        var btn = $('#btnEntrar');
        if (btn) {
            // O app desabilita o botão enquanto autentica; usamos isso
            // como sinal de "carregando" sem tocar no js/app.js.
            new MutationObserver(function () {
                btn.classList.toggle('is-loading', btn.disabled);
            }).observe(btn, { attributes: true, attributeFilter: ['disabled'] });
        }

        var erro = $('#loginErro');
        var painel = $('.login-panel');
        if (erro && painel) {
            new MutationObserver(function () {
                if (reduzMovimento()) return;
                var texto = (erro.textContent || '').trim();
                // `.info` é aviso neutro (ex.: "e-mail de recuperação enviado"),
                // não merece o shake de credencial recusada.
                if (!texto || erro.classList.contains('info')) return;
                painel.classList.remove('jc-shake');
                void painel.offsetWidth;
                painel.classList.add('jc-shake');
            }).observe(erro, { childList: true, characterData: true, subtree: true });
        }
    }

    /* Chamado pelo js/app.js ao autenticar: dissolve o login em vez de
       cortar a tela em seco. Retorna sempre, mesmo sem animação. */
    function hideLogin(overlay) {
        if (!overlay) return;
        if (reduzMovimento()) { overlay.style.display = 'none'; return; }
        overlay.classList.add('jc-leaving');
        var encerrar = function () {
            overlay.classList.remove('jc-leaving');
            overlay.style.display = 'none';
        };
        var feito = false;
        var umaVez = function () { if (!feito) { feito = true; encerrar(); } };
        overlay.addEventListener('animationend', umaVez, { once: true });
        setTimeout(umaVez, 600); // garante o fim mesmo sem animationend
    }

    /* ---------------------------------------------------------------
     * Sino de notificações: toca quando aparece contagem nova
     * ------------------------------------------------------------- */
    function observarNotificacoes() {
        var bell = $('#notification-bell');
        var count = $('#notification-count');
        if (!bell || !count) return;

        var anterior = null;
        function checar() {
            var visivel = count.style.display !== 'none';
            var valor = visivel ? (count.textContent || '').trim() : '';
            if (valor !== anterior) {
                anterior = valor;
                if (valor && !reduzMovimento()) {
                    bell.classList.remove('jc-unread');
                    void bell.offsetWidth;
                    bell.classList.add('jc-unread');
                } else {
                    bell.classList.remove('jc-unread');
                }
            }
        }
        checar();
        new MutationObserver(checar).observe(count, {
            attributes: true, attributeFilter: ['style'],
            childList: true, characterData: true, subtree: true
        });

        var lista = $('#notification-list');
        if (lista) {
            new MutationObserver(function () {
                $$('.notification-item', lista).forEach(function (item, i) {
                    item.style.setProperty('--jc-i', String(Math.min(i, 8)));
                });
            }).observe(lista, { childList: true });
        }
    }

    /* ---------------------------------------------------------------
     * Troca de tema sem estalo de cor
     * ------------------------------------------------------------- */
    function observarTema() {
        var body = document.body;
        var timer = null;
        new MutationObserver(function () {
            if (reduzMovimento()) return;
            body.classList.add('jc-theming');
            clearTimeout(timer);
            timer = setTimeout(function () { body.classList.remove('jc-theming'); }, 400);
        }).observe(body, { attributes: true, attributeFilter: ['data-theme'] });
    }

    /* ------------------------------------------------------------- */
    function iniciar() {
        try { ligarRipple(); } catch { /* segue sem ripple */ }
        try { observarKpis(); } catch { /* segue sem contador */ }
        try { observarTabelas(); } catch { /* segue sem cascata */ }
        try { observarSecoes(); } catch { /* segue sem cascata */ }
        try { observarTitulo(); } catch { /* segue sem fade */ }
        try { observarLogin(); } catch { /* segue sem shake */ }
        try { observarNotificacoes(); } catch { /* segue sem sino */ }
        try { observarTema(); } catch { /* segue sem crossfade */ }
    }

    window.JCMotion = { hideLogin: hideLogin, reduzMovimento: reduzMovimento };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', iniciar);
    } else {
        iniciar();
    }
})();
