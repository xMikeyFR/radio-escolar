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
// AUTENTICACIÓN Y PERMISOS
// =============================================
const ADMIN_CREDENTIALS = {
    username: 'ADMINISTRADOR',
    password: '987654321'
};

// Almacenar sesiones activas (socket.id -> isAdmin)
const adminSessions = new Map();
let listeners = new Set();
let broadcasterId = null; // ID del locutor activo

// =============================================
// SERVICIOS REST (APIs)
// =============================================

/**
 * SERVICIO 1: Login de administrador
 * POST /api/login
 */
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;

    if (username === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password) {
        res.json({
            success: true,
            message: 'Login exitoso',
            isAdmin: true
        });
    } else {
        res.status(401).json({
            success: false,
            message: 'Credenciales incorrectas'
        });
    }
});

/**
 * SERVICIO 2: Obtener número de oyentes
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
 * SERVICIO 3: Info del servidor/radio
 * GET /api/info
 */
app.get('/api/info', (req, res) => {
    res.json({
        success: true,
        data: {
            name: "Radio Escolar FM",
            description: "Estación de Radio Web Escolar - Solo Voz",
            listeners: listeners.size,
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

    // Evento para autenticar como admin vía Socket.io
    socket.on('admin-auth', (data) => {
        if (data.username === ADMIN_CREDENTIALS.username && 
            data.password === ADMIN_CREDENTIALS.password) {
            adminSessions.set(socket.id, true);
            socket.emit('admin-authenticated', { success: true });
            console.log(`✅ Admin autenticado: ${socket.id}`);
        } else {
            socket.emit('admin-authenticated', { success: false });
        }
    });

    // ===================================
    // WebRTC SIGNALING
    // ===================================
    
    // Cuando el locutor está listo para transmitir
    socket.on('broadcaster-ready', () => {
        if (adminSessions.has(socket.id)) {
            broadcasterId = socket.id;
            console.log(`🎤 Locutor listo para transmitir: ${socket.id}`);
            // Notificar a todos los oyentes actuales que hay un locutor
            socket.broadcast.emit('broadcaster-ready');
        }
    });
    
    // Cuando un nuevo oyente se conecta y hay un locutor activo, notificar al locutor
    // Esto se ejecuta después de que el socket se conecta
    setTimeout(() => {
        if (broadcasterId && !adminSessions.has(socket.id)) {
            io.to(broadcasterId).emit('new-listener', socket.id);
            console.log(`👂 Notificando locutor sobre nuevo oyente: ${socket.id}`);
        }
    }, 100);
    
    // Enviar lista de oyentes actuales cuando el locutor lo solicita
    socket.on('get-current-listeners', () => {
        if (adminSessions.has(socket.id)) {
            const currentListeners = Array.from(listeners).filter(id => id !== socket.id);
            socket.emit('current-listeners', currentListeners);
            console.log(`📋 Enviando lista de ${currentListeners.length} oyentes al locutor`);
        }
    });
    
    // Reenviar offer del locutor al oyente específico
    socket.on('webrtc-offer', (data) => {
        const { offer, to } = data;
        if (adminSessions.has(socket.id)) {
            io.to(to).emit('webrtc-offer', {
                offer: offer,
                from: socket.id
            });
            console.log(`📤 Offer enviado de ${socket.id} a ${to}`);
        }
    });
    
    // Reenviar answer del oyente al locutor
    socket.on('webrtc-answer', (data) => {
        const { answer, to } = data;
        io.to(to).emit('webrtc-answer', {
            answer: answer,
            from: socket.id
        });
        console.log(`📤 Answer enviado de ${socket.id} a ${to}`);
    });
    
    // Reenviar ICE candidates
    socket.on('webrtc-ice-candidate', (data) => {
        const { candidate, to } = data;
        io.to(to).emit('webrtc-ice-candidate', {
            candidate: candidate,
            from: socket.id
        });
    });

    // Cuando el oyente se desconecta
    socket.on('disconnect', () => {
        listeners.delete(socket.id);
        adminSessions.delete(socket.id);
        
        // Limpiar broadcasterId si era el locutor
        if (broadcasterId === socket.id) {
            broadcasterId = null;
            console.log('🎤 Locutor desconectado');
        }
        
        console.log(`👋 Oyente desconectado: ${socket.id} | Total: ${listeners.size}`);
        io.emit('listeners-update', { count: listeners.size });
    });
});

// =============================================
// RUTAS - Servir Frontend
// =============================================

// Ruta para panel de administrador
app.get('/admin', (req, res) => {
    const adminPath = path.join(__dirname, '../frontend/admin.html');
    console.log(`Petición a /admin`);
    
    if (fs.existsSync(adminPath)) {
        res.sendFile(adminPath);
    } else {
        console.error('ERROR: No encuentro admin.html en:', adminPath);
        res.status(500).send(`Error: No encuentro el archivo frontend/admin.html`);
    }
});

// Ruta principal - Panel de oyentes
app.get('/', (req, res) => {
    const indexPath = path.join(__dirname, '../frontend/index.html');
    console.log(`Petición a root: ${req.url}`);
    
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        console.error('ERROR CRÍTICO: No encuentro index.html en:', indexPath);
        res.status(500).send(`Error: No encuentro el archivo frontend/index.html`);
    }
});

// Catch-all para otras rutas (SPA)
app.get('*', (req, res) => {
    const indexPath = path.join(__dirname, '../frontend/index.html');
    console.log(`Petición catch-all: ${req.url}`);
    
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.status(404).send('Página no encontrada');
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
    console.log(`   POST /api/login         - Login de administrador`);
    console.log(`   GET  /api/listeners    - Número de oyentes`);
    console.log(`   GET  /api/info         - Info del servidor`);
    console.log(`   GET  /api/health       - Estado del servidor`);
    console.log('');
});
