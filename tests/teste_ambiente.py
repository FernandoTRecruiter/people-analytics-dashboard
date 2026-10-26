# -*- coding: utf-8 -*-
"""
teste_ambiente.py: bateria da aba "Meu ambiente" (bancada tests/ambiente_harness.html e o app).

O que prova (cada item imprime OK ou FALHA com o número que decidiu):
  0. contrato: PAGINAS mantém as outras abas e ganha "ambiente"; AMBIENTE.montar/desmontar existem
  1. sem erro de JavaScript em nenhuma etapa (bancada e app)
  2. a aba abre na Matriz; clicar na unidade aberta fecha o mapa; clicar de novo abre
  3. nº de bonecos = nº de pessoas com ponto aberto (3 horas x 3 unidades), regra recalculada em Python
  4. por unidade e por andar, ninguém fora da área permitida nas zonas restritas; nenhuma parede ou móvel atravessado
  5. uma pessoa por salinha (nos 2 andares da Matriz e nas outras unidades), e só o dono entra
  6. filtros de CATEGORIA e ÁREA: reduzem a tabela, acendem só as prateleiras certas, a contagem
     ao lado de cada opção = linhas ao escolhê-la; a área também acende as PESSOAS dela e apaga as outras
  7. clicar na linha pulsa a prateleira; clicar na prateleira filtra a tabela
  8. trocar idioma (desmontar + montar) guarda unidade, filtros, busca, hora, janelas e câmera; desmontar para a animação
  9. Remoto mostra a lista sem mapa; ?foto=1 dá o mesmo quadro em duas visitas
 10. textos sem [chave] e sem travessão (PT e EN), com controle plantado
 11. 390 px dentro do app: nada vaza para o lado e os botões da câmera ficam embaixo da planta
 12. sempre ao vivo: sem controles de reprodução; a hora da tela é a do visitante (presa ao horário comercial)
 13. página em segundo plano para a animação, e ela volta
 14. movimento reduzido: bonecos parados nos lugares (espera o relógio andar, sem depender da máquina)
 15. avisos, estoque recolhido, câmera e minimapa não cobrem peças da planta (3 plantas) + controle negativo
 16. clicar numa pessoa: a câmera gira para o melhor ângulo e aproxima; janela com retrato e 7 dados; Esc volta
 17. as 3 plantas são diferentes;  18. as prateleiras do inventário existem na planta da unidade
 19. no app, "Meu ambiente" é a PRIMEIRA aba e a padrão (na Matriz); ?aba=geral continua abrindo a Visão geral
 20. o estoque fica DENTRO do mapa, embaixo dos avisos; recolher deixa só o cabeçalho (o mapa usa a largura toda)
 21. câmera: aproximar, arrastar, roda do mouse, girar, planta, enquadrar, minimapa e camadas
 22. aba Atenção (dentro da janela do estoque): os baixos e zerados; clicar leva à linha e à prateleira
 23. (virou o 33)
 24. CD: Logística de analista para cima no escritório; operacional e técnico no galpão e nas docas
 25. Matriz em 2 andares: botão só na Matriz; no 2º andar só Diretoria, Financeiro, Pessoas & Cultura e
     Jurídico; o andar fora de foco fica transparente e não pega clique; quem chega sobe pela escada
 26. no escritório, quem está na mesa ou na sala aparece SENTADO (cadeira, sem pernas, tronco mais baixo)
 27. mouse em cima de uma pessoa: ela para (e volta a andar quando o mouse sai)
 28. arrastar o mapa não seleciona texto; o texto da tabela continua selecionável (controle)
 29. Histórico: resumo (bateram o ponto, presentes, saídas) e linhas = regra recalculada em Python; Esc fecha
 30. Fábrica: pátio com caminhões; clicar no caminhão abre os recebimentos; situação de cada um na hora;
     o item recebido mostra "Recebido hoje" e a quantidade somada (antes da chegada, não)
 32. barra do mapa numa linha só (camadas num menu); notas embaixo do mapa nascem fechadas
 33. tabela "Em turno": quem está na unidade e onde, busca, clicar foca; quem saiu aparece embaixo
 34. caminhão do pátio: entra, para na doca, sai; só depois do 1º recebimento; o rótulo diz o recebimento
 35. Matriz e Fábrica com contorno que não é retângulo; mesas com tampo e pé, cadeiras e piso com grade
 36. toda tabela da aba ordena pelo cabeçalho: Estoque, Atenção, Em turno, Expedição (A sair e Saíram),
     Histórico e Remoto (número/hora decrescente, inverte, 3º clique volta linha por linha, texto A-Z,
     aria-sort, contagem igual); a ordem fica depois do filtro, da busca, da troca de aba e do idioma
 31. idioma em TODAS as abas do app: em inglês nada em português (nem acento, nem número 4,2), em
     português nada em inglês (nem número 4.2); nomes próprios (pessoas, fornecedores) ficam de fora
Fotos em tests/fotos/, tiradas DENTRO do app: Matriz (1º e 2º andar), Fábrica com o histórico e
o pátio, e a Matriz a 390 px.
Rodar: pip install websocket-client  e depois  python tests/teste_ambiente.py
"""
import json, os, pathlib, re, sys, time
sys.stdout.reconfigure(encoding="utf-8", line_buffering=True)
sys.path.insert(0, os.path.dirname(__file__))
from cdp_util import Edge
from ordem_sonda import JS as JS_ORDEM, confere, clicar as clicar_ordem, ler as ler_ordem, em_ordem

RAIZ = pathlib.Path(__file__).resolve().parent.parent
URL = (RAIZ / "tests" / "ambiente_harness.html").as_uri()
URL_APP = (RAIZ / "index.html").as_uri()   # o app de verdade
FOTOS = RAIZ / "tests" / "fotos"
FOTOS.mkdir(exist_ok=True)
falhas = []


def checa(nome, cond, detalhe=""):
    print(("OK    " if cond else "FALHA ") + nome + (f"  [{detalhe}]" if detalhe else ""))
    if not cond:
        falhas.append(nome)


def abrir(ed, sufixo="", base=URL):
    """Navega e espera o CONTEÚDO (os botões de unidade), não um tempo fixo:
    o CSS das fontes do Google segura os scripts quando a rede está lenta."""
    ed.ir(base + sufixo, espera=0.5)
    t0 = time.time()
    while not ed.js("!!document.querySelector('[data-amb-un]')"):
        if time.time() - t0 > 90:
            raise RuntimeError("a aba não montou em 90 s")
        ed.esperar(0.4)


def clicar_el(ed, seletor):
    """Clique de MOUSE no centro do elemento, conferindo antes QUEM está por cima daquele ponto."""
    r = ed.js("(function(){var e=document.querySelector(%s); if(!e) return null; e.scrollIntoView({block:'center'});"
              "var b=e.getBoundingClientRect(), x=b.left+b.width/2, y=b.top+b.height/2, t=document.elementFromPoint(x,y);"
              "return [x, y, !!t && (t===e || e.contains(t))];})()" % json.dumps(seletor))
    if not r:
        raise RuntimeError("não achei " + seletor)
    if not r[2]:
        raise RuntimeError("outro elemento está por cima de " + seletor)
    ed.clicar(r[0], r[1])
    ed.esperar(0.25)


def clicar_peca(ed, seletor, chave):
    """Clique de mouse numa peça do desenho que vem em pedaços (prateleira, caminhão): vale qualquer
    pedaço, conferindo que o ponto clicado pertence MESMO àquela peça (o atributo "chave" bate)."""
    r = ed.js("(function(){var els=[...document.querySelectorAll(%s)]; for (var e of els) { e.scrollIntoView({block:'center'});"
              "var b=e.getBoundingClientRect(), x=b.left+b.width/2, y=b.top+b.height/2, t=document.elementFromPoint(x,y), d=t&&t.closest('['+%s+']');"
              "var a=e.closest('['+%s+']'); if (d && a && d.getAttribute(%s)===a.getAttribute(%s)) return [x,y]; } return null;})()"
              % (json.dumps(seletor), json.dumps(chave), json.dumps(chave), json.dumps(chave), json.dumps(chave)))
    if not r:
        raise RuntimeError("nenhum ponto livre de " + seletor)
    ed.clicar(r[0], r[1])
    ed.esperar(0.25)


def clicar_prat(ed, cod):
    clicar_peca(ed, f"[data-cod={cod}] .amb-t", "data-cod")


def escolher(ed, u):
    """Abre a unidade u. O botão é de ALTERNÂNCIA: clicar na que já está aberta fecha o mapa."""
    if ed.js("(document.querySelector('.amb-un.ativa')||{dataset:{}}).dataset.ambUn || ''") != u:
        clicar_el(ed, f"[data-amb-un={u}]")


def filtro(ed, campo, valor):
    """Escolhe uma opção numa lista de filtro (é o que o navegador faz quando a pessoa escolhe)."""
    ed.js("(function(){var s=document.querySelector('[data-amb-f=%s]'); s.value=%s; s.dispatchEvent(new Event('change',{bubbles:true}));})()"
          % (campo, json.dumps(valor)), espera=0.15)


def hora(ed, minuto, natural=False):
    """Põe o relógio numa hora fixa (o mapa é sempre ao vivo; o teste precisa de hora conhecida)."""
    ed.js(f"AMBIENTE._teste.irPara({minuto}, {'true' if natural else 'false'})", espera=0.1)


def camera_parada(ed, limite=4):
    """Espera a câmera terminar de andar (a animação dura ~0,6 s) antes de medir."""
    t0 = time.time()
    while ed.js("AMBIENTE._teste.cam().animando") and time.time() - t0 < limite:
        ed.esperar(0.1)
    return json.loads(ed.js("JSON.stringify(AMBIENTE._teste.cam())"))


def arrastar(ed, x0, y0, x1, y1, passos=8):
    """Arrasto de mouse de verdade (apertar, mover em passos, soltar)."""
    ed.cmd("Input.dispatchMouseEvent", type="mousePressed", x=x0, y=y0, button="left", clickCount=1)
    for k in range(1, passos + 1):
        ed.cmd("Input.dispatchMouseEvent", type="mouseMoved", x=x0 + (x1 - x0) * k / passos, y=y0 + (y1 - y0) * k / passos, button="left", buttons=1)
    ed.cmd("Input.dispatchMouseEvent", type="mouseReleased", x=x1, y=y1, button="left", clickCount=1)
    ed.esperar(0.2)


def esperado(marcacoes, unidade, minuto):
    """A regra do mapa, escrita de novo em Python: bateu a entrada e ainda não bateu a saída."""
    return sum(1 for m in marcacoes if m["unidade"] == unidade and not m["ausente"] and m["entrada"] <= minuto
               and (m["saida"] is None or minuto < m["saida"]))


def foto_inteira(ed, saida):
    alt = min(ed.js("document.documentElement.scrollHeight"), 9000)
    w, h = ed.w, ed.h
    ed.tamanho(w, alt)
    ed.esperar(0.8)
    ed.foto(str(saida))
    ed.tamanho(w, h)
    ed.esperar(0.3)


# Retângulo de cada janela sobre o mapa contra o retângulo de cada peça da planta (o que a pessoa VÊ).
SOBREPOE = r"""(function(){
  var notas = [...document.querySelectorAll('.amb-est, .amb-cam, .amb-minimapa')].filter(e => getComputedStyle(e).display !== 'none');
  var alvos = [...document.querySelectorAll('.amb-prat, .amb-mesa, .amb-mesa-sala, .amb-impressora, .amb-cafe, .amb-mesa-copa, .amb-mesa-reuniao, .amb-ponto, ' +
    '.amb-esteira, .amb-maquina, .amb-bancada, .amb-armario, .amb-palete, .amb-empilhadeira, .amb-carreta, .amb-cabine, .amb-escada, .amb-rotulo, .amb-cod')];
  var n = 0, ex = [];
  notas.forEach(function (nt) { var a = nt.getBoundingClientRect();
    alvos.forEach(function (al) { var b = al.getBoundingClientRect();
      var x = Math.min(a.right, b.right) - Math.max(a.left, b.left), y = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (x > 2 && y > 2) { n++; if (ex.length < 3) ex.push(nt.className + ' x ' + al.getAttribute('class')); } }); });
  return JSON.stringify({ janelas: notas.length, alvos: alvos.length, n: n, ex: ex });
})()"""

TEXTOS = r"""(function(){var t=document.querySelector('#ambiente-raiz').innerText;
  return [/\[[a-z_0-9]+\]/.test(t), t.includes(String.fromCharCode(8212))];})()"""

# Tudo o que aparece na tela: texto, dicas (title, data-tip), rótulos de leitor de tela, placeholders,
# opções das listas e textos do desenho. As iniciais do avatar ("JS") não são palavra: ficam de fora.
COLETA = r"""(function(){
  var ini = [...document.querySelectorAll('.avatar-mini')]; ini.forEach(function(e){ e.style.display = 'none'; });
  var t = [document.title, document.body.innerText];
  ini.forEach(function(e){ e.style.display = ''; });
  document.querySelectorAll('[title],[aria-label],[placeholder],[data-tip],[alt]').forEach(function(e){ if (e.closest('[hidden]')) return;
    ['title','aria-label','placeholder','data-tip','alt'].forEach(function(a){ var v = e.getAttribute(a); if (v) t.push(v); }); });
  document.querySelectorAll('option, svg text').forEach(function(o){ if (!o.closest('[hidden]')) t.push(o.textContent); });
  return t.join('\n');
})()"""
# Palavras que denunciam a outra língua (inteiras, sem diferença de maiúscula).
PALAVRAS_PT = ["de", "da", "das", "dos", "em", "nos", "nas", "sem", "para", "por", "não", "mais", "até", "ao", "aos", "às", "que", "uma",
               "pessoas", "unidade", "área", "saída", "saídas", "entrada", "entradas", "estoque", "andar", "mapa", "hoje", "agora", "horário",
               "histórico", "recebido", "previsto", "atrasado", "fábrica", "matriz", "galpão", "depósito", "escritório", "vaga", "vagas",
               "meses", "anos", "dias", "todos", "todas", "limpar", "buscar", "fechar", "período", "quadro", "nível", "vínculo", "gênero",
               "mulheres", "homens", "contratação", "contratações", "idioma", "seções", "tema", "fev", "abr", "mai", "dez"]
# "Dashboard" (nome do produto, pedido por ele) e "turnover" (termo que o RH usa no Brasil) valem nas duas línguas.
PALAVRAS_EN = ["the", "of", "and", "with", "without", "view", "site", "stock", "storage", "open space", "office", "warehouse",
               "headcount", "overview", "people", "hiring", "recruiting", "yard", "dock", "docks", "floor", "layers", "labels",
               "search", "clear", "close", "history", "live", "delivery", "deliveries", "received", "due", "late", "status", "demo", "ok",
               "wc", "admin", "level", "unit", "rate", "net", "joins", "exits", "hires", "vacancy", "vacancies", "download", "time to fill"]
ACENTO = re.compile(r"[À-ÖØ-öø-ÿºª]")   # letras com acento e º/ª (× e ÷ ficam de fora)


def achados_idioma(lang, txt, nomes):
    """Devolve os trechos que denunciam a outra língua (com 35 caracteres de contexto)."""
    for n in nomes:
        txt = txt.replace(n, " ")
    ctx = lambda m: repr(txt[max(0, m.start() - 35):m.end() + 20])
    out = []
    if lang == "en":
        out += ["acento " + ctx(m) for m in ACENTO.finditer(txt)]
        out += ["número 4,2 " + ctx(m) for m in re.finditer(r"\d,\d{1,2}(?!\d)", txt)]
        pal = PALAVRAS_PT
    else:
        out += ["número 4.2 " + ctx(m) for m in re.finditer(r"\d\.\d{1,2}(?!\d)", txt)]
        pal = PALAVRAS_EN
    for w in pal:
        out += [f"'{w}' " + ctx(m) for m in re.finditer(r"(?<![\w-])" + re.escape(w) + r"(?![\w-])", txt, re.I)]
    return out


with Edge(1440, 900) as ed:
    abrir(ed, "?lang=pt&tema=claro")
    marc = json.loads(ed.js("JSON.stringify(AMBIENTE_DADOS.marcacoes)"))
    print(f"(janela {ed.js('innerWidth')}x{ed.js('innerHeight')}, {len(marc)} marcações)")
    checa("0. contrato: PAGINAS mantém geral/pessoas/rs e ganha ambiente",
          ed.js("['geral','pessoas','rs','ambiente'].every(k => typeof PAGINAS[k] === 'function') && typeof AMBIENTE.montar === 'function' && typeof AMBIENTE.desmontar === 'function'"))

    # 12. sempre ao vivo (antes de qualquer hora fixa)
    r12 = json.loads(ed.js("JSON.stringify({controles: document.querySelectorAll('[data-amb-regua], [data-amb-vel], [data-amb-acao], input[type=range]').length, "
                           "hora: document.querySelector('[data-amb-hora]').textContent, ponto: !!document.querySelector('.amb-vivo-ponto.on'), "
                           "hist: document.querySelectorAll('.amb-bt-hist').length, est: AMBIENTE._teste.estado()})"))
    agora = ed.js("(function(){var d=new Date(), m=d.getHours()*60+d.getMinutes(); return (m<420||m>1140) ? 630 : m;})()")
    h12, m12 = (int(x) for x in r12["hora"].split(":"))
    checa("12. sempre ao vivo: sem Ao vivo/Pausar/velocidade/régua; a hora da tela é a do visitante (presa ao horário comercial); botão Histórico",
          r12["controles"] == 0 and r12["ponto"] and r12["hist"] == 1 and abs(h12 * 60 + m12 - agora) <= 1 and not r12["est"]["fixo"],
          f"controles {r12['controles']}; tela {r12['hora']} x agora {agora // 60:02d}:{agora % 60:02d}; ponto aceso={r12['ponto']}")

    # 32. notas fechadas por padrão (a página acabou de abrir)
    n32 = ed.js("[document.querySelectorAll('.amb-nota').length, document.querySelectorAll('.amb-nota-q').length]")
    checa("32. as janelinhas embaixo do mapa nascem fechadas (a pessoa abre)", n32 == [0, 4], f"abertas {n32[0]}, botões {n32[1]}")

    # 35. contorno que não é retângulo e móveis mais detalhados
    v35 = json.loads(ed.js("""JSON.stringify(['mat','fab','cd'].map(function(u){ var P=AMBIENTE_DADOS.plantas[u], v=0;
      var lw=Math.max.apply(null,P.zonas.map(function(z){return z.x1;})), lh=Math.max.apply(null,P.zonas.map(function(z){return z.y1;}));
      for (var x=0.5;x<lw;x++) for (var y=0.5;y<lh;y++) if (!P.zonas.some(function(z){return x>z.x0&&x<z.x1&&y>z.y0&&y<z.y1;})) v++;
      return v; }))"""))
    d35 = json.loads(ed.js("JSON.stringify({impressora: document.querySelectorAll('.amb-impressora').length + (document.body.innerText.match(/IMPRESSORA/i) || []).length, grade: document.querySelectorAll('.amb-grade').length, cadeiras: document.querySelectorAll('.amb-cx.amb-cadeira').length, pes: document.querySelectorAll('.amb-cx.amb-pe-mesa').length})"))
    # nenhum rótulo (zona ou código de estante) com a caixa por cima de outro, nas 3 unidades, zoom padrão
    SOBRE_ROT = r"""(function(){ var r=[...document.querySelectorAll('.amb-svg .amb-rotulo, .amb-svg .amb-cod')].filter(e => e.checkVisibility({visibilityProperty: true}) && getComputedStyle(e).display !== 'none')
      .map(e => [e.textContent, e.getBoundingClientRect()]), n=[];
      for (var i=0;i<r.length;i++) for (var j=i+1;j<r.length;j++) { var a=r[i][1], b=r[j][1];
        if (Math.min(a.right,b.right)-Math.max(a.left,b.left) > 1 && Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top) > 1) n.push(r[i][0]+' x '+r[j][0]); }
      return JSON.stringify({rotulos: r.length, n: n});})()"""
    rot35 = {}
    for u in ("fab", "cd", "mat"):
        escolher(ed, u)
        camera_parada(ed)
        rot35[u] = json.loads(ed.js(SOBRE_ROT))
    checa("35b. nenhum rótulo cobre outro (zonas e códigos de estante), nas 3 unidades, no zoom padrão",
          all(not v["n"] and v["rotulos"] > 5 for v in rot35.values()), " | ".join(f"{u}: {v['rotulos']} rótulos, sobrepostos {v['n'][:4]}" for u, v in rot35.items()))
    checa("35. as 3 plantas com contorno que não é retângulo; sem impressora (peça irrelevante) (células sem piso); piso do escritório com grade, mesas com pé, cadeiras",
          v35[0] > 0 and v35[1] > 0 and v35[2] > 0 and d35["impressora"] == 0 and d35["grade"] > 20 and d35["cadeiras"] > 100 and d35["pes"] > 20, f"células sem piso mat/fab/cd {v35}; {d35}")

    # 2. abre na Matriz; alternância fecha e abre
    na_matriz = ed.js("!!document.querySelector('.amb-svg') && document.querySelector('[data-amb-un=mat]').getAttribute('aria-pressed')==='true'")
    clicar_el(ed, "[data-amb-un=mat]")
    fechou = ed.js("!!document.querySelector('.amb-svg') && !document.querySelector('.amb-convite')")   # clicar na aberta não fecha
    abriu = ed.js("!!document.querySelector('.amb-svg') && document.querySelector('.amb-svg').getBoundingClientRect().width > 300")
    checa("2. abre na Matriz; clicar na unidade aberta não fecha nada (sempre uma unidade aberta)", na_matriz and fechou and abriu,
          f"matriz={na_matriz} fechou={fechou} abriu={abriu}")

    # 15. nas 3 plantas, nada que flutua sobre o mapa cobre peça da planta (vista inteira, janela recolhida: é o padrão)
    janela_fechada = ed.js("!AMBIENTE._teste.estado().estoque && document.querySelector('.amb-est-corpo').hidden")
    r15 = {}
    for u in ("mat", "fab", "cd"):
        escolher(ed, u)
        camera_parada(ed)
        r15[u] = json.loads(ed.js(SOBREPOE))
    checa("15. avisos, estoque recolhido, câmera e minimapa não cobrem peças da planta (3 plantas)",
          janela_fechada and all(r["janelas"] >= 3 and r["alvos"] > 100 and r["n"] == 0 for r in r15.values()),
          " | ".join(f"{u}: {r['janelas']} janelas x {r['alvos']} peças, {r['n']} sobreposições {r['ex']}" for u, r in r15.items()))
    # controle negativo: a coluna de avisos e estoque levada para o meio do mapa TEM de acusar
    ed.js("document.querySelector('.amb-lateral').style.cssText='left:35%;top:35%;right:auto'")
    neg = json.loads(ed.js(SOBREPOE))
    ed.js("document.querySelector('.amb-lateral').style.cssText=''")
    checa("15. (controle) a mesma sonda acusa a janela posta no meio do mapa", neg["n"] > 0, f"{neg['n']} sobreposições")
    escolher(ed, "mat")
    clicar_el(ed, "[data-amb-est-alterna]")   # estoque aberto de novo
    camera_parada(ed)

    # 3. bonecos = ponto aberto (hora fixa: o relógio ao vivo anda sozinho)
    linhas3 = []
    for u in ("mat", "fab", "cd"):
        escolher(ed, u)
        for minuto in (480, 630, 1050):
            hora(ed, minuto)
            tela, cab = ed.js("[[...document.querySelectorAll('.amb-boneco')].filter(e=>e.isConnected).length, +document.querySelector('[data-amb-n]').textContent]")
            esp = esperado(marc, u, minuto)
            linhas3.append(f"{u} {minuto // 60:02d}:{minuto % 60:02d} tela={tela} cab={cab} regra={esp}")
            if not (tela == esp == cab and esp > 0):
                checa(f"3. bonecos = ponto aberto ({u} {minuto})", False, linhas3[-1])
    print("   " + " | ".join(linhas3))
    checa("3. nº de bonecos = nº com ponto aberto (9 medições)", not [f for f in falhas if f.startswith("3.")])

    # 4 e 5. cena de 60 s por unidade: zonas restritas, salas, paredes e móveis, cada um no SEU andar
    CENA = r"""(function(){
      var T = AMBIENTE._teste, P0 = AMBIENTE_DADOS.plantas[T.estado().unidade], ant = {}, obs = 0, zonas = {}, sala = 0, viol = [], trocas = 0;
      var PD = function (a) { return a === 2 ? P0.andar2 : P0; }, ANDAR2 = ['dir', 'fin', 'pes', 'jur'];
      function cruza(p, q, w) { var x0=w[0], y0=w[1], x1=w[2], y1=w[3], t, c;
        if (y0 === y1) { if ((p.y-y0)*(q.y-y0) > 0 || p.y === q.y) return false; t=(y0-p.y)/(q.y-p.y); c=p.x+t*(q.x-p.x); return c > Math.min(x0,x1)-.02 && c < Math.max(x0,x1)+.02; }
        if ((p.x-x0)*(q.x-x0) > 0 || p.x === q.x) return false; t=(x0-p.x)/(q.x-p.x); c=p.y+t*(q.y-p.y); return c > Math.min(y0,y1)-.02 && c < Math.max(y0,y1)+.02; }
      [P0, P0.andar2].forEach(function (P) { if (P) P.restritas.forEach(function (r) { zonas[r.id] = 0; }); });
      for (var i = 0; i < 1800; i++) {
        T.avancar(1/30);
        T.bonecos().forEach(function (b) {
          obs++;
          var P = PD(b.andar);
          P.restritas.forEach(function (r) {
            if (b.x > r.x0 && b.x < r.x1 && b.y > r.y0 && b.y < r.y1) { zonas[r.id]++; if (r.areas.indexOf(b.area) < 0) viol.push(r.id + ': ' + b.id + ' é ' + b.area); }
          });
          P.lugares.sala.forEach(function (s) {
            var q = s.ret; if (b.x > q[0] && b.x < q[2] && b.y > q[1] && b.y < q[3]) { sala++; if (!(b.tipo === 'sala' && b.sala === s.sala && b.casaAndar === b.andar)) viol.push('sala ' + b.andar + '-' + s.sala + ': ' + b.id); }
          });
          if (b.andar === 2 && ANDAR2.indexOf(b.area) < 0) viol.push('2º andar: ' + b.id + ' é ' + b.area);
          var a = ant[b.id];
          if (a && a.andar === b.andar) P.paredes.forEach(function (w) { if (cruza(a, b, w)) viol.push('parede ' + b.id + ' ' + JSON.stringify(w)); });
          else if (a) trocas++;
          P.moveis.forEach(function (m) { if (m.tipo !== 'cadeira' && m.tipo !== 'pintura' && b.x > m.x0+.02 && b.x < m.x1-.02 && b.y > m.y0+.02 && b.y < m.y1-.02) viol.push('movel ' + m.tipo + ' ' + b.id); });
          ant[b.id] = { x: b.x, y: b.y, andar: b.andar };
        });
      }
      return JSON.stringify({ obs: obs, zonas: zonas, sala: sala, trocas: trocas, n: viol.length, ex: viol.slice(0, 4) });
    })()"""
    SALAS = "(function(){var s={}; document.querySelectorAll('.amb-boneco[data-sala]').forEach(e=>{s[e.dataset.sala]=(s[e.dataset.sala]||0)+1}); return JSON.stringify(s);})()"
    res4, salas = {}, {}
    for u in ("cd", "fab", "mat"):
        escolher(ed, u)
        hora(ed, 630)
        salas[u] = json.loads(ed.js(SALAS))
        res4[u] = json.loads(ed.js(CENA))
    for u, r in res4.items():
        print(f"   {u}: {r['obs']} posições; dentro de zona restrita {r['zonas']}; {r['sala']} dentro de salas; {r['n']} violações")
    viol = sum(r["n"] for r in res4.values())
    olhou = res4["cd"]["zonas"]["galpao"] > 0 and all(res4["fab"]["zonas"][z] > 0 for z in ("producao", "manutencao", "almox", "anexo")) and res4["cd"]["zonas"]["patio"] == 0
    checa("4. por unidade e por andar, ninguém fora da área permitida nas zonas restritas (pátio: ninguém); nenhuma parede ou móvel atravessado (60 s x 3)",
          viol == 0 and olhou and res4["fab"]["zonas"]["patio"] == 0, "; ".join(sum((r["ex"] for r in res4.values()), []))
          or ("todas as zonas com gente permitida foram ocupadas" if olhou else "a sonda não viu ninguém em alguma zona"))
    andares_sala = {k.split("-")[0] for k in salas["mat"]}
    checa("5. uma pessoa por salinha nas 3 unidades e nos 2 andares da Matriz (10:30), e só o dono entra",
          all(s and all(v == 1 for v in s.values()) for s in salas.values()) and all(res4[u]["sala"] > 0 for u in res4) and andares_sala == {"1", "2"},
          " | ".join(f"{u}: {salas[u]}" for u in salas))

    # 24. CD: Logística de analista para cima no escritório; operacional e técnico no galpão
    escolher(ed, "cd")
    hora(ed, 630)
    cd = json.loads(ed.js("JSON.stringify(AMBIENTE._teste.bonecos().map(b => [b.nivel, b.tipo]))"))
    ofic = [t for n, t in cd if n in ("ana", "esp", "coo")]
    galp = [t for n, t in cd if n in ("apr", "est", "ope", "tcn")]
    checa("24. CD: Logística de analista para cima senta no escritório; operacional e técnico no galpão e nas docas",
          ofic and all(t == "mesa" for t in ofic) and galp and all(t == "galpao" for t in galp),
          f"{len(ofic)} no escritório ({set(ofic)}), {len(galp)} no galpão ({set(galp)})")

    # 17 e 18. plantas diferentes; prateleiras do inventário existem na planta da unidade
    ASSINA = r"""(function(){
      var s = document.querySelector('.amb-svg'), conta = function (c) { return s.querySelectorAll(c).length; };
      var cods = [...new Set([...s.querySelectorAll('[data-cod]')].map(e => e.getAttribute('data-cod')))];
      var inv = [...new Set([...document.querySelectorAll('tr[data-amb-item]')].map(t => t.dataset.prat))];
      return JSON.stringify({ planta: s.getAttribute('data-planta'), mesas: conta('.amb-mesa'), esteiras: conta('.amb-esteira'), bancadas: conta('.amb-bancada'),
        docas: conta('.amb-piso-doca'), estantes: cods.filter(c => c[0] === 'R').length, prateleiras: cods.filter(c => c[0] === 'P').length,
        patio: conta('.amb-piso-patio'), caminhoes: conta('.amb-carreta') && conta('.amb-cabine') ? 1 : 0, andares: conta('.amb-andar'),
        tamanho: s.innerHTML.length, faltam: inv.filter(c => cods.indexOf(c) < 0), usadas: inv.length });
    })()"""
    ass = {}
    for u in ("mat", "fab", "cd"):
        escolher(ed, u)
        ass[u] = json.loads(ed.js(ASSINA))
    sinal = {u: (a["planta"], a["mesas"], a["esteiras"], a["bancadas"], a["docas"], a["estantes"], a["prateleiras"], a["patio"], a["andares"]) for u, a in ass.items()}
    papel = (ass["mat"]["esteiras"] == 0 and ass["fab"]["esteiras"] > 0 and ass["fab"]["bancadas"] > 0 and ass["cd"]["docas"] == 4
             and ass["cd"]["estantes"] > ass["mat"]["estantes"] and ass["fab"]["mesas"] < ass["mat"]["mesas"]
             and ass["fab"]["patio"] == 1 and ass["fab"]["caminhoes"] == 1 and ass["mat"]["patio"] == 0
             and ass["mat"]["andares"] == 2 and ass["fab"]["andares"] == 1 and ass["cd"]["andares"] == 1)
    checa("17. as 3 plantas são diferentes (Matriz em 2 andares, fábrica com linhas, bancadas e pátio com caminhões, CD com mais estantes e docas)",
          len(set(sinal.values())) == 3 and len({a["tamanho"] for a in ass.values()}) == 3 and papel, " | ".join(f"{u}={s}" for u, s in sinal.items()))
    checa("18. as prateleiras do inventário de cada unidade existem na planta dela", all(not a["faltam"] and a["usadas"] > 0 for a in ass.values()),
          " | ".join(f"{u}: {a['usadas']} usadas, faltam {a['faltam']}" for u, a in ass.items()))

    # 25. Matriz em 2 andares
    botoes = {}
    for u in ("fab", "cd", "mat"):
        escolher(ed, u)
        botoes[u] = ed.js("document.querySelectorAll('[data-amb-andar]').length")
    hora(ed, 630)
    bon = json.loads(ed.js("JSON.stringify(AMBIENTE._teste.bonecos())"))
    ANDAR2 = {"dir", "fin", "pes", "jur"}
    certo_reg = bon and all((b["casaAndar"] == 2) == (b["area"] in ANDAR2) for b in bon) and any(b["casaAndar"] == 2 for b in bon)
    OPAC = ("JSON.stringify([1,2].map(n => { var g = document.querySelector('.amb-andar[data-andar=\"' + n + '\"]'), cs = getComputedStyle(g); "
            "return [+cs.opacity, cs.pointerEvents]; }).concat([document.querySelector('[data-amb-quadro]').dataset.andarFoco, "
            "!!document.querySelector('.amb-mini .amb-piso-reuniao'), getComputedStyle(document.querySelector('.amb-andar')).transitionDuration]))")
    o1 = json.loads(ed.js(OPAC))
    clicar_el(ed, "[data-amb-andar='2']")
    ed.esperar(0.6)
    o2 = json.loads(ed.js(OPAC))
    clicar_peca(ed, "[data-amb-escada] .amb-t", "data-amb-escada")   # a escada do 2º andar leva ao 1º
    esc1 = ed.js("AMBIENTE._teste.estado().andar")
    clicar_peca(ed, "[data-amb-escada] .amb-t", "data-amb-escada")   # e a do 1º leva ao 2º
    esc2 = ed.js("AMBIENTE._teste.estado().andar")
    cor = ed.js("[getComputedStyle(document.querySelector('[data-amb-andar].ativo')).backgroundColor, getComputedStyle(document.querySelector('[data-amb-modo].ativo')).backgroundColor]")
    clicar_el(ed, "[data-amb-andar='1']")
    ed.esperar(0.5)
    # quem chega do 2º andar entra pelo térreo e sobe pela escada
    pid, ent = ed.js("(function(){var A=AMBIENTE_DADOS, s=new Set(['dir','fin','pes','jur']); var m=A.marcacoes.filter(m=>m.unidade==='mat'&&!m.ausente&&s.has(A.pessoaPorId[m.id].area))"
                     ".sort((a,b)=>a.entrada-b.entrada)[0]; return [m.id, m.entrada];})()")
    hora(ed, ent - 1)
    hora(ed, ent, natural=True)
    BON = f"JSON.stringify(AMBIENTE._teste.bonecos().find(b=>b.id==='{pid}'))"
    s0 = json.loads(ed.js(BON))
    ed.js("AMBIENTE._teste.avancar(45)")
    s1 = json.loads(ed.js(BON))
    hora(ed, 630)
    certo25 = (botoes == {"fab": 0, "cd": 0, "mat": 2} and certo_reg and o1[0][0] == 1 and o1[1][0] < 0.3 and o1[1][1] == "none" and o1[2] == "1"
               and o2[1][0] == 1 and o2[0][0] < 0.4 and o2[0][1] == "none" and o2[2] == "2" and o2[3] and not o1[3] and o1[4] not in ("0s", "")
               and s0["andar"] == 1 and s0["subir"] and s1["andar"] == 2 and not s1["subir"] and esc1 == 1 and esc2 == 2 and cor[0] != cor[1])
    checa("25. Matriz em 2 andares: botão só na Matriz; 2º andar só com Diretoria, Financeiro, P&C e Jurídico; o andar fora de foco transparente e sem clique (com transição); quem chega sobe pela escada; clicar na escada troca de andar; o botão do andar tem cor de destaque",
          certo25, f"escada: 2->{esc1}->{esc2}; cores andar x vista {cor}; botões {botoes}; regra de andar ok={certo_reg} ({sum(1 for b in bon if b['casaAndar'] == 2)} no 2º); foco 1: {o1}; foco 2: {o2}; "
          f"{pid} às {ent // 60:02d}:{ent % 60:02d}: andar {s0['andar']} subindo={s0['subir']} -> andar {s1['andar']}")

    # 26. sentados no escritório (20 s de cena: uns levantam para a copa ou o banheiro e ficam em pé)
    ed.js("AMBIENTE._teste.avancar(20)")
    s26 = json.loads(ed.js("(function(){var bs=AMBIENTE._teste.bonecos(), sent=bs.filter(b=>b.sentado), el=document.querySelector('.amb-boneco.sentado');"
                           "return JSON.stringify({n: sent.length, tipos: [...new Set(sent.map(b=>b.tipo))], dom: document.querySelectorAll('.amb-boneco.sentado').length,"
                           "cadeira: document.querySelectorAll('.amb-svg .amb-cx.amb-cadeira').length, calca: el ? getComputedStyle(el.querySelector('.amb-calca')).display : '',"
                           "tronco: el ? getComputedStyle(el.querySelector('.amb-tronco')).transform : '', emPe: bs.filter(b=>b.tipo==='galpao' && b.sentado).length,"
                           "andando: bs.filter(b=>b.anda && b.sentado).length, emPeN: bs.filter(b=>!b.sentado).length, "
                           "calcaEmPe: (function(){var e=document.querySelector('.amb-boneco:not(.sentado) .amb-calca'); return e ? getComputedStyle(e).display : '';})()});})()"))
    escolher(ed, "fab")
    hora(ed, 630)
    f26 = json.loads(ed.js("JSON.stringify(AMBIENTE._teste.bonecos().filter(b=>b.sentado).reduce((a,b)=>{a[b.tipo]=(a[b.tipo]||0)+1; return a;},{}))"))
    escolher(ed, "mat")
    checa("26. no escritório, quem está na mesa ou na sala aparece sentado (cadeira, sem pernas, tronco mais baixo); andando, na linha, na manutenção e no almoxarifado, em pé",
          s26["n"] > 10 and set(s26["tipos"]) <= {"mesa", "sala"} and s26["dom"] == s26["n"] and s26["cadeira"] > 100 and s26["calca"] == "none"
          and s26["tronco"] not in ("none", "") and s26["emPe"] == 0 and s26["andando"] == 0 and s26["emPeN"] > 0 and s26["calcaEmPe"] != "none"
          and set(f26) <= {"mesa", "sala"} and sum(f26.values()) > 0, json.dumps(s26) + " | fábrica sentados " + json.dumps(f26))

    # 27. mouse em cima congela a pessoa
    # Quase ninguém levanta agora: quem acaba de bater o ponto anda da porta até o lugar (é quem pega o mouse).
    ent27 = ed.js("(function(){var A=AMBIENTE_DADOS, s=new Set(['dir','fin','pes','jur']); return A.marcacoes.filter(m=>m.unidade==='mat'&&!m.ausente&&!s.has(A.pessoaPorId[m.id].area)&&m.entrada>480).map(m=>m.entrada).sort((a,b)=>a-b)[0];})()")
    hora(ed, 489)
    hora(ed, 492, natural=True)   # 08:09 -> 08:12: quem bateu o ponto nesses 3 minutos nasce na porta e anda
    alvo27 = ed.js("""(function(){ var T=AMBIENTE._teste; T.avancar(6);
      var todos = T.bonecos(), bs = todos.filter(b => b.anda && b.naTela && b.andar === 1 &&
        !todos.some(o => o.id !== b.id && o.andar === b.andar && Math.hypot(o.x - b.x, o.y - b.y) < 1.5));   // sozinho: ninguém passa na frente dele
      for (var b of bs) { var e = document.querySelector('.amb-boneco[data-id="' + b.id + '"] .amb-alvo'); if (!e) continue; e.scrollIntoView({block: 'center'});
        var r = e.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2, t = document.elementFromPoint(x, y);
        if (t && t.closest('.amb-boneco') && t.closest('.amb-boneco').dataset.id === b.id) return [b.id, x, y]; }
      return null; })()""")
    if alvo27:
        bid, bx, by = alvo27
        B27 = f"JSON.stringify(AMBIENTE._teste.bonecos().find(b=>b.id==='{bid}'))"
        ed.cmd("Input.dispatchMouseEvent", type="mouseMoved", x=bx, y=by)
        ed.esperar(0.2)
        p1 = json.loads(ed.js(B27))
        ed.js("AMBIENTE._teste.avancar(2)")
        p2 = json.loads(ed.js(B27))
        canto = ed.js("(function(){var r=document.querySelector('[data-amb-quadro]').getBoundingClientRect(); return [r.left+6, r.top+6];})()")
        ed.cmd("Input.dispatchMouseEvent", type="mouseMoved", x=canto[0], y=canto[1])
        ed.esperar(0.2)
        p3 = json.loads(ed.js(B27))
        ed.js("AMBIENTE._teste.avancar(1.5)")
        p4 = json.loads(ed.js(B27))
        certo27 = p1["parado"] and (p1["x"], p1["y"]) == (p2["x"], p2["y"]) and not p3["parado"] and (p4["x"], p4["y"]) != (p3["x"], p3["y"])
        detalhe27 = f"{bid}: com o mouse parado={p1['parado']}, andou {abs(p2['x'] - p1['x']) + abs(p2['y'] - p1['y']):.3f} em 2 s; sem o mouse parado={p3['parado']}, andou {abs(p4['x'] - p3['x']) + abs(p4['y'] - p3['y']):.2f}"
    else:
        certo27, detalhe27 = False, "nenhuma pessoa andando livre para pôr o mouse"
    checa("27. mouse em cima de uma pessoa: ela para; o mouse sai, ela volta a andar", certo27, detalhe27)
    hora(ed, 630)

    # 28. arrastar o mapa não seleciona texto (do mapa para cima, passando pela barra de controles)
    ed.js("getSelection().removeAllRanges()")
    q28 = ed.js("(function(){var r=document.querySelector('[data-amb-quadro]').getBoundingClientRect(); return [r.left+r.width*0.3, r.top+60, r.left+r.width*0.12];})()")
    arrastar(ed, q28[0], q28[1], q28[2], q28[1] - 140)
    sel_mapa = ed.js("getSelection().toString()")
    us = ed.js("[getComputedStyle(document.querySelector('[data-amb-quadro]')).userSelect, getComputedStyle(document.querySelector('.amb-inv td')).userSelect]")
    camera_parada(ed)
    ed.js("getSelection().removeAllRanges()")
    td = ed.js("(function(){var td=document.querySelector('tr[data-amb-item] td'); td.scrollIntoView({block:'nearest'}); var b=td.getBoundingClientRect(); return [b.left+3, b.top+b.height/2, b.right-3];})()")
    arrastar(ed, td[0], td[1], td[2], td[1] + 24)
    sel_tab = ed.js("getSelection().toString()")
    ed.js("getSelection().removeAllRanges()")
    clicar_el(ed, "[data-amb-cam=tudo]")
    camera_parada(ed)
    checa("28. arrastar o mapa (até por cima da barra) não seleciona texto; na tabela o texto continua selecionável (controle)",
          sel_mapa == "" and len(sel_tab.strip()) > 2 and us[0] == "none" and us[1] != "none", f"seleção no mapa {sel_mapa!r}; na tabela {sel_tab[:30]!r}; user-select {us}")

    # 6. filtros de categoria e de área (a área também acende as pessoas)
    escolher(ed, "mat")
    total = ed.js("document.querySelectorAll('tr[data-amb-item]').length")
    MEDE6 = r"""(function(){
      var linhas = [...document.querySelectorAll('tr[data-amb-item]')];
      var pratTabela = [...new Set(linhas.map(tr => tr.dataset.prat))].sort();
      var acesas = [...new Set([...document.querySelectorAll('.amb-prat.acesa')].map(e => e.dataset.cod))].sort();
      var todas = [...new Set([...document.querySelectorAll('.amb-prat')].map(e => e.dataset.cod))];
      var apagadas = [...new Set([...document.querySelectorAll('.amb-prat.apagada')].map(e => e.dataset.cod))];
      var a = document.querySelector('.amb-prat.acesa .amb-t'), ap = document.querySelector('.amb-prat.apagada');
      var acc = getComputedStyle(document.documentElement).getPropertyValue('--acc').trim();
      var h = acc.replace('#',''), rgb = 'rgb(' + [0,2,4].map(i => parseInt(h.substr(i,2),16)).join(', ') + ')';
      var bon = [...document.querySelectorAll('.amb-boneco')];
      return JSON.stringify({ n: linhas.length, cats: [...new Set(linhas.map(tr => tr.dataset.cat))], areas: [...new Set(linhas.map(tr => tr.dataset.area))],
        pratTabela: pratTabela, acesas: acesas, todas: todas.length, apagadas: apagadas.length,
        corAcesa: a ? getComputedStyle(a).fill : null, acc: rgb, opApagada: ap ? +getComputedStyle(ap).opacity : null,
        pessoas: bon.length, acesos: bon.filter(e => e.classList.contains('aceso')).map(e => e.dataset.area),
        apagados: bon.filter(e => e.classList.contains('apagado')).length, opPessoa: (bon.find(e => e.classList.contains('apagado')) ? +getComputedStyle(bon.find(e => e.classList.contains('apagado'))).opacity : null) });
    })()"""
    opcao = lambda f, v: ed.js("(function(){var o=[...document.querySelectorAll('[data-amb-f=%s] option')].find(o=>o.value===%s); return o ? +o.textContent.match(/\\((\\d+)\\)/)[1] : -1;})()" % (f, json.dumps(v)))
    c_ti = opcao("cat", "ti")
    filtro(ed, "cat", "ti")
    m6 = json.loads(ed.js(MEDE6))
    certo_cat = (0 < m6["n"] < total and m6["n"] == c_ti and m6["cats"] == ["ti"] and m6["acesas"] == m6["pratTabela"]
                 and m6["apagadas"] == m6["todas"] - len(m6["acesas"]) and m6["corAcesa"] == m6["acc"] and m6["opApagada"] < 0.5 and not m6["acesos"])
    checa("6. categoria TI reduz a tabela e acende só as prateleiras dela", certo_cat,
          f"{total} -> {m6['n']} linhas (opção dizia {c_ti}); prateleiras {m6['pratTabela']} = acesas {m6['acesas']}; apagadas {m6['apagadas']} de {m6['todas']}")
    filtro(ed, "cat", "")
    escolher(ed, "fab")
    total_fab = ed.js("document.querySelectorAll('tr[data-amb-item]').length")
    c_ops = opcao("area", "ops")
    filtro(ed, "area", "ops")
    m6b = json.loads(ed.js(MEDE6))
    ops_presentes = ed.js("[...document.querySelectorAll('.amb-boneco')].filter(e=>e.dataset.area==='ops').length")
    certo_area = (0 < m6b["n"] < total_fab and m6b["n"] == c_ops and m6b["areas"] == ["ops"] and m6b["acesas"] == m6b["pratTabela"]
                  and len(m6b["acesos"]) == ops_presentes > 0 and set(m6b["acesos"]) == {"ops"} and m6b["apagados"] == m6b["pessoas"] - ops_presentes
                  and m6b["opPessoa"] is not None and m6b["opPessoa"] < 0.3)
    checa("6. área Operações (Fábrica): tabela só da área, prateleiras dela acesas, pessoas da área acesas e as outras apagadas", certo_area,
          f"{total_fab} -> {m6b['n']} linhas (opção {c_ops}); {len(m6b['acesos'])} pessoas acesas de {ops_presentes} da área; {m6b['apagados']} apagadas (opacidade {m6b['opPessoa']})")
    filtro(ed, "area", "")
    escolher(ed, "mat")
    erradas = []
    for f, vals in (("cat", ("ali", "emb", "epi", "equ", "esc", "lim", "ti")), ("area", ("tec", "pes", "ops", "log", "man", "com")), ("sit", ("ok", "baixo", "zerado"))):
        for v in vals:
            c = opcao(f, v)
            filtro(ed, f, v)
            n = ed.js("document.querySelectorAll('tr[data-amb-item]').length")
            filtro(ed, f, "")
            if c != n:
                erradas.append(f"{f}={v}: opção {c} x tabela {n}")
    volta = ed.js("document.querySelectorAll('tr[data-amb-item]').length")
    checa("6. contagem de cada opção (categoria, área, situação) = linhas ao escolhê-la; desligar volta ao total", not erradas and volta == total,
          "; ".join(erradas) or f"16 opções, {total} linhas")

    # 7. linha -> prateleira (pulso) e prateleira -> tabela
    clicar_el(ed, "tr[data-amb-item='mat-OL']")
    m7 = json.loads(ed.js("JSON.stringify({sel: !!document.querySelector(\"tr[data-amb-item='mat-OL'].amb-sel\"), "
                          "marcada: [...new Set([...document.querySelectorAll('.amb-prat.marcada')].map(e=>e.dataset.cod))], "
                          "pulso: [...new Set([...document.querySelectorAll('.amb-prat.pulso')].map(e=>e.dataset.cod))]})"))
    checa("7. clicar na linha (Óleo, R07) destaca a prateleira com pulso", m7["sel"] and m7["marcada"] == ["R07"] and m7["pulso"] == ["R07"], json.dumps(m7))
    clicar_el(ed, "tr[data-amb-item='mat-OL']")
    clicar_prat(ed, "R05")
    m7b = json.loads(ed.js("JSON.stringify({prats: [...new Set([...document.querySelectorAll('tr[data-amb-item]')].map(t=>t.dataset.prat))], "
                           "n: document.querySelectorAll('tr[data-amb-item]').length, chip: (document.querySelector('[data-amb-chips]')||{}).textContent || ''})"))
    checa("7. clicar na prateleira (R05) filtra a tabela por ela", m7b["prats"] == ["R05"] and m7b["n"] >= 1 and "R05" in m7b["chip"], json.dumps(m7b, ensure_ascii=False))
    clicar_el(ed, "[data-amb-tira-prat]")

    # 21. câmera: aproximar, arrastar, roda, girar, planta, enquadrar, minimapa, camadas
    c0 = camera_parada(ed)
    mini0 = ed.js("document.querySelector('.amb-mini-vista').getAttribute('points')")
    clicar_el(ed, "[data-amb-cam=mais]"); clicar_el(ed, "[data-amb-cam=mais]")
    c1 = camera_parada(ed)
    mini1 = ed.js("document.querySelector('.amb-mini-vista').getAttribute('points')")
    q = ed.js("(function(){var r=document.querySelector('[data-amb-quadro]').getBoundingClientRect(); return [r.left+r.width*0.3, r.top+r.height*0.75];})()")
    arrastar(ed, q[0], q[1], q[0] + 72, q[1] - 36, passos=6)
    c2 = camera_parada(ed)
    ed.cmd("Input.dispatchMouseEvent", type="mouseWheel", x=q[0], y=q[1], deltaX=0, deltaY=-240)
    ed.esperar(0.2)
    c3 = camera_parada(ed)
    n_bon = ed.js("document.querySelectorAll('.amb-boneco').length")
    clicar_el(ed, "[data-amb-cam=girar-d]")
    c4 = camera_parada(ed)
    rot_svg, n_bon2 = ed.js("[document.querySelector('.amb-svg').dataset.rot, document.querySelectorAll('.amb-boneco').length]")
    clicar_el(ed, "[data-amb-modo=planta]")
    planta = ed.js("[document.querySelector('.amb-svg').classList.contains('amb-modo-planta'), document.querySelectorAll('.amb-svg .amb-e').length, document.querySelectorAll('.amb-boneco').length]")
    clicar_el(ed, "[data-amb-modo='3d']")
    clicar_el(ed, "[data-amb-cam=girar-e]")
    parede0 = ed.js("Math.max(...[...document.querySelectorAll('.amb-parede, .amb-rodape')].map(e => e.getBoundingClientRect().height))")
    clicar_el(ed, "[data-amb-menu] summary")   # camadas ficam num menu
    clicar_el(ed, "[data-amb-camada=baixas]")
    parede1 = ed.js("Math.max(...[...document.querySelectorAll('.amb-parede, .amb-rodape')].map(e => e.getBoundingClientRect().height))")
    clicar_el(ed, "[data-amb-camada=baixas]")
    clicar_el(ed, "[data-amb-camada=pessoas]")
    sem_pessoas = ed.js("getComputedStyle(document.querySelector('.amb-boneco')).display === 'none'")
    clicar_el(ed, "[data-amb-camada=pessoas]")
    clicar_el(ed, "[data-amb-menu] summary")
    menu_fechou = ed.js("!document.querySelector('[data-amb-menu]').open")
    clicar_el(ed, "[data-amb-cam=tudo]")
    c5 = camera_parada(ed)
    certo21 = (c0["tudo"] and c1["zoom"] > c0["zoom"] * 1.9 and mini1 != mini0 and abs(c2["cx"] - c1["cx"]) > 10 and c3["zoom"] > c2["zoom"]
               and c4["rot"] == 1 and rot_svg == "1" and n_bon2 == n_bon and planta[0] and planta[1] == 0 and planta[2] == n_bon
               and parede1 < parede0 and sem_pessoas and menu_fechou and c5["tudo"] and abs(c5["zoom"] - c0["zoom"]) < 0.01 and c5["rot"] == 0)
    checa("21. câmera: aproximar, arrastar, roda, girar, planta, paredes baixas, camada de pessoas e enquadrar tudo", certo21,
          f"zoom {c0['zoom']:.1f}->{c1['zoom']:.2f}->roda {c3['zoom']:.2f}; arrasto moveu {abs(c2['cx'] - c1['cx']):.0f}; giro rot={c4['rot']} ({n_bon2}/{n_bon} bonecos); "
          f"planta={planta[0]} faces laterais={planta[1]}; parede {parede0:.1f}->{parede1:.1f} px; sem pessoas={sem_pessoas}; enquadrar zoom={c5['zoom']} rot={c5['rot']}")

    # 22. aba Atenção: os baixos e zerados; clicar leva à linha, à prateleira e a câmera vai até ela
    clicar_el(ed, "[data-amb-aba=atencao]")
    av = json.loads(ed.js("JSON.stringify({n: +document.querySelector('[data-amb-n-aba=atencao]').textContent, itens: [...document.querySelectorAll('tr[data-amb-atencao]')].map(t=>t.dataset.ambItem), "
                          "esperado: AMBIENTE_DADOS.inventario.filter(i=>i.unidade==='mat' && i.sit!=='ok').map(i=>i.id).sort(), separada: document.querySelectorAll('.amb-avisos, .amb-avisos-jan').length})"))
    alvo = av["itens"][0] if av["itens"] else ""
    clicar_el(ed, f"tr[data-amb-item='{alvo}']")
    c6 = camera_parada(ed)
    av2 = json.loads(ed.js("(function(){var tr=document.querySelector('tr.amb-sel'), sc=document.querySelector('.amb-est .tb-rolagem'); var a=tr?tr.getBoundingClientRect():null, b=sc.getBoundingClientRect();"
                           "var prat=tr?tr.dataset.prat:''; return JSON.stringify({sel: tr?tr.dataset.ambItem:'', visivel: !!a && a.top>=b.top-1 && a.bottom<=b.bottom+1, "
                           "pulso: [...new Set([...document.querySelectorAll('.amb-prat.pulso')].map(e=>e.dataset.cod))], prat: prat});})()"))
    checa("22. aba Atenção (na mesma janela do estoque) lista os baixos e zerados; clicar leva à linha, à prateleira (pulso) e a câmera vai até ela",
          sorted(av["itens"]) == av["esperado"] and av["n"] == len(av["esperado"]) > 0 and av["separada"] == 0 and av2["sel"] == alvo and av2["visivel"]
          and av2["pulso"] == [av2["prat"]] and c6["zoom"] >= 2.1,
          f"{len(av['itens'])} na aba (esperado {len(av['esperado'])}, contagem {av['n']}); linha {av2['sel']} visível={av2['visivel']}; pulso {av2['pulso']}; zoom {c6['zoom']:.2f}")
    clicar_el(ed, "[data-amb-cam=tudo]")
    camera_parada(ed)
    clicar_el(ed, "[data-amb-aba=estoque]")

    # 33. tabela "Em turno": quem está na unidade, onde está, busca, clique foca; quem saiu vai embaixo
    hora(ed, 1000)
    clicar_el(ed, "[data-amb-aba=turno]")
    t33 = json.loads(ed.js("JSON.stringify({linhas: document.querySelectorAll('tr[data-amb-pessoa]').length, sairam: document.querySelectorAll('tr.amb-saiu').length, "
                           "bonecos: document.querySelectorAll('.amb-boneco').length, conta: +document.querySelector('[data-amb-n-aba=turno]').textContent, "
                           "onde: [...new Set([...document.querySelectorAll('tr[data-amb-pessoa] .amb-onde')].map(e=>e.textContent.split(' · ')[0]))], "
                           "primeiro: (document.querySelector('tr[data-amb-pessoa]')||{dataset:{}}).dataset.ambPessoa, "
                           "nome: (document.querySelector('tr[data-amb-pessoa] td')||{}).textContent, ultimo: [...document.querySelectorAll('tbody tr')].pop().className})"))
    sai33 = len([m for m in marc if m["unidade"] == "mat" and not m["ausente"] and m["saida"] is not None and m["saida"] <= 1000])
    ed.js("(function(){var b=document.querySelector('[data-amb-busca]'); b.value=%s; b.dispatchEvent(new Event('input',{bubbles:true}));})()" % json.dumps(t33["nome"]), espera=0.2)
    busca33 = ed.js("document.querySelectorAll('tr[data-amb-pessoa]').length")
    clicar_el(ed, f"tr[data-amb-pessoa='{t33['primeiro']}']")
    camera_parada(ed)
    foco33 = ed.js("[AMBIENTE._teste.estado().foco, getComputedStyle(document.querySelector('[data-amb-ficha]')).display !== 'none', !!document.querySelector('tr.amb-sel[data-amb-pessoa]')]")
    ed.js("document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}))", espera=0.2)
    camera_parada(ed)
    ed.js("(function(){var b=document.querySelector('[data-amb-busca]'); b.value=''; b.dispatchEvent(new Event('input',{bubbles:true}));})()", espera=0.2)
    VALIDOS = {"Presente"}   # o ponto só diz se a pessoa está (ou a hora em que saiu), não onde
    checa("33. 'Em turno': uma linha por pessoa na unidade (= bonecos = contagem da aba), situação do ponto (Presente / Saiu às), busca, clicar foca; quem saiu embaixo",
          t33["linhas"] == t33["bonecos"] == t33["conta"] > 0 and set(t33["onde"]) <= VALIDOS and t33["sairam"] == sai33 > 0 and "amb-saiu" in t33["ultimo"]
          and busca33 == 1 and foco33[0] == t33["primeiro"] and foco33[1] and foco33[2],
          f"{t33['linhas']} linhas x {t33['bonecos']} bonecos x aba {t33['conta']}; onde {t33['onde']}; saíram {t33['sairam']} (regra {sai33}); busca -> {busca33}; foco {foco33}")
    clicar_el(ed, "[data-amb-aba=estoque]")
    hora(ed, 630)

    # 29. Histórico do dia (Matriz, 16:40)
    escolher(ed, "mat")
    hora(ed, 1000)
    clicar_el(ed, ".amb-bt-hist")
    h29 = json.loads(ed.js("JSON.stringify({aberto: !document.querySelector('[data-amb-hist-painel]').hidden, nums: [...document.querySelectorAll('.amb-hist-num b')].map(b=>b.textContent), "
                           "cab: [...document.querySelectorAll('.amb-hist-tab th')].map(th=>th.textContent), "
                           "linhas: [...document.querySelectorAll('.amb-hist-tab tbody tr')].map(tr=>[tr.cells[0].textContent, tr.cells[3].textContent])})"))
    ent29 = [m for m in marc if m["unidade"] == "mat" and not m["ausente"] and m["entrada"] <= 1000]
    sai29 = [m for m in marc if m["unidade"] == "mat" and not m["ausente"] and m["saida"] is not None and m["saida"] <= 1000]
    horas29 = [hm for hm, _ in h29["linhas"]]
    ed.js("document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}))", espera=0.2)
    fechou29 = ed.js("document.querySelector('[data-amb-hist-painel]').hidden")
    ed.js("document.querySelector('.amb-bt-hist').click()", espera=0.3)
    embaixo29 = ed.js("document.querySelector('[data-amb-hist-painel]').getBoundingClientRect().top >= document.querySelector('.amb-notas').getBoundingClientRect().bottom - 1 && document.querySelector('.amb-notas').getBoundingClientRect().top >= document.querySelector('.amb-mapa').getBoundingClientRect().bottom - 1")
    ed.js("document.querySelector('.amb-bt-hist').click()", espera=0.2)
    checa("29. Histórico (embaixo do mapa, depois das janelinhas): bateram o ponto, presentes e saídas = regra recalculada; uma linha por marcação, a mais nova em cima; Esc fecha",
          h29["aberto"] and [int(x) for x in h29["nums"]] == [len(ent29), esperado(marc, "mat", 1000), len(sai29)] and len(h29["linhas"]) == len(ent29) + len(sai29)
          and horas29 == sorted(horas29, reverse=True) and h29["cab"] == ["Hora", "Quem", "Área", "Evento"] and fechou29 and embaixo29,
          f"tela {h29['nums']} x regra {[len(ent29), esperado(marc, 'mat', 1000), len(sai29)]}; {len(h29['linhas'])} linhas; primeira {h29['linhas'][:1]}; fechou={fechou29}")

    # 40. levantar é raro: no máximo 2 fora do lugar por unidade; cada andar libera uma saída a cada 20 a 40 s
    EM_PE = r"""(function(){ var T=AMBIENTE._teste, maxFora=0, saidas={}, ant={};
      for (var i=0;i<1800;i++){ T.avancar(1/30); var fora=0;
        T.bonecos().forEach(function(b){ var f=(b.estado==='indo'||b.estado==='fora'||b.estado==='voltando') && b.foraGrupo!=='maquina'; if (f) fora++;
          if (b.estado==='indo' && ant[b.id]!=='indo' && b.foraGrupo!=='maquina') saidas[b.andar]=(saidas[b.andar]||0)+1; ant[b.id]=b.estado; });
        maxFora=Math.max(maxFora,fora); }
      return JSON.stringify({maxFora: maxFora, saidas: saidas}); })()"""
    r40 = {}
    for u in ("mat", "fab"):
        escolher(ed, u)
        hora(ed, 630)
        r40[u] = json.loads(ed.js(EM_PE))
    checa("40. levantar é raro (60 s simulados): no máximo 2 pessoas fora do lugar por unidade e no máximo 4 saídas por andar",
          all(v["maxFora"] <= 2 and v["saidas"] and all(n <= 4 for n in v["saidas"].values()) for v in r40.values()), json.dumps(r40))

    # 41. andares da Matriz separados: o 2º não cobre mesas nem rótulos do 1º (1º em foco, vista padrão)
    escolher(ed, "mat")
    SEPARA = r"""(function(){ var MP=AMBIENTE_MAPA, A=AMBIENTE_DADOS, P1=A.plantas.mat, P2=P1.andar2;
      function quad(z,zz){ return [[z.x0,z.y0],[z.x1,z.y0],[z.x1,z.y1],[z.x0,z.y1]].map(function(c){return MP.proj(c[0],c[1],zz);}); }
      function dentro(pt,pol){ var c=false; for (var i=0,j=pol.length-1;i<pol.length;j=i++){ var xi=pol[i][0],yi=pol[i][1],xj=pol[j][0],yj=pol[j][1];
        if (((yi>pt[1])!==(yj>pt[1])) && (pt[0] < (xj-xi)*(pt[1]-yi)/(yj-yi)+xi)) c=!c; } return c; }
      var pol1=P1.zonas.map(function(z){return quad(z,0);});
      function medir(Z2){ var pol2=[]; P2.zonas.forEach(function(z){ pol2.push(quad(z,Z2)); pol2.push(quad(z,Z2+0.9)); });
        var em2=function(pt){ return pol2.some(function(p){return dentro(pt,p);}); };
        var rotSob=0; [...document.querySelectorAll('.amb-andar[data-andar="1"] .amb-rotulo')].forEach(function(e){ var b=e.getBBox();
          if ([[b.x,b.y],[b.x+b.width,b.y],[b.x,b.y+b.height],[b.x+b.width,b.y+b.height]].some(em2)) rotSob++; });
        var mesSob=0; P1.moveis.filter(function(m){return m.tipo==='mesa';}).forEach(function(m){ if (quad(m,0.42).some(em2)) mesSob++; });
        var tot=0, sob=0; P2.zonas.forEach(function(z){ for (var x=z.x0+0.25;x<z.x1;x+=0.5) for (var y=z.y0+0.25;y<z.y1;y+=0.5){ tot++;
          if (pol1.some(function(p){return dentro(MP.proj(x,y,Z2),p);})) sob++; } });
        return {rotSob: rotSob, mesSob: mesSob, frac: Math.round(sob/tot*1000)/1000}; }
      return JSON.stringify({agora: medir(MP.ANDAR), antes: medir(3.2), andar: MP.ANDAR}); })()"""
    r41 = json.loads(ed.js(SEPARA))
    checa("41. 2º andar separado do 1º: nenhum rótulo nem mesa do 1º embaixo do 2º; a área do 2º sobre o 1º cai (antes x agora)",
          r41["agora"]["rotSob"] == 0 and r41["agora"]["mesSob"] == 0 and r41["agora"]["frac"] < 0.05 and r41["antes"]["frac"] > 0.3, json.dumps(r41))

    # 42. profundidade dos caminhões (parados e andando), nas 4 rotações: nada que está atrás fica por
    # cima e nada que está na frente fica por baixo (a ordem do desenho segue a faixa do chão de cada pedaço)
    escolher(ed, "fab")
    hora(ed, 700)
    ed.js("AMBIENTE._teste.avancarCaminhoes(0.1)")
    PROF = r"""(function(){ var svg=document.querySelector('.amb-svg'), pecas=[...svg.querySelectorAll('.amb-tpeca')].filter(function(g){return g.style.display!=='none';});
      var estat=[...svg.querySelectorAll('.amb-f > .amb-cx')].map(function(s){return [s, +s.parentNode.dataset.f, s.getBoundingClientRect()];}), n=0, viol=0;
      pecas.forEach(function(g){ var f=+g.parentNode.dataset.f, r=g.getBoundingClientRect();
        estat.forEach(function(x){ var fs=x[1]; if (fs === f) return; var q=x[2];
          if (Math.min(r.right,q.right)-Math.max(r.left,q.left)>1 && Math.min(r.bottom,q.bottom)-Math.max(r.top,q.top)>1) { n++;
            var depois = g.compareDocumentPosition(x[0]) & Node.DOCUMENT_POSITION_FOLLOWING;
            if ((fs < f && depois) || (fs > f && !depois)) viol++; } }); });
      return [pecas.length, n, viol]; })()"""
    r42 = []
    for rot in range(4):
        for passo in (2, 3, 3, 4, 13):          # chegando, chegando, encostando, parado, saindo
            ed.js(f"AMBIENTE._teste.avancarCaminhoes({passo})")
            fr = json.loads(ed.js("JSON.stringify(AMBIENTE._teste.frota().filter(a=>a.ciclo).map(a=>[a.estado, Math.round(a.dx*10)/10]))"))
            r42.append([rot, fr] + ed.js(PROF))
        clicar_el(ed, "[data-amb-cam=girar-d]")
    checa("42. caminhões (parados e o da doca andando) nas 4 rotações: nada de trás por cima, nada da frente por baixo",
          len(r42) == 20 and all(x[2] > 30 and x[4] == 0 for x in r42) and sum(x[3] for x in r42) > 0 and len({str(x[1]) for x in r42}) >= 4,
          f"{len(r42)} quadros; peças {min(x[2] for x in r42)}..{max(x[2] for x in r42)}; vizinhos {sum(x[3] for x in r42)}; erradas {sum(x[4] for x in r42)}; estados {[x[1] for x in r42[:5]]}")
    PARTES = "JSON.stringify(['carreta','cabine','roda','vidro','chassi','farol','parachoque'].map(function(k){return document.querySelectorAll('.amb-tpeca[data-amb-movel] .amb-'+k).length;}))"
    partes = json.loads(ed.js(PARTES))
    checa("43. o caminhão parece caminhão: baú, cabine separada, 6 rodas (3 eixos), vidros, chassi, faróis e para-choque",
          partes[0] >= 5 and partes[1] >= 1 and partes[2] >= 6 and partes[3] >= 3 and partes[4] >= 5 and partes[5] >= 2 and partes[6] >= 1, f"{partes}")

    # 46. nenhum caminhão aparece nem some à vista: só nasce/morre fora do contorno e não salta
    def trajetos(u, h0, h1):
        escolher(ed, "mat"); hora(ed, h0); escolher(ed, u)          # trocar de unidade = todos já no lugar
        hora(ed, h1, natural=True)
        return json.loads(ed.js(r"""(function(){ var T=AMBIENTE._teste, P=AMBIENTE_DADOS.plantas[T.estado().unidade];
          var borda=Math.max.apply(null, P.zonas.map(function(z){return z.x1;})), ant={}, viu={}, nasce=[], morre=[], saltos=[], vmax=AMBIENTE_MAPA.VEL_CAMINHAO/30*1.5;
          for (var i=0;i<1800;i++){ var f=T.avancarCaminhoes(1/30), agora={};
            f.forEach(function(a){ agora[a.id]=a; var b=ant[a.id];
              if (a.visivel && (!b || !b.visivel) && i>0) { nasce.push(Math.round(a.x*10)/10); if (a.x < borda - 0.01) viu[a.id]='nasceu dentro em '+a.x.toFixed(2); }
              if (b && b.visivel && a.visivel && Math.abs(a.x-b.x) > vmax) saltos.push(a.id+' '+(a.x-b.x).toFixed(2)); });
            Object.keys(ant).forEach(function(id){ var b=ant[id], a=agora[id]; if (b.visivel && (!a || !a.visivel)) { morre.push(Math.round(b.x*10)/10); if (b.x < borda - 0.5) viu[id]='sumiu dentro em '+b.x.toFixed(2); } });
            ant=agora; }
          return JSON.stringify({nasce: nasce, morre: morre, saltos: saltos.slice(0,3), dentro: viu, borda: borda}); })()"""))
    r46 = {"cd": trajetos("cd", 480, 483), "fab": trajetos("fab", 700, 701)}
    checa("46. caminhões só aparecem e somem fora do contorno da planta (chegam de ré pela estrada e saem dirigindo), sem salto entre quadros (60 s simulados)",
          all(not v["dentro"] and not v["saltos"] for v in r46.values()) and all(r46[u]["nasce"] and r46[u]["morre"] for u in r46), json.dumps(r46))

    # 47. o chão do caminhão (cabine + baú), parado e na rota inteira até a borda, não cruza peça, parede nem a vaga de outro caminhão
    r47 = json.loads(ed.js(r"""(function(){ var out={};
      ['cd','fab'].forEach(function(u){ var P=AMBIENTE_DADOS.plantas[u], vagas=P.vagasCaminhao.concat(P.docaAnimada ? [P.docaAnimada] : []);
        var borda=Math.max.apply(null, P.zonas.map(function(z){return z.x1;}))+0.5, L=6.53, Y=0.8, bate=[], n=0;
        var pecas=P.moveis.filter(function(m){return m.tipo!=='pintura';}).map(function(m){return [m.x0,m.y0,m.x1,m.y1,m.tipo];})
          .concat(P.paredes.map(function(w){return [Math.min(w[0],w[2])-0.06, Math.min(w[1],w[3])-0.06, Math.max(w[0],w[2])+0.06, Math.max(w[1],w[3])+0.06, 'parede'];}));
        var cruza=function(a,b){ return Math.min(a[2],b[2])-Math.max(a[0],b[0]) > 1e-3 && Math.min(a[3],b[3])-Math.max(a[1],b[1]) > 1e-3; };
        vagas.forEach(function(v,i){ for (var dx=0; v.x0+dx < borda; dx+=0.25){ n++; var r=[v.x0+dx, v.yc-Y, v.x0+dx+L, v.yc+Y];
          pecas.forEach(function(q){ if (cruza(r,q)) bate.push('vaga '+i+' dx '+dx+' x '+q[4]); });
          vagas.forEach(function(o,j){ if (j!==i && cruza(r,[o.x0, o.yc-Y, o.x0+L, o.yc+Y])) bate.push('vaga '+i+' dx '+dx+' x vaga '+j); }); } });
        out[u]={amostras: n, batidas: bate.length, ex: bate.slice(0,4)}; });
      return JSON.stringify(out); })()"""))
    checa("47. o chão de cada caminhão, parado e em toda a rota (a cada 0,25 célula), não cruza peça, árvore, poste, parede nem outra vaga (CD e Fábrica)",
          all(v["batidas"] == 0 and v["amostras"] > 50 for v in r47.values()), json.dumps(r47, ensure_ascii=False))

    # 48. seleção pelo mouse de verdade: no centro da cabine e do baú; parado abre "A sair", andando abre "Saíram";
    # passar o mouse para o caminhão (contorno + balão); Esc tira a seleção
    def ponto_caminhao(id_, classe):
        return ed.js("""(function(){ var gs=[...document.querySelectorAll('.amb-svg .amb-tpeca[data-amb-exp="%s"]')].filter(g=>g.style.display!=='none' && g.querySelector('.%s'));
          gs.sort(function(a,b){ return a.getBoundingClientRect().left - b.getBoundingClientRect().left; });
          var g = gs[Math.floor(gs.length/2)]; if (!g) return null; g.scrollIntoView({block:'center'}); var r=g.getBoundingClientRect(), x=r.left+r.width/2, y=r.top+r.height/2;
          var t=document.elementFromPoint(x,y), d=t && t.closest('[data-amb-exp]'); return [x, y, !!d && d.getAttribute('data-amb-exp')==='%s']; })()""" % (id_, classe, id_))
    r48 = {}
    escolher(ed, "mat"); hora(ed, 600); escolher(ed, "cd")
    parados = json.loads(ed.js("JSON.stringify(AMBIENTE._teste.expedicao().parados)"))
    alvo = None
    for pid in parados:
        pts = [ponto_caminhao(pid, "amb-carreta"), ponto_caminhao(pid, "amb-cabine")]
        if all(pt and pt[2] for pt in pts):
            alvo = (pid, pts); break
    if alvo:
        pid, pts = alvo
        res = []
        for x, y, _ in pts:
            ed.cmd("Input.dispatchMouseEvent", type="mouseMoved", x=x, y=y); ed.esperar(0.2)
            dica = ed.js("(function(){var b=document.querySelector('.amb-balao'); return b && !b.hidden ? b.textContent : '';})()")
            contorno = ed.js(f"document.querySelectorAll('.amb-tpeca.hover[data-amb-exp=\"{pid}\"]').length")
            ed.clicar(x, y); ed.esperar(0.3)
            e = json.loads(ed.js("JSON.stringify(AMBIENTE._teste.expedicao())"))
            linha = ed.js(f"!!document.querySelector('tr.amb-sel[data-amb-exp-linha=\"{pid}\"]')")
            sel = ed.js(f"document.querySelectorAll('.amb-tpeca.sel[data-amb-exp=\"{pid}\"]').length")
            res.append({"dica": dica[:30], "contorno": contorno, "aba": e["aba"], "sub": e["sub"], "sel": e["sel"] == pid, "linha": linha, "marcado": sel})
            ed.js("document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}))", espera=0.2)
        r48["parado"] = res
        r48["esc"] = ed.js("AMBIENTE._teste.expedicao().sel === '' && !document.querySelector('.amb-tpeca.sel')")
    escolher(ed, "fab"); hora(ed, 700)
    if ed.js("AMBIENTE._teste.estado().estoque"):
        clicar_el(ed, "[data-amb-est-alterna]")   # janela recolhida: não cobre o pátio
    ed.js("AMBIENTE._teste.avancarCaminhoes(5)")   # o caminhão da doca está chegando, de ré
    mov = json.loads(ed.js("JSON.stringify(AMBIENTE._teste.frota().find(a=>a.ciclo))"))
    pt = ponto_caminhao(mov["id"], "amb-cabine") if mov else None
    if pt and pt[2]:
        ed.cmd("Input.dispatchMouseEvent", type="mouseMoved", x=pt[0], y=pt[1]); ed.esperar(0.2)
        a1 = json.loads(ed.js("JSON.stringify(AMBIENTE._teste.frota().find(a=>a.ciclo))"))
        ed.js("AMBIENTE._teste.avancarCaminhoes(1)")
        a2 = json.loads(ed.js("JSON.stringify(AMBIENTE._teste.frota().find(a=>a.ciclo))"))
        ed.clicar(pt[0], pt[1]); ed.esperar(0.3)
        e = json.loads(ed.js("JSON.stringify(AMBIENTE._teste.expedicao())"))
        linha = ed.js(f"!!document.querySelector('tr.amb-sel[data-amb-exp-linha=\"{mov['id']}\"]')")
        canto = ed.js("(function(){var r=document.querySelector('[data-amb-quadro]').getBoundingClientRect(); return [r.left+6, r.top+6];})()")
        ed.cmd("Input.dispatchMouseEvent", type="mouseMoved", x=canto[0], y=canto[1]); ed.esperar(0.2)
        a3 = json.loads(ed.js("JSON.stringify(AMBIENTE._teste.frota().find(a=>a.ciclo))"))
        r48["andando"] = {"estado": mov["estado"], "congelou": a1["congelado"] and a1["x"] == a2["x"], "aba": e["aba"], "sub": e["sub"], "sel": e["sel"] == mov["id"], "linha": linha, "solto": not a3["congelado"]}
        ed.js("document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}))", espera=0.2)
    ok48 = (alvo is not None and all(x["dica"] and x["contorno"] > 0 and x["aba"] == "expedicao" and x["sub"] == "asair" and x["sel"] and x["linha"] and x["marcado"] > 0 for x in r48.get("parado", []))
            and r48.get("esc") and r48.get("andando", {}).get("congelou") and r48["andando"]["sub"] == "sairam" and r48["andando"]["sel"] and r48["andando"]["linha"] and r48["andando"]["solto"]
            and r48["andando"]["estado"] == "chegando")
    checa("48. caminhão pelo mouse (CDP): baú e cabine respondem; contorno e balão; parado abre 'A sair' e andando abre 'Saíram' com a linha dele; o mouse em cima para o caminhão; Esc tira a seleção",
          ok48, json.dumps(r48, ensure_ascii=False))
    clicar_el(ed, "[data-amb-aba=estoque]")
    escolher(ed, "mat")
    hora(ed, 630)

    # 44. Expedição: os parados batem com "A sair"; quem sai vai para "Saíram" com a hora; a contagem bate com a tabela
    r44 = {}
    for u, h1, h2 in (("cd", 600, 900), ("fab", 600, 900)):
        escolher(ed, u)
        hora(ed, h1)
        clicar_el(ed, "[data-amb-aba=expedicao]")
        clicar_el(ed, "[data-amb-sub=asair]")
        e1 = json.loads(ed.js("JSON.stringify(AMBIENTE._teste.expedicao())"))
        vagas = ed.js(f"AMBIENTE_DADOS.plantas.{u}.vagasCaminhao.length")
        ed.js("AMBIENTE._teste.avancarCaminhoes(40)")   # quem tinha de sair sai e quem chega encosta
        e1 = json.loads(ed.js("JSON.stringify(AMBIENTE._teste.expedicao())"))
        svg1 = ed.js("[...new Set([...document.querySelectorAll('.amb-svg .amb-tpeca:not([data-amb-movel])')].map(e=>e.dataset.ambExp))].sort()")
        lin1 = ed.js("[document.querySelectorAll('tr[data-amb-exp-linha]').length, +document.querySelector('[data-amb-n-aba=expedicao]').textContent]")
        dica = ed.js("(document.querySelector('.amb-svg .amb-tpeca:not([data-amb-movel])')||{getAttribute:()=>''}).getAttribute('aria-label') || ''")
        hora(ed, h2)
        ed.js("AMBIENTE._teste.avancarCaminhoes(40)")
        clicar_el(ed, "[data-amb-sub=sairam]")
        e2 = json.loads(ed.js("JSON.stringify(AMBIENTE._teste.expedicao())"))
        lin2 = ed.js("[...document.querySelectorAll('tr[data-amb-exp-linha]')].map(t=>[t.dataset.ambExpLinha, t.cells[3].textContent])")
        svg2 = ed.js("[...new Set([...document.querySelectorAll('.amb-svg .amb-tpeca:not([data-amb-movel])')].map(e=>e.dataset.ambExp))].sort()")
        novos = [i for i, _ in e2["sairam"] if i not in [j for j, _ in e1["sairam"]]]
        r44[u] = {"parados_ok": sorted(e1["parados"]) == sorted(e1["asair"][:vagas]) and svg1 == sorted(e1["parados"]), "linhas": lin1, "dica": dica[:40],
                  "sairam_ok": len(lin2) == len(e2["sairam"]) and all(len(h) == 5 and h[2] == ":" for _, h in lin2), "novos": novos,
                  "encostou": svg2 == sorted(e2["parados"]) and sorted(e2["parados"]) == sorted(e2["asair"][:vagas])}
    checa("44. Expedição (CD e Fábrica): caminhões parados = os primeiros de 'A sair' nas vagas; contagem da aba = linhas; quem sai vai para 'Saíram' com a hora e o próximo encosta; dica no caminhão",
          all(v["parados_ok"] and v["linhas"][0] == v["linhas"][1] > 0 and v["sairam_ok"] and v["novos"] and v["encostou"] and v["dica"] for v in r44.values()), json.dumps(r44, ensure_ascii=False))
    clicar_el(ed, "[data-amb-aba=estoque]")

    # 45. detalhes novos: existem, não clicam e não criam rótulo
    r45 = {}
    for u in ("mat", "fab", "cd"):
        escolher(ed, u)
        r45[u] = json.loads(ed.js("""JSON.stringify((function(){ var P=AMBIENTE_DADOS.plantas['%s'], d=[...document.querySelectorAll('.amb-svg .amb-deco')];
          return {deco: d.length, clicaveis: d.filter(function(e){return getComputedStyle(e).pointerEvents!=='none' || e.hasAttribute('role') || e.hasAttribute('data-cod');}).length,
            rotulos: document.querySelectorAll('.amb-svg .amb-rotulo').length, esperado: P.rotulos.length + (P.andar2 ? P.andar2.rotulos.length : 0)}; })())""" % u))
    checa("45. detalhes (vasos, quadro, bebedouro, extintor, cones, faixa, vagas, postes, árvores) existem, não são clicáveis e não criam rótulo",
          all(v["deco"] >= 6 and v["clicaveis"] == 0 and v["rotulos"] == v["esperado"] for v in r45.values()), json.dumps(r45))
    escolher(ed, "mat")
    hora(ed, 630)

    # 34. o caminhão da doca da Fábrica: só depois da 1ª saída do dia; chega, encosta, fica e sai; o rótulo é uma carga que saiu
    escolher(ed, "mat"); hora(ed, 480); escolher(ed, "fab")
    sem = ed.js("AMBIENTE._teste.avancarCaminhoes(1).filter(a=>a.ciclo).length")
    hora(ed, 700)
    estados = []
    for k in range(40):
        a = json.loads(ed.js("JSON.stringify(AMBIENTE._teste.avancarCaminhoes(1).find(a=>a.ciclo) || null)"))
        if a and (not estados or estados[-1] != a["estado"]):
            estados.append(a["estado"])
    rot = ed.js("(document.querySelector('.amb-tpeca[data-amb-movel]')||{getAttribute:()=>''}).getAttribute('aria-label') || ''")
    placas = ed.js("AMBIENTE_DADOS.expedicoes.filter(e=>e.unidade==='fab' && e.saida<=700).map(e=>e.placa)")
    checa("34. caminhão da doca: antes da 1ª saída do dia não existe; depois chega, encosta, fica, sai e volta; o rótulo é uma carga que já saiu",
          sem == 0 and estados[:5] == ["chegando", "parado", "saindo", "fora", "chegando"] and any(p in rot for p in placas), f"antes {sem}; estados {estados}; rótulo {rot[:60]!r}")

    # 30. Fábrica: pátio, caminhões e recebimentos
    escolher(ed, "fab")
    REC = ("JSON.stringify((function(){var tr=document.querySelector(\"tr[data-amb-item='fab-RO']\"); return {qtd: tr.cells[3].textContent, "
           "nota: (tr.querySelector('[data-amb-rec]')||{}).textContent||''};})())")
    base_ro = ed.js("AMBIENTE_DADOS.inventario.find(i=>i.id==='fab-RO').qtd")
    hora(ed, 600)
    r600 = json.loads(ed.js(REC))
    hora(ed, 700)
    r700 = json.loads(ed.js(REC))
    ed.js("document.querySelector('.amb-piso-patio').dispatchEvent(new MouseEvent('click', {bubbles: true}))", espera=0.2)   # o chão do pátio também abre
    ST = "JSON.stringify([...document.querySelectorAll('[data-amb-receb]')].map(li=>li.dataset.ambReceb+':'+li.dataset.st))"
    st700 = json.loads(ed.js(ST))
    rb_linhas = ed.js("[...document.querySelectorAll('.amb-ev-linha-receb')].map(tr=>tr.cells[1].textContent)")
    hora(ed, 1000)
    st1000 = json.loads(ed.js(ST))
    abriu30 = ed.js("AMBIENTE._teste.estado().hist")
    certo30 = (int(r600["qtd"]) == base_ro and r600["nota"] == "" and int(r700["qtd"]) == base_ro + 20 and r700["nota"] == "Recebido hoje 10:40 · +20"
               and abriu30 and st700 == ["RB1:ok", "RB2:ok", "RB3:ok", "RB4:previsto", "RB5:previsto"]
               and st1000 == ["RB1:ok", "RB2:ok", "RB3:ok", "RB4:atraso", "RB5:ok"] and len(rb_linhas) == 3 and "Rolamentos Vale Verde" in rb_linhas)
    checa("30. Fábrica: caminhões no pátio; clicar no caminhão abre os recebimentos; situação na hora; item recebido soma e diz 'Recebido hoje'",
          certo30, f"Rolamento às 10:00 {r600} | às 11:40 {r700} (base {base_ro}); 11:40 {st700}; 16:40 {st1000}; no histórico {rb_linhas}")
    clicar_el(ed, ".amb-bt-hist")   # fecha o histórico
    hora(ed, 630)

    # 8. remontar (idioma) guarda o estado; desmontar para a animação
    escolher(ed, "mat")
    filtro(ed, "cat", "ti")
    ed.js("(function(){var b=document.querySelector('[data-amb-busca]'); b.value='mon'; b.dispatchEvent(new Event('input',{bubbles:true}));})()", espera=0.2)
    hora(ed, 700)
    clicar_el(ed, "[data-amb-andar='2']")
    clicar_el(ed, "[data-amb-cam=mais]")
    camera_parada(ed)
    ESTADO8 = ("JSON.stringify({un: document.querySelector('.amb-un.ativa').dataset.ambUn, cat: document.querySelector('[data-amb-f=cat]').value, "
               "busca: document.querySelector('[data-amb-busca]').value, linhas: document.querySelectorAll('tr[data-amb-item]').length, "
               "min: AMBIENTE._teste.estado().minuto, andar: document.querySelector('[data-amb-quadro]').dataset.andarFoco, est: AMBIENTE._teste.estado().estoque, "
               "bonecos: document.querySelectorAll('.amb-boneco').length, vb: document.querySelector('.amb-svg').getAttribute('viewBox')})")
    antes = json.loads(ed.js(ESTADO8))
    clicar_el(ed, "[data-b-lang=en]")
    depois = json.loads(ed.js(ESTADO8))
    titulo = ed.js("document.querySelector('.secao').dataset.titulo")
    checa("8. trocar idioma (desmontar + montar) guarda unidade, filtro, busca, hora, andar, estoque e câmera", antes == depois and titulo == "My workplace",
          f"antes {antes} | depois {depois} | título {titulo}")
    sem_chave, sem_trav = ed.js(TEXTOS)
    clicar_el(ed, "[data-amb-andar='1']")
    rodou = ed.js("AMBIENTE._teste.rodando()")
    ed.js("AMBIENTE.desmontar()")
    q2 = ed.js("AMBIENTE._teste.quadros()")
    ed.esperar(0.8)
    q3 = ed.js("AMBIENTE._teste.quadros()")
    checa("8. desmontar para a animação (nenhum quadro depois)", rodou and not ed.js("AMBIENTE._teste.rodando()") and q3 == q2, f"quadros depois de desmontar: {q3 - q2}")

    # 10. textos (EN acima; PT em cada unidade)
    problemas = [] if (not sem_chave and not sem_trav) else [f"EN: chave={sem_chave} travessão={sem_trav}"]
    ed.js("__bancada.estado.lang='pt'; __bancada.redesenhar()")
    filtro(ed, "cat", "")
    ed.js("(function(){var b=document.querySelector('[data-amb-busca]'); b.value=''; b.dispatchEvent(new Event('input',{bubbles:true}));})()", espera=0.2)
    for u in ("mat", "fab", "cd", "rem"):
        escolher(ed, u)
        c, tv = ed.js(TEXTOS)
        if c or tv:
            problemas.append(f"PT {u}: chave={c} travessão={tv}")
    plantado = ed.js("(function(){var s=document.createElement('span'); s.textContent=' [chave_teste] ' + String.fromCharCode(8212); "
                     "document.querySelector('#ambiente-raiz').appendChild(s); var r=" + TEXTOS + "; s.remove(); return r;})()")
    checa("10. sem [chave] faltando e sem travessão (PT e EN)", not problemas and plantado == [True, True], "; ".join(problemas) or f"controle plantado acusado: {plantado}")

    # 9. Remoto: lista sem mapa
    m9 = json.loads(ed.js("JSON.stringify({mapa: !!document.querySelector('.amb-svg'), linhas: document.querySelectorAll('.amb-rem tbody tr').length, "
                          "vazia: !!document.querySelector('.amb-rem .vazio'), n: +document.querySelector('[data-amb-n]').textContent, min: AMBIENTE._teste.estado().minuto})"))
    esp_rem = esperado(marc, "rem", m9["min"])
    checa("9. Remoto mostra só a lista de quem bateu ponto remoto (sem mapa)", not m9["mapa"] and not m9["vazia"] and m9["linhas"] == m9["n"] == esp_rem,
          f"{m9['linhas']} linhas, cabeçalho {m9['n']}, regra {esp_rem}")
    escolher(ed, "mat")
    ed.js("AMBIENTE._teste.aoVivo()")

    # 13. segundo plano
    ed.js("Object.defineProperty(document, 'hidden', {configurable: true, get: () => true}); document.dispatchEvent(new Event('visibilitychange'))")
    qa = ed.js("AMBIENTE._teste.quadros()")
    ed.esperar(0.6)
    qb, parou = ed.js("[AMBIENTE._teste.quadros(), !AMBIENTE._teste.rodando()]")
    ed.js("delete document.hidden; document.dispatchEvent(new Event('visibilitychange'))")
    checa("13. em segundo plano a animação para, e volta junto com a página", parou and qb == qa and ed.js("AMBIENTE._teste.rodando()"), f"quadros escondida: {qb - qa}")

    # 14. movimento reduzido (estável: espera o relógio dar quadros, até 8 s, em vez de 1,5 s fixos)
    ed.cmd("Emulation.setEmulatedMedia", features=[{"name": "prefers-reduced-motion", "value": "reduce"}])
    ed.js("__bancada.redesenhar()", espera=0.3)
    POS = "JSON.stringify(AMBIENTE._teste.bonecos().map(b => [b.id, b.x.toFixed(3), b.y.toFixed(3)]))"
    p0 = {i: (x, y) for i, x, y in json.loads(ed.js(POS))}
    qa, t0 = ed.js("AMBIENTE._teste.quadros()"), time.time()
    while ed.js("AMBIENTE._teste.quadros()") < qa + 20 and time.time() - t0 < 8:
        ed.esperar(0.3)
    p1 = {i: (x, y) for i, x, y in json.loads(ed.js(POS))}
    qb = ed.js("AMBIENTE._teste.quadros()")
    comuns = [i for i in p0 if i in p1]
    andaram = [i for i in comuns if p0[i] != p1[i]]
    checa("14. movimento reduzido: bonecos parados nos lugares (o relógio continua)", len(comuns) > 10 and not andaram and qb > qa,
          f"{len(comuns)} bonecos comparados, {len(andaram)} se mexeram, {qb - qa} quadros do relógio em {time.time() - t0:.1f} s")
    ed.cmd("Emulation.setEmulatedMedia", features=[])
    ed.js("__bancada.redesenhar()", espera=0.3)

    ms = ed.js("(function(){var T=AMBIENTE._teste, s=document.querySelector('.amb-svg'), t0=performance.now(); for(var i=0;i<300;i++){T.avancar(1/30); s.getBoundingClientRect();} return (performance.now()-t0)/300;})()")
    print(f"   (desempenho: {ed.js('document.querySelectorAll(\".amb-boneco\").length')} bonecos, {ms:.2f} ms por quadro de JS + estilo; o orçamento de 60 fps é 16,7 ms)")

    # 9. ?foto=1: mesmo quadro em duas visitas
    def quadro():
        abrir(ed, "?foto=1")
        escolher(ed, "mat")
        return ed.js("[...document.querySelectorAll('.amb-boneco')].map(e=>e.dataset.id+'@'+e.getAttribute('transform')).sort().join(';')")
    f1, f2 = quadro(), quadro()
    checa("9. ?foto=1 congela o mesmo quadro em duas visitas", f1 == f2 and f1.count("@") > 50, f"{f1.count('@')} bonecos")

    # 19. aba padrão no app
    ed.ir(URL_APP + "?foto=1", espera=0.5)
    t0 = time.time()
    while not ed.js("!!window.__demo && !!document.querySelector('.abas button')") and time.time() - t0 < 60:
        ed.esperar(0.4)
    a19 = json.loads(ed.js("JSON.stringify({aba: window.__demo.estado.aba, primeira: document.querySelector('.abas button').dataset.aba, "
                           "un: document.querySelector('.amb-un.ativa') ? document.querySelector('.amb-un.ativa').dataset.ambUn : '', mapa: !!document.querySelector('.amb-svg')})"))
    ed.ir(URL_APP + "?aba=geral", espera=0.5)
    t0 = time.time()
    while not ed.js("!!window.__demo") and time.time() - t0 < 60:
        ed.esperar(0.4)
    geral = ed.js("window.__demo.estado.aba")
    ed.ir(URL_APP + "?foto=1", espera=0.5)   # sem ?aba= de novo: tem de voltar ao Meu ambiente (não lembra a Visão geral)
    t0 = time.time()
    while not ed.js("!!window.__demo") and time.time() - t0 < 60:
        ed.esperar(0.4)
    voltou = ed.js("window.__demo.estado.aba")
    idioma19 = ed.js("[window.__demo.estado.lang, document.documentElement.lang, document.querySelector('[data-lang=en]').classList.contains('ativo')]")
    checa("19. no app, 'Meu ambiente' é a primeira aba e a padrão, abrindo na Matriz; ?aba=geral abre a Visão geral; 1º acesso em inglês",
          a19 == {"aba": "ambiente", "primeira": "ambiente", "un": "mat", "mapa": True} and geral == "geral" and voltou == "ambiente" and idioma19 == ["en", "en", True],
          f"{a19}; ?aba=geral -> {geral}; sem ?aba= depois -> {voltou}; idioma no 1º acesso {idioma19}")

    # 20. estoque DENTRO do mapa, embaixo dos avisos; recolher; mapa na largura toda (no app, 1440 x 900)
    abrir(ed, "?aba=ambiente&lang=pt&tema=claro&foto=1", URL_APP)
    camera_parada(ed)
    L20 = ("(function(){var m=document.querySelector('.amb-mapa').getBoundingClientRect(), c=document.querySelector('.amb-centro').getBoundingClientRect(),"
           "e=document.querySelector('[data-amb-est]').getBoundingClientRect(), bu=document.querySelector('[data-amb-busca]').getBoundingClientRect(), ab=document.querySelector('[data-amb-aba=estoque]').getBoundingClientRect(),"
           "s=document.querySelector('.amb-est .tb-rolagem'), th=document.querySelector('.amb-inv th');"
           "var r={dentro: e.left>=m.left-1 && e.right<=m.right+1 && e.top>=m.top-1 && e.bottom<=m.bottom+1, buscaNaLinha: Math.abs((bu.top+bu.bottom)/2-(ab.top+ab.bottom)/2) < 6 || bu.height === 0,"
           "larguraToda: Math.abs(m.width-c.width)<2, altEst: Math.round(e.height), conta: document.querySelector('.amb-abas').textContent,"
           "corpoVisivel: !document.querySelector('.amb-est-corpo').hidden, cx: AMBIENTE._teste.cam().cx, zoom: AMBIENTE._teste.cam().zoom,"
           "plantaLivre: [...document.querySelectorAll('.amb-pisos')].every(g => g.getBoundingClientRect().right <= document.querySelector('[data-amb-lateral]').getBoundingClientRect().left + 0.22 * document.querySelector('[data-amb-lateral]').getBoundingClientRect().width),"
           "caixa: (function(){var q=document.querySelector('[data-amb-quadro]').getBoundingClientRect(), bs=[...document.querySelectorAll('.amb-andar')].map(g=>g.getBoundingClientRect()).filter(b=>b.width);"
           "var x0=Math.min(...bs.map(b=>b.left)), x1=Math.max(...bs.map(b=>b.right)), y0=Math.min(...bs.map(b=>b.top)), y1=Math.max(...bs.map(b=>b.bottom));"
           "return {esq: Math.round(x0-q.left), dir: Math.round(q.right-x1), cima: Math.round(y0-q.top), baixo: Math.round(q.bottom-y1)};})(),"
           "linhas: new Set([...document.querySelectorAll('.amb-barra button, .amb-barra select, .amb-barra summary, .amb-barra .amb-q-dica')].filter(x=>x.offsetParent && (!x.checkVisibility || x.checkVisibility())).map(x=>{var b=x.getBoundingClientRect(); return Math.round(b.top+b.height/2);}).map(v=>Math.round(v/12))).size};"
           "if (r.corpoVisivel) { s.scrollTop = 200; var tt=th.getBoundingClientRect().top, st=s.getBoundingClientRect().top; s.scrollTop = 0;"
           "r.rola = s.scrollHeight > s.clientHeight + 20; r.cabecalhoGruda = Math.abs(tt - st) < 2; r.vazaPainel = s.scrollWidth > s.clientWidth + 1; }"
           "return JSON.stringify(r);})()")
    clicar_el(ed, "[data-amb-est-alterna]")   # nasce recolhida: abre para medir
    camera_parada(ed)
    a20 = json.loads(ed.js(L20))
    vaza20 = {}
    for u in ("fab", "cd", "mat"):   # a tabela cabe na janela nas 3 unidades (nomes e áreas diferentes)
        escolher(ed, u)
        vaza20[u] = json.loads(ed.js(L20))["vazaPainel"]
    camera_parada(ed)
    clicar_el(ed, "[data-amb-est-alterna]")
    camera_parada(ed)
    b20 = json.loads(ed.js(L20))
    clicar_el(ed, "[data-amb-est-alterna]")
    camera_parada(ed)
    vbw = ed.js("AMBIENTE_MAPA.VB.w")
    checa("20. janela do estoque dentro do mapa (abas e busca na mesma linha), tabela rolando por dentro (cabeçalho grudado, sem rolagem lateral); a planta inteira cabe à esquerda dele; "
          "a planta enche o pedaço livre, centralizada; recolher deixa só o cabeçalho e a planta enche o quadro todo, centralizada; mapa na largura toda; UMA linha de controles acima do mapa",
          a20["dentro"] and a20["buscaNaLinha"] and a20["larguraToda"] and a20["corpoVisivel"] and a20["rola"] and a20["cabecalhoGruda"] and not a20["vazaPainel"]
          and a20["linhas"] == 1 and a20["plantaLivre"] and not b20["corpoVisivel"] and b20["altEst"] < 56 and "Estoque" in b20["conta"] and "Atenção" in b20["conta"]
          and b20["zoom"] >= a20["zoom"] - 1e-6 and min(a20["caixa"]["cima"], a20["caixa"]["baixo"], a20["caixa"]["esq"]) < 40 and abs(a20["caixa"]["cima"] - a20["caixa"]["baixo"]) < 40
          and abs(b20["caixa"]["esq"] - b20["caixa"]["dir"]) < 40 and abs(b20["caixa"]["cima"] - b20["caixa"]["baixo"]) < 40 and not any(vaza20.values()),
          f"aberto {a20} | recolhido {b20} | rolagem lateral por unidade {vaza20}")

    # 16. clique numa pessoa (no app): gira para o melhor ângulo, aproxima, janela com retrato; Esc volta
    pid = ed.js("document.querySelector('.amb-boneco[data-sala^=\"1-\"]').dataset.id")   # dono de uma salinha do 1º andar
    melhor = ed.js(f"(function(){{var b=AMBIENTE._teste.bonecos().find(x=>x.id==='{pid}'); return AMBIENTE_MAPA.melhorRot(b.x, b.y);}})()")
    clicar_el(ed, f".amb-boneco[data-id='{pid}']")
    c16 = camera_parada(ed)
    f16 = json.loads(ed.js("JSON.stringify({vis: getComputedStyle(document.querySelector('[data-amb-ficha]')).display !== 'none', avatar: !!document.querySelector('.amb-ficha svg.amb-avatar'), "
                           "nome: (document.querySelector('[data-amb-ficha-nome]')||{}).textContent, campos: [...document.querySelectorAll('.amb-ficha dd')].map(d=>d.textContent), "
                           "rot: document.querySelector('.amb-svg').dataset.rot, sel: !!document.querySelector('.amb-boneco.sel[data-id=\"%s\"]'), "
                           "cobre: (function(){var a=document.querySelector('[data-amb-ficha]').getBoundingClientRect(), b=document.querySelector('[data-amb-lateral]').getBoundingClientRect();"
                           "return Math.min(a.right,b.right)-Math.max(a.left,b.left) > 0 && Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top) > 0;})()})" % pid))
    p = json.loads(ed.js(f"JSON.stringify((function(){{var p=DADOS.pessoas.find(x=>x.id==='{pid}'), m=AMBIENTE_DADOS.marcacoes.find(x=>x.id==='{pid}'); "
                         f"return {{nome:p.nome, area:I18N.nome(DADOS.areas[p.area]), nivel:I18N.nome(DADOS.niveis[p.nivel]), entrada:m.entrada}};}})())"))
    hora16 = f"{p['entrada'] // 60:02d}:{p['entrada'] % 60:02d}"
    ed.js("document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}))", espera=0.2)
    c16b = camera_parada(ed)
    fechou16 = ed.js("getComputedStyle(document.querySelector('[data-amb-ficha]')).display === 'none'")
    campos = f16["campos"]
    certo16 = (f16["vis"] and f16["avatar"] and f16["nome"] == p["nome"] and len(campos) == 7 and campos[0] == p["area"] and campos[1] == p["nivel"]
               and campos[3] == "1º andar" and campos[4] == hora16 and f16["sel"] and c16["rot"] == melhor and str(melhor) == f16["rot"] and c16["zoom"] > 2
               and not f16["cobre"] and fechou16 and c16b["tudo"] and c16b["rot"] == 0)
    checa("16. clicar na pessoa gira para o melhor ângulo e aproxima; janela com retrato, nome e 7 dados (com o andar), sem cobrir o estoque; Esc volta à vista geral", certo16,
          f"rot {c16['rot']} (melhor {melhor}), zoom {c16['zoom']:.2f}; {f16['nome']} / {' / '.join(campos)}; cobre o estoque={f16['cobre']}; Esc: zoom {c16b['zoom']}, rot {c16b['rot']}")

    # Fotos DENTRO do app (quadro congelado): Matriz no 1º e no 2º andar; Fábrica com o histórico aberto (pátio e recebimentos)
    FEITAS = []
    abrir(ed, "?aba=ambiente&lang=pt&tema=claro&foto=1", URL_APP)
    camera_parada(ed)
    ed.foto(str(FOTOS / "ambiente_app_matriz_claro.png")); FEITAS.append("ambiente_app_matriz_claro.png")
    clicar_el(ed, "[data-amb-andar='2']")
    ed.esperar(0.6)
    ed.foto(str(FOTOS / "ambiente_app_matriz_andar2.png")); FEITAS.append("ambiente_app_matriz_andar2.png")
    clicar_el(ed, "[data-amb-andar='1']")
    escolher(ed, "fab")
    clicar_el(ed, ".amb-bt-hist")
    camera_parada(ed)
    ed.js("window.scrollTo(0, 0)")
    foto_inteira(ed, FOTOS / "ambiente_app_fabrica_patio.png"); FEITAS.append("ambiente_app_fabrica_patio.png")
    clicar_el(ed, ".amb-bt-hist")

    # 31. idioma em TODAS as abas do app (e nas janelas que abrem: conta do "i", tabela de nomes, histórico, notas, pessoa)
    nomes = json.loads(ed.js("JSON.stringify(DADOS.pessoas.map(p=>p.nome).concat(AMBIENTE_DADOS.recebimentos.map(r=>r.fornecedor)))"))
    nomes += ["C. & Paoli", "Fernando Paoli", "People Analytics", "PEOPLE ANALYTICS"]   # nomes próprios (a disciplina e a empresa fictícia)
    nomes.sort(key=len, reverse=True)
    achados31 = []

    def mensagem(**m):
        m["paoliDemo"] = True
        ed.js(f"window.postMessage({json.dumps(m)}, '*')", espera=0.6)

    for lang in ("pt", "en"):
        for aba in ("geral", "pessoas", "rs"):
            mensagem(lang=lang, aba=aba)
            txt = [ed.js(COLETA)]
            for i in range(ed.js("document.querySelectorAll('[data-conta]').length")):
                ed.js(f"document.querySelectorAll('[data-conta]')[{i}].click()", espera=0.15)
                txt.append(ed.js("(document.querySelector('.conta-pop')||{innerText:''}).innerText"))
                ed.js("document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}))", espera=0.1)
            for i in range(min(ed.js("document.querySelectorAll('[data-drill]').length"), 6)):
                ed.js(f"document.querySelectorAll('[data-drill]')[{i}].dispatchEvent(new MouseEvent('click',{{bubbles:true}}))", espera=0.3)
                txt.append(ed.js("(function(){var g=document.querySelector('.gaveta'); if(!g) return ''; var ini=[...g.querySelectorAll('.avatar-mini')];"
                                 "ini.forEach(e=>e.style.display='none'); var t=g.innerText; ini.forEach(e=>e.style.display=''); return t;})()"))
                ed.js("document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}))", espera=0.15)
            achados31 += [f"{lang}/{aba}: {a}" for a in achados_idioma(lang, "\n".join(txt), nomes)]
        mensagem(lang=lang, aba="ambiente")
        txt = []
        for u in ("mat", "fab", "cd", "rem"):
            escolher(ed, u)
            hora(ed, 1000)
            if not ed.js("AMBIENTE._teste.estado().hist"):
                clicar_el(ed, ".amb-bt-hist")
            ed.js("(function(){var b, n=0; while ((b=document.querySelector('[data-amb-abre]')) && n++ < 6) b.click();})()", espera=0.2)
            if u != "rem":
                clicar_el(ed, "[data-amb-aba=turno]")
                ed.js("document.querySelector('tr[data-amb-pessoa]').click()", espera=0.8)
            txt.append(ed.js(COLETA))
            ed.js("document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}))", espera=0.2)
        achados31 += [f"{lang}/ambiente: {a}" for a in achados_idioma(lang, "\n".join(txt), nomes)]
    # controle: a sonda acusa palavra da outra língua e número no formato errado plantados na tela
    controle31 = (len(achados_idioma("en", "Stock " + "Estoque da unidade 4,2%", [])) >= 2 and len(achados_idioma("pt", "Estoque Stock 4.2%", [])) >= 2)
    checa("31. idioma em todas as abas e janelas do app: em inglês nada em português (acento, palavra, 4,2), em português nada em inglês (palavra, 4.2)",
          not achados31 and controle31, "; ".join(achados31[:6]) or f"4 abas x 2 idiomas, controle={controle31}")
    erros = ed.erros()

# 36. ordenar pelo cabeçalho em toda tabela da aba (bancada congelada no CD às 12:30: há marcações, saídas e
# 4 caminhões em cada sub-aba da Expedição, para toda tabela ter linhas que mudam de lugar)
with Edge(1440, 900) as ed:
    abrir(ed, "?lang=pt&tema=claro&foto=1")
    escolher(ed, "cd")
    hora(ed, 750)
    if not ed.js("AMBIENTE._teste.estado().estoque"):
        clicar_el(ed, "[data-amb-est-alterna]")
    TAB = "[data-amb-tabela] table"
    r36 = {}

    def aba(k):
        ed.js(f"document.querySelector('[data-amb-aba={k}]').click()", espera=0.3)

    def busca(txt):
        def f():
            ed.js("var b=document.querySelector('[data-amb-busca]'); b.value=%s; b.dispatchEvent(new Event('input',{bubbles:true}))" % json.dumps(txt), espera=0.3)
        return f

    def busca_de(col):
        # busca pelas 3 primeiras letras da última linha naquela coluna: filtra de verdade (sobra menos linhas)
        def f():
            txt = ed.js("(function(){var r=[...document.querySelectorAll('[data-amb-tabela] tbody tr')].pop(); return r.cells[%d].innerText.trim().slice(0,3);})()" % col)
            busca(txt)()
        return f

    def area_com_itens():
        # a área com mais itens (a contagem ao lado da opção), para o filtro deixar mais de uma linha
        v = ed.js("(function(){var o=[...document.querySelectorAll('[data-amb-f=area] option')].filter(x=>x.value).map(x=>[x.value, +(x.textContent.match(/\((\d+)\)/)||[0,0])[1]]).sort((a,b)=>b[1]-a[1]); return o[0][0];})()")
        filtro(ed, "area", v)

    def idioma(lang):
        def f():
            ed.js(f"document.querySelector('[data-b-lang={lang}]').click()", espera=0.6)
        return f

    aba("estoque")
    r36["estoque"] = confere(ed, TAB, (3, "num"), 1, area_com_itens)
    filtro(ed, "area", "")
    # troca de aba: Estoque e Atenção dividem a ordem; ordenado por Categoria, a Atenção abre já ordenada
    ed.js(JS_ORDEM)
    clicar_ordem(ed, TAB, 1)
    aba("atencao")
    a36 = ler_ordem(ed, TAB, 1)
    troca_aba = a36["aria"] == [[1, "ascending"]] and em_ordem(ed, a36["vals"], "texto", 1)
    for _ in range(2):
        clicar_ordem(ed, TAB, 1)
    r36["atencao"] = confere(ed, TAB, (3, "num"), 0, busca_de(1))
    busca("")()
    aba("turno")
    r36["turno"] = confere(ed, TAB, (2, "data"), 0, busca_de(0))
    busca("")()
    aba("expedicao")
    n_sub = ed.js("[...document.querySelectorAll('[data-amb-n-sub]')].map(e=>e.textContent).join('/')")
    r36["exp_asair"] = confere(ed, TAB, (3, "data"), 1, busca_de(2))
    busca("")()
    ed.js("document.querySelector('[data-amb-sub=sairam]').click()", espera=0.3)
    r36["exp_sairam"] = confere(ed, TAB, (3, "data"), 1, busca_de(2))
    busca("")()
    n_sub2 = ed.js("[...document.querySelectorAll('[data-amb-n-sub]')].map(e=>e.textContent).join('/')")
    # linha clicável: na Em turno, ordenada por Nome de Z a A, clicar na 1ª linha foca a pessoa DAQUELA linha
    aba("turno")
    ed.js(JS_ORDEM)
    clicar_ordem(ed, TAB, 0)
    clicar_ordem(ed, TAB, 0)
    alvo = ed.js("document.querySelector('[data-amb-tabela] tr[data-amb-pessoa]').getAttribute('data-amb-pessoa')")
    ed.js("document.querySelector('[data-amb-tabela] tr[data-amb-pessoa]').click()", espera=0.8)
    linha_ok = ed.js("AMBIENTE._teste.estado().foco") == alvo
    ed.js("document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}))", espera=0.3)
    clicar_ordem(ed, TAB, 0)
    if not ed.js("AMBIENTE._teste.estado().hist"):
        clicar_el(ed, ".amb-bt-hist")
    r36["historico"] = confere(ed, ".amb-hist-tab", (0, "data"), 1, idioma("en"))
    idioma("pt")()
    escolher(ed, "rem")
    r36["remoto"] = confere(ed, ".amb-rem", (3, "data"), 1, idioma("en"))
    idioma("pt")()
    erros36 = ed.erros()
    ruins = {k: v[1] for k, v in r36.items() if not v[0]}
    checa("36. toda tabela da aba ordena pelo cabeçalho (Estoque, Atenção, Em turno, A sair, Saíram, Histórico, Remoto): número/hora decrescente, "
          "inverte, 3º clique volta linha por linha, texto A-Z, aria-sort; a ordem fica depois do filtro, da busca, da troca de aba e do idioma",
          not ruins and troca_aba and linha_ok and n_sub == n_sub2 and not erros36,
          "; ".join(f"{k}: {v}" for k, v in ruins.items()) or (" | ".join(v[1] for v in r36.values()) + f" | troca de aba={troca_aba} linha clicada={linha_ok} contagens {n_sub}={n_sub2}"))

# foto de uma tabela ordenada DENTRO do app (claro, 1440): o estoque da Fábrica por quantidade, maior primeiro
with Edge(1440, 900) as ed:
    abrir(ed, "?aba=ambiente&lang=pt&tema=claro&foto=1", URL_APP)
    escolher(ed, "fab")
    if not ed.js("AMBIENTE._teste.estado().estoque"):
        clicar_el(ed, "[data-amb-est-alterna]")
    ed.js("document.querySelector('[data-amb-aba=estoque]').click()", espera=0.3)
    ed.js(JS_ORDEM)
    clicar_ordem(ed, "[data-amb-tabela] table", 3)
    ed.js("document.querySelector('[data-amb-est]').scrollIntoView({block:'center'})", espera=0.5)
    ed.foto(str(FOTOS / "ordem_estoque.png"))
    FEITAS.append("ordem_estoque.png")

with Edge(390, 844) as ed:
    abrir(ed, "?aba=ambiente&lang=pt&tema=claro&foto=1", URL_APP)
    iw = ed.js("innerWidth")
    vaz = []
    for u in ("mat", "fab", "cd", "rem", "mat"):
        escolher(ed, u)
        sw = ed.js("document.documentElement.scrollWidth")
        if sw > iw:
            vaz.append(f"{u}: {sw} > {iw}")
    cam390 = ed.js("(function(){var c=document.querySelector('.amb-cam').getBoundingClientRect(), q=document.querySelector('.amb-quadro').getBoundingClientRect(), "
                   "e=document.querySelector('[data-amb-est]').getBoundingClientRect(); return [Math.round(c.top), Math.round(q.bottom), Math.round(e.top)];})()")
    checa("11. celular (390 px, dentro do app) sem vazamento lateral; câmera e estoque embaixo da planta", iw == 390 and not vaz and cam390[0] >= cam390[1] - 1 and cam390[2] >= cam390[1] - 1,
          f"janela {iw}; " + ("; ".join(vaz) or "5 telas") + f"; câmera em {cam390[0]} px, estoque em {cam390[2]} px, planta termina em {cam390[1]} px")
    foto_inteira(ed, FOTOS / "ambiente_app_matriz_390.png")
    FEITAS.append("ambiente_app_matriz_390.png")
    erros += ed.erros()

checa("1. sem erro de JavaScript em nenhuma etapa (bancada e app)", not erros, "; ".join(erros[:3]))
print("\nFotos:\n  " + "\n  ".join(str(FOTOS / n) for n in FEITAS))
print("RESULTADO:", "TUDO OK" if not falhas else f"{len(falhas)} FALHA(S)")
sys.exit(1 if falhas else 0)
