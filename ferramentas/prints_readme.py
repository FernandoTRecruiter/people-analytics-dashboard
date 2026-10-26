# -*- coding: utf-8 -*-
"""
prints_readme.py: refaz as imagens do README (docs/img/).

Por que existe: print feito à mão envelhece calado. Mudou um cartão, o README continua
mostrando o antigo. Com este script basta rodar de novo depois de mexer na tela.

Passo a passo: abre o index.html num Edge ou Chrome escondido, liga o que cada foto
precisa (aba, tema, o "i" aberto, o modo tabela aberto) e fotografa a tela.

Rodar:  pip install websocket-client pillow
        python ferramentas/prints_readme.py
"""
import base64, io, pathlib, sys
from PIL import Image
sys.stdout.reconfigure(encoding="utf-8")
RAIZ = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ / "tests"))
from cdp_util import Edge

URL = (RAIZ / "index.html").as_uri()
SEM_SUAVE = "document.documentElement.style.scrollBehavior='auto';"
# arquivo -> (parâmetros do endereço, JS que prepara a tela antes da foto)
PRINTS = {
    "docs/img/visao-geral.png": ("aba=geral&lang=pt&tema=claro", "window.scrollTo(0, 0)"),
    # o "i" do Turnover aberto: a conta por trás do número, já com os filtros da tela
    "docs/img/conta-por-tras.png": ("aba=geral&lang=pt&tema=claro",
                                    "document.querySelector('.info[data-conta=\"turnover\"]').click()"),
    # modo tabela: clicar na maior área da lista "por área" mostra quem está ali (nomes fictícios)
    "docs/img/modo-tabela.png": ("aba=geral&lang=pt&tema=claro",
                                 "document.querySelector('.lb-linha.clicavel[data-drill^=\"area:\"]').click()"),
    "docs/img/pessoas-en-escuro.png": ("aba=pessoas&lang=en&tema=escuro", "window.scrollTo(0, 0)"),
    "docs/img/meu-ambiente.png": ("aba=ambiente&lang=pt&tema=claro", "document.querySelector('.amb-topo').scrollIntoView({block: 'start'})"),
}


if __name__ == "__main__":
    with Edge(1440, 900) as ed:
        for destino, (params, preparar) in PRINTS.items():
            ed.eventos.clear()
            ed.ir(URL + "?" + params, espera=4)
            try:
                ed.js(SEM_SUAVE + preparar, espera=1.5)
            except RuntimeError as e:
                print("PULEI", destino, "| a tela não tem o que o print precisa:", str(e)[:90])
                continue
            r = ed.cmd("Page.captureScreenshot", format="png")
            Image.open(io.BytesIO(base64.b64decode(r["data"]))).save(RAIZ / destino, optimize=True)
            print("OK", destino, "| erros JS:", len(ed.erros()))
