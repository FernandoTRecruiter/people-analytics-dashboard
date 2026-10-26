# -*- coding: utf-8 -*-
"""
teste_dashboard.py: bateria da demo do dashboard executivo de pessoas.

O que prova (cada item imprime OK ou FALHA com o número que decidiu):
  1. abre sem erro de JavaScript em todas as abas, idiomas e temas
  2. o número do cartão é o número calculado (a tela não inventa)
  3. o "i" abre a conta por trás do número
  4. filtro muda o número e Limpar volta ao de antes
  5. a busca da tabela filtra e não perde o foco do teclado
  6. nenhuma chave de tradução faltando ([chave]), nenhum travessão e nenhum nome interno
  7. "por área" soma o quadro
  8. barra de abas sem rolagem e filtros do mesmo tamanho preenchendo a linha
  9. no fim da página o trilho acende a última seção
 10. clicar numa barra abre o MODO TABELA com o mesmo número de nomes da barra;
     clicar num mês abre quem entrou e saiu naquele mês; Esc fecha
 11. celular (390 px): nada vaza para o lado
 12. toda tabela das páginas ordena pelo cabeçalho (número decrescente, inverte, 3º clique volta à
     ordem original linha por linha, texto A-Z, aria-sort), e a ordem fica depois da busca, do
     filtro e da troca de idioma, valendo para o conjunto inteiro (não só a página visível)
Rodar: pip install websocket-client  e depois  python tests/teste_dashboard.py
(sai com código 1 se algo falhar; fotos em tests/fotos/)
"""
import json, os, sys, pathlib
sys.stdout.reconfigure(encoding="utf-8")
sys.path.insert(0, os.path.dirname(__file__))
from cdp_util import Edge
from ordem_sonda import JS, confere, clicar, clicar_ate_limpar

RAIZ = pathlib.Path(__file__).resolve().parent.parent
URL = (RAIZ / "index.html").as_uri()
FOTOS = RAIZ / "tests" / "fotos"
FOTOS.mkdir(exist_ok=True)
falhas = []
# Nomes internos que não podem aparecer na tela. A lista mora num arquivo FORA do Git
# (tests/proibidos.txt, está no .gitignore), porque escrever os nomes aqui já seria publicá-los.
_LISTA = pathlib.Path(__file__).with_name("proibidos.txt")
PROIBIDOS = [l.strip() for l in _LISTA.read_text(encoding="utf-8").splitlines() if l.strip()] if _LISTA.exists() else []


def checa(nome, cond, detalhe=""):
    print(("OK    " if cond else "FALHA ") + nome + (f"  [{detalhe}]" if detalhe else ""))
    if not cond:
        falhas.append(nome)


def estado(ed, **m):
    m["paoliDemo"] = True
    ed.js(f"window.postMessage({json.dumps(m)}, '*')", espera=0.5)


with Edge(1440, 900) as ed:
    ed.ir(URL + "?aba=geral&lang=pt&tema=claro", espera=3)
    abas = ed.js("window.__demo ? ['geral','pessoas','rs'].concat(window.PAGINAS.ambiente ? ['ambiente'] : []) : []")
    # 1 e 6. todas as combinações
    for lang in ("pt", "en"):
        for tema in ("claro", "escuro"):
            for aba in abas:
                estado(ed, lang=lang, tema=tema, aba=aba)
                sem_chave = ed.js(r"!/\[[a-z_0-9]+\]/.test(document.body.innerText)")
                sem_trav = ed.js("!document.body.innerText.includes('—')")
                texto = ed.js("document.body.innerText + ' ' + document.title")
                nomes = [p for p in PROIBIDOS if p.lower() in texto.lower()]
                if not (sem_chave and sem_trav) or nomes:
                    checa(f"6. textos {lang}/{tema}/{aba}", False, f"chave ok={sem_chave} travessao ok={sem_trav} nomes internos={nomes}")
    checa(f"1. sem erro de JS em {len(abas) * 4} combinações", not ed.erros(), "; ".join(ed.erros()[:3]))
    checa("6. sem [chave] faltando, sem travessão e sem nome interno", not [f for f in falhas if f.startswith("6.")])

    # 2. cartão = conta
    estado(ed, lang="pt", tema="claro", aba="geral")
    tela = ed.js("document.querySelector('.heroi .h-num').textContent.trim()")
    conta = ed.js("String(window.__demo.r.hcFim)")
    checa("2. quadro na tela = quadro calculado", tela == conta, f"tela {tela} x conta {conta}")

    # 3. o "i" abre a conta
    estado(ed, aba="pessoas")
    ed.js("document.querySelector('[data-conta=turnover]').click()", espera=0.4)
    aberto = ed.js("!document.querySelector('.conta-pop').hidden && document.querySelector('.conta-pop .cp-formula').textContent.length > 20")
    checa("3. o i abre a conta por trás do número", bool(aberto))
    ed.js("document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}))", espera=0.2)

    # 4. filtro muda e Limpar volta
    estado(ed, aba="geral")
    antes = ed.js("window.__demo.r.hcFim")
    ed.js("var s=document.querySelector('[data-filtro=unidade]'); s.value='fab'; s.dispatchEvent(new Event('change',{bubbles:true}))", espera=0.4)
    com = ed.js("window.__demo.r.hcFim")
    ed.js("document.querySelector('[data-limpar]').click()", espera=0.4)
    depois = ed.js("window.__demo.r.hcFim")
    checa("4. filtro muda o número e Limpar volta", com < antes and depois == antes, f"{antes} -> {com} -> {depois}")

    # 5. busca
    estado(ed, aba="pessoas")
    total = ed.js("parseInt(document.querySelector('.tb-conta').textContent)")
    ed.js("var b=document.querySelector('[data-busca]'); b.focus(); b.value='Ana'; b.dispatchEvent(new Event('input',{bubbles:true}))", espera=0.4)
    filtrado = ed.js("parseInt(document.querySelector('.tb-conta').textContent)")
    foco = ed.js("document.activeElement && document.activeElement.matches('[data-busca]')")
    checa("5. busca filtra e mantém o foco", 0 < filtrado < total and foco, f"{total} -> {filtrado}, foco={foco}")

    # 7. por área soma o quadro
    estado(ed, aba="geral")
    soma = ed.js("[...document.querySelectorAll('#s-composicao .cartao:first-child .lb-val')].reduce((s,e)=>s+parseInt(e.textContent),0)")
    checa("7. 'por área' soma o quadro", soma == ed.js("window.__demo.r.hcFim"), f"soma {soma}")

    # 8. abas sem rolagem e filtros iguais
    abas_ok = ed.js("(function(n){const cs=getComputedStyle(n);return n.scrollHeight<=n.clientHeight+1 && n.scrollWidth<=n.clientWidth+1 && !/auto|scroll/.test(cs.overflowX+cs.overflowY)})(document.querySelector('.abas'))")
    larguras = ed.js("[...document.querySelectorAll('.filtros select')].map(s=>Math.round(s.getBoundingClientRect().width))")
    linha = ed.js("(function(){const f=document.querySelector('.filtros').getBoundingClientRect(), l=document.querySelector('[data-limpar]').getBoundingClientRect();return Math.round(f.right-l.right)})()")
    checa("8. abas sem rolagem e filtros do mesmo tamanho até o fim da linha", abas_ok and max(larguras) - min(larguras) <= 1 and abs(linha) <= 1, f"abas_ok={abas_ok} larguras={larguras} sobra_direita={linha}")

    # 9. trilho no fim da página
    ed.js("document.documentElement.style.scrollBehavior='auto'; window.scrollTo(0, document.documentElement.scrollHeight)", espera=0.5)
    ultima = ed.js("(function(){const b=[...document.querySelectorAll('.trilho button')];return b.length && b[b.length-1].classList.contains('ativo')})()")
    checa("9. no fim da página o trilho acende a última seção", bool(ultima))
    ed.js("window.scrollTo(0,0)", espera=0.3)

    # 10. modo tabela
    barra = ed.js("(function(){const l=document.querySelector('#s-composicao .lb-linha[data-drill]');l.click();return parseInt(l.querySelector('.lb-val').textContent)})()")
    ed.esperar(0.4)
    linhas = ed.js("document.querySelectorAll('.gaveta tbody tr').length")
    visivel = ed.js("!document.querySelector('.gaveta').hidden")
    ed.foto(str(FOTOS / "modo_tabela.png"))
    ed.js("document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}))", espera=0.3)
    fechou = ed.js("document.querySelector('.gaveta').hidden")
    mes = ed.js("(function(){const r=window.__demo.r; const s=r.serie.filter(x=>x.noPeriodo)[3]; const iso=s.fim.getFullYear()+'-'+String(s.fim.getMonth()+1).padStart(2,'0'); document.querySelector('.g-barras [data-drill=\"mes:'+iso+'\"]').dispatchEvent(new MouseEvent('click',{bubbles:true})); return s.entradas+s.saidas})()")
    ed.esperar(0.4)
    linhas_mes = ed.js("document.querySelectorAll('.gaveta tbody tr').length")
    ed.js("document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}))", espera=0.2)
    checa("10. barra abre o modo tabela com o mesmo número; mês abre entradas e saídas; Esc fecha",
          visivel and linhas == barra and fechou and linhas_mes == mes, f"barra {barra} x linhas {linhas}, mês {mes} x {linhas_mes}, fechou={fechou}")

    # 12. ordenar pelo cabeçalho, em TODA tabela das páginas (a do "Meu ambiente" é da outra bateria)
    estado(ed, lang="pt", tema="claro", aba="pessoas")
    def busca_ana():
        ed.js("var b=document.querySelector('[data-busca]'); b.value='Ana'; b.dispatchEvent(new Event('input',{bubbles:true}))", espera=0.4)
    ok_p, det_p = confere(ed, "#s-pessoas table", (6, "num"), 1, busca_ana)
    # a ordem vale para o conjunto INTEIRO (todas as páginas): 1º clique em Admissão = a admissão mais nova de todos na 1ª linha
    ed.js("var b=document.querySelector('[data-busca]'); b.value=''; b.dispatchEvent(new Event('input',{bubbles:true}))", espera=0.4)
    clicar(ed, "#s-pessoas table", 5)
    inteiro = ed.js("(function(){var m=Math.max(...window.__demo.r.ativosFim.map(p=>+new Date(p.admissao.getFullYear(),p.admissao.getMonth(),p.admissao.getDate())));"
                    "return window.__ord.val(document.querySelector('#s-pessoas tbody tr').cells[5].innerText,'data')===m && document.querySelector('.tb-pag .mono').textContent.trim().startsWith('1 /');})()")
    # a ordem sobrevive à troca de idioma: em inglês, as MESMAS pessoas na mesma sequência (o nome não traduz)
    nomes_pt = ed.js("[...document.querySelectorAll('#s-pessoas tbody tr')].map(r=>r.cells[0].innerText).join('|')")
    estado(ed, lang="en")
    ed.js(JS)
    idioma = ed.js("(function(){var r=window.__ord.ler('#s-pessoas table',5);return JSON.stringify(r.aria)==='[[5,\"descending\"]]';})()") and         ed.js("[...document.querySelectorAll('#s-pessoas tbody tr')].map(r=>r.cells[0].innerText).join('|')") == nomes_pt
    estado(ed, lang="pt")
    clicar_ate_limpar(ed, "#s-pessoas table", 5)
    estado(ed, aba="rs")
    def filtro_unidade():
        ed.js("var s=document.querySelector('[data-filtro=unidade]'); s.value='fab'; s.dispatchEvent(new Event('change',{bubbles:true}))", espera=0.5)
    ok_v, det_v = confere(ed, "#s-abertas table", (5, "num"), 1, filtro_unidade)
    ed.js("document.querySelector('[data-limpar]').click()", espera=0.4)
    estado(ed, aba="geral")
    ed.js("document.querySelector('[data-drill=todos]').click()", espera=0.5)
    def busca_gaveta():
        ed.js("var b=document.querySelector('[data-g-busca]'); b.value='a'; b.dispatchEvent(new Event('input',{bubbles:true}))", espera=0.4)
    ok_g, det_g = confere(ed, ".gaveta table", (6, "num"), 1, busca_gaveta)
    # linha clicável continua certa e a contagem do título não muda ao ordenar
    chip = ed.js("document.querySelector('.gaveta h2 .chip').textContent")
    clicar(ed, ".gaveta table", 6)
    chip2 = ed.js("document.querySelector('.gaveta h2 .chip').textContent")
    ed.js("document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}))", espera=0.3)
    # controle da sonda: acusa lista fora de ordem e aceita "R2" antes de "R10" com o vazio no fim
    controle12 = not ed.js("window.__ord.ok(['3','10','2'],'num',-1)") and bool(ed.js("window.__ord.ok(['R2','R10',''],'texto',1)")) and not ed.js("window.__ord.ok(['','b'],'texto',1)")
    checa("12. tabelas ordenam pelo cabeçalho (Colaboradores, Vagas abertas, modo tabela): número decrescente, inverte, 3º clique volta "
          "linha por linha, texto A-Z, aria-sort; ordem fica depois da busca/filtro e do idioma; vale para todas as páginas",
          ok_p and ok_v and ok_g and inteiro and idioma and chip == chip2 and controle12,
          f"{det_p} | {det_v} | {det_g} | conjunto inteiro={inteiro} idioma={idioma} contagem {chip}->{chip2} controle={controle12}")
    # foto de uma tabela ordenada (claro, 1440): Colaboradores por tempo de casa, maior primeiro
    estado(ed, lang="pt", tema="claro", aba="pessoas")
    clicar(ed, "#s-pessoas table", 6)
    ed.js("document.documentElement.style.scrollBehavior='auto'; document.getElementById('s-pessoas').scrollIntoView({block:'start'})", espera=0.4)
    ed.foto(str(FOTOS / "ordem_colaboradores.png"))

with Edge(390, 844) as ed:
    for aba in ("geral", "pessoas", "rs", "ambiente"):
        ed.ir(URL + f"?aba={aba}&lang=pt", espera=2.5)
        sw, iw = ed.js("[document.documentElement.scrollWidth, innerWidth]")
        # innerWidth tem de ser 390: se algo vazar, o navegador do celular afasta o zoom e a janela "cresce".
        if sw > iw or iw != 390:
            checa(f"11. celular sem vazamento lateral ({aba})", False, f"scroll {sw} / janela {iw}")
    checa("11. celular (390 px) sem vazamento lateral", not [f for f in falhas if f.startswith("11.")])

print("\nRESULTADO:", "TUDO OK" if not falhas else f"{len(falhas)} FALHA(S)")
sys.exit(1 if falhas else 0)
