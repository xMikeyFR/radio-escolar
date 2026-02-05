/**
 * RADIO ESCOLAR FM - Panel de Administrador
 * Solo para ADMIN - Con login y micrófono (WebRTC)
 */

// CONFIGURACIÓN
const API_BASE_URL = window.location.origin;
const SOCKET_URL = window.location.origin;

// ELEMENTOS DEL DOM
let elements = {};

// ESTADO
let state = {
    isAdmin: false,
    currentVolume: 0.75,
    isMuted: false,
    socket: null,
    // Audio para visualizador (micrófono)
    audioContext: null,
    analyser: null,
    microphoneSource: null,
    // Micrófono y WebRTC
    mediaStream: null,
    isRecording: false,
    // WebRTC: un RTCPeerConnection por cada oyente
    peerConnections: new Map() // socket.id -> RTCPeerConnection
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
        loginModal: document.getElementById('loginModal'),
        loginForm: document.getElementById('loginForm'),
        loginError: document.getElementById('loginError'),
        mainContainer: document.getElementById('mainContainer'),
        logoutBtn: document.getElementById('logoutBtn'),
        volumeSlider: document.getElementById('volumeSlider'),
        volumeValue: document.getElementById('volumeValue'),
        muteBtn: document.getElementById('muteBtn'),
        micBtn: document.getElementById('micBtn'),
        visualizer: document.getElementById('visualizer'),
        listenersCount: document.getElementById('listenersCount')
    };
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('🎙️ Radio Escolar FM - Panel de Administrador');
    
    initializeElements();
    
    // Verificar sesión guardada
    const savedSession = localStorage.getItem('radioAdminSession');
    if (savedSession === 'true') {
        checkSavedSession();
    } else {
        showLogin();
    }
    
    // Configurar login
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
                    showAdminPanel();
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
    
    if (elements.logoutBtn) {
        elements.logoutBtn.addEventListener('click', () => {
            state.isAdmin = false;
            localStorage.removeItem('radioAdminSession');
            if (state.socket && state.socket.connected) {
                stopRecording();
            }
            showLogin();
        });
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
    try {
        const response = await fetch(`${API_BASE_URL}/api/info`);
        if (response.ok) {
            hideLogin();
            showAdminPanel();
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

function showAdminPanel() {
    state.isAdmin = true;
    if (elements.micBtn) elements.micBtn.classList.remove('hidden');
    if (elements.logoutBtn) elements.logoutBtn.classList.remove('hidden');
    if (!state.audioContext) {
        setupVisualizer();
    }
}

// =============================================
// SOCKET.IO
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
                showAdminPanel();
                console.log('✅ Autenticado como administrador');
            } else {
                state.isAdmin = false;
                localStorage.removeItem('radioAdminSession');
                showLogin();
            }
        });

        state.socket.on('listeners-update', (data) => {
            if (elements.listenersCount) {
                elements.listenersCount.textContent = data.count;
            }
        });

        // WebRTC: Cuando un nuevo oyente se conecta, crear conexión
        state.socket.on('new-listener', (listenerId) => {
            console.log('👂 Nuevo oyente conectado:', listenerId);
            if (state.isRecording && state.mediaStream) {
                createPeerConnection(listenerId);
            }
        });

        // WebRTC: Recibir lista de oyentes actuales
        state.socket.on('current-listeners', (listenerIds) => {
            console.log('👂 Oyentes actuales recibidos:', listenerIds);
            if (state.isRecording && state.mediaStream && Array.isArray(listenerIds)) {
                listenerIds.forEach(listenerId => {
                    if (listenerId !== state.socket.id) {
                        createPeerConnection(listenerId);
                    }
                });
            }
        });

        // WebRTC: Recibir answer del oyente
        state.socket.on('webrtc-answer', async (data) => {
            const { answer, from } = data;
            const pc = state.peerConnections.get(from);
            if (pc) {
                try {
                    await pc.setRemoteDescription(new RTCSessionDescription(answer));
                    console.log('✅ Answer recibido y configurado');
                } catch (error) {
                    console.error('❌ Error al configurar answer:', error);
                }
            }
        });

        // WebRTC: Recibir ICE candidate del oyente
        state.socket.on('webrtc-ice-candidate', async (data) => {
            const { candidate, from } = data;
            const pc = state.peerConnections.get(from);
            if (pc) {
                try {
                    await pc.addIceCandidate(new RTCIceCandidate(candidate));
                    console.log('✅ ICE candidate agregado');
                } catch (error) {
                    console.error('❌ Error al agregar ICE candidate:', error);
                }
            }
        });

        state.socket.on('error', (data) => {
            console.warn('⚠️ Error del servidor:', data.message);
        });

    } catch (error) {
        console.error('Error Socket.io:', error);
    }
}

// =============================================
// VISUALIZADOR (MICRÓFONO)
// =============================================

function setupVisualizer() {
    if (!elements.visualizer) return;

    try {
        state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        state.analyser = state.audioContext.createAnalyser();
        state.analyser.fftSize = 128;
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
}

function toggleMute() {
    state.isMuted = !state.isMuted;
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
// WebRTC - CREAR CONEXIÓN CON OYENTE
// =============================================

async function createPeerConnection(listenerId) {
    // Evitar crear conexión duplicada
    if (state.peerConnections.has(listenerId)) {
        console.log('⚠️ Ya existe conexión con oyente:', listenerId);
        return;
    }
    
    try {
        const pc = new RTCPeerConnection(rtcConfig);
        
        // Agregar tracks del micrófono a la conexión
        if (state.mediaStream) {
            state.mediaStream.getTracks().forEach(track => {
                pc.addTrack(track, state.mediaStream);
                console.log('✅ Track agregado a RTCPeerConnection:', track.kind);
            });
        } else {
            console.error('❌ No hay mediaStream disponible para crear conexión');
            return;
        }
        
        // Manejar ICE candidates
        pc.onicecandidate = (event) => {
            if (event.candidate) {
                state.socket.emit('webrtc-ice-candidate', {
                    candidate: event.candidate,
                    to: listenerId
                });
            }
        };
        
        // Manejar cambios de conexión
        pc.onconnectionstatechange = () => {
            console.log(`📡 Estado conexión con ${listenerId}:`, pc.connectionState);
            if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
                pc.close();
                state.peerConnections.delete(listenerId);
            }
        };
        
        // Crear y enviar offer
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        
        state.socket.emit('webrtc-offer', {
            offer: offer,
            to: listenerId
        });
        
        state.peerConnections.set(listenerId, pc);
        console.log('✅ RTCPeerConnection creada para oyente:', listenerId);
        
    } catch (error) {
        console.error('❌ Error al crear RTCPeerConnection:', error);
    }
}

// =============================================
// MICRÓFONO Y WebRTC
// =============================================

async function startRecording() {
    if (!state.isAdmin || state.isRecording) return;

    try {
        // Capturar micrófono
        state.mediaStream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            } 
        });

        console.log('🎤 Micrófono capturado');

        // Configurar visualizador
        if (!state.audioContext) {
            setupVisualizer();
        }

        if (state.audioContext && !state.microphoneSource) {
            state.microphoneSource = state.audioContext.createMediaStreamSource(state.mediaStream);
            state.microphoneSource.connect(state.analyser);
        }

        // Notificar al servidor que estamos listos
        state.socket.emit('broadcaster-ready');
        
        // Solicitar lista de oyentes actuales para crear conexiones
        state.socket.emit('get-current-listeners');
        
        state.isRecording = true;

        if (elements.micBtn) {
            elements.micBtn.classList.add('active');
        }

        console.log('🎤 Transmisión iniciada');

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
        // Cerrar todas las conexiones WebRTC
        state.peerConnections.forEach((pc, listenerId) => {
            pc.close();
            console.log('🔌 Conexión cerrada con oyente:', listenerId);
        });
        state.peerConnections.clear();

        // Detener tracks del micrófono
        if (state.mediaStream) {
            state.mediaStream.getTracks().forEach(track => track.stop());
            state.mediaStream = null;
        }

        if (state.microphoneSource) {
            state.microphoneSource.disconnect();
            state.microphoneSource = null;
        }

        state.isRecording = false;

        if (elements.micBtn) {
            elements.micBtn.classList.remove('active');
        }

        console.log('🎤 Transmisión detenida');

    } catch (error) {
        console.warn('⚠️ Error al detener la transmisión:', error);
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

console.log('✅ Radio Escolar FM - Panel de Administrador cargado');
