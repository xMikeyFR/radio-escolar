/**
 * RADIO ESCOLAR FM - Solo Voz
 * Panel para OYENTES - Sin login (WebRTC)
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
    // WebRTC
    peerConnection: null,
    audioElement: null, // Elemento <audio> para reproducir stream
    // Flag para saber si el usuario ya interactuó
    userInteracted: false
};

// CONFIGURACIÓN WebRTC
const rtcConfig = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
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
    
    // Crear elemento <audio> para reproducir el stream WebRTC
    state.audioElement = document.createElement('audio');
    state.audioElement.autoplay = true;
    state.audioElement.controls = false;
    state.audioElement.style.display = 'none';
    state.audioElement.volume = state.currentVolume;
    document.body.appendChild(state.audioElement);
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('🎙️ Radio Escolar FM - Panel de Oyentes');
    
    initializeElements();
    setupListenerVisualizer();
    initializeSocket();
    initializeControls();
    loadListeners();
    
    // Marcar interacción del usuario al hacer clic en cualquier parte
    document.addEventListener('click', () => {
        if (!state.userInteracted) {
            state.userInteracted = true;
            console.log('✅ Usuario interactuó - AudioContext puede iniciarse');
        }
    }, { once: true });
    
    // También con cualquier tecla
    document.addEventListener('keydown', () => {
        if (!state.userInteracted) {
            state.userInteracted = true;
            console.log('✅ Usuario interactuó - AudioContext puede iniciarse');
        }
    }, { once: true });
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

        // WebRTC: Cuando hay un locutor disponible
        state.socket.on('broadcaster-ready', () => {
            console.log('📡 Locutor disponible, esperando offer...');
        });

        // WebRTC: Recibir offer del locutor
        state.socket.on('webrtc-offer', async (data) => {
            const { offer, from } = data;
            console.log('📡 Recibido offer del locutor:', from);
            await handleOffer(offer, from);
        });

        // WebRTC: Recibir ICE candidate del locutor
        state.socket.on('webrtc-ice-candidate', async (data) => {
            const { candidate, from } = data;
            if (state.peerConnection) {
                try {
                    await state.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
                    console.log('✅ ICE candidate agregado');
                } catch (error) {
                    console.error('❌ Error al agregar ICE candidate:', error);
                }
            }
        });

    } catch (error) {
        console.error('Error Socket.io:', error);
    }
}

// =============================================
// WebRTC - MANEJAR OFFER Y CREAR ANSWER
// =============================================

async function handleOffer(offer, from) {
    try {
        // Crear RTCPeerConnection si no existe
        if (!state.peerConnection) {
            state.peerConnection = new RTCPeerConnection(rtcConfig);
            
            // Cuando recibimos el stream, asignarlo al elemento <audio>
            state.peerConnection.ontrack = (event) => {
                console.log('🎵 Stream recibido del locutor');
                const stream = event.streams[0];
                
                if (state.audioElement) {
                    state.audioElement.srcObject = stream;
                    state.audioElement.play().catch(err => {
                        console.warn('⚠️ Error al reproducir:', err);
                    });
                    
                    // Conectar al visualizador
                    if (state.audioContext && state.analyser) {
                        try {
                            const source = state.audioContext.createMediaStreamSource(stream);
                            source.connect(state.analyser);
                            state.analyser.connect(state.audioContext.destination);
                            console.log('✅ Stream conectado al visualizador');
                        } catch (e) {
                            console.warn('⚠️ No se pudo conectar al visualizador:', e);
                        }
                    }
                }
            };
            
            // Manejar ICE candidates
            state.peerConnection.onicecandidate = (event) => {
                if (event.candidate) {
                    state.socket.emit('webrtc-ice-candidate', {
                        candidate: event.candidate,
                        to: from
                    });
                }
            };
            
            // Manejar cambios de conexión
            state.peerConnection.onconnectionstatechange = () => {
                console.log('📡 Estado conexión:', state.peerConnection.connectionState);
                if (state.peerConnection.connectionState === 'failed' || 
                    state.peerConnection.connectionState === 'disconnected') {
                    state.peerConnection.close();
                    state.peerConnection = null;
                    if (state.audioElement) {
                        state.audioElement.srcObject = null;
                    }
                }
            };
        }
        
        // Configurar offer remoto
        await state.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        
        // Crear y enviar answer
        const answer = await state.peerConnection.createAnswer();
        await state.peerConnection.setLocalDescription(answer);
        
        state.socket.emit('webrtc-answer', {
            answer: answer,
            to: from
        });
        
        console.log('✅ Answer creado y enviado');
        
    } catch (error) {
        console.error('❌ Error al manejar offer:', error);
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
        elements.volumeSlider.addEventListener('input', (e) => {
            state.userInteracted = true;
            handleVolumeChange(e);
        });
    }
    if (elements.muteBtn) {
        elements.muteBtn.addEventListener('click', () => {
            state.userInteracted = true;
            toggleMute();
        });
    }
}

function handleVolumeChange(e) {
    const volume = e.target.value / 100;
    state.currentVolume = volume;
    if (elements.volumeValue) {
        elements.volumeValue.textContent = `${e.target.value}%`;
    }
    updateVolumeIcon(volume);

    if (state.audioElement) {
        state.audioElement.volume = volume;
    }

    if (volume > 0) {
        state.isMuted = false;
    }
}

function toggleMute() {
    state.isMuted = !state.isMuted;

    if (state.isMuted) {
        if (state.audioElement) {
            state.audioElement.volume = 0;
        }
        if (elements.volumeSlider) {
            elements.volumeSlider.value = 0;
        }
        if (elements.volumeValue) {
            elements.volumeValue.textContent = '0%';
        }
    } else {
        if (state.audioElement) {
            state.audioElement.volume = state.currentVolume;
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
