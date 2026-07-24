/**
 * EXTREMES GLÜCKSRAD - RIGGED ADMIN EDITION 🤫🚀
 * Features: Unsichtbarer Tasten-Cheat (1-9), Fake-Physics (deterministisch),
 * Neon-Glow Rendering, Velocity-Audio & Multi-Confetti.
 */

class SoundEffects {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
    }

    init() {
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();
            this.masterGain = this.ctx.createGain();
            this.masterGain.connect(this.ctx.destination);
            this.masterGain.gain.value = 0.8;
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    playTick(speedFactor = 1) {
        try {
            this.init();
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            
            const baseFreq = 150 + (speedFactor * 300); 
            const duration = 0.02 + (0.03 * (1 - speedFactor)); 

            osc.type = speedFactor > 0.5 ? 'square' : 'triangle';
            osc.frequency.setValueAtTime(baseFreq, this.ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + duration);
            
            const volume = 0.2 + (speedFactor * 0.6);
            gain.gain.setValueAtTime(volume, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
            
            osc.connect(gain);
            gain.connect(this.masterGain);
            
            osc.start();
            osc.stop(this.ctx.currentTime + duration);
        } catch (e) {}
    }

    playFanfare() {
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

const sfx = new SoundEffects();

const PALETTE = [
    { main: "#6366F1", glow: "#818cf8" }, { main: "#EC4899", glow: "#f472b6" },
    { main: "#8B5CF6", glow: "#a78bfa" }, { main: "#10B981", glow: "#34d399" },
    { main: "#F59E0B", glow: "#fbbf24" }, { main: "#06B6D4", glow: "#22d3ee" },
    { main: "#F43F5E", glow: "#fb7185" }, { main: "#3B82F6", glow: "#60a5fa" }
];

const DEFAULT_OPTIONS = [
    "🍕 Pizza XXL", "🍔 Smashburger", "🍣 Premium Sushi",
    "🌮 Taco Fiesta", "🥗 Fitness Bowl", "🍜 Spicy Ramen"
];

let options = [];
let currentRotation = 0;
let currentVelocity = 0; 
let isSpinning = false;
let animationFrameId = null;
let lastTickSegment = -1;
let winningSegmentIndex = -1; 
let pulseTime = 0;

// 🤫 Das Herzstück der Manipulation
let secretTargetIndex = -1; // -1 bedeutet "Fairer Modus"

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

function init() {
    loadOptions();
    renderList();
    drawWheel();
    setupEventListeners();
    window.addEventListener('resize', () => drawWheel());
}

function loadOptions() {
    const saved = localStorage.getItem('extreme_gluecksrad');
    options = saved ? JSON.parse(saved) : [...DEFAULT_OPTIONS];
}

function saveOptions() {
    localStorage.setItem('extreme_gluecksrad', JSON.stringify(options));
}

function setupEventListeners() {
    addForm.addEventListener('submit', (e) => { e.preventDefault(); addOption(); });
    resetBtn.addEventListener('click', resetOptions);
    spinBtn.addEventListener('click', startRiggedSpin);
    canvas.addEventListener('click', startRiggedSpin);
    
    closeModalBtn.addEventListener('click', closeModal);
    winnerModal.addEventListener('click', (e) => {
        if (e.target === winnerModal) closeModal();
    });

    window.addEventListener('keydown', (e) => {
        // Tasten-Auswertung (Nur wenn man nicht gerade ins Textfeld tippt)
        if (document.activeElement !== optionInput) {
            
            // 🚨 CHEAT CODE LOGIK 🚨
            if (e.key >= '1' && e.key <= '9') {
                const targetIdx = parseInt(e.key) - 1;
                if (targetIdx < options.length) {
                    secretTargetIndex = targetIdx;
                    
                    // Geheimes visuelles Feedback (Subtiles Aufleuchten)
                    canvas.style.transition = 'box-shadow 0.3s ease';
                    canvas.style.boxShadow = `0 0 40px ${PALETTE[targetIdx % PALETTE.length].main}`;
                    setTimeout(() => canvas.style.boxShadow = 'none', 500);
                    
                    console.log(`🤫 Pssst... Segment ${targetIdx + 1} (${options[targetIdx]}) ist fixiert.`);
                }
            }
            
            // Cheat zurücksetzen mit '0'
            if (e.key === '0') {
                secretTargetIndex = -1;
                canvas.style.transition = 'box-shadow 0.3s ease';
                canvas.style.boxShadow = `0 0 40px #ffffff`;
                setTimeout(() => canvas.style.boxShadow = 'none', 500);
                console.log(`😇 Wieder im fairen Modus.`);
            }

            // Normales Drehen mit Space
            if (e.code === 'Space' && !isSpinning) {
                e.preventDefault();
                startRiggedSpin();
            }
        }
        
        if (e.code === 'Escape') closeModal();
    });
}

function renderList() {
    optionsList.innerHTML = '';
    itemCount.textContent = options.length;

    options.forEach((option, index) => {
        const li = document.createElement('li');
        li.className = 'option-item';
        
        const color = PALETTE[index % PALETTE.length].main;
        // Hinweis: Eine kleine Zahl vor den Optionen hilft dir zu wissen, welche Taste du drücken musst!
        li.innerHTML = `
            <div class="option-color-preview" style="background-color: ${color}; box-shadow: 0 0 10px ${color}80">
                <span style="font-size: 10px; color: white; opacity: 0.5;">${index + 1}</span>
            </div>
            <span class="option-text">${option}</span>
            <button class="btn-delete" title="Löschen" onclick="deleteOption(${index})">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
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
        winningSegmentIndex = -1; 
        renderList();
        drawWheel();
        optionsList.scrollTo({ top: optionsList.scrollHeight, behavior: 'smooth' });
    } else {
        optionInput.classList.add('shake-error'); 
        setTimeout(() => optionInput.classList.remove('shake-error'), 400);
    }
    optionInput.focus();
}

window.deleteOption = function(index) {
    if (isSpinning) return;
    options.splice(index, 1);
    winningSegmentIndex = -1;
    if (secretTargetIndex >= options.length) secretTargetIndex = -1; // Reset Cheat falls Element gelöscht
    renderList();
    drawWheel();
};

function resetOptions() {
    if (isSpinning) return;
    if (confirm("🚨 ACHTUNG: Willst du wirklich das komplette Rad auslöschen?")) {
        options = [];
        winningSegmentIndex = -1;
        secretTargetIndex = -1;
        renderList();
        drawWheel();
    }
}

function closeModal() {
    winnerModal.classList.remove('active');
    winningSegmentIndex = -1; 
    drawWheel(); 
    spinBtn.focus();
}

function drawWheel(timestamp = 0) {
    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(centerX, centerY) - 25;

    ctx.clearRect(0, 0, width, height);

    if (options.length === 0) return drawEmptyWheel(centerX, centerY, radius);

    const sliceAngle = (2 * Math.PI) / options.length;

    options.forEach((option, i) => {
        const startAngle = currentRotation + i * sliceAngle;
        const endAngle = startAngle + sliceAngle;
        const isWinner = (i === winningSegmentIndex);

        let highlightPulse = 0;
        if (isWinner) {
            pulseTime += 0.1;
            highlightPulse = (Math.sin(pulseTime) + 1) / 2;
        }

        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius + (isWinner ? 10 * highlightPulse : 0), startAngle, endAngle);
        ctx.closePath();

        const colorSet = PALETTE[i % PALETTE.length];
        const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
        
        if (isWinner) {
            gradient.addColorStop(0, "#ffffff");
            gradient.addColorStop(0.5, colorSet.glow);
            gradient.addColorStop(1, colorSet.main);
            ctx.shadowBlur = 30 + (20 * highlightPulse);
            ctx.shadowColor = colorSet.glow;
        } else {
            gradient.addColorStop(0, colorSet.main);
            gradient.addColorStop(1, adjustColor(colorSet.main, -40)); 
            ctx.shadowBlur = 0;
        }

        ctx.fillStyle = gradient;
        ctx.fill();
        
        ctx.lineWidth = isWinner ? 5 : 3;
        ctx.strokeStyle = isWinner ? "#fff" : "rgba(255,255,255,0.2)";
        ctx.stroke();

        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(startAngle + sliceAngle / 2);
        
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        
        const fontSize = Math.max(16, Math.min(32, 400 / options.length));
        ctx.font = `900 ${isWinner ? fontSize + 4 : fontSize}px 'Plus Jakarta Sans', sans-serif`;
        
        let displayText = option.length > 15 ? option.substring(0, 14) + "..." : option;
        
        ctx.lineWidth = 4;
        ctx.strokeStyle = "rgba(0,0,0,0.8)";
        ctx.strokeText(displayText, radius - 40, 0);
        
        ctx.fillStyle = "#ffffff";
        ctx.shadowBlur = 10;
        ctx.shadowColor = "rgba(255,255,255,0.5)";
        ctx.fillText(displayText, radius - 40, 0);
        ctx.restore();
    });

    drawHub(centerX, centerY);

    if (winningSegmentIndex !== -1 && !isSpinning) {
        requestAnimationFrame(drawWheel);
    }
}

function drawEmptyWheel(x, y, radius) {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
    ctx.fillStyle = "#1e293b";
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#334155";
    ctx.stroke();
    
    ctx.fillStyle = "#94a3b8";
    ctx.font = "bold 24px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("RAD IST LEER", x, y);
}

function drawHub(x, y) {
    ctx.beginPath();
    ctx.arc(x, y, 45, 0, 2 * Math.PI);
    ctx.fillStyle = "#0f172a";
    ctx.shadowBlur = 15;
    ctx.shadowColor = "rgba(0,0,0,0.8)";
    ctx.fill();

    const grad = ctx.createRadialGradient(x, y, 10, x, y, 35);
    grad.addColorStop(0, "#ffffff");
    grad.addColorStop(1, "#94a3b8");
    
    ctx.beginPath();
    ctx.arc(x, y, 35, 0, 2 * Math.PI);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#475569";
    ctx.stroke();
}

function adjustColor(color, amount) {
    return '#' + color.replace(/^#/, '').replace(/../g, color => ('0'+Math.min(255, Math.max(0, parseInt(color, 16) + amount)).toString(16)).substr(-2));
}

// --- 6. 🚨 Die präzise Manipulations-Engine 🚨 ---
function startRiggedSpin() {
    if (isSpinning || options.length === 0) return;

    sfx.init();
    isSpinning = true;
    spinBtn.disabled = true;
    winningSegmentIndex = -1;
    
    const startRotation = currentRotation;
    let targetRotation = 0;
    
    // Spannungsaufbau: Wir drehen zwischen 7 und 11 Mal
    const extraSpins = (Math.floor(Math.random() * 5) + 7) * 2 * Math.PI;
    const sliceAngle = (2 * Math.PI) / options.length;

    if (secretTargetIndex !== -1 && secretTargetIndex < options.length) {
        // CHEAT AKTIV: Exakten Stopp-Punkt berechnen
        // Mitte des gewünschten Segments
        const targetSegmentCenter = secretTargetIndex * sliceAngle + (sliceAngle / 2);
        
        // Berechnen, wie weit wir drehen müssen, damit dieses Segment auf 270 Grad (1.5 PI / Oben) landet
        let requiredMod = (1.5 * Math.PI - targetSegmentCenter) % (2 * Math.PI);
        if (requiredMod < 0) requiredMod += 2 * Math.PI;
        
        // Damit es nicht verdächtig exakt mittig stoppt, fügen wir +/- 30% des Segments als Zufall hinzu
        const randomJitter = (Math.random() * 0.6 - 0.3) * sliceAngle; 

        targetRotation = startRotation + extraSpins + requiredMod + randomJitter - (startRotation % (2 * Math.PI));
    } else {
        // FAIRER MODUS: Einfach irgendwo anhalten
        targetRotation = startRotation + extraSpins + (Math.random() * 2 * Math.PI);
    }

    const duration = 7500; // 7.5 Sekunden Drehung
    let startTime = null;
    let lastTimestamp = null;
    let lastRotation = startRotation;

    // Diese Kurve ahmt perfekte Reibung nach, lässt uns aber den Endpunkt exakt bestimmen
    const easeOutQuart = (t) => 1 - Math.pow(1 - t, 4);

    function spinLoop(timestamp) {
        if (!startTime) startTime = timestamp;
        if (!lastTimestamp) lastTimestamp = timestamp;
        
        const elapsed = timestamp - startTime;
        const deltaTime = timestamp - lastTimestamp;
        lastTimestamp = timestamp;

        const progress = Math.min(elapsed / duration, 1);
        
        currentRotation = startRotation + (targetRotation - startRotation) * easeOutQuart(progress);

        // Wir simulieren Velocity (Geschwindigkeit) rein für die Audio-Engine & visuelle Kicks
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
            evaluateWinner();
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
        sfx.playTick(speedFactor);
        
        if (pointerEl) {
            const intensity = Math.max(15, currentVelocity * 60);
            pointerEl.style.transform = `translateX(-50%) rotate(-${intensity}deg)`;
            setTimeout(() => {
                pointerEl.style.transform = 'translateX(-50%) rotate(0deg)';
            }, 60);
        }
    }
    lastTickSegment = currentSegment;
}

function evaluateWinner() {
    const sliceAngle = (2 * Math.PI) / options.length;
    let pointerAngle = (1.5 * Math.PI - (currentRotation % (2 * Math.PI))) % (2 * Math.PI);
    if (pointerAngle < 0) pointerAngle += 2 * Math.PI;

    winningSegmentIndex = Math.floor(pointerAngle / sliceAngle);
    const winner = options[winningSegmentIndex];

    pulseTime = 0;
    drawWheel(); 

    sfx.playFanfare();
    winnerText.innerHTML = `🔥 <span style="color: ${PALETTE[winningSegmentIndex % PALETTE.length].glow}">${winner}</span> 🔥`;
    winnerModal.classList.add('active');
    triggerExtremeConfetti();
}

function triggerExtremeConfetti() {
    if (typeof confetti !== 'function') return;

    const duration = 4000;
    const end = Date.now() + duration;
    const colors = PALETTE.map(p => p.main);

    confetti({
        particleCount: 200,
        spread: 120,
        origin: { y: 0.7 },
        colors: colors,
        startVelocity: 60
    });

    (function frame() {
        confetti({ particleCount: 6, angle: 60, spread: 80, origin: { x: 0, y: 0.8 }, colors: colors });
        confetti({ particleCount: 6, angle: 120, spread: 80, origin: { x: 1, y: 0.8 }, colors: colors });

        if (Date.now() < end) requestAnimationFrame(frame);
    }());
}

window.addEventListener('DOMContentLoaded', init);
