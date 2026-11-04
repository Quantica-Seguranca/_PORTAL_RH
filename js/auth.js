document.addEventListener('DOMContentLoaded', async () => {
    const loginScreen = document.getElementById('login-screen');
    const loginForm = document.getElementById('login-form');
    const btnEsqueci = document.getElementById('btn-esqueci-senha');
    const mensagemDiv = document.getElementById('login-mensagem');
    const btnLogout = document.getElementById('btn-logout');

    // Elementos do Pré-Cadastro
    const modalPre = document.getElementById('modal-pre-cadastro');
    const btnAbrirPre = document.getElementById('btn-abrir-pre-cadastro');
    const btnFecharPre = document.getElementById('fechar-pre-cadastro');
    const formPre = document.getElementById('form-pre-cadastro');
    const preMensagem = document.getElementById('pre-mensagem');

    // Elementos da Redefinição de Senha
    const modalRedefinir = document.getElementById('modal-redefinir-senha');
    const formRedefinir = document.getElementById('form-redefinir-senha');
    const redefinirMensagem = document.getElementById('redefinir-mensagem');

    // Verifica se a URL contém o pedido de recuperação de senha do Supabase
    const isRecovery = window.location.hash && window.location.hash.includes('type=recovery');

    if (isRecovery) {
        if (loginScreen) loginScreen.style.display = 'none';
        if (modalRedefinir) modalRedefinir.style.display = 'flex';
    } else {
        const { data: { session } } = await window.supabaseClient.auth.getSession();
        if (session) {
            if (loginScreen) loginScreen.style.display = 'none';
        } else {
            if (loginScreen) loginScreen.style.display = 'flex';
        }
    }

    // Processo de Login
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-senha').value;
            
            mensagemDiv.textContent = 'Autenticando...';
            mensagemDiv.style.color = 'var(--primary-300)';

            const { data, error } = await window.supabaseClient.auth.signInWithPassword({
                email,
                password
            });

            if (error) {
                mensagemDiv.textContent = 'Erro: E-mail ou senha inválidos.';
                mensagemDiv.style.color = 'var(--danger-600)';
            } else {
                mensagemDiv.textContent = 'Login bem-sucedido! Carregando permissões...';
                mensagemDiv.style.color = 'var(--success-600)';

                // Busca o perfil na tabela 'colaboradores' e salva no navegador
                try {
                    const { data: userData, error: userError } = await window.supabaseClient
                        .from('colaboradores')
                        .select('perfil, nome_completo')
                        .eq('email', email)
                        .single();

                    if (userData && !userError) {
                        localStorage.setItem('user_role', (userData.perfil || '').toLowerCase());
                        localStorage.setItem('user_name', userData.nome_completo || '');
                    } else {
                        // Se o e-mail for o do Master direto, força master, senão operador
                        if (email === 'sentinela.command@gmail.com') {
                            localStorage.setItem('user_role', 'master');
                        } else {
                            localStorage.setItem('user_role', 'operador');
                        }
                    }

                    // REGISTAR O LOGIN NO HISTÓRICO DE ACESSOS
                    try {
                        const userAgent = navigator.userAgent;
                        const isMobile = /Mobi|Android/i.test(userAgent) ? 'Dispositivo Móvel' : 'Computador';
                        await window.supabaseClient.from('historico_acessos').insert([{
                            usuario_email: email,
                            acao: 'Login efetuado',
                            detalhes: `Acesso via ${isMobile}`
                        }]);
                    } catch (logError) {
                        console.error('Erro ao registar histórico:', logError);
                    }

                } catch (err) {
                    console.error('Erro ao buscar o nível de acesso do utilizador:', err);
                    if (email === 'sentinela.command@gmail.com') {
                        localStorage.setItem('user_role', 'master');
                    } else {
                        localStorage.setItem('user_role', 'operador');
                    }
                }

                setTimeout(() => {
                    if (loginScreen) loginScreen.style.display = 'none';
                    window.location.reload();
                }, 1000);
            }
        });
    }

    // Processo de Recuperação de Senha ("Esqueci minha senha")
    if (btnEsqueci) {
        btnEsqueci.addEventListener('click', async (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value;
            if (!email) {
                mensagemDiv.textContent = 'Digite seu e-mail acima para recuperar a senha.';
                mensagemDiv.style.color = 'var(--warning-600)';
                return;
            }

            const { data, error } = await window.supabaseClient.auth.resetPasswordForEmail(email, {
                redirectTo: window.location.href,
            });

            if (error) {
                mensagemDiv.textContent = 'Erro ao enviar e-mail de recuperação.';
                mensagemDiv.style.color = 'var(--danger-600)';
            } else {
                mensagemDiv.textContent = 'Instruções enviadas para o seu e-mail.';
                mensagemDiv.style.color = 'var(--success-600)';
            }
        });
    }

    // Controle do Modal de Pré-Cadastro
    if (btnAbrirPre && modalPre) {
        btnAbrirPre.addEventListener('click', (e) => {
            e.preventDefault();
            modalPre.style.display = 'flex';
        });
    }

    if (btnFecharPre && modalPre) {
        btnFecharPre.addEventListener('click', () => {
            modalPre.style.display = 'none';
        });
    }

    // Envio do Pré-Cadastro
    if (formPre) {
        formPre.addEventListener('submit', async (e) => {
            e.preventDefault();
            const nome = document.getElementById('pre-nome').value;
            const email = document.getElementById('pre-email').value;
            const cpf = document.getElementById('pre-cpf').value;
            const senha = document.getElementById('pre-senha').value;

            preMensagem.textContent = 'Enviando solicitação...';
            preMensagem.style.color = 'var(--primary-300)';

            const { error } = await window.supabaseClient
                .from('pre_cadastros')
                .insert([{ nome, email, cpf, senha_temporaria: senha, status: 'pendente' }]);

            if (error) {
                preMensagem.textContent = 'Erro ao enviar solicitação. E-mail já cadastrado.';
                preMensagem.style.color = 'var(--danger-600)';
            } else {
                preMensagem.textContent = 'Solicitação enviada com sucesso! Aguarde aprovação.';
                preMensagem.style.color = 'var(--success-600)';
                setTimeout(() => {
                    modalPre.style.display = 'none';
                    formPre.reset();
                    preMensagem.textContent = '';
                }, 2500);
            }
        });
    }

    // Processo de Logout (Encerramento de Sessão)
    if (btnLogout) {
        btnLogout.addEventListener('click', async (e) => {
            e.preventDefault();
            
            // Regista o Logout no histórico antes de destruir a sessão
            try {
                const { data: { session } } = await window.supabaseClient.auth.getSession();
                if (session && session.user) {
                    await window.supabaseClient.from('historico_acessos').insert([{
                        usuario_email: session.user.email,
                        acao: 'Logout efetuado',
                        detalhes: 'Encerramento manual de sessão'
                    }]);
                }
            } catch (err) { console.error('Erro ao registar logout:', err); }

            const { error } = await window.supabaseClient.auth.signOut();
            
            localStorage.removeItem('user_role');
            localStorage.removeItem('user_name');

            if (!error) {
                window.location.reload();
            } else {
                alert('Erro ao sair do sistema.');
            }
        });
    }

    // Envio do Formulário de Redefinição de Senha
    if (formRedefinir) {
        formRedefinir.addEventListener('submit', async (e) => {
            e.preventDefault();
            const novaSenha = document.getElementById('nova-senha').value;
            const confirmaSenha = document.getElementById('confirma-senha').value;

            if (novaSenha !== confirmaSenha) {
                redefinirMensagem.textContent = 'As senhas não coincidem.';
                redefinirMensagem.style.color = 'var(--danger-600)';
                return;
            }

            redefinirMensagem.textContent = 'Atualizando senha...';
            redefinirMensagem.style.color = 'var(--primary-300)';

            const { data, error } = await window.supabaseClient.auth.updateUser({
                password: novaSenha
            });

            if (error) {
                redefinirMensagem.textContent = 'Erro ao atualizar: ' + error.message;
                redefinirMensagem.style.color = 'var(--danger-600)';
            } else {
                redefinirMensagem.textContent = 'Senha atualizada com sucesso! Redirecionando...';
                redefinirMensagem.style.color = 'var(--success-600)';
                setTimeout(() => {
                    window.location.href = window.location.pathname;
                }, 2000);
            }
        });
    }
});

// Função para exibir/ocultar senha nos inputs
function togglePasswordVisibility(inputId, iconId) {
    const passwordInput = document.getElementById(inputId);
    const eyeIcon = document.getElementById(iconId);

    if (passwordInput && eyeIcon) {
        const isPassword = passwordInput.getAttribute('type') === 'password';
        
        // Alterna o tipo do campo
        passwordInput.setAttribute('type', isPassword ? 'text' : 'password');

        // Alterna o ícone SVG desenhado
        if (isPassword) {
            eyeIcon.innerHTML = `
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                <line x1="1" y1="1" x2="23" y2="23"></line>
            `;
        } else {
            eyeIcon.innerHTML = `
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
            `;
        }
    }
}
