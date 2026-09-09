// O código completo do Módulo 9 adaptado para o Bloco de Notas / Quadro Informativo com controle de perfil

if (typeof window.modulo9Initialized === 'undefined') {
    window.modulo9Initialized = true;

    function getEl(id) { return document.getElementById(id); }

    async function initModulo9() {
        const viewMode = getEl('bloco-view-mode');
        const editMode = getEl('bloco-edit-mode');
        const inputTitulo = getEl('bloco-input-titulo');
        const inputConteudo = getEl('bloco-input-conteudo');
        const dataInfo = getEl('bloco-data-info');
        const btnSalvar = getEl('bloco-btn-salvar');
        const statusMsg = getEl('bloco-status-msg');
        const tituloDisplay = getEl('bloco-titulo-display');

        if (!viewMode) return;

        // 1. Busca a nota/aviso mais recente gravada na tabela 'quadro_informativo' no Supabase
        const { data, error } = await window.supabaseClient
            .from('quadro_informativo')
            .select('*')
            .order('atualizado_em', { ascending: false })
            .limit(1);

        let avisoAtual = { id: null, titulo: 'Bloco de Notas da Operação', conteudo: 'Nenhuma anotação registrada no momento.' };

        if (!error && data && data.length > 0) {
            avisoAtual = data[0];
            viewMode.textContent = avisoAtual.conteudo;
            if (tituloDisplay) tituloDisplay.textContent = `📌 ${avisoAtual.titulo}`;
            if (avisoAtual.atualizado_em && dataInfo) {
                const dataFmt = new Date(avisoAtual.atualizado_em).toLocaleString('pt-BR');
                dataInfo.textContent = `Última alteração por ${avisoAtual.atualizado_por || 'Gestão'} em ${dataFmt}`;
            }
        } else {
            viewMode.textContent = avisoAtual.conteudo;
        }

        // 2. Identifica se o usuário logado possui privilégios de Master, Gerência ou Administrador
        const usuarioLogado = window.usuarioAtual || JSON.parse(localStorage.getItem('usuario_logado') || '{}');
        const cargoOuPerfil = String(usuarioLogado.perfil || usuarioLogado.cargo || '').toLowerCase();
        
        const perfisAutorizados = ['master', 'gerencia', 'gerente', 'administrador', 'admin'];
        const temPermissao = perfisAutorizados.some(p => cargoOuPerfil.includes(p)) || (usuarioLogado.email && usuarioLogado.email.includes('admin'));

        // 3. Se tiver permissão, exibe os campos de edição simulando um bloco de notas administrativo
        if (temPermissao && editMode) {
            editMode.style.display = 'block';
            if (inputTitulo) inputTitulo.value = avisoAtual.titulo;
            if (inputConteudo) inputConteudo.value = avisoAtual.conteudo;

            if (btnSalvar) {
                btnSalvar.onclick = async () => {
                    btnSalvar.disabled = true;
                    if (statusMsg) {
                        statusMsg.textContent = 'Salvando notas...';
                        statusMsg.style.color = 'var(--primary-300)';
                    }

                    const payload = {
                        titulo: inputTitulo.value.trim() || 'Bloco de Notas da Operação',
                        conteudo: inputConteudo.value.trim(),
                        atualizado_por: usuarioLogado.nome_completo || usuarioLogado.email || 'Supervisão',
                        atualizado_em: new Date().toISOString()
                    };

                    let res;
                    if (avisoAtual.id) {
                        res = await window.supabaseClient
                            .from('quadro_informativo')
                            .update(payload)
                            .eq('id', avisoAtual.id);
                    } else {
                        res = await window.supabaseClient
                            .from('quadro_informativo')
                            .insert([payload]);
                    }

                    if (res.error) {
                        if (statusMsg) {
                            statusMsg.textContent = 'Erro ao salvar anotação!';
                            statusMsg.style.color = 'var(--danger-600)';
                        }
                    } else {
                        if (statusMsg) {
                            statusMsg.textContent = 'Nota publicada com sucesso!';
                            statusMsg.style.color = 'var(--success-600)';
                        }
                        setTimeout(() => {
                            if (statusMsg) statusMsg.textContent = '';
                            initModulo9();
                        }, 2000);
                    }
                    btnSalvar.disabled = false;
                };
            }
        }
    }

    initModulo9();
}
