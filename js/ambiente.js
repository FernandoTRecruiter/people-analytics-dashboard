/* =============================================================================
   ambiente.js: a aba "Meu ambiente" (quem bateu o ponto, o mapa e o estoque).

   Contrato com o app (app.js):
   - PAGINAS.ambiente(r, ctx) devolve só a casca: <section id="s-ambiente"> com uma div vazia;
   - AMBIENTE.montar(el, ctx) desenha a aba dentro dessa div e liga a animação;
   - AMBIENTE.desmontar() para tudo (animação, câmera, timers, ouvintes). O app chama no
     começo de todo redesenho (trocar idioma ou tema), e depois monta de novo.
   O ESTADO da aba (unidade, filtros, câmera, pessoa em foco, andar) mora neste arquivo, fora
   do desenho: por isso sobrevive ao remontar.

   Desenho da tela:
   [unidades | agora: hora, quantos na unidade, botão Histórico]
   [Histórico do dia (quando aberto): resumo, recebimentos do pátio e a lista de marcações]
   [lista de presentes, recolhível] [barra de vista e filtros
                                     MAPA na largura toda; por cima dele: câmera, minimapa,
                                     a pessoa em foco e, à direita, avisos + estoque (recolhível)]
   [janelinhas de explicação]
   O relógio é sempre AO VIVO: a hora do visitante aplicada ao dia de exemplo.
   ============================================================================= */
(function () {
  'use strict';
  const A = window.AMBIENTE_DADOS, MP = window.AMBIENTE_MAPA, G = window.GRAFICOS;
  // Sem os dados fictícios (modo com dado de verdade), a aba não se registra: o app não mostra
  // a aba "Meu ambiente" quando PAGINAS.ambiente não existe.
  if (!A || !MP) return;
  const VB = MP.VB;

  // ---------------------------------------------------------------- 1. TEXTOS
  // Dicionário próprio da aba (o i18n.js do app não é editado). [português, inglês].
  // Regra: em português, nenhuma palavra em inglês; em inglês, nenhuma em português
  // (só nomes próprios: pessoas e fornecedores). O teste automático confere a tela.
  const TXT = {
    titulo: ['Meu ambiente', 'My workplace'],
    sub: ['Quem bateu o ponto e ainda não saiu · dia de exemplo {d} · dados fictícios', 'Who clocked in and has not left yet · sample day {d} · fictional data'],
    unidade: ['Unidade', 'Site'],
    agora: ['na unidade agora', 'on site now'], de_m: ['de {m}', 'of {m}'],
    rem_agora: ['com ponto remoto aberto agora', 'clocked in remotely now'],
    vivo: ['Ao vivo: a hora do seu relógio aplicada ao dia de exemplo', 'Live: your clock time applied to the sample day'],
    fora: ['Fora do horário comercial: o mapa mostra o dia de exemplo a partir das 10:30.', 'Outside business hours: the map shows the sample day from 10:30.'],
    // histórico do dia
    hist: ['Histórico', 'History'], hist_tit: ['Histórico do dia · {u}', "Today's log · {u}"],
    hist_bateram: ['bateram o ponto', 'clocked in'], hist_presentes: ['presentes agora', 'on site now'],
    hist_saidas: ['saídas', 'clocked out'], hist_receb: ['recebimentos', 'deliveries'],
    hist_vazio: ['Nenhuma marcação até agora', 'No punches so far'],
    c_hora: ['Hora', 'Time'], c_quem: ['Quem', 'Who'], c_evento: ['Evento', 'Event'],
    ev_entrada: ['Entrada', 'Clock-in'], ev_saida: ['Saída', 'Clock-out'], ev_receb: ['Recebimento', 'Delivery'],
    rb_tit: ['Recebimentos de hoje pelo pátio', "Today's deliveries through the yard"],
    rb_ok: ['Recebido às {h}', 'Received at {h}'], rb_prev: ['Previsto para {h}', 'Due at {h}'], rb_atraso: ['Atrasado: previsto para {h}', 'Late: due at {h}'],
    rec_hoje: ['Recebido hoje {h} · +{q}', 'Received today {h} · +{q}'],
    patio: ['Pátio: ver os recebimentos de hoje', "Yard: see today's deliveries"],
    // janela por cima do mapa (abas) e a tabela de quem está na unidade
    janela: ['Estoque e equipe da unidade', 'Site stock and team'],
    aba_atencao: ['Atenção', 'Attention'], aba_estoque: ['Estoque', 'Stock'], aba_turno: ['Em turno', 'On shift'], aba_expedicao: ['Expedição', 'Shipping'],
    sub_asair: ['A sair', 'To leave'], sub_sairam: ['Saíram', 'Left'],
    c_placa: ['Placa', 'Plate'], c_destino: ['Destino', 'Destination'], c_carga: ['Carga', 'Load'],
    c_prev_saida: ['Saída prevista', 'Scheduled departure'], c_saida: ['Saída', 'Departed'], c_chegada: ['Chegada prevista', 'Expected arrival'],
    exp_vazio: ['Nenhum caminhão aqui', 'No trucks here'], buscar_e: ['Buscar placa, destino ou carga', 'Search plate, destination or load'],
    exp_parado: ['{p} · {d} · {c} · saída prevista {h}', '{p} · {d} · {c} · scheduled departure {h}'],
    exp_saiu: ['{p} · {d} · {c} · saiu às {h}', '{p} · {d} · {c} · left at {h}'],
    buscar_t: ['Buscar pessoa, área ou onde está', 'Search person, area or place'], sem_turno: ['Ninguém com essa busca', 'Nobody matches this search'],
    c_ponto: ['Ponto', 'Time clock'], st_presente: ['Presente', 'Present'], st_saiu: ['Saiu às {h}', 'Left at {h}'],
    escada: ['Escada: trocar de andar', 'Stairs: change floor'],
    f_todas: ['{f}: todas ({n})', '{f}: all ({n})'],
    // barra do mapa
    vista: ['Vista', 'View'], v3d: ['3D', '3D'], vplanta: ['Planta', 'Floor plan'],
    andar: ['Andar', 'Floor'], andar_1: ['1º andar', '1st floor'], andar_2: ['2º andar', '2nd floor'],
    girar_e: ['Girar à esquerda', 'Rotate left'], girar_d: ['Girar à direita', 'Rotate right'],
    tudo: ['Enquadrar tudo', 'Fit all'], focar: ['Focar a seleção', 'Focus selection'], mais: ['Aproximar', 'Zoom in'], menos: ['Afastar', 'Zoom out'],
    presentes: ['Presentes', 'On site'], camadas: ['Camadas', 'Layers'],
    k_pessoas: ['Pessoas', 'People'], k_estoque: ['Estoque', 'Stock'], k_nomes: ['Rótulos', 'Labels'], k_baixas: ['Paredes baixas', 'Low walls'],
    dica_cam: ['Arraste para mover · roda do mouse para aproximar · passe o mouse numa pessoa para ela parar · clique para focar',
      'Drag to pan · scroll to zoom · hover over a person to make them stop · click to focus'],
    // filtros
    f_cat: ['Categoria', 'Category'], f_area: ['Área', 'Area'], f_sit: ['Situação', 'Status'], limpar: ['Limpar', 'Clear'],
    todas: ['Todas', 'All'],
    s_ok: ['Normal', 'OK'], s_baixo: ['Baixo', 'Low'], s_zerado: ['Zerado', 'Out'],
    // tabela do estoque (janela recolhível dentro do mapa)
    estoque: ['Estoque da unidade', 'Site stock'], est_abrir: ['Abrir o estoque', 'Expand the stock'], est_fechar: ['Recolher o estoque', 'Collapse the stock'],
    c_item: ['Item', 'Item'], c_cat: ['Categoria', 'Category'], c_area: ['Área', 'Area'], c_qtd: ['Qtd', 'Qty'], c_min: ['Mín', 'Min'],
    c_prat: ['Prat.', 'Shelf'], c_sit: ['Situação', 'Status'],
    buscar: ['Buscar item, categoria, área ou prateleira', 'Search item, category, area or shelf'],
    itens: ['{n} itens', '{n} items'], item_1: ['1 item', '1 item'], sem_itens: ['Nada com esses filtros', 'Nothing with these filters'], prat: ['Prateleira {c}', 'Shelf {c}'],
    aria_mapa: ['Mapa ilustrativo da unidade {u}: {n} pessoas com ponto aberto', 'Illustrative map of {u}: {n} people clocked in'],
    // avisos de estoque
    av_tit: ['Estoque pedindo atenção', 'Stock needing attention'], av_vazio: ['Nenhum item baixo ou zerado', 'No low or empty items'],
    av_abrir: ['Abrir os avisos de estoque', 'Open stock alerts'],
    // lista de presentes
    buscar_p: ['Buscar pessoa', 'Search person'], sem_pessoas: ['Ninguém com esses filtros', 'Nobody with these filters'],
    fechar_lista: ['Recolher a lista', 'Collapse the list'],
    // janela da pessoa
    fi_area: ['Área', 'Area'], fi_cargo: ['Nível', 'Level'], fi_unidade: ['Unidade', 'Site'], fi_andar: ['Andar', 'Floor'], fi_entrada: ['Entrada no ponto', 'Clock-in'],
    fi_casa: ['Tempo de casa', 'Tenure'], fi_sit: ['Situação', 'Status'],
    fi_presente: ['Presente: ponto aberto', 'On site: clocked in'], fi_semsaida: ['Sem saída registrada até agora', 'No clock-out recorded so far'],
    anos: ['{n} anos', '{n} years'], meses: ['{n} meses', '{n} months'], fi_ilustra: ['Retrato ilustrado, não é foto', 'Illustrated portrait, not a photo'],
    // zonas (rótulos do mapa)
    z_salas: ['Salas', 'Rooms'], z_storage: ['Depósito', 'Storage room'], z_galpao: ['Galpão', 'Warehouse'], z_escritorio: ['Escritório', 'Office'],
    z_wc: ['Banheiro', 'Restroom'], z_copa: ['Copa', 'Pantry'], z_ponto: ['Ponto', 'Time clock'],
    z_admin: ['Administrativo', 'Administration'], z_producao: ['Produção', 'Production'], z_manutencao: ['Manutenção', 'Maintenance'],
    z_almox: ['Almoxarifado', 'Storeroom'], z_vestiario: ['Vestiário', 'Locker room'], z_docas: ['Docas', 'Docks'], z_escr: ['Escritório', 'Office'],
    z_escada: ['Escada', 'Stairs'], z_anexo: ['Galpão anexo', 'Annex building'], z_externo: ['Área externa', 'Outdoor area'],
    z_plataforma: ['Plataforma', 'Dock platform'], z_reuniao: ['Reunião', 'Meeting room'], z_patio: ['Pátio', 'Yard'],
    fechar: ['Fechar', 'Close'],
    c_nome: ['Nome', 'Name'], c_nivel: ['Nível', 'Level'], c_entrada: ['Entrada', 'Clock-in'],
    rem_nota: ['Remoto não tem mapa: o ponto diz que a pessoa está trabalhando, não onde.', 'Remote has no map: the punch says the person is working, not where.'],
    rem_vazio: ['Ninguém com ponto remoto aberto nesta hora', 'Nobody clocked in remotely at this time'],
    // janelinhas de explicação
    n_oque: ['O que é', 'What it is'], n_onde: ['De onde vem', 'Where it comes from'], n_cuidado: ['Cuidado', 'Watch out'],
    na_tit: ['Quem aparece no mapa', 'Who shows up on the map'],
    na_oque: ['Quem bateu a entrada e ainda não bateu a saída.', 'Whoever clocked in and has not clocked out yet.'],
    na_onde: ['Relógio de ponto → marcações do dia → carga → mapa.', 'Time clock → the day\'s punches → data load → map.'],
    na_cuidado: ['As marcações daqui são fictícias, sorteadas por pessoa.', 'The punches here are fictional, drawn per person.'],
    nb_tit: ['A posição é ilustrativa', 'Positions are illustrative'],
    nb_oque: ['O ponto diz QUEM está na unidade, não ONDE.', 'The time clock says WHO is on site, not WHERE.'],
    nb_onde_mat: ['Cada boneco segue a regra do cargo e da área. 1º andar: mesa no escritório, sala da gerência, galpão só para Logística. 2º andar: Diretoria, Financeiro, Pessoas & Cultura e Jurídico.',
      'Each figure follows a rule by role and area. 1st floor: office desk, manager\'s room, warehouse for Logistics only. 2nd floor: Board, Finance, People & Culture and Legal.'],
    nb_onde_fab: ['Cada boneco anda pela regra da área: Operações nos postos da linha, Manutenção nas bancadas, Logística no almoxarifado, o resto no administrativo.', 'Each figure follows a rule by area: Operations at the line stations, Maintenance at the benches, Logistics in the storeroom, everyone else in the administration block.'],
    nb_onde_cd: ['Cada boneco anda pela regra do cargo: Logística operacional e técnica no galpão e nas docas, analistas e coordenação no escritório, gerência na sala.', 'Each figure follows a rule by role: operational and technical Logistics in the warehouse and at the docks, analysts and coordinators in the office, the manager in the room.'],
    nb_cuidado: ['Não é rastreamento de pessoas: ninguém é localizado.', 'This is not people tracking: nobody is located.'],
    nc_tit: ['Marcação errada, mapa errado', 'Wrong punch, wrong map'],
    nc_oque: ['O mapa é tão bom quanto a marcação.', 'The map is only as good as the punch.'],
    nc_onde: ['Esqueceu a saída: fica no mapa até o fim do dia. Bateu em outra unidade: aparece no mapa errado.', 'Forgot to clock out: stays on the map until the end of the day. Clocked in at another site: shows up on the wrong map.'],
    nc_cuid_0: ['Neste dia, ninguém desta unidade esqueceu a saída.', 'On this day, nobody at this site forgot to clock out.'],
    nc_cuid_1: ['Neste dia, 1 pessoa desta unidade esqueceu a saída.', 'On this day, 1 person at this site forgot to clock out.'],
    nc_cuid_n: ['Neste dia, {n} pessoas desta unidade esqueceram a saída.', 'On this day, {n} people at this site forgot to clock out.'],
    nd_tit: ['Estoque e prateleiras', 'Stock and shelves'],
    nd_oque: ['O que cada unidade tem guardado, por categoria e por área dona do estoque.', 'What each site keeps in stock, by category and by the area that owns it.'],
    nd_onde_mat: ['Contagem do almoxarifado. P01 a P08 = prateleiras do depósito; R01 a R12 = estantes do galpão.', 'Storeroom count. P01 to P08 = storage room shelves; R01 to R12 = warehouse racks.'],
    nd_onde_fab: ['Contagem do almoxarifado mais o que chegou hoje pelo pátio. P01 a P06 = prateleiras e R01 a R12 = estantes, todas no almoxarifado.', 'Storeroom count plus what arrived today through the yard. P01 to P06 = shelves and R01 to R12 = racks, all in the storeroom.'],
    nd_onde_cd: ['Contagem do galpão. P01 a P04 = prateleiras do depósito; R01 a R24 = estantes do galpão.', 'Warehouse count. P01 to P04 = storage room shelves; R01 to R24 = warehouse racks.'],
    nd_cuidado: ['O número é o endereço do item: guardou no lugar errado, o mapa aponta o lugar errado.', 'The number is the item\'s address: stored in the wrong place, the map points to the wrong place.']
  };
  let lang = 'pt';
  function t(chave, vars) {
    const par = TXT[chave];
    let s = par ? par[lang === 'en' ? 1 : 0] : '[' + chave + ']';
    if (vars) Object.keys(vars).forEach(k => { s = s.split('{' + k + '}').join(vars[k]); });
    return s;
  }
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nome = obj => obj ? (lang === 'en' ? obj.en : obj.pt) : '';
  const hhmm = m => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(Math.floor(m % 60)).padStart(2, '0');
  // Busca sem acento e sem caixa: "cafe" acha "Café".
  const norm = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  // ---------------------------------------------------------------- 2. ESTADO
  const UNIDADES = ['mat', 'fab', 'cd', 'rem'];
  const COM_MAPA = { mat: true, fab: true, cd: true };
  const NOTAS = ['ponto', 'posicao', 'erro', 'estoque'];
  const LETRA = { ponto: 'na', posicao: 'nb', erro: 'nc', estoque: 'nd' }; // prefixo das chaves de cada janelinha
  const SEVERIDADE = { zerado: 0, baixo: 1, ok: 2 };
  const FOTO = new URLSearchParams(location.search).get('foto') === '1';
  // "tudo" = a câmera está enquadrando a planta inteira (aí ela se ajeita sozinha quando o quadro muda de tamanho).
  const CAM_INICIAL = () => ({ zoom: 1, cx: VB.w / 2, cy: VB.h / 2, seguir: false, tudo: true });
  const S = {
    unidade: 'mat',                       // abre na Matriz (pedido do Fernando)
    cat: '', area: '', sit: '',           // filtros: um valor cada ('' = todos)
    busca: '', prat: '', sel: '',         // busca da tabela, prateleira clicada no mapa, item selecionado
    foco: '', buscaT: '', aba: 'estoque', // pessoa em foco, busca da aba "Em turno", aba aberta da janela
    subExp: 'asair', selExp: '', buscaE: '', // aba Expedição: sub-aba, caminhão marcado e a busca dela
    menu: false,                          // menu de camadas aberto?
    // Ordem escolhida no cabeçalho de cada tabela (col vazia = a ordem declarada dela).
    // Atenção e Estoque têm as mesmas colunas e dividem a mesma ordem ("inv").
    ordens: { inv: { col: '', passo: 0 }, turno: { col: '', passo: 0 }, asair: { col: '', passo: 0 }, sairam: { col: '', passo: 0 }, hist: { col: '', passo: 0 }, rem: { col: '', passo: 0 } },
    notas: { ponto: false, posicao: false, erro: false, estoque: false }, // todas nascem fechadas (a pessoa abre)
    estoque: false, hist: false,          // janela por cima do mapa e histórico nascem fechados
    andar: 1,                             // andar em foco (só a Matriz tem 2º andar)
    vista: { rot: 0, modo: '3d', baixas: false },
    camadas: { pessoas: true, estoque: true, nomes: true },
    cam: CAM_INICIAL(),
    relogio: { minuto: null, foraHorario: false, fixo: false }
  };
  const R = S.relogio, cam = S.cam;
  const sims = {};            // uma simulação por unidade (guardada: remontar não reinicia os bonecos)
  let raiz = null, C = null;  // a div da aba e o contexto do app (zerados no desmontar)
  let rafId = 0, ultimo = 0, quadros = 0, timerPulso = 0, reduzido = false;
  let camRaf = 0, arrasto = null, arrastou = false, observador = null;
  let aspecto = VB.w / VB.h;  // largura ÷ altura do quadro do mapa na tela (medido)
  let zMin = 1;               // menor zoom = o de "enquadrar tudo" (abaixo de 1 quando o estoque cobre parte do mapa)
  let parado = '';            // a pessoa com o mouse em cima (congelada para dar para clicar)
  let recebidosVistos = -1, eventosVistos = -1, cicloCam = -1, paradosVistos = '';

  // ---------------------------------------------------------------- 3. RELÓGIO (sempre ao vivo)
  // Ao vivo = a hora do visitante, aplicada ao dia de exemplo, dentro do horário comercial
  // (07:00 a 19:00). Fora dele, o mapa começa às 10:30 e anda no ritmo normal.
  // Na foto (?foto=1) o relógio fica parado às 10:30: mesma foto em toda execução.
  function minutoReal() { const d = new Date(); return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60; }
  function iniciarRelogio() {
    if (R.minuto != null) return;             // já começou (é uma remontagem)
    if (FOTO) { R.minuto = 630; R.fixo = true; return; }
    const m = minutoReal();
    R.foraHorario = m < A.ABRE || m > A.FECHA;
    R.minuto = R.foraHorario ? 630 : m;
  }
  // Um passo do relógio (dt em segundos reais).
  function andarRelogio(dt) {
    if (R.fixo) return;
    if (!R.foraHorario) {
      const m = minutoReal();
      if (m >= A.ABRE && m <= A.FECHA) { R.minuto = m; return; }
      R.foraHorario = true;
    }
    R.minuto = Math.min(A.FECHA, R.minuto + dt / 60);
  }

  // ---------------------------------------------------------------- 4. CONTAS DA TELA
  const presentes = u => A.presentes(u, R.minuto);
  const simAtual = () => (COM_MAPA[S.unidade] ? sims[S.unidade] : null);
  function garantirSim(u) {
    if (!sims[u]) { sims[u] = MP.criarSim(u); MP.sincronizar(sims[u], R.minuto, false); if (FOTO) MP.aquecer(sims[u], 60); }
    return sims[u];
  }
  const nomeUnidade = u => C.I.nome(C.D.unidades[u]);
  // O andar em foco: a planta dele e a altura dele no desenho.
  const temAndar2 = () => S.unidade === 'mat' && !!A.plantas.mat.andar2;
  const planoFoco = () => (S.andar === 2 && temAndar2() ? A.plantas.mat.andar2 : A.plantas[S.unidade]);
  const zFoco = () => (S.andar === 2 && temAndar2() ? MP.ANDAR : 0);
  const naTela = b => MP.proj(b.x, b.y, (b.andar - 1) * MP.ANDAR);
  // Recebimentos do pátio que já chegaram até a hora do mapa (hoje, só a fábrica recebe).
  const recebidos = u => A.recebimentos.filter(r => r.unidade === u && r.chegada != null && r.chegada <= R.minuto);
  // O estoque AGORA: a contagem da manhã mais o que já chegou pelo pátio. A situação é
  // recalculada com a mesma regra da contagem (zerado, abaixo do mínimo ou normal).
  function itemAgora(i) {
    const r = A.recebimentos.find(x => x.item === i.id && x.chegada != null && x.chegada <= R.minuto);
    if (!r) return i;
    const qtd = i.qtd + r.qtd;
    return Object.assign({}, i, { qtd, sit: qtd === 0 ? 'zerado' : qtd < i.minimo ? 'baixo' : 'ok', recebido: { h: r.chegada, q: r.qtd } });
  }
  // Expedição: cargas do dia. "A sair" = saída ainda não chegou (o caminhão espera numa doca ou vaga);
  // "Saíram" = já saiu (o mais recente primeiro). Só tem nas unidades com pátio.
  const temPatio = () => !!(A.plantas[S.unidade] && A.plantas[S.unidade].vagasCaminhao);
  const expedicoes = u => A.expedicoes.filter(e => e.unidade === u);
  const aSair = u => expedicoes(u).filter(e => e.saida > R.minuto).sort((a, b) => a.saida - b.saida);
  const sairam = u => expedicoes(u).filter(e => e.saida <= R.minuto).sort((a, b) => b.saida - a.saida);
  const itensDaUnidade = () => A.inventario.filter(i => i.unidade === S.unidade).map(itemAgora);
  const nomeArea = k => (C && C.D.areas[k] ? C.I.nome(C.D.areas[k]) : k);
  // "ignorar" deixa um filtro de fora: é como a contagem ao lado de cada opção mostra
  // exatamente quantos itens aparecem quando aquela opção é escolhida.
  function passa(i, ignorar) {
    const b = norm(S.busca.trim());
    return (ignorar === 'cat' || !S.cat || i.cat === S.cat) &&
      (ignorar === 'area' || !S.area || i.area === S.area) &&
      (ignorar === 'sit' || !S.sit || i.sit === S.sit) &&
      (!S.prat || i.prat === S.prat) &&
      (!b || norm(nome(i.nome) + ' ' + nome(A.cats[i.cat]) + ' ' + nomeArea(i.area) + ' ' + i.prat).includes(b));
  }
  const linhas = () => ordenar(itensDaUnidade().filter(i => passa(i)));
  // Colunas de cada tabela da aba para a ordenação do app (G.ordenar): chave, rótulo, tipo e valor.
  // Situação ordena pelo risco (zerado > baixo > normal): o 1º clique traz o pior primeiro.
  const col = (k, rot, tipo, v, classe) => ({ k, rot, tipo, v, classe: classe || '' });
  const COLS = {
    inv: () => [col('item', 'c_item', 'texto', i => nome(i.nome)), col('cat', 'c_cat', 'texto', i => nome(A.cats[i.cat])), col('area', 'c_area', 'texto', i => nomeArea(i.area)),
      col('qtd', 'c_qtd', 'num', i => i.qtd, 'dir'), col('min', 'c_min', 'num', i => i.minimo, 'dir'), col('prat', 'c_prat', 'texto', i => i.prat), col('sit', 'c_sit', 'num', i => 2 - SEVERIDADE[i.sit])],
    turno: () => [col('nome', 'c_nome', 'texto', x => x.p.nome), col('area', 'c_area', 'texto', x => nomeArea(x.p.area)), col('entrada', 'c_entrada', 'data', x => x.m.entrada, 'dir'), col('ponto', 'c_ponto', 'texto', x => x.onde)],
    asair: () => [col('placa', 'c_placa', 'texto', e => e.placa), col('destino', 'c_destino', 'texto', e => e.destino), col('carga', 'c_carga', 'texto', e => nome(e.carga)), col('saida', 'c_prev_saida', 'data', e => e.saida, 'dir')],
    sairam: () => [col('placa', 'c_placa', 'texto', e => e.placa), col('destino', 'c_destino', 'texto', e => e.destino), col('carga', 'c_carga', 'texto', e => nome(e.carga)),
      col('saida', 'c_saida', 'data', e => e.saida, 'dir'), col('chegada', 'c_chegada', 'data', e => e.chegada, 'dir')],
    hist: () => [col('hora', 'c_hora', 'data', e => e.h), col('quem', 'c_quem', 'texto', e => (e.p ? e.p.nome : e.r.fornecedor)),
      col('area', 'c_area', 'texto', e => nomeArea(e.p ? e.p.area : A.inventario.find(i => i.id === e.r.item).area)), col('evento', 'c_evento', 'texto', e => t('ev_' + e.tipo))],
    rem: () => [col('nome', 'c_nome', 'texto', x => x.p.nome), col('area', 'c_area', 'texto', x => nomeArea(x.p.area)), col('nivel', 'c_nivel', 'num', x => C.D.niveis[x.p.nivel].ordem), col('entrada', 'c_entrada', 'data', x => x.m.entrada, 'dir')]
  };
  // A lista na ordem escolhida no cabeçalho daquela tabela (a lista já chega na ordem declarada).
  const naOrdem = (tab, lista) => G.ordenar(lista, COLS[tab](), S.ordens[tab]);
  // O cabeçalho de uma tabela da aba: botões com a seta e o aria-sort (o desenho é o do app).
  // O botão leva "tabela:coluna" para o clique saber qual tabela mudar.
  const cabecalho = tab => '<thead><tr>' + COLS[tab]().map(c => G.thOrdena(c, t(c.rot), S.ordens[tab], 'data-amb-ordem', c.classe)
    .replace(`data-amb-ordem="${c.k}"`, `data-amb-ordem="${tab}:${c.k}"`)).join('') + '</tr></thead>';
  // Estoque e Atenção: ordem declarada = o pior primeiro (zerado, baixo, normal) e, dentro, o nome A→Z.
  function ordenar(lista) {
    lista.sort((a, b) => SEVERIDADE[a.sit] - SEVERIDADE[b.sit] || norm(nome(a.nome)).localeCompare(norm(nome(b.nome))));
    return naOrdem('inv', lista);
  }
  const focoAtivo = () => !!(S.cat || S.area || S.sit || S.busca.trim() || S.prat);
  // Situação de uma prateleira = a pior situação entre os itens guardados nela.
  function situacaoPrateleiras() {
    const pior = {};
    itensDaUnidade().forEach(i => { if (pior[i.prat] == null || SEVERIDADE[i.sit] < SEVERIDADE[pior[i.prat]]) pior[i.prat] = i.sit; });
    return pior;
  }
  // Tempo de casa até o dia de exemplo: "4,2 anos" ou "8 meses".
  function tempoDeCasa(p) {
    const anos = (A.dia - p.admissao) / (365.25 * 864e5);
    return anos >= 1 ? t('anos', { n: C.num(anos, 1) }) : t('meses', { n: Math.max(0, Math.round(anos * 12)) });
  }
  // O dia até agora, mais novo primeiro: cada entrada e cada saída do ponto e, na fábrica,
  // cada recebimento do pátio. É a mesma marcação que decide quem está no mapa.
  function eventos(u) {
    const ev = [];
    A.marcacoes.forEach(m => {
      const p = A.pessoaPorId[m.id];
      if (m.unidade !== u || m.ausente || !p) return;
      if (m.entrada <= R.minuto) ev.push({ h: m.entrada, tipo: 'entrada', p });
      if (m.saida != null && m.saida <= R.minuto) ev.push({ h: m.saida, tipo: 'saida', p });
    });
    recebidos(u).forEach(r => ev.push({ h: r.chegada, tipo: 'receb', r }));
    return ev.sort((a, b) => b.h - a.h || (a.p && b.p ? a.p.nome.localeCompare(b.p.nome) : 0));
  }

  // ---------------------------------------------------------------- 5. DESENHO
  // Ícones desenhados aqui (traço na cor do texto): girar, aproximar, afastar, enquadrar, focar.
  const ic = d => `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="${d}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const ICONE = {
    girarE: ic('M6.5 4.5H3.5V1.5M3.8 4.3A7 7 0 1 1 3 10'), girarD: ic('M13.5 4.5h3V1.5M16.2 4.3A7 7 0 1 0 17 10'),
    mais: ic('M10 4v12M4 10h12'), menos: ic('M4 10h12'), tudo: ic('M3 7V3h4M13 3h4v4M17 13v4h-4M7 17H3v-4'),
    focar: ic('M10 2v3M10 15v3M2 10h3M15 10h3M10 6.5a3.5 3.5 0 1 0 0 7a3.5 3.5 0 1 0 0-7')
  };
  function htmlAba() {
    let h = `<div class="amb"><header class="s-cab amb-cab"><h2>${esc(t('titulo'))}</h2><p>${esc(t('sub', { d: C.data(A.dia) }))}</p></header>`;
    h += '<div class="amb-topo"><div class="amb-unidades" role="group" aria-label="' + esc(t('unidade')) + '">' + UNIDADES.map(u =>
      `<button class="pilula amb-un${S.unidade === u ? ' ativa' : ''}" data-amb-un="${u}" aria-pressed="${S.unidade === u}">${esc(nomeUnidade(u))} <b class="mono" data-amb-conta="${u}">${presentes(u).length}</b></button>`).join('') + '</div>' +
      `<div class="amb-status">${htmlStatus()}</div></div>` +
      `<p class="amb-fora" data-amb-fora${R.foraHorario && !FOTO ? '' : ' hidden'}>${esc(t('fora'))}</p>`;
    // O histórico do dia fica EMBAIXO do mapa, depois das janelinhas de explicação.
    const hist = `<section class="cartao amb-hist" data-amb-hist-painel aria-label="${esc(t('hist'))}"${S.hist ? '' : ' hidden'}>${S.hist ? htmlHist() : ''}</section>`;
    if (S.unidade === 'rem') return h + `<div class="amb-remoto"><p class="amb-rem-nota">${esc(t('rem_nota'))}</p><div class="cartao tabela-cartao"><div class="tb-rolagem" data-amb-remoto>${htmlRemoto()}</div></div></div>${hist}</div>`;
    h += '<div class="amb-corpo">' +
      `<section class="amb-centro">${htmlBarra()}` +
      `<div class="amb-mapa" data-amb-mapa><div class="amb-quadro" data-amb-quadro data-andar-foco="${S.andar}">${svgMapa()}</div>` +
      `<div class="amb-cam" role="group">` + [['mais', ICONE.mais], ['menos', ICONE.menos], ['tudo', ICONE.tudo], ['focar', ICONE.focar]].map(([k, i]) =>
        `<button class="amb-cam-bt" data-amb-cam="${k}" aria-label="${esc(t(k))}" title="${esc(t(k))}">${i}</button>`).join('') + '</div>' +
      '<div class="amb-ficha" data-amb-ficha role="dialog" hidden></div>' +
      `<div class="amb-lateral${S.estoque ? '' : ' recolhida'}" data-amb-lateral>` +
      `<section class="cartao tabela-cartao amb-tabela amb-est${S.estoque ? ' aberto' : ''}" data-amb-est>${htmlJanela()}</section></div>` +
      `<div class="amb-minimapa" data-amb-mini>${MP.miniSvg(planoFoco())}</div></div>` +
      `<div class="amb-notas" data-amb-notas>${htmlNotas()}</div>${hist}</section></div>`;
    return h + '</div>';
  }
  // Agora: o ponto que pisca (ao vivo), a hora, quantos estão na unidade e o botão do histórico.
  function htmlStatus() {
    const rem = S.unidade === 'rem';
    return `<span class="amb-vivo-ponto${FOTO ? '' : ' on'}" title="${esc(t('vivo'))}" aria-hidden="true"></span>` +
      `<span class="amb-hora mono" data-amb-hora title="${esc(t('vivo'))}">${hhmm(R.minuto)}</span>` +
      `<span class="amb-agora"><b class="mono" data-amb-n>${presentes(S.unidade).length}</b> ${esc(t(rem ? 'rem_agora' : 'agora'))} <span class="amb-de">${esc(t('de_m', { m: A.cadastro(S.unidade) }))}</span></span>` +
      `<button class="botao amb-bt-hist${S.hist ? ' ativo' : ''}" data-amb-hist aria-expanded="${S.hist}">${esc(t('hist'))}</button>`;
  }
  function svgMapa() {
    MP.setVista(S.vista);
    return MP.svgEstatico(A.plantas[S.unidade], {
      aria: esc(t('aria_mapa', { u: nomeUnidade(S.unidade), n: presentes(S.unidade).length })),
      zona: k => esc(t(k)), prat: c => esc(t('prat', { c })), patio: esc(t('patio')), escada: esc(t('escada'))
    });
  }
  // Barra do mapa, numa linha só: vista (3D ou planta), andar (só a Matriz), girar, os filtros do
  // estoque (categoria, área, situação; a área também acende as pessoas), Limpar, o menu de camadas e a dica.
  function htmlBarra() {
    const V = S.vista, K = S.camadas;
    const camada = (k, on, rot) => `<button class="pilula amb-camada${on ? ' ativa' : ''}" data-amb-camada="${k}" aria-pressed="${on}">${esc(t(rot))}</button>`;
    const modo = m => `<button data-amb-modo="${m}" class="${V.modo === m ? 'ativo' : ''}" aria-pressed="${V.modo === m}">${esc(t(m === '3d' ? 'v3d' : 'vplanta'))}</button>`;
    const andar = n => `<button data-amb-andar="${n}" class="${S.andar === n ? 'ativo' : ''}" aria-pressed="${S.andar === n}">${esc(t('andar_' + n))}</button>`;
    return `<div class="amb-barra"><div class="amb-barra-l1"><div class="seg-botoes" role="group" aria-label="${esc(t('vista'))}">${modo('3d')}${modo('planta')}</div>` +
      (temAndar2() ? `<div class="seg-botoes amb-andares" role="group" aria-label="${esc(t('andar'))}">${andar(1)}${andar(2)}</div>` : '') +
      `<button class="botao leve amb-ic" data-amb-cam="girar-e" aria-label="${esc(t('girar_e'))}" title="${esc(t('girar_e'))}">${ICONE.girarE}</button>` +
      `<button class="botao leve amb-ic" data-amb-cam="girar-d" aria-label="${esc(t('girar_d'))}" title="${esc(t('girar_d'))}">${ICONE.girarD}</button>` +
      `<span class="amb-filtros" data-amb-filtros>${htmlFiltros()}</span>` +
      `<details class="amb-menu" data-amb-menu${S.menu ? ' open' : ''}><summary class="botao leve">${esc(t('camadas'))} <span aria-hidden="true">▾</span></summary>` +
      `<div class="amb-menu-pop" role="group" aria-label="${esc(t('camadas'))}">${camada('pessoas', K.pessoas, 'k_pessoas')}${camada('estoque', K.estoque, 'k_estoque')}` +
      `${camada('nomes', K.nomes, 'k_nomes')}${camada('baixas', V.baixas, 'k_baixas')}</div></details>` +
      `<span class="amb-q amb-q-dica" tabindex="0" role="note" data-tip="${esc(t('dica_cam'))}" aria-label="${esc(t('dica_cam'))}" title="${esc(t('dica_cam'))}">?</span></div></div>`;
  }
  // Filtros em listas de escolha compactas (o nome do filtro vai na 1ª opção); a contagem ao lado
  // de cada opção = linhas que aparecem ao escolhê-la.
  function htmlFiltros() {
    const itens = itensDaUnidade();
    const total = f => itens.filter(i => passa(i, f)).length;
    const conta = (f, v) => itens.filter(i => passa(i, f) && i[f] === v).length;
    const sel = (f, rot, opcoes) => `<select class="amb-sel" data-amb-f="${f}" aria-label="${esc(t(rot))}" title="${esc(t(rot))}">` +
      `<option value="">${esc(t('f_todas', { f: t(rot), n: total(f) }))}</option>` +
      opcoes.map(([v, txt]) => `<option value="${v}"${S[f] === v ? ' selected' : ''}>${esc(txt)} (${conta(f, v)})</option>`).join('') + '</select>';
    return sel('cat', 'f_cat', Object.keys(A.cats).map(k => [k, nome(A.cats[k])])) +
      sel('area', 'f_area', Object.keys(C.D.areas).map(k => [k, nomeArea(k)])) +
      sel('sit', 'f_sit', ['ok', 'baixo', 'zerado'].map(k => [k, t('s_' + k)])) +
      `<button class="botao limpar amb-limpar${focoAtivo() ? ' ativo' : ''}" data-amb-limpar ${focoAtivo() ? '' : 'disabled'}>✕ ${esc(t('limpar'))}</button>`;
  }
  // Janela única por cima do mapa: abas Atenção (itens baixos e zerados), Estoque e Em turno
  // (quem está na unidade e onde), a busca na mesma linha e a seta que recolhe a janela.
  function htmlJanela() {
    const aba = k => `<button role="tab" class="amb-aba${S.aba === k ? ' ativa' : ''}" data-amb-aba="${k}" aria-selected="${S.aba === k}">${esc(t('aba_' + k))} <b class="mono" data-amb-n-aba="${k}"></b></button>`;
    const ph = t(S.aba === 'turno' ? 'buscar_t' : S.aba === 'expedicao' ? 'buscar_e' : 'buscar'), seta = t(S.estoque ? 'est_fechar' : 'est_abrir');
    const valor = S.aba === 'turno' ? S.buscaT : S.aba === 'expedicao' ? S.buscaE : S.busca;
    return `<div class="amb-est-cab"><div class="amb-abas" role="tablist" aria-label="${esc(t('janela'))}">${aba('atencao')}${aba('estoque')}${aba('turno')}${temPatio() ? aba('expedicao') : ''}</div>` +
      `<input class="busca amb-busca-jan" type="search" value="${esc(valor)}" placeholder="${esc(ph)}" aria-label="${esc(ph)}" data-amb-busca>` +
      `<button class="amb-x amb-chev" data-amb-est-alterna aria-expanded="${S.estoque}" aria-label="${esc(seta)}" title="${esc(seta)}">▾</button></div>` +
      `<div class="amb-est-corpo"${S.estoque ? '' : ' hidden'}><span class="amb-chips" data-amb-chips></span><div class="tb-rolagem" data-amb-tabela></div></div>`;
  }
  // Tabela "Em turno": o que o ponto sabe, e nada além disso: quem está com o ponto aberto
  // (presente) e, embaixo, quem já bateu a saída (com a hora). Onde a pessoa está, o ponto não diz.
  function linhasTurno() {
    const b = norm(S.buscaT.trim());
    const dentro = presentes(S.unidade).map(m => ({ p: A.pessoaPorId[m.id], m, onde: t('st_presente') }));
    const sairam = A.marcacoes.filter(m => m.unidade === S.unidade && !m.ausente && m.saida != null && m.saida <= R.minuto)
      .map(m => ({ p: A.pessoaPorId[m.id], m, onde: t('st_saiu', { h: hhmm(m.saida) }), saiu: true }));
    return dentro.concat(sairam).filter(x => x.p && (!S.area || x.p.area === S.area) && (!b || norm(x.p.nome + ' ' + nomeArea(x.p.area) + ' ' + x.onde).includes(b)))
      .sort((x, y) => (x.saiu ? 1 : 0) - (y.saiu ? 1 : 0) || x.p.nome.localeCompare(y.p.nome));
  }
  function htmlTurno(lista) {
    lista = naOrdem('turno', lista);
    let h = `<table class="tabela amb-inv amb-turno">${cabecalho('turno')}<tbody>`;
    h += lista.length ? lista.map(x => `<tr${x.saiu ? ' class="amb-saiu"' : ` data-amb-pessoa="${x.p.id}" tabindex="0"${S.foco === x.p.id ? ' class="amb-sel"' : ''}`}>` +
      `<td>${esc(x.p.nome)}</td><td>${areaHtml(x.p.area)}</td><td class="dir mono">${hhmm(x.m.entrada)}</td>` +
      `<td><span class="amb-onde${x.saiu ? '' : ' presente'}">${esc(x.onde)}</span></td></tr>`).join('')
      : `<tr><td colspan="4" class="vazio">${esc(t('sem_turno'))}</td></tr>`;
    return h + '</tbody></table>';
  }
  // Janela da pessoa em foco: retrato ilustrado + os dados do cadastro e do ponto.
  function htmlFicha(b) {
    const p = b.p, linha = (k, v) => `<div><dt>${esc(t(k))}</dt><dd>${esc(v)}</dd></div>`;
    const sit = b.m.esqueceuSaida && R.minuto >= 18.5 * 60 ? t('fi_semsaida') : t('fi_presente');
    return `<button class="amb-x amb-ficha-x" data-amb-ficha-fecha aria-label="${esc(t('fechar'))}">✕</button>` +
      `<div class="amb-ficha-topo">${MP.avatarSvg(p, S.unidade, 64)}<div><b data-amb-ficha-nome>${esc(p.nome)}</b><small>${esc(t('fi_ilustra'))}</small></div></div>` +
      '<dl>' + linha('fi_area', nomeArea(p.area)) + linha('fi_cargo', C.I.nome(C.D.niveis[p.nivel])) + linha('fi_unidade', nomeUnidade(S.unidade)) +
      (temAndar2() ? linha('fi_andar', t('andar_' + b.andar)) : '') +
      linha('fi_entrada', hhmm(b.m.entrada)) + linha('fi_casa', tempoDeCasa(p)) + linha('fi_sit', sit) + '</dl>';
  }
  // Histórico do dia: o resumo (bateram o ponto, presentes, saídas), os recebimentos do pátio
  // (fábrica) e a lista de marcações, a mais nova em cima.
  function htmlHist() {
    const u = S.unidade, ev = eventos(u);
    const num = (n, k) => `<div class="amb-hist-num"><b class="mono">${n}</b><span>${esc(t(k))}</span></div>`;
    const temReceb = A.recebimentos.some(r => r.unidade === u);
    let h = `<header class="amb-hist-cab"><b>${esc(t('hist_tit', { u: nomeUnidade(u) }))}</b><span class="mono amb-hist-hora">${hhmm(R.minuto)}</span>` +
      `<button class="amb-x" data-amb-hist aria-label="${esc(t('fechar'))}">✕</button></header>`;
    h += '<div class="amb-hist-nums">' + num(ev.filter(e => e.tipo === 'entrada').length, 'hist_bateram') + num(presentes(u).length, 'hist_presentes') +
      num(ev.filter(e => e.tipo === 'saida').length, 'hist_saidas') +
      (temReceb ? num(`${recebidos(u).length}/${A.recebimentos.filter(r => r.unidade === u).length}`, 'hist_receb') : '') + '</div>';
    if (temReceb) h += htmlRecebimentos(u);
    h += `<div class="tb-rolagem amb-hist-rolagem" data-amb-hist-rolagem><table class="tabela amb-hist-tab">${cabecalho('hist')}<tbody>` +
      (ev.length ? naOrdem('hist', ev).map(linhaEvento).join('') : `<tr><td colspan="4" class="vazio">${esc(t('hist_vazio'))}</td></tr>`) + '</tbody></table></div>';
    return h;
  }
  const areaHtml = k => `<span class="amb-area"><i class="amb-ponto-area amb-a-${k}"></i><span>${esc(nomeArea(k))}</span></span>`;
  function linhaEvento(e) {
    if (e.tipo === 'receb') {
      const item = A.inventario.find(i => i.id === e.r.item);
      return `<tr class="amb-ev-linha-receb"><td class="mono">${hhmm(e.h)}</td><td>${esc(e.r.fornecedor)}</td><td>${areaHtml(item.area)}</td>` +
        `<td><span class="amb-ev amb-ev-receb">${esc(t('ev_receb'))}</span> <span class="amb-ev-det">+${C.num(e.r.qtd)} · ${esc(nome(item.nome))}</span></td></tr>`;
    }
    return `<tr><td class="mono">${hhmm(e.h)}</td><td>${esc(e.p.nome)}</td><td>${areaHtml(e.p.area)}</td>` +
      `<td><span class="amb-ev amb-ev-${e.tipo}">${esc(t('ev_' + e.tipo))}</span></td></tr>`;
  }
  // Recebimentos do dia: fornecedor, o que entregou, quanto e a situação (recebido, previsto ou atrasado).
  function htmlRecebimentos(u) {
    return `<div class="amb-receb"><b class="amb-receb-tit">${esc(t('rb_tit'))}</b><ul>` + A.recebimentos.filter(r => r.unidade === u).map(r => {
      const item = A.inventario.find(i => i.id === r.item);
      const chegou = r.chegada != null && r.chegada <= R.minuto, atrasado = !chegou && R.minuto > r.previsto + 15;
      const st = chegou ? t('rb_ok', { h: hhmm(r.chegada) }) : t(atrasado ? 'rb_atraso' : 'rb_prev', { h: hhmm(r.previsto) });
      return `<li data-amb-receb="${r.id}" data-st="${chegou ? 'ok' : atrasado ? 'atraso' : 'previsto'}"><i class="amb-bola ${chegou ? 'ok' : atrasado ? 'baixo' : 'vazia'}"></i>` +
        `<span><b>${esc(r.fornecedor)}</b> · ${C.num(r.qtd)} × ${esc(nome(item.nome))}</span><small>${esc(st)}</small></li>`;
    }).join('') + '</ul></div>';
  }
  function htmlNotas() {
    const esquec = A.marcacoes.filter(m => m.unidade === S.unidade && m.esqueceuSaida).length;
    const cuidadoErro = esquec === 0 ? t('nc_cuid_0') : esquec === 1 ? t('nc_cuid_1') : t('nc_cuid_n', { n: esquec });
    return NOTAS.map(k => {
      const L = LETRA[k], tit = t(L + '_tit');
      if (!S.notas[k]) return `<button class="amb-nota-q amb-nota-${k}" data-amb-abre="${k}" aria-label="${esc(tit)}" title="${esc(tit)}"><span class="amb-q">?</span><span class="amb-q-tit">${esc(tit)}</span></button>`;
      return `<section class="amb-nota amb-nota-${k}" aria-label="${esc(tit)}"><header><b>${esc(tit)}</b><button class="amb-x" data-amb-fecha="${k}" aria-label="${esc(t('fechar'))}">✕</button></header>` +
        `<p><span>${esc(t('n_oque'))}</span>${esc(t(L + '_oque'))}</p><p><span>${esc(t('n_onde'))}</span>${esc(t(TXT[L + '_onde_' + S.unidade] ? L + '_onde_' + S.unidade : L + '_onde'))}</p>` +
        `<p><span>${esc(t('n_cuidado'))}</span>${esc(k === 'erro' ? cuidadoErro : t(L + '_cuidado'))}</p></section>`;
    }).join('');
  }
  // Tabela do estoque: o MESMO desenho das tabelas do app (cabeçalho mono, linhas finas).
  // A bolinha antes da área tem a cor da camisa daquela área no mapa. O que chegou hoje
  // pelo pátio ganha uma linha miúda embaixo do nome ("Recebido hoje 10:40 · +20").
  function htmlTabela(lista, atencao) {
    let h = `<table class="tabela amb-inv">${cabecalho('inv')}<tbody>`;
    const chip = { ok: 'ok', baixo: 'warn', zerado: 'bad' };
    h += lista.length ? lista.map(i => `<tr data-amb-item="${i.id}"${atencao ? ' data-amb-atencao' : ''} data-prat="${i.prat}" data-area="${i.area}" data-cat="${i.cat}" tabindex="0" class="${S.sel === i.id ? 'amb-sel' : ''}">` +
      `<td>${esc(nome(i.nome))}${i.recebido ? `<small class="amb-rec" data-amb-rec>${esc(t('rec_hoje', { h: hhmm(i.recebido.h), q: C.num(i.recebido.q) }))}</small>` : ''}</td>` +
      `<td>${esc(nome(A.cats[i.cat]))}</td><td>${areaHtml(i.area)}</td>` +
      `<td class="dir mono">${C.num(i.qtd)}</td><td class="dir mono">${C.num(i.minimo)}</td><td><span class="amb-cod-chip mono">${i.prat}</span></td>` +
      `<td><span class="chip ${chip[i.sit]}">${esc(t('s_' + i.sit))}</span></td></tr>`).join('')
      : `<tr><td colspan="7" class="vazio">${esc(t('sem_itens'))}</td></tr>`;
    return h + '</tbody></table>';
  }
  function htmlRemoto() {
    const lista = presentes('rem').map(m => A.pessoaPorId[m.id] && { m, p: A.pessoaPorId[m.id] }).filter(Boolean)
      .sort((a, b) => a.m.entrada - b.m.entrada || a.p.nome.localeCompare(b.p.nome));
    let h = `<table class="tabela amb-rem">${cabecalho('rem')}<tbody>`;
    h += lista.length ? naOrdem('rem', lista).map(({ m, p }) => `<tr><td><span class="avatar-mini">${esc(p.nome.split(' ').map(x => x[0]).slice(0, 2).join(''))}</span>${esc(p.nome)}</td>` +
      `<td>${esc(nomeArea(p.area))}</td><td>${esc(C.I.nome(C.D.niveis[p.nivel]))}</td><td class="dir mono">${hhmm(m.entrada)}</td></tr>`).join('')
      : `<tr><td colspan="4" class="vazio">${esc(t('rem_vazio'))}</td></tr>`;
    return h + '</tbody></table>';
  }

  // ---------------------------------------------------------------- 6. CÂMERA
  // A câmera é o "viewBox" do SVG: zoom (1 = planta inteira) e o ponto do desenho no centro.
  // A caixa da câmera tem o MESMO formato do quadro na tela: o desenho ocupa o quadro todo,
  // sem faixa vazia, e com zoom 1 sobra espaço para os lados (é onde fica a janela do estoque).
  const $ = sel => (raiz ? raiz.querySelector(sel) : null);
  const svgEl = () => $('.amb-svg');
  function medirQuadro() {
    const q = $('[data-amb-quadro]'), r = q && q.getBoundingClientRect();
    if (r && r.width > 0 && r.height > 0) aspecto = r.width / r.height;
  }
  // O pedaço do desenho que cabe no quadro com zoom 1 (largura, altura).
  const base = () => (aspecto >= VB.w / VB.h ? [VB.h * aspecto, VB.h] : [VB.w, VB.w / aspecto]);
  function caixaCam() { const [W, H] = base(), w = W / cam.zoom, h = H / cam.zoom; return [cam.cx - w / 2, cam.cy - h / 2, w, h]; }
  // A câmera nunca perde o desenho: vista maior que o desenho = o desenho inteiro fica à vista;
  // vista menor = a vista não sai de cima do desenho. O menor zoom é o de "enquadrar tudo".
  function limitar() {
    cam.zoom = Math.max(zMin, Math.min(6, cam.zoom));
    const [, , w, h] = caixaCam();
    const preso = (v, tela, total) => (tela >= total ? Math.max(total - tela / 2, Math.min(tela / 2, v)) : Math.max(tela * 0.1, Math.min(total - tela * 0.1, v)));
    cam.cx = preso(cam.cx, w, VB.w); cam.cy = preso(cam.cy, h, VB.h);
  }
  // Largura livre do quadro (px): sem a janela do estoque quando ela está aberta POR CIMA do mapa.
  function larguraLivre(r) {
    const lat = $('[data-amb-lateral]');
    if (!S.estoque || !lat || getComputedStyle(lat).position !== 'absolute') return r.width;
    return Math.max(r.width * 0.4, lat.getBoundingClientRect().left - r.left - 10);
  }
  // Onde a câmera precisa ficar para o ponto (tx, ty) do desenho aparecer no CENTRO do pedaço
  // livre do quadro (à esquerda do estoque), no zoom z.
  function centroLivre(tx, ty, z, livre) {
    const q = $('[data-amb-quadro]'), r = q && q.getBoundingClientRect();
    if (!r || !r.width) return { cx: tx, cy: ty };
    const s = r.width / base()[0] * z;          // pixels por unidade do desenho nesse zoom
    return { cx: tx + (r.width - (livre || larguraLivre(r))) / (2 * s), cy: ty };
  }
  // Enquadrar tudo: a planta inteira cabendo no pedaço livre (com o estoque aberto por cima,
  // o desenho fica um pouco menor, à esquerda dele; recolhido, o desenho usa o quadro todo).
  function centroTudo() {
    medirQuadro();
    const q = $('[data-amb-quadro]'), r = q && q.getBoundingClientRect();
    if (!r || !r.width) { zMin = 1; return { zoom: 1, cx: VB.w / 2, cy: VB.h / 2, tudo: true }; }
    // Mede o desenho de verdade (o quadro do SVG tem margem e o espaço do 2º andar, que em
    // geral fica vazio) e escala até ele encher o pedaço livre, centralizado nos dois sentidos.
    // Com a janela aberta, a planta pode passar um pouco por baixo da borda dela (20%).
    const d = caixaDesenho(), lat = $('[data-amb-lateral]'), solta = S.estoque && lat && getComputedStyle(lat).position === 'absolute';
    const livre = larguraLivre(r) + (solta ? 0.2 * lat.getBoundingClientRect().width : 0);
    const s = Math.min((livre - 30) / d.w, (r.height - 30) / d.h), z = s / (r.width / base()[0]);
    zMin = Math.min(1, z);
    return Object.assign({ zoom: z, tudo: true }, centroLivre(d.x + d.w / 2, d.y + d.h / 2, z, livre));
  }
  // A caixa do que está desenhado (pisos, paredes, móveis dos andares), em unidades do desenho.
  function caixaDesenho() {
    const gs = [...raiz.querySelectorAll('.amb-svg .amb-andar')];
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    gs.forEach(g => { const b = g.getBBox(); if (!b.width) return; x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + b.width); y1 = Math.max(y1, b.y + b.height); });
    return x1 > x0 ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : { x: 0, y: 0, w: VB.w, h: VB.h };
  }
  function aplicarCamera() {
    const svg = svgEl();
    if (!svg) return;
    limitar();
    const [x, y, w, h] = caixaCam();
    svg.setAttribute('viewBox', `${x.toFixed(1)} ${y.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)}`);
    // Desenho pequeno na tela (celular, longe): rótulos miúdos somem; aproximando, voltam.
    const r = svg.getBoundingClientRect();
    if (r.width) $('[data-amb-mapa]').classList.toggle('miuda', Math.min(r.width / w, r.height / h) < 0.8);
    // Na Fábrica as estantes do almoxarifado são juntas: o código delas só aparece de perto (zoom 1,5+),
    // ou quando a estante está acesa, marcada ou pulsando.
    $('[data-amb-mapa]').classList.toggle('cod-perto', S.unidade === 'fab' && cam.zoom < 1.5);
    atualizarMini();
  }
  // Minimapa: os 4 cantos da tela levados de volta ao chão (do andar em foco) = o pedaço à vista.
  function atualizarMini() {
    const pol = $('.amb-mini-vista');
    if (!pol) return;
    const [x, y, w, h] = caixaCam(), z = zFoco();
    pol.setAttribute('points', [[x, y], [x + w, y], [x + w, y + h], [x, y + h]].map(([sx, sy]) => MP.desproj(sx, sy, z).map(v => v.toFixed(2)).join(',')).join(' '));
  }
  // Leva a câmera até o alvo em "ms" (acelera e freia); sem animação no movimento reduzido e na foto.
  function moverCamera(alvo, ms) {
    cancelAnimationFrame(camRaf); camRaf = 0;
    cam.tudo = !!alvo.tudo;
    if (reduzido || FOTO || !ms) { Object.assign(cam, alvo); aplicarCamera(); return; }
    const de = { zoom: cam.zoom, cx: cam.cx, cy: cam.cy }, t0 = performance.now();
    const quadro = agora => {
      const k = Math.min(1, (agora - t0) / ms), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      ['zoom', 'cx', 'cy'].forEach(c => { if (alvo[c] != null) cam[c] = de[c] + (alvo[c] - de[c]) * e; });
      aplicarCamera();
      camRaf = k < 1 && raiz ? requestAnimationFrame(quadro) : 0;
    };
    camRaf = requestAnimationFrame(quadro);
  }
  // Refaz o desenho fixo (girou, trocou o modo, rebaixou paredes) e religa os bonecos nele.
  function redesenharMapa() {
    const q = $('[data-amb-quadro]'), sim = simAtual();
    if (!q || !sim) return;
    MP.soltar(sim);
    q.innerHTML = svgMapa();
    MP.ligar(sim, svgEl()); MP.avancar(sim, 0, false);
    caminhaoPasso(0);   // a frota no desenho novo (girou, trocou o modo)
    aplicarCamadas(); pintarPrateleiras(linhas()); pintarPessoas(); marcarFoco(); aplicarCamera(); atualizarBarra();
  }
  // Girar ou trocar o modo mantendo no centro o MESMO ponto do chão (do andar em foco).
  function mudarVista(nova) {
    const z = zFoco(), [wx, wy] = MP.desproj(cam.cx, cam.cy, z);
    Object.assign(S.vista, nova);
    redesenharMapa();
    if (cam.tudo) Object.assign(cam, centroTudo());
    else { const [cx, cy] = MP.proj(wx, wy, z); cam.cx = cx; cam.cy = cy; }
    aplicarCamera();
  }
  // Trocar de andar (Matriz): o andar em foco fica inteiro e o outro fica transparente (CSS,
  // com transição); o minimapa passa a mostrar o andar novo; aproximada, a câmera sobe ou desce junto.
  function trocarAndar(n) {
    if (!temAndar2() || n === S.andar) return;
    const sobe = MP.proj(0, 0, MP.ANDAR)[1] - MP.proj(0, 0, 0)[1];   // quanto um andar sobe na tela (0 na planta)
    S.andar = n;
    const q = $('[data-amb-quadro]'); if (q) q.setAttribute('data-andar-foco', String(n));
    const mini = $('[data-amb-mini]'); if (mini) mini.innerHTML = MP.miniSvg(planoFoco());
    const sim = simAtual(), b = S.foco && sim && sim.bonecos.get(S.foco);
    if (S.foco && (!b || b.andar !== n)) { S.foco = ''; cam.seguir = false; fecharFicha(); }   // a pessoa em foco ficou no outro andar
    atualizarBarra();
    if (!cam.tudo && !cam.seguir) moverCamera({ cy: cam.cy + (n === 2 ? sobe : -sobe) }, 450); else aplicarCamera();
  }
  // Focar uma pessoa: vai para o andar dela, gira para o ângulo em que ela fica mais à frente,
  // aproxima e abre a janela dela.
  function focarPessoa(id) {
    const sim = simAtual(), b = sim && sim.bonecos.get(id);
    if (!b) return;
    if (temAndar2() && b.andar !== S.andar) trocarAndar(b.andar);
    S.foco = id; cam.seguir = true;
    const rot = MP.melhorRot(b.x, b.y);
    if (rot !== S.vista.rot) { S.vista.rot = rot; redesenharMapa(); }
    abrirFicha();
    const [tx, ty] = naTela(b), z = S.vista.modo === 'planta' ? 2.4 : 2.8;
    moverCamera(Object.assign({ zoom: z }, centroLivre(tx, ty - 8, z)), 650);
  }
  function soltarFoco() {
    S.foco = ''; cam.seguir = false; fecharFicha();
    if (S.vista.rot !== 0) { S.vista.rot = 0; redesenharMapa(); }
    moverCamera(centroTudo(), 550);
  }
  // As prateleiras ficam no 1º andar: focar uma delas volta para ele.
  function focarPrateleira(cod) {
    const m = A.plantas[S.unidade].moveis.find(x => x.cod === cod);
    if (!m) return;
    if (S.foco) { S.foco = ''; cam.seguir = false; fecharFicha(); }
    if (S.andar !== 1) trocarAndar(1);
    const [tx, ty] = MP.proj((m.x0 + m.x1) / 2, (m.y0 + m.y1) / 2, m.h), z = Math.max(cam.zoom, 2.2);
    moverCamera(Object.assign({ zoom: z }, centroLivre(tx, ty, z)), 550);
  }
  function comandoCamera(k) {
    if (k === 'mais') return moverCamera({ zoom: cam.zoom * 1.4 }, 250);
    if (k === 'menos') return moverCamera({ zoom: cam.zoom / 1.4 }, 250);
    if (k === 'tudo') { if (S.foco) return soltarFoco(); cam.seguir = false; return moverCamera(centroTudo(), 450); }
    if (k === 'focar') { if (S.foco) return focarPessoa(S.foco); const it = S.sel && A.inventario.find(i => i.id === S.sel); if (it) focarPrateleira(it.prat); return; }
    if (k === 'girar-e' || k === 'girar-d') mudarVista({ rot: (S.vista.rot + (k === 'girar-d' ? 1 : 3)) % 4 });
  }
  function abrirFicha() {
    const el = $('[data-amb-ficha]'), sim = simAtual(), b = sim && sim.bonecos.get(S.foco);
    if (!el || !b) return;
    el.innerHTML = htmlFicha(b); el.hidden = false;
    marcarFoco();
  }
  function fecharFicha() {
    const el = $('[data-amb-ficha]');
    if (el) { el.hidden = true; el.innerHTML = ''; }
    marcarFoco();
  }
  function marcarFoco() {
    if (!raiz) return;
    raiz.querySelectorAll('.amb-boneco.sel').forEach(x => x.classList.remove('sel'));
    const el = S.foco && $(`.amb-boneco[data-id="${S.foco}"]`);
    if (el) el.classList.add('sel');
    raiz.querySelectorAll('tr[data-amb-pessoa]').forEach(tr => tr.classList.toggle('amb-sel', tr.getAttribute('data-amb-pessoa') === S.foco));
  }

  // ---------------------------------------------------------------- 7. ATUALIZAR SÓ O PEDAÇO QUE MUDOU
  function atualizarInventario() {
    if (!raiz || !COM_MAPA[S.unidade]) return;
    const lista = linhas();
    const f = $('[data-amb-filtros]');
    if (f) {   // refaz as listas de escolha (contagens) e devolve o foco à que estava em uso
      const emUso = document.activeElement && document.activeElement.getAttribute && document.activeElement.getAttribute('data-amb-f');
      f.innerHTML = htmlFiltros();
      if (emUso) { const s = f.querySelector(`[data-amb-f="${emUso}"]`); if (s) s.focus(); }
    }
    atualizarJanela(lista);
    pintarPrateleiras(lista); pintarPessoas();
  }
  // A janela por cima do mapa: contagem de cada aba e a tabela da aba aberta (guardando a rolagem).
  function atualizarJanela(lista) {
    if (!raiz || !COM_MAPA[S.unidade]) return;
    lista = lista || linhas();
    const b = norm(S.busca.trim()), atencao = itensDaUnidade().filter(i => i.sit !== 'ok');
    const n = { atencao: atencao.length, estoque: lista.length, turno: presentes(S.unidade).length, expedicao: aSair(S.unidade).length };
    raiz.querySelectorAll('[data-amb-n-aba]').forEach(e => { e.textContent = n[e.getAttribute('data-amb-n-aba')]; });
    const tab = $('[data-amb-tabela]');
    if (!tab) return;
    const topo = tab.scrollTop;
    if (S.aba === 'expedicao' && temPatio()) tab.innerHTML = htmlExpedicao();
    else if (S.aba === 'turno') tab.innerHTML = htmlTurno(linhasTurno());
    else if (S.aba === 'atencao') tab.innerHTML = htmlTabela(ordenar(atencao.filter(i => !b || norm(nome(i.nome) + ' ' + nome(A.cats[i.cat]) + ' ' + nomeArea(i.area) + ' ' + i.prat).includes(b))), true);
    else tab.innerHTML = htmlTabela(lista, false);
    tab.scrollTop = topo;
    const ch = $('[data-amb-chips]');
    if (ch) ch.innerHTML = S.prat && S.aba === 'estoque' ? `<button class="amb-chip" data-amb-tira-prat aria-label="${esc(t('limpar'))}">${esc(t('prat', { c: S.prat }))} <span aria-hidden="true">✕</span></button>` : '';
  }
  // Trocar de aba (abrindo a janela, se estava recolhida).
  function trocarAba(k) {
    S.aba = k;
    if (!S.estoque) alternarEstoque();
    const est = $('[data-amb-est]');
    if (est) est.innerHTML = htmlJanela();
    atualizarJanela();
  }
  // Caminhões. A frota anda sozinha no motor do mapa; aqui fica o que é da tela: o que cada caminhão
  // diz (placa, destino, carga, hora), quem está selecionado e o balão do mouse.
  const tituloParado = e => t('exp_parado', { p: e.placa, d: e.destino, c: nome(e.carga), h: hhmm(e.saida) });
  const tituloSaiu = e => t('exp_saiu', { p: e.placa, d: e.destino, c: nome(e.carga), h: hhmm(e.saida) });
  // Um passo: a frota anda (chegando de ré, parada, saindo até passar da borda). Na Fábrica, o
  // caminhão da doca chega, encosta, fica e sai sem parar: a cada volta ele é uma carga que já saiu.
  function caminhaoPasso(dt) {
    const sim = simAtual(), P = A.plantas[S.unidade];
    if (!sim || !P || !P.vagasCaminhao) return;
    const foi = sairam(S.unidade), doca = P.docaAnimada, e = foi.length ? foi[Math.max(0, cicloCam) % foi.length] : null;
    const volta = MP.avancarCaminhoes(sim, dt, doca ? { vaga: doca, ativo: !!e, id: e ? e.id : '', titulo: e ? tituloSaiu(e) : '' } : null, reduzido || FOTO);
    if (doca && foi.length && volta !== cicloCam) { cicloCam = volta; const x = foi[volta % foi.length]; MP.rotularCaminhao(sim, x.id, tituloSaiu(x)); }
    if (hoverExp) posicionarBalao();
  }
  // As cargas "A sair" ocupam as docas e vagas em ordem de saída. Quando uma sai, o caminhão vai
  // embora dirigindo e a próxima chega de ré na vaga livre. instantaneo = abrir a aba: já no lugar.
  function estacionarAgora(instantaneo) {
    const sim = simAtual(), P = A.plantas[S.unidade];
    if (!sim || !P.vagasCaminhao) return;
    const lista = aSair(S.unidade).map(e => ({ id: e.id, titulo: tituloParado(e) }));
    const chave = lista.map(e => e.id).join(',') + '|' + lang;
    if (!instantaneo && chave === paradosVistos) return;
    paradosVistos = chave;
    MP.estacionar(sim, lista, P.vagasCaminhao, !!instantaneo);
    MP.marcarCaminhao(sim, S.selExp);
  }
  // Selecionar um caminhão (pelo mapa ou pela linha da tabela): contorno no caminhão e linha marcada.
  function selecionarCaminhao(id) {
    S.selExp = id || '';
    const sim = simAtual();
    if (sim && sim.frota) MP.marcarCaminhao(sim, S.selExp);
    raiz.querySelectorAll('tr[data-amb-exp-linha]').forEach(tr => tr.classList.toggle('amb-sel', tr.getAttribute('data-amb-exp-linha') === S.selExp));
  }
  // Mouse em cima de um caminhão: ele para (como as pessoas), ganha contorno e o balão fica em cima dele.
  let hoverExp = '';
  function passarCaminhao(id) {
    if (id === hoverExp) return;
    hoverExp = id;
    const sim = simAtual();
    if (sim && sim.frota) MP.congelarCaminhao(sim, id);
    posicionarBalao();
  }
  function posicionarBalao() {
    const mapa = $('[data-amb-mapa]');
    if (!mapa) return;
    let bal = mapa.querySelector('.amb-balao');
    if (!bal) { bal = document.createElement('div'); bal.className = 'amb-balao'; bal.setAttribute('role', 'tooltip'); bal.hidden = true; mapa.appendChild(bal); }
    const pecas = hoverExp ? [...mapa.querySelectorAll(`.amb-svg [data-amb-exp="${hoverExp}"]`)].filter(g => g.style.display !== 'none') : [];
    if (!pecas.length) { bal.hidden = true; return; }
    const rs = pecas.map(g => g.getBoundingClientRect()), m = mapa.getBoundingClientRect();
    const x0 = Math.min(...rs.map(r => r.left)), x1 = Math.max(...rs.map(r => r.right)), y0 = Math.min(...rs.map(r => r.top));
    bal.textContent = pecas[0].getAttribute('aria-label') || '';
    bal.style.left = ((x0 + x1) / 2 - m.left).toFixed(0) + 'px';
    bal.style.top = (y0 - m.top - 6).toFixed(0) + 'px';
    bal.hidden = false;
  }
  // Aba Expedição: sub-abas "A sair" (placa, destino, carga, saída prevista) e "Saíram" (placa,
  // destino, carga, hora da saída e chegada prevista). Mesmo desenho das outras tabelas.
  function htmlExpedicao() {
    const u = S.unidade, b = norm(S.buscaE.trim()), ok = e => !b || norm(e.placa + ' ' + e.destino + ' ' + nome(e.carga)).includes(b);
    const fora = S.subExp === 'sairam', lista = (fora ? sairam(u) : aSair(u)).filter(ok);
    const sub = k => `<button class="amb-aba${S.subExp === k ? ' ativa' : ''}" data-amb-sub="${k}" aria-pressed="${S.subExp === k}">${esc(t('sub_' + k))} <b class="mono" data-amb-n-sub="${k}">${(k === 'sairam' ? sairam(u) : aSair(u)).length}</b></button>`;
    let h = `<div class="amb-subabas">${sub('asair')}${sub('sairam')}</div><table class="tabela amb-inv amb-exp">${cabecalho(S.subExp)}<tbody>`;
    h += lista.length ? naOrdem(S.subExp, lista).map(e => `<tr data-amb-exp-linha="${e.id}"${S.selExp === e.id ? ' class="amb-sel"' : ''}><td class="mono">${esc(e.placa)}</td><td>${esc(e.destino)}</td><td>${esc(nome(e.carga))}</td>` +
      (fora ? `<td class="dir mono">${hhmm(e.saida)}</td><td class="dir mono">${hhmm(e.chegada)}</td>` : `<td class="dir mono">${hhmm(e.saida)}</td>`) + '</tr>').join('')
      : `<tr><td colspan="${fora ? 5 : 4}" class="vazio">${esc(t('exp_vazio'))}</td></tr>`;
    return h + '</tbody></table>';
  }
  // Foco no mapa: com filtro ligado, acendem as prateleiras dos itens da tabela e apagam as outras.
  function pintarPrateleiras(lista) {
    const svg = svgEl();
    if (!svg) return;
    const foco = focoAtivo(), acesas = new Set(lista.map(i => i.prat)), st = situacaoPrateleiras();
    const item = S.sel ? A.inventario.find(i => i.id === S.sel) : null, marcada = item ? item.prat : '';
    const pinta = (el, c) => {
      el.classList.toggle('acesa', foco && acesas.has(c));
      el.classList.toggle('apagada', foco && !acesas.has(c));
      el.classList.toggle('marcada', c === marcada);
    };
    svg.querySelectorAll('[data-cod]').forEach(el => pinta(el, el.getAttribute('data-cod')));
    svg.querySelectorAll('[data-marca]').forEach(el => { const c = el.getAttribute('data-marca'); pinta(el, c); el.setAttribute('data-st', st[c] || 'vazio'); });
  }
  // Filtro de área ligado: as pessoas daquela área acendem e as outras apagam.
  function pintarPessoas() {
    if (!raiz) return;
    raiz.querySelectorAll('.amb-boneco').forEach(el => {
      const da = el.getAttribute('data-area') === S.area;
      el.classList.toggle('aceso', !!S.area && da);
      el.classList.toggle('apagado', !!S.area && !da);
    });
  }
  function aplicarCamadas() {
    const svg = svgEl();
    if (!svg) return;
    svg.classList.toggle('amb-sem-pessoas', !S.camadas.pessoas);
    svg.classList.toggle('amb-sem-estoque', !S.camadas.estoque);
    svg.classList.toggle('amb-sem-nomes', !S.camadas.nomes);
  }
  function atualizarBarra() {   // só a linha 1 (os filtros têm a sua atualização)
    const l1 = $('.amb-barra-l1');
    if (!l1) return;
    const tmp = document.createElement('div');
    tmp.innerHTML = htmlBarra();
    l1.replaceWith(tmp.querySelector('.amb-barra-l1'));
  }
  // Abre ou recolhe a janela do estoque; enquadrada, a câmera se ajeita ao espaço que sobrou.
  function alternarEstoque() {
    S.estoque = !S.estoque;
    const est = $('[data-amb-est]'), lat = $('[data-amb-lateral]');
    if (lat) lat.classList.toggle('recolhida', !S.estoque);   // recolhida, a coluna encolhe para o canto
    if (est) {
      est.classList.toggle('aberto', S.estoque);
      est.querySelector('.amb-est-corpo').hidden = !S.estoque;
      const b = est.querySelector('[data-amb-est-alterna]');
      b.setAttribute('aria-expanded', String(S.estoque)); b.title = t(S.estoque ? 'est_fechar' : 'est_abrir');
    }
    const tudo = centroTudo();   // recalcula também o menor zoom (o espaço livre mudou)
    if (cam.tudo) moverCamera(tudo, 350);
  }
  // Histórico: abre e fecha; aberto, é refeito quando aparece marcação nova (guardando a rolagem).
  function alternarHist(abrir) {
    S.hist = abrir == null ? !S.hist : abrir;
    const p = $('[data-amb-hist-painel]');
    if (p) { p.hidden = !S.hist; p.innerHTML = S.hist ? htmlHist() : ''; }
    raiz.querySelectorAll('.amb-bt-hist').forEach(b => { b.classList.toggle('ativo', S.hist); b.setAttribute('aria-expanded', String(S.hist)); });
    eventosVistos = S.hist ? eventos(S.unidade).length : -1;
    if (S.hist && p) { p.scrollIntoView({ block: 'nearest' }); const x = p.querySelector('[data-amb-hist]'); if (x) x.focus({ preventScroll: true }); }
  }
  function atualizarHist() {
    const p = $('[data-amb-hist-painel]');
    if (!S.hist || !p) return;
    const n = eventos(S.unidade).length;
    if (n === eventosVistos) { const h = p.querySelector('.amb-hist-hora'); if (h) h.textContent = hhmm(R.minuto); return; }
    const rol = p.querySelector('[data-amb-hist-rolagem]'), topo = rol ? rol.scrollTop : 0;
    p.innerHTML = htmlHist(); eventosVistos = n;
    const novo = p.querySelector('[data-amb-hist-rolagem]'); if (novo) novo.scrollTop = topo;
  }
  function redesenharNotas(k, abriu) {
    $('[data-amb-notas]').innerHTML = htmlNotas();
    const alvo = $(abriu ? `[data-amb-fecha="${k}"]` : `[data-amb-abre="${k}"]`);
    if (alvo) alvo.focus();
  }
  // Pulso: a animação recomeça a cada clique (tira a classe, força o navegador a notar, põe de novo).
  function pulsar(cod) {
    const svg = svgEl();
    if (!svg) return;
    clearTimeout(timerPulso);
    svg.querySelectorAll('.pulso').forEach(el => el.classList.remove('pulso'));
    const els = svg.querySelectorAll(`[data-cod="${cod}"], [data-marca="${cod}"]`);
    void svg.getBoundingClientRect();
    els.forEach(el => el.classList.add('pulso'));
    timerPulso = setTimeout(() => els.forEach(el => el.classList.remove('pulso')), 2600);
  }
  function clicarLinha(id) {
    S.sel = S.sel === id ? '' : id;
    raiz.querySelectorAll('tr[data-amb-item]').forEach(tr => tr.classList.toggle('amb-sel', tr.getAttribute('data-amb-item') === S.sel));
    pintarPrateleiras(linhas());
    if (!S.sel) return;
    const cod = A.inventario.find(i => i.id === S.sel).prat;
    pulsar(cod);
    if (!cam.tudo || S.andar !== 1) focarPrateleira(cod);   // aproximado (ou no outro andar): a câmera vai até a prateleira
  }
  function clicarPrateleira(cod) {
    S.prat = S.prat === cod ? '' : cod;
    S.sel = '';
    atualizarInventario();
    if (S.prat) pulsar(cod);
  }
  // Aviso clicado: mostra a linha (limpando filtro que a esconda), pulsa a prateleira e leva a câmera até ela.
  function irParaItem(id) {
    const item = A.inventario.find(i => i.id === id);
    if (!item) return;
    if (!linhas().some(i => i.id === id)) { S.cat = S.area = S.sit = S.busca = S.prat = ''; const i = $('[data-amb-busca]'); if (i) i.value = ''; }
    S.sel = id;
    if (!S.estoque) alternarEstoque();
    atualizarInventario();
    pulsar(item.prat);
    const tr = $(`tr[data-amb-item="${id}"]`);
    if (tr) tr.scrollIntoView({ block: 'nearest' });
    focarPrateleira(item.prat);
  }

  // O relógio virou o minuto: quem entrou aparece, quem saiu some, as contagens acompanham;
  // na fábrica, caminhão que chegou entra no estoque e no histórico.
  function aoMudarMinuto(natural) {
    const sim = simAtual();
    // Com movimento reduzido ninguém nasce na porta: aparece direto no lugar dele.
    if (sim) MP.sincronizar(sim, R.minuto, natural && !reduzido && sim.ultimoMinuto != null && R.minuto - sim.ultimoMinuto <= 3);
    if (sim && parado && sim.bonecos.has(parado)) sim.bonecos.get(parado).parado = true;
    if (S.foco && (!sim || !sim.bonecos.has(S.foco))) soltarFoco();   // a pessoa bateu a saída
    pintarPessoas(); marcarFoco(); atualizarStatus(); atualizarJanela(); atualizarHist();
    const n = recebidos(S.unidade).length;
    if (n !== recebidosVistos) { recebidosVistos = n; atualizarInventario(); }
    estacionarAgora();
    const rem = $('[data-amb-remoto]');
    if (rem) rem.innerHTML = htmlRemoto();
  }
  function atualizarStatus() {
    if (!raiz) return;
    UNIDADES.forEach(u => { const b = $(`[data-amb-conta="${u}"]`); if (b) b.textContent = presentes(u).length; });
    const n = presentes(S.unidade).length;
    ['[data-amb-n]', '[data-amb-n-lista]'].forEach(s => { const e = $(s); if (e) e.textContent = n; });
    const h = $('[data-amb-hora]'); if (h) h.textContent = hhmm(R.minuto);
    const f = $('[data-amb-fora]'); if (f) f.hidden = !(R.foraHorario && !FOTO);
  }

  // ---------------------------------------------------------------- 8. CLIQUES, TECLADO, MOUSE
  // Um ouvinte só, na raiz da aba (delegação). Os atributos levam o prefixo "data-amb-"
  // para não cair nos ouvintes do app.js (data-ordem, data-busca, data-filtro...).
  function aoClicar(e) {
    if (arrastou) { arrastou = false; return; }   // fim de arrasto do mapa não é clique
    const perto = sel => e.target.closest(sel);
    let b;
    // Menu de camadas: o navegador abre e fecha o <details> DEPOIS deste clique; clicar fora fecha.
    // Clicar fora de caminhão, de linha da Expedição e da janela tira a seleção do caminhão.
    if (S.selExp && !perto('.amb-svg [data-amb-exp], tr[data-amb-exp-linha], [data-amb-est]')) selecionarCaminhao('');
    const menu = $('[data-amb-menu]');
    if (perto('[data-amb-menu] summary')) { S.menu = !menu.open; return; }
    if (S.menu && !perto('[data-amb-menu]')) { S.menu = false; if (menu) menu.open = false; }
    if ((b = perto('[data-amb-un]'))) {
      const u = b.getAttribute('data-amb-un');
      if (u === S.unidade) return;   // a unidade aberta fica aberta (é sempre uma, como um botão de rádio)
      S.unidade = u; S.prat = ''; S.sel = ''; S.foco = ''; S.andar = 1;
      S.vista.rot = 0; Object.assign(cam, CAM_INICIAL());
      return redesenhar();
    }
    if (perto('[data-amb-hist]')) return alternarHist();
    if ((b = perto('[data-amb-modo]'))) return mudarVista({ modo: b.getAttribute('data-amb-modo') });
    if ((b = perto('[data-amb-andar]'))) return trocarAndar(Number(b.getAttribute('data-amb-andar')));
    if ((b = perto('[data-amb-cam]'))) return comandoCamera(b.getAttribute('data-amb-cam'));
    if ((b = perto('[data-amb-camada]'))) {
      const k = b.getAttribute('data-amb-camada');
      if (k === 'baixas') return mudarVista({ baixas: !S.vista.baixas });
      S.camadas[k] = !S.camadas[k]; aplicarCamadas();
      return atualizarBarra();
    }
    if ((b = perto('[data-amb-aba]'))) return trocarAba(b.getAttribute('data-amb-aba'));
    if ((b = perto('[data-amb-sub]'))) { S.subExp = b.getAttribute('data-amb-sub'); return atualizarJanela(); }
    if ((b = perto('.amb-svg [data-amb-exp]'))) {   // caminhão no mapa: abre a Expedição na linha dele
      const id = b.getAttribute('data-amb-exp');
      S.subExp = sairam(S.unidade).some(e => e.id === id) ? 'sairam' : 'asair';   // andando, já saiu; parado, ainda vai sair
      selecionarCaminhao(id);
      trocarAba('expedicao');
      const tr = $(`tr[data-amb-exp-linha="${id}"]`); if (tr) tr.scrollIntoView({ block: 'nearest' });
      return;
    }
    if ((b = perto('tr[data-amb-exp-linha]'))) { selecionarCaminhao(b.getAttribute('data-amb-exp-linha')); return; }
    if ((b = perto('tr[data-amb-pessoa]'))) return focarPessoa(b.getAttribute('data-amb-pessoa'));
    if (perto('[data-amb-est-alterna]')) return alternarEstoque();
    if (perto('[data-amb-ficha-fecha]')) return soltarFoco();
    if (perto('[data-amb-limpar]')) {
      S.cat = S.area = S.sit = S.busca = S.buscaT = S.prat = S.sel = '';
      const i = $('[data-amb-busca]'); if (i) i.value = '';
      return atualizarInventario();
    }
    if (perto('[data-amb-tira-prat]')) { S.prat = ''; return atualizarInventario(); }
    if ((b = perto('[data-amb-ordem]'))) return clicarOrdem(b.getAttribute('data-amb-ordem'));
    if ((b = perto('tr[data-amb-item]'))) return b.hasAttribute('data-amb-atencao') ? irParaItem(b.getAttribute('data-amb-item')) : clicarLinha(b.getAttribute('data-amb-item'));
    if ((b = perto('[data-amb-fecha]'))) { const k = b.getAttribute('data-amb-fecha'); S.notas[k] = false; return redesenharNotas(k, false); }
    if ((b = perto('[data-amb-abre]'))) { const k = b.getAttribute('data-amb-abre'); S.notas[k] = true; return redesenharNotas(k, true); }
    if ((b = perto('.amb-boneco'))) return focarPessoa(b.getAttribute('data-id'));
    if (perto('[data-amb-patio]')) return alternarHist(true);
    if (perto('[data-amb-escada]')) return trocarAndar(S.andar === 1 ? 2 : 1);   // a escada leva ao outro andar
    if ((b = perto('[data-cod]'))) return clicarPrateleira(b.getAttribute('data-cod'));
    if (perto('[data-amb-mini]')) return clicarMini(e);
  }
  // Cabeçalho de tabela ("tabela:coluna"): muda a ordem, redesenha SÓ aquela tabela e devolve
  // o foco ao mesmo botão (quem usa o teclado continua de onde estava).
  function clicarOrdem(alvo) {
    const [tab, k] = alvo.split(':');
    S.ordens[tab] = G.proximaOrdem(S.ordens[tab], k);
    if (tab === 'hist') {
      const p = $('[data-amb-hist-painel]'), rol = p && p.querySelector('[data-amb-hist-rolagem]'), topo = rol ? rol.scrollTop : 0;
      if (p) { p.innerHTML = htmlHist(); const n = p.querySelector('[data-amb-hist-rolagem]'); if (n) n.scrollTop = topo; }
    } else if (tab === 'rem') { const rem = $('[data-amb-remoto]'); if (rem) rem.innerHTML = htmlRemoto(); }
    else if (tab === 'inv') atualizarInventario();
    else atualizarJanela();
    const bt = $(`[data-amb-ordem="${alvo}"]`); if (bt) bt.focus({ preventScroll: true });
  }
  // Clique no minimapa: a câmera vai até aquele ponto da planta (no andar em foco).
  function clicarMini(e) {
    const [lw, lh] = MP.limites(planoFoco());
    const s = $('.amb-mini'), r = s.getBoundingClientRect(), vw = lw + 1, vh = lh + 1, k = Math.max(vw / r.width, vh / r.height);
    const wx = -0.5 + (e.clientX - r.left - (r.width - vw / k) / 2) * k, wy = -0.5 + (e.clientY - r.top - (r.height - vh / k) / 2) * k;
    const [tx, ty] = MP.proj(Math.max(0, Math.min(lw, wx)), Math.max(0, Math.min(lh, wy)), zFoco()), z = Math.max(cam.zoom, 2.2);
    cam.seguir = false;
    moverCamera(Object.assign({ zoom: z }, centroLivre(tx, ty, z)), 450);
  }
  function aoMudar(e) {
    const s = e.target.closest('[data-amb-f]');
    if (!s) return;
    S[s.getAttribute('data-amb-f')] = s.value; S.sel = '';
    atualizarInventario();
  }
  function aoDigitar(e) {
    const a = e.target;
    if (a.matches('[data-amb-busca]')) {   // uma busca só: a aba aberta diz o que ela procura
      if (S.aba === 'turno') { S.buscaT = a.value; return atualizarJanela(); }
      if (S.aba === 'expedicao') { S.buscaE = a.value; return atualizarJanela(); }
      S.busca = a.value; S.sel = ''; return atualizarInventario();
    }
  }
  function aoTeclar(e) {
    if (e.key === 'Escape' && raiz) {
      if (S.foco) return soltarFoco();
      if (S.selExp) return selecionarCaminhao('');
      if (S.hist) { alternarHist(false); const b = $('.amb-bt-hist'); if (b) b.focus(); return; }
      if (!cam.tudo) return comandoCamera('tudo');
    }
    if ((e.key === 'Enter' || e.key === ' ') && raiz && raiz.contains(e.target)) {
      const cod = e.target.closest('[data-cod]'), tr = e.target.closest('tr[data-amb-item]'), patio = e.target.closest('[data-amb-patio]'), pes = e.target.closest('tr[data-amb-pessoa]');
      if (pes) { e.preventDefault(); return focarPessoa(pes.getAttribute('data-amb-pessoa')); }
      if (cod) { e.preventDefault(); clicarPrateleira(cod.getAttribute('data-cod')); } else if (tr) { e.preventDefault(); clicarLinha(tr.getAttribute('data-amb-item')); }
      else if (patio) { e.preventDefault(); alternarHist(true); }
      else if (e.target.closest('[data-amb-escada]')) { e.preventDefault(); trocarAndar(S.andar === 1 ? 2 : 1); }
    }
  }
  // Mouse em cima de uma pessoa: ela para (fica fácil de clicar); saiu de cima, ela segue.
  function congelar(id) {
    if (id === parado) return;
    const sim = simAtual(), velho = parado && sim && sim.bonecos.get(parado);
    if (velho) velho.parado = false;
    parado = id || '';
    const novo = parado && sim && sim.bonecos.get(parado);
    if (novo) novo.parado = true;
  }
  function aoPassar(e) {
    const g = e.target.closest && e.target.closest('.amb-boneco'); congelar(g ? g.getAttribute('data-id') : '');
    const c = e.target.closest && e.target.closest('.amb-svg [data-amb-exp]'); passarCaminhao(c ? c.getAttribute('data-amb-exp') : '');
  }
  function aoSairDaAba() { congelar(''); passarCaminhao(''); }
  // Arrastar no mapa não seleciona texto (nem o rótulo do desenho, nem o que está em volta).
  // Nas janelas por cima do mapa (estoque, avisos, pessoa) o texto continua selecionável.
  function aoSelecionar(e) {
    const el = e.target && (e.target.nodeType === 1 ? e.target : e.target.parentElement);
    if ((el && el.closest('[data-amb-quadro]')) || arrasto) e.preventDefault();
  }
  // Arrastar o mapa move a câmera (só vale como arrasto depois de 5 px: menos que isso é clique).
  function aoApertar(e) {
    if (e.button !== 0 || !e.target.closest('[data-amb-quadro]')) return;
    const svg = svgEl(), r = svg.getBoundingClientRect(), [, , w, h] = caixaCam();
    arrasto = { x: e.clientX, y: e.clientY, cx: cam.cx, cy: cam.cy, k: Math.max(w / r.width, h / r.height), id: e.pointerId, movido: false };
  }
  function aoMover(e) {
    if (!arrasto) return;
    const dx = e.clientX - arrasto.x, dy = e.clientY - arrasto.y;
    if (!arrasto.movido && Math.abs(dx) + Math.abs(dy) < 5) return;
    if (!arrasto.movido) {
      arrasto.movido = true;
      const sel = window.getSelection && window.getSelection(); if (sel && sel.removeAllRanges) sel.removeAllRanges();
      try { svgEl().setPointerCapture(arrasto.id); } catch (er) { /* sem captura: tudo bem */ }
    }
    cancelAnimationFrame(camRaf); camRaf = 0; cam.seguir = false; cam.tudo = false;
    cam.cx = arrasto.cx - dx * arrasto.k; cam.cy = arrasto.cy - dy * arrasto.k;
    aplicarCamera();
  }
  function aoSoltar() {
    if (arrasto && arrasto.movido) { arrastou = true; setTimeout(() => { arrastou = false; }, 0); }
    arrasto = null;
  }
  // Roda do mouse: aproxima ou afasta mantendo parado o ponto que está embaixo do cursor.
  function aoRolar(e) {
    if (!e.target.closest('[data-amb-quadro]')) return;
    e.preventDefault();
    const svg = svgEl(), r = svg.getBoundingClientRect(), [x, y, w, h] = caixaCam();
    const k = Math.max(w / r.width, h / r.height);
    const px = x + (e.clientX - r.left - (r.width - w / k) / 2) * k, py = y + (e.clientY - r.top - (r.height - h / k) / 2) * k;
    const [W, H] = base(), z = Math.max(zMin, Math.min(6, cam.zoom * Math.exp(-e.deltaY * 0.0015))), w2 = W / z, h2 = H / z;
    cancelAnimationFrame(camRaf); camRaf = 0; cam.seguir = false; cam.tudo = false;
    cam.zoom = z; cam.cx = px - (px - x) / w * w2 + w2 / 2; cam.cy = py - (py - y) / h * h2 + h2 / 2;
    aplicarCamera();
  }
  function aoVisibilidade() { if (document.hidden) pararLaco(); else ligarLaco(); }

  // ---------------------------------------------------------------- 9. LAÇO DE ANIMAÇÃO
  // Roda só com a aba montada e a página visível (na foto, não roda). Cada quadro:
  // relógio anda -> se virou o minuto, sincroniza quem está -> bonecos andam -> câmera segue o foco.
  const rodando = () => !!raiz && !FOTO && !document.hidden;
  function ligarLaco() { if (!rafId && rodando()) { ultimo = performance.now(); rafId = requestAnimationFrame(laco); } }
  function pararLaco() { if (rafId) cancelAnimationFrame(rafId); rafId = 0; }
  function laco(agora) {
    rafId = 0;
    if (!rodando()) return;
    const dt = Math.min(0.1, Math.max(0, (agora - ultimo) / 1000));
    ultimo = agora; quadros++;
    const antes = Math.floor(R.minuto);
    andarRelogio(dt);
    if (Math.floor(R.minuto) !== antes) aoMudarMinuto(true);
    const sim = simAtual();
    if (sim && sim.svg) {
      MP.avancar(sim, dt, !reduzido);
      caminhaoPasso(dt);
      const b = S.foco && cam.seguir && !camRaf && sim.bonecos.get(S.foco);
      if (b) {   // a câmera acompanha a pessoa em foco, devagar (e troca de andar com ela)
        if (temAndar2() && b.andar !== S.andar) trocarAndar(b.andar);
        const [tx, ty] = naTela(b), alvo = centroLivre(tx, ty - 8, cam.zoom), dx = alvo.cx - cam.cx, dy = alvo.cy - cam.cy;
        if (Math.abs(dx) + Math.abs(dy) > 0.2) { cam.cx += dx * 0.12; cam.cy += dy * 0.12; aplicarCamera(); }
      }
    }
    rafId = requestAnimationFrame(laco);
  }

  // ---------------------------------------------------------------- 10. MONTAR E DESMONTAR
  function montar(el, ctx) {
    if (!el || !ctx) return;
    desmontar();
    if (S.aba === 'expedicao' && !(A.plantas[S.unidade] && A.plantas[S.unidade].vagasCaminhao)) S.aba = 'estoque';
    raiz = el; C = ctx;
    lang = ctx.I && ctx.I.lang === 'en' ? 'en' : 'pt';
    reduzido = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
    iniciarRelogio();
    const sim = COM_MAPA[S.unidade] ? garantirSim(S.unidade) : null;
    if (sim) MP.sincronizar(sim, R.minuto, false);  // o relógio pode ter andado com a aba fechada
    if (sim && reduzido) MP.paraCasa(sim);
    raiz.innerHTML = htmlAba();
    if (sim) {
      MP.ligar(sim, svgEl()); MP.avancar(sim, 0, false);
      cicloCam = -1; paradosVistos = ''; hoverExp = ''; estacionarAgora(true); caminhaoPasso(0);
      aplicarCamadas();
    }
    atualizarInventario();
    recebidosVistos = recebidos(S.unidade).length;
    eventosVistos = S.hist ? eventos(S.unidade).length : -1;
    if (sim) {
      medirQuadro();
      const tudo = centroTudo();   // também acerta o menor zoom
      if (cam.tudo) Object.assign(cam, tudo);
      aplicarCamera();
      // O quadro muda de tamanho (janela, lista de presentes): a câmera acompanha.
      if (window.ResizeObserver) {
        observador = new ResizeObserver(() => { if (!raiz) return; const tudo = centroTudo(); if (cam.tudo) Object.assign(cam, tudo); aplicarCamera(); });
        observador.observe($('[data-amb-quadro]'));
      }
    }
    if (S.foco) abrirFicha();
    raiz.addEventListener('click', aoClicar);
    raiz.addEventListener('input', aoDigitar);
    raiz.addEventListener('change', aoMudar);
    raiz.addEventListener('pointerdown', aoApertar);
    raiz.addEventListener('pointermove', aoMover);
    raiz.addEventListener('pointerup', aoSoltar);
    raiz.addEventListener('pointercancel', aoSoltar);
    raiz.addEventListener('pointerover', aoPassar);
    raiz.addEventListener('pointerleave', aoSairDaAba);
    raiz.addEventListener('selectstart', aoSelecionar);
    raiz.addEventListener('wheel', aoRolar, { passive: false });
    document.addEventListener('keydown', aoTeclar);
    document.addEventListener('visibilitychange', aoVisibilidade);
    ligarLaco();
  }
  function desmontar() {
    pararLaco();
    cancelAnimationFrame(camRaf); camRaf = 0; arrasto = null;
    clearTimeout(timerPulso); timerPulso = 0;
    if (observador) { observador.disconnect(); observador = null; }
    congelar('');
    document.removeEventListener('keydown', aoTeclar);
    document.removeEventListener('visibilitychange', aoVisibilidade);
    if (raiz) {
      raiz.removeEventListener('click', aoClicar); raiz.removeEventListener('input', aoDigitar); raiz.removeEventListener('change', aoMudar);
      raiz.removeEventListener('pointerdown', aoApertar); raiz.removeEventListener('pointermove', aoMover);
      raiz.removeEventListener('pointerup', aoSoltar); raiz.removeEventListener('pointercancel', aoSoltar);
      raiz.removeEventListener('pointerover', aoPassar); raiz.removeEventListener('pointerleave', aoSairDaAba);
      raiz.removeEventListener('selectstart', aoSelecionar);
      raiz.removeEventListener('wheel', aoRolar, { passive: false });
    }
    Object.keys(sims).forEach(u => MP.soltar(sims[u]));
    raiz = null; C = null;
  }
  // Trocar de unidade ou abrir a lista = desmontar e montar de novo, pelo MESMO caminho que o app usa.
  function redesenhar() { const el = raiz, c = C; desmontar(); montar(el, c); }

  // A casca que o app põe na página (o título acompanha o idioma: o trilho lê data-titulo).
  window.PAGINAS = window.PAGINAS || {};
  window.PAGINAS.ambiente = function (r, ctx) {
    lang = ctx && ctx.I && ctx.I.lang === 'en' ? 'en' : 'pt';
    return `<section class="secao" id="s-ambiente" data-titulo="${esc(t('titulo'))}"><div id="ambiente-raiz"></div></section>`;
  };
  window.AMBIENTE = {
    montar, desmontar,
    // Só para o teste automático: LÊ o que a tela usou e, no máximo, põe o relógio numa hora fixa.
    _teste: {
      quadros: () => quadros,
      rodando: () => !!rafId,
      estado: () => ({ unidade: S.unidade, cat: S.cat, area: S.area, sit: S.sit, busca: S.busca, prat: S.prat, sel: S.sel, foco: S.foco,
        minuto: R.minuto, fixo: R.fixo, foraHorario: R.foraHorario, andar: S.andar, hist: S.hist, estoque: S.estoque, aba: S.aba, menu: S.menu }),
      cam: () => ({ zoom: cam.zoom, cx: cam.cx, cy: cam.cy, rot: S.vista.rot, modo: S.vista.modo, baixas: S.vista.baixas, animando: !!camRaf, tudo: cam.tudo, aspecto, zMin }),
      bonecos: () => { const s = simAtual(); return s ? [...s.bonecos.values()].map(b => ({ id: b.id, area: b.p.area, nivel: b.p.nivel, tipo: b.tipo, sala: b.sala,
        x: b.x, y: b.y, andar: b.andar, estado: b.estado, foraGrupo: b.foraGrupo || '', casaAndar: (s.casa[b.id] || {}).andar, parado: !!b.parado, sentado: !!b.sentado, anda: b.i < b.rota.length, subir: !!b.subir,
        naTela: !!(b.el && b.el.isConnected) })) : []; },
      turno: () => linhasTurno().map(x => [x.p.id, x.onde, !!x.saiu]),
      // Caminhão: põe o ciclo no segundo t e diz onde ele ficou (dx = células à direita da doca).
      // Caminhões: onde está cada um; a lista da Expedição; andar a frota em passos fixos de 1/30 s.
      frota: () => { const s = simAtual(); return s ? MP.frota(s) : []; },
      expedicao: () => { const s = simAtual(); return { asair: aSair(S.unidade).map(e => e.id), sairam: sairam(S.unidade).map(e => [e.id, e.saida]),
        parados: s ? MP.frota(s).filter(a => !a.ciclo && a.estado === 'parado').map(a => a.id) : [], sel: S.selExp, sub: S.subExp, aba: S.aba }; },
      avancarCaminhoes: seg => { for (let i = 0; i < Math.round(seg * 30); i++) caminhaoPasso(1 / 30); return MP.frota(simAtual()); },
      // Anda a cena em passos FIXOS de 1/30 s: o Edge sem tela quase não roda requestAnimationFrame.
      avancar: seg => { const s = simAtual(); if (s) for (let i = 0; i < Math.round(seg * 30); i++) MP.avancar(s, 1 / 30, true); return s ? s.bonecos.size : 0; },
      // Relógio numa hora fixa (minutos desde 00:00) e de volta ao vivo. "natural" = como se o
      // relógio tivesse andado sozinho até ali (quem acabou de bater o ponto nasce na porta).
      irPara: (min, natural) => { R.fixo = true; R.minuto = min; aoMudarMinuto(!!natural); return R.minuto; },
      aoVivo: () => { R.fixo = false; R.minuto = null; iniciarRelogio(); aoMudarMinuto(false); return R.minuto; }
    }
  };
})();
