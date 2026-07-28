const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);

// Socket.io mit verfeinerten Ping-Einstellungen für stabile Mobilverbindungen
const io = new Server(server, {
    cors: { origin: "*" },
    pingInterval: 10000,
    pingTimeout: 5000
});

// 1. STATISCHE DATEIEN BEREITSTELLEN
app.use(express.static(__dirname));

// 2. ROUTING (Hauptseite, Fernbedienung & Uptime Healthcheck)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/remote', (req, res) => {
    res.sendFile(path.join(__dirname, 'handy.html'));
});

// Health-Check Endpunkt (Perfekt für Uptime-Monitore oder Render Keep-Alive)
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'online', uptime: process.uptime(), clients: io.engine.clientsCount });
});

// 3. ZENTRALER SPEICHER & ANTI-SPAM PROTECTION
let globalOptions = [];
let lastSpinTime = 0;
const SPIN_COOLDOWN_MS = 1200; // Mindestabstand zwischen Spins (verhindert Button-Spam)

// 4. SOCKET.IO REAL-TIME LOGIK
io.on('connection', (socket) => {
    const time = () => new Date().toLocaleTimeString('de-DE');
    console.log(`[+] [${time()}] Gerät verbunden: ${socket.id}`);

    // Schicke initialen Zustand und verbundene Geräte-Anzahl
    socket.emit('init_state', { 
        options: globalOptions, 
        clientsCount: io.engine.clientsCount 
    });

    // Informs all clients about updated connection counts
    io.emit('client_count_changed', { count: io.engine.clientsCount });

    // Option-Sync von der Hauptseite (mit Array & String-Validierung)
    socket.on('sync_options', (data = {}) => {
        if (data && Array.isArray(data.options)) {
            // Begrenzung auf max. 100 Einträge & max. 50 Zeichen pro Wort (Schutz vor Server-Overload)
            globalOptions = data.options.slice(0, 100).map(opt => String(opt).trim().substring(0, 50));
            socket.broadcast.emit('update_options', { options: globalOptions });
        }
    });

    // 🔥 ULTRA-ROBUSTER & SPAM-SICHERER SPIN-COMMAND
    socket.on('remote_spin', (data = {}) => {
        const now = Date.now();

        // 1. Anti-Spam Check
        if (now - lastSpinTime < SPIN_COOLDOWN_MS) {
            socket.emit('error_message', { message: 'Bitte warte einen Moment vor dem nächsten Dreh!' });
            return;
        }

        // 2. Strikte Validierung des Ziel-Index (muss eine gültige Ganzzahl sein)
        let targetIndex = undefined;
        if (data && typeof data.targetIndex === 'number' && Number.isInteger(data.targetIndex) && data.targetIndex >= 0) {
            targetIndex = data.targetIndex;
        }

        lastSpinTime = now;
        console.log(`[🚀] [${time()}] Dreh-Signal von ${socket.id} | Ziel: ${targetIndex ?? 'Zufall'}`);

        // Signal an alle verbundenen Clients (Glücksrad-Displays) senden
        io.emit('trigger_spin', { 
            targetIndex,
            triggeredBy: socket.id 
        });
    });

    // Trennung verarbeiten
    socket.on('disconnect', (reason) => {
        console.log(`[-] [${time()}] Gerät getrennt: ${socket.id} (${reason})`);
        io.emit('client_count_changed', { count: io.engine.clientsCount });
    });
});

// 5. AUTOMATISCHER 404-FALLBACK (Leitet unbekannte Pfade auf die Hauptseite um)
app.use((req, res) => {
    res.redirect('/');
});

// 6. GLOBALER CRASH-SCHUTZSCHILD
process.on('uncaughtException', (err) => {
    console.error('🔥 [CRITICAL ERROR] Uncaught Exception:', err.stack || err.message);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('🔥 [CRITICAL ERROR] Unhandled Promise Rejection:', reason);
});

// 7. SERVER START & ELEGANTES SHUTDOWN MANAGEMENT
const PORT = process.env.PORT || 3000;
const DOMAIN = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;

server.listen(PORT, () => {
    console.clear();
    console.log(`===================================================`);
    console.log(`🚀 GLÜCKSRAD SERVER (ULTIMATE EDITION) IS ONLINE`);
    console.log(`---------------------------------------------------`);
    console.log(`🖥️  Hauptseite:   ${DOMAIN}`);
    console.log(`📱 Fernbedienung: ${DOMAIN}/remote`);
    console.log(`🩺 Health-Check:  ${DOMAIN}/health`);
    console.log(`⚙️  Port:          ${PORT}`);
    console.log(`===================================================`);
});

// Sauberes Beenden bei Render-Redeploys (Graceful Shutdown)
const gracefulShutdown = (signal) => {
    console.log(`\n⚠️ [${signal}] Server wird sauber heruntergefahren...`);
    server.close(() => {
        console.log('✅ Alle Verbindungen getrennt. Server gestoppt.');
        process.exit(0);
    });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
