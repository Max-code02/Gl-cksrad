/**
 * PROFI GLÜCKSRAD - ULTIMATE HYBRID EDITION
 * Features: High-DPI Canvas Engine, Dynamic Text Scaling, Web Audio Synthesizer,
 * Pointer Physics, Dev-Console & Hidden Hotkey Cheats.
 */

// --- 1. AUDIO MANAGEMENT SYSTEM ---
class AudioManager {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.isMuted = false;
        this.volume = 0.8;
    }

    init() {
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();
            this.masterGain = this.ctx.createGain();
            this.masterGain.connect(this.ctx.destination);
            this.updateVolume();
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        this.updateVolume();
        return this.isMuted;
    }

    setVolume(val) {
        this.volume = Math.max(0, Math.min(1, val));
        this.updateVolume();
        return this.volume;
    }

    updateVolume() {
        if (this.masterGain) {
            this.masterGain.gain.value = this.isMuted ? 0 : this.volume;
        }
    }

    playTick(speedFactor = 1) {
        if (this.isMuted) return;
        try {
            this.init();
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            const baseFreq = 140 + (speedFactor * 280);
            const duration = 0.02 + (0.025 * (1 - speedFactor));

            osc.type = speedFactor > 0.5 ? 'square' : 'triangle';
            osc.frequency.setValueAtTime(baseFreq, this.ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(35, this.ctx.currentTime + duration);

            const tickVolume = 0.15 + (speedFactor * 0.35);
            gain.gain.setValueAtTime(tickVolume, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

            osc.connect(gain);
            gain.connect(this.masterGain);

            osc.start();
            osc.stop(this.ctx.currentTime + duration);
        } catch (e) {}
    }

    playFanfare() {
        if (this.isMuted) return;
        try {
            this.init();
            const notes = [261.63, 329.63, 392.00, 523.25, 392.00, 523.25, 659.25, 1046.50];

            notes.forEach((freq, index) => {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();

                const isLast = index === notes.length - 1;
                osc.type = isLast ? 'square' : 'sine';

                const startTime = this.ctx.currentTime + index * 0.08;
                const duration = isLast ? 1.4 : 0.12;

                osc.frequency.setValueAtTime(freq, startTime);

                gain.gain.setValueAtTime(0, startTime);
                gain.gain.linearRampToValueAtTime(0.35, startTime + 0.02);
                gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

                osc.connect(gain);
                gain.connect(this.masterGain);

                osc.start(startTime);
                osc.stop(startTime + duration);
            });
        } catch (e) {}
    }
}

const audio = new AudioManager();

// --- 2. FARBPALETTE & DEFAULT VALUES ---
const PALETTE = [
    { main: "#6366F1", glow: "#818cf8" },
    { main: "#EC4899", glow: "#f472b6" },
    { main: "#8B5CF6", glow: "#a78bfa" },
    { main: "#10B981", glow: "#34d399" },
    { main: "#F59E0B", glow: "#fbbf24" },
    { main: "#06B6D4", glow: "#22d3ee" },
    { main: "#F43F5E", glow: "#fb7185" },
    { main: "#3B82F6", glow: "#60a5fa" },
    { main: "#14B8A6", glow: "#2dd4bf" },
    { main: "#A855F7", glow: "#c084fc" }
];

const DEFAULT_OPTIONS = [
    "Popcorn (klein)", "Popcorn (mittel)", "Popcorn (groß)",
    "Nachos mit Käse", "Eistee 0.5L", "Gutschein 5€"
];

// --- 3. STATE MANAGEMENT ---
let options = [];
let currentRotation = 0;
let currentVelocity = 0;
let isSpinning = false;
let animationFrameId = null;
let lastTickSegment = -1;
let activeIndex = -1;
let pulseTime = 0;

const config = {
    _focusState: -1, // -1 = Zufall, ansonsten gezielter Ziel-Index
    spinDuration: 6000
};

// --- 4. DOM ELEMENTE ---
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

// --- 5. DEV-CONSOLE INJECTION ---
function buildDevConsole() {
    if (document.getElementById('devConsolePanel')) return;

    const panel = document.createElement('div');
    panel.id = 'devConsolePanel';
    panel.style.cssText = `
        position: fixed; top: 15px; left: 15px; background: rgba(15, 23, 42, 0.95);
        color: #e2e8f0; padding: 15px; border-radius: 8px; font-family: monospace; font-size: 12px;
        z-index: 10000; display: none; border: 1px solid #334155; box-shadow: 0 10px 25px rgba(0,0,0,0.5);
        backdrop-filter: blur(5px); width: 260px;
    `;

    panel.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 10px; color: #38bdf8; border-bottom: 1px solid #334155; padding-bottom: 5px; display: flex; justify-content: space-between;">
            <span>⚙️ Dev-Engine Settings</span>
            <span style="color: #64748b; font-size: 10px;">[K]</span>
        </div>
        
        <div style="margin-bottom: 10px;">
            <label style="display: block; margin-bottom: 4px;">Master Volume (<span id="volDisplay">80</span>%)</label>
            <input type="range" id="devVol" min="0" max="100" value="80" style="width: 100%;">
        </div>

        <div style="margin-bottom: 10px;">
            <label style="display: block; margin-bottom: 4px;">Animation Duration (ms)</label>
            <input type="number" id="devDur" value="6000" style="width: 100%; background: #1e293b; color: white; border: 1px solid #475569; padding: 4px; border-radius: 4px;">
        </div>

        <div style="margin-bottom: 5px;">
            <label style="display: block; margin-bottom: 4px;">Target Focus Index (-1 = Auto)</label>
            <input type="number" id="devFocus" value="-1" min="-1" style="width: 100%; background: #1e293b; color: white; border: 1px solid #475569; padding: 4px; border-radius: 4px;">
            <div id="devFocusName" style="color: #38bdf8; margin-top: 4px; font-style: italic; font-weight: bold;">Auto (Random)</div>
        </div>
    `;

    document.body.appendChild(panel);

    document.getElementById('devVol').addEventListener('input', (e) => {
        const val = parseInt(e.target.value) / 100;
        audio.setVolume(val);
        document.getElementById('volDisplay').innerText = Math.round(val * 100);
    });

    document.getElementById('devDur').addEventListener('input', (e) => {
        config.spinDuration = Math.max(1000, parseInt(e.target.value) || 6000);
    });

    document.getElementById('devFocus').addEventListener('input', (e) => {
        updateFocusState(parseInt(e.target.value));
    });
}

function updateFocusState(index) {
    if (isNaN(index)) index = -1;
    config._focusState = (index >= options.length) ? -1 : index;

    const input = document.getElementById('devFocus');
    const nameDisplay = document.getElementById('devFocusName');

    if (input && parseInt(input.value) !== config._focusState) {
        input.value = config._focusState;
    }

    if (nameDisplay) {
        if (config._focusState === -1) {
            nameDisplay.innerText = "Auto (Random)";
            nameDisplay.style.color = "#94a3b8";
        } else {
            nameDisplay.innerText = `Target [${config._focusState + 1}]: ${options[config._focusState]}`;
            nameDisplay.style.color = "#38bdf8";
        }
    }
}

// --- 6. INITIALISIERUNG & CANVAS SETUP ---
function init() {
    buildDevConsole();
    loadOptions();
    renderList();
    resizeCanvas();
    setupEventListeners();
}

function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    let displayWidth, displayHeight;

    if (document.fullscreenElement) {
        displayWidth = window.innerWidth;
        displayHeight = window.innerHeight;
    } else {
        const container = canvas.parentElement;
        displayWidth = container ? container.clientWidth : 800;
        displayHeight = container ? container.clientHeight : 800;
    }

    canvas.width = displayWidth * dpr;
    canvas.height = displayHeight * dpr;
    canvas.style.width = `${displayWidth}px`;
    canvas.style.height = `${displayHeight}px`;

    ctx.resetTransform();
    ctx.scale(dpr, dpr);

    drawWheel();
}

function loadOptions() {
    const saved = localStorage.getItem('profi_wheel_data');
    if (saved) {
        try {
            options = JSON.parse(saved);
        } catch (e) {
            options = [...DEFAULT_OPTIONS];
        }
    } else {
        options = [...DEFAULT_OPTIONS];
    }
}

function saveOptions() {
    localStorage.setItem('profi_wheel_data', JSON.stringify(options));
    updateFocusState(config._focusState);
}

function toggleFullscreen() {
    if (!document.fullscreenElement) {
        canvas.parentElement.requestFullscreen().catch(() => {});
    } else {
        document.exitFullscreen().catch(() => {});
    }
}

// --- 7. EVENT LISTENERS & HOTKEYS ---
function setupEventListeners() {
    addForm.addEventListener('submit', (e) => { e.preventDefault(); addOption(); });
    resetBtn.addEventListener('click', resetOptions);
    spinBtn.addEventListener('click', () => { audio.init(); startSpin(); });

    canvas.addEventListener('click', () => {
        audio.init();
        if (!isSpinning && options.length > 0) startSpin();
    });

    closeModalBtn.addEventListener('click', closeModal);
    winnerModal.addEventListener('click', (e) => {
        if (e.target === winnerModal) closeModal();
    });

    window.addEventListener('resize', resizeCanvas);
    document.addEventListener('fullscreenchange', resizeCanvas);

    window.addEventListener('keydown', (e) => {
        if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName) && e.code !== 'Escape') {
            return;
        }

        // Dev-Console Toggle (K)
        if (e.key.toLowerCase() === 'k') {
            e.preventDefault();
            const panel = document.getElementById('devConsolePanel');
            if (panel) panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        }

        // Tasten-Cheats (1-9 und 0)
        if (e.key >= '1' && e.key <= '9') {
            const targetIdx = parseInt(e.key) - 1;
            if (targetIdx < options.length) {
                updateFocusState(targetIdx);
                flashCanvasFeedback();
            }
        }

        if (e.key === '0') {
            updateFocusState(-1);
            flashCanvasFeedback();
        }

        // Lautstärke (+ / - oder Pfeiltasten)
        if (e.key === '+' || e.key === 'ArrowUp') {
            e.preventDefault();
            syncVolumeUI(audio.setVolume(audio.volume + 0.1));
        }
        if (e.key === '-' || e.key === 'ArrowDown') {
            e.preventDefault();
            syncVolumeUI(audio.setVolume(audio.volume - 0.1));
        }

        // Vollbild (F)
        if (e.key.toLowerCase() === 'f') {
            e.preventDefault();
            toggleFullscreen();
        }

        // Mute Toggle (M)
        if (e.key.toLowerCase() === 'm') {
            e.preventDefault();
            const muted = audio.toggleMute();
            canvas.style.filter = muted ? 'grayscale(30%)' : 'none';
        }

        // Drehen (Leertaste)
        if (e.code === 'Space' && !isSpinning && options.length > 0) {
            e.preventDefault();
            audio.init();
            startSpin();
        }

        if (e.code === 'Escape') closeModal();
    });
}

function flashCanvasFeedback() {
    canvas.style.opacity = '0.85';
    setTimeout(() => canvas.style.opacity = '1', 120);
}

function syncVolumeUI(val) {
    const slider = document.getElementById('devVol');
    const display = document.getElementById('volDisplay');
    if (slider && display) {
        slider.value = Math.round(val * 100);
        display.innerText = Math.round(val * 100);
    }
}

// --- 8. LIST & OPTION MANAGEMENT ---
function renderList() {
    optionsList.innerHTML = '';
    itemCount.textContent = options.length;

    options.forEach((option, index) => {
        const li = document.createElement('li');
        li.className = 'option-item';

        const color = PALETTE[index % PALETTE.length].main;
        li.innerHTML = `
            <div class="option-color-preview" style="background-color: ${color};">
                <span style="font-size: 10px; color: white; opacity: 0.5;">${index + 1}</span>
            </div>
            <span class="option-text" title="${option}">${option}</span>
            <button class="btn-delete" title="Löschen" onclick="deleteOption(${index})">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </button>
        `;
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
        activeIndex = -1;
        renderList();
        drawWheel();
        optionsList.scrollTo({ top: optionsList.scrollHeight, behavior: 'smooth' });
    }
    optionInput.focus();
}

window.deleteOption = function(index) {
    if (isSpinning) return;
    options.splice(index, 1);
    activeIndex = -1;
    if (config._focusState >= options.length) updateFocusState(-1);
    renderList();
    drawWheel();
};

function resetOptions() {
    if (isSpinning) return;
    if (confirm("Möchtest du wirklich alle Optionen löschen?")) {
        options = [];
        activeIndex = -1;
        updateFocusState(-1);
        renderList();
        drawWheel();
    }
}

function closeModal() {
    winnerModal.classList.remove('active');
    activeIndex = -1;
    drawWheel();
    spinBtn.focus();
}

// --- 9. CANVAS RENDERING ENGINE (ULTRA MULTI-LINE & AUTO-SQUISH) ---
function drawWheel() {
    const width = canvas.width / (window.devicePixelRatio || 1);
    const height = canvas.height / (window.devicePixelRatio || 1);
    const centerX = width / 2;
    const centerY = height / 2;

    const radius = Math.min(centerX, centerY) - (document.fullscreenElement ? 80 : 30);
    const hubRadius = Math.max(35, Math.min(60, radius * 0.18)); // Dynamische Nabe

    ctx.clearRect(0, 0, width, height);

    if (document.fullscreenElement) {
        ctx.fillStyle = "#0f172a";
        ctx.fillRect(0, 0, width, height);
    }

    if (options.length === 0) {
        return drawEmptyWheel(centerX, centerY, radius);
    }

    const sliceAngle = (2 * Math.PI) / options.length;

    options.forEach((option, i) => {
        const startAngle = currentRotation + i * sliceAngle;
        const endAngle = startAngle + sliceAngle;
        const isActive = (i === activeIndex);

        let highlightPulse = 0;
        if (isActive) {
            pulseTime += 0.05;
            highlightPulse = (Math.sin(pulseTime) + 1) / 2;
        }

        // Segment zeichnen
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius + (isActive ? 12 * highlightPulse : 0), startAngle, endAngle);
        ctx.closePath();

        const colorSet = PALETTE[i % PALETTE.length];
        ctx.fillStyle = isActive ? colorSet.glow : colorSet.main;
        ctx.fill();

        ctx.lineWidth = 3;
        ctx.strokeStyle = "#0f172a";
        ctx.stroke();

        // Text im Segment zeichnen (Ultra-Engine)
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(startAngle + sliceAngle / 2);

        drawUltraFittedText(ctx, option, radius, hubRadius, sliceAngle);

        ctx.restore();
    });

    // Äußerer Zierring
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.lineWidth = 8;
    ctx.strokeStyle = "#1e293b";
    ctx.stroke();

    // Nabe (Mittelkreis)
    drawHub(centerX, centerY, hubRadius);

    if (activeIndex !== -1 && !isSpinning) {
        requestAnimationFrame(drawWheel);
    }
}

function drawUltraFittedText(ctx, text, radius, hubRadius, sliceAngle) {
    const outerMargin = 20;
    const innerMargin = hubRadius + 12;
    const availableLength = radius - outerMargin - innerMargin;

    // Maximale Winkelbreite des Segments am mittleren Radius
    const midRadius = (radius + hubRadius) / 2;
    const maxArcWidth = Math.max(16, 2 * midRadius * Math.sin(sliceAngle / 2) * 0.82);

    // 1. Wort-Wrapping & Zeilenberechnung
    const words = text.trim().split(/\s+/);
    let lines = [];
    
    let fontSize = Math.min(32, Math.max(12, Math.floor((radius * 1.2) / Math.max(6, options.length))));
    ctx.font = `bold ${fontSize}px system-ui, -apple-system, sans-serif`;

    let currentLine = words[0] || "";

    for (let i = 1; i < words.length; i++) {
        const testLine = currentLine + " " + words[i];
        if (ctx.measureText(testLine).width > availableLength && currentLine.length > 0) {
            lines.push(currentLine);
            currentLine = words[i];
        } else {
            currentLine = testLine;
        }
    }
    if (currentLine) lines.push(currentLine);

    // Auf max. 3 Zeilen beschränken
    if (lines.length > 3) {
        const topLines = lines.slice(0, 2);
        topLines.push(lines.slice(2).join(" "));
        lines = topLines;
    }

    // 2. Schriftgröße an Winkelbreite & Zeilenanzahl anpassen
    const lineHeight = fontSize * 1.1;
    const totalHeight = lines.length * lineHeight;

    if (totalHeight > maxArcWidth) {
        fontSize = Math.max(10, Math.floor(maxArcWidth / (lines.length * 1.15)));
        ctx.font = `bold ${fontSize}px system-ui, -apple-system, sans-serif`;
    }

    const finalLineHeight = fontSize * 1.1;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#ffffff";

    // 3. Zeichnen mit Stauchungs-Garantie (kein '...' Cutoff!)
    const startX = radius - outerMargin;

    lines.forEach((line, index) => {
        ctx.save();
        const yOffset = (index - (lines.length - 1) / 2) * finalLineHeight;
        
        const lineWidth = ctx.measureText(line).width;
        let scaleX = 1;

        if (lineWidth > availableLength) {
            scaleX = availableLength / lineWidth;
        }

        ctx.translate(startX, yOffset);
        if (scaleX < 1) {
            ctx.scale(scaleX, 1);
        }

        ctx.shadowColor = "rgba(0, 0, 0, 0.7)";
        ctx.shadowBlur = 4;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 1;

        ctx.fillText(line, 0, 0);
        ctx.restore();
    });
}

function drawEmptyWheel(x, y, radius) {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
    ctx.fillStyle = "#1e293b";
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#334155";
    ctx.stroke();

    ctx.fillStyle = "#94a3b8";
    ctx.font = "bold 20px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Keine Optionen vorhanden", x, y);
}

function drawHub(x, y, radius) {
    ctx.save();
    ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
    ctx.shadowBlur = 12;

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
    ctx.fillStyle = "#ffffff";
    ctx.fill();

    ctx.lineWidth = 4;
    ctx.strokeStyle = "#cbd5e1";
    ctx.stroke();
    ctx.restore();
}

// --- 10. SPIN ANIMATION & PHYSIK ---
function startSpin() {
    if (isSpinning || options.length === 0) return;

    audio.init();
    isSpinning = true;
    spinBtn.disabled = true;
    activeIndex = -1;

    const startRotation = currentRotation;
    let targetRotation = 0;

    const extraSpins = (Math.floor(Math.random() * 4) + 6) * 2 * Math.PI;
    const sliceAngle = (2 * Math.PI) / options.length;

    // Manipulierter Gewinner (Cheat Check)
    if (config._focusState !== -1 && config._focusState < options.length) {
        const targetSegmentCenter = config._focusState * sliceAngle + (sliceAngle / 2);
        let requiredMod = (1.5 * Math.PI - targetSegmentCenter) % (2 * Math.PI);
        if (requiredMod < 0) requiredMod += 2 * Math.PI;

        const randomJitter = (Math.random() * 0.4 - 0.2) * sliceAngle;
        targetRotation = startRotation + extraSpins + requiredMod + randomJitter - (startRotation % (2 * Math.PI));
    } else {
        targetRotation = startRotation + extraSpins + (Math.random() * 2 * Math.PI);
    }

    let startTime = null;
    let lastTimestamp = null;
    let lastRotation = startRotation;

    const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

    function spinLoop(timestamp) {
        if (!startTime) startTime = timestamp;
        if (!lastTimestamp) lastTimestamp = timestamp;

        const elapsed = timestamp - startTime;
        const deltaTime = timestamp - lastTimestamp;
        lastTimestamp = timestamp;

        const progress = Math.min(elapsed / config.spinDuration, 1);

        currentRotation = startRotation + (targetRotation - startRotation) * easeOutCubic(progress);

        if (deltaTime > 0) {
            currentVelocity = (currentRotation - lastRotation) / (deltaTime / 16.66);
        }
        lastRotation = currentRotation;

        checkTickSound();
        drawWheel();

        if (progress < 1) {
            animationFrameId = requestAnimationFrame(spinLoop);
        } else {
            currentVelocity = 0;
            isSpinning = false;
            spinBtn.disabled = false;
            handleResult();
        }
    }

    animationFrameId = requestAnimationFrame(spinLoop);
}

function checkTickSound() {
    const sliceAngle = (2 * Math.PI) / options.length;
    let pointerAngle = (1.5 * Math.PI - (currentRotation % (2 * Math.PI))) % (2 * Math.PI);
    if (pointerAngle < 0) pointerAngle += 2 * Math.PI;

    const currentSegment = Math.floor(pointerAngle / sliceAngle);

    if (currentSegment !== lastTickSegment && lastTickSegment !== -1) {
        const speedFactor = Math.min(1, Math.abs(currentVelocity) * 1.4);
        audio.playTick(speedFactor);

        if (pointerEl) {
            const intensity = Math.max(6, Math.min(30, currentVelocity * 35));
            pointerEl.style.transform = `translateX(-50%) rotate(-${intensity}deg)`;
            setTimeout(() => {
                pointerEl.style.transform = 'translateX(-50%) rotate(0deg)';
            }, 55);
        }
    }
    lastTickSegment = currentSegment;
}

// --- 11. ERGEBNIS & CELEBRATION ---
function handleResult() {
    const sliceAngle = (2 * Math.PI) / options.length;
    let pointerAngle = (1.5 * Math.PI - (currentRotation % (2 * Math.PI))) % (2 * Math.PI);
    if (pointerAngle < 0) pointerAngle += 2 * Math.PI;

    activeIndex = Math.floor(pointerAngle / sliceAngle);
    const winner = options[activeIndex];

    pulseTime = 0;
    drawWheel();

    audio.playFanfare();

    // Zeige immer das Modal & Konfetti an, egal ob Vollbild oder normal (ohne den Vollbildmodus zu verlassen)
    winnerText.innerHTML = winner;
    winnerModal.classList.add('active');
    triggerConfetti();
}

function triggerConfetti() {
    if (typeof confetti !== 'function') return;
    confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 },
        colors: PALETTE.map(p => p.main)
    });
}

// --- 12. INITIALIZATION TRIGGER ---
window.addEventListener('DOMContentLoaded', init);
