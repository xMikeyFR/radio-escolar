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
    voiceStreamSource: null,
    // Buffer para audio
    audioQueue: []
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
            handleVoiceStart();
        });

        state.socket.on('voice-data', (data) => {
            handleVoiceData(data);
        });

        state.socket.on('voice-end', () => {
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
// REPRODUCCIÓN DE VOZ (OYENTES)
// =============================================

function handleVoiceStart() {
    console.log('👂 Alguien está hablando');
    
    if (!state.voiceAudioContext) {
        state.voiceAudioContext = new (window.AudioContext || window.webkitAudioContext)();
        state.voiceGainNode = state.voiceAudioContext.createGain();
        state.voiceGainNode.gain.value = state.currentVolume;
        state.voiceGainNode.connect(state.voiceAudioContext.destination);
    }

    if (state.voiceAudioContext.state === 'suspended') {
        state.voiceAudioContext.resume().catch(err => {
            console.warn('⚠️ No se pudo reanudar AudioContext:', err);
        });
    }
    
    state.audioQueue = [];
}

async function handleVoiceData(data) {
    if (!data.audio || !state.voiceAudioContext) return;

    try {
        if (state.voiceAudioContext.state === 'suspended') {
            await state.voiceAudioContext.resume();
        }

        const audioData = new Uint8Array(data.audio);
        const audioBlob = new Blob([audioData], { 
            type: data.mimeType || 'audio/webm;codecs=opus' 
        });
        
        // Método 1: Web Audio API (más confiable)
        try {
            const arrayBuffer = await audioBlob.arrayBuffer();
            const audioBuffer = await state.voiceAudioContext.decodeAudioData(arrayBuffer);
            const source = state.voiceAudioContext.createBufferSource();
            source.buffer = audioBuffer;
            
            // Conectar al gain node para reproducir
            source.connect(state.voiceGainNode);
            
            // Conectar también al visualizador si está disponible
            if (state.audioContext && state.analyser) {
                // Crear un gain node intermedio para el visualizador
                const analyserGain = state.voiceAudioContext.createGain();
                source.connect(analyserGain);
                analyserGain.connect(state.analyser);
            }
            
            source.start(0);
            
            source.onended = () => {
                source.disconnect();
            };
        } catch (decodeError) {
            // Método 2: Audio Element (fallback)
            const blobUrl = URL.createObjectURL(audioBlob);
            const audioElement = new Audio(blobUrl);
            audioElement.volume = state.currentVolume;
            
            // Conectar al visualizador usando MediaElementSource
            if (state.audioContext && state.analyser) {
                try {
                    // Solo crear una conexión si no existe ya
                    if (!state.voiceStreamSource) {
                        const source = state.audioContext.createMediaElementSource(audioElement);
                        source.connect(state.analyser);
                        state.analyser.connect(state.audioContext.destination);
                        state.voiceStreamSource = source;
                    }
                } catch (e) {
                    // Si falla (ya hay conexión), solo reproducir
                }
            }
            
            audioElement.play().catch(err => {
                console.warn('⚠️ Error al reproducir:', err);
            });
            
            audioElement.addEventListener('ended', () => {
                URL.revokeObjectURL(blobUrl);
            });
        }

    } catch (error) {
        console.warn('⚠️ Error al reproducir audio:', error);
    }
}

function handleVoiceEnd() {
    console.log('👂 Nadie está hablando');
    state.audioQueue = [];
    
    // Limpiar conexión del visualizador
    if (state.voiceStreamSource) {
        try {
            state.voiceStreamSource.disconnect();
            state.voiceStreamSource = null;
        } catch (e) {
            // Ignorar errores de desconexión
        }
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

console.log('✅ Radio Escolar FM - Panel de Oyentes cargado');
