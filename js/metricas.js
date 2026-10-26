/* =============================================================================
   metricas.js: TODA conta do painel mora aqui, longe do desenho da tela.

   Por que separado: a tela só mostra; quem calcula é uma função que recebe
   os filtros e devolve números. Assim o "como é contado" de cada número usa
   exatamente os mesmos valores do cartão (não existe conta paralela).
   ============================================================================= */
window.METRICAS = (function () {
  'use strict';
  const D = window.DADOS;
  const DIA = 864e5;
  const ativo = (p, d) => p.admissao <= d && (!p.desligamento || p.desligamento > d);
  const dentro = (d, ini, fim) => d && d >= ini && d <= fim;
  const media = l => l.length ? l.reduce((s, v) => s + v, 0) / l.length : null;
  function mediana(l) {
    if (!l.length) return null;
    const o = l.slice().sort((a, b) => a - b), m = Math.floor(o.length / 2);
    return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2;
  }
  const div = (a, b) => (b ? a / b : null);

  // Passo 1: o período vira uma lista de fins de mês (a série mensal).
  // pano = ano da data de corte até o mês dela; panoant = o ano anterior inteiro.
  function periodo(chave) {
    let meses = D.meses;
    const ano = D.dataRef.getFullYear();
    if (chave === 'p12') meses = D.meses.slice(-12);
    else if (chave === 'pano') meses = D.meses.filter(m => m.getFullYear() === ano);
    else if (chave === 'panoant') meses = D.meses.filter(m => m.getFullYear() === ano - 1);
    if (!meses.length) meses = D.meses;
    const ini = new Date(meses[0].getFullYear(), meses[0].getMonth(), 1);
    return { chave, meses, ini, fim: meses[meses.length - 1], n: meses.length };
  }

  // Passo 2: filtros (vazio = todos).
  function filtrarPessoas(f) {
    return D.pessoas.filter(p =>
      (!f.unidade || p.unidade === f.unidade) &&
      (!f.area || p.area === f.area) &&
      (!f.vinculo || p.vinculo === f.vinculo) &&
      (!f.genero || p.genero === f.genero) &&
      (!f.nivel || p.nivel === f.nivel));
  }
  function filtrarVagas(f) {
    return D.vagas.filter(v =>
      (!f.unidade || v.unidade === f.unidade) &&
      (!f.area || v.area === f.area) &&
      (!f.nivel || v.nivel === f.nivel));
  }

  // Quais motivos entram na taxa. Fim de contrato nunca entra: é saída
  // combinada desde o primeiro dia, não é perda.
  const TIPOS = { pedido: ['pedido'], demissao: ['demissao'], outro: ['outro'], todos: ['pedido', 'demissao', 'outro'] };
  const statusTurnover = anual => anual == null ? null : anual <= 0.15 ? 'saudavel' : anual <= 0.25 ? 'atencao' : 'alto';
  const statusNovatos = v => v == null ? null : v >= 0.85 ? 'boa' : v >= 0.75 ? 'atencao' : 'baixa';

  function contar(lista, chave) {
    const o = {};
    lista.forEach(p => { o[p[chave]] = (o[p[chave]] || 0) + 1; });
    return o;
  }
  const anosEntre = (a, b) => (b - a) / (365.25 * DIA);

  // Passo 3: a conta inteira, para um estado de filtros.
  function calcular(estado) {
    const f = estado.filtros, tipo = estado.tipoSaida || 'pedido';
    const per = periodo(f.periodo);
    const P = filtrarPessoas(f);
    const ativosFim = P.filter(p => ativo(p, per.fim));
    const vespera = new Date(per.ini.getTime() - DIA);
    const hcIni = P.filter(p => ativo(p, vespera)).length;

    // Série mensal de TODO o histórico (o gráfico mostra o período em destaque).
    const serie = D.meses.map(fim => {
      const ini = new Date(fim.getFullYear(), fim.getMonth(), 1);
      const antes = new Date(ini.getTime() - DIA);
      const saidas = P.filter(p => dentro(p.desligamento, ini, fim));
      const hcA = P.filter(p => ativo(p, antes)).length, hcF = P.filter(p => ativo(p, fim)).length;
      const saidasTipo = saidas.filter(p => TIPOS[tipo].includes(p.motivo)).length;
      return {
        fim, hc: hcF, entradas: P.filter(p => dentro(p.admissao, ini, fim)).length,
        saidas: saidas.length, saidasTipo, taxa: div(saidasTipo, (hcA + hcF) / 2),
        noPeriodo: fim >= per.ini && fim <= per.fim
      };
    });
    const doPeriodo = serie.filter(s => s.noPeriodo);
    const hcMedio = media(doPeriodo.map(s => s.hc));
    const entradas = P.filter(p => dentro(p.admissao, per.ini, per.fim));
    const saidas = P.filter(p => dentro(p.desligamento, per.ini, per.fim));
    const saidasTipo = saidas.filter(p => TIPOS[tipo].includes(p.motivo));
    const turnover = div(saidasTipo.length, hcMedio);
    const anual = turnover == null ? null : turnover * 12 / per.n;

    // Retenção de novatos: quem entrou entre 24 e 12 meses antes do fim já teve tempo de fazer 1 ano.
    const j1 = new Date(per.fim.getTime() - 730 * DIA), j2 = new Date(per.fim.getTime() - 365 * DIA);
    const novatos = P.filter(p => p.admissao > j1 && p.admissao <= j2);
    const ficaram = novatos.filter(p => !p.desligamento || (p.desligamento - p.admissao) >= 365 * DIA);
    const casaNaSaida = saidasTipo.map(p => anosEntre(p.admissao, p.desligamento));

    // Diversidade (ativos no fim do período).
    const lideres = ativosFim.filter(p => D.niveis[p.nivel].lider);
    const comRaca = ativosFim.filter(p => p.raca !== 'ni');
    const idades = ativosFim.map(p => anosEntre(p.nascimento, per.fim));
    const faixas = { '<25': 0, '25-34': 0, '35-44': 0, '45-54': 0, '55+': 0 };
    idades.forEach(i => { faixas[i < 25 ? '<25' : i < 35 ? '25-34' : i < 45 ? '35-44' : i < 55 ? '45-54' : '55+'] += 1; });
    const generoNivel = {};
    Object.keys(D.niveis).forEach(n => { generoNivel[n] = { F: 0, M: 0, N: 0 }; });
    ativosFim.forEach(p => { generoNivel[p.nivel][p.genero] += 1; });
    const bandas = { '<1': 0, '1-2': 0, '2-5': 0, '5+': 0 };
    casaNaSaida.forEach(a => { bandas[a < 1 ? '<1' : a < 2 ? '1-2' : a < 5 ? '2-5' : '5+'] += 1; });

    // Recrutamento.
    const V = filtrarVagas(f);
    const abertas = V.filter(v => v.abertura <= per.fim && (!v.fechamento || v.fechamento > per.fim))
      .map(v => {
        const dias = Math.round((per.fim - v.abertura) / DIA);
        return Object.assign({}, v, { dias, prioridade: dias > 60 || D.niveis[v.nivel].lider ? 'alta' : 'normal',
          etapaNaData: v.status === 'aberta' ? v.etapa : (dias > 25 ? 'entrevistas' : 'triagem') });
      }).sort((a, b) => b.dias - a.dias);
    const fechadas = V.filter(v => v.status === 'fechada' && dentro(v.fechamento, per.ini, per.fim));
    const ttfs = fechadas.map(v => Math.round((v.fechamento - v.abertura) / DIA));
    const ofertas = fechadas.reduce((s, v) => s + v.ofertas, 0);
    const doFunil = V.filter(v => v.abertura <= per.fim && (!v.fechamento || v.fechamento >= per.ini));
    const funil = ['inscritos', 'triagem', 'entrevistas', 'ofertas', 'contratados']
      .map(k => [k, doFunil.reduce((s, v) => s + (k === 'contratados' ? (v.status === 'fechada' && v.fechamento <= per.fim ? 1 : 0) : v[k]), 0)]);
    const ttfNivel = {};
    fechadas.forEach(v => { (ttfNivel[v.nivel] = ttfNivel[v.nivel] || []).push(Math.round((v.fechamento - v.abertura) / DIA)); });

    // Alertas: só o que pede ação, com o número que justifica.
    const alertas = [];
    if (!f.area) {
      Object.keys(D.areas).forEach(a => {
        const Pa = P.filter(p => p.area === a);
        const sa = Pa.filter(p => dentro(p.desligamento, per.ini, per.fim) && TIPOS.todos.includes(p.motivo)).length;
        const hm = media(per.meses.map(m => Pa.filter(p => ativo(p, m)).length));
        const an = hm ? sa / hm * 12 / per.n : 0;
        if (sa >= 3 && an > 0.25) alertas.push({ tipo: 'turnover', area: a, valor: an, ir: 'turnover' });
      });
    }
    // Saídas por área (para o resumo: quem mais perdeu gente).
    const saidasArea = contar(saidas.filter(p => TIPOS.todos.includes(p.motivo)), 'area');
    const velhas = abertas.filter(v => v.dias > 60).length;
    if (velhas) alertas.push({ tipo: 'vagas', n: velhas, ir: 'abertas' });
    const retNovatos = div(ficaram.length, novatos.length);
    if (retNovatos != null && novatos.length >= 8 && retNovatos < 0.8) alertas.push({ tipo: 'novatos', valor: retNovatos, ir: 'turnover' });
    const limite = new Date(per.fim.getTime() + 60 * DIA);
    const prazo = ativosFim.filter(p => p.fimPrevisto && p.fimPrevisto > per.fim && p.fimPrevisto <= limite).length;
    if (prazo) alertas.push({ tipo: 'prazo', n: prazo, ir: 'quadro' });

    // Último mês do período: o "desde" do resumo.
    const ultimo = doPeriodo[doPeriodo.length - 1];
    return {
      per, P, ativosFim, hcIni, hcFim: ativosFim.length, hcMedio, serie, entradas, saidas, saidasTipo, tipo,
      fimDeContrato: saidas.filter(p => p.motivo === 'fim').length,
      turnover, anual, stTurnover: statusTurnover(anual),
      casaMedia: media(ativosFim.map(p => anosEntre(p.admissao, per.fim))),
      novatos: novatos.length, ficaram: ficaram.length, retNovatos, stNovatos: statusNovatos(retNovatos),
      casaAntes: media(casaNaSaida), sairam1ano: casaNaSaida.filter(a => a < 1).length, bandas,
      porMotivo: contar(saidas, 'motivo'),
      mulheres: ativosFim.filter(p => p.genero === 'F').length, homens: ativosFim.filter(p => p.genero === 'M').length,
      lideres: lideres.length, lideresF: lideres.filter(p => p.genero === 'F').length,
      comRaca: comRaca.length, ppi: comRaca.filter(p => ['preta', 'parda', 'indigena'].includes(p.raca)).length,
      idadeMedia: media(idades), faixas, generoNivel, porRaca: contar(ativosFim, 'raca'),
      porArea: contar(ativosFim, 'area'), porUnidade: contar(ativosFim, 'unidade'),
      porNivel: contar(ativosFim, 'nivel'), porVinculo: contar(ativosFim, 'vinculo'),
      abertas, fechadas: fechadas.length, ttf: mediana(ttfs), ttfs, ofertas, aceite: div(fechadas.length, ofertas),
      funil, ttfNivel: Object.fromEntries(Object.entries(ttfNivel).map(([k, l]) => [k, { mediana: mediana(l), n: l.length }])),
      alertas, ultimo: { fim: ultimo.fim, saidas: ultimo.saidas, entradas: ultimo.entradas }, saidasArea, TIPOS,
      novatosLista: novatos, j1, j2,
      vagasAtivas: doFunil.length
    };
  }

  return { calcular, periodo, ativo };
})();
