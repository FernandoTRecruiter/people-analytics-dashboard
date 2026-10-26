/* =============================================================================
   ambiente-dados.js: os dados FICTÍCIOS da aba "Meu ambiente".

   Três coisas moram aqui, longe do desenho:
   1. as MARCAÇÕES DE PONTO do dia de exemplo (quem entrou e quem saiu, e a que horas);
   2. as PLANTAS, uma por unidade (Matriz = escritório, Fábrica = produção,
      Centro de Distribuição = galpão com docas): zonas, paredes, móveis, lugares,
      corredores, a regra de quem vai para onde e as zonas restritas;
   3. o INVENTÁRIO de cada unidade, com o endereço traduzido para uma prateleira
      que EXISTE na planta daquela unidade.

   Por que separado: a tela só desenha. Quem quiser conferir um número (o teste
   automático, por exemplo) lê daqui a mesma fonte que a tela usou.
   Tudo nasce de sorteio com semente fixa: mesma pessoa, mesmo horário, em toda visita.
   ============================================================================= */
window.AMBIENTE_DADOS = (function () {
  'use strict';
  const D = window.DADOS;
  // Trava: com dado de VERDADE (D.ficticio === false) a aba não existe. Sortear ponto e
  // estoque em cima de pessoas reais faria o mapa parecer marcação real: aqui não nasce nada.
  if (!D || D.ficticio === false) return null;

  // Passo 1: sorteio com semente (o mesmo mulberry32 do dados.js).
  function semente(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  // Transforma um texto (ex.: o id da pessoa) num número fixo. É o que dá a cada
  // pessoa o "seu" sorteio: o horário dela não muda quando outra pessoa entra na lista.
  function hash(txt) {
    let h = 2166136261;
    for (let i = 0; i < txt.length; i++) { h ^= txt.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  // ---------------------------------------------------------------- 2. PONTO
  // Horário comercial da simulação, em minutos desde a meia-noite (07:00 a 19:00).
  const ABRE = 7 * 60, FECHA = 19 * 60;
  const DIA = D.dataRef; // o "dia de exemplo" das marcações
  const ativo = p => p.admissao <= DIA && (!p.desligamento || p.desligamento > DIA);

  // Uma marcação por pessoa ativa. Regras do sorteio:
  // - 8% não vêm (férias, folga, atestado): ficam sem marcação;
  // - entrada entre 07:00 e 09:30, mais gente perto das 08:15 (média de dois sorteios);
  // - saída entre 16:00 e 18:30;
  // - 2% "esquecem a saída": o ponto fica aberto até o fim do dia (é o erro da janelinha c).
  const marcacoes = D.pessoas.filter(ativo).map(p => {
    const R = semente(hash('ponto-' + p.id));
    if (R() < 0.08) return { id: p.id, unidade: p.unidade, ausente: true, entrada: null, saida: null, esqueceuSaida: false };
    const entrada = ABRE + Math.round((R() + R()) / 2 * 150);
    const esqueceu = R() < 0.02;
    const saida = esqueceu ? null : 16 * 60 + Math.round(R() * 150);
    return { id: p.id, unidade: p.unidade, ausente: false, entrada, saida, esqueceuSaida: esqueceu };
  });
  const pessoaPorId = {};
  D.pessoas.forEach(p => { pessoaPorId[p.id] = p; });

  // Ponto aberto = bateu a entrada e ainda não bateu a saída. É a ÚNICA regra
  // de quem aparece no mapa; a tela e o teste usam esta mesma função.
  const aberto = (m, minuto) => !m.ausente && m.entrada <= minuto && (m.saida == null || minuto < m.saida);
  const presentes = (unidade, minuto) => marcacoes.filter(m => m.unidade === unidade && aberto(m, minuto));
  // Quantas pessoas a unidade tem no cadastro (o "de M" do cabeçalho).
  const cadastro = unidade => marcacoes.filter(m => m.unidade === unidade).length;

  // ---------------------------------------------------------------- 3. PLANTAS (uma por unidade)
  // Coordenadas em "células" (≈ 1 metro). x cresce para a direita-baixo da tela,
  // y para a esquerda-baixo; o canto (0,0) é o fundo do desenho. As três plantas têm o
  // MESMO tamanho (46 x 24, com lugar para a área externa): o mapa não muda de tamanho quando a pessoa troca de unidade.
  const W = 46, H = 24;   // largura com espaço para a área externa (Fábrica e CD)
  // Liderança (gerência e diretoria) vai para uma sala de 1 pessoa, se sobrar sala.
  const lider = p => p.nivel === 'dir' || p.nivel === 'ger';
  // Regra por área vale para quem NÃO é liderança (a liderança já foi para a sala).
  const daArea = area => p => p.area === area && !lider(p);
  const todos = () => true;

  // Uma planta vazia. Cada uma diz:
  // - zonas (o chão), paredes (os vãos entre os pedaços são as portas), móveis e vias (corredores);
  // - lugares: onde alguém pode PARAR, por tipo (mesa, sala, galpão, linha, manutenção...);
  // - regras: em ordem, quem vai para qual tipo de lugar (a 1ª regra que serve, leva);
  // - restritas: as zonas onde só certas áreas entram (o teste automático confere).
  function novaPlanta(id) {
    return { id, W, H, zonas: [], paredes: [], moveis: [], vias: [], rotulos: [], marcas: [], regras: [], restritas: [], entrada: null,
      lugares: { mesa: [], sala: [], galpao: [], empe: [], impressora: [], wc: [], copa: [], linha: [], manut: [], maquina: [], vestiario: [], escada: [], reuniao: [] } };
  }
  // Atalhos: um móvel (caixa com altura h; "cod" = número da prateleira) e um lugar
  // ("via" = pontos entre o lugar e o corredor; "acesso" = o ponto do corredor de onde se chega).
  const caixa = (P, tipo, x0, y0, x1, y1, h, extra) => P.moveis.push(Object.assign({ tipo, x0, y0, x1, y1, h }, extra || {}));
  const lugar = (P, grupo, x, y, acesso, via, extra) => P.lugares[grupo].push(Object.assign({ x, y, acesso: acesso || { x, y }, via: via || [] }, extra || {}));
  // Bancada de escritório: 3 mesas lado a lado e um lugar de cada lado de cada mesa.
  // "acima" e "abaixo" = o corredor de onde se chega a cada lado.
  // Cadeira (assento + encosto). "lado" = de que lado está a mesa: +1 = mesa em y maior.
  // O encosto fica do lado de fora, longe da mesa.
  function cadeira(P, x, y, lado) {
    caixa(P, 'cadeira', x - 0.22, y - 0.22, x + 0.22, y + 0.22, 0.05, { z0: 0.24 });
    const yb = lado > 0 ? y - 0.28 : y + 0.22;
    caixa(P, 'cadeira', x - 0.22, yb, x + 0.22, yb + 0.06, 0.34, { z0: 0.29 });
  }
  function bancada(P, a, c, acima, abaixo) {
    // Mesa = tampo fino em cima de pés (dá para ver por baixo), um pé em cada ponta da bancada.
    for (let i = 0; i < 3; i++) caixa(P, 'mesa', a + i, c - 0.5, a + i + 1, c + 0.5, 0.06, { z0: 0.36 });
    caixa(P, 'pe-mesa', a + 0.04, c - 0.44, a + 0.12, c + 0.44, 0.36); caixa(P, 'pe-mesa', a + 2.88, c - 0.44, a + 2.96, c + 0.44, 0.36);
    for (let i = 0; i < 3; i++) {
      lugar(P, 'mesa', a + 0.5 + i, c - 0.95, { x: a + 0.5 + i, y: acima });
      lugar(P, 'mesa', a + 0.5 + i, c + 0.95, { x: a + 0.5 + i, y: abaixo });
      cadeira(P, a + 0.5 + i, c - 0.95, 1); cadeira(P, a + 0.5 + i, c + 0.95, -1);
    }
    // Dois monitores por mesa, costas com costas (z0 = em cima da mesa).
    for (let i = 0; i < 3; i++) {
      caixa(P, 'monitor', a + i + 0.25, c - 0.16, a + i + 0.75, c - 0.06, 0.32, { z0: 0.42 });
      caixa(P, 'monitor', a + i + 0.25, c + 0.06, a + i + 0.75, c + 0.16, 0.32, { z0: 0.42 });
    }
  }
  // Carga em cima das estantes: uma caixa por metro, com algumas vagas (sorteio fixo pelo código).
  function cargas(P) {
    P.moveis.filter(m => m.tipo === 'rack').forEach(m => {
      const longoY = (m.y1 - m.y0) > (m.x1 - m.x0), n = Math.max(1, Math.round(longoY ? m.y1 - m.y0 : m.x1 - m.x0));
      for (let j = 0; j < n; j++) {
        if (hash(m.cod + '-' + j) % 3 === 0) continue;
        const t = j / n, u = (j + 1) / n;
        const [x0, x1] = longoY ? [m.x0 + 0.15, m.x1 - 0.15] : [m.x0 + (m.x1 - m.x0) * t + 0.12, m.x0 + (m.x1 - m.x0) * u - 0.12];
        const [y0, y1] = longoY ? [m.y0 + (m.y1 - m.y0) * t + 0.12, m.y0 + (m.y1 - m.y0) * u - 0.12] : [m.y0 + 0.15, m.y1 - 0.15];
        caixa(P, 'carga', x0, y0, x1, y1, 0.34, { z0: m.h, dono: m.cod });  // dono: clicar na carga escolhe a estante
      }
    });
  }
  // Salinha de 1 pessoa encostada na parede do fundo: mesa, cadeira na frente da mesa,
  // porta no meio da parede da frente ("frente") e o corredor logo fora ("corredor").
  // "ret" = o retângulo da sala (o teste confere que só o dono entra nele).
  function salinha(P, k, x0, frente, corredor) {
    caixa(P, 'mesa-sala', x0 + 0.5, 1.0, x0 + 2.0, 1.8, 0.42, { sala: k });
    caixa(P, 'monitor', x0 + 0.95, 1.1, x0 + 1.55, 1.2, 0.32, { z0: 0.42 });
    lugar(P, 'sala', x0 + 1.25, 2.55, { x: x0 + 1.5, y: corredor }, [{ x: x0 + 1.5, y: frente }], { sala: k, ret: [x0, 0, x0 + 3, frente] });
    cadeira(P, x0 + 1.25, 2.55, -1);
  }
  const codR = n => 'R' + String(n).padStart(2, '0');
  // Detalhes sem função (vaso, quadro, extintor, cone, árvore, poste...): só enfeitam, não clicam.
  // "pintura" = marca no chão (faixa de pedestre, vaga): dá para pisar em cima.
  const deco = (P, tipo, x0, y0, x1, y1, h, z0) => caixa(P, tipo, x0, y0, x1, y1, h, { deco: true, z0: z0 || 0 });
  const vaso = (P, x, y) => { deco(P, 'vaso', x - 0.2, y - 0.2, x + 0.2, y + 0.2, 0.3); deco(P, 'planta', x - 0.28, y - 0.28, x + 0.28, y + 0.28, 0.45, 0.3); };
  const arvore = (P, x, y) => { deco(P, 'tronco', x - 0.12, y - 0.12, x + 0.12, y + 0.12, 0.7); deco(P, 'copa-arvore', x - 0.6, y - 0.6, x + 0.6, y + 0.6, 1.0, 0.7); };
  const poste = (P, x, y) => { deco(P, 'poste', x - 0.07, y - 0.07, x + 0.07, y + 0.07, 2.2); deco(P, 'lampada', x - 0.25, y - 0.12, x + 0.25, y + 0.12, 0.08, 2.15); };

  // ======== MATRIZ: escritório em 2 andares (o 1º com depósito e um galpão pequeno) ========
  // O 2º andar fica em cima da parte de escritório do 1º. Diretoria, Financeiro, Pessoas & Cultura
  // e Jurídico trabalham lá em cima; o resto, no 1º andar. Quem sobe usa a escada.
  const doAndar2 = p => ['dir', 'fin', 'pes', 'jur'].includes(p.area);
  // O que os dois andares têm igual, na MESMA posição (um fica exatamente em cima do outro):
  // 6 salinhas no fundo, 4 fileiras de bancadas, WC, copa e a escada.
  function escritorioMatriz(P) {
    P.paredes.push(
      [0, 0, 0, 14.5, 0.9], [0, 17, 0, 24, 0.9], [0, 14.5, 3.5, 14.5, 0.6], [3.5, 14.5, 3.5, 17, 0.6], // fundo esquerdo, com um recuo
      [0, 7, 3.5, 7, 0.6], [3.5, 7, 3.5, 8.6, 0.6], [3.5, 9.4, 3.5, 11, 0.6], [0, 11, 3.5, 11, 0.6], // WC
      [0, 17, 4, 17, 0.6], [4, 17, 4, 18.1, 0.6], [4, 18.9, 4, 24, 0.6]);                           // copa
    for (let k = 0; k < 6; k++) { // 6 salinhas de 3 x 4, porta no meio da frente de cada uma
      P.paredes.push([3 * k + (k ? 0.1 : 0), 4, 3 * k + 1.1, 4, 0.6], [3 * k + 1.9, 4, 3 * k + 3 - (k < 5 ? 0.1 : 0), 4, 0.6]);
      if (k) P.paredes.push([3 * k, 0, 3 * k, 4, 0.6]);
    }
    [8, 12, 16, 20].forEach((c, f) => [6, 10, 14, 18].forEach(a => bancada(P, a, c, c - 2, f === 3 ? 22.6 : c + 2)));
    [9.5, 13.5, 17.5, 22.5].forEach(x => [8, 12, 16, 20].forEach(y => lugar(P, 'empe', x, y)));
    for (let k = 0; k < 6; k++) salinha(P, k, 3 * k, 4, 6);
    [[1.0, 7.9], [1.0, 9.0], [1.0, 10.1], [2.5, 7.9]].forEach(([x, y]) => lugar(P, 'wc', x, y, { x: 5, y: 9 }, [{ x: 3.5, y: 9 }]));
    caixa(P, 'cafe', 0.3, 17.4, 1.1, 18.4, 0.72);
    caixa(P, 'mesa-copa', 1.6, 20.4, 2.8, 21.6, 0.42);
    [[1.7, 17.9], [2.2, 19.9], [3.25, 21.0]].forEach(([x, y]) => lugar(P, 'copa', x, y, { x: 5, y: 18.5 }, [{ x: 4, y: 18.5 }]));
    // Escada entre os andares: 3 degraus e o ponto do corredor onde se pega a escada.
    [0, 1, 2].forEach(i => caixa(P, 'escada', 19.9 + 0.47 * i, 23.0, 20.37 + 0.47 * i, 23.9, 0.3 + 0.3 * i));
    lugar(P, 'escada', 20.6, 22.6);
    vaso(P, 23.35, 5.55); vaso(P, 0.65, 11.65);
    deco(P, 'quadro', 6.25, 4.07, 6.95, 4.13, 0.3, 0.32);          // quadro na parede das salas
    deco(P, 'bebedouro', 4.15, 15.6, 4.55, 16.0, 0.75);
    P.vias.push(
      [1.5, 6, 22.5, 6], [5, 10, 22.5, 10], [5, 14, 22.5, 14], [5, 18, 22.5, 18], [5, 22.6, 22.5, 22.6],
      [5, 6, 5, 22.6], [9.5, 6, 9.5, 22.6], [13.5, 6, 13.5, 22.6], [17.5, 6, 17.5, 22.6], [22.5, 6, 22.5, 22.6]);
  }
  const MAT = novaPlanta('mat');
  (function (P) {
    P.zonas.push(
      { id: 'escritorio', x0: 0, y0: 4, x1: 24, y1: 14.5 }, { id: 'escritorio', x0: 3.5, y0: 14.5, x1: 24, y1: 17 }, { id: 'escritorio', x0: 0, y0: 17, x1: 24, y1: 24 }, { id: 'salas', x0: 0, y0: 0, x1: 18, y1: 4 },
      { id: 'storage', x0: 18, y0: 0, x1: 24, y1: 5 }, { id: 'galpao', x0: 24, y0: 0, x1: 34, y1: 24 },
      { id: 'wc', x0: 0, y0: 7, x1: 3.5, y1: 11 }, { id: 'copa', x0: 0, y0: 17, x1: 4, y1: 24 });
    // Paredes baixas [x0, y0, x1, y1, altura]. As portas são os VÃOS entre os pedaços.
    P.paredes.push(
      [0, 0, 34, 0, 0.9],                                                     // fundo
      [0, 24, 11, 24, 0.12], [13.5, 24, 34, 24, 0.12], [34, 0, 34, 24, 0.12], // frente: só um rodapé, para ver dentro
      [18, 0, 18, 5, 0.6], [18, 5, 20.4, 5, 0.6], [21.6, 5, 24, 5, 0.6],        // depósito
      [24, 0, 24, 13.4, 0.6], [24, 14.6, 24, 24, 0.6]);                       // galpão (porta em y = 14)
    escritorioMatriz(P);
    // Depósito: 8 prateleiras (P01 a P08). Galpão: 12 estantes (R01 a R12).
    [0.3, 3.0].forEach((y, fil) => [18.45, 19.8, 21.15, 22.5].forEach((x, i) =>
      caixa(P, 'prat', x, y, x + 1.05, y + 0.7, 1.0, { cod: 'P0' + (fil * 4 + i + 1) })));
    [1, 7, 13, 19].forEach((y, fil) => [26, 29, 32].forEach((x, col) => caixa(P, 'rack', x, y, x + 1, y + 4, 1.25, { cod: codR(fil * 3 + col + 1) })));
    [25, 28, 31].forEach(x => [3, 9, 15, 21].forEach(y => lugar(P, 'galpao', x, y)));
    [[26.5, 6], [29.5, 12], [32.5, 18], [26.5, 18], [29.5, 6], [32.5, 12]].forEach(([x, y]) => lugar(P, 'galpao', x, y));
    caixa(P, 'ponto', 13.8, 23.2, 14.3, 23.7, 0.95);
    P.entrada = { x: 12.25, y: 24.6, acesso: { x: 12.25, y: 22.6 }, via: [{ x: 12.25, y: 23.6 }] };
    P.vias.push([22.5, 14, 25, 14], [25, 0.6, 25, 23.4], [28, 0.6, 28, 23.4], [31, 0.6, 31, 23.4],
      [25, 6, 33.5, 6], [25, 12, 33.5, 12], [25, 18, 33.5, 18]);
    P.marcas = P.vias.filter(v => v[0] >= 24.9);  // faixas tracejadas no chão do galpão
    P.rotulos.push(
      { chave: 'z_salas', x: 9, y: 0, z: 1.3 }, { chave: 'z_storage', x: 21.3, y: 4.55 }, { chave: 'z_galpao', x: 29, y: 23.6 },
      { chave: 'z_escritorio', x: 8, y: 23.4 }, { chave: 'z_wc', x: 1.6, y: 10.6 }, { chave: 'z_copa', x: 2, y: 23.5 },
      { chave: 'z_ponto', x: 15.6, y: 24.1 }, { chave: 'z_escada', x: 21.2, y: 24.35 });
    P.regras.push({ grupo: 'sala', quem: p => lider(p) && !doAndar2(p) }, { grupo: 'galpao', quem: daArea('log') },
      { grupo: 'mesa', quem: p => !doAndar2(p) }, { grupo: 'empe', quem: todos });
    P.restritas.push({ id: 'galpao', x0: 24, y0: 0, x1: 34, y1: 24, areas: ['log'] });
  })(MAT);
  // O 2º andar da Matriz: mesma parte de escritório, sala de reunião no lugar do depósito.
  const MAT2 = novaPlanta('mat2');
  (function (P) {
    P.zonas.push(
      { id: 'escritorio', x0: 0, y0: 4, x1: 24, y1: 14.5 }, { id: 'escritorio', x0: 3.5, y0: 14.5, x1: 24, y1: 17 }, { id: 'escritorio', x0: 0, y0: 17, x1: 24, y1: 24 }, { id: 'salas', x0: 0, y0: 0, x1: 18, y1: 4 },
      { id: 'reuniao', x0: 18, y0: 0, x1: 24, y1: 5 }, { id: 'wc', x0: 0, y0: 7, x1: 3.5, y1: 11 }, { id: 'copa', x0: 0, y0: 17, x1: 4, y1: 24 });
    P.paredes.push([0, 0, 24, 0, 0.9], [0, 24, 24, 24, 0.12], [24, 0, 24, 24, 0.12],
      [18, 0, 18, 5, 0.6], [18, 5, 20.4, 5, 0.6], [21.6, 5, 24, 5, 0.6]);
    escritorioMatriz(P);
    caixa(P, 'mesa-reuniao', 19.2, 1.3, 22.8, 3.1, 0.42);
    [19.7, 20.9, 22.1].forEach(x => {
      lugar(P, 'reuniao', x, 3.75, { x: 21, y: 6 }, [{ x: 21, y: 3.75 }, { x: 21, y: 5 }]);
      cadeira(P, x, 3.75, -1); cadeira(P, x, 0.75, 1);
    });
    P.entrada = { x: 20.6, y: 22.6, acesso: { x: 20.6, y: 22.6 }, via: [] };   // quem chega aqui em cima vem pela escada
    P.rotulos.push(
      { chave: 'z_salas', x: 9, y: 0, z: 1.3 }, { chave: 'z_reuniao', x: 21, y: 4.55 }, { chave: 'z_escritorio', x: 8, y: 23.4 },
      { chave: 'z_wc', x: 1.6, y: 10.6 }, { chave: 'z_copa', x: 2, y: 23.5 }, { chave: 'z_escada', x: 21.2, y: 24.35 });
    P.regras.push({ grupo: 'sala', quem: p => lider(p) && doAndar2(p) }, { grupo: 'mesa', quem: doAndar2 }, { grupo: 'empe', quem: doAndar2 });
  })(MAT2);
  MAT.andar2 = MAT2;

  // ======== FÁBRICA: chão de produção (3 linhas), manutenção, almoxarifado, administrativo e PÁTIO ========
  // Coluna da esquerda (administrativo, WC, copa, vestiário) abre para um corredor; do corredor
  // se entra na produção (2 portas) e no almoxarifado (1 porta). A manutenção só tem porta
  // para a produção. Na frente do almoxarifado e da manutenção fica o pátio, com caminhões:
  // um encostado na doca do almoxarifado, outro esperando.
  const FAB = novaPlanta('fab');
  (function (P) {
    P.zonas.push(
      { id: 'admin', x0: 0, y0: 0, x1: 10, y1: 9.5 }, { id: 'wc', x0: 0, y0: 9.5, x1: 10, y1: 13 },
      { id: 'copa', x0: 0, y0: 13, x1: 10, y1: 17 }, { id: 'vestiario', x0: 0, y0: 17, x1: 10, y1: 22.8 }, { id: 'vestiario', x0: 0, y0: 22.8, x1: 4, y1: 24 },
      { id: 'corredor', x0: 10, y0: 0, x1: 12, y1: 24 }, { id: 'producao', x0: 12, y0: 0, x1: 34, y1: 13.8 },
      { id: 'almox', x0: 12, y0: 13.8, x1: 21, y1: 21 }, { id: 'manutencao', x0: 21, y0: 13.8, x1: 34, y1: 21 },
      { id: 'patio', x0: 12, y0: 21, x1: 31.5, y1: 24 });
    P.paredes.push(
      [0, 0, 34, 0, 0.9], [0, 0, 0, 24, 0.9],
      [0, 24, 4, 24, 0.12], [4, 22.8, 4, 24, 0.6], [4, 22.8, 10, 22.8, 0.6], [10, 24, 10.2, 24, 0.12],   // recuo do vestiário e entrada
      [11.8, 24, 31.5, 24, 0.12], [34, 0, 34, 8.3, 0.12], [34, 9.5, 34, 21, 0.12], [31.5, 21, 31.5, 21.4, 0.12], [31.5, 23.6, 31.5, 24, 0.12], // pátio e portão
      [10, 0, 10, 3.9, 0.6], [10, 5.1, 10, 8.0, 0.6], [10, 9.2, 10, 10.65, 0.6], [10, 11.85, 10, 14.4, 0.6], // portas da coluna
      [10, 15.6, 10, 19.9, 0.6], [10, 21.1, 10, 24, 0.6],
      [0, 9.5, 10, 9.5, 0.6], [0, 13, 10, 13, 0.6], [0, 17, 10, 17, 0.6],
      [0, 3.5, 1.1, 3.5, 0.6], [1.9, 3.5, 4.1, 3.5, 0.6], [4.9, 3.5, 6, 3.5, 0.6], [3, 0, 3, 3.5, 0.6], [6, 0, 6, 3.5, 0.6], // 2 salas
      [12, 0, 12, 4.1, 0.6], [12, 5.3, 12, 8.3, 0.6], [12, 9.5, 12, 17.15, 0.6], [12, 18.35, 12, 24, 0.6], // corredor | fábrica e pátio
      [12, 13.8, 27.4, 13.8, 0.6], [28.6, 13.8, 34, 13.8, 0.6], [21, 13.8, 21, 21, 0.6],                 // produção | frente; almox | manutenção
      [12, 21, 14.5, 21, 0.6], [18.5, 21, 34, 21, 0.6]);                                                 // frente do prédio, com a doca
    // Administrativo: 2 salas e 2 bancadas (12 mesas).
    for (let k = 0; k < 2; k++) salinha(P, k, 3 * k, 3.5, 4.5);
    bancada(P, 1, 6.6, 4.5, 8.6); bancada(P, 5.5, 6.6, 4.5, 8.6);
    lugar(P, 'empe', 9.6, 4.5); lugar(P, 'empe', 9.6, 8.6);
    [[1.5, 10.4], [1.5, 12.1], [3.5, 10.4], [3.5, 12.1]].forEach(([x, y]) => lugar(P, 'wc', x, y, { x: 11, y: 11.25 }, [{ x: 10, y: 11.25 }]));
    caixa(P, 'cafe', 0.4, 13.4, 1.2, 14.4, 0.72);
    caixa(P, 'mesa-copa', 3.6, 14.7, 5.4, 15.6, 0.42);
    [[1.9, 13.9], [4.5, 14.2], [4.5, 16.25], [6.05, 15.15]].forEach(([x, y]) => lugar(P, 'copa', x, y, { x: 11, y: 15 }, [{ x: 10, y: 15 }]));
    // Vestiário: armários na parede do fundo; quem trabalha na linha ou na manutenção passa por aqui ao chegar.
    caixa(P, 'armario', 0.15, 17.5, 0.75, 23.5, 1.3);
    [18.3, 19.7, 21.1, 22.5].forEach(y => lugar(P, 'vestiario', 1.6, y, { x: 11, y: 20.5 }, [{ x: 10, y: 20.5 }]));
    caixa(P, 'ponto', 11.45, 22.2, 11.85, 22.6, 0.95);
    P.entrada = { x: 11, y: 24.6, acesso: { x: 11, y: 23.4 }, via: [{ x: 11, y: 23.9 }] };
    // Produção: 3 linhas. Cada linha = máquina, esteira, máquina; 11 postos de cada lado da esteira (66 postos).
    const LINHAS = [2.6, 6.8, 11.0], CORREDORES = [0.75, 4.7, 8.9, 12.9];
    LINHAS.forEach((c, i) => {
      caixa(P, 'maquina', 13.3, c - 0.62, 14.4, c + 0.62, 1.1);
      caixa(P, 'esteira', 14.5, c - 0.32, 31.5, c + 0.32, 0.5);
      caixa(P, 'maquina', 31.6, c - 0.62, 32.7, c + 0.62, 1.1);
      for (let k = 0; k < 11; k++) {
        const x = 15.25 + 1.5 * k;
        lugar(P, 'linha', x, c - 0.95, { x, y: CORREDORES[i] });
        lugar(P, 'linha', x, c + 0.95, { x, y: CORREDORES[i + 1] });
      }
      lugar(P, 'maquina', 12.75, c); lugar(P, 'maquina', 33.3, c); // onde a manutenção para ao consertar
    });
    // Manutenção: armários de ferramenta no fundo e 8 bancadas (24 lugares).
    caixa(P, 'armario', 21.5, 14.1, 26.9, 14.7, 1.3); caixa(P, 'armario', 29.1, 14.1, 33.6, 14.7, 1.3);
    [[17.0, 15.4, 18.6], [19.75, 18.6, null]].forEach(([yc, acima, abaixo]) =>
      [[22.0, 24.2], [24.8, 27.0], [29.0, 31.2], [31.6, 33.6]].forEach(([x0, x1]) => {
        caixa(P, 'bancada', x0, yc - 0.4, x1, yc + 0.4, 0.5);
        [x0 + 0.6, x1 - 0.6].forEach(x => {
          lugar(P, 'manut', x, yc - 0.85, { x, y: acima });
          if (abaixo != null) lugar(P, 'manut', x, yc + 0.85, { x, y: abaixo });
        });
      }));
    // Almoxarifado: 6 prateleiras (P01 a P06) no fundo e 12 estantes (R01 a R12) em 2 fileiras de 6.
    // A doca (vão na frente do prédio) dá para o pátio.
    for (let k = 0; k < 6; k++) caixa(P, 'prat', 13.0 + 1.25 * k, 14.2, 13.95 + 1.25 * k, 14.9, 1.0, { cod: 'P0' + (k + 1) });
    [[16.0, 16.9], [18.6, 19.5]].forEach(([y0, y1], fil) => [13.0, 14.3, 15.6, 16.9, 18.2, 19.5].forEach((x, col) =>
      caixa(P, 'rack', x, y0, x + 1.0, y1, 1.3, { cod: codR(fil * 6 + col + 1) })));
    [[14.2, 17.75], [18.2, 17.75], [14.2, 20.35], [16.5, 20.35], [19.8, 20.35]].forEach(([x, y]) => lugar(P, 'galpao', x, y));
    // Pátio: o caminhão é animado (ambiente-mapa.js): entra pelo portão, para na doca e sai pela estrada.
    // Lado de fora: chão externo, a estrada e o galpão anexo (uma linha pequena), ligado à produção
    // por uma porta na parede leste e um caminho. Quem é da linha ou da manutenção vai até lá.
    P.zonas.push({ id: 'externo', x0: 34, y0: 0, x1: 46, y1: 21.4 }, { id: 'estrada', x0: 31.5, y0: 21.4, x1: 46, y1: 23.6 },
      { id: 'caminho', x0: 34, y0: 8.3, x1: 37, y1: 9.5 }, { id: 'anexo', x0: 37, y0: 3, x1: 45, y1: 13 });
    P.paredes.push([37, 3, 45, 3, 0.9], [45, 3, 45, 13, 0.12], [37, 13, 45, 13, 0.12], [37, 3, 37, 8.3, 0.6], [37, 9.5, 37, 13, 0.6]);
    caixa(P, 'maquina', 38.6, 5.4, 39.2, 6.6, 1.1); caixa(P, 'esteira', 39.3, 5.68, 44.0, 6.32, 0.5); caixa(P, 'maquina', 44.1, 5.4, 44.7, 6.6, 1.1);
    [38.0, 39.6, 41.2].forEach(x => caixa(P, 'palete', x, 10.4, x + 1.2, 11.4, 0.3));
    // Os postos do anexo entram ESPALHADOS na lista da linha (um a cada 10): assim a regra manda gente para lá.
    const anexo = [];
    [39.9, 41.4, 42.9].forEach(x => anexo.push({ x, y: 5.05, acesso: { x, y: 4.2 }, via: [] }, { x, y: 6.95, acesso: { x, y: 8.9 }, via: [] }));
    anexo.forEach((l, i) => P.lugares.linha.splice(i * 10, 0, l));
    lugar(P, 'maquina', 43.6, 7.6, { x: 43.6, y: 8.9 });
    P.vias.push([33.3, 8.9, 44, 8.9], [38.2, 4.2, 38.2, 8.9], [38.2, 4.2, 43.5, 4.2]);
    P.rotulos.push({ chave: 'z_anexo', x: 41, y: 3, z: 1.3 }, { chave: 'z_externo', x: 40.5, y: 18 });
    deco(P, 'extintor', 12.1, 0.2, 12.35, 0.45, 0.5); deco(P, 'extintor', 12.1, 13.3, 12.35, 13.55, 0.5);
    [21.4, 24.6].forEach(x => deco(P, 'cone', x, 23.7, x + 0.25, 23.95, 0.3));
    [34.35, 34.85, 35.35, 35.85, 36.35].forEach(x => deco(P, 'pintura', x, 8.4, x + 0.25, 9.4, 0.01));   // faixa de pedestre
    arvore(P, 35.2, 2.0); arvore(P, 35.2, 14.6); arvore(P, 45.2, 15.0); arvore(P, 35.6, 19.6);
    [36, 41, 45.5].forEach(x => poste(P, x, 21.2));
    // Vagas para caminhão parado (carga a sair) na área externa.
    [16.95, 19.25].forEach(y => { deco(P, 'pintura', 37.2, y - 0.9, 44.3, y - 0.86, 0.01); });
    P.vagasCaminhao = [{ x0: 37.5, yc: 16.95 }, { x0: 37.5, yc: 19.25 }];
    P.docaAnimada = { x0: 14.0, yc: 22.4 };   // a doca do almoxarifado: o caminhão que chega, carrega e sai
    P.restritas.push({ id: 'anexo', x0: 37, y0: 3, x1: 45, y1: 13, areas: ['ops', 'man'] });
    P.vias.push(
      [11, 0.6, 11, 23.4],                                                     // corredor principal
      [1.5, 4.5, 11, 4.5], [1.5, 8.6, 11, 8.6],                                // administrativo
      [12.75, 0.75, 33.3, 0.75], [11, 4.7, 33.3, 4.7], [11, 8.9, 33.3, 8.9], [12.75, 12.9, 33.3, 12.9], // produção
      [12.75, 0.75, 12.75, 12.9], [33.3, 0.75, 33.3, 12.9],
      [28, 12.9, 28, 18.6], [21.6, 15.4, 33.4, 15.4], [21.6, 18.6, 33.4, 18.6],  // manutenção
      [11, 17.75, 20.6, 17.75], [12.5, 20.35, 20.6, 20.35], [12.5, 17.75, 12.5, 20.35]); // almoxarifado
    // Faixas tracejadas dos corredores da produção (cortadas na parede: não entram no corredor principal).
    P.marcas = P.vias.slice(3, 9).map(v => (v[1] === v[3] ? [Math.max(v[0], 12.4), v[1], v[2], v[3]] : v));
    P.rotulos.push(
      { chave: 'z_admin', x: 5, y: 0, z: 1.3 }, { chave: 'z_producao', x: 14, y: 0, z: 1.3 },
      { chave: 'z_wc', x: 7.5, y: 12.6 }, { chave: 'z_copa', x: 8, y: 16.6 }, { chave: 'z_vestiario', x: 6, y: 22.4 },
      { chave: 'z_almox', x: 16.5, y: 20.8 }, { chave: 'z_manutencao', x: 27.5, y: 20.65 }, { chave: 'z_patio', x: 21.8, y: 23.8 },
      { chave: 'z_ponto', x: 13.4, y: 24.35 });
    P.regras.push({ grupo: 'sala', quem: lider }, { grupo: 'linha', quem: daArea('ops') }, { grupo: 'manut', quem: daArea('man') },
      { grupo: 'galpao', quem: daArea('log') }, { grupo: 'mesa', quem: todos }, { grupo: 'empe', quem: todos });
    // Produção: Operações e Manutenção (a manutenção entra para consertar máquina). No pátio, ninguém.
    P.restritas.push(
      { id: 'producao', x0: 12, y0: 0, x1: 34, y1: 13.8, areas: ['ops', 'man'] },
      { id: 'manutencao', x0: 21, y0: 13.8, x1: 34, y1: 21, areas: ['man'] },
      { id: 'almox', x0: 12, y0: 13.8, x1: 21, y1: 21, areas: ['log'] },
      { id: 'patio', x0: 12, y0: 21, x1: 34, y1: 24, areas: [] });
  })(FAB);

  // ======== CENTRO DE DISTRIBUIÇÃO: galpão grande (24 estantes e 4 docas) e escritório pequeno ========
  const CD = novaPlanta('cd');
  (function (P) {
    // Prédio: escritório à esquerda, galpão até x = 30 e, na fachada leste, 4 portas de doca
    // com a plataforma por dentro. Lado de fora: o pátio cercado (chão de concreto), com os
    // caminhões encostados de ré nas portas, e o portão na frente. O lote tem um recorte (vizinho).
    P.zonas.push(
      { id: 'patio', x0: 30, y0: 0, x1: 42, y1: 24 }, { id: 'patio', x0: 42, y0: 1.5, x1: 46, y1: 24 },
      { id: 'escritorio', x0: 0, y0: 0, x1: 8, y1: 9.4 }, { id: 'wc', x0: 0, y0: 9.4, x1: 8, y1: 12.6 },
      { id: 'copa', x0: 0, y0: 12.6, x1: 8, y1: 16.4 }, { id: 'storage', x0: 0, y0: 16.4, x1: 8, y1: 20 },
      { id: 'lobby', x0: 0, y0: 20, x1: 8, y1: 24 }, { id: 'corredor', x0: 8, y0: 0, x1: 9.6, y1: 24 },
      { id: 'galpao', x0: 9.6, y0: 0, x1: 30, y1: 24 }, { id: 'plataforma', x0: 28.9, y0: 0.4, x1: 30, y1: 23.6 });
    [3, 9, 15, 21].forEach(c => P.zonas.push({ id: 'doca', x0: 29.2, y0: c - 0.8, x1: 30, y1: c + 0.8 })); // nivelador da doca
    P.paredes.push(
      [0, 0, 30, 0, 0.9], [0, 0, 0, 24, 0.9],
      [0, 24, 3.4, 24, 0.12], [5.0, 24, 30, 24, 0.12],                          // entrada pelo saguão
      [30, 0, 30, 2.1, 0.9], [30, 3.9, 30, 8.1, 0.9], [30, 9.9, 30, 14.1, 0.9], [30, 15.9, 30, 20.1, 0.9], [30, 21.9, 30, 24, 0.9], // fachada com 4 portas
      [30, 0, 42, 0, 0.3], [42, 0, 42, 1.5, 0.3], [42, 1.5, 46, 1.5, 0.3], [30, 24, 46, 24, 0.3], // cerca; os caminhões entram pela estrada, à direita
      [8, 0, 8, 4.0, 0.6], [8, 5.2, 8, 7.9, 0.6], [8, 9.1, 8, 10.4, 0.6], [8, 11.6, 8, 13.9, 0.6], [8, 15.1, 8, 18.0, 0.6],
      [8, 19.2, 8, 21.4, 0.6], [8, 22.6, 8, 24, 0.6],
      [0, 9.4, 8, 9.4, 0.6], [0, 12.6, 8, 12.6, 0.6], [0, 16.4, 8, 16.4, 0.6], [0, 20, 8, 20, 0.6],
      [0, 3.5, 1.1, 3.5, 0.6], [1.9, 3.5, 3, 3.5, 0.6], [3, 0, 3, 3.5, 0.6],      // sala da supervisão
      [9.6, 0, 9.6, 5.4, 0.6], [9.6, 6.6, 9.6, 11.4, 0.6], [9.6, 12.6, 9.6, 17.4, 0.6], [9.6, 18.6, 9.6, 24, 0.6]); // corredor | galpão
    // Escritório: a sala da supervisão e uma bancada (6 mesas).
    salinha(P, 0, 0, 3.5, 4.6);
    bancada(P, 1, 6.6, 4.6, 8.5);
    lugar(P, 'empe', 6.0, 4.6); lugar(P, 'empe', 6.0, 8.5);
    [[1.5, 10.3], [1.5, 11.8], [3.5, 10.3], [3.5, 11.8]].forEach(([x, y]) => lugar(P, 'wc', x, y, { x: 8.8, y: 11.0 }, [{ x: 8, y: 11.0 }]));
    caixa(P, 'cafe', 0.4, 13.0, 1.2, 14.0, 0.72);
    caixa(P, 'mesa-copa', 3.0, 14.2, 4.8, 15.1, 0.42);
    [[1.9, 13.3], [3.9, 13.55], [3.9, 15.7], [5.35, 14.65]].forEach(([x, y]) => lugar(P, 'copa', x, y, { x: 8.8, y: 14.5 }, [{ x: 8, y: 14.5 }]));
    // Depósito do escritório: 4 prateleiras (P01 a P04). Saguão com o relógio de ponto.
    [0.6, 2.2, 3.8, 5.4].forEach((x, i) => caixa(P, 'prat', x, 16.8, x + 1.0, 17.5, 1.0, { cod: 'P0' + (i + 1) }));
    caixa(P, 'ponto', 5.6, 22.9, 6.0, 23.3, 0.95);
    P.entrada = { x: 4.2, y: 24.6, acesso: { x: 4.2, y: 22.0 }, via: [{ x: 4.2, y: 23.6 }] };
    // Galpão: 6 colunas x 4 fileiras de estantes (R01 a R24) e estações de separação nos corredores.
    // Na plataforma, junto de cada porta: paletes esperando e um lugar de conferência.
    [[1, 5], [7, 11], [13, 17], [19, 23]].forEach(([y0, y1], f) => [11, 14, 17, 20, 23, 26].forEach((x, c) =>
      caixa(P, 'rack', x, y0, x + 1, y1, 1.25, { cod: codR(f * 6 + c + 1) })));
    [10.3, 13, 16, 19, 22, 25].forEach(x => [3, 9, 15, 21].forEach(y => lugar(P, 'galpao', x, y)));
    [3, 9, 15, 21].forEach(c => { caixa(P, 'palete', 28.9, c + 0.95, 29.8, c + 1.85, 0.3); lugar(P, 'galpao', 29.4, c, { x: 28.5, y: c }); });
    caixa(P, 'empilhadeira', 27.9, 12.6, 28.4, 13.6, 0.55); caixa(P, 'empilhadeira', 27.8, 12.75, 27.9, 13.45, 1.35);
    // Caminhões das cargas a sair (desenhados pela tela): encostados de ré nas 4 portas e em 2 vagas do pátio.
    P.vagasCaminhao = [3, 9, 15, 21].map(c => ({ x0: 30.15, yc: c })).concat([{ x0: 31, yc: 12.05 }, { x0: 30.4, yc: 23.05 }]);
    [11.2, 12.9, 22.2, 23.9].forEach(y => deco(P, 'pintura', 30.6, y - 0.03, 37.4, y + 0.03, 0.01));   // marcação das vagas
    poste(P, 39.5, 6.0); poste(P, 44.5, 18.0); poste(P, 39.5, 18.0);   // entre as linhas dos caminhões
    deco(P, 'extintor', 9.7, 0.2, 9.95, 0.45, 0.5); deco(P, 'extintor', 9.7, 23.5, 9.95, 23.75, 0.5);
    [[27.6, 0.4], [27.6, 23.3]].forEach(([x, y]) => deco(P, 'cone', x, y, x + 0.25, y + 0.25, 0.3));
    vaso(P, 7.5, 9.0);
    P.vias.push(
      [8.8, 0.6, 8.8, 22.0], [4.2, 22.0, 8.8, 22.0],                           // corredor e saguão
      [1.5, 4.6, 8.8, 4.6], [1.5, 8.5, 8.8, 8.5],                              // escritório
      [8.8, 6, 28.5, 6], [8.8, 12, 28.5, 12], [8.8, 18, 28.5, 18]);           // corredores do galpão (portas em 6, 12 e 18)
    [10.3, 13, 16, 19, 22, 25, 28.5].forEach(x => P.vias.push([x, 1, x, 23]));
    P.marcas = P.vias.filter(v => Math.min(v[0], v[2]) >= 10).concat([[9.6, 6, 28.5, 6], [9.6, 12, 28.5, 12], [9.6, 18, 28.5, 18]]);
    P.rotulos.push(
      { chave: 'z_escr', x: 4.5, y: 0, z: 1.3 }, { chave: 'z_galpao', x: 14, y: 0, z: 1.3 },
      { chave: 'z_wc', x: 6.4, y: 12.2 }, { chave: 'z_copa', x: 6.6, y: 16.0 }, { chave: 'z_storage', x: 4.4, y: 19.6 },
      { chave: 'z_ponto', x: 6.5, y: 24.35 }, { chave: 'z_docas', x: 27.6, y: 23.6 }, { chave: 'z_patio', x: 33.5, y: 16 });
    // No CD, Logística operacional e técnica fica no galpão e nas docas; de analista para cima
    // (analista, especialista, coordenação) senta no escritório; a gerência, na sala.
    const doGalpao = p => p.area === 'log' && !lider(p) && ['apr', 'est', 'ope', 'tcn'].includes(p.nivel);
    P.regras.push({ grupo: 'sala', quem: lider }, { grupo: 'galpao', quem: doGalpao }, { grupo: 'mesa', quem: todos }, { grupo: 'empe', quem: todos });
    P.restritas.push({ id: 'galpao', x0: 9.6, y0: 0, x1: 30, y1: 24, areas: ['log'] }, { id: 'patio', x0: 30, y0: 0, x1: 46, y1: 24, areas: [] });
  })(CD);
  const PLANTAS = { mat: MAT, fab: FAB, cd: CD };
  Object.values(PLANTAS).forEach(cargas);   // a carga vai por último: precisa das estantes prontas

  // ---------------------------------------------------------------- 4. INVENTÁRIO
  // CATEGORIA = o que o item É (Alimentação, EPI...). ÁREA = de quem é o estoque: as mesmas
  // áreas das pessoas (Logística, Manutenção...), para um filtro só acender as duas coisas.
  const CATS = {
    ali: { pt: 'Alimentação', en: 'Food' },
    emb: { pt: 'Embalagem', en: 'Packaging' },
    epi: { pt: 'EPI e uniforme', en: 'PPE & uniform' },
    equ: { pt: 'Equipamento', en: 'Equipment' },
    esc: { pt: 'Escritório', en: 'Office' },
    lim: { pt: 'Limpeza', en: 'Cleaning' },
    ti: { pt: 'TI', en: 'IT' }
  };
  // Catálogo: [código, nome PT, nome EN, categoria, área, endereço padrão, mínimo de referência].
  // P = prateleira (itens pequenos); R = estante (volume grande).
  const CATALOGO = [
    ['NB', 'Notebook', 'Laptop', 'ti', 'tec', 'P01', 6], ['MO', 'Monitor 24"', '24" monitor', 'ti', 'tec', 'P01', 8],
    ['HS', 'Headset', 'Headset', 'ti', 'tec', 'P02', 10], ['TM', 'Teclado e mouse', 'Keyboard and mouse', 'ti', 'tec', 'P02', 12],
    ['HD', 'Cabo HDMI', 'HDMI cable', 'ti', 'tec', 'P02', 15],
    ['PA', 'Papel A4 (caixa)', 'A4 paper (box)', 'esc', 'pes', 'P03', 10], ['TO', 'Toner de impressora', 'Printer toner', 'esc', 'pes', 'P03', 4],
    ['CD', 'Cadeira de escritório', 'Office chair', 'esc', 'pes', 'R10', 4],
    ['KI', 'Kit de integração', 'Onboarding kit', 'esc', 'pes', 'P08', 6], ['CR', 'Crachá', 'Badge', 'esc', 'pes', 'P08', 15],
    ['CA', 'Café em grãos (kg)', 'Coffee beans (kg)', 'ali', 'pes', 'P04', 6], ['AU', 'Açúcar (kg)', 'Sugar (kg)', 'ali', 'pes', 'P04', 5],
    ['AG', 'Água mineral (galão 20 L)', 'Mineral water (20 L jug)', 'ali', 'pes', 'R10', 8], ['CY', 'Copo descartável (pacote)', 'Paper cups (pack)', 'ali', 'pes', 'P04', 10],
    ['LI', 'Kit de limpeza', 'Cleaning kit', 'lim', 'pes', 'P04', 8], ['PT', 'Papel toalha (fardo)', 'Paper towels (bale)', 'lim', 'pes', 'R12', 6],
    ['CP', 'Capacete', 'Hard hat', 'epi', 'ops', 'P05', 20], ['LU', 'Luvas (par)', 'Gloves (pair)', 'epi', 'ops', 'P05', 40],
    ['OC', 'Óculos de proteção', 'Safety glasses', 'epi', 'ops', 'P06', 25], ['PR', 'Protetor auricular', 'Ear protection', 'epi', 'ops', 'P06', 50],
    ['BO', 'Botina (par)', 'Safety boots (pair)', 'epi', 'ops', 'R11', 15], ['CM', 'Camiseta da empresa', 'Company T-shirt', 'epi', 'pes', 'R12', 20],
    ['PB', 'Palete de madeira', 'Wooden pallet', 'emb', 'log', 'R01', 30], ['PP', 'Palete plástico', 'Plastic pallet', 'emb', 'log', 'R02', 10],
    ['CT', 'Cantoneira de papelão', 'Cardboard edge guard', 'emb', 'log', 'R03', 60], ['FS', 'Filme stretch (rolo)', 'Stretch film (roll)', 'emb', 'log', 'R04', 12],
    ['CX', 'Caixa de papelão', 'Cardboard box', 'emb', 'log', 'R05', 80], ['ET', 'Etiqueta térmica (rolo)', 'Thermal label (roll)', 'emb', 'log', 'P07', 20],
    ['FT', 'Fita adesiva', 'Packing tape', 'emb', 'log', 'P07', 24],
    ['RO', 'Rolamento', 'Bearing', 'equ', 'man', 'R06', 10], ['CO', 'Correia', 'Drive belt', 'equ', 'man', 'R06', 6],
    ['OL', 'Óleo lubrificante (L)', 'Lubricant oil (L)', 'equ', 'man', 'R07', 20], ['FE', 'Jogo de ferramentas', 'Tool set', 'equ', 'man', 'R08', 3],
    ['FI', 'Filtro de ar', 'Air filter', 'equ', 'man', 'R09', 8]
  ];
  // O catálogo traz o endereço PADRÃO (P01 a P08, R01 a R12). Cada planta tem as SUAS
  // prateleiras: o endereço vira uma que existe nela, sempre do mesmo jeito. Passo a passo:
  // (1) lista as prateleiras daquele tipo na planta; (2) se a planta tem o dobro (o CD tem
  // 24 estantes), pula de 2 em 2 para espalhar pelo galpão; (3) se tem menos (a Fábrica tem
  // 6 prateleiras), volta ao começo da lista e duas famílias de itens dividem a prateleira.
  function enderecar(P, cod) {
    const tipo = cod[0], n = parseInt(cod.slice(1), 10);
    const lista = P.moveis.filter(m => m.cod && m.cod[0] === tipo).map(m => m.cod).sort();
    const passo = Math.max(1, Math.floor(lista.length / (tipo === 'P' ? 8 : 12)));
    return lista[((n - 1) * passo) % lista.length];
  }
  // Quanto do estoque de cada área cada unidade guarda (a fábrica gasta EPI, o CD gasta embalagem...).
  const FATOR = {
    mat: { tec: 1, pes: 1, ops: 0.35, log: 0.3, man: 0.25 },
    fab: { tec: 0.4, pes: 0.6, ops: 1.6, log: 0.8, man: 1.5 },
    cd: { tec: 0.3, pes: 0.4, ops: 0.8, log: 2.2, man: 0.5 }
  };
  // Situação: zerado (0), baixo (abaixo do mínimo) ou ok. O sorteio força alguns
  // zerados e baixos em toda unidade, para o filtro de situação ter o que mostrar.
  const inventario = [];
  Object.keys(FATOR).forEach(u => CATALOGO.forEach(c => {
    const R = semente(hash('estoque-' + u + '-' + c[0]));
    const minimo = Math.max(1, Math.round(c[6] * FATOR[u][c[4]]));
    const s = R();
    let qtd;
    if (s < 0.1) qtd = 0;
    else if (s < 0.28) qtd = Math.max(1, Math.floor(minimo * (0.2 + R() * 0.7)));
    else qtd = Math.round(minimo * (1.1 + R() * 2.2));
    inventario.push({ id: u + '-' + c[0], codigo: c[0], nome: { pt: c[1], en: c[2] }, cat: c[3], area: c[4], prat: enderecar(PLANTAS[u], c[5]), unidade: u,
      qtd, minimo, sit: qtd === 0 ? 'zerado' : qtd < minimo ? 'baixo' : 'ok' });
  }));

  // Recebimentos do dia na Fábrica, de fornecedores INVENTADOS: hora prevista, hora de chegada
  // (vazia = ainda não chegou), o item do catálogo e a quantidade. A situação depende da hora:
  // chegou = recebido; passou da hora e não chegou = atrasado; senão, previsto.

  // ---------------------------------------------------------------- EXPEDIÇÕES DO DIA (fictícias)
  // Caminhões com carga a sair: placa inventada, destino, carga, hora de saída e chegada prevista.
  // Antes da hora de saída, o caminhão espera numa doca ou vaga; depois, aparece em "Saíram".
  const DESTINOS = ['Teresina', 'Fortaleza', 'Recife', 'Natal', 'Salvador', 'Palmas', 'Imperatriz', 'Caxias'];
  const CARGAS = [{ pt: 'Produto acabado', en: 'Finished goods' }, { pt: 'Peças de reposição', en: 'Spare parts' },
    { pt: 'Embalagens', en: 'Packaging' }, { pt: 'Material de escritório', en: 'Office supplies' },
    { pt: 'Equipamentos de proteção', en: 'Safety equipment' }];
  const LETRAS = 'ABCDEFGHJKLMNPRSTUVWXYZ';
  const placa = R => [0, 0, 0].map(() => LETRAS[Math.floor(R() * LETRAS.length)]).join('') + Math.floor(R() * 10) +
    LETRAS[Math.floor(R() * LETRAS.length)] + String(Math.floor(R() * 100)).padStart(2, '0');   // padrão Mercosul, inventada
  const EXPEDICOES = [];
  [['cd', 8, 450, 1050], ['fab', 4, 540, 1020]].forEach(([u, n, ini, fim]) => {
    const R = semente(hash('expedicao-' + u));
    for (let i = 0; i < n; i++) {
      const saida = Math.round(ini + (fim - ini) * (i + 0.2 + R() * 0.6) / n);
      EXPEDICOES.push({ id: u + '-E' + (i + 1), unidade: u, placa: placa(R), destino: DESTINOS[Math.floor(R() * DESTINOS.length)],
        carga: CARGAS[Math.floor(R() * CARGAS.length)], saida, chegada: Math.min(23 * 60 + 50, saida + 120 + Math.round(R() * 300)) });
    }
  });

  const RECEBIMENTOS = [
    { id: 'RB1', fornecedor: 'Embalagens Serra Azul', codigo: 'FS', qtd: 24, previsto: 510, chegada: 521 },
    { id: 'RB2', fornecedor: 'Rolamentos Vale Verde', codigo: 'RO', qtd: 20, previsto: 600, chegada: 640 },
    { id: 'RB3', fornecedor: 'EPI Norte Distribuidora', codigo: 'LU', qtd: 120, previsto: 690, chegada: 686 },
    { id: 'RB4', fornecedor: 'Madeireira Ponte Alta', codigo: 'PB', qtd: 40, previsto: 840, chegada: null },
    { id: 'RB5', fornecedor: 'Lubrificantes Três Rios', codigo: 'OL', qtd: 60, previsto: 930, chegada: 935 }
  ].map(r => Object.assign({ unidade: 'fab', item: 'fab-' + r.codigo }, r));

  return {
    ABRE, FECHA, dia: DIA, marcacoes, pessoaPorId, aberto, presentes, cadastro,
    cats: CATS, inventario, recebimentos: RECEBIMENTOS, expedicoes: EXPEDICOES, W, H, plantas: PLANTAS,
    semente, hash
  };
})();
