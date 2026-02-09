/**
 * RADIO ESCOLAR FM - Panel de Oyentes
 * Audio via servidor (Socket.io) - funciona en cualquier red
 */

const API_BASE_URL = window.location.origin;
const SOCKET_URL = window.location.origin;

let elements = {};
let state = {
    currentVolume: 0.75,
    isMuted: false,
    socket: null,
    audioContext: null,
    analyser: null,
    audioElement: null,
    mediaSource: null,
    sourceBuffer: null,
    chunkQueue: [],
    isAppending: false,
    userInteracted: false,
    pendingStream: null,
    isReceiving: false
};

function initializeElements() {
    elements = {
        volumeSlider: document.getElementById('volumeSlider'),
        volumeValue: document.getElementById('volumeValue'),
        muteBtn: document.getElementById('muteBtn'),
        visualizer: document.getElementById('visualizer'),
        listenersCount: document.getElementById('listenersCount'),
        playBtn: document.getElementById('playBtn')
    };
    
    state.audioElement = document.createElement('audio');
    state.audioElement.autoplay = false;
    state.audioElement.controls = false;
    state.audioElement.playsInline = true;
    state.audioElement.setAttribute('playsinline', 'true');
    state.audioElement.setAttribute('webkit-playsinline', 'true');
    state.audioElement.muted = true;
    state.audioElement.style.display = 'none';
    state.audioElement.volume = state.currentVolume;
    document.body.appendChild(state.audioElement);
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('🎙️ Radio Escolar FM - Panel de Oyentes (audio via servidor)');
    initializeElements();
    setupListenerVisualizer();
    initializeSocket();
    initializeControls();
    setupPlayButton();
    loadListeners();
    
    document.addEventListener('click', handleUserInteraction, { once: true });
    document.addEventListener('keydown', handleUserInteraction, { once: true });
    document.addEventListener('touchstart', handleUserInteraction, { once: true, passive: true });
    document.addEventListener('touchend', handleUserInteraction, { once: true, passive: true });
    
    function handleUserInteraction() {
        if (!state.userInteracted) {
            state.userInteracted = true;
            if (state.audioContext && state.audioContext.state === 'suspended') {
                state.audioContext.resume();
            }
            if (state.pendingStream || state.isReceiving) {
                playPendingStream(true);
            }
        }
    }
});

// =============================================
// SOCKET.IO - Audio via servidor
// =============================================

function initializeSocket() {
    try {
        state.socket = io(SOCKET_URL);
        state.socket.on('connect', () => console.log('✅ Conectado al servidor'));
        state.socket.on('listeners-update', (data) => {
            if (elements.listenersCount) elements.listenersCount.textContent = data.count;
        });

        state.socket.on('broadcaster-ready', () => {
            console.log('📡 Locutor disponible');
            resetAudioSession();
            setupMediaSource();
        });

        state.socket.on('audio-chunk', (data) => {
            const chunk = toArrayBuffer(data);
            if (!chunk || chunk.byteLength === 0) return;
            state.isReceiving = true;
            if (state.sourceBuffer) {
                queueChunk(chunk);
            } else {
                state.chunkQueue.push(chunk);
            }
        });

        state.socket.on('broadcaster-stop', () => {
            console.log('📡 Locutor detenido');
            state.isReceiving = false;
            hidePlayButton();
        });

    } catch (error) {
        console.error('Error Socket.io:', error);
    }
}

function resetAudioSession() {
    if (state.sourceBuffer && state.mediaSource?.readyState === 'open') {
        try {
            state.mediaSource.endOfStream();
        } catch (e) {}
    }
    state.mediaSource = null;
    state.sourceBuffer = null;
    state.chunkQueue = [];
    state.isAppending = false;
    if (state.audioElement) {
        state.audioElement.srcObject = null;
        state.audioElement.removeAttribute('src');
    }
}

function setupMediaSource() {
    resetAudioSession();
    const mimeType = MediaSource.isTypeSupported('audio/webm; codecs=opus') 
        ? 'audio/webm; codecs=opus' : 'audio/webm';
    
    state.mediaSource = new MediaSource();
    const url = URL.createObjectURL(state.mediaSource);
    state.audioElement.src = url;
    
    state.mediaSource.addEventListener('sourceopen', () => {
        try {
            state.sourceBuffer = state.mediaSource.addSourceBuffer(mimeType);
            state.sourceBuffer.mode = 'sequence';
            state.sourceBuffer.addEventListener('updateend', () => {
                state.isAppending = false;
                processChunkQueue();
                tryStartPlayback();
            });
            console.log('✅ MediaSource listo');
            processChunkQueue();
        } catch (e) {
            console.error('❌ Error addSourceBuffer:', e);
        }
    });
}

function toArrayBuffer(data) {
    if (!data) return null;
    if (data instanceof ArrayBuffer) return data;
    if (data.buffer instanceof ArrayBuffer) return data.buffer;
    if (data.data) return toArrayBuffer(data.data);
    try { return new Uint8Array(data).buffer; } catch (_) { return null; }
}

function queueChunk(chunk) {
    const buf = toArrayBuffer(chunk);
    if (buf && buf.byteLength > 0) {
        state.chunkQueue.push(buf);
        processChunkQueue();
    }
}

function processChunkQueue() {
    if (state.isAppending || !state.sourceBuffer || state.chunkQueue.length === 0) return;
    
    state.isAppending = true;
    const chunk = state.chunkQueue.shift();
    
    try {
        state.sourceBuffer.appendBuffer(chunk);
    } catch (e) {
        console.warn('appendBuffer error:', e);
        state.chunkQueue.unshift(chunk);
        state.isAppending = false;
    }
}

function tryStartPlayback() {
    if (!state.audioElement || state.audioElement.readyState < 2) return;
    if (state.pendingStream) return; // Ya manejado
    state.pendingStream = true;
    showPlayButton();
    if (state.userInteracted) {
        playPendingStream(true);
    }
}

// =============================================
// REPRODUCCIÓN Y BOTÓN ESCUCHAR
// =============================================

function showPlayButton() {
    if (elements.playBtn) {
        elements.playBtn.classList.add('visible');
    }
}

function hidePlayButton() {
    if (elements.playBtn) {
        elements.playBtn.classList.remove('visible');
    }
    state.pendingStream = false;
}

function playPendingStream(fromUserGesture) {
    if (!state.audioElement || !state.isReceiving) return;
    state.pendingStream = true;
    
    if (fromUserGesture) {
        state.audioElement.muted = false;
        state.audioElement.volume = state.currentVolume;
        state.audioElement.play().catch(() => {});
    } else {
        state.audioElement.muted = true;
        state.audioElement.play().then(() => {
            if (state.userInteracted) {
                state.audioElement.muted = false;
                state.audioElement.volume = state.currentVolume;
            }
        }).catch(() => {});
    }
    hidePlayButton();
}

// =============================================
// VISUALIZADOR
// =============================================

function setupListenerVisualizer() {
    const canvas = elements.visualizer;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth;
    
    state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    state.analyser = state.audioContext.createAnalyser();
    state.analyser.fftSize = 256;
    state.analyser.smoothingTimeConstant = 0.8;
    
    const source = state.audioContext.createMediaElementSource(state.audioElement);
    source.connect(state.analyser);
    state.analyser.connect(state.audioContext.destination);
    
    const bufferLength = state.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    let animationId;
    
    function draw() {
        animationId = requestAnimationFrame(draw);
        state.analyser.getByteFrequencyData(dataArray);
        const barWidth = (canvas.width / bufferLength) * 1.5;
        let x = 0;
        let barHeight;
        
        ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
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
    
    draw();
    window.addEventListener('resize', () => { canvas.width = canvas.offsetWidth; });
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