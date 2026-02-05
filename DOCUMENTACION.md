# 📻 Radio Escolar FM - Documentación del Proyecto

## 📋 Descripción General

**Radio Escolar FM** es una aplicación web de radio en vivo que permite a un administrador transmitir su voz en tiempo real a múltiples oyentes conectados simultáneamente. El proyecto fue desarrollado como parte del curso de **Aplicaciones Web Orientadas a Servicios**.

### Características Principales

- 🎤 **Transmisión en vivo**: El administrador puede hablar usando su micrófono
- 👂 **Múltiples oyentes**: Varios usuarios pueden escuchar simultáneamente
- 📊 **Visualizador de ondas**: Los oyentes ven las ondas de sonido en tiempo real
- 📱 **Soporte móvil**: Funciona en dispositivos móviles (Android e iOS)
- 🔢 **Contador de oyentes**: Muestra cuántas personas están escuchando

---

## 🛠️ Tecnologías Utilizadas

### Frontend
- **HTML5**: Estructura de la página
- **CSS3**: Estilos y diseño responsivo
- **JavaScript (Vanilla)**: Lógica de la aplicación, sin frameworks
- **WebRTC**: Para la transmisión de audio en tiempo real
- **Socket.io**: Comunicación en tiempo real entre cliente y servidor

### Backend
- **Node.js**: Entorno de ejecución del servidor
- **Express**: Framework web para crear el servidor
- **Socket.io**: Servidor de comunicación en tiempo real

### Hosting
- **Render**: Plataforma de hosting en la nube
- **GitHub**: Control de versiones y repositorio del código

---

## 🎵 Sistema de Audio

### ¿Cómo funciona el audio?

El proyecto utiliza **WebRTC (Web Real-Time Communication)** para transmitir audio en tiempo real. Esta tecnología permite que el audio del micrófono del administrador se transmita directamente a los oyentes sin necesidad de servidores intermedios que procesen el audio.

### Flujo del Audio

1. **Administrador (Locutor)**:
   - Presiona el botón del micrófono
   - El navegador captura el audio del micrófono
   - Se crea una conexión WebRTC con cada oyente
   - El audio se transmite en tiempo real

2. **Servidor**:
   - Coordina las conexiones entre el locutor y los oyentes
   - No procesa el audio, solo ayuda a establecer las conexiones

3. **Oyente**:
   - Recibe el audio del locutor
   - Puede ver las ondas de sonido en el visualizador
   - Controla el volumen con el deslizador

### Características del Audio

- **Baja latencia**: El audio se escucha casi instantáneamente
- **Calidad**: El audio mantiene buena calidad de voz
- **Soporte móvil**: Funciona en teléfonos Android e iOS
- **Política de autoplay**: Respeta las políticas del navegador (requiere interacción del usuario)

---

## 📁 Estructura del Proyecto

```
radio-escolar/
├── frontend/              # Interfaz de usuario
│   ├── index.html        # Página para oyentes
│   ├── admin.html        # Página para administrador
│   ├── css/
│   │   └── style.css     # Estilos de la aplicación
│   └── js/
│       ├── app.js        # Lógica para oyentes
│       └── admin.js      # Lógica para administrador
├── backend/
│   └── server.js         # Servidor Node.js
└── README.md             # Este archivo
```

---

## 🚀 Cómo Usar la Aplicación

### Para Oyentes

1. Abre la aplicación en tu navegador
2. Verás la interfaz de la radio con el visualizador de ondas
3. Cuando el administrador esté hablando:
   - Toca cualquier parte de la pantalla o el control de volumen
   - El audio comenzará a reproducirse
4. Usa el deslizador de volumen para ajustar el sonido

### Para Administrador

1. Ve a la ruta `/admin` en el navegador
2. Inicia sesión con las credenciales:
   - **Usuario**: `ADMINISTRADOR`
   - **Contraseña**: `987654321`
3. Presiona y mantén presionado el botón del micrófono para hablar
4. Suelta el botón para dejar de transmitir
5. Los oyentes escucharán tu voz en tiempo real

---

## 🔐 Credenciales de Administrador

- **Usuario**: `ADMINISTRADOR`
- **Contraseña**: `987654321`

**Nota**: Estas credenciales están configuradas en el servidor. En un entorno de producción, deberían almacenarse de forma segura.

---

## 📱 Compatibilidad

### Navegadores Soportados
- ✅ Google Chrome (recomendado)
- ✅ Microsoft Edge
- ✅ Mozilla Firefox
- ✅ Safari (iOS y macOS)

### Dispositivos
- ✅ Computadoras de escritorio (Windows, macOS, Linux)
- ✅ Tablets
- ✅ Teléfonos móviles (Android e iOS)

### Requisitos
- Conexión a internet estable
- Navegador moderno con soporte para WebRTC
- Micrófono (solo para administrador)
- Altavoces o auriculares (para oyentes)

---

## 🌐 Despliegue

El proyecto está desplegado en **Render** y accesible a través de:
- URL de producción: `radio-escolar.onrender.com`

### Proceso de Despliegue

1. El código se almacena en **GitHub**
2. **Render** detecta automáticamente los cambios
3. Se realiza el despliegue automático cuando hay actualizaciones

---

## 🎯 Funcionalidades Implementadas

### Panel de Oyentes
- ✅ Visualizador de ondas de sonido en tiempo real
- ✅ Control de volumen con deslizador
- ✅ Botón de silenciar/activar sonido
- ✅ Contador de oyentes conectados
- ✅ Indicador "EN VIVO"

### Panel de Administrador
- ✅ Sistema de login seguro
- ✅ Botón de micrófono para transmitir
- ✅ Visualizador de ondas del micrófono
- ✅ Control de volumen
- ✅ Contador de oyentes
- ✅ Botón de cerrar sesión

### Sistema de Audio
- ✅ Transmisión en tiempo real usando WebRTC
- ✅ Soporte para múltiples oyentes simultáneos
- ✅ Visualización de ondas de sonido
- ✅ Control de volumen individual
- ✅ Soporte para dispositivos móviles

---

## 🔧 Configuración del Servidor

### Variables de Entorno
- `PORT`: Puerto en el que corre el servidor (por defecto: 3001)

### Servicios API Disponibles
- `POST /api/login`: Autenticación de administrador
- `GET /api/listeners`: Obtener número de oyentes
- `GET /api/info`: Información del servidor
- `GET /api/health`: Estado del servidor

---

## 📝 Notas Importantes

### Política de Autoplay
Los navegadores modernos requieren que el usuario interactúe con la página antes de reproducir audio automáticamente. Por esta razón:
- Los oyentes deben tocar la pantalla o el control de volumen para escuchar
- Esto es una medida de seguridad del navegador, no un error de la aplicación

### Permisos del Micrófono
- El administrador debe otorgar permisos de micrófono cuando el navegador lo solicite
- Sin estos permisos, no se puede transmitir audio

### Conexión WebRTC
- La aplicación usa servidores STUN y TURN para establecer conexiones
- En algunos casos, puede tomar unos segundos establecer la conexión
- Si hay problemas de conexión, verifica tu firewall o red

---

## 🐛 Solución de Problemas Comunes

### No se escucha el audio
1. Verifica que hayas tocado la pantalla o el control de volumen
2. Asegúrate de que el volumen no esté en 0
3. Verifica que el administrador esté transmitiendo
4. Revisa la consola del navegador para ver mensajes de error

### El micrófono no funciona
1. Verifica que hayas otorgado permisos de micrófono
2. Asegúrate de que el micrófono esté conectado y funcionando
3. Verifica la configuración de audio de tu sistema

### No se conecta en móvil
1. Asegúrate de usar un navegador moderno (Chrome recomendado)
2. Verifica que tengas conexión a internet estable
3. Toca la pantalla para activar la reproducción de audio

---

## 👥 Autores

Proyecto desarrollado para el curso de **Aplicaciones Web Orientadas a Servicios**.

---

## 📄 Licencia

Este proyecto es de uso educativo.

---

## 🔗 Recursos Adicionales

- **Repositorio**: GitHub
- **Hosting**: Render
- **Documentación WebRTC**: MDN Web Docs
- **Socket.io**: Documentación oficial

---

**Última actualización**: 2025
