if (typeof window.modulo4Initialized === 'undefined') {
    window.modulo4Initialized = true;

    const stateModulo4 = {
        documentos: [],
        colaboradores: []
    };

    function getEl(id) { return document.getElementById(id); }

    async function initModulo4() {
        await carregarColaboradores();
        await carregarDocumentos();
        configurarEventosDragDrop();
    }

    async function carregarColaboradores() {
        const { data, error } = await window.supabaseClient
            .from('colaboradores')
            .select('id, matricula, nome_completo');

        if (!error && data) {
            stateModulo4.colaboradores = data;
        }
    }

    async function carregarDocumentos() {
        const container = getEl('container-pastas-holerites');
        if (!container) return;

        const { data, error } = await window.supabaseClient
            .from('holerites')
            .select('*')
            .order('criado_em', { ascending: false });

        if (error) {
            container.innerHTML = `<div class="text-center" style="padding: 2rem; color: var(--danger-600); text-align: center;">Erro ao carregar acervo de documentos.</div>`;
            return;
        }

        stateModulo4.documentos = data || [];
        renderizarTabela(stateModulo4.documentos);
    }

    function renderizarTabela(docs) {
        const container = getEl('container-pastas-holerites');
        if (!container) return;

        if (docs.length === 0) {
            container.innerHTML = `<div class="text-center" style="padding: 2rem; color: var(--primary-400); text-align: center;">Nenhum documento encontrado.</div>`;
            return;
        }

        // Agrupa os documentos por competência para gerar a visualização em "pastas"
        const agrupadosPorCompetencia = docs.reduce((acc, doc) => {
            const comp = doc.competencia || 'Geral / Outros';
            if (!acc[comp]) acc[comp] = [];
            acc[comp].push(doc);
            return acc;
        }, {});

        container.innerHTML = '';

        Object.keys(agrupadosPorCompetencia).forEach(competencia => {
            const itensDaCompetencia = agrupadosPorCompetencia[competencia];
            
            const pastaDiv = document.createElement('div');
            pastaDiv.style.cssText = 'background: var(--primary-900); border: 1px solid var(--primary-700); border-radius: var(--radius-md); overflow: hidden;';
            
            pastaDiv.innerHTML = `
                <div class="pasta-header" style="padding: 1rem 1.25rem; background: var(--primary-800); display: flex; justify-content: space-between; align-items: center; cursor: pointer;">
                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                        <span style="font-size: 1.25rem;">📁</span>
                        <div>
                            <strong style="color: white; font-size: 1rem;">Holerites - ${competencia}</strong>
                            <div style="font-size: 0.75rem; color: var(--primary-400);">${itensDaCompetencia.length} arquivo(s) processado(s)</div>
                        </div>
                    </div>
                    <button class="btn btn-sm toggle-pasta" style="font-size: 0.75rem; background: var(--primary-700); color: white; border: none; padding: 0.3rem 0.75rem; border-radius: 4px; cursor: pointer;">Expandir 🔽</button>
                </div>
                <div class="pasta-conteudo" style="display: none; padding: 1rem; border-top: 1px solid var(--primary-700);">
                    <div class="table-wrapper">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Arquivo</th>
                                    <th>Colaborador (ASP)</th>
                                    <th>Matrícula</th>
                                    <th>Data de Envio</th>
                                    <th>Status</th>
                                    <th style="text-align: center;">Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${itensDaCompetencia.map(doc => {
                                    const colab = stateModulo4.colaboradores.find(c => {
                                        if (c.id === doc.colaborador_id) return true;
                                        const matBancoLimpa = String(c.matricula || '').replace(/[^0-9]/g, '');
                                        const matDocLimpa = String(doc.matricula_colaborador || '').replace(/[^0-9]/g, '');
                                        return matBancoLimpa && matDocLimpa && matBancoLimpa === matDocLimpa;
                                    });
                                    const nomeColab = colab ? colab.nome_completo : 'Não vinculado';
                                    const dataEnvio = new Date(doc.criado_em).toLocaleDateString('pt-BR');
                                    
                                    return `
                                        <tr>
                                            <td><strong>${doc.nome_arquivo}</strong></td>
                                            <td>${nomeColab}</td>
                                            <td>${doc.matricula_colaborador || '-'}</td>
                                            <td>${dataEnvio}</td>
                                            <td><span class="badge badge--active">Ativo</span></td>
                                            <td style="text-align: center;">
                                                <button class="btn btn-sm btn-excluir-doc" data-id="${doc.id}" style="font-size: 0.75rem; padding: 0.2rem 0.5rem; background: var(--danger-600); color: white; border: none; border-radius: 4px; margin-right: 5px; cursor: pointer;">Excluir</button>
                                                ${doc.url_arquivo && doc.url_arquivo !== '#' ? `<button class="btn btn-sm" onclick="window.open('${doc.url_arquivo}', '_blank')" style="font-size: 0.75rem; padding: 0.2rem 0.5rem; background: var(--accent-600, #f59e0b); color: white; border: none; border-radius: 4px; cursor: pointer;">Baixar</button>` : ''}
                                            </td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;

            const header = pastaDiv.querySelector('.pasta-header');
            const conteudo = pastaDiv.querySelector('.pasta-conteudo');
            const btnToggle = pastaDiv.querySelector('.toggle-pasta');

            header.addEventListener('click', () => {
                const isOpen = conteudo.style.display === 'block';
                conteudo.style.display = isOpen ? 'none' : 'block';
                btnToggle.textContent = isOpen ? 'Expandir 🔽' : 'Recolher 🔼';
            });

            container.appendChild(pastaDiv);
        });

        container.querySelectorAll('.btn-excluir-doc').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                if (!confirm('Deseja excluir este documento?')) return;
                const id = e.target.getAttribute('data-id');
                const { error } = await window.supabaseClient.from('holerites').delete().eq('id', id);
                if (!error) carregarDocumentos();
                else alert('Erro ao excluir documento.');
            });
        });
    }

    function configurarEventosDragDrop() {
        const dropZone = getEl('drop-zone');
        const fileInput = getEl('file-upload');

        if (!dropZone || !fileInput) return;

        dropZone.addEventListener('click', () => fileInput.click());

        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.style.borderColor = 'var(--accent-500)';
        });

        dropZone.addEventListener('dragleave', () => {
            dropZone.style.borderColor = 'var(--primary-600)';
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.style.borderColor = 'var(--primary-600)';
            if (e.dataTransfer.files.length > 0) {
                processarLote(e.dataTransfer.files);
            }
        });

        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                processarLote(e.target.files);
            }
        });
    }

    async function processarLote(files) {
        const uploadQueue = getEl('upload-queue');
        const uploadList = getEl('upload-list');
        if (uploadQueue) uploadQueue.style.display = 'block';
        if (uploadList) uploadList.innerHTML = '';

        const totalArquivos = files.length;
        let concluidos = 0;
        let sucessos = 0;
        let erros = 0;

        const statusGlobal = document.createElement('div');
        statusGlobal.style.cssText = 'padding: 0.5rem; background: var(--primary-800); border-radius: var(--radius-md); text-align: center; font-weight: bold; color: white;';
        statusGlobal.textContent = `Iniciando processamento em lote de ${totalArquivos} arquivos...`;
        if (uploadList) uploadList.appendChild(statusGlobal);

        async function processarArquivoUnico(file) {
            const nomeArquivo = file.name;
            try {
                const extensao = nomeArquivo.split('.').pop();
                const nomeNoBucket = `holerites_${Date.now()}_${Math.random().toString(36).substring(2,8)}.${extensao}`;

                const { error: uploadError } = await window.supabaseClient.storage
                    .from('documentos-colaboradores')
                    .upload(nomeNoBucket, file);

                if (uploadError) throw new Error(uploadError.message);

                const { data: urlData } = window.supabaseClient.storage
                    .from('documentos-colaboradores')
                    .getPublicUrl(nomeNoBucket);

                const urlPublica = urlData.publicUrl;

                const partes = nomeArquivo.split('-');
                let matriculaExtraida = partes[4] || 'Geral';
                let colaboradorId = null;

                const match = stateModulo4.colaboradores.find(c => {
                    const matBancoLimpa = String(c.matricula || '').replace(/[^0-9]/g, '');
                    const matArquivoLimpa = String(matriculaExtraida).replace(/[^0-9]/g, '');
                    return matBancoLimpa && matArquivoLimpa && matBancoLimpa === matArquivoLimpa;
                });

                if (match) {
                    colaboradorId = match.id;
                }

                const payload = {
                    matricula_colaborador: matriculaExtraida,
                    competencia: 'Junho de 2026',
                    nome_arquivo: nomeArquivo,
                    url_arquivo: urlPublica
                };

                if (colaboradorId) {
                    payload.colaborador_id = colaboradorId;
                }

                const { error: dbError } = await window.supabaseClient
                    .from('holerites')
                    .insert([payload]);

                if (dbError) throw new Error(dbError.message);

                sucessos++;
            } catch (err) {
                erros++;
                console.error(`Erro ao processar ${nomeArquivo}:`, err.message);
            } finally {
                concluidos++;
                statusGlobal.textContent = `Processando: ${concluidos} / ${totalArquivos} concluídos (${sucessos} sucessos, ${erros} falhas)`;
            }
        }

        // Concorrência controlada de 10 em 10 arquivos para alta performance sem travamentos
        const tamanhoLote = 10;
        const arquivosArray = Array.from(files);

        for (let i = 0; i < arquivosArray.length; i += tamanhoLote) {
            const lote = arquivosArray.slice(i, i + tamanhoLote);
            await Promise.all(lote.map(file => processarArquivoUnico(file)));
        }

        statusGlobal.innerHTML = `<span style="color: var(--success-600);">Processamento em lote finalizado!</span> Total: ${totalArquivos} | Sucessos: ${sucessos} | Falhas: ${erros}`;

        setTimeout(() => {
            if (uploadQueue) uploadQueue.style.display = 'none';
            carregarDocumentos();
        }, 4000);
    }

    initModulo4();
}