/**
 * RADIO ESCOLAR FM - JavaScript Simplificado
 */

// CONFIGURACIÓN
const API_BASE_URL = window.location.origin;
const SOCKET_URL = window.location.origin;

// ELEMENTOS DEL DOM
const elements = {
    audioPlayer: document.getElementById('audioPlayer'),
    playOverlay: document.getElementById('playOverlay'),
    albumCover: document.getElementById('albumCover'),
    songTitle: document.getElementById('songTitle'),
    songArtist: document.getElementById('songArtist'),
    songAlbum: document.getElementById('songAlbum'),
    volumeSlider: document.getElementById('volumeSlider'),
    volumeValue: document.getElementById('volumeValue'),
    muteBtn: document.getElementById('muteBtn'),
    progress: document.getElementById('progress'),
    currentTime: document.getElementById('currentTime'),
    duration: document.getElementById('duration'),
    progressBar: document.querySelector('.progress-bar'),
    listenersCount: document.getElementById('listenersCount'),
    totalSongs: document.getElementById('totalSongs'),
    uptime: document.getElementById('uptime'),
    playlistContainer: document.getElementById('playlistContainer'),
    visualizer: document.getElementById('visualizer')
};

// ESTADO
let state = {
    currentVolume: 0.75,
    isMuted: false,
    playlist: [],
    currentSongIndex: 0,
    socket: null,
    audioContext: null,
    analyser: null,
    source: null
};

// INICIALIZACIÓN
document.addEventListener('DOMContentLoaded', () => {
    console.log('🎵 Radio Web Escolar - Iniciando...');

    initializeSocket();
    initializeAudio();
    initializeControls();
    loadInitialData();
});

// SOCKET.IO - TIEMPO REAL
function initializeSocket() {
    try {
        state.socket = io(SOCKET_URL);

        state.socket.on('connect', () => {
            console.log('✅ Conectado al servidor');
        });

        state.socket.on('song-changed', (song) => {
            updateSongInfo(song);
            loadAudio(song);
        });

        state.socket.on('listeners-update', (data) => {
            elements.listenersCount.textContent = data.count;
        });

        state.socket.on('current-song', (song) => {
            updateSongInfo(song);
            loadAudio(song);
        });

    } catch (error) {
        console.error('Error Socket.io:', error);
    }
}

// AUDIO
function initializeAudio() {
    elements.audioPlayer.volume = state.currentVolume;

    elements.audioPlayer.addEventListener('timeupdate', updateProgress);
    elements.audioPlayer.addEventListener('loadedmetadata', updateDuration);
    elements.audioPlayer.addEventListener('ended', handleSongEnd);
    elements.audioPlayer.addEventListener('error', (e) => {
        console.warn('Error de audio:', e);
    });

    // Intentar reproducir automáticamente al cargar primera canción
    elements.audioPlayer.addEventListener('canplay', () => {
        elements.audioPlayer.play().catch(e => {
            console.log('Autoplay bloqueado. Haz clic en la página para iniciar.');
        });
    }, { once: true });
}

function loadAudio(song) {
    if (song.audioUrl) {
        elements.audioPlayer.src = song.audioUrl;
        elements.audioPlayer.play().catch(e => console.log('Autoplay blocked'));
    }
}

function handleSongEnd() {
    if (state.socket && state.socket.connected) {
        state.socket.emit('request-next');
    } else {
        // Fallback: siguiente canción local
        state.currentSongIndex = (state.currentSongIndex + 1) % state.playlist.length;
        if (state.playlist[state.currentSongIndex]) {
            updateSongInfo(state.playlist[state.currentSongIndex]);
            loadAudio(state.playlist[state.currentSongIndex]);
        }
    }
}

// CONTROLES
function initializeControls() {
    // Botón de Play overlay
    elements.playOverlay.addEventListener('click', () => {
        // Inicializar AudioContext (requiere interacción del usuario)
        if (!state.audioContext) {
            setupAudioContext();
        }

        elements.audioPlayer.play().then(() => {
            elements.playOverlay.classList.add('hidden');
        }).catch(e => console.log('Error al reproducir:', e));
    });

    // Volumen
    elements.volumeSlider.addEventListener('input', handleVolumeChange);
    elements.muteBtn.addEventListener('click', toggleMute);

    // Barra de progreso
    elements.progressBar.addEventListener('click', handleProgressClick);
}

function handleVolumeChange(e) {
    const volume = e.target.value / 100;
    state.currentVolume = volume;
    elements.audioPlayer.volume = volume;
    elements.volumeValue.textContent = `${e.target.value}%`;
    updateVolumeIcon(volume);

    if (volume > 0) {
        state.isMuted = false;
    }
}

function toggleMute() {
    state.isMuted = !state.isMuted;

    if (state.isMuted) {
        elements.audioPlayer.volume = 0;
        elements.volumeSlider.value = 0;
        elements.volumeValue.textContent = '0%';
    } else {
        elements.audioPlayer.volume = state.currentVolume;
        elements.volumeSlider.value = state.currentVolume * 100;
        elements.volumeValue.textContent = `${Math.round(state.currentVolume * 100)}%`;
    }

    updateVolumeIcon(state.isMuted ? 0 : state.currentVolume);
}

function updateVolumeIcon(volume) {
    const icon = elements.muteBtn.querySelector('i');
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

function handleProgressClick(e) {
    const rect = elements.progressBar.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    elements.audioPlayer.currentTime = percent * elements.audioPlayer.duration;
}

// PROGRESO
function updateProgress() {
    const { currentTime, duration } = elements.audioPlayer;
    if (duration) {
        const percent = (currentTime / duration) * 100;
        elements.progress.style.width = `${percent}%`;
        elements.currentTime.textContent = formatTime(currentTime);
    }
}

function updateDuration() {
    elements.duration.textContent = formatTime(elements.audioPlayer.duration);
}

function formatTime(seconds) {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// VISUALIZADOR DE ONDAS
function setupAudioContext() {
    try {
        state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        state.analyser = state.audioContext.createAnalyser();
        state.analyser.fftSize = 128; // Menos barras para un look más limpio

        state.source = state.audioContext.createMediaElementSource(elements.audioPlayer);
        state.source.connect(state.analyser);
        state.analyser.connect(state.audioContext.destination);

        drawVisualizer();
    } catch (e) {
        console.log("AudioContext no soportado o error:", e);
    }
}

function drawVisualizer() {
    const canvas = elements.visualizer;
    const ctx = canvas.getContext('2d');
    const bufferLength = state.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    // Ajustar resolución
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    function renderFrame() {
        requestAnimationFrame(renderFrame);

        state.analyser.getByteFrequencyData(dataArray);

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const barWidth = (canvas.width / bufferLength) * 2.5;
        let barHeight;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
            barHeight = (dataArray[i] / 255) * canvas.height;

            // Color AZUL SÓLIDO (#4a90e2) sin gradientes
            ctx.fillStyle = '#4a90e2';

            // Barras simples redondeadas
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

// CARGAR DATOS
async function loadInitialData() {
    await Promise.all([
        loadCurrentSong(),
        loadPlaylist(),
        loadListeners(),
        loadServerInfo()
    ]);
}

async function loadCurrentSong() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/current-song`);
        const data = await response.json();
        if (data.success) {
            updateSongInfo(data.data);
            loadAudio(data.data);
        }
    } catch (error) {
        console.error('Error al cargar canción:', error);
        elements.songTitle.textContent = 'Sin conexión';
        elements.songArtist.textContent = 'Conectando al servidor...';
    }
}

async function loadPlaylist() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/playlist`);
        const data = await response.json();
        if (data.success) {
            state.playlist = data.data;
            elements.totalSongs.textContent = data.total;
            renderPlaylist(data.data);
        }
    } catch (error) {
        console.error('Error al cargar playlist:', error);
    }
}

async function loadListeners() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/listeners`);
        const data = await response.json();
        if (data.success) {
            elements.listenersCount.textContent = data.data.count;
        }
    } catch (error) {
        console.error('Error al cargar oyentes:', error);
    }
}

async function loadServerInfo() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/info`);
        const data = await response.json();
        if (data.success) {
            console.log('📻 Info del servidor:', data.data);
        }
    } catch (error) {
        console.error('Error al cargar info:', error);
    }
}

// RENDERIZADO
function updateSongInfo(song) {
    elements.songTitle.textContent = song.title || 'Sin título';
    elements.songArtist.textContent = song.artist || 'Artista desconocido';
    elements.songAlbum.textContent = song.album || '';
    elements.albumCover.src = song.cover || 'https://picsum.photos/seed/default/300/300';

    document.title = `🎵 ${song.title} - Radio Escolar FM`;

    updateActivePlaylistItem(song.id);
}

function renderPlaylist(playlist) {
    if (!playlist || playlist.length === 0) {
        elements.playlistContainer.innerHTML = '<p style="text-align:center;color:#a0a0a0;">No hay canciones</p>';
        return;
    }

    elements.playlistContainer.innerHTML = playlist.map((song, index) => `
        <div class="playlist-item ${index === state.currentSongIndex ? 'active' : ''}" data-id="${song.id}" data-index="${index}">
            <img src="${song.cover}" alt="${song.title}" class="playlist-cover" loading="lazy">
            <div class="playlist-info">
                <div class="playlist-title">${song.title}</div>
                <div class="playlist-artist">${song.artist}</div>
            </div>
            <span class="playlist-duration">${song.duration}</span>
        </div>
    `).join('');

    // Event listeners para playlist items
    elements.playlistContainer.querySelectorAll('.playlist-item').forEach(item => {
        item.addEventListener('click', () => {
            const index = parseInt(item.dataset.index);
            playSongByIndex(index);
        });
    });
}

function updateActivePlaylistItem(songId) {
    elements.playlistContainer.querySelectorAll('.playlist-item').forEach(item => {
        item.classList.toggle('active', parseInt(item.dataset.id) === songId);
    });
}

function playSongByIndex(index) {
    state.currentSongIndex = index;
    const song = state.playlist[index];
    if (song) {
        updateSongInfo(song);
        loadAudio(song);
    }
}

console.log('✅ Radio Web Escolar - JavaScript cargado');
