// Rigged MacBook Spin Wheel Game
// Features: Variable MacBook Wagers (up to millions!), Quick Spins, Dynamic Canvas Rendering, 100% Rigged Loss

(function () {
  'use strict';

  // --- Wheel Configuration ---
  const canvas = document.getElementById('wheelCanvas');
  const ctx = canvas.getContext('2d');
  const pointerEl = document.querySelector('.wheel-pointer');

  const spinBtn = document.getElementById('spinBtn');
  const spinSubtext = document.getElementById('spinSubtext');
  const mainSpinBtn = document.getElementById('mainSpinBtn');
  const quickSpinBtn = document.getElementById('quickSpinBtn');
  const soundToggleBtn = document.getElementById('soundToggleBtn');

  const wagerInput = document.getElementById('wagerInput');
  const potentialWinText = document.getElementById('potentialWinText');
  const betChips = document.querySelectorAll('.bet-chip[data-amount]');
  const allInBtn = document.getElementById('allInBtn');

  const wonCountEl = document.getElementById('wonCount');
  const debtCountEl = document.getElementById('debtCount');
  const spinCountEl = document.getElementById('spinCount');
  const commentaryEl = document.getElementById('commentary');

  const modal = document.getElementById('lossModal');
  const modalResultBadge = document.querySelector('.modal-result-badge');
  const modalMessage = document.getElementById('modalMessage');
  const modalQuote = document.getElementById('modalQuote');
  const modalSpinAgainBtn = document.getElementById('modalSpinAgainBtn');
  const modalCloseBtn = document.getElementById('modalCloseBtn');

  const NUM_SLICES = 6;
  const SLICE_ANGLE = (2 * Math.PI) / NUM_SLICES;
  const CENTER_X = canvas.width / 2;
  const CENTER_Y = canvas.height / 2;
  const RADIUS = canvas.width / 2 - 12;

  let currentAngle = 0; // Current rotation in radians
  let isSpinning = false;
  let isQuickSpin = false;
  let soundEnabled = true;
  let currentWager = 1;

  let stats = {
    won: 0,
    debt: 0,
    spins: 0
  };

  const BASE_SLICES = [
    { type: 'win', bg: '#248a3d', textCol: '#ffffff' },
    { type: 'lose', bg: '#b81d24', textCol: '#ffffff' },
    { type: 'win', bg: '#2ba84a', textCol: '#ffffff' },
    { type: 'lose', bg: '#cf222e', textCol: '#ffffff' },
    { type: 'win', bg: '#1f7a35', textCol: '#ffffff' },
    { type: 'lose', bg: '#9e1a20', textCol: '#ffffff' }
  ];

  function formatShort(num) {
    if (num >= 1e12) return (num / 1e12).toFixed(1).replace(/\.0$/, '') + 'T';
    if (num >= 1e9) return (num / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
    return num.toLocaleString();
  }

  function getDynamicSlices() {
    return BASE_SLICES.map((slice) => {
      if (slice.type === 'win') {
        const winAmount = currentWager * 2;
        return {
          ...slice,
          text: `WIN ${formatShort(winAmount)} MB`,
          sub: ` ${formatShort(winAmount)} Laptops`
        };
      } else {
        return {
          ...slice,
          text: `LOSE ${formatShort(currentWager)} MB`,
          sub: `⚠️ -${formatShort(currentWager)} Debt`
        };
      }
    });
  }

  const FUNNY_DEBT_MESSAGES = [
    "Apple Collections Department has logged your debt. Please surrender your MacBooks immediately.",
    "Your MacBooks were repossessed by Tim Cook personally via satellite iCloud lock.",
    "Genius Bar has been notified. You are no longer permitted within 500 feet of an Apple Store.",
    "Apple Repo drone is currently hovering outside your window waiting for your MacBooks.",
    "Your debt has been bundled into high-yield Apple Silicon derivative bonds.",
    "You now officially owe Apple more laptops than exist in your entire zip code.",
    "Cook's Law: The probability of winning MacBooks approaches zero as spins approach infinity."
  ];

  const FUNNY_QUOTES = [
    "\"99.9% of MacBook spinners quit right before winning two MacBooks.\" — Wall Street Proverb",
    "\"The next spin is mathematically guaranteed to hit Win. Just one more spin!\" — Trust Me Bro",
    "\"Double or nothing is the only mathematically sound way out of this hole.\" — Financial 'Advisor'",
    "\"Don't walk away in debt, spin until you break even!\"",
    "\"Steve Jobs wouldn't want you to give up now.\""
  ];

  // --- Web Audio Synthesis ---
  let audioCtx = null;

  function initAudio() {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  function playTickSound() {
    if (!soundEnabled) return;
    initAudio();
    if (!audioCtx) return;

    try {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(800 + Math.random() * 200, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.03);

      gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.03);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + 0.035);
    } catch (e) {}
  }

  function playSadLossSound() {
    if (!soundEnabled) return;
    initAudio();
    if (!audioCtx) return;

    try {
      const notes = isQuickSpin
        ? [
            { freq: 311, dur: 0.12 },
            { freq: 246, dur: 0.28, slideTo: 190 }
          ]
        : [
            { freq: 330, dur: 0.26 },
            { freq: 311, dur: 0.26 },
            { freq: 293, dur: 0.28 },
            { freq: 246, dur: 0.65, slideTo: 220 }
          ];

      let startTime = audioCtx.currentTime + 0.02;

      notes.forEach((note) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(note.freq, startTime);
        if (note.slideTo) {
          osc.frequency.linearRampToValueAtTime(note.slideTo, startTime + note.dur);
        }

        const filter = audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(650, startTime);

        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.2, startTime + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + note.dur - 0.02);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start(startTime);
        osc.stop(startTime + note.dur);

        startTime += note.dur + 0.03;
      });
    } catch (e) {}
  }

  // --- Wheel Drawing ---
  function drawWheel(rotation) {
    const slices = getDynamicSlices();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(CENTER_X, CENTER_Y);
    ctx.rotate(rotation);

    // Outer rim metallic border
    ctx.beginPath();
    ctx.arc(0, 0, RADIUS + 8, 0, 2 * Math.PI);
    ctx.lineWidth = 14;
    ctx.strokeStyle = '#2d3142';
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, RADIUS + 4, 0, 2 * Math.PI);
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#ffd60a';
    ctx.stroke();

    // Draw slices
    for (let i = 0; i < NUM_SLICES; i++) {
      const slice = slices[i];
      const startAngle = i * SLICE_ANGLE;
      const endAngle = startAngle + SLICE_ANGLE;

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, RADIUS, startAngle, endAngle);
      ctx.closePath();

      const grad = ctx.createRadialGradient(0, 0, 30, 0, 0, RADIUS);
      if (slice.type === 'win') {
        grad.addColorStop(0, '#38b000');
        grad.addColorStop(1, slice.bg);
      } else {
        grad.addColorStop(0, '#e63946');
        grad.addColorStop(1, slice.bg);
      }
      ctx.fillStyle = grad;
      ctx.fill();

      // Slice border
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.stroke();

      // Slice Peg at boundary
      const pegX = Math.cos(startAngle) * (RADIUS - 4);
      const pegY = Math.sin(startAngle) * (RADIUS - 4);
      ctx.beginPath();
      ctx.arc(pegX, pegY, 5, 0, 2 * Math.PI);
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 4;
      ctx.fill();
      ctx.shadowBlur = 0;

      // Slice Text
      ctx.save();
      ctx.rotate(startAngle + SLICE_ANGLE / 2);
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';

      // Primary segment text
      ctx.fillStyle = slice.textCol;
      ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
      ctx.shadowBlur = 4;
      ctx.fillText(slice.text, RADIUS - 22, -8);

      // Subtitle tag
      ctx.font = '600 11px -apple-system, sans-serif';
      ctx.fillStyle = slice.type === 'win' ? '#ffd60a' : '#ffccd5';
      ctx.shadowBlur = 2;
      ctx.fillText(slice.sub, RADIUS - 22, 11);

      ctx.restore();
    }

    ctx.restore();
  }

  // --- Rigged Target Calculation ---
  function calculateRiggedTarget(targetSliceIndex, minRotations = 6) {
    const sliceCenter = (targetSliceIndex + 0.5) * SLICE_ANGLE;
    const jitter = (Math.random() - 0.5) * 0.22;
    const targetSliceAngle = sliceCenter + jitter;

    let desiredAngle = 1.5 * Math.PI - targetSliceAngle;
    while (desiredAngle < 0) desiredAngle += 2 * Math.PI;

    const currentNorm = currentAngle % (2 * Math.PI);
    let delta = desiredAngle - currentNorm;
    while (delta < 0) delta += 2 * Math.PI;

    const extraSpins = (minRotations + Math.floor(Math.random() * 2)) * 2 * Math.PI;
    return currentAngle + delta + extraSpins;
  }

  function getRandomLoseSliceIndex() {
    const loseIndices = [1, 3, 5];
    return loseIndices[Math.floor(Math.random() * loseIndices.length)];
  }

  // --- Spin Animation ---
  function spin() {
    if (isSpinning) return;
    initAudio();

    isSpinning = true;
    spinBtn.disabled = true;
    mainSpinBtn.disabled = true;
    wagerInput.disabled = true;

    commentaryEl.textContent = isQuickSpin 
      ? `⚡ Quick-spinning for ${formatShort(currentWager * 2)} MacBooks...` 
      : `Gambling ${formatShort(currentWager)} MacBook(s) for a chance at ${formatShort(currentWager * 2)} MacBooks!`;

    stats.spins++;
    spinCountEl.textContent = stats.spins.toLocaleString();

    // RIGGED: Always choose a LOSE slice!
    const targetSlice = getRandomLoseSliceIndex();
    const startAngle = currentAngle;
    const minRot = isQuickSpin ? 2 : 6;
    const endAngle = calculateRiggedTarget(targetSlice, minRot);
    const totalDistance = endAngle - startAngle;

    const duration = isQuickSpin ? 650 : 5200;
    const startTime = performance.now();

    let lastPegIndex = Math.floor((currentAngle - 1.5 * Math.PI) / SLICE_ANGLE);

    function animate(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Custom easing
      const easeOut = 1 - Math.pow(1 - progress, 4);

      currentAngle = startAngle + totalDistance * easeOut;
      drawWheel(currentAngle);

      // Peg detection
      const currentPegIndex = Math.floor((currentAngle - 1.5 * Math.PI) / SLICE_ANGLE);
      if (currentPegIndex !== lastPegIndex) {
        lastPegIndex = currentPegIndex;
        playTickSound();
        flickPointer();
      }

      if (!isQuickSpin && progress > 0.75 && progress < 0.96) {
        commentaryEl.textContent = `IT'S INCHING NEAR ${formatShort(currentWager * 2)} MACBOOKS... COME ON...!!`;
      }

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        finishSpin();
      }
    }

    requestAnimationFrame(animate);
  }

  function flickPointer() {
    if (!pointerEl) return;
    pointerEl.style.transform = 'rotate(-18deg)';
    setTimeout(() => {
      pointerEl.style.transform = 'rotate(0deg)';
    }, isQuickSpin ? 30 : 60);
  }

  function finishSpin() {
    isSpinning = false;
    spinBtn.disabled = false;
    mainSpinBtn.disabled = false;
    wagerInput.disabled = false;

    // Accumulate debt by current wager!
    stats.debt += currentWager;
    debtCountEl.textContent = stats.debt.toLocaleString();

    playSadLossSound();

    commentaryEl.textContent = `🚨 OUCH! You just lost ${formatShort(currentWager)} MacBook(s)! Total debt: ${stats.debt.toLocaleString()} MacBooks.`;

    setTimeout(() => {
      showLossModal();
    }, isQuickSpin ? 200 : 450);
  }

  function showLossModal() {
    const formattedLoss = `${formatShort(currentWager)} MACBOOK${currentWager > 1 ? 'S' : ''}`;
    modalResultBadge.textContent = `LOSE ${formattedLoss}`;

    let msg = "";
    if (currentWager >= 100000) {
      msg = `Incredible! You just lost ${currentWager.toLocaleString()} MacBooks in one single spin! Tim Cook personally thanks you for funding Apple Campus 3.`;
    } else if (currentWager >= 1000) {
      msg = `Ouch! That's ${currentWager.toLocaleString()} MacBooks gone. An entire Apple freight container has been billed to your name.`;
    } else {
      msg = FUNNY_DEBT_MESSAGES[Math.floor(Math.random() * FUNNY_DEBT_MESSAGES.length)];
    }

    modalMessage.textContent = msg;
    modalQuote.textContent = FUNNY_QUOTES[Math.floor(Math.random() * FUNNY_QUOTES.length)];

    modalSpinAgainBtn.textContent = `Double or Nothing! Gamble ${formatShort(currentWager * 2)} MacBooks`;

    modal.classList.remove('hidden');
  }

  function closeModal() {
    modal.classList.add('hidden');
  }

  // --- Wager Controls ---
  function updateWager(newAmount) {
    newAmount = Math.max(1, Math.floor(newAmount) || 1);
    currentWager = newAmount;
    wagerInput.value = currentWager;
    potentialWinText.textContent = `${formatShort(currentWager * 2)} MacBooks`;
    spinSubtext.textContent = `${formatShort(currentWager)} MB`;

    // Update active chip
    betChips.forEach(chip => {
      if (parseInt(chip.dataset.amount, 10) === currentWager) {
        chip.classList.add('active');
      } else {
        chip.classList.remove('active');
      }
    });

    drawWheel(currentAngle);
  }

  wagerInput.addEventListener('input', () => {
    const val = parseInt(wagerInput.value, 10);
    if (!isNaN(val) && val > 0) {
      updateWager(val);
    }
  });

  betChips.forEach(chip => {
    chip.addEventListener('click', () => {
      const amt = parseInt(chip.dataset.amount, 10);
      updateWager(amt);
    });
  });

  allInBtn.addEventListener('click', () => {
    // Gamble either current debt doubled, or 100K if debt is low!
    const allInAmount = stats.debt > 0 ? stats.debt * 2 : 100000;
    updateWager(allInAmount);
  });

  // Quick spin toggle
  quickSpinBtn.addEventListener('click', () => {
    isQuickSpin = !isQuickSpin;
    if (isQuickSpin) {
      quickSpinBtn.textContent = '⚡ Quick Spin: ON';
      quickSpinBtn.classList.add('active-quick');
    } else {
      quickSpinBtn.textContent = '⚡ Quick Spin: OFF';
      quickSpinBtn.classList.remove('active-quick');
    }
  });

  // Sound toggle
  soundToggleBtn.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    soundToggleBtn.textContent = soundEnabled ? '🔊' : '🔇';
    soundToggleBtn.title = soundEnabled ? 'Sound: ON' : 'Sound: OFF';
  });

  // Event Listeners
  spinBtn.addEventListener('click', spin);
  mainSpinBtn.addEventListener('click', spin);

  modalSpinAgainBtn.addEventListener('click', () => {
    closeModal();
    updateWager(currentWager * 2); // Double the bet!
    setTimeout(spin, 250);
  });

  modalCloseBtn.addEventListener('click', closeModal);

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !isSpinning && modal.classList.contains('hidden')) {
      e.preventDefault();
      spin();
    }
  });

  // Initialize
  updateWager(1);
})();
