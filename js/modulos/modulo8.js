(function() {
    const supabase = window.supabaseClient;
    const getEl = id => document.getElementById(id);

    // Mapeamento das Views criadas no Módulo 8 do banco de dados[cite: 9]
    const CONFIG_RELATORIOS = {
        colaboradores: {
            titulo: 'Efetivo por Status e Empresa',
            view: 'v_relatorio_colaboradores_status',
            colunas: [
                { chave: 'empresa_razao_social', titulo: 'Empresa / Posto' },
                { chave: 'departamento_nome', titulo: 'Departamento' },
                { chave: 'perfil', titulo: 'Perfil' },
                { chave: 'status', titulo: 'Status' },
                { chave: 'total_colaboradores', titulo: 'Total' }
            ],
            campoData: 'ultimo_cadastro'
        },
        documentos: {
            titulo: 'Produção Documental por Período',
            view: 'v_relatorio_documentos_periodo',
            colunas: [
                { chave: 'mes_cadastro', titulo: 'Mês de Cadastro', data: true },
                { chave: 'empresa_razao_social', titulo: 'Empresa' },
                { chave: 'tipo', titulo: 'Tipo do Documento' },
                { chave: 'status', titulo: 'Status' },
                { chave: 'total_documentos', titulo: 'Qtd. Total' },
                { chave: 'documentos_pendentes_assinatura', titulo: 'Pendentes' }
            ],
            campoData: 'mes_cadastro'
        },
        falhas_proc: {
            titulo: 'Falhas de Processamento Operacional',
            view: 'v_relatorio_falhas_processamento',
            colunas: [
                { chave: 'dia_falha', titulo: 'Data da Falha', data: true },
                { chave: 'empresa_razao_social', titulo: 'Empresa' },
                { chave: 'categoria', titulo: 'Categoria' },
                { chave: 'severidade', titulo: 'Severidade' },
                { chave: 'total_falhas', titulo: 'Total' },
                { chave: 'falhas_pendentes', titulo: 'Não Resolvidos' }
            ],
            campoData: 'dia_falha'
        },
        falhas_email: {
            titulo: 'Status de Envio de E-mails',
            view: 'v_relatorio_falhas_email',
            colunas: [
                { chave: 'dia_envio', titulo: 'Data de Envio', data: true },
                { chave: 'template', titulo: 'Modelo Utilizado' },
                { chave: 'status', titulo: 'Status' },
                { chave: 'total_emails', titulo: 'Total Disparado' },
                { chave: 'emails_falhos', titulo: 'Falhas / Rejeitados' }
            ],
            campoData: 'dia_envio'
        }
    };

    const stateModulo8 = {
        relatorioAtivo: 'colaboradores',
        dados: [],
        paginacao: { pagina: 1, limite: 15, total: 0 }
    };

    function initModulo8() {
        configurarAbas();
        configurarEventos();
        montarCabecalhoTabela();
    }

    function configurarAbas() {
        const botoes = document.querySelectorAll('.tab-report-btn');
        botoes.forEach(btn => {
            btn.addEventListener('click', (e) => {
                botoes.forEach(b => { b.classList.remove('btn-primary'); b.classList.add('btn-secondary'); });
                e.target.classList.remove('btn-secondary'); 
                e.target.classList.add('btn-primary');
                
                stateModulo8.relatorioAtivo = e.target.getAttribute('data-report');
                stateModulo8.paginacao.pagina = 1;
                stateModulo8.dados = [];
                
                getEl('titulo-relatorio-ativo').textContent = CONFIG_RELATORIOS[stateModulo8.relatorioAtivo].titulo;
                montarCabecalhoTabela();
                getEl('report-tbody').innerHTML = '<tr><td class="text-center" colspan="10">Clique em "Gerar Relatório" para visualizar.</td></tr>';
            });
        });
    }

    function montarCabecalhoTabela() {
        const config = CONFIG_RELATORIOS[stateModulo8.relatorioAtivo];
        const thead = getEl('report-thead');
        let html = '<tr>';
        config.colunas.forEach(col => {
            html += `<th>${col.titulo}</th>`;
        });
        html += '</tr>';
        thead.innerHTML = html;
    }

    async function gerarRelatorio() {
        const config = CONFIG_RELATORIOS[stateModulo8.relatorioAtivo];
        const btn = getEl('btn-gerar-relatorio');
        btn.textContent = 'Gerando...';
        btn.disabled = true;

        const { pagina, limite } = stateModulo8.paginacao;
        const inicio = (pagina - 1) * limite;
        const fim = inicio + limite - 1;

        let query = supabase.from(config.view).select('*', { count: 'exact' });

        // Filtros
        const dataInicio = getEl('filtro-data-inicio').value;
        const dataFim = getEl('filtro-data-fim').value;
        const status = getEl('filtro-status-relatorio').value;

        if (dataInicio) query = query.gte(config.campoData, `${dataInicio}T00:00:00`);
        if (dataFim) query = query.lte(config.campoData, `${dataFim}T23:59:59`);
        if (status) query = query.ilike('status', `%${status}%`); // Funciona se a view tiver a coluna status

        const { data, count, error } = await query.range(inicio, fim);

        btn.textContent = 'Gerar Relatório';
        btn.disabled = false;

        if (error) {
            getEl('report-tbody').innerHTML = `<tr><td colspan="10" style="color:var(--danger-600); text-center">Erro ao carregar: ${error.message}</td></tr>`;
            return;
        }

        stateModulo8.dados = data || [];
        stateModulo8.paginacao.total = count || 0;
        
        renderizarTabela();
        atualizarPaginacao();
    }

    function renderizarTabela() {
        const config = CONFIG_RELATORIOS[stateModulo8.relatorioAtivo];
        const tbody = getEl('report-tbody');
        tbody.innerHTML = '';

        if (stateModulo8.dados.length === 0) {
            tbody.innerHTML = `<tr><td colspan="${config.colunas.length}" class="text-center">Nenhum dado encontrado para os filtros selecionados.</td></tr>`;
            return;
        }

        stateModulo8.dados.forEach(linha => {
            const tr = document.createElement('tr');
            let html = '';
            config.colunas.forEach(col => {
                let valor = linha[col.chave] ?? '-';
                if (col.data && valor !== '-') {
                    valor = new Date(valor).toLocaleDateString('pt-BR');
                }
                html += `<td>${valor}</td>`;
            });
            tr.innerHTML = html;
            tbody.appendChild(tr);
        });
    }

    function atualizarPaginacao() {
        const { pagina, limite, total } = stateModulo8.paginacao;
        const totalPaginas = Math.ceil(total / limite) || 1;
        getEl('info-pag-report').textContent = `Página ${pagina} de ${totalPaginas} (${total} registros)`;
        getEl('btn-ant-report').disabled = pagina <= 1;
        getEl('btn-prox-report').disabled = pagina >= totalPaginas;
    }

    // Exportação com BOM para Excel ler acentos[cite: 9]
    function exportarCSV() {
        if (stateModulo8.dados.length === 0) return alert('Gere o relatório primeiro.');
        const config = CONFIG_RELATORIOS[stateModulo8.relatorioAtivo];
        
        const cabecalho = config.colunas.map(c => `"${c.titulo}"`).join(';') + '\n';
        const linhas = stateModulo8.dados.map(linha => {
            return config.colunas.map(col => {
                let v = linha[col.chave] ?? '';
                if (col.data && v) v = new Date(v).toLocaleDateString('pt-BR');
                return `"${String(v).replace(/"/g, '""')}"`;
            }).join(';');
        }).join('\n');

        const blob = new Blob(['\uFEFF' + cabecalho + linhas], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Relatorio_${stateModulo8.relatorioAtivo}_${new Date().getTime()}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }

    // Impressão nativa do navegador[cite: 9]
    function imprimirRelatorio() {
        if (stateModulo8.dados.length === 0) return alert('Gere o relatório primeiro.');
        const config = CONFIG_RELATORIOS[stateModulo8.relatorioAtivo];
        
        let thead = '<tr>' + config.colunas.map(c => `<th>${c.titulo}</th>`).join('') + '</tr>';
        let tbody = stateModulo8.dados.map(linha => {
            return '<tr>' + config.colunas.map(col => {
                let v = linha[col.chave] ?? '-';
                if (col.data && v !== '-') v = new Date(v).toLocaleDateString('pt-BR');
                return `<td>${v}</td>`;
            }).join('') + '</tr>';
        }).join('');

        const htmlImpressao = `
            <html>
            <head>
                <title>${config.titulo} - SecurePatrim</title>
                <style>
                    body { font-family: sans-serif; padding: 20px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
                    th { background-color: #f4f4f4; }
                </style>
            </head>
            <body onload="window.print()">
                <h2>${config.titulo}</h2>
                <p>Gerado em: ${new Date().toLocaleString('pt-BR')}</p>
                <table><thead>${thead}</thead><tbody>${tbody}</tbody></table>
            </body>
            </html>
        `;

        const janela = window.open('', '_blank');
        janela.document.write(htmlImpressao);
        janela.document.close();
    }

    function configurarEventos() {
        getEl('btn-gerar-relatorio').addEventListener('click', () => {
            stateModulo8.paginacao.pagina = 1;
            gerarRelatorio();
        });
        
        getEl('btn-exportar-csv').addEventListener('click', exportarCSV);
        getEl('btn-imprimir').addEventListener('click', imprimirRelatorio);

        getEl('btn-ant-report').addEventListener('click', () => {
            if (stateModulo8.paginacao.pagina > 1) { stateModulo8.paginacao.pagina--; gerarRelatorio(); }
        });
        getEl('btn-prox-report').addEventListener('click', () => {
            const { pagina, limite, total } = stateModulo8.paginacao;
            if (pagina < Math.ceil(total / limite)) { stateModulo8.paginacao.pagina++; gerarRelatorio(); }
        });
    }

    initModulo8();
})();