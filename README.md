# 🎵 Radio Escolar FM

> Proyecto de Aplicaciones Web Orientadas a Servicios

Una estación de radio web moderna y funcional, diseñada para streaming de audio continuo con una interfaz minimalista y profesional.

![Radio Preview](https://picsum.photos/seed/radio_preview/800/400)

## 🚀 Características

- **Streaming de Audio**: Reproducción fluida de música.
- **Visualizador en Tiempo Real**: Ondas de frecuencia dinámicas (Web Audio API).
- **Socket.io**: Sincronización en tiempo real entre servidor y clientes.
- **Interfaz Premium**: Diseño limpio, oscuro y responsivo (Mobile-First).
- **Backend API**: Arquitectura orientada a servicios (REST).

## 🛠️ Tecnologías

- **Frontend**: HTML5, CSS3, JavaScript (Vanilla)
- **Backend**: Node.js, Express
- **Tiempo Real**: Socket.io
- **Audio**: Web Audio API

## 📦 Instalación Local

1. Clonar el repositorio:
   ```bash
   git clone https://github.com/tu-usuario/radio-escolar.git
   ```

2. Instalar dependencias:
   ```bash
   npm install
   ```

3. Iniciar servidor:
   ```bash
   npm start
   ```

4. Abrir en navegador: `http://localhost:3001`

## 🌐 Endpoints API

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/current-song` | Canción sonando actualmente |
| GET | `/api/playlist` | Lista de reproducción completa |
| GET | `/api/listeners` | Contador de oyentes en vivo |
| GET | `/api/info` | Información de la estación |
| POST | `/api/next-song` | Saltar a siguiente canción |

---

Desarrollado para la materia de **Aplicaciones Web Orientadas a Servicios**.
