(function() {
    // Usa a conexão global do chassi
    const supabase = window.supabaseClient;
    const getEl = (id) => document.getElementById(id);

    const stateModulo3 = {
        usuarioAtual: null,
        dadosColaborador: null
    };

    // ==========================================
    // SISTEMA DE ABAS
    // ==========================================
    function inicializarAbas() {
        const botoes = document.querySelectorAll('.tab-btn');
        const abas = document.querySelectorAll('.tab-content');

        botoes.forEach(btn => {
            btn.addEventListener('click', (e) => {
                // Reseta todos os botões para secondary
                botoes.forEach(b => {
                    b.classList.remove('btn-primary');
                    b.classList.add('btn-secondary');
                });
                // Ativa o botão clicado
                e.target.classList.remove('btn-secondary');
                e.target.classList.add('btn-primary');

                // Esconde todas as abas e mostra a selecionada
                abas.forEach(aba => aba.style.display = 'none');
                const targetId = e.target.getAttribute('data-target');
                getEl(targetId).style.display = 'block';
            });
        });
    }

    // ==========================================
    // CARREGAMENTO DE DADOS DO ASP
    // ==========================================
    async function carregarSessao() {
        const { data: { user }, error } = await supabase.auth.getUser();
        
        if (error || !user) {
            getEl('perfil-dados').innerHTML = '<p style="color: var(--danger-600);">Usuário não autenticado. Faça login novamente.</p>';
            return;
        }
        
        stateModulo3.usuarioAtual = user;
        await buscarProntuario(user.email);
    }

    async function buscarProntuario(email) {
        // Busca o colaborador atrelado ao e-mail logado
        const { data, error } = await supabase
            .from('colaboradores')
            .select('*')
            .eq('email', email)
            .single();

        if (error || !data) {
            getEl('perfil-dados').innerHTML = '<p style="color: var(--warning-600);">Nenhum prontuário operacional vinculado a este e-mail.</p>';
            return;
        }

        stateModulo3.dadosColaborador = data;
        renderizarPerfil(data);
        carregarHolerites(data.id, data.matricula);
        carregarDocumentos(data.id);
        carregarHistorico(data.id);
    }

    function renderizarPerfil(colab) {
        getEl('perfil-dados').innerHTML = `
            <div><span style="color: var(--primary-500); font-size: 0.8rem; text-transform: uppercase;">Matrícula</span><br><strong style="color: var(--white); font-size: 1.1rem;">${colab.matricula || '-'}</strong></div>
            <div><span style="color: var(--primary-500); font-size: 0.8rem; text-transform: uppercase;">Nome Completo</span><br><strong style="color: var(--white); font-size: 1.1rem;">${colab.nome_completo || '-'}</strong></div>
            <div><span style="color: var(--primary-500); font-size: 0.8rem; text-transform: uppercase;">Cargo</span><br><strong style="color: var(--white); font-size: 1.1rem;">${colab.cargo || '-'}</strong></div>
            <div><span style="color: var(--primary-500); font-size: 0.8rem; text-transform: uppercase;">Posto / Empresa</span><br><strong style="color: var(--white); font-size: 1.1rem;">${colab.setor || '-'} / ${colab.empresa || '-'}</strong></div>
            <div><span style="color: var(--primary-500); font-size: 0.8rem; text-transform: uppercase;">Situação</span><br><span class="badge ${colab.status === 'Ativo' ? 'badge--active' : 'badge--inactive'} mt-1">${colab.status || 'Ativo'}</span></div>
        `;
    }

    async function carregarHolerites(colaboradorId, matricula) {
        const tbody = getEl('tabela-holerites-asp');
        if (!tbody) return;

        // Consulta unificada na tabela 'holerites' considerando tanto o ID quanto a matrícula extraída
        const { data, error } = await supabase
            .from('holerites')
            .select('*')
            .or(`colaborador_id.eq.${colaboradorId},matricula_colaborador.eq.${matricula}`)
            .order('criado_em', { ascending: false });

        if (error || !data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center" style="text-align: center; padding: 1rem;">Nenhum holerite disponível.</td></tr>';
            return;
        }

        tbody.innerHTML = '';
        data.forEach(item => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${item.competencia || 'Junho de 2026'}</td>
                <td>${item.nome_arquivo || 'Holerite.pdf'}</td>
                <td><span class="badge badge--active">Disponível</span></td>
                <td class="actions" style="text-align: center;">
                    <button class="btn btn-sm btn-primary" onclick="window.open('${item.url_arquivo || '#'}', '_blank')">Baixar PDF</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    async function carregarDocumentos(colaboradorId) {
        const tbody = getEl('tabela-documentos-asp');
        if (!tbody) return;

        const { data, error } = await supabase
            .from('documentos')
            .select('*')
            .eq('colaborador_id', colaboradorId)
            .order('criado_em', { ascending: false });

        if (error || !data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center" style="text-align: center; padding: 1rem;">Nenhum documento na pasta.</td></tr>';
            return;
        }

        tbody.innerHTML = '';
        data.forEach(doc => {
            const tr = document.createElement('tr');
            const dataCriacao = new Date(doc.criado_em).toLocaleDateString('pt-BR');
            tr.innerHTML = `
                <td><strong>${doc.nome_arquivo || 'Documento'}</strong></td>
                <td>${doc.categoria_id || 'PDF'}</td>
                <td>${dataCriacao}</td>
                <td class="actions" style="text-align: center;">
                    <button class="btn btn-sm btn-secondary" onclick="window.open('${doc.storage_path || '#'}', '_blank')">Visualizar</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    async function carregarHistorico(colaboradorId) {
        const tbody = getEl('tabela-historico-asp');
        if (!tbody) return;

        const { data, error } = await supabase
            .from('historico_downloads')
            .select('*')
            .eq('colaborador_id', colaboradorId)
            .order('baixado_em', { ascending: false })
            .limit(10);

        if (error || !data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" class="text-center" style="text-align: center; padding: 1rem;">Nenhum download registrado.</td></tr>';
            return;
        }

        tbody.innerHTML = '';
        data.forEach(log => {
            const tr = document.createElement('tr');
            const dataHora = new Date(log.baixado_em).toLocaleString('pt-BR');
            tr.innerHTML = `
                <td>${dataHora}</td>
                <td><span class="badge badge--pending">Download Efetuado</span></td>
                <td style="font-family: monospace; font-size: 0.8rem;">${log.ip_acesso || '-'}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    // ==========================================
    // INICIALIZAÇÃO
    // ==========================================
    function initModulo3() {
        inicializarAbas();
        carregarSessao();
    }

    initModulo3();
})();