# Radio Escolar FM - Documentación Completa del Proyecto

## ¿Qué es este proyecto?

Radio Escolar FM es una aplicación web de radio en vivo donde un administrador puede transmitir su voz en tiempo real a múltiples oyentes conectados simultáneamente. Fue desarrollado para la materia de Aplicaciones Web Orientadas a Servicios.

La aplicación permite que un locutor hable por su micrófono y que varias personas lo escuchen al mismo tiempo, como una radio tradicional pero funcionando completamente por internet.

---

## Tecnologías Utilizadas

### Frontend (Interfaz de Usuario)

**HTML5**
- Se usó para crear la estructura de las páginas
- Dos páginas principales: una para oyentes (`index.html`) y otra para administrador (`admin.html`)

**CSS3**
- Para todos los estilos y el diseño visual
- Diseño responsivo que funciona en computadoras y móviles
- Animaciones para el visualizador de ondas y el indicador "EN VIVO"

**JavaScript (Vanilla)**
- Sin frameworks ni librerías adicionales
- Se usó JavaScript puro para toda la lógica
- Dos archivos principales: `app.js` (para oyentes) y `admin.js` (para administrador)

### Backend (Servidor)

**Node.js**
- Entorno de ejecución de JavaScript del lado del servidor
- Permite correr JavaScript fuera del navegador
- Versión utilizada: la más reciente estable

**Express**
- Framework web para Node.js
- Facilita la creación del servidor HTTP
- Maneja las rutas y las peticiones del cliente

**Socket.io**
- Librería para comunicación en tiempo real
- Permite que el servidor y los clientes se comuniquen instantáneamente
- Esencial para coordinar las conexiones WebRTC

### APIs y Servicios Externos

**WebRTC API**
- API del navegador para comunicación en tiempo real
- Permite capturar audio del micrófono
- Establece conexiones peer-to-peer entre locutor y oyentes
- No requiere servidores adicionales para procesar el audio

**MediaDevices API**
- API del navegador para acceder a dispositivos multimedia
- Se usa `getUserMedia()` para capturar el micrófono
- Requiere permisos del usuario

**Web Audio API**
- API del navegador para procesar y analizar audio
- Se usa para crear el visualizador de ondas de sonido
- Permite analizar las frecuencias del audio en tiempo real

**Socket.io Client API**
- API del lado del cliente para Socket.io
- Se carga desde un CDN (Content Delivery Network)
- Permite que el frontend se comunique con el servidor en tiempo real

### Servidores STUN y TURN

**STUN Servers (Google)**
- `stun:stun.l.google.com:19302`
- `stun:stun1.l.google.com:19302`
- Ayudan a descubrir la dirección IP pública cuando hay un router/NAT
- Necesarios para que WebRTC funcione en la mayoría de redes

**TURN Servers (Metered.ca)**
- `turn:openrelay.metered.ca:80`
- `turn:openrelay.metered.ca:443`
- `turn:openrelay.metered.ca:443?transport=tcp`
- Actúan como intermediarios cuando no se puede conectar directamente
- Especialmente importantes para móviles y redes restrictivas

### Hosting y Control de Versiones

**GitHub**
- Repositorio para guardar el código
- Control de versiones con Git
- Permite trabajar en diferentes versiones del proyecto

**Render**
- Plataforma de hosting en la nube
- Despliega automáticamente desde GitHub
- Proporciona HTTPS automáticamente (necesario para WebRTC)

---

## ¿Cuántas APIs se utilizaron?

Se utilizaron **5 APIs principales**:

1. **WebRTC API** - Para la transmisión de audio en tiempo real
2. **MediaDevices API** - Para acceder al micrófono
3. **Web Audio API** - Para el visualizador de ondas
4. **Socket.io API** - Para comunicación en tiempo real con el servidor
5. **Fetch API** - Para hacer peticiones HTTP al servidor (login, obtener información)

Además se utilizaron servicios externos (STUN/TURN) que no son APIs del navegador pero son necesarios para que WebRTC funcione.

---

## ¿Por qué se eligió cada tecnología?

### Node.js y Express

Node.js se eligió porque Socket.io funciona perfectamente con él. Socket.io es esencial para este proyecto porque necesitamos que el servidor y los clientes se comuniquen en tiempo real sin tener que estar haciendo peticiones constantes.

Express es el framework estándar para Node.js. Es simple, rápido de configurar y tiene una gran comunidad. No necesitábamos algo más complejo.

### JavaScript Puro (Sin Frameworks)

Se decidió usar JavaScript puro sin frameworks como React o Vue porque:
- El proyecto no es tan complejo como para necesitar un framework
- JavaScript puro se carga más rápido
- No necesita compilación ni herramientas adicionales
- Es más fácil de entender y mantener para un proyecto de este tamaño

### WebRTC para el Audio

Esta fue la decisión más importante. WebRTC se eligió porque:

1. **Está diseñado para tiempo real**: A diferencia de otras opciones, WebRTC está hecho específicamente para comunicación en tiempo real. El audio fluye continuamente sin interrupciones.

2. **Baja latencia**: El audio viaja casi directamente del locutor al oyente, entonces hay muy poco delay.

3. **No procesa en el servidor**: El servidor solo ayuda a "presentar" a las personas, pero el audio no pasa por él. Esto reduce la carga del servidor y mejora la calidad.

4. **Es la tecnología estándar**: Aplicaciones profesionales como Zoom, Google Meet y Discord usan WebRTC. Es la opción correcta para este tipo de aplicaciones.

### Socket.io para la Comunicación

Socket.io se eligió porque:
- Permite comunicación bidireccional en tiempo real
- Es más eficiente que hacer polling (preguntar cada segundo si hay algo nuevo)
- Tiene reconexión automática si se pierde la conexión
- Funciona bien con Node.js
- Es fácil de usar y tiene buena documentación

### Render para el Hosting

Render se eligió porque:
- Tiene un plan gratuito que es suficiente para este proyecto
- Se conecta automáticamente con GitHub
- Detecta cambios automáticamente y despliega sin intervención manual
- Proporciona HTTPS automáticamente (necesario para que WebRTC funcione)
- Es fácil de configurar, solo conectas el repositorio y listo

---

## ¿Cómo se creó este proyecto? Proceso paso a paso

### 1. Configuración Inicial

Primero se creó la estructura básica del proyecto:
- Carpeta `frontend` para todo lo del cliente (HTML, CSS, JavaScript)
- Carpeta `backend` para el servidor
- Archivo `package.json` para las dependencias de Node.js

### 2. Creación del Servidor

Se creó `server.js` con Express y Socket.io:
- Express para servir las páginas HTML y manejar las rutas
- Socket.io para la comunicación en tiempo real
- Rutas API REST para login, obtener información del servidor, etc.
- Manejo de sesiones de administrador

### 3. Interfaz de Usuario

Se crearon dos páginas HTML:
- `index.html`: Para los oyentes, con visualizador, controles de volumen y contador de oyentes
- `admin.html`: Para el administrador, con login, botón de micrófono y controles

Se diseñó con CSS un estilo moderno y responsivo que funciona bien en diferentes dispositivos.

### 4. Implementación del Sistema de Audio

Esta fue la parte más compleja:

**Para el Administrador (`admin.js`):**
- Captura del micrófono usando `getUserMedia()`
- Creación de conexiones WebRTC con cada oyente
- Envío de "offers" de conexión a través de Socket.io
- Manejo de respuestas ("answers") de los oyentes
- Intercambio de información de red (ICE candidates)

**Para los Oyentes (`app.js`):**
- Recepción de "offers" del administrador
- Creación de "answers" y envío de vuelta
- Recepción del stream de audio cuando se establece la conexión
- Asignación del stream a un elemento `<audio>` oculto
- Conexión del audio al visualizador de ondas
- Manejo de la política de autoplay (esperar interacción del usuario)

### 5. Visualizador de Ondas

Se implementó usando Web Audio API:
- Se crea un `AudioContext` y un `AnalyserNode`
- El audio se conecta al analyser
- Se obtienen datos de frecuencia constantemente
- Se dibuja en un `<canvas>` usando barras que representan las frecuencias

### 6. Soporte para Móviles

Se agregaron varias cosas para que funcione en móviles:
- Atributo `playsinline` en el elemento `<audio>` (necesario para iOS)
- Audio inicialmente en `muted` (requerido por algunos navegadores móviles)
- Eventos `touchstart` además de `click` para detectar interacción
- Servidores TURN adicionales para conexiones en redes restrictivas

---

## ¿Cómo se subió a GitHub?

### Paso 1: Crear el Repositorio

1. Se creó un repositorio nuevo en GitHub llamado `radio-escolar`
2. Se inicializó Git en el proyecto local con `git init`
3. Se conectó el repositorio local con el remoto de GitHub

### Paso 2: Configurar Git

Se configuró Git con:
```bash
git config user.name "Tu Nombre"
git config user.email "tu@email.com"
```

### Paso 3: Hacer el Primer Commit

1. Se agregaron todos los archivos con `git add .`
2. Se hizo el primer commit con `git commit -m "Commit inicial"`
3. Se subió a GitHub con `git push origin main`

### Paso 4: Trabajo Continuo

Durante el desarrollo:
- Se hacían cambios en el código
- Se agregaban los cambios con `git add`
- Se hacían commits con mensajes descriptivos
- Se subían los cambios con `git push`

### Estructura de Commits

Los commits se organizaron con mensajes claros:
- `FEAT:` para nuevas funcionalidades
- `FIX:` para correcciones de errores
- `DOCS:` para documentación
- `REFACTOR:` para mejoras de código

---

## ¿Cómo se conectó con Render?

### Paso 1: Crear Cuenta en Render

1. Se creó una cuenta en render.com
2. Se conectó la cuenta de GitHub a Render

### Paso 2: Crear un Nuevo Servicio

1. En el dashboard de Render, se hizo clic en "New +"
2. Se seleccionó "Web Service"
3. Se eligió "Connect GitHub"
4. Se seleccionó el repositorio `radio-escolar`

### Paso 3: Configuración del Servicio

Render detectó automáticamente que es un proyecto Node.js y sugirió configuración:
- **Build Command**: `npm install` (instala las dependencias)
- **Start Command**: `node backend/server.js` (inicia el servidor)
- **Environment**: Node (versión más reciente)

### Paso 4: Variables de Entorno (si las hubiera)

En este proyecto no se necesitaron variables de entorno especiales, pero si las hubiera, se configurarían en la sección "Environment" del servicio.

### Paso 5: Despliegue Automático

Render automáticamente:
1. Clona el repositorio de GitHub
2. Instala las dependencias con `npm install`
3. Inicia el servidor
4. Proporciona una URL HTTPS (por ejemplo: `radio-escolar.onrender.com`)

### Paso 6: Despliegues Automáticos

Cada vez que se hace un `git push` a GitHub:
1. Render detecta el cambio automáticamente
2. Vuelve a clonar, instalar e iniciar
3. La aplicación se actualiza sin intervención manual

---

## Flujo Completo de la Aplicación

### Cuando un Oyente se Conecta:

1. El oyente abre la página en su navegador
2. Se carga `index.html` y `app.js`
3. Se establece conexión con Socket.io al servidor
4. El servidor agrega al oyente a la lista de oyentes
5. Se actualiza el contador para todos
6. Si hay un locutor transmitiendo, el servidor le avisa al locutor
7. El locutor crea una conexión WebRTC con el nuevo oyente
8. Se establece la conexión y el audio empieza a fluir
9. El oyente toca la pantalla para activar el audio
10. El audio se reproduce

### Cuando el Administrador Transmite:

1. El admin inicia sesión en `/admin`
2. Presiona el botón del micrófono
3. El navegador pide permiso para el micrófono
4. Se captura el audio con `getUserMedia()`
5. Se le avisa al servidor que está listo para transmitir
6. El servidor le envía la lista de oyentes actuales
7. Por cada oyente, se crea una conexión WebRTC
8. Se envían "offers" a cada oyente
9. Los oyentes responden con "answers"
10. Se intercambia información de red (ICE candidates)
11. Las conexiones se establecen
12. El audio fluye del admin a cada oyente
13. Los oyentes ven las ondas y escuchan el audio

---

## Problemas Encontrados y Soluciones

### Problema 1: El audio no se reproducía automáticamente

**Causa**: Los navegadores modernos bloquean la reproducción automática de audio por seguridad.

**Solución**: Guardar el stream como "pendiente" y solo reproducirlo cuando el usuario interactúa con la página (toca la pantalla, mueve el volumen, etc.).

### Problema 2: Los oyentes que se conectaban después no recibían audio

**Causa**: El administrador solo creaba conexiones con los oyentes que estaban conectados cuando iniciaba la transmisión.

**Solución**: Hacer que el servidor notifique al administrador cuando llega un nuevo oyente, y que el administrador cree una conexión con ese nuevo oyente.

### Problema 3: No funcionaba en móviles

**Causa**: Los móviles tienen políticas más estrictas y necesitan atributos especiales.

**Solución**: 
- Agregar `playsinline` al elemento `<audio>`
- Empezar con el audio en `muted` y desmutearlo después
- Agregar eventos `touchstart` para detectar interacción en móviles
- Agregar servidores TURN para conexiones en redes restrictivas

### Problema 4: WebRTC no conectaba en algunos casos

**Causa**: Algunas redes tienen NATs muy restrictivos que bloquean conexiones directas.

**Solución**: Agregar servidores TURN que actúan como intermediarios cuando no se puede conectar directamente.

---

## Estructura Final del Proyecto

```
radio-escolar/
├── frontend/
│   ├── index.html          # Página para oyentes
│   ├── admin.html          # Página para administrador
│   ├── css/
│   │   └── style.css       # Estilos de la aplicación
│   └── js/
│       ├── app.js          # Lógica para oyentes
│       └── admin.js        # Lógica para administrador
├── backend/
│   └── server.js           # Servidor Node.js
├── package.json            # Dependencias del proyecto
└── README.md               # Información básica
```

---

## Cómo Usar la Aplicación

### Para Oyentes:

1. Abre la aplicación en tu navegador (la URL de Render)
2. Verás la interfaz con el visualizador de ondas
3. Cuando el administrador esté transmitiendo, verás las ondas moverse
4. Toca cualquier parte de la pantalla o mueve el control de volumen
5. El audio comenzará a reproducirse
6. Ajusta el volumen con el deslizador

### Para Administrador:

1. Ve a `/admin` en la URL de la aplicación
2. Inicia sesión con:
   - Usuario: `ADMINISTRADOR`
   - Contraseña: `987654321`
3. Presiona y mantén presionado el botón del micrófono para hablar
4. Verás tus ondas de voz en el visualizador
5. Suelta el botón para dejar de transmitir
6. Los oyentes escucharán tu voz en tiempo real

---

## Resumen de Tecnologías y APIs

**Tecnologías del Backend:**
- Node.js
- Express
- Socket.io

**Tecnologías del Frontend:**
- HTML5
- CSS3
- JavaScript (Vanilla)

**APIs del Navegador:**
- WebRTC API
- MediaDevices API
- Web Audio API
- Socket.io Client API
- Fetch API

**Servicios Externos:**
- STUN Servers (Google)
- TURN Servers (Metered.ca)

**Hosting y Control de Versiones:**
- GitHub (repositorio)
- Render (hosting)

---

## Conclusión

Este proyecto demostró cómo se puede crear una aplicación de comunicación en tiempo real usando tecnologías web estándar. WebRTC es una tecnología poderosa que permite hacer cosas que antes solo eran posibles con aplicaciones nativas.

La aplicación funciona correctamente, permite transmisión en tiempo real, soporta múltiples oyentes simultáneos, funciona en diferentes dispositivos y tiene una interfaz clara y fácil de usar.

---

**Desarrollado para**: Aplicaciones Web Orientadas a Servicios
