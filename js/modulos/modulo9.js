(async function() {
    function getEl(id) { return document.getElementById(id); }

    const viewMode = getEl('bloco-view-mode');
    const editMode = getEl('bloco-edit-mode');
    const inputTitulo = getEl('bloco-input-titulo');
    const inputConteudo = getEl('bloco-input-conteudo');
    const dataInfo = getEl('bloco-data-info');
    const btnSalvar = getEl('bloco-btn-salvar');
    const statusMsg = getEl('bloco-status-msg');
    const tituloDisplay = getEl('bloco-titulo-display');

    if (!viewMode) return;

    // 1. Busca a nota/aviso mais recente
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
        if (error) console.error("Erro Supabase:", error);
    }

    // 2. Identifica o perfil corporativo
    const perfilUsuario = String(window.userPerfil || '').toLowerCase();
    const perfisAutorizados = ['master', 'gerencia', 'gerente', 'administrador', 'admin'];
    const temPermissao = perfisAutorizados.some(p => perfilUsuario.includes(p));

    // 3. Exibe a área de edição apenas para quem tem permissão
    if (temPermissao && editMode) {
        editMode.style.display = 'block';
        if (inputTitulo) inputTitulo.value = avisoAtual.titulo;
        if (inputConteudo) inputConteudo.value = avisoAtual.conteudo;

        if (btnSalvar) {
            btnSalvar.onclick = async () => {
                btnSalvar.disabled = true;
                if (statusMsg) {
                    statusMsg.textContent = 'Salvando anotações...';
                    statusMsg.style.color = 'var(--primary-300)';
                }

                const usuarioLogado = window.usuarioAtual || JSON.parse(localStorage.getItem('usuario_logado') || '{}');

                const payload = {
                    titulo: inputTitulo.value.trim() || 'Bloco de Notas da Operação',
                    conteudo: inputConteudo.value.trim(),
                    atualizado_por: usuarioLogado.nome_completo || 'Supervisão',
                    atualizado_em: new Date().toISOString()
                };

                let res;
                if (avisoAtual.id) {
                    res = await window.supabaseClient.from('quadro_informativo').update(payload).eq('id', avisoAtual.id);
                } else {
                    res = await window.supabaseClient.from('quadro_informativo').insert([payload]);
                }

                if (res.error) {
                    if (statusMsg) {
                        statusMsg.textContent = 'Erro ao salvar!';
                        statusMsg.style.color = 'var(--danger-600)';
                    }
                } else {
                    if (statusMsg) {
                        statusMsg.textContent = 'Anotação publicada!';
                        statusMsg.style.color = 'var(--success-600)';
                    }
                    setTimeout(() => {
                        window.carregarModulo('modulo9'); // Recarrega a tela para atualizar a view de leitura
                    }, 1500);
                }
                btnSalvar.disabled = false;
            };
        }
    }
})();
