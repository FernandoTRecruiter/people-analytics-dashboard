/* =============================================================================
   dados-externos.js: o ESQUEMA para o dashboard rodar com dado de verdade
   (Power BI, CSV, banco), no lugar da empresa fictícia.

   Como funciona: se a página tiver window.DADOS_BRUTOS antes do dados.js, o
   dashboard usa esses dados; se não tiver, gera a empresa fictícia.
   No Power BI quem preenche DADOS_BRUTOS é a medida DAX (ver powerbi/LEIA-ME.md).

   FORMATO (todas as datas em texto "AAAA-MM-DD"; campo vazio = "" ou null):
   window.DADOS_BRUTOS = {
     empresa: "Nome que aparece no topo",            // opcional
     dataRef: "2026-09-30",                          // data de corte (fechamento); opcional
     pessoas: [{                                     // UMA linha por pessoa (a mais recente)
       id, nome,
       genero,        // "F"/"Feminino"/"Mulher", "M"/"Masculino"/"Homem"; outro = não informado
       raca,          // "Branca", "Parda", "Preta", "Amarela", "Indígena"; outro = não informado
       nascimento,    // "AAAA-MM-DD"
       area, unidade, nivel,   // texto livre (vira a lista dos filtros)
       nivel_ordem,   // opcional: número para ordenar níveis (0 = mais júnior)
       lider,         // opcional: "S"/"N" (se faltar, deduz pelo nome do nível)
       vinculo,       // "CLT", "PJ", "Estágio", "Aprendiz", "Temporário" ou outro texto
       admissao,      // "AAAA-MM-DD" (obrigatório)
       desligamento,  // "AAAA-MM-DD" ou vazio
       motivo,        // texto do motivo de desligamento (pedido, demissão, fim de contrato...)
       fim_previsto   // opcional: fim de contrato com prazo
     }],
     vagas: [{                                       // opcional (sem vagas, a aba fica vazia)
       id, area, unidade, nivel, abertura, fechamento,
       status,        // "aberta", "fechada" (com contratação) ou "cancelada"
       etapa,         // "triagem", "entrevistas" ou "oferta" (para as abertas)
       inscritos, triagem, entrevistas, ofertas, contratados   // números
     }]
   };
   ============================================================================= */
window.DADOS_DE_BRUTOS = function (b) {
  'use strict';
  const texto = v => (v == null ? '' : String(v)).trim();
  const semAcento = s => texto(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  // Data "AAAA-MM-DD" vira Date à meia-noite LOCAL (new Date("2026-01-05") seria UTC e mudaria o dia).
  function data(v) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(texto(v));
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  }
  const numero = v => (isFinite(+v) && texto(v) !== '' ? +v : 0);

  // Passo 1: cadastros dinâmicos. Cada texto diferente vira um código curto
  // (a1, a2...), porque o código entra no clique (data-drill) e não pode ter ":".
  function cadastro(prefixo, valores, extra) {
    const out = {}, codigo = {};
    valores.forEach(v => {
      const t = texto(v) || '(sem)';
      if (codigo[t]) return;
      const c = prefixo + (Object.keys(out).length + 1);
      codigo[t] = c;
      out[c] = Object.assign({ pt: t, en: t }, extra ? extra(t) : {});
    });
    return { out, codigo: t => codigo[texto(t) || '(sem)'] };
  }
  const pessoasB = Array.isArray(b.pessoas) ? b.pessoas : [];
  const vagasB = Array.isArray(b.vagas) ? b.vagas : [];

  // Nível: ordem pelo campo nivel_ordem; se faltar, pelo nome conhecido.
  const ORDEM_NOMES = [['aprendiz', 0], ['estag', 1], ['operac', 2], ['tecnic', 3], ['analist', 4], ['especial', 5], ['coord', 6], ['supervis', 6], ['gerent', 7], ['gerenc', 7], ['head', 7], ['diret', 8], ['c-level', 9], ['presid', 9]];
  const ordemDoNivel = {};
  pessoasB.forEach(p => { if (p.nivel_ordem != null && texto(p.nivel_ordem) !== '') ordemDoNivel[texto(p.nivel)] = +p.nivel_ordem; });
  const ordemPorNome = n => { const s = semAcento(n); const a = ORDEM_NOMES.find(([k]) => s.includes(k)); return a ? a[1] : 4; };
  const niveis = cadastro('n', pessoasB.map(p => p.nivel).concat(vagasB.map(v => v.nivel)), t => {
    const ordem = ordemDoNivel[t] != null ? ordemDoNivel[t] : ordemPorNome(t);
    const liderCol = pessoasB.find(p => texto(p.nivel) === t && texto(p.lider) !== '');
    return { ordem, lider: liderCol ? /^(s|sim|y|yes|1|true)$/i.test(texto(liderCol.lider)) : ordem >= 6 };
  });
  const areas = cadastro('a', pessoasB.map(p => p.area).concat(vagasB.map(v => v.area)));
  const unidades = cadastro('u', pessoasB.map(p => p.unidade).concat(vagasB.map(v => v.unidade)));

  // Vínculo, gênero, raça e motivo: os conhecidos viram os códigos do app.
  const VINCULOS = { clt: { pt: 'CLT', en: 'CLT (employee)' }, pj: { pt: 'PJ', en: 'Contractor' }, est: { pt: 'Estágio', en: 'Internship' }, apr: { pt: 'Aprendiz', en: 'Apprentice' }, tmp: { pt: 'Temporário', en: 'Temporary' } };
  function vinculoDe(v) {
    const s = semAcento(v);
    if (!s || s.includes('clt') || s.includes('efetiv')) return 'clt';
    if (s.includes('pj') || s.includes('prestador') || s.includes('terceir')) return 'pj';
    if (s.includes('estag')) return 'est';
    if (s.includes('aprendiz')) return 'apr';
    if (s.includes('tempor')) return 'tmp';
    const c = 'v_' + s.replace(/[^a-z0-9]+/g, '_');
    if (!VINCULOS[c]) VINCULOS[c] = { pt: texto(v), en: texto(v) };
    return c;
  }
  const generoDe = g => { const s = semAcento(g); return s === 'f' || s.startsWith('fem') || s.startsWith('mulher') ? 'F' : s === 'm' || s.startsWith('masc') || s.startsWith('homem') ? 'M' : 'N'; };
  const racaDe = r => { const s = semAcento(r); return s.startsWith('parda') || s.startsWith('pardo') ? 'parda' : s.startsWith('branc') ? 'branca' : s.startsWith('pret') || s.startsWith('negr') ? 'preta' : s.startsWith('amarel') ? 'amarela' : s.startsWith('indigen') ? 'indigena' : 'ni'; };
  const motivoDe = m => { const s = semAcento(m); if (!s) return null; return s.includes('pedido') ? 'pedido' : s.includes('fim') && s.includes('contrat') ? 'fim' : s.includes('demiss') || s.includes('dispens') ? 'demissao' : 'outro'; };

  // Passo 2: pessoas no mesmo formato da empresa fictícia.
  const pessoas = pessoasB.filter(p => data(p.admissao)).map((p, i) => ({
    id: texto(p.id) || 'P' + (i + 1), nome: texto(p.nome) || 'Pessoa ' + (i + 1),
    genero: generoDe(p.genero), raca: racaDe(p.raca),
    nascimento: data(p.nascimento) || new Date(1990, 0, 1),
    area: areas.codigo(p.area), unidade: unidades.codigo(p.unidade), nivel: niveis.codigo(p.nivel), vinculo: vinculoDe(p.vinculo),
    admissao: data(p.admissao), fimPrevisto: data(p.fim_previsto),
    desligamento: data(p.desligamento), motivo: data(p.desligamento) ? (motivoDe(p.motivo) || 'outro') : null
  }));

  // Passo 3: data de corte e a série de meses (até 21 fins de mês para trás).
  const hoje = new Date();
  let dataRef = data(b.dataRef);
  if (!dataRef) dataRef = new Date(hoje.getFullYear(), hoje.getMonth(), 0); // último mês fechado
  const meses = [];
  for (let k = 20; k >= 0; k--) meses.push(new Date(dataRef.getFullYear(), dataRef.getMonth() - k + 1, 0));
  const primeiraAdm = pessoas.reduce((m, p) => (p.admissao < m ? p.admissao : m), dataRef);
  const mesesUteis = meses.filter(m => m >= new Date(primeiraAdm.getFullYear(), primeiraAdm.getMonth() + 1, 0));

  // Passo 4: vagas (opcionais).
  const vagas = vagasB.map((v, i) => ({
    id: texto(v.id) || 'V' + (i + 1), area: areas.codigo(v.area), unidade: unidades.codigo(v.unidade), nivel: niveis.codigo(v.nivel),
    abertura: data(v.abertura) || dataRef, fechamento: data(v.fechamento),
    status: ['aberta', 'fechada', 'cancelada'].includes(semAcento(v.status)) ? semAcento(v.status) : (data(v.fechamento) ? 'fechada' : 'aberta'),
    etapa: ['triagem', 'entrevistas', 'oferta'].includes(semAcento(v.etapa)) ? semAcento(v.etapa) : 'triagem',
    inscritos: numero(v.inscritos), triagem: numero(v.triagem), entrevistas: numero(v.entrevistas), ofertas: numero(v.ofertas), contratados: numero(v.contratados)
  }));

  return {
    empresa: texto(b.empresa) || 'People Analytics', dataRef, inicio: mesesUteis[0] || dataRef, meses: mesesUteis.length ? mesesUteis : [dataRef],
    areas: areas.out, unidades: unidades.out, niveis: niveis.out, vinculos: VINCULOS,
    racas: { parda: { pt: 'Parda', en: 'Brown' }, branca: { pt: 'Branca', en: 'White' }, preta: { pt: 'Preta', en: 'Black' }, amarela: { pt: 'Amarela', en: 'Asian' }, indigena: { pt: 'Indígena', en: 'Indigenous' }, ni: { pt: 'Não informado', en: 'Not stated' } },
    motivos: { pedido: { pt: 'Pedido de demissão', en: 'Resignation' }, demissao: { pt: 'Demissão', en: 'Dismissal' }, fim: { pt: 'Fim de contrato', en: 'End of contract' }, outro: { pt: 'Outros', en: 'Other' } },
    pessoas, vagas, ficticio: false
  };
};
