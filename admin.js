const URL_API = 'https://script.google.com/macros/s/AKfycby-rnmBcploCmdEb8QWkMyo1tEanCcPkmNOA_QMlujH0XQvjLeiCCYhkqe7Hqhi6-mo8A/exec';

// --- CONFIGURAÇÃO GERAL ---
const URL_LOGO = './logo.png'; 

// Campos padrão (Cidade e Estado agora são opcionais)
const CAMPOS_PADRAO = [
    { key: 'NomeCompleto', label: 'Nome Completo' }, 
    { key: 'DataNascimento', label: 'Nascimento' }, 
    { key: 'Telefone', label: 'Celular' }, 
    { key: 'Endereco', label: 'Endereço' },
    { key: 'Cidade', label: 'Cidade' }, 
    { key: 'Estado', label: 'Estado (UF)' }, 
    { key: 'NomeInstituicao', label: 'Instituição' }, 
    { key: 'NomeCurso', label: 'Curso' }, 
    { key: 'PeriodoCurso', label: 'Período' }, 
    { key: 'Matricula', label: 'Matrícula' }, 
];

const LABELS_TODOS_CAMPOS = {
    'NomeCompleto': 'Nome Completo',
    'CPF': 'CPF',
    'DataNascimento': 'Nascimento',
    'Telefone': 'Celular',
    'Endereco': 'Endereço',
    'Cidade': 'Cidade',
    'Estado': 'UF',
    'NomeInstituicao': 'Instituição',
    'NomeCurso': 'Curso',
    'PeriodoCurso': 'Período',
    'Matricula': 'Matrícula',
    'Email': 'E-mail'
};

// Estado da Aplicação
let mapaEventos = {}; 
let cacheEventos = {}; 
let chartEventosInstance = null; let chartStatusInstance = null;
let todasInscricoes = [];         
let inscricoesFiltradas = []; 
let dashboardData = []; 
let paginaAtual = 1;
const ITENS_POR_PAGINA = 50;
let selecionados = new Set(); 

// --- LOADING CUSTOMIZADO ---
function showLoading(msg = 'Processando...') {
    Swal.fire({
        html: `
            <div style="display:flex; flex-direction:column; align-items:center; gap:15px; padding:20px;">
                <img src="${URL_LOGO}" style="width:60px; height:auto; animation: pulse-swal 1.5s infinite ease-in-out;" onerror="this.style.display='none'">
                <h3 style="font-family:'Poppins', sans-serif; font-size:1.1rem; color:#1e293b; margin:0; font-weight:600;">${msg}</h3>
                <style>@keyframes pulse-swal { 0% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.1); opacity: 0.8; } 100% { transform: scale(1); opacity: 1; } }</style>
            </div>
        `,
        showConfirmButton: false, allowOutsideClick: false, width: '300px', background: '#fff'
    });
}

function safeDate(val) {
    if(!val) return '-';
    try { const d = new Date(val); return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('pt-BR'); } catch(e) { return '-'; }
}

// --- AUTENTICAÇÃO ---
function toggleSenha() {
    const input = document.getElementById('admin-pass');
    const icon = document.querySelector('.password-toggle');
    if (input.type === 'password') { input.type = 'text'; icon.classList.replace('fa-eye', 'fa-eye-slash'); } 
    else { input.type = 'password'; icon.classList.replace('fa-eye-slash', 'fa-eye'); }
}

function realizarLogin(e) {
    e.preventDefault();
    const pass = document.getElementById('admin-pass').value;
    
    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Entrando...';

    showLoading('Autenticando...');

    fetch(URL_API, { method: 'POST', body: JSON.stringify({ action: 'loginAdmin', senha: pass }) })
    .then(res => res.json()).then(json => {
        Swal.close();
        if(json.auth) {
            document.getElementById('login-screen').style.display = 'none';
            document.getElementById('admin-panel').classList.remove('hidden');
            sessionStorage.setItem('admin_token', pass);
            carregarDashboard();
        } else { 
            btn.disabled = false;
            btn.innerHTML = originalText;
            Swal.fire({icon: 'error', title: 'Acesso Negado', text: 'Senha incorreta.'}); 
        }
    }).catch(() => {
        Swal.close();
        btn.disabled = false;
        btn.innerHTML = originalText;
        Swal.fire('Erro de Conexão', 'Verifique sua internet.', 'error');
    });
}

function logout() { 
    sessionStorage.removeItem('admin_token'); 
    window.location.reload(); 
}

// --- NAVEGAÇÃO APP SHELL ---
function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    
    const selectedTab = document.getElementById(tabId);
    if(selectedTab) selectedTab.classList.remove('hidden');
    
    let btnId = '';
    if(tabId === 'tab-dashboard') btnId = 'btn-dashboard';
    if(tabId === 'tab-relatorios') btnId = 'btn-relatorios';
    if(tabId === 'tab-eventos') btnId = 'btn-eventos';
    if(tabId === 'tab-inscricoes') btnId = 'btn-inscricoes';
    if(tabId === 'tab-config') btnId = 'btn-config';
    
    if(btnId) {
        const btn = document.getElementById(btnId);
        if(btn) btn.classList.add('active');
    }

    if(tabId === 'tab-dashboard' || tabId === 'tab-relatorios') carregarDashboard();
    if(tabId === 'tab-eventos') carregarEventosAdmin();
    if(tabId === 'tab-inscricoes') carregarInscricoes();
    if(tabId === 'tab-config') {
        carregarInstituicoes();
        carregarConfigGeral(); 
    }
}

// --- CONFIGURAÇÃO GERAL ---
function carregarConfigGeral() {
    fetch(`${URL_API}?action=getConfigDrive&token=${sessionStorage.getItem('admin_token')}`)
    .then(r => r.json())
    .then(json => {
        if(json.status === 'success') {
            document.getElementById('config-drive-id').value = json.idPasta || '';
            document.getElementById('config-cor').value = json.corCard || '#2563eb';
            document.getElementById('config-cor-picker').value = json.corCard || '#2563eb';
            document.getElementById('config-nome-sec').value = json.nomeSec || '';
            document.getElementById('config-nome-resp').value = json.nomeResp || '';
            document.getElementById('config-assinatura').value = json.assinatura || ''; 
        }
    });
}

function salvarConfigGeral() {
    const id = document.getElementById('config-drive-id').value;
    const cor = document.getElementById('config-cor').value;
    const sec = document.getElementById('config-nome-sec').value;
    const resp = document.getElementById('config-nome-resp').value;
    const ass = document.getElementById('config-assinatura').value; 

    showLoading('Salvando...');
    fetch(URL_API, { 
        method: 'POST', 
        body: JSON.stringify({ 
            action: 'salvarConfigGeral', 
            senha: sessionStorage.getItem('admin_token'),
            idPasta: id,
            corCard: cor,
            nomeSec: sec,
            nomeResp: resp,
            assinatura: ass
        }) 
    }).then(() => {
        Swal.fire({icon: 'success', title: 'Configurações Salvas!', timer: 1500, showConfirmButton: false});
    });
}

// --- DASHBOARD E DADOS GERAIS ---
function carregarDashboard() {
    const token = sessionStorage.getItem('admin_token');
    Promise.all([
        fetch(`${URL_API}?action=getTodosEventos`).then(r => r.json()),
        fetch(`${URL_API}?action=getInscricoesAdmin&token=${token}`).then(r => r.json())
    ]).then(([jsonEventos, jsonInscricoes]) => {
        mapaEventos = {}; 
        cacheEventos = {}; 
        if(jsonEventos.data) jsonEventos.data.forEach(ev => {
            if (ev.id && ev.titulo) {
                mapaEventos[ev.id] = ev.titulo;
                cacheEventos[ev.id] = ev; 
            }
        });
        
        dashboardData = jsonInscricoes.data || [];
        atualizarSelectsRelatorio(jsonEventos.data || [], dashboardData);
        atualizarEstatisticasDashboard(dashboardData);

        const contagemEventos = {}, contagemStatus = {};
        dashboardData.forEach(i => {
            const nome = mapaEventos[i.eventoId] || `Evento ${i.eventoId}`;
            contagemEventos[nome] = (contagemEventos[nome] || 0) + 1;
            contagemStatus[i.status] = (contagemStatus[i.status] || 0) + 1;
        });
        
        if(document.getElementById('chartEventos')) {
            renderizarGraficos(contagemEventos, contagemStatus);
        }
    });
}

function atualizarEstatisticasDashboard(dados) {
    const elTotal = document.getElementById('stat-total');
    if(elTotal) {
        elTotal.innerText = dados.length;
        document.getElementById('stat-aprovados').innerText = dados.filter(i => i.status.includes('Aprovada') || i.status.includes('Emitida')).length;
        document.getElementById('stat-pendentes').innerText = dados.filter(i => i.status === 'Pendente').length;
    }
}

function renderizarGraficos(dadosEventos, dadosStatus) {
    if(chartEventosInstance) chartEventosInstance.destroy();
    chartEventosInstance = new Chart(document.getElementById('chartEventos').getContext('2d'), {
        type: 'bar', 
        data: { labels: Object.keys(dadosEventos), datasets: [{ label: 'Inscritos', data: Object.values(dadosEventos), backgroundColor: '#2563eb', borderRadius: 4 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, grid: { borderDash: [2, 4] } }, x: { grid: { display: false } } } }
    });
    if(chartStatusInstance) chartStatusInstance.destroy();
    chartStatusInstance = new Chart(document.getElementById('chartStatus').getContext('2d'), {
        type: 'doughnut', 
        data: { labels: Object.keys(dadosStatus), datasets: [{ data: Object.values(dadosStatus), backgroundColor: ['#ca8a04', '#16a34a', '#dc2626', '#2563eb'], borderWidth: 0 }] },
        options: { responsive: true, maintainAspectRatio: false, cutout: '70%', plugins: { legend: { position: 'right', labels: { usePointStyle: true, boxWidth: 8 } } } }
    });
}

function atualizarSelectsRelatorio(eventos, inscricoes) {
    const selEvento = document.getElementById('relatorio-evento');
    if(selEvento) {
        selEvento.innerHTML = '<option value="">Todos os Eventos</option>';
        eventos.forEach(ev => {
            if(ev.id && ev.titulo) {
                selEvento.innerHTML += `<option value="${ev.id}">${ev.titulo}</option>`;
            }
        });
    }
    
    const selInst = document.getElementById('relatorio-inst');
    if(selInst) {
        let instituicoes = new Set();
        inscricoes.forEach(ins => { try { instituicoes.add(JSON.parse(ins.dadosJson).NomeInstituicao); } catch(e){} });
        selInst.innerHTML = '<option value="">Todas as Instituições</option>';
        Array.from(instituicoes).sort().forEach(inst => { if(inst) selInst.innerHTML += `<option value="${inst}">${inst}</option>`; });
    }
}

// --- RELATÓRIO PDF ---
function gerarRelatorioTransporte() {
    showLoading('Carregando dados do sistema...');

    fetch(`${URL_API}?action=getPublicConfig`)
    .then(r => r.json())
    .then(jsonConfig => {
        Swal.close();
        
        const configSistema = jsonConfig.config || {};
        
        const eventoId = document.getElementById('relatorio-evento').value;
        const instFiltro = document.getElementById('relatorio-inst').value;
        
        const alunosFiltrados = dashboardData.filter(i => {
            let d = {}; try { d = JSON.parse(i.dadosJson); } catch (e) {}
            return (eventoId === "" || String(i.eventoId) === String(eventoId)) &&
                   (instFiltro === "" || d.NomeInstituicao === instFiltro) &&
                   (i.status === 'Aprovada' || i.status === 'Ficha Emitida');
        });

        if (alunosFiltrados.length === 0) {
            return Swal.fire({ icon: 'info', title: 'Sem dados', text: 'Nenhum aluno APROVADO encontrado com esses filtros.' });
        }

        const todasChaves = new Set();
        const chavesPrioritarias = ['NomeCompleto', 'NomeInstituicao', 'NomeCurso', 'PeriodoCurso', 'Telefone', 'Cidade', 'Estado'];
        const ignorar = ['linkFoto', 'linkDoc', 'Assinatura', 'CPF', 'Email'];

        alunosFiltrados.forEach(aluno => {
            try {
                const dados = JSON.parse(aluno.dadosJson);
                Object.keys(dados).forEach(k => {
                    if (!ignorar.includes(k)) todasChaves.add(k);
                });
            } catch (e) {}
        });

        const listaChaves = Array.from(todasChaves).sort((a, b) => {
            const idxA = chavesPrioritarias.indexOf(a);
            const idxB = chavesPrioritarias.indexOf(b);
            if (idxA !== -1 && idxB !== -1) return idxA - idxB;
            if (idxA !== -1) return -1;
            if (idxB !== -1) return 1;
            return a.localeCompare(b);
        });

        let htmlChecks = `<div class="checkbox-grid" style="max-height:300px; overflow-y:auto; padding:5px;">`;
        listaChaves.forEach(chave => {
            const label = LABELS_TODOS_CAMPOS[chave] || chave;
            const checked = chavesPrioritarias.includes(chave) ? 'checked' : '';
            htmlChecks += `
                <label class="checkbox-card">
                    <input type="checkbox" class="col-check" value="${chave}" ${checked}> ${label}
                </label>`;
        });
        htmlChecks += `</div>`;

        Swal.fire({
            title: 'Personalizar Relatório',
            html: `<p style="font-size:0.9rem; color:#64748b; margin-bottom:15px;">Selecione as colunas para o PDF:</p>${htmlChecks}`,
            width: '700px',
            showCancelButton: true,
            confirmButtonText: 'Gerar PDF',
            confirmButtonColor: '#2563eb',
            preConfirm: () => {
                const selecionados = [];
                document.querySelectorAll('.col-check:checked').forEach(c => selecionados.push(c.value));
                if (selecionados.length === 0) Swal.showValidationMessage('Selecione pelo menos uma coluna.');
                return selecionados;
            }
        }).then((res) => {
            if (res.isConfirmed) {
                construirRelatorioFinal(alunosFiltrados, res.value, eventoId, configSistema);
            }
        });

    }).catch(err => {
        Swal.fire('Erro', 'Não foi possível carregar as configurações do relatório.', 'error');
    });
}

function construirRelatorioFinal(alunos, colunasKeys, eventoId, configSistema) {
    showLoading('Preparando Impressão...');

    const tituloEvento = eventoId ? (mapaEventos[eventoId] || 'Evento') : "Relatório Geral";
    const dataHoraHoje = new Date().toLocaleString('pt-BR');

    const grupos = {};
    alunos.forEach(aluno => {
        let d = {}; try { d = JSON.parse(aluno.dadosJson); } catch(e){}
        const inst = d.NomeInstituicao ? d.NomeInstituicao.trim() : 'Outros / Sem Instituição';
        if (!grupos[inst]) grupos[inst] = [];
        grupos[inst].push(d);
    });

    if (!colunasKeys.includes('Assinatura')) colunasKeys.push('Assinatura');

    const logoUrl = configSistema.urlLogo ? formatarUrlDrive(configSistema.urlLogo) : URL_LOGO;
    const nomeSistema = configSistema.nomeSistema || 'Sistema de Transporte';
    const nomeSecretaria = configSistema.nomeSecretaria || 'Secretaria de Educação';

    let htmlContent = `
        <style>
            @page { size: landscape; margin: 10mm; }
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; font-family: sans-serif; }
            .report-container { width: 100%; }
            .report-header { display: flex; align-items: center; border-bottom: 2px solid #000; padding-bottom: 15px; margin-bottom: 20px; }
            .header-logo { width: 80px; height: 80px; object-fit: contain; margin-right: 20px; }
            .header-info { flex: 1; }
            .header-info h1 { margin: 0; font-size: 18px; text-transform: uppercase; }
            .header-info h2 { margin: 5px 0 0; font-size: 14px; font-weight: normal; }
            .header-meta { text-align: right; font-size: 11px; }
            
            .group-header { background-color: #e5e7eb; border: 1px solid #000; border-bottom: none; padding: 5px 10px; font-weight: bold; font-size: 12px; margin-top: 15px; }
            .report-table { width: 100%; border-collapse: collapse; font-size: 11px; }
            .report-table th, .report-table td { border: 1px solid #000; padding: 4px 6px; text-align: left; }
            .report-table th { background-color: #f3f4f6; text-transform: uppercase; }
            
            .report-footer { margin-top: 30px; display: flex; justify-content: space-around; page-break-inside: avoid; }
            .sign-box { text-align: center; width: 40%; }
            .sign-line { border-top: 1px solid #000; margin-top: 40px; padding-top: 5px; font-size: 11px; font-weight: bold; }
            .page-footer { text-align: right; font-size: 10px; margin-top: 20px; border-top: 1px solid #ccc; padding-top: 5px; color: #555; }
        </style>

        <div class="report-container">
            <div class="report-header">
                <img src="${logoUrl}" class="header-logo" onerror="this.style.display='none'">
                <div class="header-info">
                    <h1>${nomeSistema}</h1>
                    <h2>${nomeSecretaria}</h2>
                    <div style="margin-top: 5px; font-weight: bold;">${tituloEvento}</div>
                </div>
                <div class="header-meta">
                    <strong>Total de Alunos:</strong> ${alunos.length}<br>
                    <strong>Lista Oficial</strong>
                </div>
            </div>
    `;

    let thead = `<tr><th style="width:30px; text-align:center;">#</th>`;
    colunasKeys.forEach(k => {
        const label = k === 'Assinatura' ? 'Assinatura' : (LABELS_TODOS_CAMPOS[k] || k);
        const widthStyle = k === 'Assinatura' ? 'width: 150px;' : '';
        thead += `<th style="${widthStyle}">${label}</th>`;
    });
    thead += `</tr>`;

    const nomesInstituicoes = Object.keys(grupos).sort(); 

    nomesInstituicoes.forEach(instNome => {
        const listaAlunos = grupos[instNome];
        listaAlunos.sort((a,b) => (a['NomeCompleto']||'').localeCompare(b['NomeCompleto']||''));

        htmlContent += `
            <div class="group-header">
                INSTITUIÇÃO: ${instNome.toUpperCase()} (${listaAlunos.length} ALUNOS)
            </div>
            <table class="report-table">
                <thead>${thead}</thead>
                <tbody>
        `;

        listaAlunos.forEach((dados, idx) => {
            htmlContent += `<tr><td style="text-align:center;">${idx + 1}</td>`;
            colunasKeys.forEach(key => {
                if (key === 'Assinatura') {
                    htmlContent += `<td></td>`;
                } else {
                    htmlContent += `<td>${dados[key] !== undefined ? dados[key] : '-'}</td>`;
                }
            });
            htmlContent += `</tr>`;
        });

        htmlContent += `</tbody></table>`;
    });

    htmlContent += `
            <div class="report-footer">
                <div class="sign-box"><div class="sign-line">Responsável pelo Transporte</div></div>
                <div class="sign-box"><div class="sign-line">${nomeSecretaria}</div></div>
            </div>
            
            <div class="page-footer">
                Relatório gerado em: ${dataHoraHoje}
            </div>
        </div>
    `;

    let printLayer = document.getElementById('print-layer');
    if (!printLayer) {
        printLayer = document.createElement('div');
        printLayer.id = 'print-layer';
        document.body.appendChild(printLayer);
    }
    
    printLayer.innerHTML = htmlContent;
    Swal.close();
    
    setTimeout(() => window.print(), 500);
}

// --- EVENTOS ---
function carregarEventosAdmin() {
    fetch(`${URL_API}?action=getTodosEventos`).then(res => res.json()).then(json => {
        const tbody = document.getElementById('lista-eventos-admin'); 
        tbody.innerHTML = '';
        mapaEventos = {};
        if(!json.data || json.data.length === 0) { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 2rem;">Nenhum evento criado.</td></tr>'; return; }
        
        json.data.forEach(ev => {
            if (ev.id && ev.titulo) {
                mapaEventos[ev.id] = ev.titulo;
                cacheEventos[ev.id] = ev; 
            }
        });
        
        const eventosValidos = json.data.filter(ev => ev.id && ev.titulo);

        eventosValidos.sort((a,b) => b.id - a.id).forEach(ev => {
            let btnAction = ev.status === 'Ativo' ? 
                `<button class="btn-icon" style="background:#eab308;" onclick="toggleStatusEvento('${ev.id}','Inativo')" title="Pausar"><i class="fa-solid fa-pause"></i></button>` : 
                `<button class="btn-icon" style="background:#22c55e;" onclick="toggleStatusEvento('${ev.id}','Ativo')" title="Ativar"><i class="fa-solid fa-play"></i></button>`;
            
            tbody.innerHTML += `
                <tr>
                    <td><strong>#${ev.id}</strong></td>
                    <td><div style="font-weight:600; color:var(--text-main); font-size:0.95rem;">${ev.titulo}</div></td>
                    <td><div style="font-size:0.85rem; color:var(--text-secondary);">${safeDate(ev.inicio)} - ${safeDate(ev.fim)}</div></td>
                    <td><span class="badge ${ev.status === 'Ativo' ? 'success' : 'danger'}">${ev.status}</span></td>
                    <td style="text-align:right;">
                        ${btnAction}
                        <button class="btn-icon bg-edit" onclick='abrirEdicaoEvento(${JSON.stringify(ev)})'><i class="fa-solid fa-pen"></i></button>
                    </td>
                </tr>`;
        });
    });
}

function abrirEdicaoEvento(evento) {
    let config = {}; try { config = JSON.parse(evento.config); } catch(e){}
    const checkFicha = config.exigeFicha ? 'checked' : '';
    const checkCart = config.emiteCarteirinha ? 'checked' : '';
    const cidades = config.cidadesPermitidas ? config.cidadesPermitidas.join(', ') : '';
    const limite = config.limiteInscricoes || '';
    
    // Gerar checkboxes de campos
    let htmlCampos = '<div class="checkbox-grid" style="margin-bottom:15px;">';
    const camposAtivos = config.camposTexto || [];
    
    CAMPOS_PADRAO.forEach(c => {
        const isChecked = camposAtivos.includes(c.key) ? 'checked' : '';
        htmlCampos += `<label class="checkbox-card"><input type="checkbox" class="edit-field-check" value="${c.key}" ${isChecked}> ${c.label}</label>`;
    });
    htmlCampos += '</div>';

    const camposExtras = config.camposPersonalizados || [];
    let htmlExtras = '';
    camposExtras.forEach((campo, index) => {
        htmlExtras += `<div class="extra-field-item" style="display:flex; gap:10px; margin-bottom:5px;">
            <input type="text" class="swal-input-custom extra-input" value="${campo}" readonly>
            <button type="button" class="btn-icon bg-delete" onclick="this.parentElement.remove()" style="width:30px;"><i class="fa-solid fa-trash"></i></button>
        </div>`;
    });

    Swal.fire({
        title: 'Editar Evento',
        width: '900px',
        html: `
            <div class="swal-grid-2">
                <div>
                    <label class="swal-label">Data de Encerramento</label>
                    <input type="date" id="edit_fim" class="swal-input-custom" value="${evento.fim ? evento.fim.split('T')[0] : ''}">
                </div>
                <div>
                    <label class="swal-label">Restrição de Cidades</label>
                    <input type="text" id="edit_cidades" class="swal-input-custom" placeholder="Separe por vírgulas..." value="${cidades}">
                </div>
            </div>
            
            <div class="swal-grid-2">
                <div>
                    <label class="swal-label">Limite de Vagas (Opcional)</label>
                    <input type="number" id="edit_limite" class="swal-input-custom" placeholder="0 para ilimitado" value="${limite}">
                </div>
                <div></div>
            </div>
            
            <div class="swal-full" style="margin-top:10px;">
                <label class="swal-label">Mensagem de Alerta (Topo do Formulário)</label>
                <textarea id="edit_msg" class="swal-input-custom" style="height:60px;">${config.mensagemAlerta || ''}</textarea>
            </div>
            
            <div style="background:#f8fafc; padding:15px; border-radius:8px; border:1px solid #e2e8f0; margin-bottom:15px; margin-top:15px;">
                <label class="swal-label" style="color:var(--primary);">Campos do Formulário</label>
                ${htmlCampos}

                <label class="swal-label" style="color:var(--primary); margin-top:10px; border-top:1px dashed #ccc; padding-top:10px;">Perguntas Personalizadas (Opcional)</label>
                <div style="display:flex; gap:10px; margin-bottom:10px;">
                    <input type="text" id="new-extra-edit" class="swal-input-custom" placeholder="Digite uma nova pergunta (ex: Tamanho da Camiseta)">
                    <button type="button" id="btn-add-extra-edit" class="btn btn-primary" style="width:auto;"><i class="fa-solid fa-plus"></i></button>
                </div>
                <div id="container-extras-edit">${htmlExtras}</div>
            </div>

            <div class="checkbox-grid"><label class="checkbox-card"><input type="checkbox" id="edit_req_ficha" ${checkFicha}> Exigir Ficha Presencial</label><label class="checkbox-card"><input type="checkbox" id="edit_emitir_carteirinha" ${checkCart}> Carteirinha Digital</label></div>
        `,
        showCancelButton: true, confirmButtonText: 'Salvar', confirmButtonColor: '#2563eb',
        didOpen: () => {
            document.getElementById('btn-add-extra-edit').addEventListener('click', () => {
                const val = document.getElementById('new-extra-edit').value;
                if(val) {
                    const div = document.createElement('div');
                    div.className = 'extra-field-item';
                    div.style.cssText = 'display:flex; gap:10px; margin-bottom:5px;';
                    div.innerHTML = `<input type="text" class="swal-input-custom extra-input" value="${val}" readonly><button type="button" class="btn-icon bg-delete" onclick="this.parentElement.remove()" style="width:30px;"><i class="fa-solid fa-trash"></i></button>`;
                    document.getElementById('container-extras-edit').appendChild(div);
                    document.getElementById('new-extra-edit').value = '';
                }
            });
        },
        preConfirm: () => { 
            const cidadesTexto = document.getElementById('edit_cidades').value;
            const cidadesArr = cidadesTexto ? cidadesTexto.split(',').map(s => s.trim()).filter(s => s) : [];
            const extras = [];
            document.querySelectorAll('#container-extras-edit .extra-input').forEach(el => extras.push(el.value));
            
            const camposSelecionados = [];
            document.querySelectorAll('.edit-field-check:checked').forEach(c => camposSelecionados.push(c.value));

            return { 
                fim: document.getElementById('edit_fim').value, 
                msg: document.getElementById('edit_msg').value,
                exigeFicha: document.getElementById('edit_req_ficha').checked,
                emiteCarteirinha: document.getElementById('edit_emitir_carteirinha').checked,
                cidadesPermitidas: cidadesArr,
                camposPersonalizados: extras,
                limiteInscricoes: document.getElementById('edit_limite').value,
                camposTexto: camposSelecionados 
            }; 
        }
    }).then((res) => {
        if(res.isConfirmed) {
            showLoading('Salvando...');
            const payload = { 
                action: 'editarEvento', 
                senha: sessionStorage.getItem('admin_token'), 
                id: evento.id, 
                ...res.value 
            };
            fetch(URL_API, { method: 'POST', body: JSON.stringify(payload) })
            .then(() => { Swal.fire({icon: 'success', title: 'Salvo!'}); carregarEventosAdmin(); }); 
        }
    });
}

function toggleStatusEvento(id, status) {
    showLoading('Atualizando...');
    fetch(URL_API, { method: 'POST', body: JSON.stringify({ action: 'alterarStatusEvento', senha: sessionStorage.getItem('admin_token'), id, novoStatus: status }) })
    .then(() => { Swal.close(); carregarEventosAdmin(); });
}

function modalNovoEvento() {
    let htmlCampos = '<div class="checkbox-grid">';
    CAMPOS_PADRAO.forEach(c => {
        htmlCampos += `<label class="checkbox-card"><input type="checkbox" id="check_${c.key}" value="${c.key}" checked> ${c.label}</label>`;
    });
    htmlCampos += '</div>';

    Swal.fire({
        title: 'Criar Novo Evento', 
        width: '900px',
        html: `
            <div style="background:#eff6ff; color:#1e40af; padding:10px; border-radius:6px; font-size:0.85rem; margin-bottom:15px; border:1px solid #dbeafe;">
                <i class="fa-solid fa-info-circle"></i> <strong>Nota:</strong> CPF e E-mail são campos fixos obrigatórios.
            </div>

            <div class="swal-grid-2">
                <div>
                    <label class="swal-label">Título do Evento</label>
                    <input id="swal-titulo" class="swal-input-custom" placeholder="Ex: Transporte 2025.1">
                </div>
                <div>
                    <label class="swal-label">Descrição Curta</label>
                    <input id="swal-desc" class="swal-input-custom" placeholder="Ex: Período letivo regular">
                </div>
            </div>
            
            <div class="swal-grid-2">
                <div><label class="swal-label">Início das Inscrições</label><input type="date" id="swal-inicio" class="swal-input-custom"></div>
                <div><label class="swal-label">Fim das Inscrições</label><input type="date" id="swal-fim" class="swal-input-custom"></div>
            </div>

            <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin-top: 20px; border: 1px solid #e2e8f0;">
                <h4 style="margin: 0 0 15px 0; color: var(--primary); font-size:0.9rem; text-transform:uppercase;">Configuração do Formulário</h4>
                
                <label class="swal-label">Campos Adicionais do Aluno</label>
                ${htmlCampos}
                
                <div style="margin-top:20px; border-top:1px dashed #cbd5e1; padding-top:15px;">
                    <label class="swal-label" style="color:var(--primary);">Perguntas Personalizadas (Opcional)</label>
                    <div style="display:flex; gap:10px; margin-bottom:10px;">
                        <input type="text" id="new-extra" class="swal-input-custom" placeholder="Digite uma pergunta extra...">
                        <button type="button" id="btn-add-extra" class="btn btn-primary" style="width:auto;"><i class="fa-solid fa-plus"></i></button>
                    </div>
                    <div id="container-extras"></div>
                </div>

                <div class="swal-grid-2" style="margin-top: 15px;">
                    <div>
                        <label class="swal-label">Restrição de Cidades</label>
                        <input type="text" id="swal-cidades" class="swal-input-custom" placeholder="Deixe vazio para todas">
                    </div>
                    <div>
                        <label class="swal-label">Limite de Vagas (Opcional)</label>
                        <input type="number" id="swal-limite" class="swal-input-custom" placeholder="0 para ilimitado">
                    </div>
                </div>
                
                <div class="swal-full" style="margin-top:10px;">
                    <label class="swal-label">Observações (Somente Leitura)</label>
                    <textarea id="txt_obs_admin" class="swal-input-custom" style="height:42px;" placeholder="Instruções para o aluno..."></textarea>
                </div>

                <label class="swal-label" style="margin-top: 15px;">Documentos Obrigatórios</label>
                <div class="checkbox-grid">
                    <label class="checkbox-card"><input type="checkbox" id="req_foto" checked> Foto 3x4</label>
                    <label class="checkbox-card"><input type="checkbox" id="req_doc" checked> Declaração/Comprovante</label>
                </div>

                <div style="margin-top: 20px; padding-top: 15px; border-top: 1px dashed #cbd5e1;">
                     <label class="swal-label">Regras de Negócio</label>
                     <div class="checkbox-grid">
                        <label class="checkbox-card" style="background: #fffbeb; border-color: #f59e0b;">
                            <input type="checkbox" id="req_ficha" checked> 
                            <strong>Exigir Assinatura Presencial</strong>
                        </label>
                        <label class="checkbox-card" style="background: #eff6ff; border-color: #3b82f6;">
                            <input type="checkbox" id="emitir_carteirinha"> 
                            <strong>Emitir Carteirinha Digital</strong>
                        </label>
                     </div>
                </div>
            </div>
        `,
        showCancelButton: true, confirmButtonText: 'Publicar Evento', confirmButtonColor: '#2563eb',
        didOpen: () => {
            document.getElementById('btn-add-extra').addEventListener('click', () => {
                const val = document.getElementById('new-extra').value;
                if(val) {
                    const div = document.createElement('div');
                    div.className = 'extra-field-item';
                    div.style.cssText = 'display:flex; gap:10px; margin-bottom:5px;';
                    div.innerHTML = `<input type="text" class="swal-input-custom extra-input" value="${val}" readonly><button type="button" class="btn-icon bg-delete" onclick="this.parentElement.remove()" style="width:30px;"><i class="fa-solid fa-trash"></i></button>`;
                    document.getElementById('container-extras').appendChild(div);
                    document.getElementById('new-extra').value = '';
                }
            });
        },
        preConfirm: () => {
            const titulo = document.getElementById('swal-titulo').value;
            const inicio = document.getElementById('swal-inicio').value;
            const fim = document.getElementById('swal-fim').value;

            if(!titulo || !inicio || !fim) {
                Swal.showValidationMessage('Preencha Título e Datas.');
                return false;
            }

            // Coletar campos marcados (Removida a obrigatoriedade de 'Cidade' e 'Estado')
            const sels = [];
            CAMPOS_PADRAO.forEach(c => { 
                const el = document.getElementById(`check_${c.key}`);
                if(el && el.checked) sels.push(c.key); 
            });
            
            const extras = [];
            document.querySelectorAll('#container-extras .extra-input').forEach(el => extras.push(el.value));
            
            const cidadesTexto = document.getElementById('swal-cidades').value;
            const cidadesArr = cidadesTexto ? cidadesTexto.split(',').map(s => s.trim()).filter(s => s) : [];

            return {
                titulo: titulo, descricao: document.getElementById('swal-desc').value,
                inicio: inicio, fim: fim,
                config: { 
                    camposTexto: sels, 
                    camposPersonalizados: extras, 
                    observacoesTexto: document.getElementById('txt_obs_admin').value,
                    arquivos: { foto: document.getElementById('req_foto').checked, doc: document.getElementById('req_doc').checked },
                    exigeFicha: document.getElementById('req_ficha').checked,
                    emiteCarteirinha: document.getElementById('emitir_carteirinha').checked,
                    cidadesPermitidas: cidadesArr,
                    limiteInscricoes: document.getElementById('swal-limite').value
                }, 
                status: 'Ativo'
            }
        }
    }).then((res) => {
        if(res.isConfirmed) {
            showLoading('Criando Evento...');
            fetch(URL_API, { method: 'POST', body: JSON.stringify({ action: 'criarEvento', senha: sessionStorage.getItem('admin_token'), dados: res.value }) })
            .then(() => { Swal.fire({icon: 'success', title: 'Evento Criado!'}); carregarEventosAdmin(); });
        }
    });
}

// --- INSCRIÇÕES (Logic) ---
function carregarInscricoes() {
    const tbody = document.getElementById('lista-inscricoes-admin');
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:2rem;">Carregando dados...</td></tr>';
    
    // 1. Carrega Eventos
    fetch(`${URL_API}?action=getTodosEventos`)
    .then(r => r.json())
    .then(jsonEventos => {
        if(jsonEventos.data) {
             jsonEventos.data.forEach(ev => { 
                 if(ev.id && ev.titulo) {
                     mapaEventos[ev.id] = ev.titulo; 
                     cacheEventos[ev.id] = ev; 
                 }
             });
             const select = document.getElementById('filtro-evento');
             if(select && select.options.length <= 1) {
                 Object.keys(mapaEventos).forEach(id => select.innerHTML += `<option value="${id}">${mapaEventos[id]}</option>`);
             }
        }
        // 2. Carrega Inscrições
        return fetch(`${URL_API}?action=getInscricoesAdmin&token=${sessionStorage.getItem('admin_token')}`);
    })
    .then(r => r.json())
    .then(json => {
        todasInscricoes = (json.data || []).sort((a,b) => new Date(b.data) - new Date(a.data));
        resetEFiltrar();
    })
    .catch(() => {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#dc2626;">Erro de comunicação.</td></tr>';
    });
}

function resetEFiltrar() {
    paginaAtual = 1; desmarcarTudo();
    const termo = document.getElementById('filtro-nome').value.toLowerCase();
    const status = document.getElementById('filtro-status').value;
    const eventoId = document.getElementById('filtro-evento').value;
    inscricoesFiltradas = todasInscricoes.filter(i => {
        let d = {}; try { d = JSON.parse(i.dadosJson); } catch(e){}
        const nome = (d.NomeCompleto || "").toLowerCase();
        const cpf = (d.CPF || "").replace(/\D/g, '');
        return (nome.includes(termo) || i.chave.toLowerCase().includes(termo) || cpf.includes(termo)) && 
               (status === "" || i.status === status) && 
               (eventoId === "" || String(i.eventoId) === String(eventoId));
    });
    document.getElementById('lista-inscricoes-admin').innerHTML = '';
    renderizarProximaPagina();
}

function renderizarProximaPagina() {
    const tbody = document.getElementById('lista-inscricoes-admin');
    const lote = inscricoesFiltradas.slice((paginaAtual - 1) * ITENS_POR_PAGINA, paginaAtual * ITENS_POR_PAGINA);
    
    if(paginaAtual === 1 && lote.length === 0) { 
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 2rem; color: #64748b;">Nenhum registro encontrado.</td></tr>'; 
        document.getElementById('btn-load-more').style.display = 'none'; 
        return; 
    }
    
    lote.forEach(ins => {
        let d = {}; try { d = JSON.parse(ins.dadosJson); } catch(e){}
        const checked = selecionados.has(ins.chave) ? 'checked' : '';
        
        let btnFicha = `<button class="btn-icon bg-view" style="background:#6366f1;" onclick="gerarFicha('${ins.chave}')" title="Gerar Ficha"><i class="fa-solid fa-print"></i></button>`;
        
        let btnCartAdm = '';
        const evento = cacheEventos[ins.eventoId];
        if (evento) {
            let config = {}; try { config = JSON.parse(evento.config); } catch(e) {}
            if (config.emiteCarteirinha) {
                btnCartAdm = `<button class="btn-icon bg-view" style="background:#3b82f6;" onclick="imprimirCarteirinhaAdmin('${ins.chave}')" title="Carteirinha"><i class="fa-solid fa-id-card"></i></button>`;
            }
        }
        
        tbody.innerHTML += `<tr>
            <td style="text-align:center;"><input type="checkbox" class="bulk-check" value="${ins.chave}" ${checked} onclick="toggleCheck('${ins.chave}')"></td>
            <td>${safeDate(ins.data)}</td>
            <td>
                <div style="font-weight:600; font-size:0.9rem; color:var(--text-main);">${d.NomeCompleto||'Sem Nome'}</div>
                <div style="display:flex; flex-direction:column; gap:2px;">
                    <small style="color:var(--text-secondary);">${d.CPF||'-'}</small>
                    <small style="color:var(--primary); font-family:monospace; font-weight:600; background:var(--primary-light); padding:2px 6px; border-radius:4px; width:fit-content;">${ins.chave}</small>
                </div>
            </td>
            <td><div class="badge" style="background:#f1f5f9; color:#334155; font-weight:600; font-size:0.85rem; padding: 6px 12px; border: 1px solid #cbd5e1;">${mapaEventos[ins.eventoId]||ins.eventoId}</div></td>
            <td><span class="badge ${ins.status.replace(/\s/g, '')}">${ins.status}</span></td>
            <td style="text-align:right;">
                <div style="display:flex; gap:4px; justify-content:flex-end;">
                    <button class="btn-icon bg-edit" style="background:#f59e0b;" onclick="abrirEdicaoInscricao('${ins.chave}')" title="Detalhes"><i class="fa-solid fa-pen-to-square"></i></button>
                    ${btnCartAdm}
                    ${btnFicha}
                    ${ins.doc ? `<a href="${ins.doc}" target="_blank" class="btn-icon bg-view" title="Ver Documento"><i class="fa-solid fa-paperclip"></i></a>` : ''}
                </div>
            </td>
        </tr>`;
    });
    paginaAtual++;
    document.getElementById('btn-load-more').style.display = (paginaAtual * ITENS_POR_PAGINA < inscricoesFiltradas.length + ITENS_POR_PAGINA) ? 'block' : 'none';
}

// --- EDIÇÃO DE INSCRIÇÃO (MODAL PREMIUM REVISADO) ---
function abrirEdicaoInscricao(chave) {
    const inscricao = todasInscricoes.find(i => i.chave === chave);
    if (!inscricao) return;
    
    let dados = {}; try { dados = JSON.parse(inscricao.dadosJson); } catch(e) {}
    let evento = cacheEventos[inscricao.eventoId] || {};
    let configEvento = {}; try { configEvento = JSON.parse(evento.config || '{}'); } catch(e) {}

    // Tratamento de imagem para o modal (Sidebar Esquerda)
    let fotoUrl = 'https://via.placeholder.com/150?text=Sem+Foto';
    if(dados.linkFoto) {
        fotoUrl = formatarUrlDrive(dados.linkFoto);
        if(!fotoUrl) fotoUrl = 'https://via.placeholder.com/150?text=Sem+Foto';
    }

    // Tratamento de Documento (Sidebar Esquerda - Card Melhorado)
    let htmlDocCard = '';
    if (inscricao.doc) {
        htmlDocCard = `
            <div style="background: white; border: 1px solid #e2e8f0; padding: 15px; border-radius: 8px; margin-top: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
                <div style="display:flex; align-items:center; gap:10px; margin-bottom:10px; text-align: left;">
                    <i class="fa-solid fa-file-contract" style="color:#f59e0b; font-size:1.5rem;"></i>
                    <div style="text-align:left;">
                        <span style="display:block; font-weight:700; color:#1e293b; font-size:0.9rem;">Documento Anexado</span>
                        <span style="display:block; font-size:0.75rem; color:#64748b;">Comprovante de Matrícula</span>
                    </div>
                </div>
                <a href="${inscricao.doc}" target="_blank" class="btn btn-primary" style="width:100%; justify-content:center; text-decoration:none; padding: 10px; border-radius: 6px; display: inline-flex; align-items: center; gap: 8px; font-size: 0.9rem; font-weight: 500;">
                    <i class="fa-solid fa-eye"></i> Visualizar Arquivo
                </a>
            </div>
        `;
    }

    // Construção dos Campos em 2 Colunas usando classes swal-grid-2
    let htmlCamposEsquerda = ''; // Dados Pessoais
    let htmlCamposDireita = '';  // Dados Acadêmicos

    const ignorar = ['linkFoto', 'linkDoc'];
    const camposAcad = ['NomeInstituicao', 'NomeCurso', 'PeriodoCurso', 'Matricula', 'Turno'];

    for (const [key, val] of Object.entries(dados)) {
        if (!ignorar.includes(key)) {
            const label = LABELS_TODOS_CAMPOS[key] || key;
            const inputHtml = `<div style="margin-bottom:10px;"><label class="swal-label">${label}</label><input type="text" id="edit_aluno_${key}" value="${val}" class="swal-input-custom"></div>`;
            
            if (camposAcad.includes(key) || key.startsWith('Inst') || key.includes('Curso')) {
                htmlCamposDireita += inputHtml;
            } else {
                htmlCamposEsquerda += inputHtml;
            }
        }
    }

    // Área de Uploads Condicional (Substituição)
    let htmlUploads = '';
    const pedeFoto = configEvento.arquivos && configEvento.arquivos.foto;
    const pedeDoc = configEvento.arquivos && configEvento.arquivos.doc;

    if (pedeFoto || pedeDoc) {
        htmlUploads = `<div style="margin-top:25px; border-top:1px dashed #e2e8f0; padding-top:15px;">
            <label class="swal-label" style="color:#f59e0b; margin-bottom:10px;"> SUBSTITUIR ARQUIVOS (Opcional)</label>
            <div class="swal-grid-2">`;
        
        if (pedeFoto) htmlUploads += `
            <div style="background:#f8fafc; padding:10px; border-radius:8px; border:1px solid #e2e8f0;">
                <label class="swal-label" style="font-size:0.75rem;"><i class="fa-solid fa-camera"></i> Nova Foto 3x4</label>
                <input type="file" id="edit_upload_foto" accept="image/*" class="swal-input-custom" style="font-size:0.8rem;">
            </div>`;
        
        if (pedeDoc) htmlUploads += `
            <div style="background:#f8fafc; padding:10px; border-radius:8px; border:1px solid #e2e8f0;">
                <label class="swal-label" style="font-size:0.75rem;"><i class="fa-solid fa-file-arrow-up"></i> Nova Documento</label>
                <input type="file" id="edit_upload_doc" accept="application/pdf" class="swal-input-custom" style="font-size:0.8rem;">
            </div>`;
        
        htmlUploads += `</div></div>`;
    }

    Swal.fire({
        width: '1100px', // Modal Extra Largo para o Grid funcionar bem
        title: '', 
        html: `
            <div class="grid-sidebar">
                <!-- COLUNA LATERAL (FOTO + STATUS + DOC) -->
                <div style="background: #f8fafc; padding: 25px; border-radius: 12px; text-align: center; border: 1px solid #e2e8f0; height: 100%;">
                    
                    <!-- Foto em Destaque -->
                    <div style="width: 160px; height: 160px; margin: 0 auto 15px; position: relative;">
                        <img src="${fotoUrl}" style="width: 100%; height: 100%; border-radius: 12px; object-fit: cover; border: 4px solid white; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
                    </div>

                    <h3 style="font-size: 1.2rem; margin: 0; color: var(--primary); font-weight:700;">${dados.NomeCompleto || 'Estudante'}</h3>
                    <p style="color: #64748b; font-size: 0.9rem; margin-bottom: 10px; font-family: monospace;">${dados.CPF || ''}</p>
                    <div style="background: #e2e8f0; color: #475569; padding: 5px 10px; border-radius: 4px; font-family: monospace; font-weight: bold; margin-bottom: 25px; display: inline-block;">
                        <i class="fa-solid fa-key"></i> ${inscricao.chave}
                    </div>
                    
                    <div style="text-align: left; margin-bottom: 20px;">
                        <label class="swal-label">Status Atual</label>
                        <select id="novo_status_modal" class="swal-input-custom" style="font-weight:600; color: #1e293b; border: 2px solid #cbd5e1;">
                            <option value="Pendente" ${inscricao.status === 'Pendente' ? 'selected' : ''}>🟡 Pendente</option>
                            <option value="Aprovada" ${inscricao.status === 'Aprovada' ? 'selected' : ''}>🟢 Aprovada</option>
                            <option value="Rejeitada" ${inscricao.status === 'Rejeitada' ? 'selected' : ''}>🔴 Rejeitada</option>
                            <option value="Ficha Emitida" ${inscricao.status === 'Ficha Emitida' ? 'selected' : ''}>🔵 Ficha Emitida</option>
                        </select>
                    </div>

                    <!-- Cartão de Documento (se existir) -->
                    ${htmlDocCard}
                </div>

                <!-- COLUNA PRINCIPAL (EDIÇÃO DE CAMPOS) -->
                <div style="padding-right: 10px;">
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 20px; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px;">
                        <i class="fa-solid fa-user-pen" style="color: var(--primary); font-size: 1.2rem;"></i>
                        <h3 style="margin: 0; color: var(--text-main); font-size:1.1rem; font-weight: 700;">Editar Informações</h3>
                    </div>
                    
                    <!-- WRAPPER COM SCROLLBAR DEDICADA -->
                    <div style="max-height: 60vh; overflow-y: auto; padding-right: 10px;">
                        <div class="swal-grid-2" style="align-items: start; margin-bottom:0;">
                            <div>
                                <label class="swal-label" style="color: var(--primary); border-bottom: 1px solid #e2e8f0; padding-bottom: 5px; margin-bottom: 10px;"><i class="fa-regular fa-id-card"></i> Dados Pessoais</label>
                                ${htmlCamposEsquerda}
                            </div>
                            <div>
                                <label class="swal-label" style="color: var(--primary); border-bottom: 1px solid #e2e8f0; padding-bottom: 5px; margin-bottom: 10px;"><i class="fa-solid fa-graduation-cap"></i> Dados Acadêmicos</label>
                                ${htmlCamposDireita}
                            </div>
                        </div>

                        ${htmlUploads}
                    </div>
                </div>
            </div>
        `,
        showCancelButton: true, confirmButtonText: 'Salvar Alterações', confirmButtonColor: '#2563eb',
        preConfirm: async () => {
            const novosDados = {};
            for (const key of Object.keys(dados)) { 
                if (!ignorar.includes(key)) { 
                    const el = document.getElementById(`edit_aluno_${key}`); 
                    if (el) novosDados[key] = el.value; 
                } 
            }
            
            const novoStatus = document.getElementById('novo_status_modal').value;
            
            // Coleta Arquivos
            const arqs = {};
            const inputFoto = document.getElementById('edit_upload_foto');
            const inputDoc = document.getElementById('edit_upload_doc');

            if (inputFoto && inputFoto.files.length > 0) {
                const f = inputFoto.files[0];
                arqs.foto = { data: await toBase64(f), mime: 'image/jpeg' };
            }
            if (inputDoc && inputDoc.files.length > 0) {
                const f = inputDoc.files[0];
                arqs.doc = { data: await toBase64(f), mime: 'application/pdf' };
            }

            return { novosDados, status: novoStatus, arquivos: Object.keys(arqs).length > 0 ? arqs : null };
        }
    }).then((result) => {
        if (result.isConfirmed) {
            showLoading('Salvando...');
            
            const promiseStatus = (result.value.status !== inscricao.status) ? 
                fetch(URL_API, { method: 'POST', body: JSON.stringify({ action: 'atualizarStatus', senha: sessionStorage.getItem('admin_token'), chave: chave, novoStatus: result.value.status }) }) : 
                Promise.resolve();

            promiseStatus.then(() => {
                return fetch(URL_API, { 
                    method: 'POST', 
                    body: JSON.stringify({ 
                        action: 'editarInscricao', 
                        senha: sessionStorage.getItem('admin_token'), 
                        chave: chave, 
                        novosDados: result.value.novosDados,
                        arquivos: result.value.arquivos 
                    }) 
                });
            }).then(() => {
                Swal.fire({icon: 'success', title: 'Dados Atualizados!', timer: 1500, showConfirmButton: false});
                carregarInscricoes(); // Força reload completo
            });
        }
    });
}

// --- FUNÇÕES AUXILIARES ---
function toggleCheck(k) { if(selecionados.has(k)) selecionados.delete(k); else selecionados.add(k); atualizarBarraBulk(); }
function toggleAllChecks() { const m = document.getElementById('check-all').checked; document.querySelectorAll('.bulk-check').forEach(c => { c.checked = m; if(m) selecionados.add(c.value); else selecionados.delete(c.value); }); atualizarBarraBulk(); }
function atualizarBarraBulk() { const b = document.getElementById('bulk-bar'); document.getElementById('bulk-count').innerText = selecionados.size; if(selecionados.size > 0) b.classList.remove('hidden'); else b.classList.add('hidden'); }
function desmarcarTudo() { selecionados.clear(); document.getElementById('check-all').checked = false; document.querySelectorAll('.bulk-check').forEach(c => c.checked = false); atualizarBarraBulk(); }

function acaoEmMassa(s) {
    Swal.fire({title: `Marcar ${selecionados.size} como ${s}?`, icon: 'warning', showCancelButton: true}).then((r) => {
        if(r.isConfirmed) {
            showLoading('Processando...');
            fetch(URL_API, { method: 'POST', body: JSON.stringify({ action: 'atualizarStatusEmMassa', senha: sessionStorage.getItem('admin_token'), chaves: Array.from(selecionados), novoStatus: s }) }).then(() => { Swal.fire({icon: 'success', title: 'Atualizado!'}); todasInscricoes.forEach(i => { if(selecionados.has(i.chave)) i.status = s; }); resetEFiltrar(); });
        }
    });
}

// --- GERAR FICHA DE INSCRIÇÃO (DINÂMICA E REVISADA) ---
function gerarFicha(chave) {
    showLoading('Gerando Ficha...');

    const inscricao = todasInscricoes.find(i => i.chave === chave);
    if (!inscricao) return Swal.fire('Erro', 'Inscrição não encontrada na memória.', 'error');

    let dados = {};
    try { dados = JSON.parse(inscricao.dadosJson); } catch(e) {}

    let evento = cacheEventos[inscricao.eventoId] || { titulo: 'Documento Oficial' };

    // Buscar configurações visuais atualizadas para o cabeçalho
    fetch(`${URL_API}?action=getPublicConfig`)
    .then(r => r.json())
    .then(jsonConfig => {
        const configSistema = jsonConfig.config || {};
        
        // Dados visuais do sistema (com fallback)
        const logoUrl = configSistema.urlLogo ? formatarUrlDrive(configSistema.urlLogo) : URL_LOGO;
        const nomeSistema = configSistema.nomeSistema || 'Sistema de Transporte';
        const nomeSecretaria = configSistema.nomeSecretaria || 'Secretaria de Educação';

        // Foto do Aluno
        let fotoUrl = '';
        if(dados.linkFoto) {
            fotoUrl = formatarUrlDrive(dados.linkFoto);
        }
        const imgTag = fotoUrl 
            ? `<div class="ficha-photo-box" style="border:none;"><img src="${fotoUrl}" style="width:100px; height:130px; object-fit:cover; border:1px solid #000;"></div>`
            : `<div class="ficha-photo-box">SEM FOTO</div>`;

        // Definição de Grupos para Organização Lógica
        // A lógica aqui é: Se o campo existe no JSON da inscrição, ele é mostrado.
        // Se foi removido do formulário, não estará no JSON e não aparecerá na ficha.
        const ordemPessoais = ['NomeCompleto', 'CPF', 'DataNascimento', 'Telefone', 'Email', 'Endereco', 'Cidade', 'Estado'];
        const ordemAcademicos = ['NomeInstituicao', 'NomeCurso', 'PeriodoCurso', 'Matricula', 'Turno'];
        
        let htmlPessoais = '';
        let htmlAcademicos = '';
        let htmlOutros = '';

        const camposExibidos = new Set();

        // 1. Processar Pessoais
        ordemPessoais.forEach(key => {
            if (dados[key]) { // Só mostra se tiver valor preenchido
                const label = LABELS_TODOS_CAMPOS[key] || key;
                let val = dados[key];
                // Formatação simples de data
                if(key === 'DataNascimento' && val.includes('-') && val.length === 10) {
                    const parts = val.split('-');
                    if(parts.length === 3) val = `${parts[2]}/${parts[1]}/${parts[0]}`;
                }
                htmlPessoais += `<div class="ficha-row"><span class="ficha-label">${label}:</span> <span class="ficha-value">${val}</span></div>`;
                camposExibidos.add(key);
            }
        });

        // 2. Processar Acadêmicos
        ordemAcademicos.forEach(key => {
            if (dados[key]) {
                const label = LABELS_TODOS_CAMPOS[key] || key;
                htmlAcademicos += `<div class="ficha-row"><span class="ficha-label">${label}:</span> <span class="ficha-value">${dados[key]}</span></div>`;
                camposExibidos.add(key);
            }
        });

        // 3. Processar Outros (Campos extras ou personalizados)
        const ignorar = ['linkFoto', 'linkDoc', 'Assinatura', 'Observacoes'];
        for (const [key, val] of Object.entries(dados)) {
            if (!ignorar.includes(key) && !camposExibidos.has(key)) {
                htmlOutros += `<div class="ficha-row"><span class="ficha-label">${key}:</span> <span class="ficha-value">${val}</span></div>`;
            }
        }

        // Montagem das Seções HTML (Só adiciona o cabeçalho da seção se houver conteúdo)
        let sectionsHtml = '';
        
        if (htmlPessoais) {
            sectionsHtml += `
                <div class="ficha-section">
                    <div class="ficha-section-header">DADOS PESSOAIS</div>
                    <div class="ficha-section-body">${htmlPessoais}</div>
                </div>`;
        }
        
        if (htmlAcademicos) {
            sectionsHtml += `
                <div class="ficha-section">
                    <div class="ficha-section-header">DADOS ACADÊMICOS</div>
                    <div class="ficha-section-body">${htmlAcademicos}</div>
                </div>`;
        }
        
        if (htmlOutros) {
            sectionsHtml += `
                <div class="ficha-section">
                    <div class="ficha-section-header">OUTRAS INFORMAÇÕES</div>
                    <div class="ficha-section-body">${htmlOutros}</div>
                </div>`;
        }

        const htmlFicha = `
            <div class="ficha-container">
                <div class="ficha-header">
                    <img src="${logoUrl}" alt="Logo" class="ficha-logo" onerror="this.style.opacity='0'">
                    <div class="ficha-title">FICHA DE INSCRIÇÃO</div>
                    <div class="ficha-subtitle">${nomeSistema} - ${nomeSecretaria}</div>
                    <div class="ficha-event-title">${evento.titulo}</div>
                    <div class="ficha-key-box">CHAVE: ${chave}</div>
                </div>

                <!-- Layout Flex para Foto + Dados Principais -->
                <div style="display:flex; gap:20px; align-items:flex-start;">
                    <div style="flex:1;">
                        ${sectionsHtml}
                    </div>
                    ${fotoUrl ? `<div style="width:120px; flex-shrink:0; text-align:center; padding-top:10px;">${imgTag}<div style="font-size:10px; margin-top:5px; color:#666;">FOTO 3x4</div></div>` : ''}
                </div>

                <div class="ficha-sign-area">
                    <div class="ficha-sign-line"></div>
                    <div style="font-weight:bold; font-size:12px;">ASSINATURA DO ALUNO(A) OU RESPONSÁVEL</div>
                    <div style="font-size:11px; margin-top:3px;">${dados.NomeCompleto || ''}</div>
                    <div style="font-size:10px; margin-top:2px; color:#666;">CPF: ${dados.CPF || ''}</div>
                </div>

                <div class="ficha-footer">
                    Documento gerado em ${new Date().toLocaleString('pt-BR')} • ${nomeSecretaria}
                </div>
            </div>
            
            <!-- Estilo Específico para Impressão da Ficha (Força Retrato e Ajusta Layout) -->
            <style>
                .ficha-event-title { font-weight:bold; margin-top:5px; font-size:14px; text-transform:uppercase; }
                @media print {
                    @page { size: portrait; margin: 10mm; } /* Garante retrato para ficha individual */
                    body { -webkit-print-color-adjust: exact; }
                }
            </style>
        `;

        const pl = document.getElementById('print-layer') || document.createElement('div');
        pl.id = 'print-layer';
        if(!pl.parentElement) document.body.appendChild(pl);
        pl.innerHTML = htmlFicha;
        
        const imgEl = pl.querySelector('.ficha-photo-box img');
        const finalizeAndPrint = () => {
            Swal.close(); 
            if(inscricao.status === 'Pendente') {
                fetch(URL_API, { method: 'POST', body: JSON.stringify({ action: 'atualizarStatus', senha: sessionStorage.getItem('admin_token'), chave: chave, novoStatus: 'Ficha Emitida' }) });
                inscricao.status = 'Ficha Emitida'; 
            }
            setTimeout(() => window.print(), 100);
        };

        if (imgEl) {
            if (imgEl.complete) { finalizeAndPrint(); } 
            else {
                if(Swal.isVisible()) Swal.update({ title: 'Carregando foto...' });
                imgEl.onload = finalizeAndPrint;
                imgEl.onerror = finalizeAndPrint; 
            }
        } else {
            finalizeAndPrint();
        }

    }).catch(err => {
        console.error(err);
        Swal.fire('Erro', 'Falha ao gerar ficha.', 'error');
    });
}

// --- IMPRIMIR CARTEIRINHA ADMIN (NOVA VERSÃO - MODAL 3D & QR CODE) ---
function imprimirCarteirinhaAdmin(chave) {
    showLoading('Gerando Carteirinha...');
    
    // Busca dados detalhados + configurações em paralelo
    Promise.all([
        fetch(`${URL_API}?action=consultarInscricao&chave=${chave}`).then(r => r.json()),
        fetch(`${URL_API}?action=getPublicConfig`).then(r => r.json())
    ]).then(([jsonDados, jsonConfig]) => {
        Swal.close();
        
        if(jsonDados.status !== 'success') return Swal.fire('Erro', 'Dados do aluno não encontrados.', 'error');
        
        const aluno = jsonDados.data.aluno;
        const config = jsonConfig.config || {};
        
        // 1. Preenche Frente
        document.getElementById('cart-admin-nome').innerText = aluno.nome || 'Aluno';
        document.getElementById('cart-admin-inst').innerText = aluno.instituicao || '-';
        document.getElementById('cart-admin-course').innerText = aluno.curso || 'Curso não informado';
        document.getElementById('cart-admin-cpf').innerText = aluno.cpf || '---';
        document.getElementById('cart-admin-mat').innerText = aluno.matricula || '---';
        
        // Código Único na Frente (Visível na impressão)
        document.getElementById('cart-admin-auth-code').innerText = aluno.chave || chave;

        // Formata Nascimento
        let nasc = aluno.nascimento || '--/--/----';
        if(nasc.includes('-')) { const p = nasc.split('-'); nasc = `${p[2]}/${p[1]}/${p[0]}`; }
        document.getElementById('cart-admin-nasc').innerText = nasc;

        // Foto
        const img = document.getElementById('cart-admin-img');
        img.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxIiBoZWlnaHQ9IjEiPjxyZWN0IHdpZHRoPSIxIiBoZWlnaHQ9IjEiIGZpbGw9IiNlMmU4ZjAiLz48L3N2Zz4=';
        if (aluno.foto) {
             if (aluno.foto.startsWith('data:image') || aluno.foto.startsWith('http')) {
                  img.src = formatarUrlDrive(aluno.foto);
             }
        }
        img.onerror = function() { this.src = 'https://via.placeholder.com/150?text=FOTO'; };

        // 2. Preenche Verso & Estilo
        if(config.nomeSistema) document.getElementById('cart-admin-sys-name').innerText = config.nomeSistema.toUpperCase();
        
        const secName = config.nomeSecretario || "Secretário";
        const deptName = config.nomeSecretaria || "Secretaria de Educação";
        
        document.getElementById('cart-admin-sec-name').innerText = secName;
        // Atualiza legenda da secretaria
        const orgInfoSmall = document.querySelector('#cart-admin-sys-name + small');
        if(orgInfoSmall) orgInfoSmall.innerText = deptName;
        
        // Logo
        if(config.urlLogo) {
            document.getElementById('cart-admin-logo').src = formatarUrlDrive(config.urlLogo);
        }

        // Cor Dinâmica
        if(config.corCarteirinha) {
            document.documentElement.style.setProperty('--card-color', config.corCarteirinha);
        }

        // Validade
        document.getElementById('cart-admin-validade-ano').innerText = aluno.ano_vigencia || new Date().getFullYear();
        
        // ASSINATURA DIGITAL (INJEÇÃO)
        const assinaturaBox = document.getElementById('cart-admin-assinatura-box');
        if (assinaturaBox) {
            if (config.urlAssinatura && config.urlAssinatura.trim() !== "") {
                const assinaturaUrl = formatarUrlDrive(config.urlAssinatura);
                assinaturaBox.innerHTML = `<img src="${assinaturaUrl}" alt="Assinatura">`;
            } else {
                assinaturaBox.innerHTML = ''; // Limpa se não houver
            }
        }

        // Geração do QR Code usando QRious (Client-side)
        const linkValidacao = `${URL_API}?action=validar&chave=${chave}`;
        const qr = new QRious({
          element: document.getElementById('cart-admin-qr-img'), 
          value: linkValidacao,
          size: 150,
          backgroundAlpha: 0,
          foreground: 'black'
        });
        // Atualiza a imagem com o DataURL gerado pelo canvas do QRious
        document.getElementById('cart-admin-qr-img').src = qr.toDataURL();

        // Exibe o Modal
        document.getElementById('modal-carteirinha-admin').classList.remove('hidden');
        document.getElementById('cart-admin-flip-container').classList.remove('is-flipped'); // Reseta posição
        
    }).catch(err => {
        Swal.close();
        console.error(err);
        Swal.fire('Erro', 'Falha ao gerar carteirinha.', 'error');
    });
}

function carregarInstituicoes() { fetch(`${URL_API}?action=getInstituicoes`).then(r => r.json()).then(json => { const d = document.getElementById('lista-instituicoes'); d.innerHTML = ''; if(json.data) json.data.forEach(n => d.innerHTML += `<div style="padding:10px; border-bottom:1px solid #eee; display:flex; justify-content:space-between; align-items:center;"><span>${n}</span> <button onclick="removerInst('${n}')" class="btn-icon bg-delete" style="width:24px; height:24px;"><i class="fa-solid fa-times"></i></button></div>`); }); }
function addInstituicao() { const n = document.getElementById('nova-inst').value; if(n) fetch(URL_API, { method: 'POST', body: JSON.stringify({ action: 'adicionarInstituicao', nome: n, senha: sessionStorage.getItem('admin_token') }) }).then(() => { document.getElementById('nova-inst').value = ''; carregarInstituicoes(); }); }
function removerInst(n) { fetch(URL_API, { method: 'POST', body: JSON.stringify({ action: 'removerInstituicao', nome: n, senha: sessionStorage.getItem('admin_token') }) }).then(() => carregarInstituicoes()); }

// --- HELPERS ---
function formatarUrlDrive(url) {
    if (!url) return '';
    if (url.startsWith('data:')) return url;
    let id = '';
    const parts = url.split(/\/d\/|id=/);
    if (parts.length > 1) id = parts[1].split(/\/|&/)[0];
    if (id) return `https://lh3.googleusercontent.com/d/${id}`;
    return url; 
}

const toBase64 = f => new Promise((r, j) => { const rd = new FileReader(); rd.readAsDataURL(f); rd.onload = () => r(rd.result.split(',')[1]); rd.onerror = e => j(e); });
