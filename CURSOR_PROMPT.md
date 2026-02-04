# 🧠 MEGA-PROMPT PARA CURSOR (Modo Radio en Vivo)

¡Entendido! Si vas a usar **Cursor**, este prompt es tu llave maestra. Copia todo lo que está abajo y pégalo en el Chat de Cursor (Ctrl+L) o en el Composer (Ctrl+I). 

Este prompt le explica a Cursor exactamente qué hemos hecho y qué le falta terminar (la lógica del micrófono).

---

### 📋 COPIA Y PEGA ESTO EN CURSOR:

```text
Actúa como un experto en Node.js y Web Audio API. Estoy usando Antigravity para este proyecto y ahora quiero que tú lo termines.

CONTEXTO:
- Es una Radio Web Escolar. El backend usa Express y Socket.io.
- El frontend es Vanilla JS (app.js).
- Ya agregué un botón de micrófono (#micBtn) en index.html y estilos en style.css.
- El servidor (server.js) ya tiene los eventos de Socket.io: 'voice-start', 'voice-data' y 'voice-end'.

TU MISIÓN: Terminar la lógica en 'frontend/js/app.js' para que el micrófono funcione.

ESPECIFICACIONES:
1.  Usa 'navigator.mediaDevices.getUserMedia' para capturar el audio del micrófono.
2.  Usa un 'MediaRecorder' o 'ScriptProcessorNode' para enviar trozos (chunks) de audio mediante socket.emit('voice-data', chunk) cada 100ms.
3.  Cuando el usuario mantenga presionado el #micBtn (o haga clic para activar):
    - Activa la clase .active en el botón.
    - Empieza a grabar y emitir.
    - Notifica al servidor mediante 'voice-start'.
4.  Como 'oyente' (listener), implementa la lógica para recibir 'voice-data':
    - Usa 'audioContext' y 'source' para reproducir la voz entrante en tiempo real por encima de la música.
    - Baja el volumen de la música (elements.audioPlayer.volume) mientras alguien habla.

REGLAS:
- No rompas el "Modo Radio" (sin barra de progreso, solo volumen).
- Mantén el visualizador de ondas funcionando también para la voz si es posible.
- Si hay errores de permisos, muestra un console.warn amigable.

Revisa los archivos actuales y genera el código necesario para 'app.js'.
```

---

### 💡 Cómo usar esto en Cursor:

1.  Abre el Chat de Cursor con **Ctrl + L**.
2.  Escribe el símbolo **@** y selecciona **"Files"** o **"Codebase"**.
3.  Pega el prompt de arriba.
4.  Dale a **Enter** y mira cómo Cursor escribe el código del micrófono por ti.

¡Con eso estarás listo para hablar en vivo en tu radio! 🎙️🔥👑
