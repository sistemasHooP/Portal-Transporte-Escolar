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

// Chaves de Cache para Performance
const CACHE_KEY_EVENTS = 'admin_events_data';
const CACHE_KEY_INSCR = 'admin_inscr_data';

// Estado da Aplicação
let mapaEventos = {}; 
let cacheEventos = {}; 
let chartEventosInstance = null; 
let chartStatusInstance = null;
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
        showConfirmButton: false, 
        allowOutsideClick: false, 
        width: '300px', 
        background: '#fff'
    });
}

function safeDate(val) {
    if(!val) return '-';
    try { 
        const d = new Date(val); 
        return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('pt-BR'); 
    } catch(e) { 
        return '-'; 
    }
}

// Helper para converter data DD/MM/YYYY ou ISO para YYYY-MM-DD (Formato do Input Date)
function formatarDataParaInput(dataStr) {
    if (!dataStr) return '';
    if (dataStr.includes('T')) return dataStr.split('T')[0];
    if (dataStr.match(/^\d{4}-\d{2}-\d{2}$/)) return dataStr;
    const d = new Date(dataStr);
    if (!isNaN(d.getTime())) {
        return d.toISOString().split('T')[0];
    }
    return '';
}

// --- AUTENTICAÇÃO ---
function toggleSenha() {
    const input = document.getElementById('admin-pass');
    const icon = document.querySelector('.password-toggle');
    if (input.type === 'password') { 
        input.type = 'text'; 
        icon.classList.replace('fa-eye', 'fa-eye-slash'); 
    } else { 
        input.type = 'password'; 
        icon.classList.replace('fa-eye-slash', 'fa-eye'); 
    }
}

function realizarLogin(e) {
    e.preventDefault();
    const pass = document.getElementById('admin-pass').value;
    
    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Entrando...';

    showLoading('Autenticando...');

    fetch(URL_API, { 
        method: 'POST', 
        body: JSON.stringify({ action: 'loginAdmin', senha: pass }) 
    })
    .then(res => res.json())
    .then(json => {
        Swal.close();
        if(json.auth) {
            document.getElementById('login-screen').style.display = 'none';
            document.getElementById('admin-panel').classList.remove('hidden');
            sessionStorage.setItem('admin_token', pass);
            // Limpa cache antigo ao logar para garantir dados frescos na sessão
            sessionStorage.removeItem(CACHE_KEY_EVENTS);
            sessionStorage.removeItem(CACHE_KEY_INSCR);
            carregarDashboard();
            carregarQuotaEmail(); // Carrega cota ao logar
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
    sessionStorage.removeItem(CACHE_KEY_EVENTS);
    sessionStorage.removeItem(CACHE_KEY_INSCR);
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

    if(tabId === 'tab-dashboard' || tabId === 'tab-relatorios') {
        carregarDashboard();
        carregarQuotaEmail();
    }
    if(tabId === 'tab-eventos') carregarEventosAdmin();
    if(tabId === 'tab-inscricoes') {
        carregarInscricoes();
        carregarQuotaEmail();
    }
    if(tabId === 'tab-config') {
        carregarInstituicoes();
        carregarConfigGeral(); 
    }
}

// --- LÓGICA DE COTA DE E-MAIL ---
function carregarQuotaEmail() {
    fetch(`${URL_API}?action=getQuotaEmail`) 
    .then(r => r.json())
    .then(json => {
        if(json.status === 'success') {
            const usados = json.usados;
            const limite = json.limite;
            
            // Atualiza Badge da Sidebar
            const sbBadge = document.getElementById('sidebar-quota-badge');
            if(sbBadge) {
                sbBadge.innerText = `${usados}/${limite}`;
                sbBadge.style.display = 'inline-block';
                // Cor dinâmica baseada no uso
                if(usados >= limite) {
                    sbBadge.style.background = 'rgba(239, 68, 68, 0.4)'; // Vermelho
                } else if(usados >= limite * 0.8) {
                    sbBadge.style.background = 'rgba(245, 158, 11, 0.4)'; // Amarelo
                } else {
                    sbBadge.style.background = 'rgba(255, 255, 255, 0.1)'; // Transparente
                }
            }

            // Atualiza Badge do Header (Inscrições)
            const hdBadge = document.getElementById('header-quota-badge');
            const valSpan = document.getElementById('quota-value');
            if(hdBadge && valSpan) {
                valSpan.innerText = usados;
                hdBadge.style.display = 'inline-flex';
                
                hdBadge.className = 'badge'; // Reset
                if(usados >= limite) {
                    hdBadge.classList.add('danger'); 
                    hdBadge.title = "Cota de hoje esgotada!";
                } else if(usados >= limite * 0.8) {
                    hdBadge.classList.add('warning');
                    hdBadge.title = "Cota quase cheia";
                } else {
                    hdBadge.style.background = '#e2e8f0';
                }
            }
        }
    }).catch(e => console.log("Erro quota", e));
}

// --- CONFIGURAÇÃO GERAL ---
function carregarConfigGeral() {
    fetch(`${URL_API}?action=getConfigDrive&token=${sessionStorage.getItem('admin_token')}`)
    .then(r => r.json())
    .then(json => {
        if(json.status === 'success') {
            document.getElementById('config-drive-id').value = json.idPasta || '';
            // Config de cor removida (agora é por evento)
            document.getElementById('config-nome-sec').value = json.nomeSec || '';
            document.getElementById('config-nome-resp').value = json.nomeResp || '';
            document.getElementById('config-assinatura').value = json.assinatura || ''; 
        }
    });
}

function salvarConfigGeral() {
    const id = document.getElementById('config-drive-id').value;
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
            // corCard removido
            nomeSec: sec,
            nomeResp: resp,
            assinatura: ass
        }) 
    }).then(() => {
        Swal.fire({icon: 'success', title: 'Configurações Salvas!', timer: 1500, showConfirmButton: false});
    });
}

// --- BOTÃO COPIAR LINK SCANNER ---
function copiarLinkScanner() {
    let urlBase = window.location.href;
    if (urlBase.includes('admin.html')) {
        urlBase = urlBase.replace('admin.html', 'scanner.html');
    } else {
        urlBase = urlBase.substring(0, urlBase.lastIndexOf('/') + 1) + 'scanner.html';
    }

    navigator.clipboard.writeText(urlBase).then(() => {
        Swal.fire({
            icon: 'success', 
            title: 'Link Copiado!', 
            text: 'Envie este link para o motorista ou fiscal.', 
            timer: 2500, 
            showConfirmButton: false
        });
    }).catch(err => {
        console.error('Erro ao copiar: ', err);
        Swal.fire({
            icon: 'error', 
            title: 'Erro ao Copiar', 
            text: 'Não foi possível copiar automaticamente. O link é: ' + urlBase
        });
    });
}

// --- DASHBOARD E DADOS GERAIS (COM CACHE) ---
function carregarDashboard() {
    const token = sessionStorage.getItem('admin_token');
    
    // 1. Tentar carregar do Cache primeiro
    const cachedEvt = sessionStorage.getItem(CACHE_KEY_EVENTS);
    const cachedInscr = sessionStorage.getItem(CACHE_KEY_INSCR);
    
    if (cachedEvt && cachedInscr) {
        try {
            processarDadosDashboard(JSON.parse(cachedEvt), JSON.parse(cachedInscr));
        } catch(e) {}
    }

    // 2. Buscar atualizações em background
    Promise.all([
        fetch(`${URL_API}?action=getTodosEventos`).then(r => r.json()),
        fetch(`${URL_API}?action=getInscricoesAdmin&token=${token}`).then(r => r.json())
    ]).then(([jsonEventos, jsonInscricoes]) => {
        if(jsonEventos.data) sessionStorage.setItem(CACHE_KEY_EVENTS, JSON.stringify(jsonEventos.data));
        if(jsonInscricoes.data) sessionStorage.setItem(CACHE_KEY_INSCR, JSON.stringify(jsonInscricoes.data));
        
        processarDadosDashboard(jsonEventos.data || [], jsonInscricoes.data || []);
    });
}

function processarDadosDashboard(eventosData, inscricoesData) {
    mapaEventos = {}; 
    cacheEventos = {}; 
    
    eventosData.forEach(ev => {
        if (ev.id && ev.titulo) {
            mapaEventos[ev.id] = ev.titulo;
            cacheEventos[ev.id] = ev; 
        }
    });
    
    dashboardData = inscricoesData;
    atualizarSelectsRelatorio(eventosData, dashboardData);
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
    if(selEvento && selEvento.options.length <= 1) {
        selEvento.innerHTML = '<option value="">Todos os Eventos</option>';
        eventos.forEach(ev => {
            if(ev.id && ev.titulo) {
                selEvento.innerHTML += `<option value="${ev.id}">${ev.titulo}</option>`;
            }
        });
    }
    const selInst = document.getElementById('relatorio-inst');
    if(selInst && selInst.options.length <= 1) {
        let instituicoes = new Set();
        inscricoes.forEach(ins => { try { instituicoes.add(JSON.parse(ins.dadosJson).NomeInstituicao); } catch(e){} });
        selInst.innerHTML = '<option value="">Todas as Instituições</option>';
        Array.from(instituicoes).sort().forEach(inst => { if(inst) selInst.innerHTML += `<option value="${inst}">${inst}</option>`; });
    }
}

// --- INSCRIÇÕES (Logic COM CACHE) ---
function carregarInscricoes(forceReload = false) {
    const tbody = document.getElementById('lista-inscricoes-admin');
    const cachedEvents = sessionStorage.getItem(CACHE_KEY_EVENTS);
    const cachedInscr = sessionStorage.getItem(CACHE_KEY_INSCR);

    // Se tiver cache e não for reload forçado, renderiza instantâneo
    if (!forceReload && cachedEvents && cachedInscr) {
        try {
            processarDadosInscricoes(JSON.parse(cachedEvents), JSON.parse(cachedInscr));
            return; // Sai e deixa o fetch atualizar em background se necessário
        } catch(e) {}
    }

    if(!cachedInscr || forceReload) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:2rem;">Carregando dados...</td></tr>';
    }
    
    Promise.all([
        fetch(`${URL_API}?action=getTodosEventos`).then(r => r.json()),
        fetch(`${URL_API}?action=getInscricoesAdmin&token=${sessionStorage.getItem('admin_token')}`).then(r => r.json())
    ]).then(([jsonEventos, jsonInscricoes]) => {
        if(jsonEventos.data) sessionStorage.setItem(CACHE_KEY_EVENTS, JSON.stringify(jsonEventos.data));
        if(jsonInscricoes.data) sessionStorage.setItem(CACHE_KEY_INSCR, JSON.stringify(jsonInscricoes.data));
        
        processarDadosInscricoes(jsonEventos.data || [], jsonInscricoes.data || []);
        carregarQuotaEmail(); // Atualiza contador
    }).catch(() => {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#dc2626;">Erro de comunicação.</td></tr>';
    });
}

function processarDadosInscricoes(eventosData, inscricoesData) {
    mapaEventos = {}; 
    cacheEventos = {};
    const select = document.getElementById('filtro-evento');
    
    eventosData.forEach(ev => { 
         if(ev.id && ev.titulo) {
             mapaEventos[ev.id] = ev.titulo; 
             cacheEventos[ev.id] = ev; 
         }
    });

    if(select && select.options.length <= 1) {
         Object.keys(mapaEventos).forEach(id => select.innerHTML += `<option value="${id}">${mapaEventos[id]}</option>`);
    }

    todasInscricoes = (inscricoesData || []).sort((a,b) => new Date(b.data) - new Date(a.data));
    resetEFiltrar();
}

function resetEFiltrar() {
    paginaAtual = 1; 
    desmarcarTudo();
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
                <div style="display:flex; gap:5px; justify-content:flex-end; align-items:center; width:100%;">
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

// --- EDIÇÃO DE INSCRIÇÃO ---
function abrirEdicaoInscricao(chave) {
    const inscricao = todasInscricoes.find(i => i.chave === chave);
    if (!inscricao) return;
    
    let dados = {}; try { dados = JSON.parse(inscricao.dadosJson); } catch(e) {}
    let evento = cacheEventos[inscricao.eventoId] || {};
    let configEvento = {}; try { configEvento = JSON.parse(evento.config || '{}'); } catch(e) {}

    let fotoUrl = 'https://via.placeholder.com/150?text=Sem+Foto';
    if(dados.linkFoto) {
        fotoUrl = formatarUrlDrive(dados.linkFoto);
        if(!fotoUrl) fotoUrl = 'https://via.placeholder.com/150?text=Sem+Foto';
    }

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

    let htmlCamposEsquerda = '';
    let htmlCamposDireita = '';
    const ignorar = ['linkFoto', 'linkDoc'];
    const camposAcad = ['NomeInstituicao', 'NomeCurso', 'PeriodoCurso', 'Matricula', 'Turno'];

    for (const [key, val] of Object.entries(dados)) {
        if (!ignorar.includes(key)) {
            const label = LABELS_TODOS_CAMPOS[key] || key;
            let inputType = 'text';
            let valorInput = val;
            if (key === 'DataNascimento') {
                inputType = 'date';
                valorInput = formatarDataParaInput(val);
            }
            const inputHtml = `<div style="margin-bottom:10px;"><label class="swal-label">${label}</label><input type="${inputType}" id="edit_aluno_${key}" value="${valorInput}" class="swal-input-custom"></div>`;
            if (camposAcad.includes(key) || key.startsWith('Inst') || key.includes('Curso')) htmlCamposDireita += inputHtml;
            else htmlCamposEsquerda += inputHtml;
        }
    }

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
                <label class="swal-label" style="font-size:0.75rem;"><i class="fa-solid fa-file-arrow-up"></i> Novo Documento</label>
                <input type="file" id="edit_upload_doc" accept="application/pdf" class="swal-input-custom" style="font-size:0.8rem;">
            </div>`;
        htmlUploads += `</div></div>`;
    }

    Swal.fire({
        width: '1100px',
        title: '', 
        html: `
            <div class="grid-sidebar">
                <div style="background: #f8fafc; padding: 25px; border-radius: 12px; text-align: center; border: 1px solid #e2e8f0; height: 100%;">
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
                    <div id="area-motivo-rejeicao" style="text-align: left; margin-bottom: 20px; display: none;">
                        <label class="swal-label" style="color: #dc2626;">Motivo da Rejeição (Será enviado por e-mail)</label>
                        <textarea id="motivo_rejeicao" class="swal-input-custom" style="height: 80px; border-color: #fecaca; background: #fef2f2;" placeholder="Explique o motivo..."></textarea>
                    </div>
                    ${htmlDocCard}
                </div>
                <div style="padding-right: 10px;">
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 20px; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px;">
                        <i class="fa-solid fa-user-pen" style="color: var(--primary); font-size: 1.2rem;"></i>
                        <h3 style="margin: 0; color: var(--text-main); font-size:1.1rem; font-weight: 700;">Editar Informações</h3>
                    </div>
                    <div style="max-height: 60vh; overflow-y: auto; padding-right: 10px;">
                        <div class="swal-grid-2" style="align-items: start; margin-bottom:0;">
                            <div><label class="swal-label" style="color: var(--primary); border-bottom: 1px solid #e2e8f0; padding-bottom: 5px; margin-bottom: 10px;"><i class="fa-regular fa-id-card"></i> Dados Pessoais</label>${htmlCamposEsquerda}</div>
                            <div><label class="swal-label" style="color: var(--primary); border-bottom: 1px solid #e2e8f0; padding-bottom: 5px; margin-bottom: 10px;"><i class="fa-solid fa-graduation-cap"></i> Dados Acadêmicos</label>${htmlCamposDireita}</div>
                        </div>
                        ${htmlUploads}
                    </div>
                </div>
            </div>
        `,
        showCancelButton: true, confirmButtonText: 'Salvar Alterações', confirmButtonColor: '#2563eb',
        didOpen: () => {
            const selectStatus = document.getElementById('novo_status_modal');
            const areaMotivo = document.getElementById('area-motivo-rejeicao');
            function toggleMotivo() { areaMotivo.style.display = selectStatus.value === 'Rejeitada' ? 'block' : 'none'; }
            toggleMotivo();
            selectStatus.addEventListener('change', toggleMotivo);
        },
        preConfirm: async () => {
            const novosDados = {};
            for (const key of Object.keys(dados)) { 
                if (!ignorar.includes(key)) { 
                    const el = document.getElementById(`edit_aluno_${key}`); 
                    if (el) novosDados[key] = el.value; 
                } 
            }
            const novoStatus = document.getElementById('novo_status_modal').value;
            const motivoRejeicao = document.getElementById('motivo_rejeicao').value;
            
            if (novoStatus === 'Rejeitada' && !motivoRejeicao.trim()) {
                Swal.showValidationMessage('Por favor, informe o motivo da rejeição.');
                return false;
            }
            
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

            return { 
                novosDados, 
                status: novoStatus, 
                motivo: motivoRejeicao, 
                arquivos: Object.keys(arqs).length > 0 ? arqs : null 
            };
        }
    }).then((result) => {
        if (result.isConfirmed) {
            showLoading('Salvando...');
            
            const promiseStatus = (result.value.status !== inscricao.status) ? 
                fetch(URL_API, { 
                    method: 'POST', 
                    body: JSON.stringify({ 
                        action: 'atualizarStatus', 
                        senha: sessionStorage.getItem('admin_token'), 
                        chave: chave, 
                        novoStatus: result.value.status,
                        motivo: result.value.motivo 
                    }) 
                }).then(r => r.json()) : 
                Promise.resolve({emailEnviado: false});

            promiseStatus.then((resStatus) => {
                return fetch(URL_API, { 
                    method: 'POST', 
                    body: JSON.stringify({ 
                        action: 'editarInscricao', 
                        senha: sessionStorage.getItem('admin_token'), 
                        chave: chave, 
                        novosDados: result.value.novosDados,
                        arquivos: result.value.arquivos 
                    }) 
                }).then(() => resStatus);
            }).then((resStatus) => {
                let msg = 'Dados Atualizados!';
                if (resStatus.emailEnviado) msg += ' E-mail enviado.';
                else if (result.value.status === 'Rejeitada' || result.value.status === 'Aprovada' || result.value.status === 'Ficha Emitida') {
                    // Se era um status que deveria enviar email mas não enviou
                    if(!resStatus.emailEnviado && resStatus.message && resStatus.message.includes('Cota')) {
                        msg += ' (Sem e-mail: cota cheia).';
                    }
                }
                
                Swal.fire({icon: 'success', title: 'Sucesso', text: msg, timer: 2000, showConfirmButton: false});
                carregarInscricoes(true);
                carregarQuotaEmail();
            });
        }
    });
}

function acaoEmMassa(s) {
    Swal.fire({title: `Marcar ${selecionados.size} como ${s}?`, icon: 'warning', showCancelButton: true}).then((r) => {
        if(r.isConfirmed) {
            showLoading('Processando...');
            fetch(URL_API, { method: 'POST', body: JSON.stringify({ action: 'atualizarStatusEmMassa', senha: sessionStorage.getItem('admin_token'), chaves: Array.from(selecionados), novoStatus: s }) })
            .then(res => res.json())
            .then((json) => { 
                let msg = json.message || 'Atualizado!';
                Swal.fire({icon: 'success', title: 'Atualizado!', text: msg}); 
                todasInscricoes.forEach(i => { if(selecionados.has(i.chave)) i.status = s; }); 
                resetEFiltrar();
                carregarQuotaEmail();
            });
        }
    });
}

// --- FUNÇÕES AUXILIARES ---
function toggleCheck(k) { if(selecionados.has(k)) selecionados.delete(k); else selecionados.add(k); atualizarBarraBulk(); }
function toggleAllChecks() { const m = document.getElementById('check-all').checked; document.querySelectorAll('.bulk-check').forEach(c => { c.checked = m; if(m) selecionados.add(c.value); else selecionados.delete(c.value); }); atualizarBarraBulk(); }
function atualizarBarraBulk() { const b = document.getElementById('bulk-bar'); document.getElementById('bulk-count').innerText = selecionados.size; if(selecionados.size > 0) b.classList.remove('hidden'); else b.classList.add('hidden'); }
function desmarcarTudo() { selecionados.clear(); document.getElementById('check-all').checked = false; document.querySelectorAll('.bulk-check').forEach(c => c.checked = false); atualizarBarraBulk(); }

function gerarFicha(chave) {
    showLoading('Gerando Ficha...');
    const inscricao = todasInscricoes.find(i => i.chave === chave);
    if (!inscricao) return Swal.fire('Erro', 'Inscrição não encontrada.', 'error');
    let dados = {}; try { dados = JSON.parse(inscricao.dadosJson); } catch(e) {}
    let evento = cacheEventos[inscricao.eventoId] || { titulo: 'Documento Oficial' };
    fetch(`${URL_API}?action=getPublicConfig`).then(r => r.json()).then(jsonConfig => {
        const configSistema = jsonConfig.config || {};
        const logoUrl = configSistema.urlLogo ? formatarUrlDrive(configSistema.urlLogo) : URL_LOGO;
        const nomeSistema = configSistema.nomeSistema || 'Sistema de Transporte';
        const nomeSecretaria = configSistema.nomeSecretaria || 'Secretaria de Educação';
        let fotoUrl = dados.linkFoto ? formatarUrlDrive(dados.linkFoto) : '';
        const fotoHtml = fotoUrl ? `<img src="${fotoUrl}" style="width:100%; height:100%; object-fit:cover; border-radius: 4px;">` : `<div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; color:#ccc; font-size:10px; background:#f0f0f0;">SEM FOTO</div>`;

        const fichaStyle = `<style>@import url('https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap'); @media print { @page { size: A4 portrait; margin: 10mm; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; font-family: 'Roboto', sans-serif; background: white; } body > *:not(#print-layer) { display: none !important; } #print-layer { display: block !important; position: absolute; top:0; left:0; width:100%; } } .ficha-a4 { width: 100%; max-width: 210mm; margin: 0 auto; font-family: 'Roboto', sans-serif; color: #333; box-sizing: border-box; display: flex; flex-direction: column; gap: 20px; } .ficha-header { display: grid; grid-template-columns: 100px 1fr 120px; gap: 20px; border-bottom: 3px solid #2563eb; padding-bottom: 20px; align-items: center; } .ficha-logo img { width: 100px; height: 100px; object-fit: contain; } .ficha-titles { text-align: center; } .ficha-titles h1 { font-size: 16px; margin: 0; color: #1e293b; font-weight: 700; } .ficha-titles h2 { font-size: 14px; margin: 5px 0 0; color: #64748b; font-weight: 400; } .ficha-titles h3 { font-size: 18px; margin: 10px 0 0; color: #2563eb; font-weight: 800; letter-spacing: 1px; } .ficha-meta-box { border: 1px solid #ccc; padding: 5px; text-align: center; border-radius: 4px; background: #f8fafc; } .ficha-foto-frame { width: 90px; height: 110px; border: 1px solid #000; margin: 0 auto 5px; overflow: hidden; background: #fff; } .ficha-chave { font-family: monospace; font-size: 12px; font-weight: bold; color: #2563eb; display: block; } .section-title { background: #e2e8f0; color: #1e293b; font-size: 12px; font-weight: 700; text-transform: uppercase; padding: 6px 10px; border-radius: 4px; margin-bottom: 8px; border-left: 4px solid #2563eb; } .data-grid { display: grid; grid-template-columns: repeat(12, 1fr); gap: 10px; row-gap: 15px; } .data-item { display: flex; flex-direction: column; } .data-label { font-size: 9px; text-transform: uppercase; color: #64748b; font-weight: 600; margin-bottom: 2px; } .data-value { font-size: 12px; font-weight: 500; color: #000; border-bottom: 1px solid #ccc; padding-bottom: 2px; min-height: 18px; } .signatures-area { margin-top: 50px; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; } .sign-box { text-align: center; } .sign-line { border-top: 1px solid #000; margin-top: 40px; padding-top: 5px; font-size: 12px; font-weight: bold; } .sign-desc { font-size: 10px; color: #666; } .ficha-footer { margin-top: auto; border-top: 1px solid #eee; padding-top: 10px; font-size: 10px; color: #888; display: flex; justify-content: space-between; } .legal-text { font-size: 9px; text-align: justify; margin-top: 20px; color: #555; font-style: italic; } .col-12 { grid-column: span 12; } .col-9 { grid-column: span 9; } .col-8 { grid-column: span 8; } .col-6 { grid-column: span 6; } .col-4 { grid-column: span 4; } .col-3 { grid-column: span 3; } .col-2 { grid-column: span 2; }</style>`;
        
        let htmlContent = `${fichaStyle}<div class="ficha-a4"><div class="ficha-header"><div class="ficha-logo"><img src="${logoUrl}" onerror="this.style.display='none'"></div><div class="ficha-titles"><h1>${nomeSistema}</h1><h2>${nomeSecretaria}</h2><h3>FICHA DE INSCRIÇÃO</h3></div><div class="ficha-meta-box"><div class="ficha-foto-frame">${fotoHtml}</div><span class="ficha-chave">CHAVE: ${chave}</span></div></div><div class="data-grid" style="background:#f8fafc; padding:10px; border-radius:4px; border:1px solid #e2e8f0;"><div class="data-item col-8"><span class="data-label">Evento / Período Letivo</span><div class="data-value" style="border:none; font-weight:bold; font-size:14px; color:#2563eb;">${evento.titulo}</div></div><div class="data-item col-2"><span class="data-label">Data Inscrição</span><div class="data-value" style="border:none;">${new Date(inscricao.data).toLocaleDateString('pt-BR')}</div></div><div class="data-item col-2"><span class="data-label">Status</span><div class="data-value" style="border:none;">${inscricao.status.toUpperCase()}</div></div></div><div class="ficha-section"><div class="section-title">1. Dados Pessoais</div><div class="data-grid"><div class="data-item col-8"><span class="data-label">Nome Completo</span><div class="data-value">${dados.NomeCompleto || ''}</div></div><div class="data-item col-4"><span class="data-label">CPF</span><div class="data-value">${dados.CPF || ''}</div></div><div class="data-item col-3"><span class="data-label">Data de Nascimento</span><div class="data-value">${dados.DataNascimento ? new Date(dados.DataNascimento).toLocaleDateString('pt-BR') : ''}</div></div><div class="data-item col-3"><span class="data-label">Celular / WhatsApp</span><div class="data-value">${dados.Telefone || ''}</div></div><div class="data-item col-6"><span class="data-label">E-mail</span><div class="data-value">${dados.Email || ''}</div></div><div class="data-item col-6"><span class="data-label">Endereço</span><div class="data-value">${dados.Endereco || ''}</div></div><div class="data-item col-4"><span class="data-label">Cidade</span><div class="data-value">${dados.Cidade || ''}</div></div><div class="data-item col-2"><span class="data-label">UF</span><div class="data-value">${dados.Estado || ''}</div></div></div></div><div class="ficha-section"><div class="section-title">2. Dados Acadêmicos</div><div class="data-grid"><div class="data-item col-6"><span class="data-label">Instituição de Ensino</span><div class="data-value">${dados.NomeInstituicao || ''}</div></div><div class="data-item col-6"><span class="data-label">Curso</span><div class="data-value">${dados.NomeCurso || ''}</div></div><div class="data-item col-4"><span class="data-label">Período / Semestre</span><div class="data-value">${dados.PeriodoCurso || ''}</div></div><div class="data-item col-4"><span class="data-label">Matrícula</span><div class="data-value">${dados.Matricula || ''}</div></div><div class="data-item col-4"><span class="data-label">Turno</span><div class="data-value">${dados.Turno || ''}</div></div></div></div><div class="ficha-section"><div class="section-title">3. Informações Complementares</div><div class="data-grid">`;

        const camposIgnorar = ['NomeCompleto','CPF','DataNascimento','Telefone','Email','Endereco','Cidade','Estado','NomeInstituicao','NomeCurso','PeriodoCurso','Matricula','Turno','linkFoto','linkDoc','Assinatura','Observacoes'];
        let temExtras = false;
        for (const [key, val] of Object.entries(dados)) {
            if (!camposIgnorar.includes(key)) {
                temExtras = true;
                htmlContent += `<div class="data-item col-4"><span class="data-label">${key}</span><div class="data-value">${val}</div></div>`;
            }
        }
        if(!temExtras) htmlContent += `<div class="col-12" style="font-size:11px; color:#999; font-style:italic;">Nenhuma informação adicional registrada.</div>`;
        htmlContent += `</div></div><div class="legal-text">Declaro, para os devidos fins, que as informações acima prestadas são verdadeiras e assumo inteira responsabilidade por elas. Estou ciente das normas de utilização do transporte escolar municipal.</div><div class="signatures-area"><div class="sign-box"><div class="sign-line">${dados.NomeCompleto || 'Aluno(a)'}</div><div class="sign-desc">Assinatura do Aluno(a) ou Responsável</div></div><div class="sign-box"><div class="sign-line">Responsável pela Validação</div><div class="sign-desc">${nomeSecretaria}</div></div></div><div class="ficha-footer"><span>Documento gerado eletronicamente em ${new Date().toLocaleString('pt-BR')}</span><span>${nomeSistema} - Gestão Inteligente</span></div></div>`;

        let printLayer = document.getElementById('print-layer');
        if (!printLayer) {
            printLayer = document.createElement('div');
            printLayer.id = 'print-layer';
            document.body.appendChild(printLayer);
        }
        printLayer.innerHTML = htmlContent;
        Swal.close();
        
        const images = printLayer.querySelectorAll('img');
        let loaded = 0;
        const checkPrint = () => {
            loaded++;
            if(loaded >= images.length) {
                if(inscricao.status === 'Pendente') {
                    fetch(URL_API, { method: 'POST', body: JSON.stringify({ action: 'atualizarStatus', senha: sessionStorage.getItem('admin_token'), chave: chave, novoStatus: 'Ficha Emitida' }) });
                    inscricao.status = 'Ficha Emitida'; 
                }
                setTimeout(() => window.print(), 200);
            }
        };
        if(images.length === 0) checkPrint();
        else images.forEach(img => { if(img.complete) checkPrint(); else { img.onload = checkPrint; img.onerror = checkPrint; } });
    }).catch(err => { console.error(err); Swal.fire('Erro', 'Falha ao gerar ficha.', 'error'); });
}

function imprimirCarteirinhaAdmin(chave) {
    showLoading('Gerando Carteirinha...');
    Promise.all([
        fetch(`${URL_API}?action=consultarInscricao&chave=${chave}`).then(r => r.json()),
        fetch(`${URL_API}?action=getPublicConfig`).then(r => r.json())
    ]).then(([jsonDados, jsonConfig]) => {
        Swal.close();
        if(jsonDados.status !== 'success') return Swal.fire('Erro', 'Dados não encontrados.', 'error');
        const aluno = jsonDados.data.aluno;
        const config = jsonConfig.config || {};
        
        document.getElementById('cart-admin-nome').innerText = aluno.nome || 'Aluno';
        document.getElementById('cart-admin-inst').innerText = aluno.instituicao || '-';
        document.getElementById('cart-admin-course').innerText = aluno.curso || 'Curso não informado';
        document.getElementById('cart-admin-cpf').innerText = aluno.cpf || '---';
        document.getElementById('cart-admin-mat').innerText = aluno.matricula || '---';
        
        if(config.nomeSistema) document.getElementById('cart-admin-sys-name').innerText = config.nomeSistema.toUpperCase();
        const elSec = document.getElementById('cart-admin-sec-header');
        if(elSec && config.nomeSecretaria) elSec.innerText = config.nomeSecretaria.toUpperCase();
        const elEvent = document.getElementById('cart-admin-event-name');
        if(elEvent) elEvent.innerText = (aluno.nome_evento || "EVENTO").toUpperCase();
        document.getElementById('cart-admin-auth-code').innerText = aluno.chave || chave;
        let nasc = aluno.nascimento || '--/--/----';
        if(nasc.includes('-')) { const p = nasc.split('-'); nasc = `${p[2]}/${p[1]}/${p[0]}`; }
        document.getElementById('cart-admin-nasc').innerText = nasc;
        const img = document.getElementById('cart-admin-img');
        img.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxIiBoZWlnaHQ9IjEiPjxyZWN0IHdpZHRoPSIxIiBoZWlnaHQ9IjEiIGZpbGw9IiNlMmU4ZjAiLz48L3N2Zz4=';
        if (aluno.foto && (aluno.foto.startsWith('data:image') || aluno.foto.startsWith('http'))) img.src = formatarUrlDrive(aluno.foto);
        img.onerror = function() { this.src = 'https://via.placeholder.com/150?text=FOTO'; };
        document.getElementById('cart-admin-sec-name').innerText = config.nomeSecretario || "Secretário";
        if(config.urlLogo) document.getElementById('cart-admin-logo').src = formatarUrlDrive(config.urlLogo);
        const corFinal = aluno.cor_evento || config.corCarteirinha || '#2563eb';
        document.documentElement.style.setProperty('--card-color', corFinal);
        document.getElementById('cart-admin-validade-ano').innerText = aluno.ano_vigencia || new Date().getFullYear();
        
        const assinaturaBox = document.getElementById('cart-admin-assinatura-box');
        if (assinaturaBox) {
            if (config.urlAssinatura && config.urlAssinatura.trim() !== "") assinaturaBox.innerHTML = `<img src="${formatarUrlDrive(config.urlAssinatura)}" alt="Assinatura">`;
            else assinaturaBox.innerHTML = '';
        }

        const linkValidacao = `${URL_API}?action=validar&chave=${chave}`;
        const qr = new QRious({ element: document.getElementById('cart-admin-qr-img'), value: linkValidacao, size: 150, backgroundAlpha: 0, foreground: 'black' });
        document.getElementById('cart-admin-qr-img').src = qr.toDataURL();
        document.getElementById('modal-carteirinha-admin').classList.remove('hidden');
        document.getElementById('cart-admin-flip-container').classList.remove('is-flipped'); 
    }).catch(err => { Swal.close(); console.error(err); Swal.fire('Erro', 'Falha ao gerar carteirinha.', 'error'); });
}

function carregarEventosAdmin() {
    fetch(`${URL_API}?action=getTodosEventos`).then(res => res.json()).then(json => {
        const tbody = document.getElementById('lista-eventos-admin'); tbody.innerHTML = '';
        mapaEventos = {};
        if(!json.data || json.data.length === 0) { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 2rem;">Nenhum evento criado.</td></tr>'; return; }
        json.data.forEach(ev => { if (ev.id && ev.titulo) { mapaEventos[ev.id] = ev.titulo; cacheEventos[ev.id] = ev; } });
        json.data.filter(ev => ev.id && ev.titulo).sort((a,b) => b.id - a.id).forEach(ev => {
            let btnAction = ev.status === 'Ativo' ? `<button class="btn-icon" style="background:#eab308;" onclick="toggleStatusEvento('${ev.id}','Inativo')" title="Pausar"><i class="fa-solid fa-pause"></i></button>` : `<button class="btn-icon" style="background:#22c55e;" onclick="toggleStatusEvento('${ev.id}','Ativo')" title="Ativar"><i class="fa-solid fa-play"></i></button>`;
            tbody.innerHTML += `<tr><td><strong>#${ev.id}</strong></td><td><div style="font-weight:600; color:var(--text-main); font-size:0.95rem;">${ev.titulo}</div></td><td><div style="font-size:0.85rem; color:var(--text-secondary);">${safeDate(ev.inicio)} - ${safeDate(ev.fim)}</div></td><td><span class="badge ${ev.status === 'Ativo' ? 'success' : 'danger'}">${ev.status}</span></td><td style="text-align:right;"><div style="display:flex; gap:5px; justify-content:flex-end; align-items:center; width:100%;">${btnAction}<button class="btn-icon bg-edit" onclick='abrirEdicaoEvento(${JSON.stringify(ev)})'><i class="fa-solid fa-pen"></i></button></div></td></tr>`;
        });
    });
}

function abrirEdicaoEvento(evento) {
    let config = {}; try { config = JSON.parse(evento.config); } catch(e){}
    const checkFicha = config.exigeFicha ? 'checked' : '';
    const checkCart = config.emiteCarteirinha ? 'checked' : '';
    const cidades = config.cidadesPermitidas ? config.cidadesPermitidas.join(', ') : '';
    const limite = config.limiteInscricoes || '';
    let htmlCampos = '<div class="checkbox-grid" style="margin-bottom:15px;">';
    const camposAtivos = config.camposTexto || [];
    CAMPOS_PADRAO.forEach(c => { const isChecked = camposAtivos.includes(c.key) ? 'checked' : ''; htmlCampos += `<label class="checkbox-card"><input type="checkbox" class="edit-field-check" value="${c.key}" ${isChecked}> ${c.label}</label>`; });
    htmlCampos += '</div>';
    const camposExtras = config.camposPersonalizados || [];
    let htmlExtras = '';
    camposExtras.forEach((campo, index) => { htmlExtras += `<div class="extra-field-item" style="display:flex; gap:10px; margin-bottom:5px;"><input type="text" class="swal-input-custom extra-input" value="${campo}" readonly><button type="button" class="btn-icon bg-delete" onclick="this.parentElement.remove()" style="width:30px;"><i class="fa-solid fa-trash"></i></button></div>`; });
    const corAtual = config.corCarteirinha || '#2563eb';

    Swal.fire({
        title: 'Editar Evento', width: '900px',
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
                <div>
                    <!-- NOVO: Cor da Carteirinha deste Evento -->
                    <label class="swal-label">Cor da Carteirinha</label>
                    <div style="display:flex; gap:10px;">
                        <input type="color" id="edit_cor_picker" class="swal-input-custom" style="width:50px; padding:0; height:38px;" value="${corAtual}" onchange="document.getElementById('edit_cor').value = this.value">
                        <input type="text" id="edit_cor" class="swal-input-custom" value="${corAtual}" placeholder="#2563eb">
                    </div>
                </div>
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
                    const div = document.createElement('div'); div.className = 'extra-field-item'; div.style.cssText = 'display:flex; gap:10px; margin-bottom:5px;'; div.innerHTML = `<input type="text" class="swal-input-custom extra-input" value="${val}" readonly><button type="button" class="btn-icon bg-delete" onclick="this.parentElement.remove()" style="width:30px;"><i class="fa-solid fa-trash"></i></button>`;
                    document.getElementById('container-extras-edit').appendChild(div); document.getElementById('new-extra-edit').value = '';
                }
            });
        },
        preConfirm: () => { 
            const cidadesTexto = document.getElementById('edit_cidades').value; const cidadesArr = cidadesTexto ? cidadesTexto.split(',').map(s => s.trim()).filter(s => s) : [];
            const extras = []; document.querySelectorAll('#container-extras-edit .extra-input').forEach(el => extras.push(el.value));
            const camposSelecionados = []; document.querySelectorAll('.edit-field-check:checked').forEach(c => camposSelecionados.push(c.value));
            return { 
                fim: document.getElementById('edit_fim').value, 
                msg: document.getElementById('edit_msg').value, 
                exigeFicha: document.getElementById('edit_req_ficha').checked, 
                emiteCarteirinha: document.getElementById('edit_emitir_carteirinha').checked, 
                cidadesPermitidas: cidadesArr, 
                camposPersonalizados: extras, 
                limiteInscricoes: document.getElementById('edit_limite').value, 
                camposTexto: camposSelecionados, 
                corCarteirinha: document.getElementById('edit_cor').value 
            }; 
        }
    }).then((res) => { if(res.isConfirmed) { showLoading('Salvando...'); const payload = { action: 'editarEvento', senha: sessionStorage.getItem('admin_token'), id: evento.id, ...res.value }; fetch(URL_API, { method: 'POST', body: JSON.stringify(payload) }).then(() => { Swal.fire({icon: 'success', title: 'Salvo!'}); carregarEventosAdmin(); }); } });
}

function toggleStatusEvento(id, status) { showLoading('Atualizando...'); fetch(URL_API, { method: 'POST', body: JSON.stringify({ action: 'alterarStatusEvento', senha: sessionStorage.getItem('admin_token'), id, novoStatus: status }) }).then(() => { Swal.close(); carregarEventosAdmin(); }); }

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

                <div class="swal-grid-2" style="margin-top: 10px;">
                    <div>
                        <!-- NOVO: Cor da Carteirinha ao Criar -->
                        <label class="swal-label">Cor da Carteirinha</label>
                        <div style="display:flex; gap:10px;">
                            <input type="color" id="swal-cor-picker" class="swal-input-custom" style="width:50px; padding:0; height:38px;" value="#2563eb" onchange="document.getElementById('swal-cor').value = this.value">
                            <input type="text" id="swal-cor" class="swal-input-custom" value="#2563eb" placeholder="#2563eb">
                        </div>
                    </div>
                    <div></div>
                </div>
                
                <div class="swal-full" style="margin-top:10px;">
                    <label class="swal-label">Observações (Somente Leitura)</label>
                    <textarea id="txt_obs_admin" class="swal-input-custom" style="height:42px;" placeholder="Instruções para o aluno..."></textarea>
                </div>

                <label class="swal-label" style="margin-top: 15px;">Documentos Obrigatórios</label>
                <div class="checkbox-grid">
                    <label class="checkbox-card"><input type="checkbox" id="req_foto" checked> Foto 3x4</label>
                    <label class="checkbox-card"><input type="checkbox" id="req_doc" checked> Comprovante / Declaração de Inscrição</label>
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
                    limiteInscricoes: document.getElementById('swal-limite').value,
                    corCarteirinha: document.getElementById('swal-cor').value // Salva a cor
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

function carregarInstituicoes() { fetch(`${URL_API}?action=getInstituicoes`).then(r => r.json()).then(json => { const d = document.getElementById('lista-instituicoes'); d.innerHTML = ''; if(json.data) json.data.forEach(n => d.innerHTML += `<div style="padding:10px; border-bottom:1px solid #eee; display:flex; justify-content:space-between; align-items:center;"><span>${n}</span> <button onclick="removerInst('${n}')" class="btn-icon bg-delete" style="width:24px; height:24px;"><i class="fa-solid fa-times"></i></button></div>`); }); }
function addInstituicao() { const n = document.getElementById('nova-inst').value; if(n) fetch(URL_API, { method: 'POST', body: JSON.stringify({ action: 'adicionarInstituicao', nome: n, senha: sessionStorage.getItem('admin_token') }) }).then(() => { document.getElementById('nova-inst').value = ''; carregarInstituicoes(); }); }
function removerInst(n) { fetch(URL_API, { method: 'POST', body: JSON.stringify({ action: 'removerInstituicao', nome: n, senha: sessionStorage.getItem('admin_token') }) }).then(() => carregarInstituicoes()); }

function formatarUrlDrive(url) { if (!url) return ''; if (url.startsWith('data:')) return url; let id = ''; const parts = url.split(/\/d\/|id=/); if (parts.length > 1) id = parts[1].split(/\/|&/)[0]; if (id) return `https://lh3.googleusercontent.com/d/${id}`; return url; }
const toBase64 = f => new Promise((r, j) => { const rd = new FileReader(); rd.readAsDataURL(f); rd.onload = () => r(rd.result.split(',')[1]); rd.onerror = e => j(e); });
