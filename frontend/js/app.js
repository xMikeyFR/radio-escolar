/**
 * RADIO ESCOLAR FM - Solo Voz
 * Sistema simplificado: solo transmisión de voz del administrador
 */

// CONFIGURACIÓN
const API_BASE_URL = window.location.origin;
const SOCKET_URL = window.location.origin;

// ELEMENTOS DEL DOM (se inicializarán cuando el DOM esté listo)
let elements = {};

// ESTADO
let state = {
    isAdmin: false,
    currentVolume: 0.75,
    isMuted: false,
    socket: null,
    // Audio para visualizador (admin: micrófono, oyente: voz recibida)
    audioContext: null,
    analyser: null,
    microphoneSource: null,
    // Audio para reproducir voz recibida (oyentes)
    voiceAudioContext: null,
    voiceGainNode: null,
    voiceAudioElement: null, // Elemento <audio> para reproducir chunks
    mediaSource: null, // MediaSource API para reproducir chunks
    voiceChunks: [], // Buffer de chunks para oyentes
    // Micrófono (solo admin)
    mediaStream: null,
    mediaRecorder: null,
    isRecording: false
};

// INICIALIZACIÓN
function initializeElements() {
    elements = {
        // Login
        loginModal: document.getElementById('loginModal'),
        loginForm: document.getElementById('loginForm'),
        guestBtn: document.getElementById('guestBtn'),
        loginError: document.getElementById('loginError'),
        mainContainer: document.getElementById('mainContainer'),
        logoutBtn: document.getElementById('logoutBtn'),
        // Controles
        volumeSlider: document.getElementById('volumeSlider'),
        volumeValue: document.getElementById('volumeValue'),
        muteBtn: document.getElementById('muteBtn'),
        micBtn: document.getElementById('micBtn'),
        visualizer: document.getElementById('visualizer'),
        listenersCount: document.getElementById('listenersCount')
    };
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('🎙️ Radio Escolar FM - Solo Voz - Iniciando...');
    
    // Inicializar elementos del DOM
    initializeElements();
    
    // Configurar eventos de login
    if (elements.loginForm) {
        elements.loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;

            try {
                const response = await fetch(`${API_BASE_URL}/api/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });

                const data = await response.json();

                if (data.success) {
                    state.isAdmin = true;
                    localStorage.setItem('radioAdminSession', 'true');
                    hideLogin();
                    showAdminControls();
                    // Autenticar también en Socket.io
                    if (state.socket && state.socket.connected) {
                        state.socket.emit('admin-auth', { username, password });
                    }
                    if (elements.loginError) {
                        elements.loginError.classList.add('hidden');
                    }
                } else {
                    showLoginError('Credenciales incorrectas');
                }
            } catch (error) {
                showLoginError('Error al conectar con el servidor');
            }
        });
    }

    if (elements.guestBtn) {
        elements.guestBtn.addEventListener('click', () => {
            state.isAdmin = false;
            localStorage.removeItem('radioAdminSession');
            hideLogin();
            showAdminControls();
        });
    }

    if (elements.logoutBtn) {
        elements.logoutBtn.addEventListener('click', () => {
            state.isAdmin = false;
            localStorage.removeItem('radioAdminSession');
            if (state.socket && state.socket.connected) {
                stopRecording();
            }
            showLogin();
            showAdminControls();
        });
    }
    
    // Verificar si hay sesión guardada (solo para admin)
    const savedSession = localStorage.getItem('radioAdminSession');
    if (savedSession === 'true') {
        // Solo admin tiene sesión guardada, mostrar login para verificar
        checkSavedSession();
    } else {
        // Si no hay sesión guardada, es un oyente - ir directo al panel
        hideLogin();
        showAdminControls();
    }

    initializeSocket();
    initializeControls();
    loadListeners();
});

// =============================================
// SISTEMA DE LOGIN
// =============================================

function showLogin() {
    if (elements.loginModal) {
        elements.loginModal.style.display = 'flex';
    }
    if (elements.mainContainer) {
        elements.mainContainer.style.display = 'none';
    }
}

function hideLogin() {
    if (elements.loginModal) {
        elements.loginModal.style.display = 'none';
    }
    if (elements.mainContainer) {
        elements.mainContainer.style.display = 'block';
    }
}

async function checkSavedSession() {
    // Verificar si la sesión sigue siendo válida
    try {
        const response = await fetch(`${API_BASE_URL}/api/info`);
        if (response.ok) {
            // Si el servidor responde, intentar autenticar vía socket
            hideLogin();
            // La autenticación real se hará cuando se conecte el socket
        } else {
            showLogin();
        }
    } catch (error) {
        showLogin();
    }
}

function showLoginError(message) {
    if (elements.loginError) {
        elements.loginError.textContent = message;
        elements.loginError.classList.remove('hidden');
    }
}

function showAdminControls() {
    if (state.isAdmin) {
        if (elements.micBtn) elements.micBtn.classList.remove('hidden');
        if (elements.logoutBtn) elements.logoutBtn.classList.remove('hidden');
        // Visualizador para admin (micrófono)
        if (!state.audioContext) {
            setupVisualizer();
        }
    } else {
        // Oyente
        if (elements.micBtn) elements.micBtn.classList.add('hidden');
        if (elements.logoutBtn) elements.logoutBtn.classList.add('hidden');
        // Visualizador para oyente (voz recibida)
        if (!state.audioContext) {
            setupListenerVisualizer();
        }
    }
}

// =============================================
// SOCKET.IO - TIEMPO REAL
// =============================================

function initializeSocket() {
    try {
        state.socket = io(SOCKET_URL);

        state.socket.on('connect', () => {
            console.log('✅ Conectado al servidor');
            
            if (state.isAdmin) {
                const savedSession = localStorage.getItem('radioAdminSession');
                if (savedSession === 'true') {
                    state.socket.emit('admin-auth', {
                        username: 'ADMINISTRADOR',
                        password: '987654321'
                    });
                }
            }
        });

        state.socket.on('admin-authenticated', (data) => {
            if (data.success) {
                state.isAdmin = true;
                showAdminControls();
                console.log('✅ Autenticado como administrador');
            } else {
                state.isAdmin = false;
                localStorage.removeItem('radioAdminSession');
                showAdminControls();
            }
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

        state.socket.on('error', (data) => {
            console.warn('⚠️ Error del servidor:', data.message);
        });

    } catch (error) {
        console.error('Error Socket.io:', error);
    }
}

// =============================================
// VISUALIZADOR
// =============================================

// Visualizador para ADMIN (micrófono)
function setupVisualizer() {
    if (!state.isAdmin || !elements.visualizer) return;

    try {
        state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        state.analyser = state.audioContext.createAnalyser();
        state.analyser.fftSize = 128;
        drawVisualizer();
    } catch (e) {
        console.log("AudioContext no soportado:", e);
    }
}

// Visualizador para OYENTE (voz recibida)
function setupListenerVisualizer() {
    if (state.isAdmin || !elements.visualizer) return;

    try {
        state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        state.analyser = state.audioContext.createAnalyser();
        state.analyser.fftSize = 128;
        
        // Conectar el visualizador al audio de voz recibida
        if (state.voiceAudioContext && state.voiceGainNode) {
            state.voiceGainNode.connect(state.analyser);
            state.analyser.connect(state.voiceAudioContext.destination);
        }
        
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

    if (elements.micBtn) {
        elements.micBtn.addEventListener('mousedown', startRecording);
        elements.micBtn.addEventListener('mouseup', stopRecording);
        elements.micBtn.addEventListener('mouseleave', stopRecording);
        elements.micBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            startRecording();
        });
        elements.micBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            stopRecording();
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
// FUNCIONALIDAD DE MICRÓFONO (SOLO ADMIN)
// =============================================

async function startRecording() {
    if (!state.isAdmin || state.isRecording) return;

    try {
        state.mediaStream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            } 
        });

        if (!state.audioContext) {
            setupVisualizer();
        }

        if (state.audioContext && !state.microphoneSource) {
            state.microphoneSource = state.audioContext.createMediaStreamSource(state.mediaStream);
            state.microphoneSource.connect(state.analyser);
        }

        const options = {
            mimeType: 'audio/webm;codecs=opus'
        };
        
        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
            options.mimeType = 'audio/webm';
            if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                options.mimeType = '';
            }
        }

        state.mediaRecorder = new MediaRecorder(state.mediaStream, options);

        state.mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0 && state.socket && state.socket.connected) {
                const reader = new FileReader();
                reader.onloadend = () => {
                    state.socket.emit('voice-data', {
                        audio: Array.from(new Uint8Array(reader.result)),
                        mimeType: event.data.type
                    });
                };
                reader.readAsArrayBuffer(event.data);
            }
        };

        state.mediaRecorder.start(100);
        state.isRecording = true;

        if (elements.micBtn) {
            elements.micBtn.classList.add('active');
        }

        if (state.socket && state.socket.connected) {
            state.socket.emit('voice-start');
        }

        console.log('🎤 Grabación iniciada');

    } catch (error) {
        console.warn('⚠️ Error al acceder al micrófono:', error.message);
        state.isRecording = false;
        if (elements.micBtn) {
            elements.micBtn.classList.remove('active');
        }
    }
}

function stopRecording() {
    if (!state.isRecording) return;

    try {
        if (state.mediaRecorder && state.mediaRecorder.state !== 'inactive') {
            state.mediaRecorder.stop();
        }

        if (state.mediaStream) {
            state.mediaStream.getTracks().forEach(track => track.stop());
            state.mediaStream = null;
        }

        if (state.microphoneSource) {
            state.microphoneSource.disconnect();
            state.microphoneSource = null;
        }

        state.mediaRecorder = null;
        state.isRecording = false;

        if (elements.micBtn) {
            elements.micBtn.classList.remove('active');
        }

        if (state.socket && state.socket.connected) {
            state.socket.emit('voice-end');
        }

        console.log('🎤 Grabación detenida');

    } catch (error) {
        console.warn('⚠️ Error al detener la grabación:', error);
    }
}

// =============================================
// REPRODUCCIÓN DE VOZ (OYENTES)
// =============================================

function handleVoiceStart() {
    console.log('👂 Alguien está hablando');
    
    // Inicializar AudioContext para oyentes
    if (!state.voiceAudioContext) {
        state.voiceAudioContext = new (window.AudioContext || window.webkitAudioContext)();
        state.voiceGainNode = state.voiceAudioContext.createGain();
        state.voiceGainNode.gain.value = state.currentVolume;
        state.voiceGainNode.connect(state.voiceAudioContext.destination);
        
        // Configurar visualizador para oyente si aún no está configurado
        if (!state.isAdmin && !state.audioContext) {
            setupListenerVisualizer();
        }
    }

    if (state.voiceAudioContext.state === 'suspended') {
        state.voiceAudioContext.resume().catch(err => {
            console.warn('⚠️ No se pudo reanudar AudioContext:', err);
        });
    }
    
    // Limpiar buffer de chunks
    state.voiceChunks = [];
    
    // Crear elemento <audio> si no existe
    if (!state.voiceAudioElement) {
        state.voiceAudioElement = document.createElement('audio');
        state.voiceAudioElement.autoplay = true;
        state.voiceAudioElement.style.display = 'none';
        document.body.appendChild(state.voiceAudioElement);
        
        // Conectar el audio element al visualizador si es oyente
        if (!state.isAdmin && state.audioContext) {
            try {
                const source = state.audioContext.createMediaElementSource(state.voiceAudioElement);
                source.connect(state.analyser);
                state.analyser.connect(state.audioContext.destination);
            } catch (e) {
                console.warn('⚠️ No se pudo conectar audio al visualizador:', e);
            }
        }
    }
}

async function handleVoiceData(data) {
    if (!data.audio || !state.voiceAudioContext) return;

    try {
        if (state.voiceAudioContext.state === 'suspended') {
            await state.voiceAudioContext.resume();
        }

        // Agregar chunk al buffer
        const chunk = new Uint8Array(data.audio);
        state.voiceChunks.push(chunk);
        
        // Usar MediaSource API para reproducir chunks en tiempo real
        if (!state.mediaSource || state.mediaSource.readyState === 'closed') {
            if (state.mediaSource) {
                state.mediaSource = null;
            }
            
            state.mediaSource = new MediaSource();
            const url = URL.createObjectURL(state.mediaSource);
            
            if (state.voiceAudioElement) {
                state.voiceAudioElement.src = url;
                state.voiceAudioElement.volume = state.currentVolume;
                
                state.mediaSource.addEventListener('sourceopen', () => {
                    try {
                        const sourceBuffer = state.mediaSource.addSourceBuffer('audio/webm; codecs="opus"');
                        sourceBuffer.addEventListener('updateend', () => {
                            if (!sourceBuffer.updating && state.mediaSource.readyState === 'open') {
                                // Intentar reproducir
                                if (state.voiceAudioElement && state.voiceAudioElement.paused) {
                                    state.voiceAudioElement.play().catch(err => {
                                        console.warn('⚠️ Error al reproducir:', err);
                                    });
                                }
                            }
                        });
                        
                        // Agregar todos los chunks acumulados
                        const allChunks = new Blob(state.voiceChunks, { type: 'audio/webm' });
                        allChunks.arrayBuffer().then(buffer => {
                            if (!sourceBuffer.updating && state.mediaSource.readyState === 'open') {
                                sourceBuffer.appendBuffer(buffer);
                            }
                        });
                    } catch (e) {
                        // Fallback: usar método simple con blob URL
                        console.warn('⚠️ MediaSource no soportado, usando método alternativo:', e);
                        useSimpleAudioPlayback(data);
                    }
                });
            }
        } else if (state.mediaSource.readyState === 'open') {
            // Agregar nuevo chunk al source buffer existente
            const sourceBuffers = state.mediaSource.sourceBuffers;
            if (sourceBuffers.length > 0 && !sourceBuffers[0].updating) {
                const audioBlob = new Blob([chunk], { type: 'audio/webm' });
                audioBlob.arrayBuffer().then(buffer => {
                    if (!sourceBuffers[0].updating && state.mediaSource.readyState === 'open') {
                        sourceBuffers[0].appendBuffer(buffer);
                    }
                });
            }
        }

    } catch (error) {
        console.warn('⚠️ Error al reproducir audio de voz:', error);
        // Fallback a método simple
        useSimpleAudioPlayback(data);
    }
}

// Método alternativo: reproducir cada chunk como blob URL individual
function useSimpleAudioPlayback(data) {
    if (!data.audio) return;
    
    const chunk = new Uint8Array(data.audio);
    const audioBlob = new Blob([chunk], { 
        type: data.mimeType || 'audio/webm' 
    });
    
    const blobUrl = URL.createObjectURL(audioBlob);
    
    if (!state.voiceAudioElement) {
        state.voiceAudioElement = document.createElement('audio');
        state.voiceAudioElement.autoplay = true;
        state.voiceAudioElement.style.display = 'none';
        document.body.appendChild(state.voiceAudioElement);
    }
    
    // Crear un nuevo elemento audio para cada chunk (método simple pero funcional)
    const audioChunk = new Audio(blobUrl);
    audioChunk.volume = state.currentVolume;
    
    // Conectar al visualizador si es oyente
    if (!state.isAdmin && state.audioContext) {
        try {
            const source = state.audioContext.createMediaElementSource(audioChunk);
            source.connect(state.analyser);
            state.analyser.connect(state.audioContext.destination);
        } catch (e) {
            // Si ya hay una conexión, solo reproducir
        }
    }
    
    audioChunk.play().catch(err => {
        console.warn('⚠️ Error al reproducir chunk:', err);
    });
    
    // Limpiar URL después de reproducir
    audioChunk.addEventListener('ended', () => {
        URL.revokeObjectURL(blobUrl);
    });
}

function handleVoiceEnd() {
    console.log('👂 Nadie está hablando');
    
    // Limpiar buffer
    state.voiceChunks = [];
    
    // Cerrar MediaSource si está abierto
    if (state.mediaSource && state.mediaSource.readyState === 'open') {
        try {
            state.mediaSource.endOfStream();
        } catch (e) {
            console.warn('⚠️ Error al cerrar MediaSource:', e);
        }
    }
    
    // Limpiar elemento audio
    if (state.voiceAudioElement) {
        state.voiceAudioElement.pause();
        state.voiceAudioElement.src = '';
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

console.log('✅ Radio Escolar FM - Solo Voz - JavaScript cargado');
