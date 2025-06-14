// DOM ELEMENTS 
const input = document.getElementById('input');

const colour_1 = document.getElementById('colour-1');
const colour_2 = document.getElementById('colour-2');
const colour_3 = document.getElementById('colour-3');

const volumeSlider = document.getElementById('volume-slider');
const volumeSliderValue = document.getElementById('volume-sliderValue');
const lengthSlider = document.getElementById('length-slider');
const lengthSliderValue = document.getElementById('length-sliderValue');

const waveTypeSelect = document.getElementById('wave-type-select');
const recordingToggle = document.getElementById('record');

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

// AUDIO SETUP 
const audioCtx = new AudioContext();

// Create gain node for volume control
const gainNode = audioCtx.createGain();
gainNode.connect(audioCtx.destination);
gainNode.gain.value = 0;

// Create oscillator for sound generation
const oscillator = audioCtx.createOscillator();
oscillator.type = 'sine';
oscillator.connect(gainNode);
oscillator.start();

window.oscillator = oscillator; // Store oscillator globally

// NOTE FREQUENCIES 
const noteNames = new Map([
  ['C', 261.6], ['D', 293.7], ['E', 329.6],
  ['F', 349.2], ['G', 392.0], ['A', 440.0], ['B', 493.9]
]);

// CANVAS VARIABLES 
let width = ctx.canvas.width;
let height = ctx.canvas.height;
let colourGradient;
let drawWaveInterval = null;
let waveUpdatePeriod;
let x, y;

// SONG STATE 
let freq, reset = false;
let noteLength, songLength, numNotes;
let noteInterval = null;      // For note playback interval
let stopTimeout = null; // For the setTimeout that stops the song

let manualVolumeActive = false;
let manualVolumeTimeout = null;
let fadeOutTimeout = null;

// RECORDING 
let blob, recorder = null, chunks = [], is_recording = false;

// UI EVENT LISTENERS 

// Update CSS colour variables
function updateColours() {
  document.documentElement.style.setProperty('--colour1', colour_1.value);
  document.documentElement.style.setProperty('--colour2', colour_2.value);
  document.documentElement.style.setProperty('--colour3', colour_3.value);
}

// Add event listeners for colour inputs
[colour_1, colour_2, colour_3].forEach(el => el.addEventListener('input', updateColours));
updateColours(); // Initialize with default colours

// Add event listener for volume slider
volumeSlider.addEventListener('input', () => {
  volumeSliderValue.textContent = volumeSlider.value; // Update displayed value

  // If it is currently in manual mode, set the gain directly
  if (manualVolumeActive) {
    gainNode.gain.setValueAtTime(volumeSlider.value / 100, audioCtx.currentTime);
  }
});

// Add event listener for length slider and update displayed value
lengthSlider.addEventListener('input', () => lengthSliderValue.textContent = lengthSlider.value + ' seconds');

// RECORDING FUNCTIONS 

// Record canvas and audio
function startRecording() {
  const canvasStream = canvas.captureStream(20);
  const audioDestination = audioCtx.createMediaStreamDestination();
  gainNode.connect(audioDestination);

  const combinedStream = new MediaStream();
  chunks = [];

  // For each track in the canvas and audio streams, add to combined stream
  canvasStream.getVideoTracks().forEach(track => combinedStream.addTrack(track));
  audioDestination.stream.getAudioTracks().forEach(track => combinedStream.addTrack(track));

  recorder = new MediaRecorder(combinedStream, { mimeType: 'video/webm' });
  recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };

  // When recording stops, download the recorded video
  recorder.onstop = () => {
    const blob = new Blob(chunks, { type: 'video/webm' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'recording.webm'; a.click();
    URL.revokeObjectURL(url);
  };

  // Start recording
  recorder.start();
}

// Toggle recording state on button press
function toggleRecording() {
  is_recording = !is_recording; // Toggle recording state

  // Change button text and start/stop recording
  recordingToggle.innerHTML = is_recording ? 'Stop Recording' : 'Start Recording';
  is_recording ? startRecording() : recorder.stop();
}

// AUDIO PLAYBACK 

// Play note at given pitch
function playNote(pitch) {
  window.oscillator.frequency.setValueAtTime(pitch, audioCtx.currentTime);

  const now = audioCtx.currentTime;
  const fadeIn = noteLength / 1000 * 0.05; // Length of fade in
  const fadeOut = noteLength / 1000 * 0.95; // Delay until fade out starts

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
    gainNode.gain.linearRampToValueAtTime(0, fadeOutStart + (noteLength / 1000 - fadeOut));
  }, fadeOut * 1000);

  // Set global frequency variable to given pitch
  freq = pitch;
}

// Validate input (only CDEFGAB)
function validInput(input) {
  return /^[CDEFGAB]+$/.test(input);
}

// MAIN PLAYBACK HANDLER 

// Handles play button press
function playSong() {

  // Interrupt any current playback
  if (noteInterval) {
    clearInterval(noteInterval);
    noteInterval = null;
  }
  if (stopTimeout) {
    clearTimeout(stopTimeout);
    stopTimeout = null;
  }
  clearInterval(drawWaveInterval);
  gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
  resetOscillator();

  reset = true; // New song means canvas should be reset
  audioCtx.resume();

  // Get user input
  const userInput = String(input.value);

  // If input is not valid, show error
  if (!validInput(userInput)) {
    document.getElementById('input-error').style.display = 'flex';
    return;
  }
  document.getElementById('input-error').style.display = 'none';

  // Calculate lengths
  noteLength = parseFloat(lengthSlider.value) * 1000;
  numNotes = userInput.length;
  songLength = noteLength * numNotes;

  // Set up color gradient for canvas waveform
  colourGradient = ctx.createLinearGradient(0, height / 2, width, height / 2);
  colourGradient.addColorStop(0, colour_1.value);
  colourGradient.addColorStop(0.5, colour_2.value);
  colourGradient.addColorStop(1, colour_3.value);

  // Build note list
  const notesList = Array.from(userInput).map(ch => noteNames.get(ch));
  let noteIndex = 0;

  // Play first note immediately
  playNote(notesList[noteIndex]);
  drawWave();
  noteIndex++;

  // Play remaining notes after each note length
  noteInterval = setInterval(() => {
    if (noteIndex < notesList.length) {
      playNote(notesList[noteIndex]);
      drawWave();
      noteIndex++;
    } else {
      // Done playing the song
      clearInterval(noteInterval);
    }
  }, noteLength);

  // Stop sound after song is played
  stopTimeout = setTimeout(() => {
    gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
  }, songLength);
}

// Stop and recreate oscillator for next note
function resetOscillator() {
  if (window.oscillator) {
    try { window.oscillator.stop(); } catch (e) { }
    try { window.oscillator.disconnect(); } catch (e) { }
  }
  gainNode.gain.setValueAtTime(0, audioCtx.currentTime);

  const newOsc = audioCtx.createOscillator();
  newOsc.type = 'sine';
  newOsc.connect(gainNode);
  newOsc.start();
  window.oscillator = newOsc;
}

// WAVEFORM DRAWING

// Draw wave for the current note
function drawWave() {
  clearInterval(drawWaveInterval);

  // If it is start of new song, reset canvas
  if (reset) {
    ctx.clearRect(0, 0, width, height);
    x = 0; y = height / 2;
    ctx.moveTo(x, y);
    ctx.beginPath();
  }

  // The wave must reach the end of the canvas at the same time as the song ends
  // so the wave is updated at a rate of song length / canvas width
  waveUpdatePeriod = songLength / width;

  drawWaveInterval = setInterval(() => {
    line(); // Draw a single step of the wave
    x++; // Increment x
    if (x >= width) clearInterval(drawWaveInterval); // Stop when end of canvas is reached
  }, waveUpdatePeriod);

  // After starting the wave, no longer need to reset the canvas
  reset = false;
}

// Draw a single step of the wave
function line() {
  y = (height / 2) + (0.4 * volumeSlider.value) * calculateWave(x, 1 / ((freq / 10000) * (numNotes / 2)));

  ctx.lineTo(x, y);
  ctx.strokeStyle = colourGradient;
  ctx.stroke();
}

// Return waveform value for selected type
function calculateWave(x, period) {
  switch (waveTypeSelect.value) {
    case 'sine': return Math.sin(2 * Math.PI / period * x);
    case 'square': return Math.sign(Math.sin(2 * Math.PI / period * x));
    case 'triangle': return (2 / Math.PI) * Math.asin(Math.sin(2 * Math.PI / period * x));
    case 'sawtooth': return 2 * (x / period - Math.floor(0.5 + x / period));
    default: return Math.sin(2 * Math.PI / period * x);
  }
}

// DARK MODE 

// Toggle dark mode and remember preference
function toggleDarkMode() {
  let isDark = document.body.classList.toggle('dark-mode');
  localStorage.setItem('darkMode', isDark ? 'enabled' : 'disabled');
}

// On load, check local storage for dark mode preference
document.addEventListener('DOMContentLoaded', () => {
  if (localStorage.getItem('darkMode') === 'enabled') {
    document.body.classList.add('dark-mode');
    document.getElementById('toggle-dark-mode').checked = true;
  }
});