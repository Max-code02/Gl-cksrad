/**
 * EXTREMES GLÜCKSRAD - PRO SCRIPT ✨
 * Features: Web Audio API Synthesizer (Ticks & Fanfare), LocalStorage Persistence,
 * Keyboard-Shortcuts, physikalische Segment-Klick-Erkennung & Multi-Confetti.
 */

// --- Audio-Synthesizer (Web Audio API - keine externen Dateien nötig!) ---
class SoundEffects {
    constructor() {
        this.ctx = null;
    }

    init() {
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    // Erzeugt das mechanische "Klick"-Geräusch beim Drehen
    playTick() {
        try {
            this.init();
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(120, this.ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + 0.04);
            
            gain.gain.setValueAtTime(0.5, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.04);
            
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            
            osc.start();
            osc.stop(this.ctx.currentTime + 0.04);
        } catch (e) {
            // Audio ignoriert, falls vom Browser vor Nutzerinteraktion blockiert
        }
    }

    // Erzeugt eine festliche Sieges-Fanfare beim Anhalten
    playFanfare() {
        try {
            this.init();
            const notes = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5 (C-Dur Akkord)
            notes.forEach((freq, index) => {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, this.ctx.currentTime + index * 0.1);
                
                gain.gain.setValueAtTime(0, this.ctx.currentTime + index * 0.1);
                gain.gain.linearRampToValueAtTime(0.3, this.ctx.currentTime + index * 0.1 + 0.05);
                gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + index * 0.1 + 0.8);
                
                osc.connect(gain);
                gain.connect(this.ctx.destination);
                
                osc.start(this.ctx.currentTime + index * 0.1);
                osc.stop(this.ctx.currentTime + index * 0.1 + 0.8);
            });
        } catch (e) {}
    }
}

const sfx = new SoundEffects();

// --- Konfiguration & Farb-Palette ---
const PALETTE = [
    "#6366F1", "#EC4899", "#8B5CF6", "#10B981", 
    "#F59E0B", "#06B6D4", "#F43F5E", "#3B82F6", 
    "#14B8A6", "#A855F7", "#E11D48", "#84CC16"
];

const DEFAULT_OPTIONS = [
    "🍕 Pizza bestellen", "🍔 Burger & Pommes", "🍣 Sushi Abend",
    "🌮 Tacos & Burritos", "🥗 Frischer Salat", "🍜 Ramen Bowl",
    "🍿 Kino & Popcorn", "🍦 Eiscreme holen"
];

// State-Management mit LocalStorage Support
let options = [];
let currentRotation = 0;
let isSpinning = false;
let animationFrameId = null;
let lastTickSegment = -1;

// --- DOM Elemente ---
const canvas = document.getElementById('wheelCanvas');
const ctx = canvas.getContext('2d');
const spinBtn = document.getElementById('spinBtn');
const addForm = document.getElementById('addForm');
const optionInput = document.getElementById('optionInput');
const optionsList = document.getElementById('optionsList');
const itemCount = document.getElementById('itemCount');
const resetBtn = document.getElementById('resetBtn');
const winnerModal = document.getElementById('winnerModal');
const winnerText = document.getElementById('winnerText');
const closeModalBtn = document.getElementById('closeModalBtn');
const pointerEl = document.querySelector('.pointer');

// --- Initialisierung ---
function init() {
    loadOptions();
    renderList();
    drawWheel();
    setupEventListeners();
}

function loadOptions() {
    const saved = localStorage.getItem('gluecksrad_options');
    if (saved) {
        try {
            options = JSON.parse(saved);
        } catch(e) {
            options = [...DEFAULT_OPTIONS];
        }
    } else {
        options = [...DEFAULT_OPTIONS];
    }
}

function saveOptions() {
    localStorage.setItem('gluecksrad_options', JSON.stringify(options));
}

function setupEventListeners() {
    addForm.addEventListener('submit', addOption);
    resetBtn.addEventListener('click', resetOptions);
    spinBtn.addEventListener('click', () => { sfx.init(); spinWheel(); });
    
    canvas.addEventListener('click', () => {
        sfx.init();
        if (!isSpinning && options.length > 0) spinWheel();
    });
    
    closeModalBtn.addEventListener('click', closeModal);
    winnerModal.addEventListener('click', (e) => {
        if (e.target === winnerModal) closeModal();
    });

    // Keyboard Shortcuts (Space zum Drehen, Esc für Modal/Input-Reset)
    window.addEventListener('keydown', (e) => {
        if (e.code === 'Space' && document.activeElement !== optionInput && !isSpinning && options.length > 0) {
            e.preventDefault();
            sfx.init();
            spinWheel();
        }
        if (e.code === 'Escape') {
            if (winnerModal.classList.contains('active')) closeModal();
            if (document.activeElement === optionInput) optionInput.blur();
        }
    });
}

// --- Optionen verwalten ---
function renderList() {
    optionsList.innerHTML = '';
    itemCount.textContent = options.length;

    options.forEach((option, index) => {
        const li = document.createElement('li');
        li.className = 'option-item';

        const colorPreview = document.createElement('div');
        colorPreview.className = 'option-color-preview';
        colorPreview.style.backgroundColor = PALETTE[index % PALETTE.length];

        const span = document.createElement('span');
        span.className = 'option-text';
        span.textContent = option;
        span.title = option;

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn-delete';
        deleteBtn.title = 'Löschen';
        deleteBtn.innerHTML = `
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
        `;
        deleteBtn.onclick = () => deleteOption(index);

        li.appendChild(colorPreview);
        li.appendChild(span);
        li.appendChild(deleteBtn);
        optionsList.appendChild(li);
    });

    spinBtn.disabled = options.length === 0 || isSpinning;
    saveOptions();
}

function addOption() {
    const text = optionInput.value.trim();
    if (text && !isSpinning) {
        options.push(text);
        optionInput.value = '';
        renderList();
        drawWheel();
        optionsList.scrollTop = optionsList.scrollHeight;
    } else if (!text) {
        // Visuelles Feedback bei leerem Input
        optionInput.style.borderColor = 'var(--danger)';
        setTimeout(() => optionInput.style.borderColor = '', 800);
    }
    optionInput.focus();
}

function deleteOption(index) {
    if (isSpinning) return;
    options.splice(index, 1);
    renderList();
    drawWheel();
}

function resetOptions() {
    if (isSpinning) return;
    if (confirm("Möchtest du wirklich alle Optionen löschen?")) {
        options = [];
        renderList();
        drawWheel();
    }
}

function closeModal() {
    winnerModal.classList.remove('active');
    spinBtn.focus();
}

// --- Glücksrad Zeichnen (Canvas) ---
function drawWheel() {
    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(centerX, centerY) - 20;

    ctx.clearRect(0, 0, width, height);

    // Leerer Zustand
    if (options.length === 0) {
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        ctx.fillStyle = "#1c263f";
        ctx.fill();
        ctx.lineWidth = 4;
        ctx.strokeStyle = "#263354";
        ctx.stroke();

        ctx.fillStyle = "#94a3b8";
        ctx.font = "bold 24px 'Plus Jakarta Sans', sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("Keine Optionen vorhanden", centerX, centerY);
        return;
    }

    const sliceAngle = (2 * Math.PI) / options.length;

    options.forEach((option, i) => {
        const startAngle = currentRotation + i * sliceAngle;
        const endAngle = startAngle + sliceAngle;

        // Segment zeichnen
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, startAngle, endAngle);
        ctx.closePath();

        ctx.fillStyle = PALETTE[i % PALETTE.length];
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = "#0b0f19";
        ctx.stroke();

        // Text im Segment zeichnen
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(startAngle + sliceAngle / 2);

        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#ffffff";
        
        // Dynamische Schriftgrößen-Berechnung
        const fontSize = Math.max(15, Math.min(26, 340 / options.length));
        ctx.font = `800 ${fontSize}px 'Plus Jakarta Sans', sans-serif`;
        
        // Text-Schatten für maximale Lesbarkeit
        ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
        ctx.shadowBlur = 8;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 1;

        // Text intelligent kürzen
        let displayText = option;
        if (displayText.length > 18) {
            displayText = displayText.substring(0, 16) + "...";
        }

        ctx.fillText(displayText, radius - 35, 0);
        ctx.restore();
    });

    // Äußerer Ring
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.lineWidth = 8;
    ctx.strokeStyle = "#1e293b";
    ctx.stroke();

    // Mittelpunkt (Nabe) - mit kleinem Schatten
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(centerX, centerY, 38, 0, 2 * Math.PI);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.restore();

    ctx.beginPath();
    ctx.arc(centerX, centerY, 38, 0, 2 * Math.PI);
    ctx.lineWidth = 6;
    ctx.strokeStyle = "#0f172a";
    ctx.stroke();

    // Innerer Akzentpunkt in der Nabe
    ctx.beginPath();
    ctx.arc(centerX, centerY, 14, 0, 2 * Math.PI);
    ctx.fillStyle = "#6366f1";
    ctx.fill();
}

// --- physikalische Klick-Erkennung währen der Drehung ---
function checkTickSound() {
    const sliceAngle = (2 * Math.PI) / options.length;
    // Berechne das aktuelle Segment am oberen Zeiger (270 Grad / 1.5 PI)
    let pointerAngle = (1.5 * Math.PI - (currentRotation % (2 * Math.PI))) % (2 * Math.PI);
    if (pointerAngle < 0) pointerAngle += 2 * Math.PI;

    const currentSegment = Math.floor(pointerAngle / sliceAngle);

    if (currentSegment !== lastTickSegment && lastTickSegment !== -1) {
        sfx.playTick();
        
        // Kleine Zeiger-Animation (Bounce-Effekt via CSS-Style)
        if (pointerEl) {
            pointerEl.style.transform = 'translateX(-50%) rotate(-15deg)';
            setTimeout(() => {
                pointerEl.style.transform = 'translateX(-50%) rotate(0deg)';
            }, 50);
        }
    }
    lastTickSegment = currentSegment;
}

// --- Dreh-Mechanismus & Animation ---
function spinWheel() {
    if (isSpinning || options.length === 0) return;

    isSpinning = true;
    spinBtn.disabled = true;
    optionInput.disabled = true;
    lastTickSegment = -1;

    // Mehr Umdrehungen für mehr Spannung (7 bis 11 Volldrehungen)
    const extraSpins = (Math.floor(Math.random() * 5) + 7) * 2 * Math.PI;
    const randomOffset = Math.random() * 2 * Math.PI;
    const startRotation = currentRotation;
    const targetRotation = startRotation + extraSpins + randomOffset;

    const duration = 6000; // 6 Sekunden für sanftes Auslaufen
    let startTime = null;

    // Easing-Funktion: easeOutQuart für realistischen Reibungswiderstand
    const easeOutQuart = (t) => 1 - Math.pow(1 - t, 4);

    function animate(timestamp) {
        if (!startTime) startTime = timestamp;
        const elapsed = timestamp - startTime;
        const progress = Math.min(elapsed / duration, 1);

        currentRotation = startRotation + (targetRotation - startRotation) * easeOutQuart(progress);
        
        checkTickSound();
        drawWheel();

        if (progress < 1) {
            animationFrameId = requestAnimationFrame(animate);
        } else {
            isSpinning = false;
            optionInput.disabled = false;
            renderList();
            evaluateWinner();
        }
    }

    animationFrameId = requestAnimationFrame(animate);
}

// --- Gewinner-Auswertung ---
function evaluateWinner() {
    const sliceAngle = (2 * Math.PI) / options.length;
    
    let pointerAngle = (1.5 * Math.PI - (currentRotation % (2 * Math.PI))) % (2 * Math.PI);
    if (pointerAngle < 0) {
        pointerAngle += 2 * Math.PI;
    }

    const winningIndex = Math.floor(pointerAngle / sliceAngle);
    const winner = options[winningIndex];

    // Sound, Modal & Konfetti auslösen
    sfx.playFanfare();
    winnerText.textContent = winner;
    winnerModal.classList.add('active');
    triggerConfetti();
}

// --- Multi-Stage Konfetti Effekt ---
function triggerConfetti() {
    if (typeof confetti !== 'function') return;

    const duration = 3000;
    const end = Date.now() + duration;

    // 1. Sofortiger Knall aus der Mitte
    confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 }
    });

    // 2. Kontinuierlicher Konfetti-Regen an den Rändern für 3 Sekunden
    (function frame() {
        confetti({
            particleCount: 4,
            angle: 60,
            spread: 55,
            origin: { x: 0 },
            colors: PALETTE
        });
        confetti({
            particleCount: 4,
            angle: 120,
            spread: 55,
            origin: { x: 1 },
            colors: PALETTE
        });

        if (Date.now() < end) {
            requestAnimationFrame(frame);
        }
    }());
}

// --- Start ---
window.addEventListener('DOMContentLoaded', init);
