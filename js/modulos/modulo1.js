window.modulo1Initialized = undefined;

if (typeof window.modulo1Initialized === 'undefined') {
    window.modulo1Initialized = true;

    const stateModulo1 = {
        users: [],
        pagination: { page: 1, limit: 10, total: 0, search: '' },
        selectedUserId: null
    };

    const HIERARQUIA = {
        'master': 5, 'gestor': 4, 'gerente': 3,
        'admin': 2, 'operador': 1, 'operacional': 1, 'colaborador': 0
    };

    function injetarCSSMobile() {
        if (document.getElementById('css-mobile-modulo1')) return;
        const style = document.createElement('style');
        style.id = 'css-mobile-modulo1';
        style.innerHTML = `
            .table-wrapper { overflow-x: auto; -webkit-overflow-scrolling: touch; width: 100%; }
            .table-wrapper table { min-width: 650px; }
            .acoes-tabela { display: flex; gap: 0.5rem; justify-content: center; align-items: center; flex-wrap: wrap; }

            .modal-historico-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); display: none; justify-content: center; align-items: center; z-index: 9999; }
            .modal-historico-content { background: var(--primary-900, #1a1a1a); border: 1px solid var(--accent-500, #f0a500); width: 90%; max-width: 800px; max-height: 85vh; border-radius: 8px; padding: 1.5rem; display: flex; flex-direction: column; }
            .modal-historico-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
            .modal-historico-body { overflow-y: auto; flex: 1; }
            .modal-historico-body table { width: 100%; border-collapse: collapse; color: white; font-size: 0.85rem; }
            .modal-historico-body th, .modal-historico-body td { padding: 0.75rem; border-bottom: 1px solid var(--primary-800, #333); text-align: left; }
            .modal-historico-body th { background: var(--primary-800, #222); color: var(--accent-500, #f0a500); }

            @media (max-width: 768px) {
                #painel-edicao-usuario { padding: 1rem !important; }
                #form-editar-privilegios .form-row { grid-template-columns: 1fr !important; gap: 0 !important; }
                #form-editar-privilegios .form-row > div { margin-bottom: 0.75rem; }
                #pagination-container { flex-direction: column; text-align: center; gap: 1rem; }
                .acoes-tabela { flex-direction: column; }
                .acoes-tabela button { width: 100%; margin-left: 0 !important; }
                #form-editar-privilegios > div:last-child { flex-direction: column; }
                #form-editar-privilegios > div:last-child button { width: 100%; margin-bottom: 0.5rem; }
            }
        `;
        document.head.appendChild(style);
    }

    function obterPerfilLogado() {
        return (window.userPerfil || localStorage.getItem('user_role') || 'colaborador').toLowerCase();
    }

    function temPermissaoCustom(acao) {
        if (obterPerfilLogado() === 'master' || obterPerfilLogado() === 'gestor') return true;
        return window.userPermissoes && window.userPermissoes[acao] === true;
    }

    function getEl(id) { return document.getElementById(id); }

    function formatDate(isoString) {
        if (!isoString) return '-';
        return new Date(isoString).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' });
    }

    // NOVA FUNÇÃO: Trilha de Auditoria (Grava quem fez o quê)
    async function registrarAuditoria(emailAlvo, acao, detalhes) {
        try {
            const { data: { session } } = await window.supabaseClient.auth.getSession();
            const autor = session ? session.user.email : 'Sistema';
            await window.supabaseClient.from('historico_acessos').insert([{
                usuario_email: emailAlvo,
                acao: acao,
                detalhes: `${detalhes} (Autor da ação: ${autor})`
            }]);
        } catch (e) { console.error('Erro de auditoria:', e); }
    }

    // NOVA FUNÇÃO: Exportar Tabela para Planilha CSV
    function exportarRelatorioCSV() {
        if (stateModulo1.users.length === 0) return alert('Nenhum dado para exportar.');
        
        let csvContent = "Nome Completo,E-mail,Cargo,Perfil,Status,Matricula,Data de Cadastro\n";
        
        stateModulo1.users.forEach(u => {
            const nome = (u.nome_completo || '').replace(/,/g, ''); // Remove vírgulas para não quebrar o CSV
            const cargo = (u.cargo || '').replace(/,/g, '');
            const dataCad = formatDate(u.criado_em).replace(/,/g, ' ');
            csvContent += `"${nome}","${u.email}","${cargo}","${u.perfil}","${u.status}","${u.matricula || ''}","${dataCad}"\n`;
        });

        const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' }); // \uFEFF força o Excel a ler acentos em UTF-8
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `Relatorio_Efetivo_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        registrarAuditoria('Geral', 'Exportação de Dados', 'Baixou o relatório geral de efetivo.');
    }

    async function loadModulo1Data() {
        try { await Promise.allSettled([loadStatistics(), loadUsers(), loadPreCadastros()]); } 
        catch (e) { console.error('Erro no carregamento:', e); }
    }

    async function loadStatistics() {
        try {
            const perfilLogado = obterPerfilLogado();
            const { data, error } = await window.supabaseClient.from('colaboradores').select('*');
            if (error) return;

            const lista = (data || []).filter(u => !(u.perfil === 'master' && perfilLogado !== 'master'));
            const ativos = lista.filter(u => (u.status || 'Ativo').toLowerCase() === 'ativo').length;
            const operadores = lista.filter(u => ['operacional', 'operador'].includes(u.perfil)).length;
            const admins = lista.filter(u => ['admin', 'gerente', 'gestor', 'master'].includes(u.perfil)).length;

            if(getEl('stat-total')) getEl('stat-total').textContent = lista.length;
            if(getEl('stat-active')) getEl('stat-active').textContent = ativos;
            if(getEl('stat-operators')) getEl('stat-operators').textContent = operadores;
            if(getEl('stat-admins')) getEl('stat-admins').textContent = admins;
        } catch (e) { console.error(e); }
    }

    async function loadUsers() {
        try {
            const perfilLogado = obterPerfilLogado();
            const { page, limit, search } = stateModulo1.pagination;
            const start = (page - 1) * limit;
            const end = start + limit - 1;

            let query = window.supabaseClient.from('colaboradores').select('*', { count: 'exact' }).order('nome_completo', { ascending: true });
            if (perfilLogado !== 'master') query = query.neq('perfil', 'master');
            if (search) query = query.or(`nome_completo.ilike.%${search}%,email.ilike.%${search}%`);

            const { data, error, count } = await query.range(start, end);
            if (error) return;

            stateModulo1.users = data || [];
            stateModulo1.pagination.total = count || 0;
            
            renderUsersTable();
            renderPaginationControls();
        } catch (e) { console.error(e); }
    }

    function renderPaginationControls() {
        const containerTabela = document.getElementById('users-table-body');
        if (!containerTabela) return;

        let paginationContainer = document.getElementById('pagination-container');
        if (!paginationContainer) {
            paginationContainer = document.createElement('div');
            paginationContainer.id = 'pagination-container';
            paginationContainer.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 1rem; color: var(--primary-300, #ccc); font-size: 0.875rem;';
            const wrapper = containerTabela.closest('.table-wrapper') || containerTabela.parentElement;
            if (wrapper) { wrapper.classList.add('table-wrapper'); wrapper.after(paginationContainer); }
        }

        const { page, limit, total } = stateModulo1.pagination;
        const totalPages = Math.ceil(total / limit) || 1;

        paginationContainer.innerHTML = `
            <span>Página <strong>${page}</strong> de <strong>${totalPages}</strong> (${total} registos)</span>
            <div style="display: flex; gap: 0.5rem;">
                <button id="btn-prev-page" class="btn btn-sm btn-secondary" ${page <= 1 ? 'disabled style="opacity: 0.5;"' : ''}>Anterior</button>
                <button id="btn-next-page" class="btn btn-sm btn-secondary" ${page >= totalPages ? 'disabled style="opacity: 0.5;"' : ''}>Próxima</button>
            </div>
        `;

        if (getEl('btn-prev-page')) getEl('btn-prev-page').onclick = () => { if (page > 1) { stateModulo1.pagination.page--; loadUsers(); } };
        if (getEl('btn-next-page')) getEl('btn-next-page').onclick = () => { if (page < totalPages) { stateModulo1.pagination.page++; loadUsers(); } };
    }

    async function loadPreCadastros() {
        try {
            const tbody = getEl('pre-cadastros-table-body');
            if (!tbody) return;

            const { data, error } = await window.supabaseClient.from('pre_cadastros').select('*').eq('status', 'pendente').order('criado_em', { ascending: false });

            if (error || !data || data.length === 0) {
                tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--primary-300, #aaa); padding: 1rem;">Nenhuma solicitação pendente.</td></tr>`;
                return;
            }

            tbody.innerHTML = '';
            data.forEach(pre => {
                const tr = document.createElement('tr');
                tr.style.borderBottom = '1px solid var(--primary-800, #333)';
                tr.innerHTML = `
                    <td style="padding: 0.75rem;">${pre.nome || '-'}</td>
                    <td style="padding: 0.75rem;">${pre.email || '-'}</td>
                    <td style="padding: 0.75rem;">${pre.cpf || '-'}</td>
                    <td style="padding: 0.75rem;">${formatDate(pre.criado_em)}</td>
                    <td style="padding: 0.75rem;">
                        <div class="acoes-tabela">
                            <button class="btn btn-sm btn-aprovar" data-id="${pre.id}" data-email="${pre.email}" data-nome="${pre.nome}" data-senha="${pre.senha_temporaria || '123456'}" style="background: var(--success-600); color: white; border: none; padding: 0.3rem 0.75rem; border-radius: 4px; cursor: pointer;">Aprovar</button>
                            <button class="btn btn-sm btn-rejeitar" data-id="${pre.id}" data-email="${pre.email}" style="background: var(--danger-600); color: white; border: none; padding: 0.3rem 0.75rem; border-radius: 4px; cursor: pointer;">Rejeitar</button>
                        </div>
                    </td>
                `;
                tbody.appendChild(tr);
            });
            atacharEventosPreCadastros();
        } catch (e) { console.error(e); }
    }

    function atacharEventosPreCadastros() {
        document.querySelectorAll('.btn-aprovar').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const { id, email, nome, senha } = e.target.dataset;
                const { error: authError } = await window.supabaseClient.auth.signUp({ email, password: senha });
                if (authError && !authError.message.includes('already registered')) return alert('Erro Auth: ' + authError.message);

                const { error: insertError } = await window.supabaseClient.from('colaboradores').insert([{
                    nome_completo: nome, email: email, perfil: 'colaborador', matricula: 'MAT-' + Math.floor(Math.random() * 9000 + 1000), status: 'Ativo',
                    permissoes: { ver_admin: false, gerir_acessos: false, excluir_usuarios: false }
                }]);

                if (insertError) return alert('Erro ao aprovar: ' + insertError.message);
                await window.supabaseClient.from('pre_cadastros').update({ status: 'aprovado' }).eq('id', id);
                
                // Grava a auditoria da aprovação
                await registrarAuditoria(email, 'Pré-Cadastro Aprovado', 'Credencial gerada e acesso autorizado.');
                
                alert('Aprovado com sucesso!');
                loadModulo1Data();
            });
        });

        document.querySelectorAll('.btn-rejeitar').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                if (!confirm('Rejeitar solicitação?')) return;
                const { id, email } = e.target.dataset;
                await window.supabaseClient.from('pre_cadastros').update({ status: 'rejeitado' }).eq('id', id);
                await registrarAuditoria(email, 'Pré-Cadastro Rejeitado', 'Solicitação foi negada e descartada.');
                loadPreCadastros();
            });
        });
    }

    function renderUsersTable() {
        const tbody = getEl('users-table-body');
        if (!tbody) return;
        tbody.innerHTML = '';

        if (!stateModulo1.users || stateModulo1.users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center" style="text-align: center; padding: 1rem;">Nenhum usuário encontrado.</td></tr>';
            return;
        }

        const perfilLogado = obterPerfilLogado();
        const nivelLogado = HIERARQUIA[perfilLogado] || 0;
        
        const podeConcederAcessos = temPermissaoCustom('gerir_acessos');
        const podeExcluir = temPermissaoCustom('excluir_usuarios');
        const podeVerHistorico = ['master', 'gestor'].includes(perfilLogado);

        stateModulo1.users.forEach((user) => {
            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid var(--primary-800, #333)';
            
            const statusAtual = user.status || 'Ativo';
            const perfilAtual = user.perfil || 'colaborador';
            const nivelAlvo = HIERARQUIA[perfilAtual] || 0;

            let botaoHistorico = podeVerHistorico 
                ? `<button class="btn btn-sm btn-historico" data-email="${user.email}" data-nome="${user.nome_completo}" style="background: var(--primary-600, #5a6268); color: white; padding: 0.3rem 0.5rem; border: none; border-radius: 4px; cursor: pointer;">Histórico</button>` 
                : '';

            let botaoGerir = podeConcederAcessos
                ? `<button class="btn btn-sm btn-gerir" data-id="${user.id}" style="background: var(--info-600, #17a2b8); color: white; padding: 0.3rem 0.5rem; border: none; border-radius: 4px; cursor: pointer;">Gerir</button>`
                : `<button class="btn btn-sm btn-gerir" data-id="${user.id}" style="background: var(--primary-700, #555); color: #bbb; padding: 0.3rem 0.5rem; border: none; border-radius: 4px; cursor: pointer;">Info</button>`;

            let botaoExcluir = (podeExcluir && nivelLogado >= nivelAlvo)
                ? `<button class="btn btn-sm btn-excluir" data-id="${user.id}" style="background-color: var(--danger-600, #dc3545); color: white; padding: 0.3rem 0.5rem; border: none; border-radius: 4px; cursor: pointer;">Excluir</button>`
                : '';

            tr.innerHTML = `
                <td style="padding: 0.75rem;">${user.nome_completo || 'Não informado'}</td>
                <td style="padding: 0.75rem;">${user.email || '-'}</td>
                <td style="padding: 0.75rem;"><span class="badge" style="background: var(--primary-700, #444); color: white; padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.75rem; text-transform: uppercase; white-space: nowrap;">${perfilAtual}</span></td>
                <td style="padding: 0.75rem;"><span style="padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.75rem; background: ${statusAtual.toLowerCase() === 'bloqueado' ? 'var(--danger-600)' : 'var(--success-600)'}; color: white; white-space: nowrap;">${statusAtual}</span></td>
                <td style="padding: 0.75rem; white-space: nowrap;">${formatDate(user.criado_em)}</td>
                <td style="padding: 0.75rem;">
                    <div class="acoes-tabela">
                        ${botaoHistorico}
                        ${botaoGerir}
                        ${botaoExcluir}
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });

        atacharEventosAcoes();
    }

    function atacharEventosAcoes() {
        document.querySelectorAll('.btn-gerir').forEach(btn => btn.addEventListener('click', (e) => abrirPainelEdicao(e.target.getAttribute('data-id'))));

        document.querySelectorAll('.btn-excluir').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.target.getAttribute('data-id');
                const usuarioParaExcluir = stateModulo1.users.find(u => u.id === id);
                if (!confirm(`Deseja realmente excluir ${usuarioParaExcluir.nome_completo}?`)) return;

                await window.supabaseClient.from('colaboradores').delete().eq('id', id);
                if (usuarioParaExcluir.email) {
                    await window.supabaseClient.from('pre_cadastros').delete().eq('email', usuarioParaExcluir.email);
                    // Grava auditoria de exclusão
                    await registrarAuditoria(usuarioParaExcluir.email, 'Usuário Excluído', 'Conta e perfil apagados do sistema.');
                }
                loadModulo1Data();
            });
        });

        document.querySelectorAll('.btn-historico').forEach(btn => {
            btn.addEventListener('click', (e) => {
                abrirModalHistorico(e.target.getAttribute('data-email'), e.target.getAttribute('data-nome'));
            });
        });
    }

    async function abrirModalHistorico(email, nome) {
        let modal = document.getElementById('modal-historico');
        
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'modal-historico';
            modal.className = 'modal-historico-overlay';
            modal.innerHTML = `
                <div class="modal-historico-content">
                    <div class="modal-historico-header">
                        <h3 class="text-white text-lg font-bold" style="color: var(--accent-500, #f0a500);">
                            Histórico de Acessos e Ações: <span id="historico-nome-user" style="color: white;"></span>
                        </h3>
                        <button id="btn-fechar-historico" style="background: none; border: none; color: white; font-size: 1.5rem; cursor: pointer;">&times;</button>
                    </div>
                    <div class="modal-historico-body">
                        <table>
                            <thead><tr><th>Data e Hora</th><th>Ação</th><th>Detalhes</th></tr></thead>
                            <tbody id="tabela-historico-body">
                                <tr><td colspan="3" style="text-align: center;">Carregando histórico...</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
            document.getElementById('btn-fechar-historico').addEventListener('click', () => modal.style.display = 'none');
        }

        document.getElementById('historico-nome-user').textContent = nome || email;
        const tbody = document.getElementById('tabela-historico-body');
        tbody.innerHTML = '<tr><td colspan="3" style="text-align: center;">Buscando registros...</td></tr>';
        modal.style.display = 'flex'; 

        const { data, error } = await window.supabaseClient.from('historico_acessos').select('*').eq('usuario_email', email).order('criado_em', { ascending: false }).limit(100);

        if (error) return tbody.innerHTML = `<tr><td colspan="3" style="color: var(--danger-600); text-align: center;">Erro ao buscar histórico.</td></tr>`;
        if (!data || data.length === 0) return tbody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: #888;">Nenhum registro encontrado.</td></tr>`;

        tbody.innerHTML = '';
        data.forEach(log => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${formatDate(log.criado_em)}</td>
                <td><strong style="color: var(--info-600, #17a2b8);">${log.acao}</strong></td>
                <td>${log.detalhes || '-'}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    function abrirPainelEdicao(id) {
        const user = stateModulo1.users.find(u => u.id === id);
        if (!user) return;
        stateModulo1.selectedUserId = id;

        const podeConcederAcessos = temPermissaoCustom('gerir_acessos');
        const perfilLogado = obterPerfilLogado();
        
        let painel = getEl('painel-edicao-usuario');
        if (!painel) {
            const container = document.querySelector('.content-area') || document.body;
            painel = document.createElement('div');
            painel.id = 'painel-edicao-usuario';
            painel.className = 'panel p-6';
            painel.style.cssText = 'background: var(--primary-900, #1a1a1a); margin-bottom: 2rem; border: 1px solid var(--accent-500, #f0a500); padding: 1.5rem; border-radius: 8px; display: block;';
            container.prepend(painel);
        } else { painel.style.display = 'block'; }

        const painelPermissoes = `
            <div style="margin-bottom: 1.5rem; background: var(--primary-800, #222); padding: 1rem; border-radius: 4px; border-left: 3px solid var(--accent-500, #f0a500);">
                <label style="display:block; font-size:0.85rem; color:var(--accent-500, #f0a500); margin-bottom:0.75rem; font-weight: bold; text-transform: uppercase;">Autorizações Personalizadas (Exceções)</label>
                <label style="display:flex; align-items:center; gap:0.5rem; color:white; margin-bottom:0.5rem; font-size: 0.85rem; cursor: pointer;">
                    <input type="checkbox" id="chk-ver-admin" style="width: 16px; height: 16px; min-width: 16px;" ${user.permissoes?.ver_admin ? 'checked' : ''} ${!podeConcederAcessos ? 'disabled' : ''}>
                    Liberar acesso ao menu "1. Administração"
                </label>
                <label style="display:flex; align-items:center; gap:0.5rem; color:white; margin-bottom:0.5rem; font-size: 0.85rem; cursor: pointer;">
                    <input type="checkbox" id="chk-gerir-acessos" style="width: 16px; height: 16px; min-width: 16px;" ${user.permissoes?.gerir_acessos ? 'checked' : ''} ${!podeConcederAcessos ? 'disabled' : ''}>
                    Permitir alterar cargos e autorizações
                </label>
                <label style="display:flex; align-items:center; gap:0.5rem; color:white; font-size: 0.85rem; cursor: pointer;">
                    <input type="checkbox" id="chk-excluir" style="width: 16px; height: 16px; min-width: 16px;" ${user.permissoes?.excluir_usuarios ? 'checked' : ''} ${!podeConcederAcessos ? 'disabled' : ''}>
                    Permitir exclusão de contas
                </label>
            </div>
        `;

        painel.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                <h3 id="titulo-editar-usuario" class="text-white text-lg font-bold" style="color: var(--accent-500, #f0a500);">A editar: ${user.nome_completo || user.email}</h3>
                <button type="button" id="btn-reset-senha" class="btn btn-sm" style="background: var(--warning-600, #ffc107); color: black; font-weight: bold; border: none; padding: 0.4rem 0.8rem; border-radius: 4px; cursor: pointer;" title="O colaborador receberá um e-mail com instruções">🔑 Enviar Link de Recuperação de Senha</button>
            </div>
            
            <form id="form-editar-privilegios">
                <div class="form-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                    <div>
                        <label style="display:block; font-size:0.8rem; color:var(--primary-400, #ccc); margin-bottom:0.25rem;">E-mail da Conta (Leitura)</label>
                        <input type="email" id="edit-email" class="form-input" readonly value="${user.email || ''}" style="background: var(--primary-800, #222); color: var(--primary-400, #aaa); width: 100%; padding: 0.5rem; border: 1px solid var(--primary-700, #444); border-radius: 4px; box-sizing: border-box;">
                    </div>
                    <div>
                        <label style="display:block; font-size:0.8rem; color:var(--primary-400, #ccc); margin-bottom:0.25rem;">Nome do Colaborador</label>
                        <input type="text" id="edit-nome" class="form-input" value="${user.nome_completo || ''}" style="width: 100%; padding: 0.5rem; background: var(--primary-700, #333); color: white; border: 1px solid var(--primary-600, #555); border-radius: 4px; box-sizing: border-box;">
                    </div>
                </div>
                <div class="form-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                    <div>
                        <label style="display:block; font-size:0.8rem; color:var(--primary-400, #ccc); margin-bottom:0.25rem;">Cargo / Função</label>
                        <input type="text" id="edit-cargo" class="form-input" value="${user.cargo || ''}" style="width: 100%; padding: 0.5rem; background: var(--primary-700, #333); color: white; border: 1px solid var(--primary-600, #555); border-radius: 4px; box-sizing: border-box;">
                    </div>
                    <div>
                        <label style="display:block; font-size:0.8rem; color:var(--primary-400, #ccc); margin-bottom:0.25rem;">Nível Corporativo (Role)</label>
                        <select id="edit-perfil" class="form-input" style="width: 100%; padding: 0.5rem; background: var(--primary-700, #333); color: white; border: 1px solid var(--primary-600, #555); border-radius: 4px; box-sizing: border-box;" ${!podeConcederAcessos ? 'disabled' : ''}>
                            <option value="colaborador" ${user.perfil === 'colaborador' ? 'selected' : ''}>Colaborador</option>
                            <option value="operador" ${user.perfil === 'operador' ? 'selected' : ''}>Operador</option>
                            <option value="admin" ${user.perfil === 'admin' ? 'selected' : ''}>Administrador (RH)</option>
                            <option value="gerente" ${user.perfil === 'gerente' ? 'selected' : ''}>Gerência</option>
                            <option value="gestor" ${user.perfil === 'gestor' ? 'selected' : ''}>Gestor / ADM</option>
                            ${perfilLogado === 'master' ? `<option value="master" ${user.perfil === 'master' ? 'selected' : ''}>Master</option>` : ''}
                        </select>
                    </div>
                </div>
                <div style="margin-bottom: 1rem;">
                    <label style="display:block; font-size:0.8rem; color:var(--primary-400, #ccc); margin-bottom:0.25rem;">Status da Conta</label>
                    <select id="edit-status" class="form-input" style="width: 100%; padding: 0.5rem; background: var(--primary-700, #333); color: white; border: 1px solid var(--primary-600, #555); border-radius: 4px; box-sizing: border-box;">
                        <option value="Ativo" ${user.status === 'Ativo' ? 'selected' : ''}>Ativo</option>
                        <option value="Bloqueado" ${user.status === 'Bloqueado' ? 'selected' : ''}>Bloqueado (Acesso Suspenso)</option>
                    </select>
                </div>
                
                ${painelPermissoes}

                <div style="display: flex; gap: 1rem; margin-top: 1rem;">
                    <button type="submit" class="btn btn-primary" style="flex: 2; background: var(--success-600, #28a745); color: white; padding: 0.5rem; border: none; border-radius: 4px; cursor: pointer;">Salvar Alterações</button>
                    <button type="button" id="btn-cancelar-edicao" class="btn btn-secondary" style="flex: 1; background: var(--primary-700, #444); color: white; padding: 0.5rem; border: none; border-radius: 4px; cursor: pointer;">Cancelar Edição</button>
                </div>
            </form>
        `;

        // Evento para o Reset de Senha
        getEl('btn-reset-senha').onclick = async () => {
            if(!confirm(`Isto enviará um e-mail de redefinição de senha para ${user.email}. Deseja prosseguir?`)) return;
            const { error } = await window.supabaseClient.auth.resetPasswordForEmail(user.email);
            if(error) {
                alert('Erro ao enviar link: ' + error.message);
            } else {
                alert('E-mail de recuperação enviado com sucesso para o colaborador!');
                await registrarAuditoria(user.email, 'Redefinição de Senha', 'Link de recuperação enviado pelo painel de gestão.');
            }
        };

        getEl('form-editar-privilegios').onsubmit = async (e) => {
            e.preventDefault();
            if (!stateModulo1.selectedUserId) return;
            
            const novoPerfil = getEl('edit-perfil').value;
            const payload = { nome_completo: getEl('edit-nome').value.trim(), cargo: getEl('edit-cargo').value.trim(), status: getEl('edit-status').value };

            if (podeConcederAcessos) {
                payload.perfil = novoPerfil;
                payload.permissoes = {
                    ver_admin: getEl('chk-ver-admin').checked,
                    gerir_acessos: getEl('chk-gerir-acessos').checked,
                    excluir_usuarios: getEl('chk-excluir').checked
                };
            }

            const { error } = await window.supabaseClient.from('colaboradores').update(payload).eq('id', stateModulo1.selectedUserId);
            if (error) alert('Erro ao atualizar: ' + error.message);
            else { 
                await registrarAuditoria(user.email, 'Atualização de Cadastro', `Cargo/Status/Permissões atualizados. Novo perfil principal: ${novoPerfil}`);
                alert('Atualizado com sucesso!'); 
                getEl('painel-edicao-usuario').style.display = 'none'; 
                loadModulo1Data(); 
            }
        };

        getEl('btn-cancelar-edicao').onclick = () => getEl('painel-edicao-usuario').style.display = 'none';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function initModulo1() {
        injetarCSSMobile();
        const btnNewUser = getEl('btn-new-user');
        const modalCreate = getEl('modal-create-user');
        
        // Injeta o botão de Exportação de forma dinâmica ao lado do botão Novo Usuário
        if (btnNewUser && !getEl('btn-export-csv')) {
            const btnExport = document.createElement('button');
            btnExport.id = 'btn-export-csv';
            btnExport.className = 'btn btn-primary';
            btnExport.style.cssText = 'background: var(--info-600, #17a2b8); margin-left: 10px; color: white; border: none; padding: 0.5rem 1rem; border-radius: 4px; cursor: pointer;';
            btnExport.innerHTML = '📥 Exportar Efetivo';
            btnExport.onclick = exportarRelatorioCSV;
            btnNewUser.parentNode.insertBefore(btnExport, btnNewUser.nextSibling);
        }

        if (btnNewUser) {
            if (temPermissaoCustom('gerir_acessos')) btnNewUser.addEventListener('click', () => { if (modalCreate) modalCreate.style.display = 'flex'; });
            else btnNewUser.style.display = 'none';
        }

        if (document.querySelector('.modal-close')) document.querySelector('.modal-close').addEventListener('click', () => { modalCreate.style.display = 'none'; });

        if (getEl('create-user-form')) {
            getEl('create-user-form').addEventListener('submit', async (e) => {
                e.preventDefault();
                const formData = new FormData(e.target);
                const email = formData.get('email');
                const { error: authError } = await window.supabaseClient.auth.signUp({ email, password: formData.get('password') });

                if (authError && !authError.message.includes('already registered')) return alert('Erro ao criar autenticação: ' + authError.message);

                const { error } = await window.supabaseClient.from('colaboradores').insert([{ 
                    nome_completo: formData.get('nome'), email, perfil: formData.get('perfil') || 'colaborador', 
                    matricula: 'MAT-' + Math.floor(Math.random() * 9000 + 1000), status: 'Ativo',
                    permissoes: { ver_admin: false, gerir_acessos: false, excluir_usuarios: false }
                }]);

                if (error) alert('Erro ao cadastrar usuário.');
                else { 
                    await registrarAuditoria(email, 'Cadastro Manual', 'Usuário adicionado diretamente pela administração.');
                    modalCreate.style.display = 'none'; e.target.reset(); loadModulo1Data(); 
                }
            });
        }
        if (getEl('search-users')) getEl('search-users').addEventListener('input', (e) => { stateModulo1.pagination.search = e.target.value.trim(); stateModulo1.pagination.page = 1; loadUsers(); });
    }

    initModulo1();
    setTimeout(() => loadModulo1Data(), 150);
}
