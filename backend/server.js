/**
 * ===========================================
 * SERVIDOR DE RADIO WEB - BACKEND
 * Aplicaciones Web Orientadas a Servicios
 * ===========================================
 * 
 * Este servidor implementa:
 * - API REST para servicios de radio
 * - Socket.io para tiempo real
 * - Streaming de audio
 */

const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

// Inicializar Express
const app = express();
const server = http.createServer(app);

// Configurar Socket.io para tiempo real
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));
app.use('/frontend', express.static(path.join(__dirname, '../frontend'))); // Para que funcione tu ruta preferida
app.use('/assets', express.static(path.join(__dirname, '../assets')));

// =============================================
// BASE DE DATOS SIMULADA (Playlist)
// MÚSICA GRATIS desde URLs online
// =============================================
// =============================================
// BASE DE DATOS SIMULADA (Playlist)
// MÚSICA LOCAL (Tu propia música)
// =============================================
let playlist = [
    {
        id: 1,
        title: "No Pole",
        artist: "Don Toliver",
        album: "Life of a DON",
        duration: "3:07",
        cover: "/assets/audio/no_pole_cover.jpg",
        audioUrl: "/assets/audio/no_pole.m4a.m4a"
    }
];

let currentSongIndex = 0;
let history = [];
let listeners = new Set();

// =============================================
// SERVICIOS REST (APIs)
// =============================================

/**
 * SERVICIO 1: Obtener canción actual
 * GET /api/current-song
 */
app.get('/api/current-song', (req, res) => {
    const currentSong = playlist[currentSongIndex];
    res.json({
        success: true,
        data: {
            ...currentSong,
            isPlaying: true,
            timestamp: new Date().toISOString()
        }
    });
});

/**
 * SERVICIO 2: Obtener playlist completa
 * GET /api/playlist
 */
app.get('/api/playlist', (req, res) => {
    res.json({
        success: true,
        data: playlist,
        total: playlist.length
    });
});

/**
 * SERVICIO 3: Obtener historial de reproducción
 * GET /api/history
 */
app.get('/api/history', (req, res) => {
    res.json({
        success: true,
        data: history.slice(-10), // Últimas 10 canciones
        total: history.length
    });
});

/**
 * SERVICIO 4: Obtener número de oyentes
 * GET /api/listeners
 */
app.get('/api/listeners', (req, res) => {
    res.json({
        success: true,
        data: {
            count: listeners.size,
            timestamp: new Date().toISOString()
        }
    });
});

/**
 * SERVICIO 5: Siguiente canción
 * POST /api/next-song
 */
app.post('/api/next-song', (req, res) => {
    // Guardar en historial
    history.push({
        ...playlist[currentSongIndex],
        playedAt: new Date().toISOString()
    });

    // Avanzar a siguiente canción
    currentSongIndex = (currentSongIndex + 1) % playlist.length;

    const newSong = playlist[currentSongIndex];

    // Notificar a todos los clientes vía Socket.io
    io.emit('song-changed', newSong);

    res.json({
        success: true,
        data: newSong
    });
});

/**
 * SERVICIO 6: Info del servidor/radio
 * GET /api/info
 */
app.get('/api/info', (req, res) => {
    res.json({
        success: true,
        data: {
            name: "Radio Escolar FM",
            description: "Tu estación de radio web escolar",
            genre: "Variado",
            website: "https://radio-escolar.vercel.app",
            listeners: listeners.size,
            totalSongs: playlist.length,
            currentSong: playlist[currentSongIndex].title,
            uptime: process.uptime()
        }
    });
});

/**
 * SERVICIO 7: Health check (para deployment)
 * GET /api/health
 */
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        status: "online",
        timestamp: new Date().toISOString()
    });
});

// =============================================
// SOCKET.IO - TIEMPO REAL
// =============================================
io.on('connection', (socket) => {
    // Agregar oyente
    listeners.add(socket.id);
    console.log(`🎧 Nuevo oyente conectado: ${socket.id} | Total: ${listeners.size}`);

    // Notificar a todos el nuevo conteo
    io.emit('listeners-update', { count: listeners.size });

    // Enviar canción actual al nuevo oyente
    socket.emit('current-song', playlist[currentSongIndex]);

    // Cuando el oyente se desconecta
    socket.on('disconnect', () => {
        listeners.delete(socket.id);
        console.log(`👋 Oyente desconectado: ${socket.id} | Total: ${listeners.size}`);
        io.emit('listeners-update', { count: listeners.size });
    });

    // Solicitud de siguiente canción
    socket.on('request-next', () => {
        history.push({
            ...playlist[currentSongIndex],
            playedAt: new Date().toISOString()
        });
        currentSongIndex = (currentSongIndex + 1) % playlist.length;
        io.emit('song-changed', playlist[currentSongIndex]);
    });
});

// =============================================
// RUTA PRINCIPAL - Servir Frontend
// =============================================
// =============================================
// RUTA PRINCIPAL - Catch-all para SPA
// =============================================
app.get('*', (req, res) => {
    const indexPath = path.join(__dirname, '../frontend/index.html');
    console.log(`Petición a root: ${req.url}`);

    // Verificar si existe el archivo (Debug para Render)
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        console.error('ERROR CRÍTICO: No encuentro index.html en:', indexPath);
        res.status(500).send(`Error: No encuentro el archivo frontend/index.html en la ruta: ${indexPath}`);
    }
});

// =============================================
// INICIAR SERVIDOR
// =============================================
const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
    console.log('');
    console.log('╔═══════════════════════════════════════════╗');
    console.log('║     🎵 RADIO WEB ESCOLAR - SERVIDOR 🎵    ║');
    console.log('╠═══════════════════════════════════════════╣');
    console.log(`║  🌐 RADIO ONLINE: http://localhost:${PORT}/frontend/index.html`);
    console.log(`║  🏠 Alternativa:  http://localhost:${PORT}`);
    console.log('║  📡 Estado: ONLINE                        ║');
    console.log('║  🎧 Oyentes: 0                            ║');
    console.log('╚═══════════════════════════════════════════╝');
    console.log('');
    console.log('📋 Servicios API disponibles:');
    console.log(`   GET  /api/current-song  - Canción actual`);
    console.log(`   GET  /api/playlist      - Lista de canciones`);
    console.log(`   GET  /api/history       - Historial`);
    console.log(`   GET  /api/listeners     - Número de oyentes`);
    console.log(`   POST /api/next-song     - Siguiente canción`);
    console.log(`   GET  /api/info          - Info del servidor`);
    console.log(`   GET  /api/health        - Estado del servidor`);
    console.log('');
});
