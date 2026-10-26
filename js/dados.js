/* =============================================================================
   dados.js: a empresa FICTÍCIA "C. & Paoli corp." inteira, gerada no navegador.

   Por que gerar em vez de guardar uma planilha?
   - Nenhuma pessoa real aparece aqui: tudo nasce de um sorteio com semente fixa.
   - Semente fixa = os mesmos números em toda visita (dá para conferir e fotografar).
   - O formato imita o de um sistema de RH: uma linha por pessoa com admissão,
     desligamento e motivo; uma linha por vaga com as etapas do funil.

   Linha do tempo simulada: jan/2025 até set/2026 (21 meses fechados).
   ============================================================================= */
window.DADOS = (function () {
  'use strict';
  // Dado de verdade chegou (Power BI, CSV...)? Usa ele e não sorteia nada.
  // O formato está documentado em js/dados-externos.js.
  if (window.DADOS_BRUTOS && window.DADOS_DE_BRUTOS) return window.DADOS_DE_BRUTOS(window.DADOS_BRUTOS);

  // Passo 1: sorteio com semente (mulberry32). Mesmo número de entrada,
  // mesma sequência de saída: é o que deixa a demo reprodutível.
  function semente(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const R = semente(20261021);
  const entre = (a, b) => a + R() * (b - a);
  const inteiro = (a, b) => Math.floor(entre(a, b + 1));
  // Sorteia uma chave de um objeto {chave: peso}.
  function pesado(pesos) {
    const tot = Object.values(pesos).reduce((s, v) => s + v, 0);
    let x = R() * tot;
    for (const [k, v] of Object.entries(pesos)) { if ((x -= v) <= 0) return k; }
    return Object.keys(pesos)[0];
  }
  const dia = (a, m, d) => new Date(a, m, d);
  const somaDias = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + Math.round(n));

  // Passo 2: o cadastro da empresa (o que seria a tabela de dimensões).
  const DATA_REF = dia(2026, 8, 30);          // último dia do mês fechado
  const INICIO = dia(2025, 0, 1);             // começo da série mensal

  const AREAS = {
    ops: { pt: 'Operações', en: 'Operations', peso: 34, saida: 0.021, mulheres: 0.22 },
    man: { pt: 'Manutenção', en: 'Maintenance', peso: 14, saida: 0.013, mulheres: 0.12 },
    log: { pt: 'Logística', en: 'Logistics', peso: 12, saida: 0.019, mulheres: 0.30 },
    tec: { pt: 'Tecnologia', en: 'Technology', peso: 9, saida: 0.016, mulheres: 0.33 },
    com: { pt: 'Comercial', en: 'Sales', peso: 9, saida: 0.018, mulheres: 0.50 },
    fin: { pt: 'Financeiro', en: 'Finance', peso: 7, saida: 0.008, mulheres: 0.58 },
    pes: { pt: 'Pessoas & Cultura', en: 'People & Culture', peso: 6, saida: 0.010, mulheres: 0.74 },
    jur: { pt: 'Jurídico', en: 'Legal', peso: 3, saida: 0.006, mulheres: 0.55 },
    dir: { pt: 'Diretoria', en: 'Board', peso: 1.6, saida: 0.002, mulheres: 0.34 }
  };
  const UNIDADES = {
    mat: { pt: 'Matriz', en: 'Head office' },
    fab: { pt: 'Fábrica', en: 'Plant' },
    cd: { pt: 'Centro de Distribuição', en: 'Distribution center' },
    rem: { pt: 'Remoto', en: 'Remote' }
  };
  // Onde cada área costuma trabalhar (Operações mora na fábrica, Logística no CD...).
  const UNIDADE_DA_AREA = {
    ops: { fab: 90, mat: 10 }, man: { fab: 95, mat: 5 }, log: { cd: 80, fab: 20 },
    tec: { mat: 55, rem: 45 }, com: { mat: 70, rem: 30 }, fin: { mat: 85, rem: 15 },
    pes: { mat: 80, fab: 20 }, jur: { mat: 100 }, dir: { mat: 100 }
  };
  const NIVEIS = {
    apr: { pt: 'Aprendiz', en: 'Apprentice', ordem: 0 },
    est: { pt: 'Estágio', en: 'Intern', ordem: 1 },
    ope: { pt: 'Operacional', en: 'Operational', ordem: 2 },
    tcn: { pt: 'Técnico', en: 'Technician', ordem: 3 },
    ana: { pt: 'Analista', en: 'Analyst', ordem: 4 },
    esp: { pt: 'Especialista', en: 'Specialist', ordem: 5 },
    coo: { pt: 'Coordenação', en: 'Coordinator', ordem: 6, lider: true },
    ger: { pt: 'Gerência', en: 'Manager', ordem: 7, lider: true },
    dir: { pt: 'Diretoria', en: 'Director', ordem: 8, lider: true }
  };
  // Nível de quem ENTRA em cada área (contratação nova puxa para a base da pirâmide).
  const NIVEL_DA_AREA = {
    ops: { apr: 10, ope: 52, tcn: 20, ana: 9, esp: 3, coo: 4 },
    man: { apr: 10, ope: 28, tcn: 43, ana: 8, esp: 6, coo: 4 },
    log: { apr: 9, ope: 52, tcn: 10, ana: 20, coo: 5 },
    tec: { est: 10, ana: 55, esp: 25, coo: 6 },
    com: { est: 8, ana: 62, esp: 18, coo: 8 },
    fin: { est: 12, ana: 60, esp: 18, coo: 8 },
    pes: { est: 12, ana: 62, esp: 14, coo: 8 },
    jur: { ana: 50, esp: 40, coo: 10 },
    dir: { dir: 100 }
  };
  const VINCULOS = {
    clt: { pt: 'CLT', en: 'CLT (employee)' },
    pj: { pt: 'PJ', en: 'Contractor' },
    est: { pt: 'Estágio', en: 'Internship' },
    apr: { pt: 'Aprendiz', en: 'Apprentice' },
    tmp: { pt: 'Temporário', en: 'Temporary' }
  };
  const RACAS = {
    parda: { pt: 'Parda', en: 'Brown', peso: 44 }, branca: { pt: 'Branca', en: 'White', peso: 38 },
    preta: { pt: 'Preta', en: 'Black', peso: 12 }, amarela: { pt: 'Amarela', en: 'Asian', peso: 2 },
    indigena: { pt: 'Indígena', en: 'Indigenous', peso: 1 }, ni: { pt: 'Não informado', en: 'Not stated', peso: 3 }
  };
  const MOTIVOS = {
    pedido: { pt: 'Pedido de demissão', en: 'Resignation' },
    demissao: { pt: 'Demissão', en: 'Dismissal' },
    fim: { pt: 'Fim de contrato', en: 'End of contract' },
    outro: { pt: 'Outros', en: 'Other' }
  };

  // Nomes inventados (combinação sorteada; qualquer semelhança é coincidência).
  const NOMES_F = ['Ana', 'Beatriz', 'Camila', 'Débora', 'Elisa', 'Gabriela', 'Helena', 'Isabela', 'Júlia', 'Larissa', 'Mariana', 'Natália', 'Olívia', 'Paula', 'Renata', 'Sofia', 'Tatiana', 'Valéria', 'Yasmin', 'Luana', 'Bianca', 'Cecília', 'Priscila', 'Rafaela', 'Lívia', 'Marina', 'Clara', 'Alice', 'Lorena', 'Joana', 'Vitória', 'Bruna'];
  const NOMES_M = ['André', 'Bruno', 'Caio', 'Diego', 'Eduardo', 'Fábio', 'Gabriel', 'Henrique', 'Igor', 'João', 'Lucas', 'Marcelo', 'Nicolas', 'Otávio', 'Rafael', 'Samuel', 'Thiago', 'Vinícius', 'Wagner', 'Yuri', 'Leonardo', 'Mateus', 'Rodrigo', 'Renan', 'César', 'Murilo', 'Hugo', 'Alexandre', 'Ricardo', 'Vitor', 'Davi', 'Enzo'];
  const SOBRENOMES = ['Almeida', 'Barbosa', 'Cardoso', 'Dias', 'Esteves', 'Farias', 'Gomes', 'Honorato', 'Jardim', 'Lacerda', 'Moreira', 'Nogueira', 'Oliveira', 'Prado', 'Queiroz', 'Rocha', 'Sales', 'Teixeira', 'Uchoa', 'Vasconcelos', 'Xavier', 'Zanetti', 'Ribeiro', 'Mendes', 'Campos', 'Duarte', 'Freitas', 'Lima', 'Pires', 'Brandão', 'Correia', 'Fontes'];
  const usados = new Set();
  function nome(genero) {
    const lista = genero === 'F' ? NOMES_F : genero === 'M' ? NOMES_M : NOMES_F.concat(NOMES_M);
    for (let i = 0; i < 50; i++) {
      const n = lista[inteiro(0, lista.length - 1)] + ' ' + SOBRENOMES[inteiro(0, SOBRENOMES.length - 1)] +
        (i > 8 ? ' ' + SOBRENOMES[inteiro(0, SOBRENOMES.length - 1)] : '');
      if (!usados.has(n)) { usados.add(n); return n; }
    }
    return 'Pessoa ' + usados.size;
  }

  // Passo 3: fabricar uma pessoa. Cada escolha depende da anterior
  // (área -> unidade -> nível -> vínculo -> idade), como na vida real.
  let seq = 0;
  function pessoa(area, admissao, nivelForcado) {
    const a = AREAS[area];
    const nivel = nivelForcado || pesado(NIVEL_DA_AREA[area]);
    const genero = R() < 0.012 ? 'N' : (R() < a.mulheres * (NIVEIS[nivel].lider ? 0.8 : 1) ? 'F' : 'M');
    let vinculo = 'clt';
    if (nivel === 'apr') vinculo = 'apr';
    else if (nivel === 'est') vinculo = 'est';
    else if ((nivel === 'esp' || nivel === 'ana') && ['tec', 'jur', 'com'].includes(area) && R() < 0.22) vinculo = 'pj';
    else if (nivel === 'ope' && ['ops', 'log'].includes(area) && R() < 0.06) vinculo = 'tmp';
    const idades = { apr: [16, 20], est: [19, 25], ope: [19, 56], tcn: [21, 55], ana: [22, 50], esp: [27, 56], coo: [29, 55], ger: [33, 56], dir: [40, 61] }[nivel];
    const idade = entre(idades[0], idades[1]);
    // Contrato com prazo já nasce com data de fim (aprendiz, estágio, temporário).
    const prazo = { apr: [540, 720], est: [365, 720], tmp: [90, 180] }[vinculo];
    seq += 1;
    return {
      id: 'C' + String(seq).padStart(4, '0'),
      nome: nome(genero), genero, raca: pesado(Object.fromEntries(Object.entries(RACAS).map(([k, v]) => [k, v.peso]))),
      area, unidade: pesado(UNIDADE_DA_AREA[area]), nivel, vinculo,
      nascimento: somaDias(admissao, -idade * 365.25),
      admissao, fimPrevisto: prazo ? somaDias(admissao, entre(prazo[0], prazo[1])) : null,
      desligamento: null, motivo: null
    };
  }

  // Passo 4: a foto inicial (quem já estava na empresa em 01/01/2025).
  const pessoas = [];
  const alvoInicial = 238;
  // Diretoria e gerências primeiro: toda área tem quem responda por ela.
  Object.keys(AREAS).forEach(area => {
    if (area === 'dir') {
      for (let i = 0; i < 4; i++) pessoas.push(pessoa('dir', somaDias(INICIO, -entre(500, 3800)), 'dir'));
    } else {
      pessoas.push(pessoa(area, somaDias(INICIO, -entre(700, 4200)), 'ger'));
    }
  });
  while (pessoas.length < alvoInicial) {
    const area = pesado(Object.fromEntries(Object.entries(AREAS).filter(([k]) => k !== 'dir').map(([k, v]) => [k, v.peso])));
    // Tempo de casa com cauda longa: muita gente nova, pouca gente muito antiga.
    const casa = Math.min(-Math.log(1 - R()) * 1350, 5000);
    const p = pessoa(area, somaDias(INICIO, -casa - 5));
    if (p.fimPrevisto && p.fimPrevisto < INICIO) p.fimPrevisto = somaDias(INICIO, entre(20, 300));
    pessoas.push(p);
  }

  // Passo 5: simular mês a mês. Primeiro as saídas, depois as contratações.
  const ativo = (p, d) => p.admissao <= d && (!p.desligamento || p.desligamento > d);
  const vagas = [];
  let seqVaga = 0;
  function novaVaga(area, unidade, nivel, abertura) {
    seqVaga += 1;
    const base = { ope: [60, 260], apr: [80, 220], est: [90, 300], tcn: [40, 140] }[nivel] || [25, 130];
    const inscritos = inteiro(base[0], base[1]);
    const triagem = Math.round(inscritos * entre(0.22, 0.36));
    const entrevistas = Math.max(2, Math.round(triagem * entre(0.22, 0.4)));
    return { id: 'V' + String(seqVaga).padStart(3, '0'), area, unidade, nivel, abertura, fechamento: null,
      status: 'aberta', etapa: 'triagem', inscritos, triagem, entrevistas, ofertas: 0, contratados: 0 };
  }
  const meses = [];
  for (let m = 0; m < 21; m++) {
    const ini = dia(2025, m, 1), fim = dia(2025, m + 1, 0);
    meses.push(fim);
    // 5a. Saídas: contrato com prazo termina na data; o resto sorteia pela taxa da área.
    pessoas.forEach(p => {
      if (!ativo(p, ini) || p.admissao > fim) return;
      if (p.fimPrevisto && p.fimPrevisto >= ini && p.fimPrevisto <= fim) {
        // 30% dos aprendizes e estagiários são efetivados: viram CLT em vez de sair.
        if ((p.vinculo === 'apr' || p.vinculo === 'est') && R() < 0.3) { p.vinculo = 'clt'; p.nivel = p.area === 'ops' || p.area === 'log' ? 'ope' : 'ana'; p.fimPrevisto = null; return; }
        p.desligamento = p.fimPrevisto; p.motivo = 'fim'; return;
      }
      const novato = (fim - p.admissao) / 864e5 < 365 ? 1.7 : 1;
      const lider = NIVEIS[p.nivel].lider ? 0.4 : 1;
      if (R() < AREAS[p.area].saida * novato * lider) {
        p.desligamento = dia(fim.getFullYear(), fim.getMonth(), inteiro(1, fim.getDate()));
        p.motivo = pesado({ pedido: 52, demissao: 36, outro: 12 });
      }
    });
    // 5b. Contratações: repor quem saiu e crescer devagar até ~262 em set/2026.
    const alvo = Math.round(238 + (262 - 238) * (m / 20) + entre(-2, 2));
    const ativos = pessoas.filter(p => ativo(p, fim)).length;
    const contratar = Math.max(0, alvo - ativos);
    const saidasMes = pessoas.filter(p => p.desligamento && p.desligamento >= ini && p.desligamento <= fim && p.area !== 'dir');
    // Quem é líder ou aprendiz vai para o começo da fila de reposição.
    saidasMes.sort((a, b) => (['ger', 'coo', 'apr', 'est'].includes(b.nivel) ? 1 : 0) - (['ger', 'coo', 'apr', 'est'].includes(a.nivel) ? 1 : 0));
    for (let i = 0; i < Math.max(contratar, saidasMes.filter(x => x.nivel === 'ger').length); i++) {
      const vaga = saidasMes[i] && (R() < 0.7 || ['ger', 'apr'].includes(saidasMes[i].nivel)) ? saidasMes[i] : null;
      const area = vaga ? vaga.area : pesado(Object.fromEntries(Object.entries(AREAS).filter(([k]) => k !== 'dir').map(([k, v]) => [k, v.peso])));
      const admissao = dia(fim.getFullYear(), fim.getMonth(), inteiro(1, fim.getDate()));
      // Cargo de liderança e cota de aprendiz/estágio se repõem no MESMO nível.
      const mesmoNivel = vaga && ['apr', 'est', 'coo', 'ger'].includes(vaga.nivel) ? vaga.nivel : null;
      const p = pessoa(area, admissao, mesmoNivel);
      pessoas.push(p);
      // Toda contratação nasce de uma vaga: o tempo até fechar depende do nível.
      const ttf = { apr: [15, 35], est: [15, 35], ope: [14, 40], tcn: [22, 55], ana: [28, 70], esp: [40, 100], coo: [55, 115] }[p.nivel] || [30, 60];
      const v = novaVaga(area, p.unidade, p.nivel, somaDias(admissao, -entre(ttf[0], ttf[1]) - 10));
      v.fechamento = somaDias(admissao, -inteiro(7, 14));
      v.status = 'fechada'; v.etapa = 'contratado';
      v.ofertas = R() < 0.18 ? 2 : 1; v.contratados = 1; v.pessoa = p.id;
      vagas.push(v);
    }
    // 5c. Algumas vagas são canceladas no meio do caminho (vida real).
    if (R() < 0.35) {
      const area = pesado({ ops: 3, log: 2, com: 2, tec: 2, fin: 1 });
      const v = novaVaga(area, pesado(UNIDADE_DA_AREA[area]), pesado(NIVEL_DA_AREA[area]), somaDias(ini, -inteiro(10, 60)));
      v.status = 'cancelada'; v.etapa = 'entrevistas'; v.fechamento = dia(fim.getFullYear(), fim.getMonth(), inteiro(1, 28));
      vagas.push(v);
    }
  }
  // Passo 6: vagas ainda abertas na data de referência.
  for (let i = 0; i < 12; i++) {
    const area = pesado({ ops: 4, man: 2, log: 2, tec: 2, com: 1.5, fin: 1, pes: 0.6 });
    const v = novaVaga(area, pesado(UNIDADE_DA_AREA[area]), pesado(NIVEL_DA_AREA[area]), somaDias(DATA_REF, -inteiro(6, 128)));
    v.etapa = pesado({ triagem: 4, entrevistas: 4, oferta: 2 });
    if (v.etapa === 'triagem') { v.entrevistas = 0; }
    if (v.etapa === 'oferta') v.ofertas = 1;
    vagas.push(v);
  }

  return {
    empresa: 'C. & Paoli corp.', dataRef: DATA_REF, inicio: INICIO, meses,
    areas: AREAS, unidades: UNIDADES, niveis: NIVEIS, vinculos: VINCULOS, racas: RACAS, motivos: MOTIVOS,
    pessoas, vagas, ficticio: true
  };
})();
