/* =============================================================================
   i18n.js: todo texto da tela, em português e inglês, num lugar só.

   Por que separado: no painel de gestores que inspirou esta demo, parte da
   liderança não fala português. Texto espalhado pelo código = tradução que
   esquece um botão. Aqui, chave que falta aparece entre colchetes na tela.
   ============================================================================= */
window.I18N = (function () {
  'use strict';
  const D = {
    eyebrow: ['PEOPLE ANALYTICS · DEMONSTRAÇÃO', 'PEOPLE ANALYTICS · DEMO'],
    titulo_exec: ['Dashboard', 'Dashboard'], sub_exec: ['Executivo', 'Executive'],
    ficticio: ['dados fictícios, gerados no seu navegador', 'fictional data, generated in your browser'],
    tema_claro: ['Claro', 'Light'], tema_escuro: ['Escuro', 'Dark'],
    idioma: ['Idioma', 'Language'], secoes: ['Seções da página', 'Page sections'],
    numeros_de: ['Números de', 'Numbers as of'],
    dica_data: ['Pessoas e vagas: fechamento do mês. Cada número é recalculado no seu navegador a partir de uma empresa sorteada com semente fixa (mesmo resultado em toda visita).',
      'People and vacancies: month-end close. Every number is recomputed in your browser from a company drawn with a fixed seed (same result on every visit).'],
    aba_geral: ['Visão geral', 'Overview'], aba_pessoas: ['Pessoas', 'People'], aba_rs: ['Recrutamento', 'Recruiting'],
    aba_ambiente: ['Meu ambiente', 'My workplace'],
    // filtros
    f_periodo: ['Período', 'Period'], f_unidade: ['Unidade', 'Unit'], f_area: ['Área', 'Area'],
    f_vinculo: ['Vínculo', 'Contract'], f_genero: ['Gênero', 'Gender'], f_nivel: ['Nível', 'Level'],
    limpar: ['Limpar', 'Clear'], todos: ['Todos', 'All'],
    p12: ['Últimos 12 meses', 'Last 12 months'], pano: ['{a} até {m}', '{a} to {m}'],
    panoant: ['Ano de {a}', 'Year {a}'], ptudo: ['Tudo ({n} meses)', 'All ({n} months)'],
    fonte_real: ['dados do relatório', 'report data'],
    g_F: ['Mulheres', 'Women'], g_M: ['Homens', 'Men'], g_N: ['Não informado', 'Not stated'],
    // alertas
    alertas: ['alertas', 'alerts'], alerta: ['alerta', 'alert'], sem_alerta: ['Nenhum alerta com estes filtros', 'No alerts with these filters'],
    al_turnover: ['Turnover anualizado de {a} em {v}, acima de 25%', 'Annualized turnover in {a} at {v}, above 25%'],
    al_vagas: ['{n} vagas abertas há mais de 60 dias', '{n} vacancies open for over 60 days'],
    al_novatos: ['Retenção de novatos em {v}, abaixo de 80%', 'New-hire retention at {v}, below 80%'],
    al_prazo: ['{n} contratos com prazo terminam em até 60 dias (aprendiz, estágio, temporário)', '{n} fixed-term contracts end within 60 days (apprentice, intern, temporary)'],
    ir: ['Ir', 'Go'],
    // seções
    s_onde: ['Onde estamos', 'Where we stand'], s_evolucao: ['Evolução do quadro', 'Headcount trend'],
    s_por_area: ['Por área', 'By area'], s_por_nivel: ['Por nível', 'By level'],
    s_rs_resumo: ['Recrutamento em resumo', 'Recruiting at a glance'],
    s_quadro: ['Quadro', 'Headcount'], s_turnover: ['Turnover e movimentações', 'Turnover & movements'],
    s_diversidade: ['Diversidade', 'Diversity'], s_pessoas: ['Colaboradores', 'Employees'],
    s_rs_geral: ['Vagas e contratações', 'Vacancies & hires'], s_funil: ['Funil de seleção', 'Selection funnel'],
    s_abertas: ['Vagas abertas', 'Open vacancies'], s_ttf: ['Tempo para contratar', 'Time to fill'],
    // indicadores
    k_hc: ['Quadro', 'Headcount'], k_movs: ['Entradas e saídas', 'Joins and exits'],
    k_turnover: ['Turnover', 'Turnover'], k_casa: ['Tempo médio de casa', 'Average tenure'],
    k_mulheres: ['Mulheres', 'Women'], k_vagas: ['Vagas abertas', 'Open vacancies'],
    k_saiu: ['Pessoas que saíram', 'People who left'], k_antes: ['Tempo de casa antes de sair', 'Time here before leaving'],
    k_novatos: ['Retenção de novatos', 'New-hire retention'], k_lider: ['Mulheres na liderança', 'Women in leadership'],
    k_ppi: ['Pretos, pardos e indígenas', 'Black, brown and indigenous'], k_idade: ['Idade média', 'Average age'],
    k_contrat: ['Contratações', 'Hires'], k_ttf: ['Tempo para contratar', 'Time to fill'],
    k_aceite: ['Aceite de oferta', 'Offer acceptance'], k_inscritos: ['Inscritos', 'Applicants'],
    saldo: ['saldo', 'net'], no_periodo: ['no período', 'in the period'], anualizado: ['anualizado', 'annualized'],
    de: ['de', 'of'], anos: ['anos', 'years'], ano: ['ano', 'year'], meses: ['meses', 'months'], dias: ['dias', 'days'],
    pessoas: ['pessoas', 'people'], mediana: ['mediana', 'median'], ativos: ['ativos', 'active'],
    st_saudavel: ['Saudável', 'Healthy'], st_atencao: ['Atenção', 'Watch'], st_alto: ['Alto', 'High'],
    st_boa: ['Boa', 'Good'], st_baixa: ['Baixa', 'Low'],
    ficou_ano: ['ficaram um ano inteiro', 'stayed a full year'], sairam_1ano: ['saíram no 1º ano', 'left within a year'],
    lideres: ['nos níveis de liderança', 'in leadership levels'], informados: ['com raça informada', 'with race stated'],
    // saídas
    quem_conta: ['Quem conta como saída', 'Who counts as leaving'],
    t_pedido: ['Só pedidos de demissão', 'Only resignations'], t_demissao: ['Só demissões', 'Only dismissals'],
    t_outro: ['Só outros', 'Only other'], t_todos: ['Todos que saíram', 'Everyone who left'],
    fim_fora: ['fim de contrato fica fora da taxa', 'end of contract stays out of the rate'],
    como_conta: ['como é contado', 'how it is counted'],
    turnover_mensal: ['Turnover mensal', 'Monthly turnover'], por_motivo: ['Saídas por motivo', 'Exits by reason'],
    casa_saida: ['Tempo de casa de quem saiu', 'Tenure of who left'],
    leg_15: ['≤15% ao ano', '≤15% a year'], leg_25: ['≤25%', '≤25%'], leg_acima: ['acima', 'above'],
    // diversidade
    genero_nivel: ['Gênero por nível', 'Gender by level'], raca: ['Raça e cor', 'Race'], faixa_idade: ['Faixa etária', 'Age band'],
    por_unidade: ['Por unidade', 'By unit'], por_vinculo: ['Por vínculo', 'By contract'],
    // tabela
    buscar: ['Buscar nome, área ou nível', 'Search name, area or level'],
    c_nome: ['Nome', 'Name'], c_area: ['Área', 'Area'], c_nivel: ['Nível', 'Level'], c_vinculo: ['Vínculo', 'Contract'],
    c_unidade: ['Unidade', 'Unit'], c_admissao: ['Admissão', 'Hire date'], c_casa: ['Tempo de casa', 'Tenure'],
    c_vaga: ['Vaga', 'Vacancy'], c_aberta_ha: ['Aberta há', 'Open for'], c_etapa: ['Etapa', 'Stage'],
    c_prioridade: ['Prioridade', 'Priority'], c_inscritos: ['Inscritos', 'Applicants'],
    linhas: ['linhas', 'rows'], anterior: ['Anterior', 'Previous'], proxima: ['Próxima', 'Next'],
    sem_linhas: ['Nada com esses filtros', 'Nothing with these filters'],
    e_triagem: ['Triagem', 'Screening'], e_entrevistas: ['Entrevistas', 'Interviews'], e_oferta: ['Oferta', 'Offer'],
    pr_alta: ['Alta', 'High'], pr_normal: ['Normal', 'Normal'],
    funil_inscritos: ['Inscritos', 'Applied'], funil_triagem: ['Triagem', 'Screened'],
    funil_entrevistas: ['Entrevistas', 'Interviewed'], funil_ofertas: ['Ofertas', 'Offers'],
    funil_contratados: ['Contratados', 'Hired'], conversao: ['conversão', 'conversion'],
    // explicações (o "como é contado" de cada número)
    x_titulo: ['Como é contado', 'How it is counted'], x_fechar: ['Fechar', 'Close'],
    x_hc: ['pessoas ativas no último dia do período', 'people active on the last day of the period'],
    x_movs: ['admissões e desligamentos com data dentro do período', 'hires and exits dated inside the period'],
    x_turnover: ['saídas do tipo escolhido ÷ quadro médio dos meses do período', 'exits of the chosen type ÷ average monthly headcount in the period'],
    x_casa: ['média de (data de referência − admissão) de quem está ativo', 'average of (reference date − hire date) for active people'],
    x_novatos: ['contratados há 12 a 24 meses que completaram 1 ano ÷ todos contratados nessa janela', 'hired 12 to 24 months ago who completed 1 year ÷ everyone hired in that window'],
    x_antes: ['média do tempo de casa no dia da saída', 'average tenure on the exit date'],
    x_mulheres: ['mulheres ativas ÷ pessoas ativas', 'active women ÷ active people'],
    x_lider: ['mulheres em Coordenação, Gerência e Diretoria ÷ pessoas nesses níveis', 'women in Coordinator, Manager and Director levels ÷ people in those levels'],
    x_ppi: ['pretos + pardos + indígenas ÷ ativos com raça informada', 'black + brown + indigenous ÷ active people with race stated'],
    x_idade: ['média da idade na data de referência', 'average age on the reference date'],
    x_vagas: ['vagas sem data de fechamento na data de referência', 'vacancies with no closing date on the reference date'],
    x_contrat: ['vagas fechadas com contratação dentro do período', 'vacancies closed with a hire inside the period'],
    x_ttf: ['mediana de dias entre abrir e fechar a vaga (vagas fechadas no período)', 'median days between opening and closing (vacancies closed in the period)'],
    x_aceite: ['contratações ÷ ofertas feitas no período', 'hires ÷ offers made in the period'],
    x_partes: ['Com os filtros de agora', 'With the current filters'],
    numerador: ['numerador', 'numerator'], denominador: ['denominador', 'denominator'], resultado: ['resultado', 'result'],
    rodape: ['Demonstração do portfólio de Fernando Paoli. Inspirada em painéis reais de People Analytics, reescrita do zero com dados fictícios.',
      "Fernando Paoli's portfolio demo. Inspired by real People Analytics dashboards, rewritten from scratch with fictional data."],
    ver_portfolio: ['Ver portfólio', 'See portfolio'],
    resumo_onde: ['Desde {d}: {s} saíram · {e} entraram', 'Since {d}: {s} left · {e} joined'],
    abrir_rs: ['Abrir recrutamento', 'Open recruiting'],
    faixa_comum: ['faixa mais comum', 'most common band'],
    // visão geral nova
    s_resumo: ['Resumo do período', 'Period summary'], s_mov: ['Entradas e saídas por mês', 'Joins and exits by month'],
    s_composicao: ['Composição do quadro', 'Headcount composition'], s_genero_lid: ['Gênero e liderança', 'Gender and leadership'],
    ins_quadro: ['O quadro foi de {a} para {b} pessoas ({d}).', 'Headcount went from {a} to {b} people ({d}).'],
    ins_maior: ['A maior área é {a}: {n} pessoas, {p} do quadro.', 'The largest area is {a}: {n} people, {p} of headcount.'],
    ins_saidas: ['Quem mais perdeu gente foi {a}: {s} saídas no período.', '{a} lost the most people: {s} exits in the period.'],
    ins_turn: ['Turnover ({t}) de {v} ao ano: {st}.', 'Turnover ({t}) at {v} a year: {st}.'],
    ins_vagas: ['{n} vagas abertas; {m} delas há mais de 60 dias.', '{n} open vacancies; {m} of them open for over 60 days.'],
    ins_mulheres: ['Mulheres são {p} do quadro e {l} da liderança.', 'Women are {p} of headcount and {l} of leadership.'],
    clique_nomes: ['clique para ver os nomes', 'click to see the names'],
    liderancaF: ['das lideranças são mulheres', 'of leaders are women'],
    // tabela de nomes (clique nos visuais)
    g_titulo: ['Quem está neste número', 'Who is in this number'], g_baixar: ['Baixar CSV', 'Download CSV'],
    g_fechar: ['Fechar', 'Close'], g_buscar: ['Buscar nome', 'Search name'],
    c_saida: ['Saída', 'Exit date'], c_motivo: ['Motivo', 'Reason'], c_movimento: ['Movimento', 'Movement'],
    mov_entrou: ['Entrou', 'Joined'], mov_saiu: ['Saiu', 'Left'],
    d_quadro: ['Quadro em {d}', 'Headcount on {d}'], d_entradas: ['Entradas no período', 'Joins in the period'],
    d_saidas: ['Saídas no período', 'Exits in the period'], d_tipo: ['Saídas que contam no turnover', 'Exits counted in turnover'],
    d_mes: ['Entradas e saídas em {m}', 'Joins and exits in {m}'], d_saidas_mes: ['Saídas em {m} ({t})', 'Exits in {m} ({t})'],
    d_novatos: ['Contratados há 12 a 24 meses', 'Hired 12 to 24 months ago'], d_lider: ['Liderança', 'Leadership'],
    ficou: ['Ficou 1 ano', 'Stayed 1 year'], nao_ficou: ['Saiu antes de 1 ano', 'Left within a year'],
    vaga_1: ['vaga', 'vacancy'], vagas_n: ['vagas', 'vacancies'],
    al_vagas_1: ['1 vaga aberta há mais de 60 dias', '1 vacancy open for over 60 days'],
    al_prazo_1: ['1 contrato com prazo termina em até 60 dias (aprendiz, estágio, temporário)', '1 fixed-term contract ends within 60 days (apprentice, intern, temporary)'],
    leg_in: ['entradas', 'joins'], leg_out: ['saídas', 'exits'], fim_de_mes: ['fim de cada mês', 'end of each month']
  };
  let lang = 'pt';
  function T(chave, vars) {
    const par = D[chave];
    let txt = par ? par[lang === 'en' ? 1 : 0] : '[' + chave + ']';
    if (vars) Object.keys(vars).forEach(k => { txt = txt.split('{' + k + '}').join(vars[k]); });
    return txt;
  }
  return {
    T,
    get lang() { return lang; },
    set lang(v) { lang = v === 'en' ? 'en' : 'pt'; },
    // Nome de cadastro (área, nível...) no idioma da tela.
    nome(obj) { return obj ? (lang === 'en' ? obj.en : obj.pt) : ''; },
    locale() { return lang === 'en' ? 'en-US' : 'pt-BR'; }
  };
})();
