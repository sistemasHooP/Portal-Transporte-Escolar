const URL_API = 'https://script.google.com/macros/s/AKfycby-rnmBcploCmdEb8QWkMyo1tEanCcPkmNOA_QMlujH0XQvjLeiCCYhkqe7Hqhi6-mo8A/exec';

// --- CONFIGURAÇÃO DE CACHE ---
const CACHE_EVENTOS_KEY = 'sys_eventos_v2';
const CACHE_CONFIG_KEY = 'sys_config_v2';

// Definição dos campos padrão
const CAMPO_DEFS = {
    'NomeCompleto': { label: 'Nome Completo', type: 'text', placeholder: 'Digite seu nome completo' },
    'CPF': { label: 'CPF', type: 'text', placeholder: '000.000.000-00', mask: 'cpf' },
    'DataNascimento': { label: 'Data de Nascimento', type: 'date', placeholder: '' },
    'Telefone': { label: 'Celular (WhatsApp)', type: 'tel', placeholder: '(00) 00000-0000', mask: 'tel' },
    'Endereco': { label: 'Endereço Residencial', type: 'text', placeholder: 'Rua, Número, Complemento, Bairro' },
    'Cidade': { label: 'Cidade', type: 'text', placeholder: 'Digite sua cidade' },
    'Estado': { label: 'Estado (UF)', type: 'select', options: ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'] },
    'NomeInstituicao': { label: 'Instituição de Ensino', type: 'select' }, 
    'NomeCurso': { label: 'Curso', type: 'text', placeholder: 'Ex: Engenharia Civil' },
    'PeriodoCurso': { label: 'Período/Semestre', type: 'text', placeholder: 'Ex: 3º Período' },
    'Matricula': { label: 'Nº Matrícula', type: 'text', placeholder: '' },
    'Email': { label: 'E-mail', type: 'email', placeholder: 'seu@email.com' }
};

let listaInstituicoesCache = [];
let configSistemaCache = null;

// Inicialização
document.addEventListener('DOMContentLoaded', () => { 
    // Função "Wake Up" imediata
    acordarSistema();
    
    // Configura Ping periódico (a cada 5 minutos) para manter a sessão ativa
    setInterval(acordarSistema, 5 * 60 * 1000);

    // Carregamento normal
    carregarConfiguracoesVisuais();
    carregarEventos(); 
});

// --- FUNÇÃO PARA ACORDAR O GOOGLE SHEETS ---
function acordarSistema() {
    // Chama o backend sem bloquear a interface (fire and forget)
    fetch(`${URL_API}?action=wakeUp`, { method: 'GET', mode: 'no-cors' }) 
        .then(() => console.log('Ping enviado ao sistema.'))
        .catch(e => console.log('Ping falhou (offline?)', e));
}

// --- CARREGAR CONFIGURAÇÕES VISUAIS (Estratégia: Cache First) ---
function carregarConfiguracoesVisuais() {
    // 1. Tenta pegar do LocalStorage (Persistente)
    const cached = localStorage.getItem(CACHE_CONFIG_KEY);
    
    if(cached) {
        try {
            configSistemaCache = JSON.parse(cached);
            aplicarConfiguracoes(configSistemaCache);
        } catch(e) { console.error("Cache config inválido"); }
    }

    // 2. Busca atualização silenciosa em background
    fetch(`${URL_API}?action=getPublicConfig`)
        .then(res => res.json())
        .then(json => {
            if(json.status === 'success') {
                const novoConfigStr = JSON.stringify(json.config);
                // Só reaplica se mudou algo para evitar reflow desnecessário
                if (novoConfigStr !== cached) {
                    localStorage.setItem(CACHE_CONFIG_KEY, novoConfigStr);
                    configSistemaCache = json.config;
                    aplicarConfiguracoes(json.config);
                }
            }
        })
        .catch(e => console.warn("Modo offline ou erro config:", e));
}

function aplicarConfiguracoes(config) {
    if(!config) return;

    if(config.nomeSistema) {
        const els = ['sys-name', 'footer-sys-name', 'cart-sys-name'];
        els.forEach(id => {
            const el = document.getElementById(id);
            if(el) el.innerText = id === 'cart-sys-name' ? config.nomeSistema.toUpperCase() : config.nomeSistema;
        });
        document.title = config.nomeSistema;
    }
    
    if(config.fraseMotivacional) {
        const fr = document.getElementById('sys-phrase');
        if(fr) fr.innerText = config.fraseMotivacional;
    }

    if(config.urlLogo && config.urlLogo.trim() !== "") {
        const logoUrl = formatarUrlDrive(config.urlLogo);
        const logoEls = ['sys-logo', 'cart-logo-img'];
        logoEls.forEach(id => {
            const el = document.getElementById(id);
            if(el) { el.src = logoUrl; el.style.display = 'block'; }
        });
        const loaderImg = document.getElementById('loader-img-tag');
        if(loaderImg) { loaderImg.src = logoUrl; loaderImg.style.display = 'block'; }
    }

    if(config.urlCapa && config.urlCapa.trim() !== "") {
        const capaUrl = formatarUrlDrive(config.urlCapa);
        const hero = document.getElementById('hero-section');
        if(hero) hero.style.backgroundImage = `url('${capaUrl}')`;
    }

    if(config.corCarteirinha) {
        document.documentElement.style.setProperty('--card-color', config.corCarteirinha);
    }
}

// --- UTILS UI ---
function toggleLoader(show, msg = "Processando...") {
    const el = document.getElementById('loader-overlay');
    if(show) { 
        document.getElementById('loader-text').innerText = msg; 
        el.classList.remove('hidden'); 
    } else { 
        el.classList.add('hidden'); 
    }
}

function showSuccess(titulo, html, callback) {
    Swal.fire({ 
        icon: 'success', title: titulo, html: html, 
        confirmButtonColor: '#2563eb', confirmButtonText: 'OK', allowOutsideClick: false
    }).then(() => { if(callback) callback(); });
}

function showError(titulo, text) {
    Swal.fire({ icon: 'error', title: titulo, text: text, confirmButtonColor: '#d33' });
}

// --- MODAIS ---
function abrirModalConsulta() { 
    document.getElementById('modal-consulta').classList.remove('hidden'); 
    setTimeout(() => document.getElementById('busca-chave').focus(), 100); 
}

function fecharModalConsulta() { 
    document.getElementById('modal-consulta').classList.add('hidden'); 
    document.getElementById('resultado-busca').innerHTML = ''; 
    document.getElementById('busca-chave').value = ''; 
}

document.getElementById('modal-consulta').addEventListener('click', function(e) { 
    if (e.target === this) fecharModalConsulta(); 
});

// --- VALIDAÇÕES E MÁSCARAS ---
function validarCPF(cpf) {
    cpf = cpf.replace(/[^\d]+/g, '');
    if (cpf == '') return false;
    if (cpf.length != 11 || cpf == "00000000000" || cpf == "11111111111") return false;
    let add = 0; for (let i = 0; i < 9; i++) add += parseInt(cpf.charAt(i)) * (10 - i);
    let rev = 11 - (add % 11); if (rev == 10 || rev == 11) rev = 0; 
    if (rev != parseInt(cpf.charAt(9))) return false;
    add = 0; for (let i = 0; i < 10; i++) add += parseInt(cpf.charAt(i)) * (11 - i);
    rev = 11 - (add % 11); if (rev == 10 || rev == 11) rev = 0; 
    if (rev != parseInt(cpf.charAt(10))) return false;
    return true;
}

function aplicarMascaraCPF(v) { return v.replace(/\D/g, '').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})/, '$1-$2').replace(/(-\d{2})\d+?$/, '$1'); }
function aplicarMascaraTelefone(v) { return v.replace(/\D/g, '').replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2').replace(/(-\d{4})\d+?$/, '$1'); }

function ativarMascaras() {
    const iC = document.querySelector('input[name="CPF"]');
    if(iC) { iC.maxLength=14; iC.addEventListener('input', e=>e.target.value=aplicarMascaraCPF(e.target.value)); }
    const iT = document.querySelector('input[name="Telefone"]');
    if(iT) { iT.maxLength=15; iT.addEventListener('input', e=>e.target.value=aplicarMascaraTelefone(e.target.value)); }
}

// --- UPLOAD PREVIEW ---
function previewArquivo(input) {
    const label = input.parentElement.querySelector('label');
    const statusIcon = label.querySelector('.status-icon');
    if(input.files && input.files[0]) {
        label.style.borderColor = '#10b981'; label.style.backgroundColor = '#ecfdf5';
        statusIcon.innerHTML = '<i class="fa-solid fa-circle-check" style="color:#10b981"></i>';
    } else {
        label.style.borderColor = '#e2e8f0'; label.style.backgroundColor = 'white';
        statusIcon.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i>';
    }
}

// --- COMPRESSÃO DE IMAGEM ---
async function comprimirImagem(file, maxWidth = 600, quality = 0.5) {
    if(file.type === 'application/pdf') return toBase64(file);
    return new Promise((resolve, reject) => {
        const reader = new FileReader(); reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image(); img.src = event.target.result;
            img.onload = () => {
                const c = document.createElement('canvas'); 
                let w = img.width, h = img.height;
                if (w > maxWidth) { h *= maxWidth / w; w = maxWidth; }
                c.width = w; c.height = h; const ctx = c.getContext('2d'); 
                ctx.drawImage(img, 0, 0, w, h);
                resolve(c.toDataURL('image/jpeg', quality).split(',')[1]);
            }; img.onerror = (e) => reject(e);
        }; reader.onerror = (e) => reject(e);
    });
}

// --- EVENTOS: ESTRATÉGIA STALE-WHILE-REVALIDATE ---
function carregarEventos() {
    // 1. Renderiza IMEDIATAMENTE do cache (se existir)
    const cachedData = localStorage.getItem(CACHE_EVENTOS_KEY);
    let cacheUsado = false;

    if (cachedData) {
        try {
            const data = JSON.parse(cachedData);
            renderizarListaEventos(data); // Mostra na tela na hora!
            cacheUsado = true;
            console.log("Exibindo cache instantâneo.");
        } catch(e) { console.warn("Cache corrompido"); }
    }

    // 2. Busca dados FRESCOS no servidor (para atualizar vagas em tempo real)
    // Se não usou cache, mostra loader. Se usou, o loader é invisível ou sutil.
    if (!cacheUsado) toggleLoader(true, "Buscando eventos...");

    fetch(`${URL_API}?action=getEventosAtivos`)
        .then(res => res.json())
        .then(json => {
            if (!cacheUsado) toggleLoader(false);
            
            if(json.data) {
                // Compara se mudou algo crítico antes de renderizar para evitar "piscada"
                const novoStr = JSON.stringify(json.data);
                if (novoStr !== cachedData) {
                    localStorage.setItem(CACHE_EVENTOS_KEY, novoStr);
                    renderizarListaEventos(json.data); // Atualiza a tela com vagas reais
                    console.log("Tela atualizada com dados do servidor.");
                }
            } else {
                renderizarListaEventos([]); // Nenhum evento
            }
        })
        .catch(() => { 
            if (!cacheUsado) {
                toggleLoader(false); 
                const c = document.getElementById('cards-container');
                if(c) c.innerHTML = '<div style="grid-column:1/-1; text-align:center; color:red; padding:20px;">Erro de conexão. Verifique sua internet.</div>'; 
            }
        });
}

function renderizarListaEventos(data) {
    const c = document.getElementById('cards-container'); 
    if(!c) return;
    c.innerHTML = '';
    
    if (!data || data.length === 0) { 
        c.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding:3rem; color:#64748b; background:white; border-radius:16px;">
            <i class="fa-regular fa-calendar-xmark" style="font-size:3rem; margin-bottom:15px; opacity:0.5;"></i>
            <h3>Nenhum evento disponível no momento.</h3>
            <p>Fique atento às próximas datas!</p>
        </div>`; 
        return; 
    }
    
    data.forEach(ev => {
        const limite = parseInt(ev.limite || 0);
        const inscritos = parseInt(ev.inscritos || 0);
        
        // Regra de Vagas: Backend é a autoridade, mas o frontend já avisa
        let esgotado = (limite > 0 && inscritos >= limite);

        let statusBadge = '<div class="card-status status-ativo">Inscrições Abertas</div>';
        let btnHtml = `
            <button class="btn-inscrever" onclick='abrirInscricao(${JSON.stringify(ev)})'>
                <span>Inscrever-se Agora</span>
                <i class="fa-solid fa-arrow-right"></i>
            </button>`;

        if (esgotado) {
            statusBadge = '<div class="card-status" style="background:#fee2e2; color:#991b1b; border-color:#fecaca;"><i class="fa-solid fa-ban"></i> Vagas Esgotadas</div>';
            btnHtml = `
                <button class="btn-inscrever" style="background:#94a3b8; cursor:not-allowed; box-shadow:none; opacity:0.7;" disabled>
                    <span>Encerrado</span>
                    <i class="fa-solid fa-lock"></i>
                </button>`;
        }

        c.innerHTML += `
            <div class="card-event fade-in" ${esgotado ? 'style="opacity:0.9;"' : ''}>
                ${statusBadge}
                <h3 class="card-title">${ev.titulo}</h3>
                <div class="card-dates">
                    <i class="fa-regular fa-calendar-days"></i> Até ${formatarData(ev.fim)}
                </div>
                ${limite > 0 ? `<p style="font-size:0.8rem; color:#64748b; margin-bottom:10px;"><i class="fa-solid fa-users"></i> ${inscritos} / ${limite} vagas preenchidas</p>` : ''}
                <p class="card-desc">${ev.descricao}</p>
                ${btnHtml}
            </div>`;
    });
}

async function abrirInscricao(evento) {
    document.getElementById('lista-eventos').classList.add('hidden'); 
    document.getElementById('fab-consulta').classList.add('hidden'); 
    document.getElementById('hero-section').classList.add('hidden'); 
    document.getElementById('area-inscricao').classList.remove('hidden');
    
    document.getElementById('titulo-evento').innerText = evento.titulo; 
    document.getElementById('form-inscricao').dataset.idEvento = evento.id;
    
    let config = {}; 
    try { config = typeof evento.config === 'string' ? JSON.parse(evento.config) : evento.config; } catch(e) {}
    document.getElementById('form-inscricao').dataset.config = JSON.stringify(config);

    const areaCampos = document.getElementById('campos-dinamicos'); 
    areaCampos.innerHTML = '';
    
    const areaAvisos = document.getElementById('area-avisos');
    areaAvisos.innerHTML = '';
    
    if(config.mensagemAlerta) {
        areaAvisos.innerHTML += `
            <div class="info-banner" style="background-color:#fff7ed; border-left-color:#f97316; color:#9a3412; padding: 15px; border-left-width: 4px; margin-bottom: 20px;">
                <i class="fa-solid fa-triangle-exclamation"></i> 
                <strong>Atenção:</strong> ${config.mensagemAlerta}
            </div>`;
    }
    
    if(config.observacoesTexto) {
        areaAvisos.innerHTML += `
            <div class="info-banner" style="background-color:#eff6ff; border-left-color:#2563eb; color:#1e40af; padding: 15px; border-left-width: 4px; margin-bottom: 20px;">
                <i class="fa-solid fa-circle-info"></i>
                <strong>Instruções:</strong><br>
                ${config.observacoesTexto.replace(/\n/g, '<br>')}
            </div>
        `;
    }
    
    areaCampos.innerHTML += `
        <div><label>CPF <span style="color:red">*</span></label><input type="text" name="CPF" placeholder="000.000.000-00" required></div>
        <div><label>E-mail <span style="color:red">*</span></label><input type="email" name="Email" placeholder="seu@email.com" required></div>`;

    if(config.camposTexto && config.camposTexto.includes('NomeInstituicao') && listaInstituicoesCache.length === 0) {
        try { 
            toggleLoader(true,"Carregando lista..."); 
            const r = await fetch(`${URL_API}?action=getInstituicoes`); 
            const j = await r.json(); 
            if(j.data) listaInstituicoesCache = j.data; 
        } catch(e){ console.error(e); } finally { toggleLoader(false); }
    }

    if(config.camposTexto) {
        config.camposTexto.forEach(key => {
            if(CAMPO_DEFS[key]) {
                const def = CAMPO_DEFS[key];
                const labelHTML = `<label>${def.label} <span style="color:red">*</span></label>`;
                
                if (key === 'NomeInstituicao' && listaInstituicoesCache.length > 0) {
                    let opt = '<option value="">Selecione...</option>'; 
                    listaInstituicoesCache.forEach(i => opt += `<option value="${i}">${i}</option>`); 
                    opt += `<option value="Outra">Outra (Digitar nome)</option>`;
                    areaCampos.innerHTML += `<div>${labelHTML}<select name="${key}" required onchange="verificarOutraInst(this)">${opt}</select><input type="text" id="input_outra_inst" placeholder="Digite o nome da instituição" style="display:none; margin-top:10px;"></div>`;
                }
                else if (key === 'Cidade') {
                    if (config.cidadesPermitidas && config.cidadesPermitidas.length > 0) {
                        let optCidade = '<option value="">Selecione sua cidade...</option>';
                        config.cidadesPermitidas.forEach(c => optCidade += `<option value="${c}">${c}</option>`);
                        areaCampos.innerHTML += `<div>${labelHTML}<select name="${key}" required>${optCidade}</select></div>`;
                    } else {
                        areaCampos.innerHTML += `<div>${labelHTML}<input type="text" name="${key}" placeholder="${def.placeholder}" required></div>`;
                    }
                }
                else if (key === 'Estado' && def.options) {
                    let optUF = `<option value="">UF</option>`;
                    def.options.forEach(uf => optUF += `<option value="${uf}">${uf}</option>`);
                    areaCampos.innerHTML += `<div>${labelHTML}<select name="${key}" required>${optUF}</select></div>`;
                }
                else {
                    areaCampos.innerHTML += `<div>${labelHTML}<input type="${def.type}" name="${key}" placeholder="${def.placeholder||''}" required></div>`;
                }
            }
        });
    }

    if(config.camposPersonalizados && config.camposPersonalizados.length > 0) {
        areaCampos.innerHTML += `<div style="grid-column:1/-1; margin-top:20px; padding-top:10px; border-top:1px dashed #e2e8f0;"><h4 style="color:var(--primary); font-size:1rem; margin-bottom:15px;">Perguntas Adicionais</h4></div>`;
        config.camposPersonalizados.forEach(p => {
            areaCampos.innerHTML += `<div><label>${p} <span style="color:red">*</span></label><input type="text" name="${p}" required placeholder="Sua resposta"></div>`;
        });
    }

    ativarMascaras();
    
    const df = document.getElementById('div-upload-foto'), dd = document.getElementById('div-upload-doc');
    df.classList.add('hidden'); document.getElementById('file-foto').required = false; previewArquivo({parentElement: df, files: []});
    dd.classList.add('hidden'); document.getElementById('file-doc').required = false; previewArquivo({parentElement: dd, files: []});
    
    if(config.arquivos?.foto) { df.classList.remove('hidden'); document.getElementById('file-foto').required = true; }
    if(config.arquivos?.doc) { dd.classList.remove('hidden'); document.getElementById('file-doc').required = true; }
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

window.verificarOutraInst = function(s) { 
    const i = document.getElementById('input_outra_inst'); 
    if(s.value==='Outra'){ i.style.display='block'; i.required=true; i.focus(); } else { i.style.display='none'; i.required=false; } 
}

async function enviarInscricao(e) {
    e.preventDefault();
    const iCPF = document.querySelector('input[name="CPF"]');
    if(!validarCPF(iCPF.value)) return showError('CPF Inválido', 'Por favor, verifique o CPF digitado.');
    
    const fileDoc = document.getElementById('file-doc');
    if (fileDoc && fileDoc.files.length > 0) {
        const file = fileDoc.files[0];
        if (file.size > 2 * 1024 * 1024) {
            return showError('Arquivo Muito Grande', 'O PDF do comprovante deve ter no máximo 2MB. Por favor, comprima o arquivo e tente novamente.');
        }
    }

    const r = await Swal.fire({ 
        title: 'Confirmar envio?', text: 'Verifique se todos os dados estão corretos.',
        icon: 'question', showCancelButton: true, confirmButtonText: 'Sim, Enviar', confirmButtonColor: '#2563eb'
    });
    if(!r.isConfirmed) return;

    toggleLoader(true, "Enviando seus dados...");
    
    const inputs = document.querySelectorAll('#campos-dinamicos input, #campos-dinamicos select, #campos-dinamicos textarea');
    let dados = {};
    inputs.forEach(i => { 
        if(i.id !== 'input_outra_inst' || i.style.display !== 'none') { dados[i.name] = i.value; }
    });
    if(dados['NomeInstituicao'] === 'Outra') { dados['NomeInstituicao'] = document.getElementById('input_outra_inst').value; }

    const config = JSON.parse(document.getElementById('form-inscricao').dataset.config);
    const arqs = {};
    
    try {
        if(config.arquivos?.foto) { arqs.foto = { data: await comprimirImagem(document.getElementById('file-foto').files[0]), mime: 'image/jpeg' }; }
        if(config.arquivos?.doc) { const f = document.getElementById('file-doc').files[0]; arqs.doc = { data: await toBase64(f), mime: f.type }; }
        
        fetch(URL_API, { 
            method: 'POST', 
            body: JSON.stringify({ action: 'novaInscricao', eventoId: document.getElementById('form-inscricao').dataset.idEvento, campos: dados, arquivos: arqs }) 
        })
        .then(res => res.json())
        .then(j => {
            toggleLoader(false);
            if(j.status === 'success') {
                showSuccess('Inscrição Realizada!', `
                    <div style="text-align:center">
                        <p>Anote sua chave de acesso:</p>
                        <h2 style="color:#2563eb; font-size:2rem; margin:10px 0; letter-spacing:2px; font-family:monospace;">${j.chave}</h2>
                        <p style="font-size:0.9rem; color:#64748b;">Enviamos uma confirmação para seu e-mail.</p>
                    </div>`, 
                    () => { document.getElementById('form-inscricao').reset(); voltarHome(); });
            } else {
                showError('Não foi possível enviar', j.message);
            }
        });
    } catch(err) { 
        toggleLoader(false); showError('Erro Técnico', 'Ocorreu uma falha no envio. Tente novamente.'); 
        console.error(err);
    }
}

// --- CONSULTA E CARTEIRINHA DIGITAL ---
function consultarChave() {
    const c = document.getElementById('busca-chave').value.trim();
    if(!c) return showError('Atenção', 'Digite a chave de acesso.');
    
    const areaResult = document.getElementById('resultado-busca');
    areaResult.innerHTML = '<div style="text-align:center; padding:20px; color:#64748b;"><i class="fa-solid fa-circle-notch fa-spin"></i> Buscando...</div>';
    
    fetch(`${URL_API}?action=consultarInscricao&chave=${c}`)
        .then(r => r.json())
        .then(j => {
            if(j.status === 'success') {
                const situacao = j.data.situacao;
                const aprovado = situacao.includes('Aprovada') || situacao.includes('Emitida');
                
                let cssClass = aprovado ? 'result-success' : 'result-pending';
                let icon = aprovado ? 'fa-circle-check' : 'fa-clock';
                let cor = aprovado ? '#10b981' : '#f59e0b';
                
                let btnCarteirinha = '';
                if (aprovado && j.data.emiteCarteirinha) {
                    j.data.aluno.chave = j.data.chave;
                    btnCarteirinha = `<button class="btn-ver-cart" onclick='abrirCarteirinha(${JSON.stringify(j.data.aluno)})'><i class="fa-solid fa-id-card"></i> Ver Carteirinha Digital</button>`;
                } else if (aprovado) {
                    btnCarteirinha = `<div style="margin-top:10px; font-size:0.8rem; color:#64748b;">* Carteirinha indisponível para este evento.</div>`;
                }

                areaResult.innerHTML = `
                    <div class="result-card ${cssClass}">
                        <h4 style="color:${cor}; margin-bottom:5px; font-size:1.1rem;"><i class="fa-solid ${icon}"></i> ${situacao}</h4>
                        <p style="font-size:0.9rem; color:#334155;">Data: ${formatarData(j.data.data_inscricao)}</p>
                        ${btnCarteirinha}
                    </div>`;
            } else {
                areaResult.innerHTML = `<div class="result-card" style="border-color:#ef4444; background:#fef2f2; color:#b91c1c;"><i class="fa-solid fa-circle-xmark"></i> ${j.message}</div>`;
            }
        })
        .catch(() => areaResult.innerHTML = '<p style="color:red; text-align:center;">Erro na busca.</p>');
}

function abrirCarteirinha(aluno) {
    document.getElementById('cart-nome').innerText = aluno.nome || 'Aluno';
    document.getElementById('cart-inst').innerText = aluno.instituicao || 'Instituição';
    document.getElementById('cart-course').innerText = aluno.curso || 'Curso não informado';
    document.getElementById('cart-cpf').innerText = aluno.cpf || '---';
    document.getElementById('cart-mat').innerText = aluno.matricula || '-';
    
    let nasc = aluno.nascimento || '--/--/----';
    if(nasc.includes('-')) { const p = nasc.split('-'); nasc = `${p[2]}/${p[1]}/${p[0]}`; }
    document.getElementById('cart-nasc').innerText = nasc;

    const img = document.getElementById('cart-img');
    img.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxIiBoZWlnaHQ9IjEiPjxyZWN0IHdpZHRoPSIxIiBoZWlnaHQ9IjEiIGZpbGw9IiNlMmU4ZjAiLz48L3N2Zz4='; 
    if (aluno.foto) {
        if (aluno.foto.startsWith('data:image') || aluno.foto.startsWith('http')) {
             img.src = formatarUrlDrive(aluno.foto);
        }
    }
    img.onerror = function() { this.src = 'https://via.placeholder.com/150?text=FOTO'; };

    if(configSistemaCache) {
        if(configSistemaCache.nomeSistema) document.getElementById('cart-sys-name').innerText = configSistemaCache.nomeSistema.toUpperCase();
        if(configSistemaCache.nomeSecretaria) {
             document.getElementById('cart-sec-name').innerText = configSistemaCache.nomeSecretario || "Responsável";
             document.querySelector('.cart-org-info small').innerText = configSistemaCache.nomeSecretaria;
        }
    }
    
    document.getElementById('cart-validade-ano').innerText = aluno.ano_vigencia || new Date().getFullYear();

    const linkValidacao = `${URL_API}?action=validar&chave=${aluno.chave}`;
    
    const qr = new QRious({
      element: document.getElementById('cart-qrcode-img'), value: linkValidacao,
      size: 150, backgroundAlpha: 0, foreground: 'black'
    });
    document.getElementById('cart-qrcode-img').src = qr.toDataURL();

    document.getElementById('modal-carteirinha').classList.remove('hidden');
    document.getElementById('cart-flip-container').classList.remove('is-flipped');
    fecharModalConsulta();
}

function formatarUrlDrive(url) {
    if (!url) return '';
    if (url.startsWith('data:')) return url;
    let id = '';
    const parts = url.split(/\/d\/|id=/);
    if (parts.length > 1) id = parts[1].split(/\/|&/)[0];
    if (id) return `https://lh3.googleusercontent.com/d/${id}`;
    return url; 
}

function voltarHome() { 
    document.getElementById('area-inscricao').classList.add('hidden'); 
    document.getElementById('fab-consulta').classList.remove('hidden'); 
    document.getElementById('hero-section').classList.remove('hidden'); 
    document.getElementById('lista-eventos').classList.remove('hidden'); 
}

function formatarData(iso) { 
    if(!iso) return '--'; 
    const p = iso.split('T')[0].split('-'); 
    return p.length<3 ? iso : `${p[2]}/${p[1]}/${p[0]}`; 
}

const toBase64 = f => new Promise((r, j) => { 
    const rd = new FileReader(); rd.readAsDataURL(f); 
    rd.onload = () => r(rd.result.split(',')[1]); rd.onerror = e => j(e); 
});
