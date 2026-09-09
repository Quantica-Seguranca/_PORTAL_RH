(async function() {
    function getEl(id) { return document.getElementById(id); }

    const txtDuvida = getEl('input-duvida-texto');
    const btnEnviar = getEl('btn-enviar-duvida');
    const statusMsg = getEl('duvida-status-msg');
    const container = getEl('lista-mensagens-container');

    if (!container) return;

    // Identifica quem está logado e se ele é da Gestão
    const perfilUsuario = String(window.userPerfil || '').toLowerCase();
    const perfisAutorizados = ['master', 'gerencia', 'gerente', 'administrador', 'admin'];
    const ehGestao = perfisAutorizados.some(p => perfilUsuario.includes(p));

    const usuarioLogado = window.usuarioAtual || JSON.parse(localStorage.getItem('usuario_logado') || '{}');
    const emailLogado = usuarioLogado.email;

    // Se for gestão, altera o título para ficar claro que é a visão geral
    if (ehGestao) {
        const tituloHistorico = getEl('titulo-historico');
        if (tituloHistorico) tituloHistorico.innerHTML = '💬 Painel de Atendimento (Visão da Supervisão)';
    }

    // Ação de envio da mensagem
    if (btnEnviar) {
        const novoBtnEnviar = btnEnviar.cloneNode(true);
        btnEnviar.parentNode.replaceChild(novoBtnEnviar, btnEnviar);
        
        novoBtnEnviar.onclick = async () => {
            const texto = txtDuvida.value.trim();
            if (!texto) {
                alert('Escreva o conteúdo antes de enviar.');
                return;
            }

            novoBtnEnviar.disabled = true;
            if (statusMsg) {
                statusMsg.textContent = 'Enviando de forma segura...';
                statusMsg.style.color = 'var(--primary-300)';
            }

            // Salva a mensagem vinculando o e-mail exato do usuário logado
            const { error } = await window.supabaseClient.from('mensagens_suporte').insert([{
                remetente_nome: usuarioLogado.nome_completo || 'Colaborador',
                remetente_perfil: perfilUsuario || 'colaborador',
                remetente_email: emailLogado, // CAMPO NOVO PARA GARANTIR PRIVACIDADE
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
                    statusMsg.textContent = 'Enviado para a supervisão!';
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

    // Função que carrega o chat com FILTRO DE PRIVACIDADE
    async function carregarMensagens() {
        // Prepara a busca no banco
        let query = window.supabaseClient.from('mensagens_suporte').select('*').order('criado_em', { ascending: false });

        // SEGREDO DA PRIVACIDADE: Se não for gestão, filtra SÓ as mensagens deste e-mail
        if (!ehGestao) {
            query = query.eq('remetente_email', emailLogado);
        }

        const { data, error } = await query;

        if (error || !data || data.length === 0) {
            container.innerHTML = '<p style="color: var(--primary-400);">Você não possui chamados ou mensagens em aberto.</p>';
            return;
        }

        container.innerHTML = '';
        data.forEach(item => {
            const card = document.createElement('div');
            card.style.cssText = 'background: var(--primary-950); padding: 1rem; border-radius: 6px; border-left: 4px solid ' + (item.status === 'respondido' ? 'var(--success-600)' : 'var(--accent-500)') + ';';
            
            const dataFmt = new Date(item.criado_em).toLocaleString('pt-BR');

            let htmlResp = `
                <div style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid var(--primary-800); color: var(--primary-300);">
                    <strong>Resposta da Gestão:</strong> ${item.resposta || 'Sua solicitação está sendo analisada...'}
                </div>
            `;

            // Área de resposta (Aparece apenas para a Gestão)
            if (ehGestao) {
                htmlResp += `
                    <div style="margin-top: 0.75rem; display: flex; gap: 0.5rem;">
                        <input type="text" id="resp-${item.id}" class="form-input" style="flex: 1; background: var(--primary-900); border: 1px solid var(--primary-700); color: white; padding: 0.4rem; border-radius: 4px;" placeholder="Digite a resposta oficial (ficará visível só para ele)..." value="${item.resposta || ''}">
                        <button class="btn btn-sm btn-responder" data-id="${item.id}" style="background: var(--success-600); color: white; border: none; padding: 0.4rem 1rem; border-radius: 4px; cursor: pointer;">Responder Colaborador</button>
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

        // Ação de salvar a resposta (Gestão)
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
                        // Truque anti-cache local para mostrar a resposta na hora
                        carregarMensagens(); 
                    }
                };
            });
        }
    }

    // TRUQUE ANTI-CACHE DA URL: Tira o "?v=..." da URL se ele bugar a consulta
    const urlClean = window.location.href.split('?')[0];
    window.history.replaceState({}, document.title, urlClean);

    carregarMensagens();
})();
