/* =============================================================================
   graficos.js: gráficos desenhados à mão em SVG/HTML, sem biblioteca.

   Por que sem biblioteca: o painel que inspirou esta demo abre sem internet.
   Gráfico próprio também obedece ao tema (claro/escuro) pelas variáveis de CSS
   e mostra o número escrito, não só a forma (quem lê com pressa lê o número).
   Toda função devolve TEXTO (HTML/SVG); quem coloca na tela é o app.js.
   ============================================================================= */
window.GRAFICOS = (function () {
  'use strict';
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const mesCurto = (d, loc) => d.toLocaleDateString(loc, { month: 'short' }).replace('.', '') + ' ' + String(d.getFullYear()).slice(2);
  // Chave do mês para o clique que abre a tabela de nomes (ex.: "2026-03").
  const mesISO = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  // Porcentagem no formato do idioma da tela (4,2% em português, 4.2% em inglês). Sem o idioma
  // de quem chamou, vale o da página (o app.js marca <html lang> antes de desenhar).
  const pctTela = (v, dec, loc) => (v * 100).toLocaleString(loc || (document.documentElement.lang === 'en' ? 'en-US' : 'pt-BR'),
    { minimumFractionDigits: dec, maximumFractionDigits: dec }) + '%';

  // Curva suave que passa pelos pontos (Catmull-Rom convertida em Bézier).
  function curva(pts) {
    if (pts.length < 2) return '';
    let d = `M${pts[0][0]},${pts[0][1]}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
    }
    return d;
  }

  // 1) Linha do quadro: período em destaque, rótulo nos pontos que contam história.
  function linhaQuadro(serie, o) {
    const W = 920, H = 230, pe = 26, pd = 26, pt = 34, pb = 30;
    const vals = serie.map(s => s.hc);
    const min = Math.min(...vals), max = Math.max(...vals);
    const folga = Math.max(3, (max - min) * 0.25);
    const y = v => pt + (H - pt - pb) * (1 - (v - (min - folga)) / ((max + folga) - (min - folga)));
    const x = i => pe + (W - pe - pd) * (i / (serie.length - 1));
    const pts = serie.map((s, i) => [x(i), y(s.hc)]);
    const iIni = serie.findIndex(s => s.noPeriodo), iFim = serie.length - 1 - serie.slice().reverse().findIndex(s => s.noPeriodo);
    const destacar = new Set([iIni, iFim, vals.indexOf(min), vals.indexOf(max)]);
    let svg = `<svg class="g-linha" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.titulo)}">`;
    svg += `<defs><linearGradient id="gArea" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="var(--acc)" stop-opacity=".22"/><stop offset="1" stop-color="var(--acc)" stop-opacity="0"/></linearGradient></defs>`;
    svg += `<rect class="g-banda" x="${x(iIni) - 8}" y="${pt - 18}" width="${x(iFim) - x(iIni) + 16}" height="${H - pt - pb + 18}" rx="8"/>`;
    [0, 0.5, 1].forEach(t => { const yy = pt + (H - pt - pb) * t; svg += `<line class="g-grade" x1="${pe}" x2="${W - pd}" y1="${yy}" y2="${yy}"/>`; });
    svg += `<path d="${curva(pts)} L${x(serie.length - 1)},${H - pb} L${x(0)},${H - pb} Z" fill="url(#gArea)"/>`;
    svg += `<path class="g-traco" d="${curva(pts)}"/>`;
    serie.forEach((s, i) => {
      svg += `<circle class="g-ponto${s.noPeriodo ? '' : ' fora'}" cx="${pts[i][0]}" cy="${pts[i][1]}" r="${destacar.has(i) ? 4.5 : 3}"/>`;
      if (destacar.has(i)) {
        const acima = pts[i][1] > pt + 30;
        svg += `<text class="g-rot" x="${pts[i][0]}" y="${pts[i][1] + (acima ? -22 : 20)}" text-anchor="middle">${s.hc}</text>`;
        svg += `<text class="g-rot2" x="${pts[i][0]}" y="${pts[i][1] + (acima ? -9 : 33)}" text-anchor="middle"><tspan class="pos">+${s.entradas}</tspan> | <tspan class="neg">-${s.saidas}</tspan></text>`;
      }
      if (i % 2 === 0 || i === serie.length - 1) svg += `<text class="g-eixo" x="${pts[i][0]}" y="${H - 8}" text-anchor="middle">${esc(mesCurto(s.fim, o.locale))}</text>`;
      // Faixa invisível por mês: é ela que recebe o mouse e mostra o balão.
      const larg = (W - pe - pd) / (serie.length - 1);
      svg += `<rect class="g-alvo" x="${pts[i][0] - larg / 2}" y="${pt - 18}" width="${larg}" height="${H - pt - pb + 18}" data-tip="${esc(o.tip(s))}" data-drill="mes:${mesISO(s.fim)}"/>`;
    });
    return svg + '</svg>';
  }

  // 2) Barras do turnover mensal, cor pelo limite (o mesmo da faixa anual ÷ 12).
  function barrasMes(serie, o) {
    const W = 920, H = 210, pe = 26, pd = 10, pt = 26, pb = 30;
    const vals = serie.map(s => s.taxa || 0);
    const max = Math.max(0.03, ...vals) * 1.15;
    const larg = (W - pe - pd) / serie.length;
    let svg = `<svg class="g-barras" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.titulo)}">`;
    svg += `<line class="g-grade" x1="${pe}" x2="${W - pd}" y1="${H - pb}" y2="${H - pb}"/>`;
    const lim = [0.15 / 12, 0.25 / 12];
    lim.forEach((l, k) => { const yy = pt + (H - pt - pb) * (1 - l / max); svg += `<line class="g-lim l${k}" x1="${pe}" x2="${W - pd}" y1="${yy}" y2="${yy}"/>`; });
    serie.forEach((s, i) => {
      const v = s.taxa || 0, h = (H - pt - pb) * (v / max), xx = pe + i * larg + larg * 0.18;
      const cls = v <= lim[0] ? 'ok' : v <= lim[1] ? 'warn' : 'bad';
      svg += `<rect class="g-barra ${cls}${s.noPeriodo ? '' : ' fora'}" x="${xx}" y="${H - pb - h}" width="${larg * 0.64}" height="${Math.max(h, 1)}" rx="3"/>`;
      if (s.noPeriodo && v > 0) svg += `<text class="g-rot2" x="${xx + larg * 0.32}" y="${H - pb - h - 6}" text-anchor="middle">${pctTela(v, 1, o.locale)}</text>`;
      if (i % 2 === 0 || i === serie.length - 1) svg += `<text class="g-eixo" x="${xx + larg * 0.32}" y="${H - 8}" text-anchor="middle">${esc(mesCurto(s.fim, o.locale))}</text>`;
      svg += `<rect class="g-alvo" x="${pe + i * larg}" y="${pt}" width="${larg}" height="${H - pt - pb}" data-tip="${esc(o.tip(s))}" data-drill="saidas:${mesISO(s.fim)}"/>`;
    });
    return svg + '</svg>';
  }

  // 3) A barra ATRÁS do rótulo: o formato aprovado para "por X" (linha limpa,
  //    a barra é o fundo do texto, valor e % em colunas fixas).
  function listaBarras(itens, o) {
    o = o || {};
    const max = Math.max(1, ...itens.map(i => i.valor));
    const total = o.total || itens.reduce((s, i) => s + i.valor, 0);
    return `<div class="lb${o.semPct ? ' larga' : ''}">` + itens.map(i => {
      const pct = total ? i.valor / total : 0;
      return `<div class="lb-linha${i.classe ? ' ' + i.classe : ''}${i.drill ? ' clicavel' : ''}"${i.tip ? ` data-tip="${esc(i.tip)}"` : ''}${i.drill ? ` data-drill="${esc(i.drill)}" role="button" tabindex="0"` : ''}>` +
        `<div class="lb-rot"><span class="lb-fundo" style="width:${(i.valor / max * 100).toFixed(1)}%"></span><span class="lb-txt">${esc(i.rotulo)}</span></div>` +
        `<div class="lb-val">${esc(o.fmtValor ? o.fmtValor(i.valor) : i.valor)}</div>` +
        `<div class="lb-pct">${o.semPct ? (i.extra ? esc(i.extra) : '') : pctTela(pct, 1)}</div></div>`;
    }).join('') + '</div>';
  }

  // 4) Segmentos empilhados (ex.: gênero por nível). Cada linha soma 100%.
  function segmentos(linhas, legenda) {
    return '<div class="seg">' + linhas.map(l => {
      const tot = l.partes.reduce((s, p) => s + p.valor, 0) || 1;
      return `<div class="seg-linha"><div class="seg-rot">${esc(l.rotulo)}</div><div class="seg-barra">` +
        l.partes.map(p => p.valor ? `<span class="seg-p ${p.classe}${p.drill ? ' clicavel' : ''}" style="width:${(p.valor / tot * 100).toFixed(1)}%" data-tip="${esc(p.nome + ': ' + p.valor + ' (' + (p.valor / tot * 100).toFixed(0) + '%)')}"${p.drill ? ` data-drill="${esc(p.drill)}"` : ''}>${p.valor / tot >= 0.12 ? (p.valor / tot * 100).toFixed(0) + '%' : ''}</span>` : '').join('') +
        `</div><div class="seg-tot">${tot}</div></div>`;
    }).join('') + `<div class="seg-leg">${legenda.map(x => `<span><i class="seg-p ${x.classe}"></i>${esc(x.nome)}</span>`).join('')}</div></div>`;
  }

  // 5) Entradas para cima, saídas para baixo, mês a mês (a mesma régua nos dois lados).
  function barrasMov(serie, o) {
    const W = 920, H = 230, pe = 26, pd = 10, meio = H / 2 - 4, alto = meio - 26;
    const max = Math.max(1, ...serie.map(s => Math.max(s.entradas, s.saidas)));
    const larg = (W - pe - pd) / serie.length;
    let svg = `<svg class="g-barras" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.titulo)}">`;
    svg += `<line class="g-grade" x1="${pe}" x2="${W - pd}" y1="${meio}" y2="${meio}"/>`;
    serie.forEach((s, i) => {
      const xx = pe + i * larg + larg * 0.2, w = larg * 0.6;
      const he = alto * s.entradas / max, hs = alto * s.saidas / max;
      const fora = s.noPeriodo ? '' : ' fora';
      svg += `<rect class="g-barra ok${fora}" x="${xx}" y="${meio - he}" width="${w}" height="${Math.max(he, 1)}" rx="3"/>`;
      svg += `<rect class="g-barra bad${fora}" x="${xx}" y="${meio + 1}" width="${w}" height="${Math.max(hs, 1)}" rx="3"/>`;
      if (s.noPeriodo) {
        if (s.entradas) svg += `<text class="g-rot2" x="${xx + w / 2}" y="${meio - he - 5}" text-anchor="middle">${s.entradas}</text>`;
        if (s.saidas) svg += `<text class="g-rot2" x="${xx + w / 2}" y="${meio + hs + 13}" text-anchor="middle">${s.saidas}</text>`;
      }
      if (i % 2 === 0 || i === serie.length - 1) svg += `<text class="g-eixo" x="${xx + w / 2}" y="${H - 4}" text-anchor="middle">${esc(mesCurto(s.fim, o.locale))}</text>`;
      svg += `<rect class="g-alvo" x="${pe + i * larg}" y="0" width="${larg}" height="${H - 16}" data-tip="${esc(o.tip(s))}" data-drill="mes:${mesISO(s.fim)}"/>`;
    });
    return svg + '</svg>';
  }

  // 6) Funil horizontal: cada etapa centralizada, com a conversão da anterior.
  function funil(etapas, o) {
    const max = Math.max(1, ...etapas.map(e => e.valor));
    return '<div class="funil">' + etapas.map((e, i) => {
      const conv = i ? (etapas[i - 1].valor ? e.valor / etapas[i - 1].valor : 0) : null;
      return `<div class="fu-linha"><div class="fu-rot">${esc(e.rotulo)}</div>` +
        `<div class="fu-trilho"><div class="fu-barra" style="width:${Math.max(2.5, e.valor / max * 100).toFixed(1)}%"><span>${e.valor.toLocaleString(o.locale)}</span></div></div>` +
        `<div class="fu-conv">${conv == null ? '' : pctTela(conv, conv < 0.1 ? 1 : 0, o.locale) + ' ' + esc(o.conversao)}</div></div>`;
    }).join('') + '</div>';
  }

  // 7) Ordenação de TODA tabela do app (um lugar só, para todas ordenarem igual).
  // Cada coluna diz o tipo: 'texto' (A→Z no 1º clique), 'num' ou 'data' (maior/mais novo
  // primeiro no 1º clique). O estado de uma tabela é { col, passo }: passo 1 = 1º clique,
  // passo 2 = invertido, col vazia = a ordem declarada (a que a tabela já vem).
  const vazioOrd = v => v == null || v === '' || (typeof v === 'number' && isNaN(v));
  // Por quê: "R2" antes de "R10" e "Área" junto de "area" (sem caixa nem acento).
  const cmpTexto = (a, b) => String(a).localeCompare(String(b), 'pt', { sensitivity: 'base', numeric: true });
  // Devolve uma CÓPIA ordenada; vazio vai para o fim nas duas direções e o empate
  // mantém a ordem declarada (por isso o índice original entra no desempate).
  function ordenar(lista, cols, ordem) {
    const c = ordem && ordem.col && cols.find(x => x.k === ordem.col);
    if (!c) return lista.slice();
    const sentido = (c.tipo === 'texto' ? 1 : -1) * (ordem.passo === 2 ? -1 : 1);
    const valor = x => { const v = c.v(x); return c.tipo === 'texto' || vazioOrd(v) ? v : +v; };   // data vira número (o instante)
    return lista.map((x, i) => ({ x, i, v: valor(x) }))
      .sort((p, q) => {
        const vp = vazioOrd(p.v), vq = vazioOrd(q.v);
        if (vp || vq) return vp && vq ? p.i - q.i : vp ? 1 : -1;
        return (c.tipo === 'texto' ? cmpTexto(p.v, q.v) : p.v - q.v) * sentido || p.i - q.i;
      }).map(o => o.x);
  }
  // O clique no cabeçalho: 1º clique, inverte, volta à ordem declarada.
  function proximaOrdem(ordem, k) {
    if (!ordem || ordem.col !== k) return { col: k, passo: 1 };
    return ordem.passo === 1 ? { col: k, passo: 2 } : { col: '', passo: 0 };
  }
  // O <th> com o <button> (teclado de graça), a seta (pelo CSS) e o aria-sort na coluna ativa.
  // attr = o atributo que o ouvinte de clique de cada tabela procura (ex.: data-ordem).
  function thOrdena(c, rotulo, ordem, attr, classe) {
    const ativo = !!(ordem && ordem.col === c.k);
    const sobe = ativo && ((c.tipo === 'texto') === (ordem.passo === 1));
    return `<th${classe ? ` class="${classe}"` : ''}${ativo ? ` aria-sort="${sobe ? 'ascending' : 'descending'}"` : ''}>` +
      `<button type="button" ${attr}="${c.k}" class="${ativo ? 'ativo ' + (sobe ? 'asc' : 'desc') : ''}">${esc(rotulo)}</button></th>`;
  }

  return { linhaQuadro, barrasMes, barrasMov, listaBarras, segmentos, funil, esc, mesCurto, mesISO, ordenar, proximaOrdem, thOrdena };
})();
