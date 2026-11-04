// Dicionário com os módulos e os perfis permitidos (Apenas Master e Gestor têm acesso nativo à Administração)
const rotas = {
    'modulo1': { 
        html: 'modulos/modulo1.html', 
        js: 'js/modulos/modulo1.js', 
        perfisPermitidos: ['master', 'gestor'] // Apenas perfis de topo. Exceções são tratadas pelas checkboxes.
    },
    'modulo2': { 
        html: 'modulos/modulo2.html', 
        js: 'js/modulos/modulo2.js', 
        perfisPermitidos: ['master', 'gestor', 'gerente', 'admin', 'operador', 'operacional'] 
    },
    'modulo3': { 
        html: 'modulos/modulo3.html', 
        js: 'js/modulos/modulo3.js', 
        perfisPermitidos: ['master', 'gestor', 'gerente', 'admin', 'operador', 'operacional', 'colaborador'] 
    },
    'modulo4': { 
        html: 'modulos/modulo4.html', 
        js: 'js/modulos/modulo4.js', 
        perfisPermitidos: ['master', 'gestor', 'gerente', 'admin'] 
    },
    'modulo9': { 
        html: 'modulos/modulo9.html', 
        js: 'js/modulos/modulo9.js', 
        perfisPermitidos: ['master', 'gestor', 'gerente', 'admin', 'operador', 'operacional', 'colaborador'] 
    },
    'modulo10': { 
        html: 'modulos/modulo10.html', 
        js: 'js/modulos/modulo10.js', 
        perfisPermitidos: ['master', 'gestor', 'gerente', 'admin', 'operador', 'operacional', 'colaborador'] 
    }
};

// Armazena os módulos já baixados para evitar requisições repetidas à rede
const cacheModulos = {};

// Vinculação explícita e obrigatória no escopo global do navegador
window.carregarModulo = async function(nomeModulo) {
    const rota = rotas[nomeModulo];
    if (!rota) {
        alert("Módulo ainda não configurado.");
        return;
    }

    const perfilUsuario = window.userPerfil || localStorage.getItem('user_role') || 'colaborador';
    const permissoes = window.userPermissoes || {};

    // Verifica se tem acesso pelo cargo nativo OU pela permissão customizada (checkbox)
    let temAcesso = rota.perfisPermitidos.includes(perfilUsuario);
    if (nomeModulo === 'modulo1' && permissoes.ver_admin === true) {
        temAcesso = true;
    }

    if (!temAcesso) {
        alert("Acesso negado. Seu nível de privilégio não permite acessar esta área.");
        return;
    }

    try {
        const container = document.getElementById('conteudo-principal');
        
        // 1. Carrega o HTML (usa o cache se já foi visitado, senão faz o fetch)
        let html = cacheModulos[nomeModulo];
        if (!html) {
            const versao = new Date().getTime();
            const resposta = await fetch(`${rota.html}?v=${versao}`);
            if (!resposta.ok) throw new Error("Arquivo HTML não encontrado");
            html = await resposta.text();
            cacheModulos[nomeModulo] = html;
        }
        
        container.innerHTML = html;

        // 2. Remove o script anterior da memória para evitar conflitos
        const scriptAntigo = document.getElementById('script-modulo-ativo');
        if (scriptAntigo) scriptAntigo.remove();

        // 3. Injeta o JavaScript correspondente
        if (rota.js) {
            const script = document.createElement('script');
            const versaoJs = new Date().getTime();
            script.src = `${rota.js}?v=${versaoJs}`;
            script.id = 'script-modulo-ativo';
            document.body.appendChild(script);
        }
    } catch (erro) {
        console.error("Erro na navegação:", erro);
        document.getElementById('conteudo-principal').innerHTML = 
            `<h2 style="color:red;">Erro ao carregar o módulo. Verifique se os arquivos existem.</h2>`;
    }
};

async function verificarPermissoesMenu() {
    try {
        if (!window.supabaseClient) return;
        const { data: { session } } = await window.supabaseClient.auth.getSession();
        if (!session) return;

        // Busca o perfil E as permissões customizadas (JSONB) do banco
        const { data: colaborador } = await window.supabaseClient
            .from('colaboradores')
            .select('perfil, permissoes')
            .eq('email', session.user.email)
            .single();

        window.userPerfil = colaborador && colaborador.perfil ? colaborador.perfil.toLowerCase() : 'colaborador';
        window.userPermissoes = colaborador && colaborador.permissoes ? colaborador.permissoes : { ver_admin: false, gerir_acessos: false, excluir_usuarios: false };
        
        // Garante a hierarquia máxima e todas as checkboxes para o Comando Master
        if (session.user.email === 'sentinela.command@gmail.com') {
            window.userPerfil = 'master';
            window.userPermissoes = { ver_admin: true, gerir_acessos: true, excluir_usuarios: true };
        }
        localStorage.setItem('user_role', window.userPerfil);

        const menuAdmin = document.getElementById('menu-admin');
        const menuColaboradores = document.getElementById('menu-colaboradores');
        const menuPortal = document.getElementById('menu-portal');
        const menuHolerites = document.getElementById('menu-holerites');
        const menuInformativos = document.getElementById('menu-informativos');
        const menuMensagens = document.getElementById('menu-mensagens');

        if (menuInformativos) menuInformativos.style.display = 'block';
        if (menuMensagens) menuMensagens.style.display = 'block';

        // Regra para exibir o botão "1. Administração": ser Master/Gestor OU ter checkbox autorizando
        const podeVerAdmin = ['master', 'gestor'].includes(window.userPerfil) || window.userPermissoes.ver_admin === true;

        if (menuAdmin) menuAdmin.style.display = podeVerAdmin ? 'block' : 'none';
        
        // Define as exibições dos demais menus
        if (menuColaboradores) menuColaboradores.style.display = window.userPerfil === 'colaborador' ? 'none' : 'block';
        if (menuPortal) menuPortal.style.display = 'block';
        if (menuHolerites) menuHolerites.style.display = ['master', 'gestor', 'gerente', 'admin'].includes(window.userPerfil) ? 'block' : 'none';

        // Lógica de redirecionamento para a tela inicial assim que o usuário faz login
        if (podeVerAdmin) {
            window.carregarModulo('modulo1');
        } else if (['operador', 'operacional', 'admin', 'gerente'].includes(window.userPerfil)) {
            window.carregarModulo('modulo2');
        } else {
            window.carregarModulo('modulo3');
        }

    } catch (e) {
        console.error("Erro ao carregar permissões do menu:", e);
    }
}

document.addEventListener('contextmenu', function (e) {
    e.preventDefault();
});

document.addEventListener('DOMContentLoaded', () => {
    verificarPermissoesMenu();
});
