const URL_API = 'https://script.google.com/macros/s/AKfycby-rnmBcploCmdEb8QWkMyo1tEanCcPkmNOA_QMlujH0XQvjLeiCCYhkqe7Hqhi6-mo8A/exec';

// Variáveis de Controle
let html5QrCode;
let isProcessing = false;

// Sons
const audioBeep = document.getElementById('audio-beep');
const audioError = document.getElementById('audio-error');

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    iniciarLeitor();
});

function iniciarLeitor() {
    // Verifica se está em ambiente seguro (HTTPS ou Localhost) - Obrigatório para Câmera
    if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
        Swal.fire({
            icon: 'warning',
            title: 'Segurança',
            text: 'O acesso à câmera requer HTTPS. Verifique se o site possui o cadeado de segurança.',
            confirmButtonColor: '#f59e0b'
        });
        return;
    }

    html5QrCode = new Html5Qrcode("reader");

    const config = { 
        fps: 25, 
        qrbox: (viewfinderWidth, viewfinderHeight) => {
            const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
            return {
                width: Math.floor(minEdge * 0.75),
                height: Math.floor(minEdge * 0.75)
            };
        },
        aspectRatio: 1.0
    };

    // NOVA LÓGICA ROBUSTA: Lista câmeras antes de iniciar
    Html5Qrcode.getCameras().then(devices => {
        if (devices && devices.length) {
            let cameraId = devices[0].id; // Padrão: primeira câmera encontrada
            
            // Tenta encontrar a câmera traseira inteligentemente
            // Geralmente em celulares a traseira é a última da lista ou tem 'back' no nome
            if (devices.length > 1) {
                const backCamera = devices.find(device => 
                    device.label.toLowerCase().includes('back') || 
                    device.label.toLowerCase().includes('traseira') ||
                    device.label.toLowerCase().includes('environment')
                );
                
                if (backCamera) {
                    cameraId = backCamera.id;
                } else {
                    // Se não achar pelo nome, tenta a última da lista (comum em Android)
                    cameraId = devices[devices.length - 1].id;
                }
            }

            // Inicia o leitor com a câmera específica (ID)
            html5QrCode.start(
                cameraId, 
                config, 
                onScanSuccess, 
                onScanFailure
            ).catch(err => {
                console.error("Erro ao iniciar com ID:", err);
                // Fallback: Tenta iniciar com modo genérico se o ID falhar
                startGenericCamera(config);
            });

        } else {
            Swal.fire({
                icon: 'error',
                title: 'Sem Câmera',
                text: 'Nenhuma câmera foi detectada neste dispositivo.',
                confirmButtonColor: '#dc2626'
            });
        }
    }).catch(err => {
        // Erro ao pedir permissão ou listar dispositivos
        console.error("Erro de permissão/listagem:", err);
        tratarErroCamera(err);
    });
}

function startGenericCamera(config) {
    html5QrCode.start(
        { facingMode: "environment" }, 
        config, 
        onScanSuccess, 
        onScanFailure
    ).catch(err => {
        console.error("Erro genérico:", err);
        tratarErroCamera(err);
    });
}

function tratarErroCamera(err) {
    let titulo = 'Erro de Câmera';
    let msg = 'Não foi possível acessar a câmera.';
    
    const erroStr = err.toString().toLowerCase();

    if (erroStr.includes('notallowederror') || erroStr.includes('permission denied')) {
        msg = 'Permissão negada. Por favor, clique no ícone de cadeado/câmera na barra de endereço e permita o acesso.';
    } else if (erroStr.includes('notfounderror')) {
        msg = 'Nenhuma câmera encontrada no dispositivo.';
    } else if (erroStr.includes('notreadableerror') || erroStr.includes('trackstarterror')) {
        msg = 'A câmera está sendo usada por outro aplicativo ou aba. Feche outros apps e tente novamente.';
    } else if (erroStr.includes('overconstrainederror')) {
        msg = 'A câmera não suporta a resolução solicitada.';
    }

    Swal.fire({
        icon: 'error',
        title: titulo,
        text: msg,
        confirmButtonColor: '#dc2626'
    });
}

function onScanSuccess(decodedText, decodedResult) {
    if (isProcessing) return; 

    let chave = "";
    try {
        if (decodedText.includes("chave=")) {
            const url = new URL(decodedText);
            chave = url.searchParams.get("chave");
        } else {
            chave = decodedText.trim();
        }
    } catch (e) {
        chave = decodedText.trim();
    }

    if (chave && chave.length >= 4) {
        processarChave(chave);
    }
}

function onScanFailure(error) {
    // console.warn(`Erro frame: ${error}`);
}

function processarChave(chave) {
    isProcessing = true;
    html5QrCode.pause(true); // Pausa visualmente e logicamente

    const painel = document.getElementById('result-panel');
    const loader = document.getElementById('validating-loader');
    const successDiv = document.getElementById('result-success');
    const errorDiv = document.getElementById('result-error');

    painel.classList.remove('hidden');
    loader.classList.remove('hidden');
    successDiv.classList.add('hidden');
    errorDiv.classList.add('hidden');

    fetch(`${URL_API}?action=consultarInscricao&chave=${chave}`)
        .then(response => response.json())
        .then(json => {
            loader.classList.add('hidden');

            if (json.status === 'success') {
                const dados = json.data;
                const aluno = dados.aluno;
                const status = dados.situacao;

                if (status === 'Aprovada' || status === 'Ficha Emitida') {
                    exibirSucesso(aluno);
                } else {
                    exibirErro("Acesso Negado", `Situação: ${status}`);
                }
            } else {
                exibirErro("Não Encontrado", "Chave inválida ou inexistente.");
            }
        })
        .catch(err => {
            console.error(err);
            loader.classList.add('hidden');
            exibirErro("Erro de Conexão", "Falha ao verificar. Tente novamente.");
        });
}

function exibirSucesso(aluno) {
    const successDiv = document.getElementById('result-success');
    
    document.getElementById('student-name').innerText = aluno.nome || "Aluno";
    document.getElementById('student-course').innerText = `${aluno.curso || ''}`;
    document.getElementById('student-validity').innerText = aluno.ano_vigencia || new Date().getFullYear();
    
    const img = document.getElementById('student-photo');
    if (aluno.foto) {
        img.src = formatarUrlDrive(aluno.foto);
    } else {
        img.src = 'https://via.placeholder.com/150?text=FOTO';
    }

    playAudio(audioBeep);
    successDiv.classList.remove('hidden');
}

function exibirErro(titulo, mensagem) {
    const errorDiv = document.getElementById('result-error');
    document.getElementById('error-title').innerText = titulo;
    document.getElementById('error-msg').innerText = mensagem;
    playAudio(audioError);
    errorDiv.classList.remove('hidden');
}

function reiniciarLeitura() {
    document.getElementById('result-panel').classList.add('hidden');
    
    setTimeout(() => {
        document.getElementById('result-success').classList.add('hidden');
        document.getElementById('result-error').classList.add('hidden');
        isProcessing = false;
        html5QrCode.resume(); 
    }, 300);
}

function playAudio(audioElement) {
    try {
        audioElement.currentTime = 0;
        audioElement.play().catch(e => console.log("Autoplay bloqueado:", e));
    } catch (e) {}
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
