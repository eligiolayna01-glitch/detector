const video = document.getElementById('webcam');
const canvas = document.getElementById('outputCanvas');
const ctx = canvas.getContext('2d');
const startButton = document.getElementById('startButton');
const stopButton = document.getElementById('stopButton');
const inputText = document.getElementById('inputText');
const statusElem = document.getElementById('status');

let model = undefined;
let streaming = false;
let ultimaDeteccion = ""; // Para evitar que la voz repita lo mismo mil veces

// Diccionario de traducción (Iglés -> Español)
const traducciones = {
    "person": "persona", "bicycle": "bicicleta", "car": "carro", "motorcycle": "moto",
    "airplane": "avión", "bus": "autobús", "train": "tren", "truck": "camión",
    "bird": "pájaro", "cat": "gato", "dog": "perro", "backpack": "mochila", 
    "bottle": "botella", "cup": "taza", "knife": "cuchillo", "spoon": "cuchara", 
    "bowl": "tazón", "chair": "silla", "couch": "sofá", "potted plant": "planta",
    "tv": "televisor", "laptop": "laptop", "mouse": "mouse", "cell phone": "celular",
    "book": "libro", "clock": "reloj", "scissors": "tijeras", "toothbrush": "cepillo de dientes"
    // ... puedes añadir más del diccionario anterior
};

// --- CONFIGURACIÓN DE VOZ (LECTURA) ---
function hablar(texto) {
    if (window.speechSynthesis.speaking) return; // Si ya está hablando, callar
    const mensaje = new SpeechSynthesisUtterance(texto);
    mensaje.lang = 'es-ES';
    mensaje.rate = 1; 
    window.speechSynthesis.speak(mensaje);
}

// --- CONFIGURACIÓN DE ESCUCHA (RECONOCIMIENTO) ---
const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = new Recognition();
recognition.lang = 'es-ES';
recognition.continuous = true;
recognition.interimResults = false;

recognition.onresult = (event) => {
    const comando = event.results[event.results.length - 1][0].transcript.toLowerCase();
    statusElem.textContent = `Escuché: "${comando}"`;
    
    // Si dices "detectar silla", limpia el input y escribe "silla"
    if (comando.includes("detectar")) {
        const objetoABuscar = comando.replace("detectar", "").trim();
        inputText.value = objetoABuscar;
        hablar(`Buscando ${objetoABuscar}`);
    }
};

recognition.onerror = (err) => console.error("Error de reconocimiento:", err);

// --- LÓGICA DE DETECCIÓN ---
async function initIA() {
    statusElem.textContent = "Cargando IA...";
    model = await cocoSsd.load();
    statusElem.textContent = "IA Lista. Di 'Detectar [objeto]'";
}

async function start() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        video.srcObject = stream;
        video.onloadedmetadata = () => {
            video.play();
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            streaming = true;
            startButton.disabled = true;
            stopButton.disabled = false;
            recognition.start(); // Iniciar escucha
            predictLoop();
        };
    } catch (err) {
        statusElem.textContent = "Error: Acceso denegado.";
    }
}

async function predictLoop() {
    if (!streaming) return;
    const predictions = await model.detect(video);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const filtro = inputText.value.toLowerCase().trim();

    predictions.forEach(p => {
        if (p.score > 0.50) {
            const nombreIng = p.class.toLowerCase();
            const nombreEsp = traducciones[nombreIng] || nombreIng;
            
            if (filtro === "" || nombreEsp.includes(filtro) || nombreIng.includes(filtro)) {
                const [x, y, width, height] = p.bbox;
                ctx.strokeStyle = "#00ff88";
                ctx.lineWidth = 3;
                ctx.strokeRect(x, y, width, height);
                ctx.fillStyle = "#00ff88";
                ctx.fillText(nombreEsp.toUpperCase(), x, y > 20 ? y - 10 : 20);

                // --- LÓGICA DE VOZ (Repite solo si es un objeto nuevo) ---
                if (ultimaDeteccion !== nombreEsp) {
                    hablar(`He detectado un ${nombreEsp}`);
                    ultimaDeteccion = nombreEsp;
                    
                    // Limpiar la memoria de voz tras 3 segundos para que pueda volver a avisar
                    setTimeout(() => { ultimaDeteccion = ""; }, 3000);
                }
            }
        }
    });
    requestAnimationFrame(predictLoop);
}

stopButton.onclick = () => {
    streaming = false;
    recognition.stop();
    const stream = video.srcObject;
    if(stream) stream.getTracks().forEach(t => t.stop());
    video.srcObject = null;
    startButton.disabled = false;
    stopButton.disabled = true;
    statusElem.textContent = "Sistema detenido.";
};

startButton.onclick = start;
initIA();