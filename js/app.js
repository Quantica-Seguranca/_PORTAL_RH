// Dicionário com os módulos e os perfis permitidos para acesso
const rotas = {
    'modulo1': { 
        html: 'modulos/modulo1.html', 
        js: 'js/modulos/modulo1.js', 
        perfisPermitidos: ['master', 'gerente'] 
    },
    'modulo2': { 
        html: 'modulos/modulo2.html', 
        js: 'js/modulos/modulo2.js', 
        perfisPermitidos: ['master', 'gerente', 'admin', 'operacional'] 
    },
    'modulo3': { 
        html: 'modulos/modulo3.html', 
        js: 'js/modulos/modulo3.js', 
        perfisPermitidos: ['master', 'gerente', 'admin', 'operacional', 'colaborador'] 
    },
    'modulo4': { 
        html: 'modulos/modulo4.html', 
        js: 'js/modulos/modulo4.js', 
        perfisPermitidos: ['master', 'gerente', 'admin'] 
    },
    'modulo9': { 
        html: 'modulos/modulo9.html', 
        js: 'js/modulos/modulo9.js', 
        perfisPermitidos: ['master', 'gerente', 'admin', 'operacional', 'colaborador'] 
    },
    'modulo10': { 
        html: 'modulos/modulo10.html', 
        js: 'js/modulos/modulo10.js', 
        perfisPermitidos: ['master', 'gerente', 'admin', 'operacional', 'colaborador'] 
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

    const perfilUsuario = window.userPerfil || 'colaborador';

    if (!rota.perfisPermitidos.includes(perfilUsuario)) {
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

        const { data: colaborador } = await window.supabaseClient
            .from('colaboradores')
            .select('perfil')
            .eq('email', session.user.email)
            .single();

        window.userPerfil = colaborador && colaborador.perfil ? colaborador.perfil.toLowerCase() : 'colaborador';

        const menuAdmin = document.getElementById('menu-admin');
        const menuColaboradores = document.getElementById('menu-colaboradores');
        const menuPortal = document.getElementById('menu-portal');
        const menuHolerites = document.getElementById('menu-holerites');
        const menuInformativos = document.getElementById('menu-informativos');
        const menuMensagens = document.getElementById('menu-mensagens');

        if (menuInformativos) menuInformativos.style.display = 'block';
        if (menuMensagens) menuMensagens.style.display = 'block';

        if (window.userPerfil === 'colaborador') {
            if (menuAdmin) menuAdmin.style.display = 'none';
            if (menuColaboradores) menuColaboradores.style.display = 'none';
            if (menuPortal) menuPortal.style.display = 'block';
            if (menuHolerites) menuHolerites.style.display = 'none';
            window.carregarModulo('modulo3');
        } else if (window.userPerfil === 'operacional') {
            if (menuAdmin) menuAdmin.style.display = 'none';
            if (menuColaboradores) menuColaboradores.style.display = 'block';
            if (menuPortal) menuPortal.style.display = 'block';
            if (menuHolerites) menuHolerites.style.display = 'none';
            window.carregarModulo('modulo2');
        } else if (window.userPerfil === 'admin') {
            if (menuAdmin) menuAdmin.style.display = 'none';
            if (menuColaboradores) menuColaboradores.style.display = 'block';
            if (menuPortal) menuPortal.style.display = 'block';
            if (menuHolerites) menuHolerites.style.display = 'block';
            window.carregarModulo('modulo2');
        } else {
            // Master e Gerente
            if (menuAdmin) menuAdmin.style.display = 'block';
            if (menuColaboradores) menuColaboradores.style.display = 'block';
            if (menuPortal) menuPortal.style.display = 'block';
            if (menuHolerites) menuHolerites.style.display = 'block';
            window.carregarModulo('modulo1');
        }
    } catch (e) {
        console.error("Erro ao carregar permissões do menu:", e);
    }
}

/* 
// [OPCIONAL] Mantenha comentado enquanto estiver a testar os dados com o F12
document.addEventListener('keydown', function (e) {
    if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) ||
        (e.ctrlKey && e.key === 'u')
    ) {
        e.preventDefault();
        alert('Ação restrita pelo sistema de segurança.');
        return false;
    }
});

document.addEventListener('contextmenu', function (e) {
    e.preventDefault();
});
*/

document.addEventListener('DOMContentLoaded', () => {
    verificarPermissoesMenu();
});
