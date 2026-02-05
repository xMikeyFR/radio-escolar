# PROMPT COMPLETO: Implementación de Audio en Tiempo Real con WebRTC

## CONTEXTO Y PROBLEMA INICIAL

Estás desarrollando una aplicación de "radio en vivo" 1 a muchos (un locutor transmite, múltiples oyentes escuchan) usando:
- **Frontend**: JavaScript puro (vanilla JS), sin frameworks
- **Backend**: Node.js + Express + Socket.io
- **Hosting**: Render (HTTPS)
- **Requisitos**: 
  - El locutor captura audio del micrófono
  - Los oyentes escuchan el audio en tiempo real
  - Los oyentes ven un visualizador de ondas de sonido
  - Debe funcionar en Chrome/Edge (política de autoplay estricta)

## ERRORES COMUNES QUE DEBES EVITAR

### ❌ ERROR 1: Usar MediaRecorder con chunks WebM
**Problema**: MediaRecorder genera chunks WebM fragmentados que NO se pueden decodificar individualmente con `decodeAudioData()`. Los chunks parciales fallan al decodificar.

**Solución**: Usar **WebRTC con RTCPeerConnection** para streaming de audio en tiempo real.

### ❌ ERROR 2: Intentar reproducir audio automáticamente
**Problema**: Chrome bloquea `audioElement.play()` y `AudioContext` si no hay interacción previa del usuario (política de autoplay).

**Solución**: 
- NO usar `autoplay` en elementos `<audio>`
- Guardar el stream como "pendiente" y reproducirlo SOLO después de interacción del usuario
- El visualizador puede conectarse inmediatamente (no requiere interacción)

### ❌ ERROR 3: No crear conexiones con oyentes existentes
**Problema**: Si el locutor inicia la transmisión DESPUÉS de que los oyentes ya están conectados, no se crean conexiones WebRTC con ellos.

**Solución**: Cuando el locutor inicia transmisión, solicitar lista de oyentes actuales y crear conexiones con TODOS.

### ❌ ERROR 4: Crear AudioContext al cargar la página
**Problema**: Si creas `AudioContext` en `DOMContentLoaded`, Chrome lo marca como "suspended" y requiere interacción del usuario.

**Solución**: Crear `AudioContext` solo cuando sea necesario (cuando recibes el stream) y NO conectarlo a `destination` para el visualizador.

---

## ARQUITECTURA DE LA SOLUCIÓN

### Tecnología: WebRTC con RTCPeerConnection

**¿Por qué WebRTC?**
- Streaming de audio en tiempo real (baja latencia)
- No requiere decodificar chunks fragmentados
- El stream se recibe directamente como `MediaStream`
- Compatible con políticas de autoplay (se puede asignar a `<audio srcObject>`)

**Flujo general:**
1. **Locutor**: Captura micrófono → Crea RTCPeerConnection por cada oyente → Envía offer
2. **Servidor**: Reenvía offer/answer/ICE candidates (signaling)
3. **Oyente**: Recibe offer → Crea answer → Recibe stream → Reproduce en `<audio>`

---

## IMPLEMENTACIÓN PASO A PASO

### PARTE 1: BACKEND (server.js) - Signaling WebRTC

```javascript
// Configuración WebRTC
let broadcasterId = null; // ID del locutor activo
const listeners = new Set(); // IDs de todos los oyentes
const adminSessions = new Map(); // IDs de admins autenticados

io.on('connection', (socket) => {
    // Agregar oyente
    listeners.add(socket.id);
    io.emit('listeners-update', { count: listeners.size });

    // Autenticación admin
    socket.on('admin-auth', (data) => {
        if (data.username === 'ADMINISTRADOR' && data.password === '987654321') {
            adminSessions.set(socket.id, true);
            socket.emit('admin-authenticated', { success: true });
        }
    });

    // ============================================
    // WEBRTC SIGNALING - CRÍTICO
    // ============================================
    
    // 1. Locutor notifica que está listo
    socket.on('broadcaster-ready', () => {
        if (adminSessions.has(socket.id)) {
            broadcasterId = socket.id;
            socket.broadcast.emit('broadcaster-ready'); // Notificar a oyentes
        }
    });
    
    // 2. Locutor solicita lista de oyentes actuales (CRÍTICO)
    socket.on('get-current-listeners', () => {
        if (adminSessions.has(socket.id)) {
            const currentListeners = Array.from(listeners).filter(id => id !== socket.id);
            socket.emit('current-listeners', currentListeners);
        }
    });
    
    // 3. Notificar al locutor cuando llega un nuevo oyente
    setTimeout(() => {
        if (broadcasterId && !adminSessions.has(socket.id)) {
            io.to(broadcasterId).emit('new-listener', socket.id);
        }
    }, 100);
    
    // 4. Reenviar offer del locutor al oyente
    socket.on('webrtc-offer', (data) => {
        const { offer, to } = data;
        if (adminSessions.has(socket.id)) {
            io.to(to).emit('webrtc-offer', {
                offer: offer,
                from: socket.id
            });
        }
    });
    
    // 5. Reenviar answer del oyente al locutor
    socket.on('webrtc-answer', (data) => {
        const { answer, to } = data;
        io.to(to).emit('webrtc-answer', {
            answer: answer,
            from: socket.id
        });
    });
    
    // 6. Reenviar ICE candidates (bidireccional)
    socket.on('webrtc-ice-candidate', (data) => {
        const { candidate, to } = data;
        io.to(to).emit('webrtc-ice-candidate', {
            candidate: candidate,
            from: socket.id
        });
    });

    // Limpiar al desconectar
    socket.on('disconnect', () => {
        listeners.delete(socket.id);
        adminSessions.delete(socket.id);
        if (broadcasterId === socket.id) {
            broadcasterId = null;
        }
        io.emit('listeners-update', { count: listeners.size });
    });
});
```

**Puntos críticos del servidor:**
- ✅ El servidor SOLO hace signaling (reenvía mensajes), NO procesa audio
- ✅ Debe notificar al locutor sobre oyentes existentes cuando inicia transmisión
- ✅ Debe notificar al locutor sobre nuevos oyentes que se conectan después

---

### PARTE 2: FRONTEND LOCUTOR (admin.js)

```javascript
// Estado
let state = {
    isAdmin: false,
    socket: null,
    mediaStream: null, // Stream del micrófono
    isRecording: false,
    peerConnections: new Map(), // listenerId -> RTCPeerConnection
    audioContext: null, // Para visualizador del locutor
    analyser: null
};

// Configuración WebRTC
const rtcConfig = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
};

// ============================================
// PASO 1: CAPTURAR MICRÓFONO
// ============================================
async function startRecording() {
    if (!state.isAdmin || state.isRecording) return;

    try {
        // 1.1. Capturar micrófono
        state.mediaStream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            } 
        });

        // 1.2. Conectar al visualizador (opcional, para que el locutor vea sus ondas)
        if (!state.audioContext) {
            state.audioContext = new AudioContext();
            state.analyser = state.audioContext.createAnalyser();
            const source = state.audioContext.createMediaStreamSource(state.mediaStream);
            source.connect(state.analyser);
            // Iniciar visualizador...
        }

        // 1.3. Notificar al servidor que estamos listos
        state.socket.emit('broadcaster-ready');
        
        // 1.4. CRÍTICO: Solicitar lista de oyentes actuales
        state.socket.emit('get-current-listeners');
        
        state.isRecording = true;
        console.log('🎤 Transmisión iniciada');

    } catch (error) {
        console.warn('⚠️ Error al acceder al micrófono:', error.message);
    }
}

// ============================================
// PASO 2: RECIBIR LISTA DE OYENTES Y CREAR CONEXIONES
// ============================================
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

// Cuando llega un nuevo oyente después de iniciar transmisión
state.socket.on('new-listener', (listenerId) => {
    console.log('👂 Nuevo oyente conectado:', listenerId);
    if (state.isRecording && state.mediaStream) {
        createPeerConnection(listenerId);
    }
});

// ============================================
// PASO 3: CREAR RTCPEERCONNECTION Y ENVIAR OFFER
// ============================================
async function createPeerConnection(listenerId) {
    // Evitar duplicados
    if (state.peerConnections.has(listenerId)) {
        console.log('⚠️ Ya existe conexión con oyente:', listenerId);
        return;
    }
    
    try {
        // 3.1. Crear RTCPeerConnection
        const pc = new RTCPeerConnection(rtcConfig);
        
        // 3.2. CRÍTICO: Agregar tracks del micrófono a la conexión
        if (state.mediaStream) {
            state.mediaStream.getTracks().forEach(track => {
                pc.addTrack(track, state.mediaStream);
                console.log('✅ Track agregado:', track.kind);
            });
        } else {
            console.error('❌ No hay mediaStream disponible');
            return;
        }
        
        // 3.3. Manejar ICE candidates (para conexión P2P)
        pc.onicecandidate = (event) => {
            if (event.candidate) {
                state.socket.emit('webrtc-ice-candidate', {
                    candidate: event.candidate,
                    to: listenerId
                });
            }
        };
        
        // 3.4. Manejar cambios de estado de conexión
        pc.onconnectionstatechange = () => {
            console.log(`📡 Estado conexión con ${listenerId}:`, pc.connectionState);
            if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
                pc.close();
                state.peerConnections.delete(listenerId);
            }
        };
        
        // 3.5. Crear y enviar offer
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

// ============================================
// PASO 4: RECIBIR ANSWER DEL OYENTE
// ============================================
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

// ============================================
// PASO 5: RECIBIR ICE CANDIDATES DEL OYENTE
// ============================================
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
```

**Puntos críticos del locutor:**
- ✅ Debe solicitar lista de oyentes actuales al iniciar transmisión
- ✅ Debe crear una RTCPeerConnection por cada oyente
- ✅ Debe agregar tracks del micrófono con `pc.addTrack(track, stream)`
- ✅ Debe manejar answer y ICE candidates del oyente

---

### PARTE 3: FRONTEND OYENTE (app.js)

```javascript
// Estado
let state = {
    socket: null,
    peerConnection: null, // Una sola conexión con el locutor
    audioElement: null, // Elemento <audio> para reproducir
    audioContext: null, // Para visualizador
    analyser: null,
    userInteracted: false, // Flag para política de autoplay
    pendingStream: null // Stream guardado esperando interacción
};

// Configuración WebRTC (misma que locutor)
const rtcConfig = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
};

// ============================================
// INICIALIZACIÓN
// ============================================
function initializeElements() {
    elements = {
        volumeSlider: document.getElementById('volumeSlider'),
        muteBtn: document.getElementById('muteBtn'),
        visualizer: document.getElementById('visualizer'),
        listenersCount: document.getElementById('listenersCount')
    };
    
    // CRÍTICO: Crear elemento <audio> SIN autoplay
    state.audioElement = document.createElement('audio');
    state.audioElement.autoplay = false; // NO autoplay
    state.audioElement.controls = false;
    state.audioElement.style.display = 'none';
    state.audioElement.volume = state.currentVolume;
    document.body.appendChild(state.audioElement);
}

// Detectar interacción del usuario (para política de autoplay)
document.addEventListener('click', handleUserInteraction, { once: true });
document.addEventListener('keydown', handleUserInteraction, { once: true });

function handleUserInteraction() {
    if (!state.userInteracted) {
        state.userInteracted = true;
        console.log('✅ Usuario interactuó');
        
        // Reanudar AudioContext si está suspendido
        if (state.audioContext && state.audioContext.state === 'suspended') {
            state.audioContext.resume();
        }
        
        // Reproducir stream pendiente si existe
        if (state.pendingStream) {
            playPendingStream();
        }
    }
}

// ============================================
// PASO 1: RECIBIR OFFER DEL LOCUTOR
// ============================================
state.socket.on('webrtc-offer', async (data) => {
    const { offer, from } = data;
    console.log('📡 Recibido offer del locutor:', from);
    await handleOffer(offer, from);
});

// ============================================
// PASO 2: CREAR RTCPEERCONNECTION Y ANSWER
// ============================================
async function handleOffer(offer, from) {
    try {
        // 2.1. Crear RTCPeerConnection si no existe
        if (!state.peerConnection) {
            state.peerConnection = new RTCPeerConnection(rtcConfig);
            
            // 2.2. CRÍTICO: Cuando recibimos el stream, asignarlo a <audio>
            state.peerConnection.ontrack = (event) => {
                console.log('🎵 Stream recibido del locutor');
                const stream = event.streams[0];
                
                if (state.audioElement) {
                    // Asignar stream al elemento audio
                    state.audioElement.srcObject = stream;
                    
                    // CRÍTICO: Conectar al visualizador INMEDIATAMENTE
                    // (no requiere interacción del usuario)
                    connectStreamToVisualizer(stream);
                    
                    // Reproducir solo si el usuario ya interactuó
                    if (state.userInteracted) {
                        playPendingStream();
                    } else {
                        // Guardar como pendiente
                        state.pendingStream = stream;
                        console.log('⏳ Stream guardado, esperando interacción del usuario...');
                    }
                }
            };
            
            // 2.3. Manejar ICE candidates
            state.peerConnection.onicecandidate = (event) => {
                if (event.candidate) {
                    state.socket.emit('webrtc-ice-candidate', {
                        candidate: event.candidate,
                        to: from
                    });
                }
            };
            
            // 2.4. Manejar cambios de estado
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
        
        // 2.5. Configurar offer remoto
        await state.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        
        // 2.6. Crear y enviar answer
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

// ============================================
// PASO 3: CONECTAR STREAM AL VISUALIZADOR
// ============================================
function connectStreamToVisualizer(stream) {
    // Crear AudioContext solo cuando sea necesario
    if (!state.audioContext || !state.analyser) {
        try {
            state.audioContext = new AudioContext();
            state.analyser = state.audioContext.createAnalyser();
            state.analyser.fftSize = 128;
            state.analyser.smoothingTimeConstant = 0.8;
            drawVisualizer(); // Iniciar loop de dibujo
        } catch (e) {
            console.log("AudioContext no soportado:", e);
            return;
        }
    }
    
    try {
        // CRÍTICO: Conectar stream al analyser (NO a destination)
        const source = state.audioContext.createMediaStreamSource(stream);
        source.connect(state.analyser);
        // NO conectar analyser a destination (solo visualización, no reproducción)
        console.log('✅ Stream conectado al visualizador');
    } catch (e) {
        console.warn('⚠️ No se pudo conectar al visualizador:', e);
    }
}

// ============================================
// PASO 4: REPRODUCIR AUDIO (DESPUÉS DE INTERACCIÓN)
// ============================================
function playPendingStream() {
    if (!state.audioElement || !state.audioElement.srcObject) return;
    
    state.audioElement.play().then(() => {
        console.log('✅ Audio reproduciéndose correctamente');
        state.pendingStream = null;
    }).catch(err => {
        console.warn('⚠️ Error al reproducir audio:', err);
        // Guardar para intentar más tarde
        if (state.audioElement.srcObject) {
            state.pendingStream = state.audioElement.srcObject;
        }
    });
}

// ============================================
// PASO 5: RECIBIR ICE CANDIDATES DEL LOCUTOR
// ============================================
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

// ============================================
// CONTROLES DE VOLUMEN (ACTIVAR REPRODUCCIÓN)
// ============================================
elements.volumeSlider.addEventListener('input', (e) => {
    if (!state.userInteracted) {
        state.userInteracted = true;
        if (state.audioContext && state.audioContext.state === 'suspended') {
            state.audioContext.resume();
        }
        if (state.pendingStream) {
            playPendingStream();
        }
    }
    handleVolumeChange(e);
});

elements.muteBtn.addEventListener('click', () => {
    if (!state.userInteracted) {
        state.userInteracted = true;
        if (state.audioContext && state.audioContext.state === 'suspended') {
            state.audioContext.resume();
        }
        if (state.pendingStream) {
            playPendingStream();
        }
    }
    toggleMute();
});
```

**Puntos críticos del oyente:**
- ✅ NO usar `autoplay` en `<audio>`
- ✅ Guardar stream como "pendiente" si no hay interacción
- ✅ Conectar visualizador inmediatamente (no requiere interacción)
- ✅ Reproducir audio SOLO después de interacción del usuario
- ✅ Usar `audioElement.srcObject = stream` (NO `src`)

---

## CHECKLIST DE VERIFICACIÓN

### ✅ Locutor (admin.js)
- [ ] Captura micrófono con `getUserMedia({ audio: true })`
- [ ] Emite `broadcaster-ready` al iniciar
- [ ] Solicita lista de oyentes con `get-current-listeners`
- [ ] Crea RTCPeerConnection por cada oyente
- [ ] Agrega tracks con `pc.addTrack(track, stream)`
- [ ] Crea y envía offer
- [ ] Maneja answer y ICE candidates

### ✅ Servidor (server.js)
- [ ] Reenvía `webrtc-offer` del locutor al oyente
- [ ] Reenvía `webrtc-answer` del oyente al locutor
- [ ] Reenvía `webrtc-ice-candidate` bidireccionalmente
- [ ] Responde `current-listeners` cuando locutor lo solicita
- [ ] Notifica `new-listener` al locutor cuando llega nuevo oyente

### ✅ Oyente (app.js)
- [ ] Crea `<audio>` SIN `autoplay`
- [ ] Recibe offer y crea answer
- [ ] Asigna stream a `audioElement.srcObject`
- [ ] Conecta stream al visualizador inmediatamente
- [ ] Guarda stream como "pendiente" si no hay interacción
- [ ] Reproduce audio SOLO después de interacción del usuario
- [ ] Maneja ICE candidates

---

## ERRORES COMUNES Y SOLUCIONES

### Error: "NotAllowedError: play() failed"
**Causa**: Intentaste reproducir audio sin interacción del usuario.
**Solución**: Guardar stream como "pendiente" y reproducir después de interacción.

### Error: "No se escucha audio"
**Causas posibles**:
1. Locutor no creó conexiones con oyentes existentes → Solicitar lista de oyentes
2. Stream no asignado a `srcObject` → Usar `audioElement.srcObject = stream`
3. AudioContext suspendido → Llamar `audioContext.resume()` después de interacción

### Error: "Visualizador no muestra ondas"
**Causa**: Stream no conectado al analyser.
**Solución**: Conectar stream al analyser inmediatamente cuando se recibe (no requiere interacción).

### Error: "Conexión WebRTC falla"
**Causas**:
1. ICE candidates no intercambiados → Verificar que servidor reenvíe candidates
2. STUN servers incorrectos → Usar servidores públicos de Google
3. Firewall/NAT → WebRTC puede requerir TURN server en producción

---

## RESUMEN DE FLUJO COMPLETO

```
1. LOCUTOR:
   - Presiona botón micrófono
   - Captura micrófono → mediaStream
   - Emite 'broadcaster-ready'
   - Solicita 'get-current-listeners'
   - Recibe lista de oyentes
   - Por cada oyente: crea RTCPeerConnection → addTrack → createOffer → envía offer

2. SERVIDOR:
   - Reenvía offer al oyente específico
   - Reenvía answer al locutor
   - Reenvía ICE candidates bidireccionalmente

3. OYENTE:
   - Recibe offer
   - Crea RTCPeerConnection
   - Crea answer → envía answer
   - Recibe stream en ontrack
   - Asigna stream a audioElement.srcObject
   - Conecta stream al visualizador (inmediato)
   - Guarda stream como "pendiente"
   - Usuario interactúa (click, tecla, volumen)
   - Reproduce audio con audioElement.play()
```

---

## NOTAS FINALES

1. **WebRTC es la solución correcta** para streaming de audio en tiempo real 1 a muchos
2. **Política de autoplay**: Siempre esperar interacción del usuario antes de reproducir
3. **Visualizador**: Puede conectarse inmediatamente (no requiere interacción)
4. **Oyentes existentes**: Siempre solicitar lista al iniciar transmisión
5. **HTTPS requerido**: WebRTC requiere HTTPS en producción (Render lo proporciona)

Este prompt contiene TODOS los pasos exactos que funcionaron. Sigue este flujo y evitarás los errores comunes.
