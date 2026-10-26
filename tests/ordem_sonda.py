# -*- coding: utf-8 -*-
"""
ordem_sonda.py: confere a ORDENAÇÃO pelo cabeçalho de uma tabela, do jeito que a pessoa usa.

Por que um arquivo só para isso: as duas baterias (teste_dashboard.py e teste_ambiente.py) têm
tabelas que ordenam com a MESMA regra (a do GRAFICOS.ordenar), então conferem com a mesma sonda.

A regra conferida, por tabela:
  - clicar num cabeçalho de número/data/hora: maior (mais novo) primeiro e aria-sort="descending";
  - clicar de novo: invertido e aria-sort="ascending";
  - 3º clique: volta à ordem original, LINHA POR LINHA, e nenhum <th> fica com aria-sort;
  - clicar num cabeçalho de texto: A→Z (comparação do navegador, sem caixa nem acento, "R2" antes de "R10");
  - vazio sempre no fim; a contagem de linhas nunca muda ao ordenar.
A comparação roda no próprio navegador (localeCompare), a mesma régua da tela.
"""
import json

JS = r"""
window.__ord = {
  // Valor de uma célula pelo tipo: texto como está; número no formato do Brasil (1.234,5);
  // data dd/mm/aaaa vira o instante; hora HH:MM vira minutos. Sem número = vazio (null).
  val(t, tipo) {
    t = (t || '').trim();
    if (tipo === 'texto') return t;
    if (tipo === 'data') {
      let m = t.match(/(\d{2})\/(\d{2})\/(\d{4})/); if (m) return +new Date(+m[3], m[2] - 1, +m[1]);
      m = t.match(/(\d{1,2}):(\d{2})/); if (m) return m[1] * 60 + +m[2];
      return null;
    }
    const s = t.replace(/[^\d,.\-]/g, '');
    if (!/\d/.test(s)) return null;
    return parseFloat(s.replace(/\./g, '').replace(',', '.'));
  },
  // A lista está em ordem? sentido 1 = crescente (A→Z), -1 = decrescente; vazio só no fim.
  ok(vals, tipo, sentido) {
    const v = vals.map(x => this.val(x, tipo)), vz = x => x == null || x === '' || (typeof x === 'number' && isNaN(x));
    let jaVazio = false;
    for (let i = 0; i < v.length; i++) {
      if (vz(v[i])) { jaVazio = true; continue; }
      if (jaVazio) return false;
      if (i > 0) {
        const c = tipo === 'texto' ? String(v[i - 1]).localeCompare(String(v[i]), 'pt', { sensitivity: 'base', numeric: true }) : v[i - 1] - v[i];
        if (c * sentido > 0) return false;
      }
    }
    return true;
  },
  // O retrato da tabela: o texto de cada linha, a coluna pedida e quem tem aria-sort.
  ler(sel, col) {
    const t = document.querySelector(sel);
    if (!t) return null;
    const linhas = [...t.querySelectorAll('tr')].filter(r => r.querySelector('td') && !r.querySelector('td[colspan]'));
    return { linhas: linhas.map(r => r.innerText), vals: linhas.map(r => r.cells[col] ? r.cells[col].innerText : ''),
      aria: [...t.querySelectorAll('th[aria-sort]')].map(th => [th.cellIndex, th.getAttribute('aria-sort')]) };
  },
  clicar(sel, col) { document.querySelector(sel).querySelectorAll('th')[col].querySelector('button').click(); }
};
"""


def ler(ed, sel, col):
    return json.loads(ed.js("JSON.stringify(window.__ord.ler(%s, %d))" % (json.dumps(sel), col)))


def em_ordem(ed, vals, tipo, sentido):
    return bool(ed.js("window.__ord.ok(%s, %s, %d)" % (json.dumps(vals), json.dumps(tipo), sentido)))


def clicar(ed, sel, col, espera=0.25):
    ed.js("window.__ord.clicar(%s, %d)" % (json.dumps(sel), col), espera=espera)


def confere(ed, sel, num, txt, depois=None):
    """Roda o ciclo inteiro numa tabela e devolve (tudo_certo, detalhe).
    sel = seletor da <table>; num = (índice, tipo) de uma coluna de número/data/hora;
    txt = índice de uma coluna de texto; depois = função que liga um filtro ou busca (ou troca de
    idioma/aba) com a tabela já ordenada pelo texto e devolve o seletor da tabela depois disso."""
    ed.js(JS)
    (ci, tipo), erros = num, []
    a = ler(ed, sel, ci)
    if not a or len(a["linhas"]) < 2:
        return False, f"{sel}: tabela com {0 if not a else len(a['linhas'])} linha(s), não dá para conferir a ordem"
    n0, orig = len(a["linhas"]), a["linhas"]
    clicar(ed, sel, ci)
    b = ler(ed, sel, ci)
    if not (em_ordem(ed, b["vals"], tipo, -1) and b["aria"] == [[ci, "descending"]] and len(b["linhas"]) == n0):
        erros.append(f"1º clique: decrescente={em_ordem(ed, b['vals'], tipo, -1)} aria={b['aria']} linhas {n0}->{len(b['linhas'])}")
    clicar(ed, sel, ci)
    c = ler(ed, sel, ci)
    if not (em_ordem(ed, c["vals"], tipo, 1) and c["aria"] == [[ci, "ascending"]] and len(c["linhas"]) == n0):
        erros.append(f"2º clique: crescente={em_ordem(ed, c['vals'], tipo, 1)} aria={c['aria']}")
    if b["vals"] == c["vals"] and len(set(b["vals"])) > 1:
        erros.append("2º clique não inverteu")
    clicar(ed, sel, ci)
    d = ler(ed, sel, ci)
    if not (d["linhas"] == orig and d["aria"] == []):
        erros.append(f"3º clique: voltou à ordem original={d['linhas'] == orig} aria={d['aria']}")
    clicar(ed, sel, txt)
    e = ler(ed, sel, txt)
    if not (em_ordem(ed, e["vals"], "texto", 1) and e["aria"] == [[txt, "ascending"]] and len(e["linhas"]) == n0):
        erros.append(f"texto: A-Z={em_ordem(ed, e['vals'], 'texto', 1)} aria={e['aria']}")
    if depois:
        ed.js(JS)
        sel2 = depois() or sel
        ed.js(JS)
        f = ler(ed, sel2, txt)
        if not f or not (em_ordem(ed, f["vals"], "texto", 1) and f["aria"] == [[txt, "ascending"]]):
            erros.append(f"depois do filtro/busca a ordem não ficou: {f and f['aria']}")
        nf = len(f["linhas"]) if f else 0
    clicar_ate_limpar(ed, sel if not depois else sel2, txt)
    return not erros, f"{sel}: {n0} linhas" + (f", {nf} depois do filtro" if depois else "") + ("; " + "; ".join(erros) if erros else "")


def clicar_ate_limpar(ed, sel, col):
    """Deixa a tabela na ordem original de novo (2 cliques depois do 1º), para a próxima checagem."""
    ed.js(JS)
    for _ in range(2):
        if ler(ed, sel, col)["aria"]:
            clicar(ed, sel, col)
