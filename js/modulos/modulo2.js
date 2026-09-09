(function() {
    // Referência à conexão global do Chassi
    const supabase = window.supabaseClient;

    const stateModulo2 = {
        colaboradores: [],
        paginacao: { pagina: 1, limite: 10, total: 0 },
        filtros: { busca: '', empresa: '', situacao: 'Ativo' },
        edicaoId: null
    };

    // Referências do DOM
    const getEl = (id) => document.getElementById(id);

    // ==========================================
    // CARREGAMENTO E LISTAGEM
    // ==========================================
    async function carregarColaboradores() {
        const { pagina, limite } = stateModulo2.paginacao;
        const inicio = (pagina - 1) * limite;
        const fim = inicio + limite - 1;

        let query = supabase.from('colaboradores').select('*', { count: 'exact' });

        if (stateModulo2.filtros.situacao) {
            query = query.eq('situacao', stateModulo2.filtros.situacao);
        }
        if (stateModulo2.filtros.busca) {
            const termo = stateModulo2.filtros.busca.trim();
            query = query.or(`nome_completo.ilike.%${termo}%,cpf.ilike.%${termo}%,matricula.ilike.%${termo}%`);
        }

        query = query.order('nome_completo', { ascending: true }).range(inicio, fim);

        const { data, error, count } = await query;

        if (error) {
            console.error('Erro ao carregar ASPs:', error.message);
            getEl('tabelaColaboradores').innerHTML = '<tr><td colspan="6" class="text-center" style="color:red;">Erro ao carregar dados.</td></tr>';
            return;
        }

        stateModulo2.colaboradores = data || [];
        stateModulo2.paginacao.total = count || 0;
        
        renderizarTabela();
        atualizarPaginacao();
        aplicarPermissoesInterface();
    }

    function renderizarTabela() {
        const tbody = getEl('tabelaColaboradores');
        tbody.innerHTML = '';

        if (stateModulo2.colaboradores.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">Nenhum colaborador encontrado.</td></tr>';
            return;
        }

        const perfilUsuario = window.userPerfil || 'colaborador';
        const ehOperacional = perfilUsuario === 'operacional';

        stateModulo2.colaboradores.forEach(col => {
            const tr = document.createElement('tr');
            
            // Se for operacional, ocultamos a coluna de ações de edição
            let colunaAcoes = '';
            if (!ehOperacional) {
                colunaAcoes = `<td class="actions">
                    <button class="btn-icon is-edit btn-editar-colab" data-id="${col.id}" title="Editar Prontuário">✏️</button>
                </td>`;
            } else {
                colunaAcoes = `<td class="actions" style="color: var(--primary-400); font-size: 0.75rem;">Apenas Leitura</td>`;
            }

            tr.innerHTML = `
                <td><strong>${col.matricula || '-'}</strong></td>
                <td>
                    <div style="font-weight: 600; color: var(--white);">${col.nome_completo}</div>
                    <div style="font-size: 0.75rem; color: var(--primary-400);">${col.cargo || '-'}</div>
                </td>
                <td>${col.cpf || '-'}</td>
                <td>
                    <div>${col.empresa || '-'}</div>
                    <div style="font-size: 0.75rem; color: var(--primary-400);">${col.setor || '-'}</div>
                </td>
                <td><span class="badge ${col.situacao === 'Ativo' ? 'badge--active' : 'badge--inactive'}">${col.situacao}</span></td>
                ${colunaAcoes}
            `;
            tbody.appendChild(tr);
        });

        // Adiciona eventos aos botões de edição apenas se não for operacional
        if (!ehOperacional) {
            document.querySelectorAll('.btn-editar-colab').forEach(btn => {
                btn.addEventListener('click', (e) => abrirModal(e.target.dataset.id));
            });
        }
    }

    function aplicarPermissoesInterface() {
        const perfilUsuario = window.userPerfil || 'colaborador';
        const btnNovo = getEl('btnNovoColaborador');

        // Se o usuário for operacional, removemos a capacidade de cadastrar novos registros
        if (perfilUsuario === 'operacional' && btnNovo) {
            btnNovo.style.display = 'none';
        }
    }

    function atualizarPaginacao() {
        const { pagina, limite, total } = stateModulo2.paginacao;
        const totalPaginas = Math.ceil(total / limite) || 1;
        
        getEl('infoPaginacaoColaboradores').textContent = `Página ${pagina} de ${totalPaginas} (${total} registros)`;
        getEl('btnAnteriorColab').disabled = pagina <= 1;
        getEl('btnProximoColab').disabled = pagina >= totalPaginas;
    }

    // ==========================================
    // CRUD E MODAIS
    // ==========================================
    function abrirModal(id = null) {
        const perfilUsuario = window.userPerfil || 'colaborador';
        if (perfilUsuario === 'operacional') {
            alert('Acesso negado. O perfil operacional possui apenas permissão de leitura.');
            return;
        }

        stateModulo2.edicaoId = id;
        getEl('formColaborador').reset();
        
        if (id) {
            getEl('tituloModalColaborador').textContent = 'Editar Colaborador';
            const col = stateModulo2.colaboradores.find(c => c.id === id);
            if (col) {
                getEl('txtNome').value = col.nome_completo || '';
                getEl('txtCpf').value = col.cpf || '';
                getEl('txtEmail').value = col.email || '';
                getEl('txtTelefone').value = col.telefone || '';
                getEl('txtMatricula').value = col.matricula || '';
                getEl('selSituacao').value = col.situacao || 'Ativo';
                getEl('txtCargo').value = col.cargo || '';
                getEl('txtEmpresa').value = col.empresa || '';
                getEl('txtSetor').value = col.setor || '';
                getEl('txtDataAdmissao').value = col.data_admissao || '';
            }
        } else {
            getEl('tituloModalColaborador').textContent = 'Cadastrar Novo Colaborador';
        }
        
        getEl('modalColaborador').style.display = 'flex';
    }

    function fecharModal() {
        getEl('modalColaborador').style.display = 'none';
        stateModulo2.edicaoId = null;
    }

    async function salvarColaborador(e) {
        e.preventDefault();
        
        const perfilUsuario = window.userPerfil || 'colaborador';
        if (perfilUsuario === 'operacional') {
            alert('Acesso negado.');
            return;
        }

        const payload = {
            nome_completo: getEl('txtNome').value.trim(),
            cpf: getEl('txtCpf').value.trim(),
            email: getEl('txtEmail').value.trim(),
            telefone: getEl('txtTelefone').value.trim(),
            matricula: getEl('txtMatricula').value.trim(),
            situacao: getEl('selSituacao').value,
            cargo: getEl('txtCargo').value.trim(),
            empresa: getEl('txtEmpresa').value.trim(),
            setor: getEl('txtSetor').value.trim(),
            data_admissao: getEl('txtDataAdmissao').value || null
        };

        const btn = getEl('btnSalvarColaborador');
        btn.textContent = 'Salvando...';
        btn.disabled = true;

        let error;
        if (stateModulo2.edicaoId) {
            const result = await supabase.from('colaboradores').update(payload).eq('id', stateModulo2.edicaoId);
            error = result.error;
        } else {
            const result = await supabase.from('colaboradores').insert([payload]);
            error = result.error;
        }

        btn.textContent = 'Salvar Registro';
        btn.disabled = false;

        if (error) {
            alert(`Erro ao salvar: ${error.message}`);
            return;
        }

        fecharModal();
        carregarColaboradores();
    }

    // ==========================================
    // INICIALIZAÇÃO E EVENTOS
    // ==========================================
    function initModulo2() {
        const perfilUsuario = window.userPerfil || 'colaborador';

        const btnNovo = getEl('btnNovoColaborador');
        if (btnNovo) {
            if (perfilUsuario === 'operacional') {
                btnNovo.style.display = 'none';
            } else {
                btnNovo.addEventListener('click', () => abrirModal());
            }
        }

        getEl('btnFecharModalColab').addEventListener('click', fecharModal);
        getEl('btnCancelarModalColab').addEventListener('click', fecharModal);
        getEl('formColaborador').addEventListener('submit', salvarColaborador);

        // Filtros e Buscas
        let debounceTimer;
        getEl('txtBuscaColaborador').addEventListener('input', (e) => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                stateModulo2.filtros.busca = e.target.value;
                stateModulo2.paginacao.pagina = 1;
                carregarColaboradores();
            }, 400);
        });

        getEl('selFiltroSituacao').addEventListener('change', (e) => {
            stateModulo2.filtros.situacao = e.target.value;
            stateModulo2.paginacao.pagina = 1;
            carregarColaboradores();
        });

        // Paginação
        getEl('btnAnteriorColab').addEventListener('click', () => {
            if (stateModulo2.paginacao.pagina > 1) {
                stateModulo2.paginacao.pagina--;
                carregarColaboradores();
            }
        });

        getEl('btnProximoColab').addEventListener('click', () => {
            const { pagina, limite, total } = stateModulo2.paginacao;
            if (pagina < Math.ceil(total / limite)) {
                stateModulo2.paginacao.pagina++;
                carregarColaboradores();
            }
        });

        carregarColaboradores();
    }

    // Dispara a inicialização assim que o script for injetado
    initModulo2();
})();