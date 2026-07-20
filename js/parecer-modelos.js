// js/parecer-modelos.js
// Modelos de parecer por matéria + helpers de montagem do Delta (Quill).
// Bloco de dados/funções PURAS extraído de js/app.js — sem DOM, sem estado do
// closure. Carregado como script global ANTES de js/app.js (padrão do utils.js),
// então PARECER_TEMPLATES, buildParecerDelta, separarTituloEmbutido, etc. ficam
// disponíveis globalmente para o app.js.

// ===== Modelos de parecer por matéria (Frente 1) =====
// Cada modelo gera um "esqueleto" (Quill Delta) já com as seções que aquela
// matéria costuma exigir, e um checklist de pontos a verificar exibido ao
// lado do editor. São modelos INTERNOS (definidos em código), independentes
// dos .docx enviados pelo usuário — não têm custo e padronizam a redação.
// Monta as seções (títulos em negrito) a partir de uma lista de rótulos, com
// uma linha em branco entre elas. O título "PARECER JURÍDICO", o número e o
// "Processo n." NÃO fazem parte do conteúdo: são o cabeçalho fixo do documento
// (renderizado pelo modal e pelas exportações), no padrão do modelo oficial
// da Procuradoria.
function parecerSecoesOps(titulos) {
    const ops = [];
    titulos.forEach(t => { ops.push({ insert: t, attributes: { bold: true } }, { insert: '\n' }, { insert: '\n' }); });
    return ops;
}

// Fecho padrão do parecer (segue o modelo oficial): "É o parecer, s.m.j.",
// local/data e bloco de assinatura centralizado.
function parecerFechoOps() {
    return [
        { insert: 'É o parecer, s.m.j.' }, { insert: '\n' }, { insert: '\n' },
        { insert: 'Duque de Caxias, [dia] de [mês] de [ano].' }, { insert: '\n' }, { insert: '\n' }, { insert: '\n' },
        { insert: '[Nome do(a) Procurador(a)]' }, { insert: '\n', attributes: { align: 'center' } },
        { insert: '[Cargo]' }, { insert: '\n', attributes: { align: 'center' } },
        { insert: 'Matr. [matrícula]' }, { insert: '\n', attributes: { align: 'center' } },
    ];
}

const PARECER_TEMPLATES = [
    {
        id: 'generico', nome: 'Parecer genérico',
        descricao: 'Estrutura padrão: Relatório, Análise Jurídica e Conclusão.',
        secoes: ['I. RELATÓRIO', 'II. DA ANÁLISE JURÍDICA', 'III. CONCLUSÃO'],
        fecho: true,
        checklist: [
            'Delimitar com clareza o objeto do processo/consulta',
            'Indicar a legislação e os atos normativos aplicáveis',
            'Enfrentar as questões controvertidas de forma fundamentada',
            'Concluir de forma objetiva (favorável, desfavorável ou com ressalvas)',
        ],
    },
    {
        id: 'licitacao', nome: 'Licitação e contratação (Lei 14.133/2021)',
        descricao: 'Análise da fase interna/edital ou da contratação direta.',
        secoes: ['I. RELATÓRIO', 'II. DA ANÁLISE JURÍDICA', 'II.1. Regime jurídico aplicável e natureza do objeto', 'II.2. Fundamento legal e requisitos da contratação', 'II.3. Instrução do processo e aderência aos requisitos legais', 'II.4. Dotação orçamentária e compatibilidade financeira', 'III. CONCLUSÃO'],
        fecho: true,
        checklist: [
            'Modalidade/procedimento e fundamento legal (Lei 14.133/2021)',
            'Existência de estudo técnico preliminar, termo de referência e pesquisa de preços',
            'Dotação orçamentária e autorização da autoridade competente',
            'Minuta de edital/contrato conforme art. 92 da Lei 14.133/2021',
            'Se contratação direta: enquadramento da dispensa/inexigibilidade (arts. 74/75) e justificativa de preço',
            'Regularidade fiscal e habilitação do contratado',
        ],
    },
    {
        id: 'aditivo', nome: 'Aditivo / prorrogação contratual',
        descricao: 'Alteração, prorrogação ou reajuste de contrato administrativo.',
        secoes: ['I. RELATÓRIO', 'II. DA ANÁLISE JURÍDICA', 'II.1. Regime jurídico aplicável e natureza do objeto', 'II.2. Fundamento legal da prorrogação e requisitos do art. 107 da Lei nº 14.133/2021', 'II.3. Instrução do processo e aderência aos requisitos legais no caso concreto', 'II.4. Dotação orçamentária e compatibilidade financeira', 'III. CONCLUSÃO'],
        fecho: true,
        checklist: [
            'Vigência atual do contrato e tempestividade do pedido',
            'Fundamento da alteração (arts. 124 a 136 da Lei 14.133/2021)',
            'Limites legais de acréscimo/supressão (25% / 50% para reforma)',
            'Justificativa técnica e manutenção do equilíbrio econômico-financeiro',
            'Comprovação da vantajosidade (no caso de prorrogação)',
            'Regularidade fiscal do contratado e dotação orçamentária',
        ],
    },
    {
        id: 'pessoal', nome: 'Pessoal e servidores',
        descricao: 'Nomeação, cessão, licença, vantagens e regime dos servidores.',
        secoes: ['I. RELATÓRIO', 'II. DA ANÁLISE JURÍDICA', 'II.1. Do enquadramento legal', 'II.2. Da análise do caso concreto', 'III. CONCLUSÃO'],
        fecho: true,
        checklist: [
            'Fundamento no Estatuto dos Servidores e/ou na Lei Orgânica do Município',
            'Existência de cargo/vaga e previsão na lei de criação',
            'Requisitos de investidura e/ou requisitos da vantagem pretendida',
            'Impacto financeiro e observância da LC 101/2000 (LRF)',
            'Competência do órgão para o ato',
        ],
    },
    {
        id: 'legislativo', nome: 'Projeto de lei / processo legislativo',
        descricao: 'Análise de constitucionalidade, competência e técnica legislativa.',
        secoes: ['I. RELATÓRIO', 'II. DA ANÁLISE JURÍDICA', 'II.1. Da constitucionalidade e da competência', 'II.2. Da técnica legislativa', 'III. CONCLUSÃO'],
        fecho: true,
        checklist: [
            'Competência legislativa do Município (art. 30 da CF)',
            'Iniciativa correta da proposição (reserva de iniciativa)',
            'Compatibilidade com a Constituição Federal, Estadual e a Lei Orgânica',
            'Adequação à técnica legislativa (LC 95/1998)',
            'Existência de impacto orçamentário/financeiro e sua adequação',
        ],
    },
    {
        id: 'consulta', nome: 'Consulta jurídica',
        descricao: 'Resposta a consulta abstrata formulada por órgão ou autoridade.',
        secoes: ['I. RELATÓRIO', 'II. DA ANÁLISE JURÍDICA', 'III. CONCLUSÃO'],
        fecho: true,
        checklist: [
            'Delimitar objetivamente a dúvida jurídica formulada',
            'Identificar as normas e a jurisprudência aplicáveis',
            'Responder de forma clara a cada quesito da consulta',
            'Ressalvar que o parecer é opinativo e não vincula a autoridade',
        ],
    },
];

const getParecerTemplate = (id) => PARECER_TEMPLATES.find(t => t.id === id) || PARECER_TEMPLATES[0];

function buildParecerDelta(templateId) {
    const t = getParecerTemplate(templateId);
    return { ops: [...parecerSecoesOps(t.secoes), ...(t.fecho ? parecerFechoOps() : [])] };
}

// Mantido para compatibilidade: um parecer novo nasce com o modelo genérico.
function buildParecerSeedDelta() { return buildParecerDelta('generico'); }

// Pareceres antigos guardam "PARECER JURÍDICO" e "Processo n. ..." dentro do
// próprio conteúdo (o formato novo renderiza isso como cabeçalho fixo). Este
// helper detecta e REMOVE essas duas linhas do Delta, para as exportações não
// duplicarem o cabeçalho. Se o padrão não bater, devolve o Delta intacto.
function separarTituloEmbutido(delta) {
    const ops = (delta && delta.ops) || [];
    const primeiro = ops[0] && typeof ops[0].insert === 'string' ? ops[0].insert.trim() : '';
    if (!primeiro.startsWith('PARECER JURÍDICO')) return { delta, tinhaTitulo: false };
    // Consome ops até fechar 2 linhas (título e "Processo n."), mais as linhas
    // em branco imediatamente seguintes.
    let linhas = 0, i = 0;
    for (; i < ops.length && linhas < 2; i++) {
        const ins = ops[i].insert;
        if (typeof ins !== 'string') break;
        linhas += (ins.match(/\n/g) || []).length;
    }
    // Se as 2 linhas não fecharem exatamente na fronteira de um op (conteúdo
    // fora do padrão), não arrisca cortar texto: mantém o Delta como está.
    if (linhas !== 2) return { delta, tinhaTitulo: false };
    while (i < ops.length && typeof ops[i].insert === 'string' && ops[i].insert.replace(/\n/g, '') === '') i++;
    return { delta: { ops: ops.slice(i) }, tinhaTitulo: true };
}
