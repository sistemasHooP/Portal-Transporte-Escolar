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
    // Configura o leitor para usar a div "reader"
    html5QrCode = new Html5Qrcode("reader");

    const config = { 
        fps: 10, 
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0
    };

    // Tenta usar a câmera traseira (environment)
    html5QrCode.start(
        { facingMode: "environment" }, 
        config, 
        onScanSuccess, 
        onScanFailure
    ).catch(err => {
        console.error("Erro ao iniciar câmera:", err);
        Swal.fire({
            icon: 'error',
            title: 'Erro de Câmera',
            text: 'Não foi possível acessar a câmera. Verifique as permissões.',
            confirmButtonColor: '#dc2626'
        });
    });
}

function onScanSuccess(decodedText, decodedResult) {
    if (isProcessing) return; // Evita leituras duplicadas enquanto processa

    // Tenta extrair a chave da URL (formato: ...exec?action=validar&chave=XXXX)
    let chave = "";
    
    try {
        if (decodedText.includes("chave=")) {
            const url = new URL(decodedText);
            chave = url.searchParams.get("chave");
        } else {
            // Se for apenas o código puro (sem URL)
            chave = decodedText.trim();
        }
    } catch (e) {
        // Fallback para texto simples se não for URL válida
        chave = decodedText.trim();
    }

    if (chave && chave.length >= 4) {
        processarChave(chave);
    }
}

function onScanFailure(error) {
    // console.warn(`Erro de leitura: ${error}`);
    // Não fazemos nada aqui para não poluir o console, pois erros de frame são comuns
}

function processarChave(chave) {
    isProcessing = true;
    html5QrCode.pause(); // Pausa a câmera para economizar bateria e evitar conflito

    // UI: Mostrar painel carregando
    const painel = document.getElementById('result-panel');
    const loader = document.getElementById('validating-loader');
    const successDiv = document.getElementById('result-success');
    const errorDiv = document.getElementById('result-error');

    painel.classList.remove('hidden');
    loader.classList.remove('hidden');
    successDiv.classList.add('hidden');
    errorDiv.classList.add('hidden');

    // Consulta API
    fetch(`${URL_API}?action=consultarInscricao&chave=${chave}`)
        .then(response => response.json())
        .then(json => {
            loader.classList.add('hidden');

            if (json.status === 'success') {
                const dados = json.data;
                const aluno = dados.aluno;
                const status = dados.situacao;

                // Verifica se está aprovado
                if (status === 'Aprovada' || status === 'Ficha Emitida') {
                    exibirSucesso(aluno);
                } else {
                    exibirErro("Status Inválido", `A situação atual é: ${status}`);
                }
            } else {
                exibirErro("Não Encontrado", "Chave inválida ou aluno não cadastrado.");
            }
        })
        .catch(err => {
            console.error(err);
            loader.classList.add('hidden');
            exibirErro("Erro de Conexão", "Falha ao verificar dados. Tente novamente.");
        });
}

function exibirSucesso(aluno) {
    const successDiv = document.getElementById('result-success');
    
    // Preencher dados
    document.getElementById('student-name').innerText = aluno.nome || "Aluno";
    document.getElementById('student-course').innerText = `${aluno.curso || ''} - ${aluno.instituicao || ''}`;
    document.getElementById('student-validity').innerText = aluno.ano_vigencia || new Date().getFullYear();
    
    // Foto
    const img = document.getElementById('student-photo');
    if (aluno.foto) {
        img.src = formatarUrlDrive(aluno.foto);
    } else {
        img.src = 'https://via.placeholder.com/150?text=FOTO';
    }

    // Tocar som e mostrar
    playAudio(audioBeep);
    successDiv.classList.remove('hidden');
}

function exibirErro(titulo, mensagem) {
    const errorDiv = document.getElementById('result-error');
    
    document.getElementById('error-title').innerText = titulo;
    document.getElementById('error-msg').innerText = mensagem;

    // Tocar som e mostrar
    playAudio(audioError);
    errorDiv.classList.remove('hidden');
}

function reiniciarLeitura() {
    // Esconde o painel (desliza para baixo)
    document.getElementById('result-panel').classList.add('hidden');
    
    // Reseta estados internos
    setTimeout(() => {
        document.getElementById('result-success').classList.add('hidden');
        document.getElementById('result-error').classList.add('hidden');
        isProcessing = false;
        
        // Retoma a câmera
        html5QrCode.resume(); 
    }, 300); // Aguarda a animação CSS terminar
}

function playAudio(audioElement) {
    try {
        audioElement.currentTime = 0;
        audioElement.play().catch(e => console.log("Autoplay bloqueado pelo navegador", e));
    } catch (e) {}
}

// Helper para formatar URL do Drive (mesmo do app.js)
function formatarUrlDrive(url) {
    if (!url) return '';
    if (url.startsWith('data:')) return url;
    let id = '';
    const parts = url.split(/\/d\/|id=/);
    if (parts.length > 1) id = parts[1].split(/\/|&/)[0];
    if (id) return `https://lh3.googleusercontent.com/d/${id}`;
    return url; 
}