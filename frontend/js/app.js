/**
 * RADIO ESCOLAR FM - Solo Voz
 * Panel para OYENTES - Sin login
 */

// CONFIGURACIÓN
const API_BASE_URL = window.location.origin;
const SOCKET_URL = window.location.origin;

// ELEMENTOS DEL DOM
let elements = {};

// ESTADO
let state = {
    currentVolume: 0.75,
    isMuted: false,
    socket: null,
    // Audio para visualizador (voz recibida)
    audioContext: null,
    analyser: null,
    // Audio para reproducir voz recibida
    voiceAudioContext: null,
    voiceGainNode: null,
    voiceAudioElement: null, // Elemento audio para reproducir
    // Buffer para acumular chunks de audio
    audioChunks: [],
    isReceivingAudio: false,
    currentAudioBlob: null,
    audioQueue: [] // Cola de elementos audio para reproducir en secuencia
};

// INICIALIZACIÓN
function initializeElements() {
    elements = {
        volumeSlider: document.getElementById('volumeSlider'),
        volumeValue: document.getElementById('volumeValue'),
        muteBtn: document.getElementById('muteBtn'),
        visualizer: document.getElementById('visualizer'),
        listenersCount: document.getElementById('listenersCount')
    };
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('🎙️ Radio Escolar FM - Panel de Oyentes');
    
    initializeElements();
    setupListenerVisualizer();
    initializeSocket();
    initializeControls();
    loadListeners();
});

// =============================================
// SOCKET.IO - TIEMPO REAL
// =============================================

function initializeSocket() {
    try {
        state.socket = io(SOCKET_URL);

        state.socket.on('connect', () => {
            console.log('✅ Conectado al servidor');
        });

        state.socket.on('listeners-update', (data) => {
            if (elements.listenersCount) {
                elements.listenersCount.textContent = data.count;
            }
        });

        state.socket.on('voice-start', () => {
            console.log('📡 Recibido voice-start');
            handleVoiceStart();
        });

        state.socket.on('voice-data', (data) => {
            console.log('📡 Recibido voice-data, tamaño:', data.audio ? data.audio.length : 0);
            handleVoiceData(data);
        });

        state.socket.on('voice-end', () => {
            console.log('📡 Recibido voice-end');
            handleVoiceEnd();
        });

    } catch (error) {
        console.error('Error Socket.io:', error);
    }
}

// =============================================
// VISUALIZADOR PARA OYENTES
// =============================================

function setupListenerVisualizer() {
    if (!elements.visualizer) return;

    try {
        state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        state.analyser = state.audioContext.createAnalyser();
        state.analyser.fftSize = 128;
        state.analyser.smoothingTimeConstant = 0.8;
        drawVisualizer();
    } catch (e) {
        console.log("AudioContext no soportado:", e);
    }
}

function drawVisualizer() {
    if (!state.analyser || !elements.visualizer) return;

    const canvas = elements.visualizer;
    const ctx = canvas.getContext('2d');
    const bufferLength = state.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    function renderFrame() {
        requestAnimationFrame(renderFrame);

        if (!state.analyser) return;

        state.analyser.getByteFrequencyData(dataArray);
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const barWidth = (canvas.width / bufferLength) * 2.5;
        let barHeight;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
            barHeight = (dataArray[i] / 255) * canvas.height;
            ctx.fillStyle = '#4a90e2';

            if (ctx.roundRect) {
                ctx.beginPath();
                ctx.roundRect(x, canvas.height - barHeight, barWidth - 2, barHeight, [2, 2, 0, 0]);
                ctx.fill();
            } else {
                ctx.fillRect(x, canvas.height - barHeight, barWidth - 2, barHeight);
            }

            x += barWidth + 1;
        }
    }

    renderFrame();
}

// =============================================
// CONTROLES
// =============================================

function initializeControls() {
    if (elements.volumeSlider) {
        elements.volumeSlider.addEventListener('input', handleVolumeChange);
    }
    if (elements.muteBtn) {
        elements.muteBtn.addEventListener('click', toggleMute);
    }
}

function handleVolumeChange(e) {
    const volume = e.target.value / 100;
    state.currentVolume = volume;
    if (elements.volumeValue) {
        elements.volumeValue.textContent = `${e.target.value}%`;
    }
    updateVolumeIcon(volume);

    if (state.voiceGainNode) {
        state.voiceGainNode.gain.value = volume;
    }
    
    // Actualizar volumen de todos los elementos audio en cola
    state.audioQueue.forEach(audio => {
        if (audio && !audio.ended) {
            audio.volume = volume;
        }
    });

    if (volume > 0) {
        state.isMuted = false;
    }
}

function toggleMute() {
    state.isMuted = !state.isMuted;

    if (state.isMuted) {
        if (state.voiceGainNode) {
            state.voiceGainNode.gain.value = 0;
        }
        state.audioQueue.forEach(audio => {
            if (audio && !audio.ended) {
                audio.volume = 0;
            }
        });
        if (elements.volumeSlider) {
            elements.volumeSlider.value = 0;
        }
        if (elements.volumeValue) {
            elements.volumeValue.textContent = '0%';
        }
    } else {
        if (state.voiceGainNode) {
            state.voiceGainNode.gain.value = state.currentVolume;
        }
        state.audioQueue.forEach(audio => {
            if (audio && !audio.ended) {
                audio.volume = state.currentVolume;
            }
        });
        if (elements.volumeSlider) {
            elements.volumeSlider.value = state.currentVolume * 100;
        }
        if (elements.volumeValue) {
            elements.volumeValue.textContent = `${Math.round(state.currentVolume * 100)}%`;
        }
    }

    updateVolumeIcon(state.isMuted ? 0 : state.currentVolume);
}

function updateVolumeIcon(volume) {
    if (!elements.muteBtn) return;
    const icon = elements.muteBtn.querySelector('i');
    if (!icon) return;
    
    icon.className = 'fas';

    if (volume === 0) {
        icon.classList.add('fa-volume-xmark');
    } else if (volume < 0.3) {
        icon.classList.add('fa-volume-off');
    } else if (volume < 0.7) {
        icon.classList.add('fa-volume-low');
    } else {
        icon.classList.add('fa-volume-high');
    }
}

// =============================================
// REPRODUCCIÓN DE VOZ (OYENTES) - MÉTODO MEJORADO
// =============================================

function handleVoiceStart() {
    console.log('👂 Alguien está hablando - Iniciando reproducción');
    
    // Inicializar AudioContext para oyentes SIEMPRE
    if (!state.voiceAudioContext) {
        console.log('🔧 Inicializando voiceAudioContext...');
        state.voiceAudioContext = new (window.AudioContext || window.webkitAudioContext)();
        state.voiceGainNode = state.voiceAudioContext.createGain();
        state.voiceGainNode.gain.value = state.currentVolume;
        state.voiceGainNode.connect(state.voiceAudioContext.destination);
        console.log('✅ voiceAudioContext inicializado');
    }

    if (state.voiceAudioContext.state === 'suspended') {
        state.voiceAudioContext.resume().catch(err => {
            console.warn('⚠️ No se pudo reanudar AudioContext:', err);
        });
    }
    
    // Limpiar buffer y empezar a recibir
    state.audioChunks = [];
    state.isReceivingAudio = true;
    state.audioQueue = [];
    
    console.log('✅ Estado de recepción activado:', {
        hasContext: !!state.voiceAudioContext,
        isReceiving: state.isReceivingAudio,
        contextState: state.voiceAudioContext ? state.voiceAudioContext.state : 'null'
    });
}

async function handleVoiceData(data) {
    // Si no hay contexto o no está recibiendo, inicializar automáticamente
    if (!state.voiceAudioContext || !state.isReceivingAudio) {
        console.log('⚠️ Contexto no inicializado o no está recibiendo, inicializando ahora...');
        handleVoiceStart();
    }
    
    if (!data.audio) {
        console.warn('⚠️ No hay datos de audio en el chunk');
        return;
    }
    
    if (!state.voiceAudioContext) {
        console.error('❌ No se pudo inicializar voiceAudioContext');
        return;
    }
    
    if (!state.isReceivingAudio) {
        console.warn('⚠️ isReceivingAudio es false, activando...');
        state.isReceivingAudio = true;
    }

    try {
        if (state.voiceAudioContext.state === 'suspended') {
            await state.voiceAudioContext.resume();
        }

        // Crear blob con el chunk individual
        const chunk = new Uint8Array(data.audio);
        const audioBlob = new Blob([chunk], { 
            type: data.mimeType || 'audio/webm;codecs=opus' 
        });
        
        // Crear elemento Audio para cada chunk y reproducir en secuencia
        const blobUrl = URL.createObjectURL(audioBlob);
        const audioElement = new Audio(blobUrl);
        audioElement.volume = state.currentVolume;
        
        // Agregar a la cola
        state.audioQueue.push(audioElement);
        
        // Conectar al visualizador (solo el primer elemento)
        if (state.audioQueue.length === 1 && state.audioContext && state.analyser) {
            try {
                const source = state.audioContext.createMediaElementSource(audioElement);
                source.connect(state.analyser);
                state.analyser.connect(state.audioContext.destination);
            } catch (e) {
                console.warn('⚠️ No se pudo conectar al visualizador:', e);
            }
        }
        
        // Reproducir cuando el anterior termine o si es el primero
        if (state.audioQueue.length === 1) {
            // Primer elemento, reproducir inmediatamente
            audioElement.play().catch(err => {
                console.warn('⚠️ Error al reproducir audio:', err);
            });
        } else {
            // Esperar a que el anterior termine
            const previousAudio = state.audioQueue[state.audioQueue.length - 2];
            previousAudio.addEventListener('ended', () => {
                audioElement.play().catch(err => {
                    console.warn('⚠️ Error al reproducir audio:', err);
                });
            }, { once: true });
        }
        
        // Limpiar URL cuando termine
        audioElement.addEventListener('ended', () => {
            URL.revokeObjectURL(blobUrl);
            // Remover de la cola
            const index = state.audioQueue.indexOf(audioElement);
            if (index > -1) {
                state.audioQueue.splice(index, 1);
            }
        }, { once: true });
        
        // También intentar con Web Audio API como método alternativo
        try {
            const arrayBuffer = await audioBlob.arrayBuffer();
            const audioBuffer = await state.voiceAudioContext.decodeAudioData(arrayBuffer);
            const source = state.voiceAudioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(state.voiceGainNode);
            source.start(0);
            
            // Conectar al visualizador también
            if (state.audioContext && state.analyser) {
                const analyserGain = state.voiceAudioContext.createGain();
                source.connect(analyserGain);
                analyserGain.connect(state.analyser);
            }
            
            source.onended = () => {
                source.disconnect();
            };
        } catch (decodeError) {
            // Si falla decodeAudioData, usar solo el método del Audio Element
            // Esto es normal para chunks WebM parciales
        }

    } catch (error) {
        console.warn('⚠️ Error al reproducir audio:', error);
    }
}

function handleVoiceEnd() {
    console.log('👂 Nadie está hablando - Deteniendo reproducción');
    
    state.isReceivingAudio = false;
    state.audioChunks = [];
    
    // Limpiar cola de audio
    state.audioQueue.forEach(audio => {
        if (audio && !audio.ended) {
            audio.pause();
            audio.src = '';
        }
    });
    state.audioQueue = [];
    
    // Limpiar blob URL
    if (state.currentAudioBlob) {
        URL.revokeObjectURL(state.currentAudioBlob);
        state.currentAudioBlob = null;
    }
}

// =============================================
// CARGAR DATOS
// =============================================

async function loadListeners() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/listeners`);
        const data = await response.json();
        if (data.success && elements.listenersCount) {
            elements.listenersCount.textContent = data.data.count;
        }
    } catch (error) {
        console.error('Error al cargar oyentes:', error);
    }
}

console.log(' Radio Escolar FM - Panel de Oyentes cargado');
