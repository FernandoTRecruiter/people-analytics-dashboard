/* =============================================================================
   paginas.js: o conteúdo de cada aba (Visão geral, Pessoas, Recrutamento).

   Regra de desenho que vale para tudo aqui: UMA anatomia por tipo de peça.
   Todo indicador é igual (rótulo, número, selo, linha de apoio, botão "i");
   toda comparação "por X" é a mesma lista com a barra atrás do rótulo.
   E quase tudo é clicável: o atributo data-drill diz QUEM está naquele número,
   e o app.js abre a tabela com os nomes (modo tabela).
   ============================================================================= */
window.PAGINAS = (function () {
  'use strict';
  const G = window.GRAFICOS, esc = G.esc;

  // Um indicador ("herói"). Primeiro da fila sai escuro, com o número em destaque.
  // drill = o número vira clicável e abre a lista de pessoas por trás dele.
  function heroi(c, o) {
    const num = o.drill ? `<button class="num-drill" data-drill="${o.drill}" data-tip="${esc(c.T('clique_nomes'))}">${o.numero}</button>` : o.numero;
    return `<div class="heroi${o.escuro ? ' escuro' : ''}">` +
      `<div class="h-rot">${esc(o.rotulo)}${o.conta ? `<button class="info" data-conta="${o.conta}" aria-label="${esc(c.T('x_titulo'))}">i</button>` : ''}</div>` +
      `<div class="h-num">${num}${o.chip ? ` <span class="chip ${o.chip[0]}">${esc(o.chip[1])}</span>` : ''}</div>` +
      `<div class="h-sub">${o.sub || ''}</div></div>`;
  }
  const secao = (id, titulo, sub, corpo) =>
    `<section class="secao" id="s-${id}" data-titulo="${esc(titulo)}"><header class="s-cab"><h2>${esc(titulo)}</h2>${sub ? `<p>${sub}</p>` : ''}</header>${corpo}</section>`;
  const cartao = (titulo, corpo, extra) => `<div class="cartao${extra ? ' ' + extra : ''}">${titulo ? `<h3>${esc(titulo)}</h3>` : ''}${corpo}</div>`;
  const chipTurn = (c, st) => st ? [{ saudavel: 'ok', atencao: 'warn', alto: 'bad' }[st], c.T('st_' + st)] : null;
  const chipNov = (c, st) => st ? [{ boa: 'ok', atencao: 'warn', baixa: 'bad' }[st], c.T('st_' + st)] : null;
  const dica = c => `<span class="dica-clique">${esc(c.T('clique_nomes'))}</span>`;

  // Listas "por X" a partir de um objeto de contagens, já no idioma da tela.
  // prefixo = começo da chave do clique (ex.: "area" vira data-drill="area:ops").
  function porX(c, contagens, cadastro, prefixo, ordenar) {
    const itens = Object.entries(contagens).map(([k, v]) => ({ chave: k, rotulo: c.I.nome(cadastro[k]), valor: v, drill: prefixo ? prefixo + ':' + k : null }));
    itens.sort(ordenar || ((a, b) => b.valor - a.valor));
    return itens;
  }
  const porOrdemNivel = c => (a, b) => c.D.niveis[a.chave].ordem - c.D.niveis[b.chave].ordem;
  const maiorDe = obj => Object.entries(obj).sort((a, b) => b[1] - a[1])[0] || [null, 0];

  function contaTurnover(r, c) {
    const T = c.T;
    c.conta('turnover', T('k_turnover'), T('x_turnover'), [
      [T('numerador') + ': ' + c.tipoNome().toLowerCase(), r.saidasTipo.length],
      [T('denominador') + ': ' + T('k_hc').toLowerCase() + ' · ' + r.per.n + ' ' + T('meses'), c.num(r.hcMedio, 1)],
      [T('resultado'), c.pct(r.turnover)], [T('anualizado'), c.pct(r.anual)]],
      `${r.fimDeContrato} · ${T('fim_fora')}`);
  }

  // ---------------------------------------------------------------- VISÃO GERAL
  // Lida de cima para baixo: onde estamos -> como chegamos aqui -> do que o quadro
  // é feito -> como vão as vagas. Cada frase do resumo leva aos nomes.
  function geral(r, c) {
    const T = c.T, D = c.D;
    c.conta('hc', T('k_hc'), T('x_hc'), [[T('ativos') + ' ' + c.data(r.per.fim), r.hcFim]]);
    c.conta('movs', T('k_movs'), T('x_movs'), [['+', r.entradas.length], ['-', r.saidas.length], [T('saldo'), r.entradas.length - r.saidas.length]]);
    contaTurnover(r, c);
    c.conta('casa', T('k_casa'), T('x_casa'), [[T('ativos'), r.hcFim], [T('resultado'), c.num(r.casaMedia, 1) + ' ' + T('anos')]]);
    c.conta('vagas', T('k_vagas'), T('x_vagas'), [[T('k_vagas'), r.abertas.length], ['> 60 ' + T('dias'), r.abertas.filter(v => v.dias > 60).length]]);
    const saldo = r.entradas.length - r.saidas.length;

    // 1. Onde estamos: os 5 números + o resumo em frases.
    let h = '<div class="herois">' +
      heroi(c, { escuro: true, rotulo: T('k_hc'), conta: 'hc', drill: 'todos', numero: c.num(r.hcFim), sub: `${c.pct(r.mulheres / (r.hcFim || 1))} ${T('k_mulheres').toLowerCase()} · ${c.num(r.casaMedia, 1)} ${T('anos')}` }) +
      heroi(c, { rotulo: T('k_movs'), conta: 'movs', numero: `<button class="num-drill pos" data-drill="entradas">+${r.entradas.length}</button> <span class="barra-sep">/</span> <button class="num-drill neg" data-drill="saidas">-${r.saidas.length}</button>`, sub: `${T('saldo')} ${saldo >= 0 ? '+' : ''}${saldo} ${T('no_periodo')}` }) +
      heroi(c, { rotulo: T('k_turnover'), conta: 'turnover', drill: 'saidas-tipo', numero: c.pct(r.turnover), chip: chipTurn(c, r.stTurnover), sub: `${r.saidasTipo.length} ${T('de')} ${r.saidas.length} · ${c.tipoNome()}` }) +
      heroi(c, { rotulo: T('k_casa'), conta: 'casa', numero: `${c.num(r.casaMedia, 1)} <small>${T('anos')}</small>`, sub: `${c.num(r.hcFim)} ${T('ativos')}` }) +
      heroi(c, { rotulo: T('k_vagas'), conta: 'vagas', drill: 'vagas-abertas', numero: c.num(r.abertas.length), sub: `${r.abertas.filter(v => v.dias > 60).length} > 60 ${T('dias')}` }) +
      '</div>';
    const [aMaior, nMaior] = maiorDe(r.porArea), [aSaiu, nSaiu] = maiorDe(r.saidasArea);
    const lid = r.lideres ? c.pct(r.lideresF / r.lideres, 0) : '-';
    const frases = [
      [T('ins_quadro', { a: r.hcIni, b: r.hcFim, d: (r.hcFim - r.hcIni >= 0 ? '+' : '') + (r.hcFim - r.hcIni) }), 'todos'],
      aMaior ? [T('ins_maior', { a: c.I.nome(D.areas[aMaior]), n: nMaior, p: c.pct(nMaior / (r.hcFim || 1), 0) }), 'area:' + aMaior] : null,
      aSaiu ? [T('ins_saidas', { a: c.I.nome(D.areas[aSaiu]), s: nSaiu }), 'saidas-area:' + aSaiu] : null,
      [T('ins_turn', { t: c.tipoNome().toLowerCase(), v: c.pct(r.anual), st: r.stTurnover ? T('st_' + r.stTurnover).toLowerCase() : '-' }), 'saidas-tipo'],
      [T('ins_vagas', { n: r.abertas.length, m: r.abertas.filter(v => v.dias > 60).length }), 'vagas-abertas'],
      [T('ins_mulheres', { p: c.pct(r.mulheres / (r.hcFim || 1), 0), l: lid }), 'genero:F']
    ].filter(Boolean);
    h += `<div class="cartao resumo-cartao"><h3>${esc(T('s_resumo'))}</h3><ul class="insights">` +
      frases.map(([t, d]) => `<li><button class="ins" data-drill="${d}">${esc(t)}<span aria-hidden="true">→</span></button></li>`).join('') +
      `</ul><p class="resumo">${esc(T('resumo_onde', { d: c.data(new Date(r.ultimo.fim.getFullYear(), r.ultimo.fim.getMonth(), 0)), s: r.ultimo.saidas, e: r.ultimo.entradas }))}</p></div>`;
    let out = secao('onde', T('s_onde'), `${esc(c.periodoNome())} · ${esc(c.data(r.per.ini))} → ${esc(c.data(r.per.fim))}`, h);

    // 2. Como chegamos aqui: a linha do quadro e as barras de entradas e saídas.
    const tipMov = s => `${G.mesCurto(s.fim, c.I.locale())}: ${s.hc} · +${s.entradas} | -${s.saidas} · ${T('clique_nomes')}`;
    out += secao('evolucao', T('s_evolucao'), `${T('fim_de_mes')} · <span class="pos">+${T('leg_in')}</span> | <span class="neg">-${T('leg_out')}</span> · ${dica(c)}`,
      cartao('', G.linhaQuadro(r.serie, { titulo: T('s_evolucao'), locale: c.I.locale(), tip: tipMov })) +
      cartao(T('s_mov'), G.barrasMov(r.serie, { titulo: T('s_mov'), locale: c.I.locale(), tip: tipMov })));

    // 3. Do que o quadro é feito: áreas e gênero (com a liderança separada).
    const lideresG = { F: r.lideresF, M: r.ativosFim.filter(p => D.niveis[p.nivel].lider && p.genero === 'M').length, N: r.ativosFim.filter(p => D.niveis[p.nivel].lider && p.genero === 'N').length };
    const linhasGen = [
      { rotulo: T('k_hc'), partes: ['F', 'M', 'N'].map(g => ({ classe: g.toLowerCase(), nome: T('g_' + g), valor: g === 'F' ? r.mulheres : g === 'M' ? r.homens : r.hcFim - r.mulheres - r.homens, drill: 'genero:' + g })) },
      { rotulo: T('d_lider'), partes: ['F', 'M', 'N'].map(g => ({ classe: g.toLowerCase(), nome: T('g_' + g), valor: lideresG[g], drill: 'lider:' + g })) }
    ];
    out += secao('composicao', T('s_composicao'), dica(c), '<div class="grade2">' +
      cartao(T('s_por_area'), G.listaBarras(porX(c, r.porArea, D.areas, 'area'), { total: r.hcFim })) +
      cartao(T('s_genero_lid'), G.segmentos(linhasGen, [{ classe: 'f', nome: T('g_F') }, { classe: 'm', nome: T('g_M') }, { classe: 'n', nome: T('g_N') }]) +
        `<p class="nota-cartao"><b class="mono">${lid}</b> ${esc(T('liderancaF'))}</p>` +
        `<h3 class="sub-h3">${esc(T('por_vinculo'))}</h3>` + G.listaBarras(porX(c, r.porVinculo, D.vinculos, 'vinculo'), { total: r.hcFim })) + '</div>');

    // 4. Recrutamento em resumo (os mesmos números da aba de recrutamento).
    c.conta('contrat', T('k_contrat'), T('x_contrat'), [[T('k_contrat'), r.fechadas]]);
    c.conta('ttf', T('k_ttf'), T('x_ttf'), [[T('k_contrat'), r.fechadas], [T('mediana'), (r.ttf == null ? '-' : c.num(r.ttf, Number.isInteger(r.ttf) ? 0 : 1)) + ' ' + T('dias')]]);
    c.conta('aceite', T('k_aceite'), T('x_aceite'), [[T('numerador') + ': ' + T('k_contrat').toLowerCase(), r.fechadas], [T('denominador') + ': ' + T('funil_ofertas').toLowerCase(), r.ofertas]]);
    const etapas = r.funil.map(([k, v]) => ({ rotulo: T('funil_' + k), valor: v }));
    out += secao('rs-resumo', T('s_rs_resumo'), '', '<div class="herois h3">' +
      heroi(c, { rotulo: T('k_contrat'), conta: 'contrat', numero: c.num(r.fechadas), sub: T('no_periodo') }) +
      heroi(c, { rotulo: T('k_ttf'), conta: 'ttf', numero: r.ttf == null ? '-' : `${c.num(r.ttf)} <small>${T('dias')}</small>`, sub: T('mediana') }) +
      heroi(c, { rotulo: T('k_aceite'), conta: 'aceite', numero: r.aceite == null ? '-' : c.pct(r.aceite, 0), sub: `${r.fechadas} ${T('de')} ${r.ofertas}` }) +
      '</div>' + cartao(T('s_funil'), G.funil(etapas, { locale: c.I.locale(), conversao: T('conversao') })) +
      `<button class="botao" data-aba="rs">${esc(T('abrir_rs'))} →</button>`);
    return out;
  }

  // ---------------------------------------------------------------- PESSOAS
  function pessoas(r, c) {
    const T = c.T, D = c.D;
    c.conta('hc', T('k_hc'), T('x_hc'), [[T('ativos') + ' ' + c.data(r.per.fim), r.hcFim]]);
    c.conta('idade', T('k_idade'), T('x_idade'), [[T('ativos'), r.hcFim], [T('resultado'), c.num(r.idadeMedia, 1) + ' ' + T('anos')]]);
    c.conta('mulheres', T('k_mulheres'), T('x_mulheres'), [[T('numerador'), r.mulheres], [T('denominador'), r.hcFim], [T('resultado'), c.pct(r.mulheres / r.hcFim)]]);
    c.conta('ppi', T('k_ppi'), T('x_ppi'), [[T('numerador'), r.ppi], [T('denominador'), r.comRaca], [T('resultado'), c.pct(r.ppi / (r.comRaca || 1))]]);
    c.conta('lider', T('k_lider'), T('x_lider'), [[T('numerador'), r.lideresF], [T('denominador'), r.lideres], [T('resultado'), r.lideres ? c.pct(r.lideresF / r.lideres) : '-']]);
    contaTurnover(r, c);
    c.conta('saiu', T('k_saiu'), T('x_movs'), Object.keys(D.motivos).map(k => [c.I.nome(D.motivos[k]), r.porMotivo[k] || 0]));
    c.conta('antes', T('k_antes'), T('x_antes'), [[T('k_saiu'), r.saidasTipo.length], [T('sairam_1ano'), r.sairam1ano], [T('resultado'), r.casaAntes == null ? '-' : c.num(r.casaAntes, 1) + ' ' + T('anos')]]);
    c.conta('novatos', T('k_novatos'), T('x_novatos'), [[T('numerador'), r.ficaram], [T('denominador'), r.novatos], [T('resultado'), r.retNovatos == null ? '-' : c.pct(r.retNovatos, 0)]]);

    // 1. Quadro
    let h = '<div class="herois h4">' +
      heroi(c, { escuro: true, rotulo: T('k_hc'), conta: 'hc', drill: 'todos', numero: c.num(r.hcFim), sub: `${T('de')} ${c.data(r.per.fim)}` }) +
      heroi(c, { rotulo: T('k_idade'), conta: 'idade', numero: `${c.num(r.idadeMedia, 1)} <small>${T('anos')}</small>`, sub: T('faixa_comum') + ': ' + Object.entries(r.faixas).sort((a, b) => b[1] - a[1])[0][0] + ' ' + T('anos') }) +
      heroi(c, { rotulo: T('k_mulheres'), conta: 'mulheres', drill: 'genero:F', numero: c.pct(r.mulheres / (r.hcFim || 1)), sub: `${r.mulheres} ${T('de')} ${r.hcFim}` }) +
      heroi(c, { rotulo: T('k_ppi'), conta: 'ppi', drill: 'ppi', numero: c.pct(r.ppi / (r.comRaca || 1)), sub: `${r.ppi} ${T('de')} ${r.comRaca} ${T('informados')}` }) + '</div>';
    h += '<div class="grade3">' +
      cartao(T('por_unidade'), G.listaBarras(porX(c, r.porUnidade, D.unidades, 'unidade'), { total: r.hcFim })) +
      cartao(T('s_por_nivel'), G.listaBarras(porX(c, r.porNivel, D.niveis, 'nivel', porOrdemNivel(c)), { total: r.hcFim })) +
      cartao(T('por_vinculo'), G.listaBarras(porX(c, r.porVinculo, D.vinculos, 'vinculo'), { total: r.hcFim })) + '</div>';
    let out = secao('quadro', T('s_quadro'), `${esc(c.periodoNome())} · ${dica(c)}`, h);

    // 2. Turnover
    const tipos = ['pedido', 'demissao', 'outro', 'todos'];
    const cont = { pedido: r.porMotivo.pedido || 0, demissao: r.porMotivo.demissao || 0, outro: r.porMotivo.outro || 0 };
    cont.todos = cont.pedido + cont.demissao + cont.outro;
    h = `<div class="cartao faixa-tipo"><div class="ft-linha"><span class="ft-rot">${esc(T('quem_conta'))}</span>` +
      tipos.map(t => `<button class="pilula${c.estado.tipoSaida === t ? ' ativa' : ''}" data-tipo="${t}" aria-pressed="${c.estado.tipoSaida === t}">${esc(T('t_' + t))} <b>${cont[t]}</b></button>`).join('') +
      `</div><div class="ft-nota">${r.per.n} ${T('meses')} · ${r.fimDeContrato} ${esc(T('fim_fora'))} · <button class="link" data-conta="turnover">${esc(T('como_conta'))}</button>` +
      `<span class="leg"><i class="ok"></i>${esc(T('leg_15'))}</span><span class="leg"><i class="warn"></i>${esc(T('leg_25'))}</span><span class="leg"><i class="bad"></i>${esc(T('leg_acima'))}</span></div></div>`;
    h += '<div class="herois h4">' +
      heroi(c, { rotulo: T('k_turnover'), conta: 'turnover', drill: 'saidas-tipo', numero: c.pct(r.turnover), chip: chipTurn(c, r.stTurnover), sub: `${T('anualizado')} ${c.pct(r.anual)}` }) +
      heroi(c, { rotulo: T('k_saiu'), conta: 'saiu', drill: 'saidas', numero: c.num(r.saidas.length), sub: `${r.fimDeContrato} · ${c.I.nome(D.motivos.fim).toLowerCase()}` }) +
      heroi(c, { rotulo: T('k_antes'), conta: 'antes', numero: r.casaAntes == null ? '-' : `${c.num(r.casaAntes, 1)} <small>${T('anos')}</small>`, sub: `${r.sairam1ano} ${T('de')} ${r.saidasTipo.length} ${T('sairam_1ano')}` }) +
      heroi(c, { rotulo: T('k_novatos'), conta: 'novatos', drill: 'novatos', numero: r.retNovatos == null ? '-' : c.pct(r.retNovatos, 0), chip: chipNov(c, r.stNovatos), sub: `${r.ficaram} ${T('de')} ${r.novatos} ${T('ficou_ano')}` }) + '</div>';
    h += cartao(T('turnover_mensal'), G.barrasMes(r.serie, { titulo: T('turnover_mensal'), locale: c.I.locale(), tip: s => `${G.mesCurto(s.fim, c.I.locale())}: ${c.pct(s.taxa || 0)} · ${s.saidasTipo} ${T('de')} ${s.hc} · ${T('clique_nomes')}` }));
    const bandas = ['<1', '1-2', '2-5', '5+'].map(k => ({ rotulo: k + ' ' + (k === '<1' ? T('ano') : T('anos')), valor: r.bandas[k], drill: 'banda:' + k }));
    h += '<div class="grade2">' +
      cartao(T('por_motivo'), G.listaBarras(porX(c, r.porMotivo, D.motivos, 'motivo'), { total: r.saidas.length })) +
      cartao(T('casa_saida'), G.listaBarras(bandas, { total: r.saidasTipo.length })) + '</div>';
    out += secao('turnover', T('s_turnover'), `${esc(c.periodoNome())} · ${dica(c)}`, h);

    // 3. Diversidade
    h = '<div class="herois h4">' +
      heroi(c, { rotulo: T('k_mulheres'), conta: 'mulheres', drill: 'genero:F', numero: c.pct(r.mulheres / (r.hcFim || 1)), sub: `${r.mulheres} ${T('de')} ${r.hcFim}` }) +
      heroi(c, { rotulo: T('k_lider'), conta: 'lider', drill: 'lider:F', numero: r.lideres ? c.pct(r.lideresF / r.lideres) : '-', sub: `${r.lideresF} ${T('de')} ${r.lideres} ${T('lideres')}` }) +
      heroi(c, { rotulo: T('k_ppi'), conta: 'ppi', drill: 'ppi', numero: c.pct(r.ppi / (r.comRaca || 1)), sub: `${r.ppi} ${T('de')} ${r.comRaca}` }) +
      heroi(c, { rotulo: T('k_idade'), conta: 'idade', numero: `${c.num(r.idadeMedia, 1)} <small>${T('anos')}</small>`, sub: T('ativos') }) + '</div>';
    const linhasGen = Object.keys(D.niveis).filter(n => r.porNivel[n]).map(n => ({
      rotulo: c.I.nome(D.niveis[n]),
      partes: ['F', 'M', 'N'].map(g => ({ classe: g.toLowerCase(), nome: T('g_' + g), valor: r.generoNivel[n][g], drill: `gn:${n}:${g}` }))
    }));
    h += '<div class="grade2 g-larga">' + cartao(T('genero_nivel'), G.segmentos(linhasGen, [{ classe: 'f', nome: T('g_F') }, { classe: 'm', nome: T('g_M') }, { classe: 'n', nome: T('g_N') }])) +
      '<div class="pilha">' + cartao(T('raca'), G.listaBarras(porX(c, r.porRaca, D.racas, 'raca'), { total: r.hcFim })) +
      cartao(T('faixa_idade'), G.listaBarras(Object.entries(r.faixas).map(([k, v]) => ({ rotulo: k + ' ' + T('anos'), valor: v, drill: 'faixa:' + k })), { total: r.hcFim })) + '</div></div>';
    out += secao('diversidade', T('s_diversidade'), `${esc(c.data(r.per.fim))} · ${dica(c)}`, h);

    // 4. Colaboradores (tabela com busca, ordem e páginas)
    out += secao('pessoas', T('s_pessoas'), `${r.hcFim} ${T('ativos')} · ${esc(c.data(r.per.fim))}`, tabelaPessoas(r, c));
    return out;
  }

  function tabelaPessoas(r, c) {
    const T = c.T, D = c.D, tb = c.estado.tabela;
    const busca = (tb.busca || '').trim().toLowerCase();
    let linhas = r.ativosFim.map(p => ({
      p, nome: p.nome, area: c.I.nome(D.areas[p.area]), nivel: c.I.nome(D.niveis[p.nivel]), ordemNivel: D.niveis[p.nivel].ordem,
      vinculo: c.I.nome(D.vinculos[p.vinculo]), unidade: c.I.nome(D.unidades[p.unidade]), admissao: p.admissao,
      casa: (r.per.fim - p.admissao) / (365.25 * 864e5)
    }));
    if (busca) linhas = linhas.filter(l => (l.nome + ' ' + l.area + ' ' + l.nivel).toLowerCase().includes(busca));
    // Ordem declarada: por nome. O cabeçalho ordena o conjunto INTEIRO (antes de paginar).
    const cols = [['nome', 'c_nome', 'texto', l => l.nome], ['area', 'c_area', 'texto', l => l.area], ['nivel', 'c_nivel', 'num', l => l.ordemNivel],
      ['vinculo', 'c_vinculo', 'texto', l => l.vinculo], ['unidade', 'c_unidade', 'texto', l => l.unidade], ['admissao', 'c_admissao', 'data', l => l.admissao], ['casa', 'c_casa', 'num', l => l.casa]]
      .map(([k, t, tipo, v]) => ({ k, t, tipo, v }));
    linhas = G.ordenar(G.ordenar(linhas, cols, { col: 'nome', passo: 1 }), cols, tb.ordem);
    const porPag = 12, paginas = Math.max(1, Math.ceil(linhas.length / porPag));
    tb.pagina = Math.min(tb.pagina || 1, paginas);
    const vis = linhas.slice((tb.pagina - 1) * porPag, tb.pagina * porPag);
    let h = `<div class="cartao tabela-cartao"><div class="tb-barra"><input class="busca" type="search" value="${esc(tb.busca || '')}" placeholder="${esc(T('buscar'))}" data-busca aria-label="${esc(T('buscar'))}"><span class="tb-conta">${linhas.length} ${T('linhas')}</span></div>`;
    h += '<div class="tb-rolagem"><table class="tabela"><thead><tr>' + cols.map(c => G.thOrdena(c, T(c.t), tb.ordem, 'data-ordem')).join('') + '</tr></thead><tbody>';
    h += vis.length ? vis.map(l => '<tr>' + cols.map(({ k }) => {
      if (k === 'admissao') return `<td class="mono">${c.data(l.admissao)}</td>`;
      if (k === 'casa') return `<td class="mono">${c.num(l.casa, 1)} ${T('anos')}</td>`;
      if (k === 'nome') return `<td><span class="avatar-mini">${esc(l.nome.split(' ').map(x => x[0]).slice(0, 2).join(''))}</span>${esc(l.nome)}</td>`;
      return `<td>${esc(l[k])}</td>`;
    }).join('') + '</tr>').join('') : `<tr><td colspan="${cols.length}" class="vazio">${esc(T('sem_linhas'))}</td></tr>`;
    h += `</tbody></table></div><div class="tb-pag"><button class="botao leve" data-pagina="-1" ${tb.pagina <= 1 ? 'disabled' : ''}>← ${esc(T('anterior'))}</button><span class="mono">${tb.pagina} / ${paginas}</span><button class="botao leve" data-pagina="1" ${tb.pagina >= paginas ? 'disabled' : ''}>${esc(T('proxima'))} →</button></div></div>`;
    return h;
  }

  // ---------------------------------------------------------------- RECRUTAMENTO
  function rs(r, c) {
    const T = c.T, D = c.D;
    c.conta('vagas', T('k_vagas'), T('x_vagas'), [[T('k_vagas'), r.abertas.length], ['> 60 ' + T('dias'), r.abertas.filter(v => v.dias > 60).length]]);
    c.conta('contrat', T('k_contrat'), T('x_contrat'), [[T('k_contrat'), r.fechadas]]);
    c.conta('ttf', T('k_ttf'), T('x_ttf'), [[T('k_contrat'), r.fechadas], [T('mediana'), (r.ttf == null ? '-' : c.num(r.ttf, Number.isInteger(r.ttf) ? 0 : 1)) + ' ' + T('dias')]]);
    c.conta('aceite', T('k_aceite'), T('x_aceite'), [[T('numerador'), r.fechadas], [T('denominador'), r.ofertas], [T('resultado'), r.aceite == null ? '-' : c.pct(r.aceite, 0)]]);
    let h = '<div class="herois h4">' +
      heroi(c, { escuro: true, rotulo: T('k_vagas'), conta: 'vagas', drill: 'vagas-abertas', numero: c.num(r.abertas.length), sub: `${r.abertas.filter(v => v.prioridade === 'alta').length} ${T('pr_alta').toLowerCase()}` }) +
      heroi(c, { rotulo: T('k_contrat'), conta: 'contrat', numero: c.num(r.fechadas), sub: T('no_periodo') }) +
      heroi(c, { rotulo: T('k_ttf'), conta: 'ttf', numero: r.ttf == null ? '-' : `${c.num(r.ttf)} <small>${T('dias')}</small>`, sub: T('mediana') }) +
      heroi(c, { rotulo: T('k_aceite'), conta: 'aceite', numero: r.aceite == null ? '-' : c.pct(r.aceite, 0), sub: `${r.fechadas} ${T('de')} ${r.ofertas}` }) + '</div>';
    let out = secao('rs-geral', T('s_rs_geral'), esc(c.periodoNome()), h);
    const etapas = r.funil.map(([k, v]) => ({ rotulo: T('funil_' + k), valor: v }));
    out += secao('funil', T('s_funil'), `${r.vagasAtivas} ${T(r.vagasAtivas === 1 ? 'vaga_1' : 'vagas_n')}`, cartao('', G.funil(etapas, { locale: c.I.locale(), conversao: T('conversao') })));
    const maxDias = Math.max(60, ...r.abertas.map(v => v.dias));
    // Ordem declarada: a que as contas entregam (mais dias aberta primeiro). Etapa e prioridade
    // ordenam pelo peso (oferta > entrevistas > triagem; alta > normal), não pelo nome.
    const colsV = [['id', 'c_vaga', 'texto', v => v.id], ['unidade', 'c_unidade', 'texto', v => c.I.nome(D.unidades[v.unidade])], ['dias', 'c_aberta_ha', 'num', v => v.dias],
      ['etapa', 'c_etapa', 'num', v => ({ triagem: 1, entrevistas: 2, oferta: 3 }[v.etapaNaData])], ['prioridade', 'c_prioridade', 'num', v => (v.prioridade === 'alta' ? 2 : 1)],
      ['insc', 'c_inscritos', 'num', v => v.inscritos]].map(([k, t, tipo, v]) => ({ k, t, tipo, v }));
    const abertas = G.ordenar(r.abertas, colsV, c.estado.vagas);
    let tb = `<div class="cartao tabela-cartao"><div class="tb-rolagem"><table class="tabela"><thead><tr>` +
      colsV.map(x => G.thOrdena(x, T(x.t), c.estado.vagas, 'data-ordem-vaga', x.k === 'insc' ? 'dir' : '')).join('') + '</tr></thead><tbody>';
    tb += abertas.length ? abertas.map(v => `<tr><td><b class="mono">${v.id}</b> ${esc(c.I.nome(D.niveis[v.nivel]))} · ${esc(c.I.nome(D.areas[v.area]))}</td>` +
      `<td>${esc(c.I.nome(D.unidades[v.unidade]))}</td>` +
      `<td><div class="dias"><span class="dias-barra${v.dias > 60 ? ' bad' : ''}" style="width:${(v.dias / maxDias * 100).toFixed(0)}%"></span><span class="mono">${v.dias} ${T('dias')}</span></div></td>` +
      `<td><span class="chip neutro">${esc(T('e_' + v.etapaNaData))}</span></td>` +
      `<td><span class="chip ${v.prioridade === 'alta' ? 'bad' : 'neutro'}">${esc(T('pr_' + v.prioridade))}</span></td>` +
      `<td class="dir mono">${v.inscritos}</td></tr>`).join('') : `<tr><td colspan="6" class="vazio">${esc(T('sem_linhas'))}</td></tr>`;
    tb += '</tbody></table></div></div>';
    out += secao('abertas', T('s_abertas'), esc(c.data(r.per.fim)), tb);
    const ttf = Object.entries(r.ttfNivel).sort((a, b) => D.niveis[a[0]].ordem - D.niveis[b[0]].ordem)
      .map(([k, v]) => ({ rotulo: c.I.nome(D.niveis[k]), valor: v.mediana, extra: v.n + ' ' + T(v.n === 1 ? 'vaga_1' : 'vagas_n') }));
    out += secao('ttf', T('s_ttf'), T('mediana') + ' · ' + T('dias'), cartao('', G.listaBarras(ttf, { semPct: true, fmtValor: v => c.num(v, Number.isInteger(v) ? 0 : 1) + ' ' + T('dias') })));
    return out;
  }

  return { geral, pessoas, rs };
})();
