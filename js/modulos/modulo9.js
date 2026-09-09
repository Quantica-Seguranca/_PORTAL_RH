(function() {
    const supabase = window.supabaseClient;
    const getEl = id => document.getElementById(id);

    let chartCategorias = null;
    let chartEmails = null;
    let canalRealtime = null;

    async function initModulo9() {
        if (typeof Chart === 'undefined') {
            console.error("Chart.js não encontrado. Adicione o <script> no index.html.");
            getEl('kpi-colab').textContent = 'Erro';
            return;
        }

        // Configuração global para o visual dos gráficos aderir ao tema escuro
        Chart.defaults.color = '#94a3b8';
        Chart.defaults.borderColor = 'rgba(255, 255, 255, 0.05)';

        await carregarMetricasGerais();
        await carregarGraficoCategorias();
        await carregarGraficoEmails();
        await carregarUltimosAcessos();

        configurarRealtime();
    }

    async function carregarMetricasGerais() {
        // Consome a view executiva consolidada criada no Módulo 9 do SQL
        const { data, error } = await supabase.from('v_dashboard_metricas_gerais').select('*').single();
        if (error || !data) return;

        if(getEl('kpi-colab')) getEl('kpi-colab').textContent = data.total_colaboradores_ativos || 0;
        if(getEl('kpi-docs')) getEl('kpi-docs').textContent = data.documentos_publicados || 0;
        
        const totalAcessos = (Number(data.total_visualizacoes_24h) || 0) + (Number(data.total_downloads_24h) || 0);
        if(getEl('kpi-views')) getEl('kpi-views').textContent = totalAcessos;
        if(getEl('kpi-falhas')) getEl('kpi-falhas').textContent = data.total_emails_falhos || 0;
    }

    async function carregarGraficoCategorias() {
        const { data, error } = await supabase.from('v_dashboard_documentos_categoria').select('*');
        if (error || !data || data.length === 0) return;

        const categorias = data.map(d => d.categoria || 'Geral');
        const totais = data.map(d => d.quantidade_documentos || 0);
        const ctx = getEl('grafico-categorias');
        if (!ctx) return;

        if (chartCategorias) chartCategorias.destroy();
        chartCategorias = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: categorias,
                datasets: [{
                    data: totais,
                    backgroundColor: ['#f59e0b', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6'],
                    borderWidth: 0,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { position: 'right' } },
                cutout: '70%'
            }
        });
    }

    async function carregarGraficoEmails() {
        const { data, error } = await supabase.from('v_dashboard_envios_email_status').select('*').limit(15);
        if (error || !data || data.length === 0) return;

        // Agrupa os envios apenas por data para criar as barras
        const datasU = [...new Set(data.map(d => new Date(d.data_envio).toLocaleDateString('pt-BR')))].reverse();
        const totais = datasU.map(dt => {
            return data.filter(d => new Date(d.data_envio).toLocaleDateString('pt-BR') === dt)
                       .reduce((acc, curr) => acc + Number(curr.total_envios), 0);
        });

        const ctx = getEl('grafico-emails');
        if (!ctx) return;

        if (chartEmails) chartEmails.destroy();
        chartEmails = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: datasU,
                datasets: [{
                    label: 'E-mails Processados',
                    data: totais,
                    backgroundColor: '#3b82f6',
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { display: false } },
                    y: { beginAtZero: true }
                }
            }
        });
    }

    async function carregarUltimosAcessos() {
        const { data, error } = await supabase.from('v_dashboard_ultimos_acessos').select('*').limit(10);
        const tbody = getEl('tabela-ultimos-acessos');
        if (!tbody) return;

        if (error || !data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center">Nenhum acesso registrado no portal ainda.</td></tr>';
            return;
        }

        tbody.innerHTML = '';
        data.forEach(item => {
            const tr = document.createElement('tr');
            const dataFmt = new Date(item.data_acesso).toLocaleString('pt-BR');
            const badgeClass = item.tipo_acesso === 'download' ? 'badge--active' : 'badge--pending';
            
            tr.innerHTML = `
                <td>${dataFmt}</td>
                <td><strong>${item.colaborador_nome || 'Usuário Desconhecido'}</strong></td>
                <td>${item.colaborador_perfil || '-'}</td>
                <td>${item.documento_titulo || 'Documento Removido'}</td>
                <td><span class="badge ${badgeClass}">${item.tipo_acesso}</span></td>
            `;
            tbody.appendChild(tr);
        });
    }

    function configurarRealtime() {
        // Limpa o canal se ele já existir ao trocar de aba
        if (canalRealtime) supabase.removeChannel(canalRealtime);

        // Ouve a inserção em logs de visualizações e atualiza a interface instantaneamente
        canalRealtime = supabase.channel('dashboard-live')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'historico_visualizacoes' }, payload => {
                carregarMetricasGerais();
                carregarUltimosAcessos();
            })
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'historico_downloads' }, payload => {
                carregarMetricasGerais();
                carregarUltimosAcessos();
            })
            .subscribe();
    }

    initModulo9();
})();