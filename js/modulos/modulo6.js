(function() {
    const supabase = window.supabaseClient;
    const getEl = id => document.getElementById(id);

    const stateModulo6 = {
        fila: [],
        modelos: [],
        modeloSelecionado: null,
        paginacao: { pagina: 1, limite: 10, total: 0 },
        filtros: { busca: '', status: '' }
    };

    async function initModulo6() {
        configurarAbas();
        configurarEventosFila();
        configurarEditorModelos();
        
        await carregarEstatisticas();
        carregarFilaEmails();
        carregarModelos();
    }

    // ==========================================
    // ABAS DO MÓDULO
    // ==========================================
    function configurarAbas() {
        const botoes = document.querySelectorAll('.tab-email-btn');
        const abas = document.querySelectorAll('.tab-email-content');
        
        botoes.forEach(btn => {
            btn.addEventListener('click', (e) => {
                botoes.forEach(b => { b.classList.remove('btn-primary'); b.classList.add('btn-secondary'); });
                e.target.classList.remove('btn-secondary'); 
                e.target.classList.add('btn-primary');
                
                abas.forEach(aba => aba.style.display = 'none');
                getEl(e.target.getAttribute('data-target')).style.display = 'block';
            });
        });
    }

    // ==========================================
    // ESTATÍSTICAS E FILA DE E-MAILS
    // ==========================================
    async function carregarEstatisticas() {
        const { data, error } = await supabase.from('fila_envio_emails').select('status');
        if (error) return;

        const enviados = data.filter(e => e.status === 'enviado').length;
        const pendentes = data.filter(e => e.status === 'pendente').length;
        const falhas = data.filter(e => e.status === 'falha').length;
        const total = data.length;
        const taxa = total > 0 ? Math.round((enviados / total) * 100) : 0;

        getEl('email-enviados').textContent = enviados;
        getEl('email-pendentes').textContent = pendentes;
        getEl('email-falhas').textContent = falhas;
        getEl('email-taxa').textContent = taxa + '%';
    }

    async function carregarFilaEmails() {
        const { pagina, limite } = stateModulo6.paginacao;
        const inicio = (pagina - 1) * limite;
        const fim = inicio + limite - 1;

        let query = supabase.from('fila_envio_emails').select('*', { count: 'exact' });

        if (stateModulo6.filtros.status) query = query.eq('status', stateModulo6.filtros.status);
        if (stateModulo6.filtros.busca) query = query.or(`destinatario.ilike.%${stateModulo6.filtros.busca}%,assunto.ilike.%${stateModulo6.filtros.busca}%`);

        const { data, count, error } = await query.order('created_at', { ascending: false }).range(inicio, fim);

        if (error) {
            getEl('tabela-fila-emails').innerHTML = '<tr><td colspan="5" class="text-center" style="color:red;">Erro ao carregar fila.</td></tr>';
            return;
        }

        stateModulo6.fila = data || [];
        stateModulo6.paginacao.total = count || 0;
        
        renderizarFila();
        atualizarPaginacaoFila();
    }

    function renderizarFila() {
        const tbody = getEl('tabela-fila-emails');
        tbody.innerHTML = '';

        if (stateModulo6.fila.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center">Nenhum e-mail encontrado.</td></tr>';
            return;
        }

        stateModulo6.fila.forEach(email => {
            const dataHora = new Date(email.created_at).toLocaleString('pt-BR');
            let statusClass = 'badge--inactive';
            if (email.status === 'enviado') statusClass = 'badge--active';
            else if (email.status === 'pendente') statusClass = 'badge--pending';
            else if (email.status === 'falha') statusClass = 'badge--blocked';

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${email.destinatario}</td>
                <td><strong>${email.assunto}</strong></td>
                <td><span class="badge ${statusClass}">${email.status}</span></td>
                <td>${dataHora}</td>
                <td class="actions">
                    ${email.status === 'falha' ? `<button class="btn-icon" title="Tentar Novamente" onclick="alert('Reenvio não implementado no frontend puro.')">🔄</button>` : ''}
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    function atualizarPaginacaoFila() {
        const { pagina, limite, total } = stateModulo6.paginacao;
        const totalPaginas = Math.ceil(total / limite) || 1;
        getEl('info-pag-emails').textContent = `Página ${pagina} de ${totalPaginas} (${total} e-mails)`;
        getEl('btn-ant-emails').disabled = pagina <= 1;
        getEl('btn-prox-emails').disabled = pagina >= totalPaginas;
    }

    function configurarEventosFila() {
        let timer;
        getEl('busca-email').addEventListener('input', (e) => {
            clearTimeout(timer);
            timer = setTimeout(() => {
                stateModulo6.filtros.busca = e.target.value.trim();
                stateModulo6.paginacao.pagina = 1;
                carregarFilaEmails();
            }, 400);
        });

        getEl('filtro-status-email').addEventListener('change', (e) => {
            stateModulo6.filtros.status = e.target.value;
            stateModulo6.paginacao.pagina = 1;
            carregarFilaEmails();
        });

        getEl('btn-ant-emails').addEventListener('click', () => {
            if (stateModulo6.paginacao.pagina > 1) { stateModulo6.paginacao.pagina--; carregarFilaEmails(); }
        });
        getEl('btn-prox-emails').addEventListener('click', () => {
            const { pagina, limite, total } = stateModulo6.paginacao;
            if (pagina < Math.ceil(total / limite)) { stateModulo6.paginacao.pagina++; carregarFilaEmails(); }
        });
    }

    // ==========================================
    // EDITOR DE MODELOS
    // ==========================================
    async function carregarModelos() {
        const { data, error } = await supabase.from('modelos_email').select('*').order('nome', { ascending: true });
        if (error) return;
        stateModulo6.modelos = data || [];
        renderizarListaModelos();
    }

    function renderizarListaModelos() {
        const lista = getEl('lista-modelos');
        lista.innerHTML = '';
        
        stateModulo6.modelos.forEach(mod => {
            const div = document.createElement('div');
            div.style.padding = '0.75rem';
            div.style.backgroundColor = 'var(--primary-800)';
            div.style.border = '1px solid var(--primary-700)';
            div.style.borderRadius = 'var(--radius-md)';
            div.style.cursor = 'pointer';
            div.innerHTML = `<strong>${mod.nome}</strong><br><small style="color: var(--primary-400);">${mod.chave}</small>`;
            
            div.addEventListener('click', () => selecionarModelo(mod));
            lista.appendChild(div);
        });
    }

    function selecionarModelo(mod) {
        stateModulo6.modeloSelecionado = mod;
        getEl('modelo-id').value = mod.id || '';
        getEl('modelo-nome').value = mod.nome || '';
        getEl('modelo-chave').value = mod.chave || '';
        getEl('modelo-assunto').value = mod.assunto || '';
        getEl('modelo-corpo').value = mod.corpo_html || '';
        atualizarPreview();
    }

    function atualizarPreview() {
        getEl('modelo-preview').innerHTML = getEl('modelo-corpo').value;
    }

    function configurarEditorModelos() {
        getEl('modelo-corpo').addEventListener('input', atualizarPreview);
        
        getEl('btn-novo-modelo').addEventListener('click', () => {
            selecionarModelo({ id: '', nome: '', chave: '', assunto: '', corpo_html: '<p>Olá {{nome_colaborador}},</p>\n<p>Sua mensagem aqui.</p>' });
        });

        getEl('btn-salvar-modelo').addEventListener('click', async () => {
            const btn = getEl('btn-salvar-modelo');
            btn.disabled = true;
            btn.textContent = 'Salvando...';

            const payload = {
                nome: getEl('modelo-nome').value,
                chave: getEl('modelo-chave').value,
                assunto: getEl('modelo-assunto').value,
                corpo_html: getEl('modelo-corpo').value,
                ativo: true
            };

            const id = getEl('modelo-id').value;
            let result;

            if (id) {
                result = await supabase.from('modelos_email').update(payload).eq('id', id);
            } else {
                result = await supabase.from('modelos_email').insert([payload]);
            }

            btn.disabled = false;
            btn.textContent = 'Salvar Modelo';

            if (result.error) {
                alert(`Erro: ${result.error.message}`);
            } else {
                alert('Modelo salvo com sucesso!');
                carregarModelos();
            }
        });
    }

    initModulo6();
})();