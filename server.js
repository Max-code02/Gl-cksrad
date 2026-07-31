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
    res.status(200).json({ 
        status: 'online', 
        uptime: process.uptime(), 
        clients: io.engine.clientsCount,
        activeRooms: Object.keys(rooms).length 
    });
});

// 3. ZENTRALER RAUM-SPEICHER & CONFIG
const MASTER_PIN = process.env.MASTER_PIN || "9999"; // Geheimer Universalschlüssel fürs Handy
const SPIN_COOLDOWN_MS = 1200; // Mindestabstand zwischen Spins per Raum

// Datenstruktur pro Raum: { "8a": { options: [], forcedMainTarget: -1, lastSpinTime: 0 } }
const rooms = {};

// Hilfsfunktion zum Erstellen / Abrufen eines Raumes
function getOrCreateRoom(roomName) {
    const cleanName = String(roomName).toLowerCase().trim();
    if (!rooms[cleanName]) {
        rooms[cleanName] = {
            options: [],
            forcedMainTarget: -1,
            lastSpinTime: 0
        };
    }
    return cleanName;
}

// 4. SOCKET.IO REAL-TIME LOGIK (MULTI-ROOM SUPPORT)
io.on('connection', (socket) => {
    const time = () => new Date().toLocaleTimeString('de-DE');
    console.log(`[+] [${time()}] Gerät verbunden: ${socket.id}`);

    let currentRoom = null;

    // 🔑 RAUM BEITRETEN ODER MASTER-PIN PRÜFEN
    socket.on('join_room', (data = {}) => {
        const inputStr = typeof data === 'string' ? data : (data.roomName || data.pin || '');
        const cleanInput = String(inputStr).trim();

        // 1. MASTER-PIN CHECK (Universalschlüssel)
        if (cleanInput === MASTER_PIN || (data.pin && String(data.pin).trim() === MASTER_PIN)) {
            const activeRooms = Object.keys(rooms);
            console.log(`[👑] [${time()}] Master-PIN eingegeben von ${socket.id}. Aktive Räume: [${activeRooms.join(', ')}]`);
            socket.emit('master_room_list', activeRooms);
            return;
        }

        // 2. NORMALER RAUM-BEITRITT
        if (!cleanInput) return;

        const roomName = getOrCreateRoom(cleanInput);

        // Falls das Gerät vorher in einem anderen Raum war, alten Raum verlassen
        if (currentRoom) {
            socket.leave(currentRoom);
        }

        currentRoom = roomName;
        socket.join(currentRoom);

        const roomData = rooms[currentRoom];
        const roomClientsCount = io.sockets.adapter.rooms.get(currentRoom)?.size || 1;

        console.log(`[🏫] [${time()}] Gerät ${socket.id} ist Raum '${currentRoom}' beigetreten.`);

        // Initialen Zustand speziell für diesen Raum senden
        socket.emit('init_state', { 
            room: currentRoom,
            options: roomData.options, 
            clientsCount: roomClientsCount 
        });

        // Alle Geräte im selben Raum über Client-Anzahl informieren
        io.to(currentRoom).emit('client_count_changed', { count: roomClientsCount });
    });

    // Option-Sync für den aktuellen Raum
    socket.on('sync_options', (data = {}) => {
        if (!currentRoom || !rooms[currentRoom]) return;

        if (data && Array.isArray(data.options)) {
            // Begrenzung auf max. 100 Einträge & max. 50 Zeichen pro Wort
            rooms[currentRoom].options = data.options.slice(0, 100).map(opt => String(opt).trim().substring(0, 50));
            socket.to(currentRoom).emit('update_options', { options: rooms[currentRoom].options });
        }
    });

    // 🚀 Handy schaltet Falle am PC scharf (Raum-bezogen)
    socket.on('set_forced_main_target', (data) => {
        if (!currentRoom || !rooms[currentRoom]) return;

        if (data && typeof data.targetIndex === 'number') {
            rooms[currentRoom].forcedMainTarget = data.targetIndex;
            console.log(`[🎯] [${time()}] [Raum: ${currentRoom}] PC-Falle aktiviert! Nächster Klick landet auf Index: ${rooms[currentRoom].forcedMainTarget}`);
            
            // Haupt-Glücksrad im selben Raum benachrichtigen
            io.to(currentRoom).emit('arm_pc_trap', { targetIndex: rooms[currentRoom].forcedMainTarget });
        }
    });

    // 🚀 Sobald am PC gedreht wird (Falle schnappt zu)
    socket.on('notify_pc_spun', () => {
        if (!currentRoom || !rooms[currentRoom]) return;

        rooms[currentRoom].forcedMainTarget = -1; // Falle zurücksetzen
        console.log(`[🔄] [${time()}] [Raum: ${currentRoom}] Glücksrad wurde am PC gedreht. Falle resettet.`);
        io.to(currentRoom).emit('wheel_spun_on_pc'); // Handy-Status-Banner aktualisieren
    });

    // 🔥 ULTRA-ROBUSTER & SPAM-SICHERER SPIN-COMMAND (PRO RAUM)
    socket.on('remote_spin', (data = {}) => {
        if (!currentRoom || !rooms[currentRoom]) return;

        const roomData = rooms[currentRoom];
        const now = Date.now();

        // 1. Anti-Spam Check pro Raum
        if (now - roomData.lastSpinTime < SPIN_COOLDOWN_MS) {
            socket.emit('error_message', { message: 'Bitte warte einen Moment vor dem nächsten Dreh!' });
            return;
        }

        // 2. Strikte Validierung des Ziel-Index
        let targetIndex = undefined;
        if (data && typeof data.targetIndex === 'number' && Number.isInteger(data.targetIndex) && data.targetIndex >= 0) {
            targetIndex = data.targetIndex;
        }

        roomData.lastSpinTime = now;
        console.log(`[🚀] [${time()}] [Raum: ${currentRoom}] Dreh-Signal von ${socket.id} | Ziel: ${targetIndex ?? 'Zufall'}`);

        // Signal nur an Geräte im selben Raum senden
        io.to(currentRoom).emit('trigger_spin', { 
            targetIndex,
            triggeredBy: socket.id 
        });
    });

    // Trennung verarbeiten
    socket.on('disconnect', (reason) => {
        console.log(`[-] [${time()}] Gerät getrennt: ${socket.id} (${reason})`);
        
        if (currentRoom) {
            const roomClientsCount = io.sockets.adapter.rooms.get(currentRoom)?.size || 0;
            io.to(currentRoom).emit('client_count_changed', { count: roomClientsCount });
        }
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
    console.log(`🚀 GLÜCKSRAD SERVER (MULTI-ROOM EDITION) IS ONLINE`);
    console.log(`---------------------------------------------------`);
    console.log(`🖥️  Hauptseite:    ${DOMAIN}`);
    console.log(`📱 Fernbedienung: ${DOMAIN}/remote`);
    console.log(`🩺 Health-Check:  ${DOMAIN}/health`);
    console.log(`🔑 Master-PIN:    ${MASTER_PIN}`);
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
