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
        // Se for recuperação, esconde o login e força a exibição do modal de nova senha
        if (loginScreen) loginScreen.style.display = 'none';
        if (modalRedefinir) modalRedefinir.style.display = 'flex';
    } else {
        // Verificação normal de sessão ativa se não for recuperação
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
                mensagemDiv.textContent = 'Login bem-sucedido! Carregando...';
                mensagemDiv.style.color = 'var(--success-600)';
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
            const { error } = await window.supabaseClient.auth.signOut();
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
