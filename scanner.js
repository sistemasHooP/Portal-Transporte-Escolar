const URL_API = 'https://script.google.com/macros/s/AKfycbx6wAwfQyfLbp4IPedWu8KyGrJAM_2Ocq9edgQ5M2oxf8egOi87jeF6AjMjaRyH6W4wnA/exec';

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
    // Verifica se está em ambiente seguro
    if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
        Swal.fire({
            icon: 'warning',
            title: 'Segurança',
            text: 'O acesso à câmera requer HTTPS.',
            confirmButtonColor: '#f59e0b'
        });
        return;
    }

    html5QrCode = new Html5Qrcode("reader");

    // CONFIGURAÇÃO DE ALTA PERFORMANCE (IOS & ANDROID)
    const config = { 
        // 15 FPS é o ideal para Web. Mais que isso engasga o processador do iPhone no navegador.
        fps: 15, 
        // OTIMIZAÇÃO CRÍTICA: Procura APENAS QR Codes, ignora códigos de barra (acelera muito)
        formatsToSupport: [ Html5QrcodeSupportedFormats.QR_CODE ],
        qrbox: (viewfinderWidth, viewfinderHeight) => {
            const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
            return {
                width: Math.floor(minEdge * 0.70),
                height: Math.floor(minEdge * 0.70)
            };
        },
        aspectRatio: 1.0,
        experimentalFeatures: {
            useBarCodeDetectorIfSupported: true
        }
    };

    // Lista câmeras antes de iniciar
    Html5Qrcode.getCameras().then(devices => {
        if (devices && devices.length) {
            let cameraId = devices[0].id; 
            
            // Lógica para encontrar câmera traseira
            if (devices.length > 1) {
                const backCamera = devices.find(device => 
                    device.label.toLowerCase().includes('back') || 
                    device.label.toLowerCase().includes('traseira') ||
                    device.label.toLowerCase().includes('environment')
                );
                if (backCamera) {
                    cameraId = backCamera.id;
                } else {
                    cameraId = devices[devices.length - 1].id;
                }
            }

            // OTIMIZAÇÃO DE VÍDEO: Solicita resolução HD (720p) ou VGA (480p)
            // Processar 4K no navegador é o que causa a lentidão no iPhone.
            const cameraConfig = {
                deviceId: { exact: cameraId },
                videoConstraints: {
                    width: { min: 640, ideal: 720, max: 1280 },
                    height: { min: 480, ideal: 720, max: 1280 },
                    facingMode: "environment",
                    focusMode: "continuous"
                }
            };

            // Inicia com ID específico e configurações de vídeo travadas
            html5QrCode.start(
                cameraId, // Usa o ID encontrado
                config, 
                onScanSuccess, 
                onScanFailure
            ).catch(err => {
                console.warn("Falha ao iniciar com ID, tentando modo genérico...", err);
                // Fallback para modo simples se a configuração avançada falhar
                startGenericCamera(config);
            });

        } else {
            Swal.fire({ icon: 'error', title: 'Sem Câmera', text: 'Nenhuma câmera detectada.' });
        }
    }).catch(err => {
        console.error("Erro geral:", err);
        startGenericCamera(config); // Tenta forçar o início mesmo sem listar
    });
}

function startGenericCamera(config) {
    // Modo de compatibilidade máxima
    html5QrCode.start(
        { facingMode: "environment" }, 
        config, 
        onScanSuccess, 
        onScanFailure
    ).catch(err => {
        tratarErroCamera(err);
    });
}

function tratarErroCamera(err) {
    let msg = 'Não foi possível acessar a câmera.';
    const erroStr = err.toString().toLowerCase();

    if (erroStr.includes('notallowederror') || erroStr.includes('permission denied')) {
        msg = 'Permissão negada. Clique no cadeado/Aa na barra de endereço para liberar.';
    } else if (erroStr.includes('notreadableerror')) {
        msg = 'A câmera está sendo usada por outro app. Feche tudo e tente novamente.';
    }

    Swal.fire({
        icon: 'error',
        title: 'Erro de Câmera',
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
    // Silencioso para performance
}

function processarChave(chave) {
    isProcessing = true;
    html5QrCode.pause(true); 

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
                exibirErro("Não Encontrado", "Chave inválida.");
            }
        })
        .catch(err => {
            loader.classList.add('hidden');
            exibirErro("Erro de Conexão", "Tente novamente.");
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

