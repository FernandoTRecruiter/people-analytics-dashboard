/* =============================================================================
   app.js: liga tudo. Guarda o estado (aba, idioma, tema, filtros), desenha
   cabeçalho + filtros + página, e responde aos cliques.

   Desenho que se repete na tela inteira:
   - o cabeçalho não muda de lugar quando o conteúdo muda;
   - todo número tem um "i" que abre a conta por trás dele;
   - clicar numa barra, num ponto ou num número abre o MODO TABELA: a lista
     de quem está naquele número (nomes fictícios).
   ============================================================================= */
(function () {
  'use strict';
  const D = window.DADOS, I = window.I18N, T = I.T, M = window.METRICAS, G = window.GRAFICOS, P = window.PAGINAS, esc = G.esc;
  const CHAVE = 'paoli-people-demo';
  const DIA = 864e5;

  // Passo 1: estado inicial. Ordem de quem manda: endereço (?lang=en) > o que
  // a pessoa escolheu da última vez > padrão. Navegador sem armazenamento = padrão.
  function lerGuardado() { try { return JSON.parse(localStorage.getItem(CHAVE)) || {}; } catch (e) { return {}; } }
  function guardar() { try { localStorage.setItem(CHAVE, JSON.stringify({ lang: estado.lang, tema: estado.tema })); } catch (e) { /* sem armazenamento: tudo bem */ } }
  const q = new URLSearchParams(location.search), g = lerGuardado();
  const escuroSistema = window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches;
  const FILTROS_VAZIOS = { periodo: 'p12', unidade: '', area: '', vinculo: '', genero: '', nivel: '' };
  // "Meu ambiente" usa ponto e inventário SIMULADOS: com dado de verdade (Power BI) ela some,
  // para ninguém achar que o mapa mostra marcação real.
  const temAmbiente = () => !!P.ambiente && D.ficticio !== false;
  // "Meu ambiente" é a PRIMEIRA aba e a padrão; sem ela (dado real), a padrão volta a ser a Visão geral.
  const abasValidas = () => (temAmbiente() ? ['ambiente'] : []).concat(['geral', 'pessoas', 'rs']);
  const estado = {
    aba: abasValidas().includes(q.get('aba')) ? q.get('aba') : abasValidas()[0],   // sem ?aba= abre sempre na primeira (sem lembrar a última)
    lang: q.get('lang') === 'en' || q.get('lang') === 'pt' ? q.get('lang') : (g.lang || 'en'),   // 1º acesso em inglês; a escolha da pessoa fica guardada
    tema: q.get('tema') === 'escuro' || q.get('tema') === 'claro' ? q.get('tema') : (g.tema || (escuroSistema ? 'escuro' : 'claro')),
    tipoSaida: 'pedido',
    filtros: Object.assign({}, FILTROS_VAZIOS),
    tabela: { busca: '', ordem: { col: '', passo: 0 }, pagina: 1 },
    vagas: { col: '', passo: 0 }   // ordem da tabela de vagas abertas (vazia = a ordem declarada)
  };
  const embed = q.get('embed') === '1';
  if (embed) document.body.classList.add('embed');

  const raiz = document.getElementById('app');
  let contas = {}, ultimo = null;

  // Passo 2: as funções de formatação que as páginas recebem (sempre no idioma da tela).
  const ctx = {
    T, I, D, estado,
    conta(id, titulo, formula, partes, nota) { contas[id] = { titulo, formula, partes, nota }; },
    num: (v, dec) => v == null ? '-' : Number(v).toLocaleString(I.locale(), { minimumFractionDigits: dec || 0, maximumFractionDigits: dec || 0 }),
    pct: (v, dec) => v == null ? '-' : (v * 100).toLocaleString(I.locale(), { minimumFractionDigits: dec == null ? 1 : dec, maximumFractionDigits: dec == null ? 1 : dec }) + '%',
    data: d => d.toLocaleDateString(I.locale(), { day: '2-digit', month: '2-digit', year: 'numeric' }),
    periodoNome: () => rotuloPeriodo(estado.filtros.periodo),
    tipoNome: () => T('t_' + estado.tipoSaida)
  };

  // Ícone desenhado aqui mesmo: três barras de um gráfico.
  const ICONE = '<svg viewBox="0 0 40 40" aria-hidden="true"><rect x="8" y="20" width="6" height="12" rx="2" fill="currentColor" opacity=".55"/><rect x="17" y="12" width="6" height="20" rx="2" fill="currentColor"/><rect x="26" y="16" width="6" height="16" rx="2" fill="currentColor" opacity=".8"/></svg>';

  // O nome de cada período sai da data de corte (serve para qualquer ano, não só o da demo).
  function rotuloPeriodo(k) {
    const ref = D.dataRef;
    if (k === 'pano') return T('pano', { a: ref.getFullYear(), m: ref.toLocaleDateString(I.locale(), { month: 'long' }) });
    if (k === 'panoant') return T('panoant', { a: ref.getFullYear() - 1 });
    if (k === 'ptudo') return T('ptudo', { n: D.meses.length });
    return T('p12');
  }

  function opcoes(nome, cadastro, valor) {
    return `<label class="filtro"><span>${esc(T('f_' + nome))}</span><select data-filtro="${nome}"><option value="">${esc(T('todos'))}</option>` +
      Object.keys(cadastro).map(k => `<option value="${k}"${valor === k ? ' selected' : ''}>${esc(typeof cadastro[k] === 'string' ? cadastro[k] : I.nome(cadastro[k]))}</option>`).join('') + '</select></label>';
  }

  function cabecalho() {
    const f = estado.filtros;
    const algumFiltro = Object.keys(FILTROS_VAZIOS).some(k => f[k] !== FILTROS_VAZIOS[k]);
    let h = `<header class="topo"><div class="marca"><span class="icone">${ICONE}</span><div><div class="eyebrow">${esc(T('eyebrow'))}</div>` +
      `<h1>${esc(T('titulo_exec'))} <span class="sec">- ${esc(T('sub_exec'))}</span></h1>` +
      `<div class="empresa">${esc(D.empresa)} · ${esc(T(D.ficticio === false ? 'fonte_real' : 'ficticio'))}</div></div></div>` +
      `<div class="acoes"><div class="seg-botoes" role="group" aria-label="${esc(T('idioma'))}"><button data-lang="pt" class="${estado.lang === 'pt' ? 'ativo' : ''}">PT</button><button data-lang="en" class="${estado.lang === 'en' ? 'ativo' : ''}">EN</button></div>` +
      `<button class="botao leve" data-tema>${estado.tema === 'escuro' ? '☀ ' + esc(T('tema_claro')) : '☾ ' + esc(T('tema_escuro'))}</button></div></header>`;
    const abas = (temAmbiente() ? [['ambiente', 'aba_ambiente']] : []).concat([['geral', 'aba_geral'], ['pessoas', 'aba_pessoas'], ['rs', 'aba_rs']]);
    h += `<div class="linha-abas"><nav class="abas" role="tablist">` +
      abas.map(([k, t]) => `<button role="tab" data-aba="${k}" class="${estado.aba === k ? 'ativa' : ''}" aria-selected="${estado.aba === k}">${esc(T(t))}</button>`).join('') +
      `</nav><div class="selo-data" data-tip="${esc(T('dica_data'))}"><i></i>${esc(T('numeros_de'))} <b class="mono">${ctx.data(M.periodo(f.periodo).fim)}</b></div></div>`;
    // Na aba "Meu ambiente" a barra de filtros some: lá quem manda são as unidades do mapa.
    if (estado.aba === 'ambiente') return h;
    h += `<div class="filtros"><label class="filtro"><span>${esc(T('f_periodo'))}</span><select data-filtro="periodo">` +
      ['p12', 'pano', 'panoant', 'ptudo'].map(k => `<option value="${k}"${f.periodo === k ? ' selected' : ''}>${esc(rotuloPeriodo(k))}</option>`).join('') + '</select></label>' +
      opcoes('unidade', D.unidades, f.unidade) + opcoes('area', D.areas, f.area) + opcoes('vinculo', D.vinculos, f.vinculo) +
      opcoes('genero', { F: T('g_F'), M: T('g_M'), N: T('g_N') }, f.genero) + opcoes('nivel', D.niveis, f.nivel) +
      `<button class="botao limpar${algumFiltro ? ' ativo' : ''}" data-limpar ${algumFiltro ? '' : 'disabled'}>✕ ${esc(T('limpar'))}</button></div>`;
    return h;
  }

  function alertas(r) {
    if (estado.aba === 'ambiente') return '';
    const n = r.alertas.length;
    const txt = a => a.tipo === 'turnover' ? T('al_turnover', { a: I.nome(D.areas[a.area]), v: ctx.pct(a.valor) })
      : a.tipo === 'vagas' ? (a.n === 1 ? T('al_vagas_1') : T('al_vagas', { n: a.n })) : a.tipo === 'novatos' ? T('al_novatos', { v: ctx.pct(a.valor, 0) }) : (a.n === 1 ? T('al_prazo_1') : T('al_prazo', { n: a.n }));
    if (!n) return `<div class="alertas zero"><span>✓</span> ${esc(T('sem_alerta'))}</div>`;
    return `<details class="alertas"><summary><span class="sino">!</span> <b>${n}</b> ${esc(T(n === 1 ? 'alerta' : 'alertas'))}<span class="seta">▾</span></summary><ul>` +
      r.alertas.map(a => `<li>${esc(txt(a))} <button class="link" data-ir="${a.ir}">${esc(T('ir'))} →</button></li>`).join('') + '</ul></details>';
  }

  // Passo 3: desenhar tudo. Simples de propósito: muda o estado, redesenha.
  function desenhar(foco) {
    if (window.AMBIENTE) window.AMBIENTE.desmontar();
    I.lang = estado.lang;
    document.documentElement.lang = estado.lang === 'en' ? 'en' : 'pt-BR';
    document.documentElement.dataset.theme = estado.tema === 'escuro' ? 'dark' : 'light';
    document.title = `${T('titulo_exec')} - ${T('sub_exec')} · ${D.empresa}`;
    contas = {};
    const r = M.calcular(estado);
    ultimo = r;
    const pagina = P[estado.aba](r, ctx);
    const portfolio = location.protocol === 'file:' ? '../FernandoTRecruiter.github.io/index.html' : 'https://fernandotrecruiter.github.io/';
    const semLink = embed || window.MODO_POWERBI; // dentro do portfólio ou do Power BI não tem para onde voltar
    raiz.innerHTML = cabecalho() + alertas(r) + `<div class="corpo${estado.aba === 'ambiente' ? ' cheio' : ''}"><nav class="trilho" aria-label="${esc(T('secoes'))}"></nav><main class="pagina">${pagina}</main></div>` +
      `<footer class="rodape"><span>${esc(T(D.ficticio === false ? 'fonte_real' : 'rodape'))}</span>${semLink ? '' : `<a href="${portfolio}">${esc(T('ver_portfolio'))} →</a>`}</footer>`;
    montarTrilho();
    if (estado.aba === 'ambiente' && window.AMBIENTE) window.AMBIENTE.montar(document.getElementById('ambiente-raiz'), ctx);
    if (foco === 'busca') {
      const b = raiz.querySelector('[data-busca]');
      if (b) { b.focus(); b.setSelectionRange(b.value.length, b.value.length); }
    }
    if (gaveta.chave) desenharGaveta(); // a tabela aberta acompanha filtro, idioma e tema
    guardar();
    window.__demo = { estado, r, gaveta }; // para os testes automáticos lerem o que a tela mostrou
  }

  // Trilho numerado à esquerda. Acende a seção que passou da linha de 35% da
  // tela; no fim da página acende a ÚLTIMA (antes ela nunca acendia, porque a
  // última seção é curta e não chega até a linha).
  function montarTrilho() {
    const trilho = raiz.querySelector('.trilho');
    const secoes = [...raiz.querySelectorAll('.secao')];
    trilho.innerHTML = secoes.map((s, i) => `<button data-secao="${s.id}"><span class="n">${i + 1}</span>${esc(s.dataset.titulo)}</button>`).join('');
    marcarTrilho();
  }
  function marcarTrilho() {
    const secoes = [...raiz.querySelectorAll('.secao')];
    if (!secoes.length) return;
    const linha = innerHeight * 0.35;
    let ativa = secoes[0];
    secoes.forEach(s => { if (s.getBoundingClientRect().top <= linha) ativa = s; });
    if (innerHeight + scrollY >= document.documentElement.scrollHeight - 4) ativa = secoes[secoes.length - 1];
    raiz.querySelectorAll('.trilho button').forEach(b => b.classList.toggle('ativo', b.dataset.secao === ativa.id));
  }
  window.addEventListener('scroll', marcarTrilho, { passive: true });
  window.addEventListener('resize', marcarTrilho);

  // Passo 4: balão de dica (passar o mouse) e janela "como é contado" (clicar no i).
  const dica = document.createElement('div'); dica.className = 'dica'; document.body.appendChild(dica);
  document.addEventListener('mousemove', e => {
    const alvo = e.target.closest && e.target.closest('[data-tip]');
    if (!alvo) { dica.classList.remove('visivel'); return; }
    dica.textContent = alvo.dataset.tip;
    dica.classList.add('visivel');
    const x = Math.min(e.clientX + 14, innerWidth - dica.offsetWidth - 8), y = e.clientY + 18 + dica.offsetHeight > innerHeight ? e.clientY - dica.offsetHeight - 12 : e.clientY + 18;
    dica.style.transform = `translate(${x}px, ${y}px)`;
  });
  const pop = document.createElement('div'); pop.className = 'conta-pop'; pop.hidden = true; document.body.appendChild(pop);
  function abrirConta(id, botao) {
    const c = contas[id]; if (!c) return;
    pop.innerHTML = `<div class="cp-cab"><span>${esc(T('x_titulo'))} · <b>${esc(c.titulo)}</b></span><button data-fechar aria-label="${esc(T('x_fechar'))}">✕</button></div>` +
      `<div class="cp-formula mono">${esc(c.formula)}</div><div class="cp-sub">${esc(T('x_partes'))}</div>` +
      `<table>${c.partes.map(([a, b]) => `<tr><td>${esc(a)}</td><td class="mono">${esc(typeof b === 'number' ? ctx.num(b) : b)}</td></tr>`).join('')}</table>` +
      (c.nota ? `<div class="cp-nota">${esc(c.nota)}</div>` : '');
    pop.hidden = false;
    const r = botao.getBoundingClientRect();
    const larg = Math.min(360, innerWidth - 24);
    pop.style.width = larg + 'px';
    pop.style.left = Math.max(12, Math.min(r.left, innerWidth - larg - 12)) + 'px';
    pop.style.top = (r.bottom + 8 + pop.offsetHeight > innerHeight ? Math.max(12, r.top - pop.offsetHeight - 8) : r.bottom + 8) + 'px';
  }
  const fecharConta = () => { pop.hidden = true; };
  window.addEventListener('scroll', fecharConta, { passive: true });

  // Passo 5: o MODO TABELA. Cada chave de clique (data-drill) vira uma lista de
  // pessoas com as colunas que fazem sentido para ela.
  const gaveta = { chave: null, busca: '', ordem: { col: '', passo: 0 } };
  const fundoG = document.createElement('div'); fundoG.className = 'gaveta-fundo'; fundoG.hidden = true; document.body.appendChild(fundoG);
  const elG = document.createElement('aside'); elG.className = 'gaveta'; elG.hidden = true;
  elG.setAttribute('role', 'dialog'); elG.setAttribute('aria-modal', 'true'); elG.setAttribute('aria-labelledby', 'g-tit');
  document.body.appendChild(elG);

  const mesDe = d => d && (d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'));
  const anos = (a, b) => (b - a) / (365.25 * DIA);
  const faixaDe = (p, ref) => { const i = anos(p.nascimento, ref); return i < 25 ? '<25' : i < 35 ? '25-34' : i < 45 ? '35-44' : i < 55 ? '45-54' : '55+'; };
  const bandaDe = p => { const a = anos(p.admissao, p.desligamento); return a < 1 ? '<1' : a < 2 ? '1-2' : a < 5 ? '2-5' : '5+'; };
  function nomeMes(iso) { const [a, m] = iso.split('-').map(Number); return new Date(a, m - 1, 1).toLocaleDateString(I.locale(), { month: 'long', year: 'numeric' }); }

  function resolver(chave, r) {
    const [tipo, a, b] = chave.split(':');
    const nomeCad = (cad, k) => (cad[k] ? I.nome(cad[k]) : k);
    const ativos = r.ativosFim;
    const porCampo = { area: [D.areas, 'c_area'], unidade: [D.unidades, 'c_unidade'], nivel: [D.niveis, 'c_nivel'], vinculo: [D.vinculos, 'c_vinculo'], raca: [D.racas, 'raca'] };
    if (tipo === 'todos') return { titulo: T('d_quadro', { d: ctx.data(r.per.fim) }), modelo: 'pessoas', lista: ativos };
    if (tipo === 'entradas') return { titulo: T('d_entradas'), modelo: 'pessoas', lista: r.entradas };
    if (tipo === 'saidas' && !a) return { titulo: T('d_saidas'), modelo: 'saidas', lista: r.saidas };
    if (tipo === 'saidas-tipo') return { titulo: `${T('d_tipo')} (${ctx.tipoNome().toLowerCase()})`, modelo: 'saidas', lista: r.saidasTipo };
    if (tipo === 'saidas-area') return { titulo: `${T('d_saidas')} · ${nomeCad(D.areas, a)}`, modelo: 'saidas', lista: r.saidas.filter(p => p.area === a && r.TIPOS.todos.includes(p.motivo)) };
    if (porCampo[tipo]) return { titulo: `${T(porCampo[tipo][1])}: ${nomeCad(porCampo[tipo][0], a)}`, modelo: 'pessoas', lista: ativos.filter(p => p[tipo] === a) };
    if (tipo === 'genero') return { titulo: `${T('f_genero')}: ${T('g_' + a)}`, modelo: 'pessoas', lista: ativos.filter(p => p.genero === a) };
    if (tipo === 'lider') return { titulo: `${T('d_lider')} · ${T('g_' + a)}`, modelo: 'pessoas', lista: ativos.filter(p => D.niveis[p.nivel].lider && p.genero === a) };
    if (tipo === 'gn') return { titulo: `${nomeCad(D.niveis, a)} · ${T('g_' + b)}`, modelo: 'pessoas', lista: ativos.filter(p => p.nivel === a && p.genero === b) };
    if (tipo === 'faixa') return { titulo: `${T('faixa_idade')}: ${a} ${T('anos')}`, modelo: 'pessoas', lista: ativos.filter(p => faixaDe(p, r.per.fim) === a) };
    if (tipo === 'ppi') return { titulo: T('k_ppi'), modelo: 'pessoas', lista: ativos.filter(p => ['preta', 'parda', 'indigena'].includes(p.raca)) };
    if (tipo === 'motivo') return { titulo: `${T('c_motivo')}: ${nomeCad(D.motivos, a)}`, modelo: 'saidas', lista: r.saidas.filter(p => p.motivo === a) };
    if (tipo === 'banda') return { titulo: `${T('casa_saida')}: ${a} ${a === '<1' ? T('ano') : T('anos')}`, modelo: 'saidas', lista: r.saidasTipo.filter(p => bandaDe(p) === a) };
    if (tipo === 'mes') return { titulo: T('d_mes', { m: nomeMes(a) }), modelo: 'mov', lista: r.P.filter(p => mesDe(p.admissao) === a || mesDe(p.desligamento) === a) , mes: a };
    if (tipo === 'saidas') return { titulo: T('d_saidas_mes', { m: nomeMes(a), t: ctx.tipoNome().toLowerCase() }), modelo: 'saidas', lista: r.P.filter(p => mesDe(p.desligamento) === a && r.TIPOS[r.tipo].includes(p.motivo)) };
    if (tipo === 'novatos') return { titulo: T('d_novatos'), modelo: 'novatos', lista: r.novatosLista };
    if (tipo === 'vagas-abertas') return { titulo: T('s_abertas'), modelo: 'vagas', lista: r.abertas };
    return { titulo: chave, modelo: 'pessoas', lista: [] };
  }

  // Colunas de cada modelo: [chave, rótulo, valor para ordenar, texto da célula, tipo para ordenar].
  function colunas(modelo, ref, mes) {
    const nome = ['nome', T('c_nome'), p => p.nome, p => `<span class="avatar-mini">${esc(p.nome.split(' ').map(x => x[0]).slice(0, 2).join(''))}</span>${esc(p.nome)}`, 'texto'];
    const area = ['area', T('c_area'), p => I.nome(D.areas[p.area]), p => esc(I.nome(D.areas[p.area])), 'texto'];
    const nivel = ['nivel', T('c_nivel'), p => D.niveis[p.nivel].ordem, p => esc(I.nome(D.niveis[p.nivel])), 'num'];
    const vinc = ['vinculo', T('c_vinculo'), p => I.nome(D.vinculos[p.vinculo]), p => esc(I.nome(D.vinculos[p.vinculo])), 'texto'];
    const unid = ['unidade', T('c_unidade'), p => I.nome(D.unidades[p.unidade]), p => esc(I.nome(D.unidades[p.unidade])), 'texto'];
    const adm = ['admissao', T('c_admissao'), p => +p.admissao, p => `<span class="mono">${ctx.data(p.admissao)}</span>`, 'data'];
    const casa = ['casa', T('c_casa'), p => anos(p.admissao, p.desligamento && p.desligamento <= ref ? p.desligamento : ref), p => `<span class="mono">${ctx.num(anos(p.admissao, p.desligamento && p.desligamento <= ref ? p.desligamento : ref), 1)} ${T('anos')}</span>`, 'num'];
    const saida = ['saida', T('c_saida'), p => p.desligamento, p => `<span class="mono">${ctx.data(p.desligamento)}</span>`, 'data'];
    const motivo = ['motivo', T('c_motivo'), p => (p.motivo ? I.nome(D.motivos[p.motivo]) : ''), p => p.motivo ? esc(I.nome(D.motivos[p.motivo])) : '', 'texto'];
    if (modelo === 'saidas') return [nome, area, nivel, adm, saida, motivo, casa];
    if (modelo === 'mov') {
      const entrou = p => mesDe(p.admissao) === mes;
      return [nome, ['mov', T('c_movimento'), p => T(entrou(p) ? 'mov_entrou' : 'mov_saiu'), p => entrou(p) ? `<span class="chip ok">${esc(T('mov_entrou'))}</span>` : `<span class="chip bad">${esc(T('mov_saiu'))}</span>`, 'texto'],
        ['data', T('c_admissao') + ' / ' + T('c_saida'), p => (entrou(p) ? p.admissao : p.desligamento), p => `<span class="mono">${ctx.data(entrou(p) ? p.admissao : p.desligamento)}</span>`, 'data'], area, nivel, motivo];
    }
    if (modelo === 'novatos') {
      const ficou = p => !p.desligamento || (p.desligamento - p.admissao) >= 365 * DIA;
      return [nome, area, nivel, adm, ['sit', T('c_etapa'), p => T(ficou(p) ? 'ficou' : 'nao_ficou'), p => ficou(p) ? `<span class="chip ok">${esc(T('ficou'))}</span>` : `<span class="chip bad">${esc(T('nao_ficou'))}</span>`, 'texto']];
    }
    if (modelo === 'vagas') return [
      ['id', T('c_vaga'), v => v.id, v => `<b class="mono">${v.id}</b> ${esc(I.nome(D.niveis[v.nivel]))} · ${esc(I.nome(D.areas[v.area]))}`, 'texto'],
      ['unidade', T('c_unidade'), v => I.nome(D.unidades[v.unidade]), v => esc(I.nome(D.unidades[v.unidade])), 'texto'],
      ['dias', T('c_aberta_ha'), v => v.dias, v => `<span class="mono">${v.dias} ${T('dias')}</span>`, 'num'],
      ['etapa', T('c_etapa'), v => ({ triagem: 1, entrevistas: 2, oferta: 3 }[v.etapaNaData]), v => `<span class="chip neutro">${esc(T('e_' + v.etapaNaData))}</span>`, 'num'],
      ['insc', T('c_inscritos'), v => v.inscritos, v => `<span class="mono">${v.inscritos}</span>`, 'num']];
    return [nome, area, nivel, vinc, unid, adm, casa];
  }

  function desenharGaveta() {
    const r = ultimo, res = resolver(gaveta.chave, r), cols = colunas(res.modelo, r.per.fim, res.mes);
    const busca = gaveta.busca.trim().toLowerCase();
    let lista = res.lista.filter(x => !busca || (x.nome || x.id || '').toLowerCase().includes(busca));
    // A ordenação é a do app inteiro (G.ordenar); a ordem declarada é a 1ª coluna (nome ou vaga), A→Z.
    const colsO = cols.map(c => ({ k: c[0], tipo: c[4], v: c[2] }));
    lista = G.ordenar(G.ordenar(lista, colsO, { col: colsO[0].k, passo: 1 }), colsO, gaveta.ordem);
    gaveta.ultima = { res, cols, lista };
    elG.innerHTML = `<header class="g-cab"><div><div class="eyebrow">${esc(T('g_titulo'))}</div><h2 id="g-tit">${esc(res.titulo)} <span class="chip neutro">${res.lista.length}</span></h2></div>` +
      `<button class="g-x" data-g-fechar aria-label="${esc(T('g_fechar'))}">✕</button></header>` +
      `<div class="g-barra"><input class="busca" type="search" data-g-busca value="${esc(gaveta.busca)}" placeholder="${esc(T('g_buscar'))}" aria-label="${esc(T('g_buscar'))}"><button class="botao leve" data-g-csv>⭳ ${esc(T('g_baixar'))}</button></div>` +
      `<div class="g-rolagem"><table class="tabela"><thead><tr>${colsO.map((c, i) => G.thOrdena(c, cols[i][1], gaveta.ordem, 'data-g-ordem')).join('')}</tr></thead><tbody>` +
      (lista.length ? lista.map(x => `<tr>${cols.map(c => `<td>${c[3](x)}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${cols.length}" class="vazio">${esc(T('sem_linhas'))}</td></tr>`) +
      `</tbody></table></div><footer class="g-pe">${esc(T(D.ficticio === false ? 'fonte_real' : 'ficticio'))}</footer>`;
  }
  function abrirGaveta(chave) {
    gaveta.chave = chave; gaveta.busca = ''; gaveta.ordem = { col: '', passo: 0 };
    desenharGaveta();
    fundoG.hidden = false; elG.hidden = false;
    document.body.classList.add('com-gaveta');
    const x = elG.querySelector('[data-g-fechar]'); if (x) x.focus();
  }
  function fecharGaveta() {
    if (!gaveta.chave) return;
    gaveta.chave = null; elG.hidden = true; fundoG.hidden = true;
    document.body.classList.remove('com-gaveta');
  }
  // CSV com ponto e vírgula e BOM: abre certinho no Excel em português.
  function baixarCsv() {
    const u = gaveta.ultima; if (!u) return;
    const limpa = h => String(h).replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
    const linhas = [u.cols.map(c => c[1])].concat(u.lista.map(x => u.cols.map(c => limpa(c[3](x)))));
    const csv = '﻿' + linhas.map(l => l.map(v => /[;"\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v).join(';')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = 'dashboard-' + gaveta.chave.replace(/[^a-z0-9-]+/gi, '_') + '.csv';
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  fundoG.addEventListener('click', fecharGaveta);
  elG.addEventListener('input', e => { if (e.target.matches('[data-g-busca]')) { gaveta.busca = e.target.value; desenharGaveta(); const b = elG.querySelector('[data-g-busca]'); b.focus(); b.setSelectionRange(b.value.length, b.value.length); } });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { fecharConta(); fecharGaveta(); }
    const linha = e.target.closest && e.target.closest('.lb-linha[data-drill]');
    if (linha && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); abrirGaveta(linha.dataset.drill); }
  });

  // Passo 6: um único ouvinte de clique para a página toda (delegação).
  document.addEventListener('click', e => {
    if (e.target.closest('.gaveta')) {
      const g = e.target.closest('[data-g-fechar], [data-g-ordem], [data-g-csv]');
      if (!g) return;
      if (g.hasAttribute('data-g-fechar')) return fecharGaveta();
      if (g.hasAttribute('data-g-csv')) return baixarCsv();
      if (g.dataset.gOrdem) { gaveta.ordem = G.proximaOrdem(gaveta.ordem, g.dataset.gOrdem); desenharGaveta(); }
      return;
    }
    const b = e.target.closest('button, [data-ir], [data-drill]');
    if (!b) { if (!e.target.closest('.conta-pop')) fecharConta(); return; }
    if (b.hasAttribute('data-fechar')) return fecharConta();
    if (b.dataset.conta) { e.stopPropagation(); return abrirConta(b.dataset.conta, b); }
    fecharConta();
    if (b.dataset.drill) return abrirGaveta(b.dataset.drill);
    if (b.dataset.aba) { estado.aba = b.dataset.aba; desenhar(); window.scrollTo({ top: 0 }); return; }
    if (b.dataset.lang) { estado.lang = b.dataset.lang; desenhar(); return; }
    if (b.hasAttribute('data-tema')) { estado.tema = estado.tema === 'escuro' ? 'claro' : 'escuro'; desenhar(); return; }
    if (b.hasAttribute('data-limpar')) { estado.filtros = Object.assign({}, FILTROS_VAZIOS); desenhar(); return; }
    if (b.dataset.tipo) { estado.tipoSaida = b.dataset.tipo; desenhar(); return; }
    if (b.dataset.ordem) { estado.tabela.ordem = G.proximaOrdem(estado.tabela.ordem, b.dataset.ordem); estado.tabela.pagina = 1; desenhar(); return; }
    if (b.dataset.ordemVaga) { estado.vagas = G.proximaOrdem(estado.vagas, b.dataset.ordemVaga); desenhar(); return; }
    if (b.dataset.pagina) { estado.tabela.pagina += Number(b.dataset.pagina); desenhar(); return; }
    if (b.dataset.secao) { document.getElementById(b.dataset.secao).scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    if (b.dataset.ir) {
      const destino = { turnover: 'pessoas', quadro: 'pessoas', abertas: 'rs' }[b.dataset.ir];
      estado.aba = destino; desenhar();
      const alvo = document.getElementById('s-' + b.dataset.ir);
      if (alvo) alvo.scrollIntoView({ block: 'start' });
    }
  });
  document.addEventListener('change', e => {
    const s = e.target.closest('[data-filtro]');
    if (s) { estado.filtros[s.dataset.filtro] = s.value; estado.tabela.pagina = 1; desenhar(); }
  });
  document.addEventListener('input', e => {
    if (e.target.matches('[data-busca]')) { estado.tabela.busca = e.target.value; estado.tabela.pagina = 1; desenhar('busca'); }
  });

  // Passo 7: conversa com o portfólio quando a demo está dentro dele (iframe).
  // Só aceita chaves conhecidas, com valores conhecidos: nada de executar código vindo de fora.
  window.addEventListener('message', e => {
    const m = e.data;
    if (!m || m.paoliDemo !== true) return;
    let mudou = false;
    if (m.lang === 'pt' || m.lang === 'en') { estado.lang = m.lang; mudou = true; }
    if (m.tema === 'claro' || m.tema === 'escuro') { estado.tema = m.tema; mudou = true; }
    if (abasValidas().includes(m.aba)) { estado.aba = m.aba; mudou = true; }
    if (mudou) desenhar();
  });
  // Dentro do portfólio, conta a própria altura para a janela de fora crescer junto (sem barra de rolagem dentro da janela).
  if (embed && window.parent !== window && 'ResizeObserver' in window) {
    let ultima = 0;
    new ResizeObserver(() => {
      const h = Math.ceil(document.documentElement.scrollHeight);
      if (Math.abs(h - ultima) > 2) { ultima = h; window.parent.postMessage({ paoliAltura: h }, '*'); }
    }).observe(document.body);
  }

  desenhar();
})();
