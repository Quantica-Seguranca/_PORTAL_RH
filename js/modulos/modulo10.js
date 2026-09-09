(async function() {
    function getEl(id) { return document.getElementById(id); }

    const txtDuvida = getEl('input-duvida-texto');
    const btnEnviar = getEl('btn-enviar-duvida');
    const statusMsg = getEl('duvida-status-msg');
    const container = getEl('lista-mensagens-container');

    if (!container) return;

    // Identifica o perfil corporativo via variável global (Master, Gerência, etc)
    const perfilUsuario = String(window.userPerfil || '').toLowerCase();
    const perfisAutorizados = ['master', 'gerencia', 'gerente', 'administrador', 'admin'];
    const ehGestao = perfisAutorizados.some(p => perfilUsuario.includes(p));

    const usuarioLogado = window.usuarioAtual || JSON.parse(localStorage.getItem('usuario_logado') || '{}');

    // Função de envio da dúvida
    if (btnEnviar) {
        const novoBtnEnviar = btnEnviar.cloneNode(true);
        btnEnviar.parentNode.replaceChild(novoBtnEnviar, btnEnviar);
        
        novoBtnEnviar.onclick = async () => {
            const texto = txtDuvida.value.trim();
            if (!texto) {
                alert('Escreva o conteúdo da dúvida antes de enviar.');
                return;
            }

            novoBtnEnviar.disabled = true;
            if (statusMsg) {
                statusMsg.textContent = 'Enviando...';
                statusMsg.style.color = 'var(--primary-300)';
            }

            const { error } = await window.supabaseClient.from('mensagens_suporte').insert([{
                remetente_nome: usuarioLogado.nome_completo || 'Colaborador',
                remetente_perfil: perfilUsuario || 'colaborador',
                mensagem: texto,
                status: 'pendente'
            }]);

            if (error) {
                if (statusMsg) {
                    statusMsg.textContent = 'Erro ao enviar.';
                    statusMsg.style.color = 'var(--danger-600)';
                }
            } else {
                if (statusMsg) {
                    statusMsg.textContent = 'Enviado com sucesso!';
                    statusMsg.style.color = 'var(--success-600)';
                }
                txtDuvida.value = '';
                setTimeout(() => { 
                    if (statusMsg) statusMsg.textContent = ''; 
                    carregarMensagens(); 
                }, 1500);
            }
            novoBtnEnviar.disabled = false;
        };
    }

    // Função para carregar as mensagens na tela
    async function carregarMensagens() {
        const { data, error } = await window.supabaseClient
            .from('mensagens_suporte')
            .select('*')
            .order('criado_em', { ascending: false });

        if (error || !data || data.length === 0) {
            container.innerHTML = '<p style="color: var(--primary-400);">Nenhuma mensagem registrada no sistema.</p>';
            return;
        }

        container.innerHTML = '';
        data.forEach(item => {
            const card = document.createElement('div');
            card.style.cssText = 'background: var(--primary-950); padding: 1rem; border-radius: 6px; border-left: 4px solid ' + (item.status === 'respondido' ? 'var(--success-600)' : 'var(--accent-500)') + ';';
            
            const dataFmt = new Date(item.criado_em).toLocaleString('pt-BR');

            let htmlResp = `
                <div style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid var(--primary-800); color: var(--primary-300);">
                    <strong>Resposta da Supervisão:</strong> ${item.resposta || 'Aguardando avaliação...'}
                </div>
            `;

            // Mostra os botões de resposta apenas para quem é Master/Gerência
            if (ehGestao) {
                htmlResp += `
                    <div style="margin-top: 0.75rem; display: flex; gap: 0.5rem;">
                        <input type="text" id="resp-${item.id}" class="form-input" style="flex: 1; background: var(--primary-900); border: 1px solid var(--primary-700); color: white; padding: 0.4rem; border-radius: 4px;" placeholder="Digite a resposta corporativa..." value="${item.resposta || ''}">
                        <button class="btn btn-sm btn-responder" data-id="${item.id}" style="background: var(--success-600); color: white; border: none; padding: 0.4rem 1rem; border-radius: 4px; cursor: pointer;">Salvar Resposta</button>
                    </div>
                `;
            }

            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; font-size: 0.8rem; color: var(--primary-400); margin-bottom: 0.5rem;">
                    <span><strong>${item.remetente_nome}</strong> (${item.remetente_perfil})</span>
                    <span>${dataFmt}</span>
                </div>
                <div style="color: white; font-size: 0.95rem; margin-bottom: 0.5rem;">${item.mensagem}</div>
                ${htmlResp}
            `;
            container.appendChild(card);
        });

        // Evento de clique para os botões de "Salvar Resposta" (apenas Gestão)
        if (ehGestao) {
            document.querySelectorAll('.btn-responder').forEach(btn => {
                btn.onclick = async (e) => {
                    const id = e.target.getAttribute('data-id');
                    const inputResp = getEl(`resp-${id}`);
                    const respostaTxt = inputResp ? inputResp.value.trim() : '';

                    if (!respostaTxt) {
                        alert('Digite a resposta antes de enviar.');
                        return;
                    }

                    const { error } = await window.supabaseClient
                        .from('mensagens_suporte')
                        .update({
                            resposta: respostaTxt,
                            respondido_por: usuarioLogado.nome_completo || 'Supervisão Master',
                            status: 'respondido',
                            atualizado_em: new Date().toISOString()
                        })
                        .eq('id', id);

                    if (error) {
                        alert('Erro ao enviar resposta.');
                    } else {
                        carregarMensagens();
                    }
                };
            });
        }
    }

    carregarMensagens();
})();
