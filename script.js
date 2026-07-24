/**
 * PROFI GLÜCKSRAD - ADVANCED EDITION
 * Features: Dynamisches Canvas-Rendering, Audio-Management, Fullscreen-API, Dev-Console
 */

class AudioManager {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.isMuted = false;
        this.volume = 0.8; // Standardlautstärke
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
            
            const baseFreq = 150 + (speedFactor * 300); 
            const duration = 0.02 + (0.03 * (1 - speedFactor)); 

            osc.type = speedFactor > 0.5 ? 'square' : 'triangle';
            osc.frequency.setValueAtTime(baseFreq, this.ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + duration);
            
            const tickVolume = (0.2 + (speedFactor * 0.4));
            gain.gain.setValueAtTime(tickVolume, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
            
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
                
                osc.type = index === notes.length - 1 ? 'square' : 'sine'; 
                
                const startTime = this.ctx.currentTime + index * 0.08;
                const duration = index === notes.length - 1 ? 1.5 : 0.1;

                osc.frequency.setValueAtTime(freq, startTime);
                
                gain.gain.setValueAtTime(0, startTime);
                gain.gain.linearRampToValueAtTime(0.4, startTime + 0.02);
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

const PALETTE = [
    { main: "#4F46E5", glow: "#818cf8" }, { main: "#DB2777", glow: "#f472b6" },
    { main: "#7C3AED", glow: "#a78bfa" }, { main: "#059669", glow: "#34d399" },
    { main: "#D97706", glow: "#fbbf24" }, { main: "#0891B2", glow: "#22d3ee" },
    { main: "#E11D48", glow: "#fb7185" }, { main: "#2563EB", glow: "#60a5fa" }
];

const DEFAULT_OPTIONS = [
    "Option 1", "Option 2", "Option 3", 
    "Option 4", "Option 5", "Option 6"
];

let options = [];
let currentRotation = 0;
let currentVelocity = 0; 
let isSpinning = false;
let animationFrameId = null;
let lastTickSegment = -1;
let activeIndex = -1; 
let pulseTime = 0;

// Config State (inklusive "Undercover" Cheat-Variablen)
const config = {
    _focusState: -1, // Der manipulierte Gewinner (-1 = normaler Zufall)
    spinDuration: 6000 // Dauer in ms
};

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

// --- DEV CONSOLE INJECTION ---
function buildDevConsole() {
    const panel = document.createElement('div');
    panel.id = 'devConsolePanel';
    // Styling sieht aus wie ein legitimes Debug-Fenster
    panel.style.cssText = `
        position: fixed; top: 15px; left: 15px; background: rgba(15, 23, 42, 0.95);
        color: #e2e8f0; padding: 15px; border-radius: 8px; font-family: monospace; font-size: 12px;
        z-index: 10000; display: none; border: 1px solid #334155; box-shadow: 0 10px 25px rgba(0,0,0,0.5);
        backdrop-filter: blur(5px); width: 250px;
    `;
    
    panel.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 10px; color: #38bdf8; border-bottom: 1px solid #334155; padding-bottom: 5px;">
            ⚙️ Render Engine Settings
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
            <div id="devFocusName" style="color: #94a3b8; margin-top: 4px; font-style: italic;">Auto (Random)</div>
        </div>
    `;
    
    document.body.appendChild(panel);

    // Event Listener für die versteckten Inputs
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
    config._focusState = index >= options.length ? -1 : index;
    
    const input = document.getElementById('devFocus');
    const nameDisplay = document.getElementById('devFocusName');
    
    if (input && input.value != config._focusState) input.value = config._focusState;
    
    if (config._focusState === -1) {
        if(nameDisplay) nameDisplay.innerText = "Auto (Random)";
    } else {
        if(nameDisplay) nameDisplay.innerText = `Target: ${options[config._focusState]}`;
    }
}
// --- END DEV CONSOLE ---

function init() {
    buildDevConsole();
    loadOptions();
    renderList();
    resizeCanvas();
    setupEventListeners();
}

function resizeCanvas() {
    if (document.fullscreenElement) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    } else {
        const container = canvas.parentElement;
        canvas.width = container ? container.clientWidth : 800;
        canvas.height = container ? container.clientHeight : 800;
    }
    drawWheel();
}

function loadOptions() {
    const saved = localStorage.getItem('profi_wheel_data');
    options = saved ? JSON.parse(saved) : [...DEFAULT_OPTIONS];
}

function saveOptions() {
    localStorage.setItem('profi_wheel_data', JSON.stringify(options));
    updateFocusState(config._focusState); // Aktualisiert den Text in der Dev-Console
}

function toggleFullscreen() {
    if (!document.fullscreenElement) {
        canvas.requestFullscreen().catch(() => {});
    } else {
        document.exitFullscreen();
    }
}

function setupEventListeners() {
    addForm.addEventListener('submit', (e) => { e.preventDefault(); addOption(); });
    resetBtn.addEventListener('click', resetOptions);
    spinBtn.addEventListener('click', startSpin);
    canvas.addEventListener('click', startSpin);
    
    closeModalBtn.addEventListener('click', closeModal);
    winnerModal.addEventListener('click', (e) => {
        if (e.target === winnerModal) closeModal();
    });

    window.addEventListener('resize', resizeCanvas);
    document.addEventListener('fullscreenchange', resizeCanvas);

    window.addEventListener('keydown', (e) => {
        // Ignoriere Hotkeys, wenn wir in einem Textfeld tippen (außer ESC)
        if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName) && e.code !== 'Escape') {
            return;
        }
        
        // DEV CONSOLE TOGGLE (Taste 'K')
        if (e.key.toLowerCase() === 'k') {
            e.preventDefault();
            const panel = document.getElementById('devConsolePanel');
            panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        }

        // Tasten-Cheats (1-9 und 0)
        if (e.key >= '1' && e.key <= '9') {
            const targetIdx = parseInt(e.key) - 1;
            if (targetIdx < options.length) {
                updateFocusState(targetIdx);
                // Subtiles visuelles Feedback
                canvas.style.opacity = '0.9';
                setTimeout(() => canvas.style.opacity = '1', 150);
            }
        }
        
        if (e.key === '0') {
            updateFocusState(-1);
            canvas.style.opacity = '0.9';
            setTimeout(() => canvas.style.opacity = '1', 150);
        }

        // LAUTSTÄRKE STEUERUNG (+ / - oder Pfeil hoch/runter)
        if (e.key === '+' || e.key === 'ArrowUp') {
            e.preventDefault();
            const newVal = audio.setVolume(audio.volume + 0.1);
            syncVolumeUI(newVal);
        }
        if (e.key === '-' || e.key === 'ArrowDown') {
            e.preventDefault();
            const newVal = audio.setVolume(audio.volume - 0.1);
            syncVolumeUI(newVal);
        }

        // VOLLBILD (F)
        if (e.key.toLowerCase() === 'f') {
            e.preventDefault();
            toggleFullscreen();
        }

        // MUTE TOGGLE (M)
        if (e.key.toLowerCase() === 'm') {
            e.preventDefault();
            const muted = audio.toggleMute();
            canvas.style.filter = muted ? 'grayscale(20%)' : 'none';
        }

        // DREHEN (Leertaste)
        if (e.code === 'Space' && !isSpinning) {
            e.preventDefault();
            startSpin();
        }
        
        if (e.code === 'Escape') closeModal();
    });
}

// Hilfsfunktion um den Slider im Panel zu aktualisieren, wenn per Taste geändert wird
function syncVolumeUI(val) {
    const slider = document.getElementById('devVol');
    const display = document.getElementById('volDisplay');
    if (slider && display) {
        slider.value = Math.round(val * 100);
        display.innerText = Math.round(val * 100);
    }
}

function renderList() {
    optionsList.innerHTML = '';
    itemCount.textContent = options.length;

    options.forEach((option, index) => {
        const li = document.createElement('li');
        li.className = 'option-item';
        
        const color = PALETTE[index % PALETTE.length].main;
        li.innerHTML = `
            <div class="option-color-preview" style="background-color: ${color};">
                <span style="font-size: 10px; color: white; opacity: 0.3;">${index + 1}</span>
            </div>
            <span class="option-text">${option}</span>
            <button class="btn-delete" title="Löschen" onclick="deleteOption(${index})">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
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
    if (confirm("Möchten Sie die Liste wirklich leeren?")) {
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

function drawWheel() {
    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(centerX, centerY) - (document.fullscreenElement ? 80 : 25);

    ctx.clearRect(0, 0, width, height);

    if (document.fullscreenElement) {
        ctx.fillStyle = "#0f172a";
        ctx.fillRect(0, 0, width, height);
    }

    if (options.length === 0) return drawEmptyWheel(centerX, centerY, radius);

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

        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius + (isActive ? 15 * highlightPulse : 0), startAngle, endAngle);
        ctx.closePath();

        const colorSet = PALETTE[i % PALETTE.length];
        ctx.fillStyle = isActive ? colorSet.glow : colorSet.main;
        ctx.fill();
        
        ctx.lineWidth = 2;
        ctx.strokeStyle = "#ffffff";
        ctx.stroke();

        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(startAngle + sliceAngle / 2);
        
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        
        const fontSize = Math.max(16, Math.min(36, (radius * 1.5) / options.length));
        ctx.font = `bold ${isActive ? fontSize + 4 : fontSize}px sans-serif`;
        
        let displayText = option.length > 18 ? option.substring(0, 17) + "..." : option;
        
        ctx.fillStyle = "#ffffff";
        ctx.shadowBlur = 4;
        ctx.shadowColor = "rgba(0,0,0,0.5)";
        ctx.fillText(displayText, radius - 30, 0);
        ctx.restore();
    });

    drawHub(centerX, centerY);

    if (activeIndex !== -1 && !isSpinning) {
        requestAnimationFrame(drawWheel);
    }
}

function drawEmptyWheel(x, y, radius) {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
    ctx.fillStyle = "#1e293b";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#334155";
    ctx.stroke();
    
    ctx.fillStyle = "#94a3b8";
    ctx.font = "18px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Keine Einträge", x, y);
}

function drawHub(x, y) {
    ctx.beginPath();
    ctx.arc(x, y, 30, 0, 2 * Math.PI);
    ctx.fillStyle = "#ffffff";
    ctx.shadowBlur = 10;
    ctx.shadowColor = "rgba(0,0,0,0.3)";
    ctx.fill();
}

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
        const speedFactor = Math.min(1, currentVelocity * 1.5);
        audio.playTick(speedFactor);
        
        if (pointerEl) {
            const intensity = Math.max(5, currentVelocity * 40);
            pointerEl.style.transform = `translateX(-50%) rotate(-${intensity}deg)`;
            setTimeout(() => {
                pointerEl.style.transform = 'translateX(-50%) rotate(0deg)';
            }, 60);
        }
    }
    lastTickSegment = currentSegment;
}

function handleResult() {
    const sliceAngle = (2 * Math.PI) / options.length;
    let pointerAngle = (1.5 * Math.PI - (currentRotation % (2 * Math.PI))) % (2 * Math.PI);
    if (pointerAngle < 0) pointerAngle += 2 * Math.PI;

    activeIndex = Math.floor(pointerAngle / sliceAngle);
    const winner = options[activeIndex];

    pulseTime = 0;
    drawWheel(); 

    audio.playFanfare();
    
    if (document.fullscreenElement) {
        setTimeout(() => {
            alert(`🎉 Gewinner: ${winner}`);
            document.exitFullscreen();
        }, 500);
    } else {
        winnerText.innerHTML = winner;
        winnerModal.classList.add('active');
        triggerConfetti();
    }
}

function triggerConfetti() {
    if (typeof confetti !== 'function') return;
    confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: PALETTE.map(p => p.main)
    });
}

window.addEventListener('DOMContentLoaded', init);
