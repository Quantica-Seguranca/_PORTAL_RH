(function() {
    const supabase = window.supabaseClient;
    const getEl = id => document.getElementById(id);

    const stateModulo7 = {
        logs: [],
        paginacao: { pagina: 1, limite: 15, total: 0 },
        filtros: { busca: '', acao: '', data: '' }
    };

    async function initModulo7() {
        configurarEventos();
        carregarEstatisticas();
        carregarLogs();
    }

    async function carregarEstatisticas() {
        // Carrega KPIs simples para a gestão
        const { count: total } = await supabase.from('logs_auditoria').select('*', { count: 'exact', head: true });
        const { count: falhas } = await supabase.from('logs_auditoria').select('*', { count: 'exact', head: true }).eq('acao', 'FALHA_LOGIN');
        const { count: criticas } = await supabase.from('logs_auditoria').select('*', { count: 'exact', head: true }).eq('acao', 'DELETE');

        getEl('audit-total').textContent = total || 0;
        getEl('audit-falhas').textContent = falhas || 0;
        getEl('audit-criticas').textContent = criticas || 0;
    }

    async function carregarLogs() {
        const { pagina, limite } = stateModulo7.paginacao;
        const inicio = (pagina - 1) * limite;
        const fim = inicio + limite - 1;

        let query = supabase.from('logs_auditoria').select('*', { count: 'exact' });

        if (stateModulo7.filtros.acao) query = query.eq('acao', stateModulo7.filtros.acao);
        if (stateModulo7.filtros.data) {
            const dataF = stateModulo7.filtros.data;
            query = query.gte('criado_em', `${dataF}T00:00:00`).lte('criado_em', `${dataF}T23:59:59`);
        }
        if (stateModulo7.filtros.busca) {
            query = query.or(`usuario_email.ilike.%${stateModulo7.filtros.busca}%,tabela_afetada.ilike.%${stateModulo7.filtros.busca}%`);
        }

        const { data, count, error } = await query.order('criado_em', { ascending: false }).range(inicio, fim);

        if (error) {
            getEl('tabela-auditoria').innerHTML = '<tr><td colspan="5" class="text-center" style="color:red;">Erro ao carregar auditoria.</td></tr>';
            return;
        }

        stateModulo7.logs = data || [];
        stateModulo7.paginacao.total = count || 0;
        
        renderizarLogs();
        atualizarPaginacao();
    }

    function renderizarLogs() {
        const tbody = getEl('tabela-auditoria');
        tbody.innerHTML = '';

        if (stateModulo7.logs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center">Nenhum registro encontrado.</td></tr>';
            return;
        }

        stateModulo7.logs.forEach(log => {
            const dataHora = new Date(log.criado_em).toLocaleString('pt-BR');
            let acaoClass = 'badge--inactive';
            if (log.acao === 'INSERT') acaoClass = 'badge--active';
            else if (log.acao === 'UPDATE') acaoClass = 'badge--pending';
            else if (log.acao === 'DELETE') acaoClass = 'badge--blocked';

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${dataHora}</td>
                <td><strong>${log.usuario_email || 'Sistema'}</strong></td>
                <td><span class="badge ${acaoClass}">${log.acao}</span></td>
                <td>${log.tabela_afetada || '-'}</td>
                <td class="actions">
                    <button class="btn-icon btn-ver-detalhes" data-id="${log.id}" title="Ver alterações">🔍</button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        document.querySelectorAll('.btn-ver-detalhes').forEach(btn => {
            btn.addEventListener('click', (e) => abrirModal(e.target.dataset.id));
        });
    }

    function atualizarPaginacao() {
        const { pagina, limite, total } = stateModulo7.paginacao;
        const totalPaginas = Math.ceil(total / limite) || 1;
        getEl('info-pag-audit').textContent = `Página ${pagina} de ${totalPaginas} (${total} registros)`;
        getEl('btn-ant-audit').disabled = pagina <= 1;
        getEl('btn-prox-audit').disabled = pagina >= totalPaginas;
    }

    function abrirModal(id) {
        const log = stateModulo7.logs.find(l => l.id === id);
        if (!log) return;

        getEl('audit-info-extra').textContent = `Registro ID: ${log.registro_id || 'N/A'}`;
        
        // Formata os JSONs para exibição amigável
        const formatarJson = (obj) => obj ? JSON.stringify(obj, null, 2) : 'Nenhum dado.';
        
        getEl('audit-dados-ant').textContent = formatarJson(log.dados_anteriores);
        getEl('audit-dados-nov').textContent = formatarJson(log.dados_novos);

        getEl('modal-audit').style.display = 'flex';
    }

    function exportarCSV() {
        if (stateModulo7.logs.length === 0) return alert('Não há dados para exportar.');
        
        const cabecalho = "Data,Usuario,Acao,Tabela\n";
        const linhas = stateModulo7.logs.map(log => {
            return `"${new Date(log.criado_em).toLocaleString('pt-BR')}","${log.usuario_email || 'Sistema'}","${log.acao}","${log.tabela_afetada || ''}"`;
        }).join("\n");

        const blob = new Blob([cabecalho + linhas], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `auditoria_${new Date().getTime()}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }

    function configurarEventos() {
        let timer;
        getEl('busca-audit').addEventListener('input', (e) => {
            clearTimeout(timer);
            timer = setTimeout(() => {
                stateModulo7.filtros.busca = e.target.value.trim();
                stateModulo7.paginacao.pagina = 1;
                carregarLogs();
            }, 400);
        });

        getEl('filtro-acao-audit').addEventListener('change', (e) => {
            stateModulo7.filtros.acao = e.target.value;
            stateModulo7.paginacao.pagina = 1;
            carregarLogs();
        });

        getEl('filtro-data-audit').addEventListener('change', (e) => {
            stateModulo7.filtros.data = e.target.value;
            stateModulo7.paginacao.pagina = 1;
            carregarLogs();
        });

        getEl('btn-ant-audit').addEventListener('click', () => {
            if (stateModulo7.paginacao.pagina > 1) { stateModulo7.paginacao.pagina--; carregarLogs(); }
        });
        
        getEl('btn-prox-audit').addEventListener('click', () => {
            const { pagina, limite, total } = stateModulo7.paginacao;
            if (pagina < Math.ceil(total / limite)) { stateModulo7.paginacao.pagina++; carregarLogs(); }
        });

        getEl('btn-exportar-audit').addEventListener('click', exportarCSV);
        getEl('fechar-modal-audit').addEventListener('click', () => getEl('modal-audit').style.display = 'none');
    }

    initModulo7();
})();