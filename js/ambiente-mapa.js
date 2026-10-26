/* =============================================================================
   ambiente-mapa.js: o mapa da aba "Meu ambiente", os bonecos e o avatar da pessoa.

   Como funciona, em 5 peças:
   1. VISTA: a câmera olha a planta de um dos 4 cantos (girar = 0, 90, 180 ou 270 graus)
      em "3D" (isométrico) ou em "Planta" (de cima). Girar é só trocar a conta que leva
      um ponto do chão (x, y, altura) para a tela: o desenho é refeito com a conta nova.
   2. DESENHO FIXO (SVG): chão, paredes, móveis e prateleiras, desenhados uma vez por vista.
      Para quem está "atrás" ficar atrás, tudo é guardado em FAIXAS DE PROFUNDIDADE
      (a soma das coordenadas NA VISTA): a faixa de trás é pintada primeiro.
   3. CAMINHOS: os corredores de cada planta viram um GRAFO; o boneco segue o caminho
      mais curto. É por isso que ele nunca atravessa parede (só há corredor onde há porta).
   4. BONECOS: cada pessoa com ponto aberto vira um boneco com um lugar "de casa" dado
      pelas REGRAS da planta. Camisa na cor da ÁREA; pele, cabelo e capacete sorteados
      com semente fixa a partir da própria pessoa. A posição é ilustrativa.
   5. AVATAR e MINIMAPA: o "retrato" ilustrado da pessoa (SVG, sem foto de ninguém)
      e a planta pequena de cima, com o retângulo do que a câmera está mostrando.
   ============================================================================= */
window.AMBIENTE_MAPA = (function () {
  'use strict';
  if (!window.AMBIENTE_DADOS) return null;   // sem dados fictícios, sem mapa (ver ambiente-dados.js)
  const A = window.AMBIENTE_DADOS;

  // ---------------------------------------------------------------- 1. VISTA
  // As três plantas têm o mesmo tamanho (A.W x A.H): o quadro do desenho (VB) é um só.
  const TW = 24, TH = 12, Z = 15;             // largura e altura do losango de 1 célula; altura de 1 unidade de z
  const ANDAR = 21;                           // altura de um andar (em unidades de z): o 2º fica acima, sem cobrir o 1º
  const M = { e: 18, d: 18, t: 26 + ANDAR * Z, b: 22 };   // margens do desenho (em cima cabe o 2º andar)
  const OY = M.t;
  const VB = { w: Math.round((A.W + A.H) * TW / 2 + M.e + M.d), h: Math.round((A.W + A.H) * TH / 2 + M.t + M.b) };
  // A vista atual: rot = quantos quartos de volta; modo = '3d' ou 'planta'; baixas = paredes rebaixadas.
  const V = { rot: 0, modo: '3d', baixas: false };
  function setVista(v) { Object.assign(V, v); }
  // Girar a planta: o ponto (x, y) do mundo vira (a, b) na vista. Ida e volta.
  function vistaRot(x, y, r) {
    if (r === 1) return [A.H - y, x];
    if (r === 2) return [A.W - x, A.H - y];
    if (r === 3) return [y, A.W - x];
    return [x, y];
  }
  const vista = (x, y) => vistaRot(x, y, V.rot);
  function mundo(a, b) {
    if (V.rot === 1) return [b, A.H - a];
    if (V.rot === 2) return [A.W - a, A.H - b];
    if (V.rot === 3) return [A.W - b, a];
    return [a, b];
  }
  const dims = () => (V.rot % 2 ? [A.H, A.W] : [A.W, A.H]);   // largura e fundo da planta NA vista
  const escalaPlanta = () => { const [w, h] = dims(); return Math.min((VB.w - 40) / w, (VB.h - 40) / h); };
  // Da vista para a tela. 3D: o "losango" isométrico; Planta: um retângulo visto de cima.
  function projV(a, b, z) {
    const [w, h] = dims();
    if (V.modo === 'planta') { const s = escalaPlanta(); return [(VB.w - w * s) / 2 + a * s, (VB.h - h * s) / 2 + b * s]; }
    return [h * TW / 2 + M.e + (a - b) * TW / 2, OY + (a + b) * TH / 2 - (z || 0) * Z];
  }
  const proj = (x, y, z) => { const [a, b] = vista(x, y); return projV(a, b, z); };
  // O caminho de volta (tela -> chão), usado pelo minimapa: onde a câmera está olhando.
  function desproj(sx, sy, z) {
    const [w, h] = dims();
    let a, b;
    if (V.modo === 'planta') { const s = escalaPlanta(); a = (sx - (VB.w - w * s) / 2) / s; b = (sy - (VB.h - h * s) / 2) / s; }
    else { const d = (sx - (h * TW / 2 + M.e)) / (TW / 2), soma = (sy - OY + (z || 0) * Z) / (TH / 2); a = (soma + d) / 2; b = (soma - d) / 2; }
    return mundo(a, b);
  }
  // O melhor ângulo para olhar um ponto: o giro que o deixa mais perto da frente do desenho.
  function melhorRot(x, y) {
    let melhor = 0, nota = -1;
    for (let r = 0; r < 4; r++) {
      const [a, b] = vistaRot(x, y, r), [w, h] = r % 2 ? [A.H, A.W] : [A.W, A.H];
      const n = (a + b) / (w + h);
      if (n > nota + 1e-9) { nota = n; melhor = r; }
    }
    return melhor;
  }
  const pt = (a, b, z) => projV(a, b, z).map(v => v.toFixed(1)).join(',');
  const poliV = pts => 'M' + pts.map(p => pt(p[0], p[1], p[2])).join('L') + 'Z';
  const poliM = pts => 'M' + pts.map(p => proj(p[0], p[1], p[2]).map(v => v.toFixed(1)).join(',')).join('L') + 'Z';
  // Uma caixa na vista (a0..a1, b0..b1), da altura z0 até z0 + h. Em 3D: 3 faces visíveis
  // (topo, lado +b e lado +a); na planta, só o topo.
  function caixaSvg(a0, b0, a1, b1, h, classe, attrs, z0) {
    const z1 = (z0 || 0) + h, zb = z0 || 0;
    const topo = `<path class="amb-t" d="${poliV([[a0, b0, z1], [a1, b0, z1], [a1, b1, z1], [a0, b1, z1]])}"/>`;
    if (V.modo === 'planta') return `<g class="amb-cx ${classe}"${attrs || ''}>${topo}</g>`;
    return `<g class="amb-cx ${classe}"${attrs || ''}>` +
      `<path class="amb-e" d="${poliV([[a0, b1, zb], [a1, b1, zb], [a1, b1, z1], [a0, b1, z1]])}"/>` +
      `<path class="amb-d" d="${poliV([[a1, b0, zb], [a1, b1, zb], [a1, b1, z1], [a1, b0, z1]])}"/>` + topo + '</g>';
  }
  // Faixa de profundidade de um ponto da vista: 4 faixas por célula (maior = mais na frente).
  const FAIXAS = (A.W + A.H + 3) * 4;
  const faixaV = (a, b) => Math.max(0, Math.min(FAIXAS - 1, Math.floor((a + b) * 4)));
  const faixaDe = (x, y) => { const [a, b] = vista(x, y); return faixaV(a, b); };
  // Um retângulo do mundo na vista (girar troca os cantos de lugar; min e max arrumam).
  function retV(x0, y0, x1, y1) {
    const [a0, b0] = vista(x0, y0), [a1, b1] = vista(x1, y1);
    return [Math.min(a0, a1), Math.min(b0, b1), Math.max(a0, a1), Math.max(b0, b1)];
  }

  // ---------------------------------------------------------------- 2. DESENHO FIXO
  // Objetos compridos (parede, esteira, estante) são cortados em pedaços de 1 célula:
  // cada pedaço entra na sua faixa, e o boneco que passa atrás de um pedaço fica atrás dele.
  function pedacos(x0, y0, x1, y1) {
    const out = [];
    const nx = Math.max(1, Math.ceil(x1 - x0 - 1e-6)), ny = Math.max(1, Math.ceil(y1 - y0 - 1e-6));
    for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
      out.push([x0 + (x1 - x0) * i / nx, y0 + (y1 - y0) * j / ny, x0 + (x1 - x0) * (i + 1) / nx, y0 + (y1 - y0) * (j + 1) / ny]);
    }
    return out;
  }
  // Altura da parede NA VISTA: a borda do fundo fica alta, a da frente vira rodapé (para ver
  // dentro, de qualquer ângulo); com "paredes baixas", todas descem.
  // lim = o contorno da planta na vista [a mínimo, b mínimo, a máximo, b máximo]: a borda de trás é a
  // de menor a (ou b). Cerca (parede baixa) continua baixa mesmo atrás.
  function alturaParede(a0, b0, a1, b1, h, lim) {
    const eps = 1e-6, vert = Math.abs(a0 - a1) < eps, hor = Math.abs(b0 - b1) < eps;
    const atras = (vert && Math.abs(a0 - lim[0]) < eps) || (hor && Math.abs(b0 - lim[1]) < eps);
    const frente = (vert && Math.abs(a0 - lim[2]) < eps) || (hor && Math.abs(b0 - lim[3]) < eps);
    if (atras && h >= 0.5) h = 0.9; else if (frente) h = Math.min(h, 0.12);
    return V.baixas ? Math.min(h, 0.15) : h;
  }
  // Até onde a planta vai (o minimapa mostra só ela, sem a sobra do quadro comum às 3 unidades).
  function limites(P) { let w = 0, h = 0; P.zonas.forEach(z => { w = Math.max(w, z.x1); h = Math.max(h, z.y1); }); return [w, h]; }
  const GRADE = { escritorio: 1, salas: 1, admin: 1, reuniao: 1, escr: 1 };
  // Um andar desenhado na altura zb (0 = térreo). Cada andar tem as SUAS faixas de profundidade:
  // o 2º andar inteiro é pintado depois do 1º (ele está em cima).
  function desenharAndar(P, txt, zb, andar) {
    const faixas = Array.from({ length: FAIXAS }, () => []);
    const poe = (chave, svg) => faixas[Math.max(0, Math.min(FAIXAS - 1, Math.floor(chave * 4)))].push(svg);
    // Paredes: uma tira fina (0,12 de espessura) em cima da linha.
    const lim = [Infinity, Infinity, -Infinity, -Infinity];   // contorno da planta, na vista
    P.zonas.forEach(z => [[z.x0, z.y0], [z.x1, z.y1]].forEach(([x, y]) => { const [a, b] = vista(x, y);
      lim[0] = Math.min(lim[0], a); lim[1] = Math.min(lim[1], b); lim[2] = Math.max(lim[2], a); lim[3] = Math.max(lim[3], b); }));
    P.paredes.forEach(([x0, y0, x1, y1, h]) => {
      const [a0, b0] = vista(x0, y0), [a1, b1] = vista(x1, y1);
      const hv = alturaParede(a0, b0, a1, b1, h, lim), e = 0.06, hor = Math.abs(b0 - b1) < 1e-6;
      const r = hor ? [Math.min(a0, a1), b0 - e, Math.max(a0, a1), b0 + e] : [a0 - e, Math.min(b0, b1), a0 + e, Math.max(b0, b1)];
      pedacos(r[0], r[1], r[2], r[3]).forEach(c => poe((c[0] + c[2] + c[1] + c[3]) / 2, caixaSvg(c[0], c[1], c[2], c[3], hv, hv < 0.3 ? 'amb-rodape' : 'amb-parede', '', zb)));
    });
    // Móveis. Prateleira e estante levam data-cod (é por ele que a tabela acha a prateleira).
    // Peça EM CIMA de outra (monitor na mesa, carga na estante) entra logo depois dela.
    P.moveis.forEach(m => {
      // Caminhão do pátio: clicável (abre os recebimentos do dia na tela).
      const patio = (m.tipo === 'carreta' || m.tipo === 'cabine') && txt.patio && P.id === 'fab' ? ` data-amb-patio="" role="button" tabindex="0" aria-label="${txt.patio}"`
        : m.tipo === 'escada' && txt.escada ? ` data-amb-escada="" role="button" tabindex="0" aria-label="${txt.escada}"` : '';   // escada: clicar troca de andar
      const cod = m.cod ? ` data-cod="${m.cod}" role="button" tabindex="0" aria-label="${txt.prat(m.cod)}"` : m.dono ? ` data-cod="${m.dono}"` : patio;
      const classe = m.cod ? 'amb-prat amb-' + m.tipo : 'amb-' + m.tipo + (m.deco ? ' amb-deco' : '');   // deco = detalhe sem função (não clica)
      const r = retV(m.x0, m.y0, m.x1, m.y1);
      pedacos(r[0], r[1], r[2], r[3]).forEach(c => poe((c[0] + c[2] + c[1] + c[3]) / 2 + (m.z0 ? 0.05 : 0), caixaSvg(c[0], c[1], c[2], c[3], m.h, classe, cod, (m.z0 || 0) + zb)));
    });
    let s = `<g class="amb-andar" data-andar="${andar}">`;
    // Chão: um polígono por zona (a zona listada depois fica por cima).
    // Piso de escritório ganha uma grade fina (placas de 2 x 2): desenhada logo depois do polígono
    // da zona, a zona que vem por cima (banheiro, copa) a cobre.
    const linha = (x0, y0, x1, y1) => `<path class="amb-grade" d="M${proj(x0, y0, zb).map(v => v.toFixed(1)).join(',')}L${proj(x1, y1, zb).map(v => v.toFixed(1)).join(',')}"/>`;
    const grade = z => {
      if (!GRADE[z.id]) return '';
      let g = '';
      for (let x = Math.floor(z.x0 / 2) * 2 + 2; x < z.x1 - 0.01; x += 2) g += linha(x, z.y0, x, z.y1);
      for (let y = Math.floor(z.y0 / 2) * 2 + 2; y < z.y1 - 0.01; y += 2) g += linha(z.x0, y, z.x1, y);
      return g;
    };
    s += '<g class="amb-pisos">' + P.zonas.map(z => `<path class="amb-piso amb-piso-${z.id}"${z.id === 'patio' && txt.patio && P.id === 'fab' ? ` data-amb-patio=""` : ''} d="${poliM([[z.x0, z.y0, zb], [z.x1, z.y0, zb], [z.x1, z.y1, zb], [z.x0, z.y1, zb]])}"/>` + grade(z)).join('');
    P.marcas.forEach(v => { s += `<path class="amb-faixa-chao" d="M${proj(v[0], v[1], zb).join(',')}L${proj(v[2], v[3], zb).join(',')}"/>`; });
    s += '</g><g class="amb-cena">' + faixas.map((f, i) => `<g class="amb-f" data-f="${i}">${f.join('')}</g>`).join('') + '</g>';
    // Rótulos por cima de tudo. O rótulo que flutua acima da parede do fundo só flutua na vista
    // de frente (nas outras, aquela parede não está mais no fundo).
    const flutua = V.rot === 0 && V.modo === '3d' && !V.baixas;
    s += '<g class="amb-rotulos" aria-hidden="true">' + P.rotulos.map(r => {
      const [x, y] = proj(r.x, r.y, zb + (flutua ? r.z || 0 : 0));
      return `<text class="amb-rotulo" x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle">${txt.zona(r.chave)}</text>`;
    }).join('');
    // Marca de cada prateleira: anel (pulsa quando a linha da tabela é clicada), ponto de situação e número.
    P.moveis.filter(m => m.cod).forEach(m => {
      const cx = (m.x0 + m.x1) / 2, cy = (m.y0 + m.y1) / 2;
      const [x, y] = proj(cx, cy, m.h + zb), [, yb] = proj(cx, cy, zb);
      const larg = V.modo === 'planta' ? ((m.x1 - m.x0) + (m.y1 - m.y0)) * escalaPlanta() / 2 + 5 : ((m.x1 - m.x0) + (m.y1 - m.y0)) * TW / 4 + 7;
      s += `<g class="amb-marca" data-marca="${m.cod}"><ellipse class="amb-anel" cx="${x.toFixed(1)}" cy="${yb.toFixed(1)}" rx="${larg.toFixed(1)}" ry="${(V.modo === 'planta' ? larg : larg / 2).toFixed(1)}"/>` +
        `<circle class="amb-st" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.3"/>` +
        `<text class="amb-cod" x="${x.toFixed(1)}" y="${(y - 4.5).toFixed(1)}" text-anchor="middle">${m.cod}</text></g>`;
    });
    return s + '</g></g>';
  }
  // P = a planta da unidade (A.plantas.mat, .fab ou .cd); txt = os textos no idioma da tela.
  // A Matriz tem 2º andar (P.andar2): ele vai junto, desenhado uma altura de andar acima.
  function svgEstatico(P, txt) {
    return `<svg class="amb-svg amb-modo-${V.modo}" viewBox="0 0 ${VB.w} ${VB.h}" role="img" aria-label="${txt.aria}" data-planta="${P.id}" data-rot="${V.rot}" data-modo="${V.modo}">` +
      desenharAndar(P, txt, 0, 1) + (P.andar2 ? desenharAndar(P.andar2, txt, ANDAR, 2) : '') + '</svg>';
  }
  // Minimapa: a planta de cima, sem giro, em coordenadas do próprio chão (1 unidade = 1 célula).
  // O polígono "amb-mini-vista" é o que a câmera está mostrando agora (a tela atualiza os pontos).
  function miniSvg(P) {
    const [lw, lh] = limites(P);
    let s = `<svg class="amb-mini" viewBox="-0.5 -0.5 ${lw + 1} ${lh + 1}" aria-hidden="true">`;
    s += P.zonas.map(z => `<rect class="amb-piso amb-piso-${z.id}" x="${z.x0}" y="${z.y0}" width="${z.x1 - z.x0}" height="${z.y1 - z.y0}"/>`).join('');
    const FORA_MINI = { cadeira: 1, monitor: 1, carga: 1, 'pe-mesa': 1 };
    s += P.moveis.filter(m => !FORA_MINI[m.tipo]).map(m => `<rect class="amb-mini-movel${m.cod ? ' amb-mini-prat' : ''}" x="${m.x0}" y="${m.y0}" width="${(m.x1 - m.x0).toFixed(2)}" height="${(m.y1 - m.y0).toFixed(2)}"/>`).join('');
    s += P.paredes.filter(p => p[4] >= 0.3).map(p => `<line class="amb-mini-parede" x1="${p[0]}" y1="${p[1]}" x2="${p[2]}" y2="${p[3]}"/>`).join('');
    return s + '<polygon class="amb-mini-vista" points=""/></svg>';
  }

  // ---------------------------------------------------------------- 3. CAMINHOS
  // Um grafo por planta, montado na 1ª vez que alguém anda nela. Passo a passo:
  // (a) cada corredor junta os pontos que caem nele (pontas, cruzamentos e os "acessos" dos
  // lugares); (b) ordena esses pontos ao longo do corredor; (c) liga cada ponto ao vizinho.
  const chave = (x, y) => x.toFixed(2) + ',' + y.toFixed(2);
  const naVia = (v, x, y) => v[0] === v[2]
    ? Math.abs(x - v[0]) < 1e-6 && y >= Math.min(v[1], v[3]) - 1e-6 && y <= Math.max(v[1], v[3]) + 1e-6
    : Math.abs(y - v[1]) < 1e-6 && x >= Math.min(v[0], v[2]) - 1e-6 && x <= Math.max(v[0], v[2]) + 1e-6;
  const grafos = new Map();
  function grafo(P) {
    if (grafos.has(P)) return grafos.get(P);
    const G = { nos: [], idx: {}, memo: new Map() };
    const no = (x, y) => {
      const k = chave(x, y);
      if (G.idx[k] == null) { G.idx[k] = G.nos.length; G.nos.push({ x, y, viz: [] }); }
      return G.idx[k];
    };
    const pontos = P.vias.map(v => [[v[0], v[1]], [v[2], v[3]]]);
    P.vias.forEach((a, i) => P.vias.forEach((b, j) => {
      if (j <= i) return;
      const ha = a[1] === a[3], hb = b[1] === b[3];
      if (ha === hb) return;
      const h = ha ? a : b, v = ha ? b : a;
      if (naVia(h, v[0], h[1]) && naVia(v, v[0], h[1])) { pontos[i].push([v[0], h[1]]); pontos[j].push([v[0], h[1]]); }
    }));
    const acessos = [P.entrada.acesso];
    Object.values(P.lugares).forEach(l => l.forEach(x => acessos.push(x.acesso)));
    acessos.forEach(a => P.vias.forEach((v, i) => { if (naVia(v, a.x, a.y)) pontos[i].push([a.x, a.y]); }));
    pontos.forEach((lista, i) => {
      const v = P.vias[i], hor = v[1] === v[3];
      lista.sort((p, q) => hor ? p[0] - q[0] : p[1] - q[1]);
      for (let k = 1; k < lista.length; k++) {
        const a = no(lista[k - 1][0], lista[k - 1][1]), b = no(lista[k][0], lista[k][1]);
        if (a === b) continue;
        const d = Math.hypot(G.nos[a].x - G.nos[b].x, G.nos[a].y - G.nos[b].y);
        G.nos[a].viz.push([b, d]); G.nos[b].viz.push([a, d]);
      }
    });
    grafos.set(P, G);
    return G;
  }
  // Caminho mais curto (Dijkstra simples: com ~250 pontos, procurar o menor na lista basta).
  function menorCaminho(G, a, b) {
    const k = a + '>' + b;
    if (G.memo.has(k)) return G.memo.get(k);
    const nos = G.nos, dist = nos.map(() => Infinity), antes = nos.map(() => -1), feito = nos.map(() => false);
    dist[a] = 0;
    for (;;) {
      let u = -1;
      for (let i = 0; i < nos.length; i++) if (!feito[i] && dist[i] < Infinity && (u < 0 || dist[i] < dist[u])) u = i;
      if (u < 0 || u === b) break;
      feito[u] = true;
      nos[u].viz.forEach(([v, d]) => { if (dist[u] + d < dist[v]) { dist[v] = dist[u] + d; antes[v] = u; } });
    }
    const lista = [];
    for (let u = b; u >= 0; u = antes[u]) lista.unshift({ x: nos[u].x, y: nos[u].y });
    G.memo.set(k, lista);
    return lista;
  }
  // Rota de um lugar a outro na planta P: sai pela "via" do lugar, segue o grafo, entra pela via do destino.
  function rota(P, de, para) {
    const G = grafo(P);
    const ini = G.idx[chave(de.acesso.x, de.acesso.y)], fim = G.idx[chave(para.acesso.x, para.acesso.y)];
    if (ini == null || fim == null) { console.error('lugar sem corredor', P.id, de, para); return [{ x: para.x, y: para.y }]; }
    return de.via.slice().concat(menorCaminho(G, ini, fim), para.via.slice().reverse(), [{ x: para.x + (para.ox || 0), y: para.y + (para.oy || 0) }]);
  }

  // ---------------------------------------------------------------- 4. BONECOS
  // 4a. Quem fica onde, decidido UMA vez por unidade e por dia, pelas REGRAS da planta.
  // As regras vêm em ordem; cada uma pega quem ainda não tem lugar e serve para ela:
  //  - "sala": liderança, diretoria antes da gerência; acabou a sala, a pessoa segue para as próximas regras;
  //  - "mesa": mesas numa ordem sorteada; acabou a mesa, segue (normalmente para "em pé");
  //  - as outras (linha, manutenção, galpão, em pé) não acabam: quem sobra divide o lugar,
  //    com um pequeno deslocamento para dois bonecos não virarem um só.
  function distribuir(unidade) {
    const P = A.plantas[unidade], pisos = P.andar2 ? [[P.andar2, 2], [P, 1]] : [[P, 1]];
    const doDia = A.marcacoes.filter(m => m.unidade === unidade && !m.ausente)
      .sort((a, b) => a.entrada - b.entrada || (a.id < b.id ? -1 : 1));
    const pessoa = m => A.pessoaPorId[m.id];
    const casa = {};
    const desloca = (l, n) => Object.assign({}, l, n ? { ox: 0.32 * Math.cos(n * 2.4), oy: 0.32 * Math.sin(n * 2.4) } : {});
    pisos.forEach(([Q, andar]) => Q.regras.forEach(regra => {
      const lista = Q.lugares[regra.grupo];
      if (!lista.length) return;
      let quem = doDia.filter(m => !casa[m.id] && regra.quem(pessoa(m)));
      if (regra.grupo === 'sala') {
        quem = quem.sort((a, b) => (pessoa(a).nivel === 'dir' ? 0 : 1) - (pessoa(b).nivel === 'dir' ? 0 : 1) || a.entrada - b.entrada);
        quem.slice(0, lista.length).forEach((m, k) => { casa[m.id] = { tipo: 'sala', lugar: lista[k], sala: lista[k].sala, andar }; });
      } else if (regra.grupo === 'mesa') {
        const R = A.semente(A.hash('mesas-' + Q.id));
        const mesas = lista.slice().sort(() => R() - 0.5);
        quem.slice(0, mesas.length).forEach((m, i) => { casa[m.id] = { tipo: 'mesa', lugar: mesas[i], andar }; });
      } else {
        const extra = regra.grupo === 'empe' ? 1 : 0;  // em pé já nasce deslocado (ninguém em cima do corredor)
        quem.forEach((m, g) => { casa[m.id] = { tipo: regra.grupo, lugar: desloca(lista[g % lista.length], Math.floor(g / lista.length) + extra), andar }; });
      }
    }));
    return casa;
  }

  // 4b. A simulação de uma unidade: a planta, o lugar de cada um e o que cada boneco está fazendo.
  function criarSim(unidade) { return { unidade, P: A.plantas[unidade], casa: distribuir(unidade), bonecos: new Map(), ultimoMinuto: null, faixas: null, svg: null }; }
  const sorteioEspera = (b, a, z) => a + b.R() * (z - a);
  // Quanto tempo cada tipo fica no lugar antes de sair (segundos de animação).
  const ESPERA_CASA = { galpao: [6, 18], linha: [60, 200], manut: [20, 80], mesa: [30, 110], empe: [30, 110] };
  const ESPERA_INICIO = { galpao: [2, 16], linha: [5, 200], manut: [2, 80], mesa: [2, 110], empe: [2, 110] };
  // Levantar é RARO: no máximo EM_PE_MAX pessoas fora do lugar por unidade, e cada andar libera uma
  // saída a cada LEVANTA_MIN a LEVANTA_MAX segundos. O trabalho no posto (trocar de estação no galpão,
  // ir consertar a máquina) não passa por esse controle. CONVERSA e REUNIAO = quanto tempo fica fora.
  const EM_PE_MAX = 2, LEVANTA_MIN = 20, LEVANTA_MAX = 40;
  const CONVERSA = [3, 7], REUNIAO = [15, 30];
  const foraDoLugar = b => (b.estado === 'indo' || b.estado === 'fora' || b.estado === 'voltando') && b.foraGrupo !== 'maquina';
  function podeLevantar(b) {
    const sim = b.sim;
    let fora = 0;
    sim.bonecos.forEach(x => { if (foraDoLugar(x)) fora++; });
    if (fora >= EM_PE_MAX) return false;
    sim.liberado = sim.liberado || {};
    const agora = sim.relogio || 0;
    if (sim.liberado[b.andar] != null && agora < sim.liberado[b.andar]) return false;
    sim.liberado[b.andar] = agora + LEVANTA_MIN + b.R() * (LEVANTA_MAX - LEVANTA_MIN);
    return true;
  }

  function criarBoneco(sim, m, naPorta) {
    const c = sim.casa[m.id], p = A.pessoaPorId[m.id], P = c.andar === 2 ? sim.P.andar2 : sim.P;
    const b = { id: m.id, sim, m, p, P, andar: c.andar, unidade: sim.unidade, tipo: c.tipo, sala: c.sala, casa: c.lugar, R: A.semente(A.hash('boneco-' + m.id)),
      x: c.lugar.x + (c.lugar.ox || 0), y: c.lugar.y + (c.lugar.oy || 0), rota: [], i: 0, estado: 'casa', espera: 0, fase: 0, el: null, banda: -1, tr: '' };
    // Espera inicial sorteada: assim nem todo mundo levanta ao mesmo tempo.
    b.espera = b.tipo === 'sala' ? Infinity : sorteioEspera(b, ESPERA_INICIO[b.tipo][0], ESPERA_INICIO[b.tipo][1]);
    if (naPorta) { // acabou de bater o ponto: aparece na entrada e caminha até o lugar dele
      const T = sim.P;   // todo mundo entra pelo térreo (é lá que fica o relógio de ponto)
      b.x = T.entrada.x; b.y = T.entrada.y;
      const porta = { acesso: T.entrada.acesso, via: [] };
      const vest = T.lugares.vestiario;
      if (b.andar === 2) {   // vai até a escada no térreo; lá em cima segue para o lugar dele (ver passo)
        b.andar = 1; b.P = T; b.subir = true;
        b.rota = T.entrada.via.concat(rota(T, porta, T.lugares.escada[0])); b.estado = 'chegando';
        return b;
      }
      // Na fábrica, quem trabalha na linha ou na manutenção passa antes pelo vestiário.
      if ((b.tipo === 'linha' || b.tipo === 'manut') && vest.length) {
        const v = vest[Math.floor(b.R() * vest.length)];
        b.rota = T.entrada.via.concat(rota(T, porta, v), rota(T, v, b.casa));
      } else b.rota = T.entrada.via.concat(rota(T, porta, b.casa));
      b.estado = 'chegando';
    }
    return b;
  }

  // 4c. Sincronizar = deixar no mapa EXATAMENTE quem tem ponto aberto no minuto.
  // "natural" = o relógio andou sozinho (não foi a régua): aí quem acabou de entrar nasce na porta.
  function sincronizar(sim, minuto, natural) {
    const abertos = A.presentes(sim.unidade, minuto), ids = new Set(abertos.map(m => m.id));
    sim.bonecos.forEach((b, id) => { if (!ids.has(id)) { if (b.el) b.el.remove(); sim.bonecos.delete(id); } });
    abertos.forEach(m => {
      if (sim.bonecos.has(m.id)) return;
      const agora = natural && sim.ultimoMinuto != null && m.entrada > sim.ultimoMinuto && m.entrada <= minuto;
      const b = criarBoneco(sim, m, agora);
      sim.bonecos.set(m.id, b);
      if (sim.svg) criarEl(sim, b);
    });
    sim.ultimoMinuto = minuto;
  }

  // 4d. Um passo de tempo: anda pela rota; parado, conta a espera e decide o próximo destino.
  const VEL = 1.5; // células por segundo
  function escolherSaida(b) {
    const r = b.R(), L = b.P.lugares;
    const um = l => l[Math.floor(b.R() * l.length)];
    // Um passo para o lado (até 0,25 célula): duas pessoas no mesmo lugar não viram um boneco só.
    const perto = l => Object.assign({}, l, { ox: (b.R() - 0.5) * 0.5, oy: (b.R() - 0.5) * 0.5 });
    const vai = g => ({ lugar: perto(um(L[g])), grupo: g });
    if (b.tipo === 'galpao') {
      if (r < 0.85) { // troca de estação (ou de doca): a nova estação vira a "casa"
        const nova = um(L.galpao);
        return { lugar: Object.assign({}, nova, { ox: (b.R() - 0.5) * 0.5, oy: (b.R() - 0.5) * 0.5 }), muda: true };
      }
      return vai(r < 0.93 ? 'wc' : 'copa');
    }
    if (b.tipo === 'linha') return vai(r < 0.55 ? 'wc' : 'copa');                       // da linha, só pausa
    if (b.tipo === 'manut') return vai(r < 0.6 ? 'maquina' : r < 0.85 ? 'wc' : 'copa'); // conserta máquina
    if (L.reuniao.length && b.R() < 0.3) return vai('reuniao');                     // 2º andar da Matriz: reunião
    return vai(r < 0.5 ? 'wc' : 'copa');
  }
  function passo(b, dt) {
    if (b.parado) return;   // o mouse está em cima dele: congela para dar para clicar
    if (b.i < b.rota.length) {
      let resta = VEL * dt;
      while (resta > 0 && b.i < b.rota.length) {
        const alvo = b.rota[b.i], dx = alvo.x - b.x, dy = alvo.y - b.y, d = Math.hypot(dx, dy);
        if (d <= resta) { b.x = alvo.x; b.y = alvo.y; resta -= d; b.i++; } else { b.x += dx / d * resta; b.y += dy / d * resta; resta = 0; }
      }
      b.fase += dt * 9;
      if (b.i >= b.rota.length) { // chegou
        b.rota = []; b.i = 0;
        if (b.subir) {   // chegou na escada do térreo: aparece na escada do 2º andar e segue
          const P2 = b.P.andar2, e = P2.lugares.escada[0];
          b.subir = false; b.andar = 2; b.P = P2; b.x = e.x; b.y = e.y;
          b.rota = rota(P2, e, b.casa); b.estado = 'chegando';
          return;
        }
        if (b.estado === 'indo') { b.estado = 'fora'; b.espera = b.foraGrupo === 'reuniao' ? sorteioEspera(b, REUNIAO[0], REUNIAO[1]) : sorteioEspera(b, CONVERSA[0], CONVERSA[1]); }
        else { b.estado = 'casa'; b.espera = b.tipo === 'sala' ? Infinity : sorteioEspera(b, ESPERA_CASA[b.tipo][0], ESPERA_CASA[b.tipo][1]); }
      }
      return;
    }
    b.espera -= dt;
    if (b.espera > 0) return;
    const aqui = b.estado === 'fora' ? b.fora : b.casa;
    if (b.estado === 'fora') { b.rota = rota(b.P, aqui, b.casa); b.estado = 'voltando'; return; }
    const s = escolherSaida(b);
    if (!s.muda && s.grupo !== 'maquina' && !podeLevantar(b)) { b.espera = sorteioEspera(b, 4, 10); return; }   // fica sentado
    b.rota = rota(b.P, aqui, s.lugar);
    if (s.muda) { b.casa = s.lugar; b.estado = 'chegando'; } else { b.fora = s.lugar; b.foraGrupo = s.grupo; b.estado = 'indo'; }
  }
  const andando = b => b.i < b.rota.length;

  // 4e. A aparência da pessoa, sorteada com semente fixa A PARTIR DELA (mesma pessoa, mesmo visual):
  // 5 tons de pele, 5 cores de cabelo, cabelo comprido ou curto, e capacete para quem
  // trabalha na produção ou na manutenção da fábrica. A camisa é a cor da ÁREA (no CSS).
  function visual(p, unidade) {
    const h = A.hash('visual-' + p.id);
    return { pele: h % 5, cabelo: (h >>> 3) % 5, longo: p.genero === 'F' || (p.genero !== 'M' && ((h >>> 6) & 1) === 1),
      capacete: unidade === 'fab' && (p.area === 'ops' || p.area === 'man') };
  }
  const classesVisual = (p, v) => `amb-a-${p.area} amb-pele-${v.pele} amb-cabelo-${v.cabelo}`;
  // O boneco: sombra, pernas, camisa, cabeça, cabelo ou capacete (3D) e, na planta, um "pino"
  // visto de cima. Mais o anel de destaque e uma área de clique maior que ele.
  function criarEl(sim, b) {
    const v = visual(b.p, sim.unidade);
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', 'amb-boneco ' + classesVisual(b.p, v));
    g.setAttribute('data-id', b.id);
    g.setAttribute('data-area', b.p.area);
    g.setAttribute('data-andar', String(b.andar));
    if (b.tipo === 'sala') g.setAttribute('data-sala', ((sim.casa[b.id] || {}).andar || 1) + '-' + b.sala);
    const topo = v.capacete
      ? '<path class="amb-capacete" d="M-2.9,-12.5A2.9,2.9 0 0 1 2.9,-12.5Z"/><rect class="amb-capacete" x="-3.4" y="-12.8" width="6.8" height="0.7" rx="0.35"/>'
      : '<path class="amb-cabelo" d="M-2.6,-12.3A2.6,2.6 0 0 1 2.6,-12.3Q1.1,-13.3 0,-13.2Q-1.5,-13.2 -2.6,-12.3Z"/>' +
        (v.longo ? '<path class="amb-cabelo" d="M-2.6,-12.4Q-3.1,-10.2 -2.2,-9.4L-1.6,-9.6Q-2.1,-10.8 -1.9,-12.2Z M2.6,-12.4Q3.1,-10.2 2.2,-9.4L1.6,-9.6Q2.1,-10.8 1.9,-12.2Z"/>' : '');
    g.innerHTML = '<ellipse class="amb-sombra" cx="0" cy="0" rx="3.8" ry="1.9"/><ellipse class="amb-anel-sel" cx="0" cy="0" rx="5.4" ry="2.7"/>' +
      '<g class="amb-3d"><path class="amb-calca" d="M-2.3,-0.6V-4.4H-0.35V-0.6ZM0.35,-0.6V-4.4H2.3V-0.6Z"/>' +
      '<g class="amb-tronco"><path class="amb-camisa" d="M-2.8,-4.0V-7.6Q-2.8,-9.9 0,-9.9Q2.8,-9.9 2.8,-7.6V-4.0Z"/>' +
      '<circle class="amb-pele" cx="0" cy="-12.3" r="2.5"/>' + topo + '</g></g>' +
      '<g class="amb-pino"><circle class="amb-camisa" r="3.1"/><circle class="amb-pele" r="1.3"/></g>' +
      '<circle class="amb-alvo" cx="0" cy="-6" r="8"/>';
    b.el = g; b.banda = -1; b.tr = ''; b.sentado = null; b.andarEl = b.andar;
    desenharBoneco(sim, b);
  }
  function desenharBoneco(sim, b) {
    const [sx, sy] = proj(b.x, b.y, (b.andar - 1) * ANDAR);
    const anda = andando(b), pulo = anda && !b.parado && V.modo === '3d' ? Math.abs(Math.sin(b.fase)) * 1.3 : 0;
    const tr = `translate(${sx.toFixed(1)} ${(sy - pulo).toFixed(1)})`;
    if (tr !== b.tr) { b.el.setAttribute('transform', tr); b.tr = tr; }
    // Na mesa ou na sala, parado no lugar dele: sentado (a cadeira aparece e o tronco desce).
    const sentado = (b.tipo === 'mesa' || b.tipo === 'sala') && b.estado === 'casa' && !anda;
    if (sentado !== b.sentado) { b.el.classList.toggle('sentado', sentado); b.sentado = sentado; }
    if (b.andar !== b.andarEl) { b.el.setAttribute('data-andar', String(b.andar)); b.andarEl = b.andar; b.banda = -1; }
    const f = faixaDe(b.x, b.y);
    if (f !== b.banda) { sim.faixas[b.andar][f].appendChild(b.el); b.banda = f; }
  }
  // 4f. O "retrato" da pessoa para a janela: ilustração em SVG feita das MESMAS escolhas do
  // boneco (camisa da área, pele, cabelo, capacete). Não é foto e não tem rosto de ninguém.
  function avatarSvg(p, unidade, tam) {
    const v = visual(p, unidade);
    const cabelo = v.capacete
      ? '<path class="amb-capacete" d="M18,25Q19,10 32,10Q45,10 46,25Z"/><rect class="amb-capacete" x="14.5" y="23.5" width="35" height="3.4" rx="1.7"/>'
      : '<path class="amb-cabelo" d="M20,27Q19,13 32,13Q45,13 44,27Q41,19 32,19Q23,19 20,27Z"/>' +
        (v.longo ? '<path class="amb-cabelo" d="M20,25Q17,40 22,47L25.5,46Q22,36 23.5,27Z M44,25Q47,40 42,47L38.5,46Q42,36 40.5,27Z"/>' : '');
    return `<svg class="amb-avatar ${classesVisual(p, v)}" viewBox="0 0 64 64" width="${tam}" height="${tam}" aria-hidden="true">` +
      '<circle class="amb-av-fundo" cx="32" cy="32" r="32"/><path class="amb-camisa" d="M9,64Q11,46 32,44Q53,46 55,64Z"/>' +
      '<rect class="amb-pele" x="28" y="35" width="8" height="10" rx="3"/><circle class="amb-pele" cx="32" cy="27" r="12"/>' + cabelo +
      '<circle class="amb-olho" cx="27.5" cy="28.5" r="1.4"/><circle class="amb-olho" cx="36.5" cy="28.5" r="1.4"/>' +
      '<path class="amb-boca" d="M28.5,33.5Q32,35.8 35.5,33.5"/></svg>';
  }
  // Liga a simulação a um SVG recém-desenhado (montar, girar, trocar de modo) ou solta (desmontar).
  function ligar(sim, svg) {
    sim.svg = svg;
    sim.faixas = { 1: Array.from(svg.querySelectorAll('[data-andar="1"] .amb-f')), 2: Array.from(svg.querySelectorAll('[data-andar="2"] .amb-f')) };
    sim.bonecos.forEach(b => criarEl(sim, b));
    (sim.frota || []).forEach(a => { a.pecas = null; desenharAgente(sim, a); });   // a frota no desenho novo
  }
  function soltar(sim) { if (!sim) return; sim.svg = null; sim.faixas = null; sim.bonecos.forEach(b => { b.el = null; }); (sim.frota || []).forEach(a => { a.pecas = null; }); }

  // 4g. Caminhões. Um caminhão = peças (baú, chassi, 3 eixos de rodas, cabine separada, para-brisa,
  // janelas, para-choque e faróis), no sentido +x: traseira em x0, cabine na frente.
  function pecasCaminhao(x0, yc) {
    const p = [], c = (tipo, a0, a1, b0, b1, z0, h) => p.push({ tipo, x0: x0 + a0, x1: x0 + a1, y0: yc + b0, y1: yc + b1, z0, h });
    c('chassi', 0.2, 6.4, -0.55, 0.55, 0.22, 0.13);
    c('carreta', 0, 5, -0.75, 0.75, 0.35, 1.25);                       // baú
    [0.6, 1.4, 5.85].forEach(e => { c('roda', e - 0.3, e + 0.3, -0.8, -0.62, 0, 0.42); c('roda', e - 0.3, e + 0.3, 0.62, 0.8, 0, 0.42); });
    c('cabine', 5.12, 6.4, -0.66, 0.66, 0.3, 1.0);
    c('vidro', 6.4, 6.45, -0.55, 0.55, 0.82, 0.36);                     // para-brisa
    c('vidro', 5.55, 6.2, -0.69, -0.66, 0.82, 0.32); c('vidro', 5.55, 6.2, 0.66, 0.69, 0.82, 0.32); // janelas laterais
    c('parachoque', 6.45, 6.53, -0.62, 0.62, 0.2, 0.16);
    c('farol', 6.45, 6.5, -0.56, -0.38, 0.44, 0.1); c('farol', 6.45, 6.5, 0.38, 0.56, 0.44, 0.1);
    return p;
  }
  // Monta as peças em grupos <g> de 1 célula (como os móveis compridos), cada um com o centro no chão
  // guardado: é por ele que cada pedaço vai para a SUA faixa de profundidade (e o caminhão fica
  // atrás do que está na frente dele e na frente do que está atrás, andando ou girando a câmera).
  function gruposCaminhao(x0, yc, attrs, titulo) {
    const gs = [];
    pecasCaminhao(x0, yc).forEach(m => {
      const r = retV(m.x0, m.y0, m.x1, m.y1);
      pedacos(r[0], r[1], r[2], r[3]).forEach(c => {
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        const [wx, wy] = mundo((c[0] + c[2]) / 2, (c[1] + c[3]) / 2);
        g.setAttribute('class', 'amb-tpeca');
        Object.keys(attrs).forEach(k => g.setAttribute(k, attrs[k]));
        g.setAttribute('data-cx', wx.toFixed(2)); g.setAttribute('data-cy', wy.toFixed(2));
        g.innerHTML = (titulo ? '<title></title>' : '') + caixaSvg(c[0], c[1], c[2], c[3], m.h, 'amb-' + m.tipo, '', m.z0);
        if (titulo) g.querySelector('title').textContent = titulo;
        gs.push({ g, wx, wy, z0: m.z0, banda: -1 });
      });
    });
    return gs;
  }
  // Põe cada pedaço na faixa do seu ponto no chão (deslocado dx em x) e desloca o desenho.
  function faixarPecas(sim, gs, dx) {
    const [x0, y0] = proj(0, 0, 0), [x1, y1] = proj(dx, 0, 0), tr = `translate(${(x1 - x0).toFixed(1)} ${(y1 - y0).toFixed(1)})`;
    gs.forEach(p => {
      p.g.setAttribute('transform', tr);
      const [a, b] = vista(p.wx + dx, p.wy), f = faixaV(a + 0.0001 + (p.z0 ? 0.05 : 0), b);
      if (f !== p.banda) { sim.faixas[1][f].appendChild(p.g); p.banda = f; }
    });
  }

  // 4h. A FROTA do pátio. Cada caminhão é um "agente" numa vaga (doca ou vaga do pátio) e NUNCA
  // aparece nem some à vista: chega de ré pela estrada, vindo de fora do mapa (borda da direita),
  // encosta, fica, e vai embora dirigindo até passar da borda. Só anda na linha da sua vaga, que o
  // teste confere estar livre de qualquer peça. dx = células à direita da vaga (0 = encostado;
  // "longe" = já fora do contorno da planta).
  const VEL_CAMINHAO = 3;                     // células por segundo (a mesma na ida e na volta)
  const CICLO_PARADO = 10, CICLO_FORA = 4;    // caminhão da doca da Fábrica: quanto fica encostado e quanto fica fora
  const borda = sim => limites(sim.P)[0] + 0.5;
  const naMesmaVaga = (a, b) => a.x0 === b.x0 && a.yc === b.yc;
  function novoAgente(sim, v, id, titulo, dx, estado, ciclo) {
    return { id, x0: v.x0, yc: v.yc, longe: borda(sim) - v.x0, dx, estado, titulo, ciclo: !!ciclo, t: CICLO_PARADO, volta: 0, pecas: null, congelado: false };
  }
  function removerPecas(a) { (a.pecas || []).forEach(p => p.g.remove()); a.pecas = null; return false; }
  function desenharAgente(sim, a) {
    if (!sim.faixas) return;
    if (!a.pecas) a.pecas = gruposCaminhao(a.x0, a.yc, { role: 'button', tabindex: '0' });
    const fora = a.dx >= a.longe - 0.001;
    a.pecas.forEach(p => {
      if (p.id !== a.id) { p.g.setAttribute('data-amb-exp', a.id); p.id = a.id; }
      if (p.titulo !== a.titulo) { p.g.setAttribute('aria-label', a.titulo || ''); p.titulo = a.titulo; }
      p.g.style.display = fora ? 'none' : '';
      p.g.classList.toggle('sel', sim.selCaminhao === a.id);
      p.g.classList.toggle('hover', a.congelado);
      if (a.ciclo && !p.movel) { p.g.setAttribute('data-amb-movel', ''); p.movel = true; }
    });
    faixarPecas(sim, a.pecas, a.dx);
  }
  // As cargas "A sair" (em ordem de saída) ocupam as vagas. Quem já está numa vaga continua nela;
  // carga nova pega a 1ª vaga livre e, se ainda tem caminhão saindo dali, espera ele sumir.
  // instantaneo = abrir a aba ou trocar de unidade: todo mundo já no lugar, sem animação.
  function estacionar(sim, pendentes, vagas, instantaneo) {
    sim.frota = sim.frota || [];
    const quer = pendentes.slice(0, vagas.length), ids = new Map(quer.map(e => [e.id, e]));
    sim.frota.forEach(a => {
      if (a.ciclo) { if (instantaneo) a.morto = true; return; }   // o da doca volta a chegar pela estrada
      const e = ids.get(a.id);
      if (!e) { if (instantaneo || a.estado === 'espera') a.morto = true; else a.estado = 'saindo'; }   // saiu: vai embora dirigindo
      else { a.titulo = e.titulo; if (instantaneo) { a.dx = 0; a.estado = 'parado'; } }
    });
    sim.frota = sim.frota.filter(a => !a.morto || removerPecas(a));
    quer.forEach(e => {
      if (sim.frota.some(a => !a.ciclo && a.id === e.id)) return;   // (o da doca pode estar com o nome de outra carga)
      const v = vagas.find(v => !sim.frota.some(a => !a.ciclo && naMesmaVaga(a, v) && a.estado !== 'saindo'));
      if (v) sim.frota.push(novoAgente(sim, v, e.id, e.titulo, instantaneo ? 0 : borda(sim) - v.x0, instantaneo ? 'parado' : 'espera'));
    });
    sim.frota.forEach(a => desenharAgente(sim, a));
  }
  // Um passo da frota. ciclo = o caminhão da doca da Fábrica ({ vaga, ativo, id, titulo }): chega,
  // encosta, fica e sai, sem parar (só depois da 1ª saída do dia). parado = foto ou movimento
  // reduzido: todo mundo encostado, sem andar. Devolve quantas voltas o caminhão da doca deu.
  function avancarCaminhoes(sim, dt, ciclo, parado) {
    sim.frota = sim.frota || [];
    let c = sim.frota.find(a => a.ciclo);
    // Sem saída ainda (dia começando): o caminhão da doca vai embora e não volta.
    if (c && !(ciclo && ciclo.ativo)) { if (c.estado === 'fora') c.morto = true; else if (c.estado !== 'saindo') c.estado = 'saindo'; }
    if (ciclo && ciclo.ativo && !c) { c = novoAgente(sim, ciclo.vaga, ciclo.id, ciclo.titulo, parado ? 0 : borda(sim) - ciclo.vaga.x0, parado ? 'parado' : 'chegando', true); sim.frota.push(c); }
    sim.frota.forEach(a => {
      if (a.congelado) return;   // o mouse está em cima: para, para dar para clicar
      if (parado) { if (a.estado === 'saindo' && !a.ciclo) { a.dx = a.longe; a.morto = true; } else { a.dx = 0; a.estado = 'parado'; } return; }
      if (a.estado === 'espera') {
        if (!sim.frota.some(o => o !== a && naMesmaVaga(o, a) && !o.morto && o.dx < o.longe - 0.001)) a.estado = 'chegando';
      } else if (a.estado === 'chegando') {
        a.dx = Math.max(0, a.dx - VEL_CAMINHAO * dt);
        if (a.dx === 0) { a.estado = 'parado'; a.t = CICLO_PARADO; }
      } else if (a.estado === 'parado') {
        if (a.ciclo) { a.t -= dt; if (a.t <= 0) a.estado = 'saindo'; }
      } else if (a.estado === 'saindo') {
        a.dx = Math.min(a.longe, a.dx + VEL_CAMINHAO * dt);
        if (a.dx >= a.longe) { if (a.ciclo) { a.estado = 'fora'; a.t = CICLO_FORA; } else a.morto = true; }
      } else if (a.estado === 'fora') {
        a.t -= dt;
        if (a.t <= 0 && ciclo && ciclo.ativo) { a.estado = 'chegando'; a.volta++; }
      }
    });
    sim.frota = sim.frota.filter(a => !a.morto || removerPecas(a));
    sim.frota.forEach(a => desenharAgente(sim, a));
    return c ? c.volta : 0;
  }
  // O caminhão da doca troca de carga a cada volta (a tela diz qual).
  function rotularCaminhao(sim, id, titulo) {
    const c = (sim.frota || []).find(a => a.ciclo);
    if (c) { c.id = id; c.titulo = titulo; desenharAgente(sim, c); }
  }
  // Mouse em cima (para de andar) e caminhão selecionado (contorno), pelo id da carga.
  function congelarCaminhao(sim, id) { (sim.frota || []).forEach(a => { a.congelado = !!id && a.id === id; desenharAgente(sim, a); }); }
  function marcarCaminhao(sim, id) { sim.selCaminhao = id || ''; (sim.frota || []).forEach(a => desenharAgente(sim, a)); }
  // Para o teste: onde cada caminhão está (traseira no chão, linha, estado, se está à vista).
  const frota = sim => (sim.frota || []).map(a => ({ id: a.id, x: a.x0 + a.dx, y: a.yc, dx: a.dx, longe: a.longe, estado: a.estado, ciclo: a.ciclo,
    visivel: a.dx < a.longe - 0.001, congelado: a.congelado }));
  // Avança todos os bonecos e redesenha. "andar = false" (movimento reduzido): ficam no lugar.
  function avancar(sim, dt, andar) {
    if (andar) sim.relogio = (sim.relogio || 0) + dt;   // relógio da animação (controla o "levantar raro")
    sim.bonecos.forEach(b => {
      if (andar) passo(b, dt);
      if (b.el) desenharBoneco(sim, b);
    });
  }
  // Movimento reduzido (preferência do sistema): todo mundo no SEU lugar, sem rota pela metade.
  function paraCasa(sim) {
    sim.bonecos.forEach(b => {
      if (b.subir) { b.subir = false; b.andar = 2; b.P = b.P.andar2; }
      b.x = b.casa.x + (b.casa.ox || 0); b.y = b.casa.y + (b.casa.oy || 0);
      b.rota = []; b.i = 0; b.estado = 'casa';
      if (b.el) desenharBoneco(sim, b);
    });
  }
  // Para a foto (?foto=1): todo mundo começa em casa e a cena roda em passos FIXOS.
  // Mesma semente + mesmos passos = mesmo quadro em toda foto.
  function aquecer(sim, segundos) {
    for (let t = 0; t < segundos * 30; t++) { sim.relogio = (sim.relogio || 0) + 1 / 30; sim.bonecos.forEach(b => passo(b, 1 / 30)); }
  }

  return { VB, V, ANDAR, limites, VEL_CAMINHAO, avancarCaminhoes, rotularCaminhao, estacionar, congelarCaminhao, marcarCaminhao, frota, setVista, proj, desproj, melhorRot, svgEstatico, miniSvg, avatarSvg, visual,
    criarSim, sincronizar, avancar, ligar, soltar, aquecer, paraCasa, rota, grafo };
})();
