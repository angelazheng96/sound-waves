// ==== DOM ELEMENTS ====
const input = document.getElementById("input");

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const colour_1 = document.getElementById('colour-1');
const colour_2 = document.getElementById('colour-2');
const colour_3 = document.getElementById('colour-3');

const volumeSlider = document.getElementById('volume-slider');
const volumeSliderValue = document.getElementById('volume-sliderValue');
const lengthSlider = document.getElementById('length-slider');
const lengthSliderValue = document.getElementById('length-sliderValue');

const waveTypeSelect = document.getElementById('wave-type-select');
const recordingToggle = document.getElementById('record');

// ==== AUDIO SETUP ====
const audioCtx = new AudioContext();
const gainNode = audioCtx.createGain();
gainNode.connect(audioCtx.destination);
gainNode.gain.value = 0;

const oscillator = audioCtx.createOscillator();
oscillator.type = "sine";
oscillator.frequency.setValueAtTime(0, audioCtx.currentTime);
oscillator.connect(gainNode);
oscillator.start();
window.oscillator = oscillator;

// ==== NOTE FREQUENCIES ====
const noteNames = new Map([
  ["C", 261.6], ["D", 293.7], ["E", 329.6],
  ["F", 349.2], ["G", 392.0], ["A", 440.0], ["B", 493.9]
]);

// ==== CANVAS VARIABLES ====
let width = ctx.canvas.width;
let height = ctx.canvas.height;
let colourGradient;
let interval = null;
let waveUpdatePeriod;
let x, y;

// ==== SONG STATE ====
let freq, counter = 0, reset = false;
let timePerNote = 0, songLength = 6000, length = 0;
let repeat = null;      // For note playback interval
let stopTimeout = null; // For the setTimeout that stops the song

let manualVolumeActive = false;
let manualVolumeTimeout = null;
let fadeOutTimeout = null;

// ==== RECORDING ====
let blob, recorder = null, chunks = [], is_recording = false;

// ==== UI EVENT LISTENERS ====

// Update CSS color variables
function updateColours() {
  document.documentElement.style.setProperty('--colour1', colour_1.value);
  document.documentElement.style.setProperty('--colour2', colour_2.value);
  document.documentElement.style.setProperty('--colour3', colour_3.value);
}
[colour_1, colour_2, colour_3].forEach(el => el.addEventListener('input', updateColours));
updateColours();

// Volume and length slider display
volumeSlider.addEventListener('input', () => {
  volumeSliderValue.textContent = volumeSlider.value;
  if (manualVolumeActive) {
    gainNode.gain.setValueAtTime(volumeSlider.value / 100, audioCtx.currentTime);
  }
});

lengthSlider.addEventListener('input', () => lengthSliderValue.textContent = lengthSlider.value + " seconds");

// ==== RECORDING FUNCTIONS ====

// Start/stop recording canvas and audio
function startRecording() {
  const canvasStream = canvas.captureStream(20);
  const audioDestination = audioCtx.createMediaStreamDestination();
  gainNode.connect(audioDestination);

  const combinedStream = new MediaStream();
  chunks = [];

  canvasStream.getVideoTracks().forEach(track => combinedStream.addTrack(track));
  audioDestination.stream.getAudioTracks().forEach(track => combinedStream.addTrack(track));

  recorder = new MediaRecorder(combinedStream, { mimeType: 'video/webm' });
  recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
  recorder.onstop = () => {
    const blob = new Blob(chunks, { type: 'video/webm' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'recording.webm'; a.click();
    URL.revokeObjectURL(url);
  };

  recorder.start();
}

function toggle() {
  is_recording = !is_recording;
  recordingToggle.innerHTML = is_recording ? "Stop Recording" : "Start Recording";
  is_recording ? startRecording() : recorder.stop();
}

// ==== AUDIO PLAYBACK ====

// Play note at given pitch with envelope
function frequency(pitch) {
  window.oscillator.frequency.setValueAtTime(pitch, audioCtx.currentTime);

  const now = audioCtx.currentTime;
  const fadeIn = timePerNote / 1000 * 0.05;
  const fadeOut = timePerNote / 1000 * 0.95;

  // Cancel any previous manual volume control
  manualVolumeActive = false;
  if (manualVolumeTimeout) clearTimeout(manualVolumeTimeout);
  if (fadeOutTimeout) clearTimeout(fadeOutTimeout);

  // Fade in
  gainNode.gain.cancelScheduledValues(now);
  gainNode.gain.setValueAtTime(0, now);
  gainNode.gain.linearRampToValueAtTime(volumeSlider.value / 100, now + fadeIn);

  // After fade-in, allow manual volume control
  manualVolumeTimeout = setTimeout(() => {
    manualVolumeActive = true;
  }, fadeIn * 1000);

  // Before fade-out, stop manual volume control and start fade-out
  fadeOutTimeout = setTimeout(() => {
    manualVolumeActive = false;
    // Fade out
    const fadeOutStart = audioCtx.currentTime;
    gainNode.gain.cancelScheduledValues(fadeOutStart);
    gainNode.gain.setValueAtTime(gainNode.gain.value, fadeOutStart);
    gainNode.gain.linearRampToValueAtTime(0, fadeOutStart + (timePerNote / 1000 - fadeOut));
  }, fadeOut * 1000);

  freq = pitch;
}

// Validate input (only CDEFGAB)
function validInput(input) {
  return /^[CDEFGAB]+$/.test(input);
}

// ==== MAIN PLAYBACK HANDLER ====

// Handles play button press
function handle() {
  // Interrupt any current playback
  if (repeat) {
    clearInterval(repeat);
    repeat = null;
  }
  if (stopTimeout) {
    clearTimeout(stopTimeout);
    stopTimeout = null;
  }
  clearInterval(interval);
  gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
  resetOscillator();

  reset = true;
  audioCtx.resume();
  gainNode.gain.value = 0;

  const userInput = String(input.value);

  if (!validInput(userInput)) {
    document.getElementById('input-error').style.display = 'flex';
    return;
  }
  document.getElementById('input-error').style.display = 'none';

  timePerNote = parseFloat(lengthSlider.value) * 1000;
  length = userInput.length;
  songLength = timePerNote * length;

  // Set up color gradient for wave
  colourGradient = ctx.createLinearGradient(0, height / 2, width, height / 2);
  colourGradient.addColorStop(0, colour_1.value);
  colourGradient.addColorStop(0.5, colour_2.value);
  colourGradient.addColorStop(1, colour_3.value);

  // Build note list
  const notesList = Array.from(userInput).map(ch => noteNames.get(ch));
  let j = 0;
  // Play first note immediately
  frequency(notesList[j]);
  drawWave();
  j++;

  // Play remaining notes at intervals
  repeat = setInterval(() => {
    if (j < notesList.length) {
      frequency(notesList[j]);
      drawWave();
      j++;
    } else {
      clearInterval(repeat);
    }
  }, timePerNote);

  // Stop sound and reset oscillator at end
  stopTimeout = setTimeout(() => {
    gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
    // resetOscillator();
  }, songLength);
}

// ==== OSCILLATOR RESET ====

// Stop and recreate oscillator for next playback
function resetOscillator() {
  if (window.oscillator) {
    try { window.oscillator.stop(); } catch (e) { }
    try { window.oscillator.disconnect(); } catch (e) { }
  }
  gainNode.gain.setValueAtTime(0, audioCtx.currentTime);

  const newOsc = audioCtx.createOscillator();
  newOsc.type = "sine";
  newOsc.connect(gainNode);
  newOsc.start();
  window.oscillator = newOsc;
}

// ==== WAVEFORM DRAWING ====

// Return waveform value for given type
function waveType(x, period) {
  switch (waveTypeSelect.value) {
    case 'sine': return Math.sin(2 * Math.PI / period * x);
    case 'square': return Math.sign(Math.sin(2 * Math.PI / period * x));
    case 'triangle': return (2 / Math.PI) * Math.asin(Math.sin(2 * Math.PI / period * x));
    case 'sawtooth': return 2 * (x / period - Math.floor(0.5 + x / period));
    default: return Math.sin(2 * Math.PI / period * x);
  }
}

// Draws the wave for the current note
function drawWave() {
  clearInterval(interval);

  if (reset) {
    ctx.clearRect(0, 0, width, height);
    x = 0; y = height / 2;
    ctx.moveTo(x, y);
    ctx.beginPath();
  }

  waveUpdatePeriod = songLength / width;
  let steps = width, counter = 0;

  interval = setInterval(() => {
    line();
    x++; counter++;
    if (counter >= steps) clearInterval(interval);
  }, waveUpdatePeriod);

  reset = false;
}

// Draw a single step of the wave
function line() {
  y = (height / 2) + (0.4 * volumeSlider.value) * waveType(x, 1 / ((freq / 10000) * (length / 2)));

  ctx.lineTo(x, y);
  ctx.strokeStyle = colourGradient;
  ctx.stroke();
}

// ==== DARK MODE ====

// Toggle dark mode and remember preference
function toggleDarkMode() {
  let isDark = document.body.classList.toggle('dark-mode');
  localStorage.setItem('darkMode', isDark ? 'enabled' : 'disabled');
}

document.addEventListener('DOMContentLoaded', () => {
  if (localStorage.getItem('darkMode') === 'enabled') {
    document.body.classList.add('dark-mode');
    document.getElementById('toggle-dark-mode').checked = true;
  }
});