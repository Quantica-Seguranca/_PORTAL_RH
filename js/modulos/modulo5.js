(function() {
    const supabase = window.supabaseClient;
    const getEl = id => document.getElementById(id);

    const stateModulo5 = {
        fila: [],
        sucessos: [],
        falhas: [],
        colaboradoresCache: []
    };

    async function initModulo5() {
        configurarAbas();
        configurarDragAndDrop();
        await carregarCacheColaboradores();
    }

    // Controle das abas inferiores
    function configurarAbas() {
        const botoes = document.querySelectorAll('.tab-upload-btn');
        const abas = document.querySelectorAll('.tab-upload-content');
        
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

    // Traz todos os ASPs ativos para a memória para checar as matrículas rapidamente
    async function carregarCacheColaboradores() {
        const { data } = await supabase.from('colaboradores').select('id, matricula, nome_completo').eq('situacao', 'Ativo');
        stateModulo5.colaboradoresCache = data || [];
    }

    // Configura área de soltar arquivos
    function configurarDragAndDrop() {
        const dropZone = getEl('drop-zone-massa');
        const fileInput = getEl('file-upload-massa');
        const btnSelect = getEl('btn-selecionar-arquivos');
        const btnProcessar = getEl('btn-processar-lote');

        btnSelect.addEventListener('click', () => fileInput.click());
        
        dropZone.addEventListener('dragover', (e) => { 
            e.preventDefault(); 
            dropZone.style.borderColor = 'var(--accent-500)'; 
            dropZone.style.backgroundColor = 'rgba(245, 158, 11, 0.05)';
        });
        
        dropZone.addEventListener('dragleave', () => { 
            dropZone.style.borderColor = 'var(--primary-600)'; 
            dropZone.style.backgroundColor = 'transparent';
        });
        
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault(); 
            dropZone.style.borderColor = 'var(--primary-600)';
            dropZone.style.backgroundColor = 'transparent';
            if (e.dataTransfer.files.length > 0) adicionarAFila(e.dataTransfer.files);
        });
        
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) adicionarAFila(e.target.files);
            e.target.value = ''; // Reseta o input
        });
        
        btnProcessar.addEventListener('click', processarLote);
    }

    // Lê os arquivos e extrai a matrícula do nome usando regex (apenas números)
    function adicionarAFila(arquivos) {
        Array.from(arquivos).forEach(file => {
            if(file.type === 'application/pdf') {
                const match = file.name.match(/(\d+)/); 
                const matriculaExtraida = match ? match[1] : 'Não identificada';
                stateModulo5.fila.push({ 
                    file, 
                    nome: file.name, 
                    tamanho: file.size, 
                    matricula: matriculaExtraida, 
                    status: 'Aguardando' 
                });
            }
        });
        atualizarUI();
    }

    function atualizarUI() {
        // Atualiza contadores
        getEl('upload-total').textContent = stateModulo5.fila.length;
        getEl('upload-sucesso').textContent = stateModulo5.sucessos.length;
        getEl('upload-falha').textContent = stateModulo5.falhas.length;
        
        const total = stateModulo5.fila.length + stateModulo5.sucessos.length + stateModulo5.falhas.length;
        const processados = stateModulo5.sucessos.length + stateModulo5.falhas.length;
        getEl('upload-progresso').textContent = total === 0 ? '0%' : Math.round((processados / total) * 100) + '%';

        // Libera ou trava o botão
        getEl('btn-processar-lote').disabled = stateModulo5.fila.length === 0;

        renderTabelas();
    }

    function renderTabelas() {
        // 1. Fila
        const tbFila = getEl('tabela-fila-massa');
        tbFila.innerHTML = '';
        if(stateModulo5.fila.length === 0) tbFila.innerHTML = '<tr><td colspan="4" class="text-center">Fila vazia.</td></tr>';
        stateModulo5.fila.forEach(item => {
            tbFila.innerHTML += `<tr><td>${item.nome}</td><td>${item.matricula}</td><td>${Math.round(item.tamanho/1024)} KB</td><td><span class="badge badge--pending">${item.status}</span></td></tr>`;
        });

        // 2. Sucessos
        const tbSuc = getEl('tabela-sucessos-massa');
        tbSuc.innerHTML = '';
        if(stateModulo5.sucessos.length === 0) tbSuc.innerHTML = '<tr><td colspan="4" class="text-center">Nenhum sucesso.</td></tr>';
        stateModulo5.sucessos.forEach(item => {
            tbSuc.innerHTML += `<tr><td>${item.nome}</td><td>${item.matricula}</td><td>${item.colaborador}</td><td><span class="badge badge--active">Concluído</span></td></tr>`;
        });

        // 3. Falhas
        const tbFal = getEl('tabela-falhas-massa');
        tbFal.innerHTML = '';
        if(stateModulo5.falhas.length === 0) tbFal.innerHTML = '<tr><td colspan="3" class="text-center">Nenhuma falha.</td></tr>';
        stateModulo5.falhas.forEach(item => {
            tbFal.innerHTML += `<tr><td>${item.nome}</td><td>${item.matricula}</td><td style="color: var(--danger-600);">${item.erro}</td></tr>`;
        });
    }

    // Processa os arquivos um a um
    async function processarLote() {
        const btn = getEl('btn-processar-lote');
        btn.disabled = true;
        btn.textContent = 'Processando...';

        while(stateModulo5.fila.length > 0) {
            const item = stateModulo5.fila.shift(); // Remove o primeiro da fila
            
            // Tenta achar o colaborador pela matrícula no cache local
            const colab = stateModulo5.colaboradoresCache.find(c => String(c.matricula) === String(item.matricula));
            
            if(!colab) {
                item.erro = 'Matrícula não consta no cadastro ativo';
                stateModulo5.falhas.push(item);
            } else {
                try {
                    // Upload pro Supabase
                    const nomeStorage = `${Date.now()}_${item.nome}`;
                    const { error } = await supabase.storage.from('documentos-colaboradores').upload(nomeStorage, item.file);
                    if(error) throw error;

                    const { data: urlData } = supabase.storage.from('documentos-colaboradores').getPublicUrl(nomeStorage);

                    // Salva o registro na tabela
                    await supabase.from('documentos').insert([{
                        nome_arquivo: item.nome,
                        storage_path: urlData.publicUrl,
                        colaborador_id: colab.id,
                        categoria_id: 'Holerite', // Forçado como Holerite neste módulo
                        status: 'Ativo'
                    }]);

                    item.colaborador = colab.nome_completo;
                    stateModulo5.sucessos.push(item);
                } catch (e) {
                    item.erro = e.message;
                    stateModulo5.falhas.push(item);
                }
            }
            atualizarUI(); // Atualiza a tela a cada arquivo processado
        }

        btn.textContent = '2. Processar Lote';
        alert("Lote processado! Confira as abas de Sucessos e Falhas.");
    }

    initModulo5();
})();