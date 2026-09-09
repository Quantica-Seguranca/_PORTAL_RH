// Dicionário com os módulos e os perfis permitidos para acesso
const rotas = {
    'modulo1': { 
        html: 'modulos/modulo1.html', 
        js: 'js/modulos/modulo1.js', 
        perfisPermitidos: ['master', 'gerente'] // Restrito apenas a Master e Gerente
    },
    'modulo2': { 
        html: 'modulos/modulo2.html', 
        js: 'js/modulos/modulo2.js', 
        perfisPermitidos: ['master', 'gerente', 'admin', 'operacional'] // Administrador alimenta e gerencia o efetivo
    },
    'modulo3': { 
        html: 'modulos/modulo3.html', 
        js: 'js/modulos/modulo3.js', 
        perfisPermitidos: ['master', 'gerente', 'admin', 'operacional', 'colaborador'] 
    },
    'modulo4': { 
        html: 'modulos/modulo4.html', 
        js: 'js/modulos/modulo4.js', 
        perfisPermitidos: ['master', 'gerente', 'admin'] // Restrito para upload e gestão de holerites em lote
    }
};

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
        const resposta = await fetch(rota.html);
        if (!resposta.ok) throw new Error("Arquivo HTML não encontrado");
        
        const html = await resposta.text();
        document.getElementById('conteudo-principal').innerHTML = html;

        const scriptAntigo = document.getElementById('script-modulo-ativo');
        if (scriptAntigo) scriptAntigo.remove();

        if (rota.js) {
            const script = document.createElement('script');
            script.src = rota.js;
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
            // Administrador focado em alimentar o sistema e gerenciar holerites (sem acesso ao Módulo 1 de usuários)
            if (menuAdmin) menuAdmin.style.display = 'none';
            if (menuColaboradores) menuColaboradores.style.display = 'block';
            if (menuPortal) menuPortal.style.display = 'block';
            if (menuHolerites) menuHolerites.style.display = 'block';
            window.carregarModulo('modulo2');
        } else {
            // Master e Gerente (Controle total de usuários, efetivo, holerites e portal)
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

document.addEventListener('DOMContentLoaded', () => {
    verificarPermissoesMenu();
});