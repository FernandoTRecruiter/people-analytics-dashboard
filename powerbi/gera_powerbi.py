# -*- coding: utf-8 -*-
"""
gera_powerbi.py: transforma o dashboard num HTML ÚNICO e numa MEDIDA DAX para o
visual "HTML Content" do Power BI.

Por que precisa de um gerador:
  - o Power BI não lê os arquivos js/ e css/ separados: tudo tem de estar dentro
    de um texto só, e sem internet (as fontes do Google ficam de fora);
  - o DAX tem limite de ~32 mil caracteres por texto, então o HTML vai em pedaços
    (_h1, _h2...) que a medida junta no RETURN, como no organograma em DAX;
  - os dados não vão no código: a medida monta o JSON das suas tabelas com
    CONCATENATEX e põe em window.DADOS_BRUTOS (formato em js/dados-externos.js).

Rodar (na pasta do repositório):  python powerbi/gera_powerbi.py
Saídas em powerbi/:
  dashboard_powerbi.html   o HTML único com a empresa fictícia (abra para conferir)
  MedidaDashboard.dax      a medida para colar no Power BI
  exemplo_pessoas.csv      a empresa fictícia em CSV, no formato do esquema
  exemplo_vagas.csv        as vagas fictícias em CSV
  teste_csv.html           o HTML lendo os CSVs como se fosse o Power BI (prova do adaptador)
"""
import csv, datetime, json, pathlib, re, subprocess, sys

PASTA = pathlib.Path(__file__).resolve().parent
RAIZ = PASTA.parent
LIMITE = 30000  # caracteres por pedaço, já contando as aspas dobradas do DAX


# Passo 1: ler o index.html e pegar os css/js locais, na ordem em que aparecem.
# A aba "Meu ambiente" fica fora: ela só existe com a empresa fictícia (com dado de verdade
# ela se desliga sozinha) e cada arquivo a mais vira mais pedaços de 30 mil caracteres no DAX.
FORA_DO_POWERBI = ("ambiente",)


def arquivos_do_index():
    html = (RAIZ / "index.html").read_text(encoding="utf-8")
    css = re.findall(r'<link rel="stylesheet" href="(css/[^"]+)"', html)
    js = re.findall(r'<script src="(js/[^"]+)"></script>', html)
    fica = lambda caminho: not any(nome in caminho for nome in FORA_DO_POWERBI)
    return [c for c in css if fica(c)], [j for j in js if fica(j)]


# Passo 2: enxugar sem risco. Só sai comentário que começa a linha (cabeçalhos e
# notas); comentário no meio de código fica, para não quebrar texto que tenha "//".
def enxugar(texto):
    saida, dentro = [], False
    for linha in texto.splitlines():
        t = linha.strip()
        if dentro:
            if "*/" in t:
                dentro = False
            continue
        if t.startswith("/*"):
            if "*/" not in t:
                dentro = True
            continue
        if t.startswith("//") or not t:
            continue
        saida.append(linha.rstrip())
    return "\n".join(saida)


def montar_html(dados_js=""):
    css, js = arquivos_do_index()
    estilo = "\n".join(enxugar((RAIZ / c).read_text(encoding="utf-8")) for c in css)
    codigo = "\n".join(enxugar((RAIZ / j).read_text(encoding="utf-8")) for j in js)
    # "</script" dentro do código fecharia a tag antes da hora.
    codigo = codigo.replace("</script", "<\\/script")
    antes = ('<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">'
             '<meta name="viewport" content="width=device-width, initial-scale=1">'
             "<title>Dashboard</title><style>" + estilo + "</style></head>"
             '<body><div id="app"></div><script>window.MODO_POWERBI = true;</script>')
    depois = "<script>" + codigo + "</script></body></html>"
    return antes, depois


# Passo 3: pedaços de texto DAX (aspas viram aspas dobradas) com no máximo LIMITE.
def pedacos_dax(texto):
    pedacos, atual = [], ""
    for ch in texto:
        esc = '""' if ch == '"' else ch
        if len(atual) + len(esc) > LIMITE:
            pedacos.append(atual)
            atual = ""
        atual += esc
    if atual:
        pedacos.append(atual)
    return pedacos


def limpar_texto_dax(coluna):
    # Texto entra no JSON entre aspas: troca aspas, barra invertida e quebra de linha.
    return f'SUBSTITUTE(SUBSTITUTE(SUBSTITUTE({coluna}, """", "\'"), "\\", "/"), UNICHAR(10), " ")'


def campo_texto(nome, coluna, ultimo=False):
    return f'        """{nome}"":""" & {limpar_texto_dax(coluna)} & """{"" if ultimo else ","}" &'


def campo_data(nome, coluna, ultimo=False):
    return f'        """{nome}"":""" & IF(ISBLANK({coluna}), "", FORMAT({coluna}, "yyyy-mm-dd")) & """{"" if ultimo else ","}" &'


def campo_numero(nome, coluna, ultimo=False):
    return f'        """{nome}"":" & IF(ISBLANK({coluna}), "0", FORMAT({coluna}, "0")) & "{"" if ultimo else ","}" &'


def escrever_dax(antes, depois):
    p = "'Pessoas'"
    v = "'Vagas'"
    linhas_pessoas = [
        campo_texto("id", f"{p}[Matricula]"), campo_texto("nome", f"{p}[Nome]"),
        campo_texto("genero", f"{p}[Genero]"), campo_texto("raca", f"{p}[Raca]"),
        campo_data("nascimento", f"{p}[Nascimento]"), campo_texto("area", f"{p}[Area]"),
        campo_texto("unidade", f"{p}[Unidade]"), campo_texto("nivel", f"{p}[Nivel]"),
        campo_texto("vinculo", f"{p}[Vinculo]"), campo_data("admissao", f"{p}[Admissao]"),
        campo_data("desligamento", f"{p}[Desligamento]"), campo_texto("motivo", f"{p}[MotivoDesligamento]", ultimo=True),
    ]
    linhas_vagas = [
        campo_texto("id", f"{v}[Vaga]"), campo_texto("area", f"{v}[Area]"), campo_texto("unidade", f"{v}[Unidade]"),
        campo_texto("nivel", f"{v}[Nivel]"), campo_data("abertura", f"{v}[Abertura]"), campo_data("fechamento", f"{v}[Fechamento]"),
        campo_texto("status", f"{v}[Status]"), campo_texto("etapa", f"{v}[Etapa]"),
        campo_numero("inscritos", f"{v}[Inscritos]"), campo_numero("triagem", f"{v}[Triagem]"),
        campo_numero("entrevistas", f"{v}[Entrevistas]"), campo_numero("ofertas", f"{v}[Ofertas]"),
        campo_numero("contratados", f"{v}[Contratados]", ultimo=True),
    ]
    pa, pd = pedacos_dax(antes), pedacos_dax(depois)
    hoje = datetime.date.today().isoformat()
    out = [
        "DashboardHTML =",
        f"-- Gerado por powerbi/gera_powerbi.py em {hoje}. Os blocos _h saem do gerador: nao edite, rode de novo.",
        "-- PASSO 1: troque 'Pessoas' e 'Vagas' e os nomes entre colchetes pelos do SEU modelo (veja powerbi/LEIA-ME.md).",
        "-- A tabela de pessoas precisa ter ativos E desligados dos ultimos 21 meses (sem desligados nao ha turnover).",
        "",
        "VAR _pessoas =",
        '    "[" & CONCATENATEX(',
        f"        {p},",
        '        "{" &',
        *linhas_pessoas,
        '        "}",',
        '        ","',
        '    ) & "]"',
        "",
        "-- Sem tabela de vagas? Troque o bloco abaixo por:  VAR _vagas = \"[]\"",
        "VAR _vagas =",
        '    "[" & CONCATENATEX(',
        f"        {v},",
        '        "{" &',
        *linhas_vagas,
        '        "}",',
        '        ","',
        '    ) & "]"',
        "",
        "-- Data de corte: o ultimo dia do mes da admissao ou desligamento mais recente.",
        f'VAR _dataRef = FORMAT(EOMONTH(MAX(MAX({p}[Admissao]), MAX({p}[Desligamento])), 0), "yyyy-mm-dd")',
        'VAR _empresa = "Minha empresa"',
        "",
    ]
    for i, t in enumerate(pa, 1):
        out.append(f'VAR _a{i} = "{t}"')
    for i, t in enumerate(pd, 1):
        out.append(f'VAR _d{i} = "{t}"')
    juntar_a = " & ".join(f"_a{i}" for i in range(1, len(pa) + 1))
    juntar_d = " & ".join(f"_d{i}" for i in range(1, len(pd) + 1))
    out += [
        "",
        "RETURN",
        f"    {juntar_a} &",
        '    "<script>window.DADOS_BRUTOS = {""empresa"":""" & _empresa & """,""dataRef"":""" & _dataRef & """,""pessoas"":" & _pessoas & ",""vagas"":" & _vagas & "};</script>" &',
        f"    {juntar_d}",
    ]
    (PASTA / "MedidaDashboard.dax").write_text("\n".join(out) + "\n", encoding="utf-8")
    return len(pa) + len(pd), max(len(x) for x in pa + pd)


# Passo 4: a empresa fictícia em CSV (para testar a medida no Power BI de ponta a ponta).
def exportar_csv():
    js = r"""
    global.window = {}; require(process.argv[1] + '/js/dados.js');
    const D = window.DADOS, iso = d => d ? d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') : '';
    const pessoas = D.pessoas.map(p => ({ Matricula: p.id, Nome: p.nome, Genero: p.genero, Raca: D.racas[p.raca].pt,
      Nascimento: iso(p.nascimento), Area: D.areas[p.area].pt, Unidade: D.unidades[p.unidade].pt, Nivel: D.niveis[p.nivel].pt,
      NivelOrdem: D.niveis[p.nivel].ordem, Vinculo: D.vinculos[p.vinculo].pt, Admissao: iso(p.admissao),
      Desligamento: iso(p.desligamento), MotivoDesligamento: p.motivo ? D.motivos[p.motivo].pt : '' }));
    const vagas = D.vagas.map(v => ({ Vaga: v.id, Area: D.areas[v.area].pt, Unidade: D.unidades[v.unidade].pt, Nivel: D.niveis[v.nivel].pt,
      Abertura: iso(v.abertura), Fechamento: iso(v.fechamento), Status: v.status, Etapa: v.etapa, Inscritos: v.inscritos,
      Triagem: v.triagem, Entrevistas: v.entrevistas, Ofertas: v.ofertas, Contratados: v.contratados }));
    console.log(JSON.stringify({ dataRef: iso(D.dataRef), empresa: D.empresa, pessoas, vagas }));
    """
    saida = subprocess.run(["node", "-e", js, str(RAIZ)], capture_output=True, text=True, encoding="utf-8", check=True).stdout
    dados = json.loads(saida)
    for nome, linhas in (("exemplo_pessoas.csv", dados["pessoas"]), ("exemplo_vagas.csv", dados["vagas"])):
        with open(PASTA / nome, "w", newline="", encoding="utf-8-sig") as f:
            w = csv.DictWriter(f, fieldnames=list(linhas[0].keys()), delimiter=";")
            w.writeheader()
            w.writerows(linhas)
    return dados


# Passo 5: simular o que a medida faz, lendo os CSVs (mesmos campos do DAX).
def html_de_teste(dados):
    pessoas = [{"id": p["Matricula"], "nome": p["Nome"], "genero": p["Genero"], "raca": p["Raca"], "nascimento": p["Nascimento"],
                "area": p["Area"], "unidade": p["Unidade"], "nivel": p["Nivel"], "nivel_ordem": p["NivelOrdem"], "vinculo": p["Vinculo"],
                "admissao": p["Admissao"], "desligamento": p["Desligamento"], "motivo": p["MotivoDesligamento"]} for p in dados["pessoas"]]
    vagas = [{"id": v["Vaga"], "area": v["Area"], "unidade": v["Unidade"], "nivel": v["Nivel"], "abertura": v["Abertura"],
              "fechamento": v["Fechamento"], "status": v["Status"], "etapa": v["Etapa"], "inscritos": v["Inscritos"],
              "triagem": v["Triagem"], "entrevistas": v["Entrevistas"], "ofertas": v["Ofertas"], "contratados": v["Contratados"]} for v in dados["vagas"]]
    bruto = {"empresa": dados["empresa"], "dataRef": dados["dataRef"], "pessoas": pessoas, "vagas": vagas}
    antes, depois = montar_html()
    dados_js = "<script>window.DADOS_BRUTOS = " + json.dumps(bruto, ensure_ascii=False).replace("</", "<\\/") + ";</script>"
    (PASTA / "teste_csv.html").write_text(antes + dados_js + depois, encoding="utf-8")


def main():
    antes, depois = montar_html()
    (PASTA / "dashboard_powerbi.html").write_text(antes + depois, encoding="utf-8")
    n, maior = escrever_dax(antes, depois)
    dados = exportar_csv()
    html_de_teste(dados)
    print(f"HTML único: {len(antes) + len(depois):,} caracteres".replace(",", "."))
    print(f"MedidaDashboard.dax: {n} pedaços de HTML, o maior com {maior:,} caracteres (limite {LIMITE:,})".replace(",", "."))
    print(f"CSVs de exemplo: {len(dados['pessoas'])} pessoas, {len(dados['vagas'])} vagas")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()
