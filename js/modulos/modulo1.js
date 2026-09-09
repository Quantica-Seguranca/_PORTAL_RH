// O código completo do Módulo 1 atualizado com suporte ao painel de gestão detalhada e listagem unificada

if (typeof window.modulo1Initialized === 'undefined') {
    window.modulo1Initialized = true;

    const stateModulo1 = {
        users: [],
        pagination: { page: 1, limit: 10, total: 0, search: '' },
        selectedUserId: null
    };

    function getEl(id) { return document.getElementById(id); }

    function formatDate(isoString) {
        if (!isoString) return '-';
        return new Date(isoString).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    }

    async function loadModulo1Data() {
        await loadStatistics();
        await loadUsers();
        await loadPreCadastros();
    }

    async function loadStatistics() {
        const { data, error } = await window.supabaseClient.from('colaboradores').select('*');
        if (error) { console.error('Erro nas estatísticas:', error); return; }

        const ativos = data.filter(u => (u.status || 'Ativo').toLowerCase() === 'ativo').length;
        const operadores = data.filter(u => u.perfil === 'operacional').length;
        const admins = data.filter(u => ['admin', 'gerente', 'master'].includes(u.perfil)).length;

        if(getEl('stat-total')) getEl('stat-total').textContent = data.length;
        if(getEl('stat-active')) getEl('stat-active').textContent = ativos;
        if(getEl('stat-operators')) getEl('stat-operators').textContent = operadores;
        if(getEl('stat-admins')) getEl('stat-admins').textContent = admins;
    }

    async function loadUsers() {
        const { page, limit, search } = stateModulo1.pagination;
        const start = (page - 1) * limit;
        const end = start + limit - 1;

        let query = window.supabaseClient.from('colaboradores').select('*', { count: 'exact' }).order('nome_completo', { ascending: true }).range(start, end);

        if (search) {
            query = query.or(`nome_completo.ilike.%${search}%,email.ilike.%${search}%`);
        }

        const { data, error, count } = await query;
        if (error) { console.error('Erro ao carregar usuários:', error); return; }

        stateModulo1.users = data || [];
        stateModulo1.pagination.total = count || 0;
        renderUsersTable();
    }

    async function loadPreCadastros() {
        const tbody = getEl('pre-cadastros-table-body');
        if (!tbody) return;

        const { data, error } = await window.supabaseClient
            .from('pre_cadastros')
            .select('*')
            .eq('status', 'pendente')
            .order('criado_em', { ascending: false });

        if (error) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--danger-600);">Erro ao carregar solicitações.</td></tr>`;
            return;
        }

        if (!data || data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--primary-300); padding: 1rem;">Nenhuma solicitação pendente.</td></tr>`;
            return;
        }

        tbody.innerHTML = '';
        data.forEach(pre => {
            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid var(--primary-800)';
            tr.innerHTML = `
                <td style="padding: 0.75rem;">${pre.nome}</td>
                <td style="padding: 0.75rem;">${pre.email}</td>
                <td style="padding: 0.75rem;">${pre.cpf || '-'}</td>
                <td style="padding: 0.75rem;">${formatDate(pre.criado_em)}</td>
                <td style="padding: 0.75rem; text-align: center;">
                    <button class="btn btn-sm btn-aprovar" data-id="${pre.id}" data-email="${pre.email}" data-nome="${pre.nome}" data-senha="${pre.senha_temporaria || '123456'}" style="margin-right: 0.5rem; background: var(--success-600); color: white; border: none; padding: 0.25rem 0.5rem; border-radius: 4px; cursor: pointer;">Aprovar</button>
                    <button class="btn btn-sm btn-rejeitar" data-id="${pre.id}" style="background: var(--danger-600); color: white; border: none; padding: 0.25rem 0.5rem; border-radius: 4px; cursor: pointer;">Rejeitar</button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        atacharEventosPreCadastros();
    }

    function atacharEventosPreCadastros() {
        document.querySelectorAll('.btn-aprovar').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.target.getAttribute('data-id');
                const email = e.target.getAttribute('data-email');
                const nome = e.target.getAttribute('data-nome');
                const senhaTemp = e.target.getAttribute('data-senha');

                const { error: authError } = await window.supabaseClient.auth.signUp({
                    email: email,
                    password: senhaTemp
                });

                if (authError && !authError.message.includes('already registered')) {
                    alert('Erro ao criar credencial de autenticação: ' + authError.message);
                    return;
                }

                const { error: insertError } = await window.supabaseClient
                    .from('colaboradores')
                    .insert([{
                        nome_completo: nome,
                        email: email,
                        perfil: 'colaborador',
                        matricula: 'MAT-' + Math.floor(Math.random() * 9000 + 1000),
                        status: 'Ativo'
                    }]);

                if (insertError) {
                    alert('Erro ao aprovar colaborador: ' + insertError.message);
                    return;
                }

                const { error: updateError } = await window.supabaseClient
                    .from('pre_cadastros')
                    .update({ status: 'aprovado' })
                    .eq('id', id);

                if (!updateError) {
                    alert('Usuário aprovado e credencial gerada com sucesso!');
                    loadModulo1Data();
                } else {
                    alert('Erro ao atualizar status do pré-cadastro.');
                }
            });
        });

        document.querySelectorAll('.btn-rejeitar').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                if (!confirm('Deseja realmente rejeitar esta solicitação?')) return;
                const id = e.target.getAttribute('data-id');

                const { error } = await window.supabaseClient
                    .from('pre_cadastros')
                    .update({ status: 'rejeitado' })
                    .eq('id', id);

                if (!error) {
                    loadPreCadastros();
                } else {
                    alert('Erro ao rejeitar solicitação.');
                }
            });
        });
    }

    function renderUsersTable() {
        const tbody = getEl('users-table-body');
        if (!tbody) return;
        tbody.innerHTML = '';

        if (stateModulo1.users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center" style="text-align: center; padding: 1rem;">Nenhum usuário encontrado.</td></tr>';
            return;
        }

        stateModulo1.users.forEach((user) => {
            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid var(--primary-800)';
            
            const statusAtual = user.status || 'Ativo';
            const perfilAtual = user.perfil || 'colaborador';

            tr.innerHTML = `
                <td style="padding: 0.75rem;">${user.nome_completo || 'Não informado'}</td>
                <td style="padding: 0.75rem;">${user.email || '-'}</td>
                <td style="padding: 0.75rem;">
                    <span class="badge" style="background: var(--primary-700); color: white; padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.75rem; text-transform: uppercase;">
                        ${perfilAtual}
                    </span>
                </td>
                <td style="padding: 0.75rem;">
                    <span style="padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.75rem; background: ${statusAtual.toLowerCase() === 'bloqueado' ? 'var(--danger-600)' : 'var(--success-600)'}; color: white;">
                        ${statusAtual}
                    </span>
                </td>
                <td style="padding: 0.75rem;">${formatDate(user.criado_em)}</td>
                <td style="padding: 0.75rem; text-align: center;">
                    <button class="btn btn-sm btn-gerir" data-id="${user.id}" style="background: var(--info-600); color: white; font-size: 0.75rem; padding: 0.3rem 0.75rem; border: none; border-radius: 4px; cursor: pointer;">Gerir Acesso</button>
                    <button class="btn btn-sm btn-excluir" data-id="${user.id}" style="background-color: var(--danger-600); color: white; font-size: 0.75rem; padding: 0.3rem 0.75rem; border: none; border-radius: 4px; cursor: pointer; margin-left: 0.5rem;">Excluir</button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        atacharEventosAcoes();
    }

    function atacharEventosAcoes() {
        document.querySelectorAll('.btn-gerir').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.getAttribute('data-id');
                abrirPainelEdicao(id);
            });
        });

        document.querySelectorAll('.btn-excluir').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                if (!confirm('Deseja realmente excluir este usuário da base?')) return;
                const id = e.target.getAttribute('data-id');

                const { error } = await window.supabaseClient
                    .from('colaboradores')
                    .delete()
                    .eq('id', id);

                if (!error) loadModulo1Data();
                else alert('Erro ao excluir registro.');
            });
        });
    }

    function abrirPainelEdicao(id) {
        const user = stateModulo1.users.find(u => u.id === id);
        if (!user) return;

        stateModulo1.selectedUserId = id;
        
        let painel = getEl('painel-edicao-usuario');
        if (!painel) {
            const container = document.querySelector('.content-area');
            if (container) {
                painel = document.createElement('div');
                painel.id = 'painel-edicao-usuario';
                painel.className = 'panel p-6';
                painel.style.cssText = 'background: var(--primary-900); margin-bottom: 2rem; border: 1px solid var(--accent-500); display: block;';
                painel.innerHTML = `
                    <h3 id="titulo-editar-usuario" class="text-white text-lg font-bold" style="margin-bottom: 1rem; color: var(--accent-500);">A editar: -</h3>
                    <form id="form-editar-privilegios">
                        <div class="form-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                            <div>
                                <label style="display:block; font-size:0.8rem; color:var(--primary-400); margin-bottom:0.25rem;">E-mail da Conta (Leitura)</label>
                                <input type="email" id="edit-email" class="form-input" readonly style="background: var(--primary-800); color: var(--primary-400); width: 100%; padding: 0.5rem; border: 1px solid var(--primary-700); border-radius: 4px;">
                            </div>
                            <div>
                                <label style="display:block; font-size:0.8rem; color:var(--primary-400); margin-bottom:0.25rem;">Nome do Colaborador</label>
                                <input type="text" id="edit-nome" class="form-input" style="width: 100%; padding: 0.5rem; background: var(--primary-700); color: white; border: 1px solid var(--primary-600); border-radius: 4px;">
                            </div>
                        </div>
                        <div class="form-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                            <div>
                                <label style="display:block; font-size:0.8rem; color:var(--primary-400); margin-bottom:0.25rem;">Cargo / Função</label>
                                <input type="text" id="edit-cargo" class="form-input" style="width: 100%; padding: 0.5rem; background: var(--primary-700); color: white; border: 1px solid var(--primary-600); border-radius: 4px;">
                            </div>
                            <div>
                                <label style="display:block; font-size:0.8rem; color:var(--primary-400); margin-bottom:0.25rem;">Nível Corporativo (Role)</label>
                                <select id="edit-perfil" class="form-input" style="width: 100%; padding: 0.5rem; background: var(--primary-700); color: white; border: 1px solid var(--primary-600); border-radius: 4px;">
                                    <option value="colaborador">Colaborador (ASP)</option>
                                    <option value="operacional">Operador / Fiscal</option>
                                    <option value="admin">Administrador</option>
                                    <option value="gerente">Gerência</option>
                                    <option value="master">Master</option>
                                </select>
                            </div>
                        </div>
                        <div style="margin-bottom: 1rem;">
                            <label style="display:block; font-size:0.8rem; color:var(--primary-400); margin-bottom:0.25rem;">Status da Conta</label>
                            <select id="edit-status" class="form-input" style="width: 100%; padding: 0.5rem; background: var(--primary-700); color: white; border: 1px solid var(--primary-600); border-radius: 4px;">
                                <option value="Ativo">Ativo</option>
                                <option value="Bloqueado">Bloqueado (Acesso Suspenso)</option>
                            </select>
                        </div>
                        <div style="display: flex; gap: 1rem; margin-top: 1rem;">
                            <button type="submit" class="btn btn-primary" style="flex: 2; background: var(--success-600); color: white; padding: 0.5rem; border: none; border-radius: 4px; cursor: pointer;">Salvar Alterações</button>
                            <button type="button" id="btn-cancelar-edicao" class="btn btn-secondary" style="flex: 1; background: var(--primary-700); color: white; padding: 0.5rem; border: none; border-radius: 4px; cursor: pointer;">Cancelar Edição</button>
                        </div>
                    </form>
                `;
                container.prepend(painel);
            }
        } else {
            painel.style.display = 'block';
        }

        getEl('titulo-editar-usuario').textContent = `A editar: ${user.nome_completo || user.email}`;
        getEl('edit-email').value = user.email || '';
        getEl('edit-nome').value = user.nome_completo || '';
        getEl('edit-cargo').value = user.cargo || '';
        getEl('edit-perfil').value = user.perfil || 'colaborador';
        getEl('edit-status').value = user.status || 'Ativo';

        const formEditar = getEl('form-editar-privilegios');
        if (formEditar) {
            formEditar.onsubmit = async (e) => {
                e.preventDefault();
                if (!stateModulo1.selectedUserId) return;

                const payload = {
                    nome_completo: getEl('edit-nome').value.trim(),
                    cargo: getEl('edit-cargo').value.trim(),
                    perfil: getEl('edit-perfil').value,
                    status: getEl('edit-status').value
                };

                const { error } = await window.supabaseClient
                    .from('colaboradores')
                    .update(payload)
                    .eq('id', stateModulo1.selectedUserId);

                if (error) {
                    alert('Erro ao atualizar privilégios: ' + error.message);
                } else {
                    alert('Privilégios atualizados com sucesso!');
                    getEl('painel-edicao-usuario').style.display = 'none';
                    loadModulo1Data();
                }
            };
        }

        const btnCancelar = getEl('btn-cancelar-edicao');
        if (btnCancelar) {
            btnCancelar.onclick = () => {
                getEl('painel-edicao-usuario').style.display = 'none';
            };
        }

        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function initModulo1() {
        const btnNewUser = getEl('btn-new-user');
        const modalCreate = getEl('modal-create-user');
        
        if(btnNewUser && modalCreate) {
            btnNewUser.addEventListener('click', () => { modalCreate.style.display = 'flex'; });
        }

        const modalClose = document.querySelector('.modal-close');
        if(modalClose && modalCreate) {
            modalClose.addEventListener('click', () => { modalCreate.style.display = 'none'; });
        }

        const createUserForm = getEl('create-user-form');
        if(createUserForm) {
            createUserForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const formData = new FormData(createUserForm);
                const nome_completo = formData.get('nome');
                const email = formData.get('email');
                const password = formData.get('password');
                const perfil = formData.get('perfil');

                const { error: authError } = await window.supabaseClient.auth.signUp({
                    email: email,
                    password: password
                });

                if (authError && !authError.message.includes('already registered')) {
                    alert('Erro ao criar autenticação: ' + authError.message);
                    return;
                }

                const { error } = await window.supabaseClient
                    .from('colaboradores')
                    .insert([{ 
                        nome_completo, 
                        email, 
                        perfil, 
                        matricula: 'MAT-' + Math.floor(Math.random() * 9000 + 1000), 
                        status: 'Ativo' 
                    }]);

                if (error) {
                    alert('Erro ao cadastrar usuário na base.');
                } else {
                    modalCreate.style.display = 'none';
                    createUserForm.reset();
                    loadModulo1Data();
                }
            });
        }

        const searchInput = getEl('search-users');
        if(searchInput) {
            searchInput.addEventListener('input', (e) => {
                stateModulo1.pagination.search = e.target.value.trim();
                loadUsers();
            });
        }

        loadModulo1Data();
    }

    initModulo1();
}