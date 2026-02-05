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
    userInteracted: false,
    // Stream recibido pero aún no reproducido (esperando interacción)
    pendingStream: null
};

// CONFIGURACIÓN WebRTC
// CRÍTICO PARA MÓVILES: Agregar TURN server para Android (NATs restrictivos)
const rtcConfig = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        // TURN server gratuito para móviles (Android especialmente)
        {
            urls: 'turn:openrelay.metered.ca:80',
            username: 'openrelayproject',
            credential: 'openrelayproject'
        },
        {
            urls: 'turn:openrelay.metered.ca:443',
            username: 'openrelayproject',
            credential: 'openrelayproject'
        },
        {
            urls: 'turn:openrelay.metered.ca:443?transport=tcp',
            username: 'openrelayproject',
            credential: 'openrelayproject'
        }
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
    state.audioElement.autoplay = false; // NO autoplay - esperar interacción del usuario
    state.audioElement.controls = false;
    // CRÍTICO PARA MÓVILES: Atributos necesarios para Android/iOS
    state.audioElement.playsInline = true; // Para iOS
    state.audioElement.setAttribute('playsinline', 'true'); // Compatibilidad
    state.audioElement.setAttribute('webkit-playsinline', 'true'); // iOS antiguo
    state.audioElement.muted = true; // Inicialmente muted (requerido en móviles)
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
    
    // Marcar interacción del usuario al hacer clic en cualquier parte (desktop)
    document.addEventListener('click', handleUserInteraction, { once: true });
    
    // También con cualquier tecla (desktop)
    document.addEventListener('keydown', handleUserInteraction, { once: true });
    
    // CRÍTICO PARA MÓVILES: Eventos touch (más confiables en Android/iOS)
    document.addEventListener('touchstart', handleUserInteraction, { once: true, passive: true });
    document.addEventListener('touchend', handleUserInteraction, { once: true, passive: true });
    
    // Función para manejar la interacción del usuario
    function handleUserInteraction() {
        if (!state.userInteracted) {
            state.userInteracted = true;
            console.log('✅ Usuario interactuó - AudioContext puede iniciarse');
            
            // Reanudar AudioContext si está suspendido
            if (state.audioContext && state.audioContext.state === 'suspended') {
                state.audioContext.resume().then(() => {
                    console.log('✅ AudioContext reanudado');
                }).catch(err => {
                    console.warn('⚠️ Error al reanudar AudioContext:', err);
                });
            }
            
            // Si hay un stream pendiente, intentar reproducirlo
            if (state.pendingStream) {
                playPendingStream();
            }
        }
    }
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
            // CRÍTICO: Si ya hay una conexión pero no hay stream, limpiar y esperar nuevo offer
            if (state.peerConnection && !state.audioElement.srcObject) {
                console.log('🔄 Limpiando conexión anterior sin stream...');
                state.peerConnection.close();
                state.peerConnection = null;
            }
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
                
                if (!stream) {
                    console.error('❌ Stream vacío recibido');
                    return;
                }
                
                if (state.audioElement) {
                    // CRÍTICO: Asignar stream inmediatamente
                    state.audioElement.srcObject = stream;
                    console.log('✅ Stream asignado a audioElement:', {
                        hasTracks: stream.getTracks().length,
                        trackKinds: stream.getTracks().map(t => t.kind)
                    });
                    
                    // Conectar al visualizador inmediatamente (no requiere interacción)
                    connectStreamToVisualizer(stream);
                    
                    // CRÍTICO: Intentar reproducir automáticamente después de un breve delay
                    // Esto ayuda especialmente en móviles
                    setTimeout(() => {
                        if (state.userInteracted) {
                            playPendingStream();
                        } else {
                            // Guardar el stream para reproducirlo cuando el usuario interactúe
                            state.pendingStream = stream;
                            console.log('⏳ Stream guardado, esperando interacción del usuario...');
                            console.log('💡 Toca la pantalla o el control de volumen para escuchar');
                        }
                    }, 100);
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
// FUNCIONES AUXILIARES PARA AUDIO
// =============================================

function playPendingStream() {
    if (!state.audioElement) {
        console.error('❌ audioElement no existe');
        return;
    }
    
    if (!state.audioElement.srcObject) {
        console.warn('⚠️ No hay srcObject asignado');
        return;
    }
    
    // CRÍTICO PARA MÓVILES: Desmutear antes de reproducir
    if (state.audioElement.muted) {
        state.audioElement.muted = false;
        console.log('🔊 Audio desmuteado para reproducción');
    }
    
    // CRÍTICO: Asegurar que el volumen esté configurado
    if (state.audioElement.volume === 0 && !state.isMuted) {
        state.audioElement.volume = state.currentVolume;
    }
    
    // Mejorar manejo de errores para diagnóstico en móviles
    const playPromise = state.audioElement.play();
    
    if (playPromise !== undefined) {
        playPromise
            .then(() => {
                console.log('✅ Audio reproduciéndose correctamente');
                console.log('✅ Estado final:', {
                    paused: state.audioElement.paused,
                    muted: state.audioElement.muted,
                    volume: state.audioElement.volume,
                    readyState: state.audioElement.readyState
                });
                state.pendingStream = null; // Ya no está pendiente
            })
            .catch(err => {
                console.error('❌ Error al reproducir audio:', err);
                console.error('❌ Estado del audio:', {
                    paused: state.audioElement.paused,
                    muted: state.audioElement.muted,
                    volume: state.audioElement.volume,
                    srcObject: !!state.audioElement.srcObject,
                    readyState: state.audioElement.readyState,
                    networkState: state.audioElement.networkState,
                    error: err.message
                });
                
                // Si falla, guardar el stream para intentar más tarde
                if (state.audioElement.srcObject) {
                    state.pendingStream = state.audioElement.srcObject;
                }
            });
    } else {
        console.warn('⚠️ play() retornó undefined');
    }
}

function connectStreamToVisualizer(stream) {
    if (!state.audioContext || !state.analyser) {
        // Crear AudioContext solo cuando sea necesario (no requiere interacción para visualización)
        try {
            state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            state.analyser = state.audioContext.createAnalyser();
            state.analyser.fftSize = 128;
            state.analyser.smoothingTimeConstant = 0.8;
            drawVisualizer();
        } catch (e) {
            console.log("AudioContext no soportado:", e);
            return;
        }
    }
    
    try {
        const source = state.audioContext.createMediaStreamSource(stream);
        source.connect(state.analyser);
        // NO conectar a destination para evitar reproducción automática
        // Solo visualización, no reproducción
        console.log('✅ Stream conectado al visualizador');
    } catch (e) {
        console.warn('⚠️ No se pudo conectar al visualizador:', e);
    }
}

// =============================================
// VISUALIZADOR PARA OYENTES
// =============================================

function setupListenerVisualizer() {
    if (!elements.visualizer) return;

    // NO crear AudioContext aquí - se creará cuando recibamos el stream
    // Esto evita problemas con la política de autoplay
    drawVisualizer();
}

function drawVisualizer() {
    if (!elements.visualizer) return;

    const canvas = elements.visualizer;
    const ctx = canvas.getContext('2d');
    
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    function renderFrame() {
        requestAnimationFrame(renderFrame);

        if (!state.analyser) {
            // Si no hay analyser, dibujar canvas vacío
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            return;
        }

        const bufferLength = state.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
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
        // CRÍTICO PARA MÓVILES: Agregar touchstart además de input
        elements.volumeSlider.addEventListener('touchstart', (e) => {
            if (!state.userInteracted) {
                state.userInteracted = true;
                // Reanudar AudioContext si está suspendido
                if (state.audioContext && state.audioContext.state === 'suspended') {
                    state.audioContext.resume();
                }
                // Intentar reproducir stream pendiente
                if (state.pendingStream) {
                    playPendingStream();
                }
            }
        }, { passive: true });
        
        elements.volumeSlider.addEventListener('input', (e) => {
            if (!state.userInteracted) {
                state.userInteracted = true;
                // Reanudar AudioContext si está suspendido
                if (state.audioContext && state.audioContext.state === 'suspended') {
                    state.audioContext.resume();
                }
                // Intentar reproducir stream pendiente
                if (state.pendingStream) {
                    playPendingStream();
                }
            }
            handleVolumeChange(e);
        });
    }
    if (elements.muteBtn) {
        // CRÍTICO PARA MÓVILES: Agregar touchstart además de click
        elements.muteBtn.addEventListener('touchstart', (e) => {
            e.preventDefault(); // Prevenir doble evento
            if (!state.userInteracted) {
                state.userInteracted = true;
                // Reanudar AudioContext si está suspendido
                if (state.audioContext && state.audioContext.state === 'suspended') {
                    state.audioContext.resume();
                }
                // Intentar reproducir stream pendiente
                if (state.pendingStream) {
                    playPendingStream();
                }
            }
            toggleMute();
        }, { passive: false });
        
        elements.muteBtn.addEventListener('click', () => {
            if (!state.userInteracted) {
                state.userInteracted = true;
                // Reanudar AudioContext si está suspendido
                if (state.audioContext && state.audioContext.state === 'suspended') {
                    state.audioContext.resume();
                }
                // Intentar reproducir stream pendiente
                if (state.pendingStream) {
                    playPendingStream();
                }
            }
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
            // CRÍTICO PARA MÓVILES: No mutear el elemento, solo volumen a 0
            // (mutear puede causar problemas en algunos móviles)
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
            // Asegurar que no esté muted cuando se desmutea
            if (state.audioElement.muted) {
                state.audioElement.muted = false;
            }
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
