const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

// Statische Dateien (HTML, JS, CSS) aus dem Hauptordner bereitstellen
app.use(express.static(__dirname));

io.on('connection', (socket) => {
    console.log('Neues Gerät verbunden:', socket.id);

    // Handy schickt Fernsteuerungs-Befehl
    socket.on('remote_spin', (data) => {
        console.log('Signal vom Handy empfangen! Ziel-Index:', data.targetIndex);
        // An alle verbundenen Geräte (auch das Glücksrad) weiterleiten
        io.emit('trigger_spin', { targetIndex: data.targetIndex });
    });
});

// Port dynamisch von Render zuweisen lassen
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server läuft erfolgreich auf Port ${PORT}`);
});
