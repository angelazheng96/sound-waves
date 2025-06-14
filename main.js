const input = document.getElementById("input");

// Create web audio api elements
const audioCtx = new AudioContext();
const gainNode = audioCtx.createGain();

// Create Oscillator node
const oscillator = audioCtx.createOscillator();
oscillator.connect(gainNode);
gainNode.connect(audioCtx.destination);
oscillator.type = "sine";

oscillator.start();
gainNode.gain.value = 0;

// Initialize note frequencies
noteNames = new Map();
noteNames.set("C", 261.6);
noteNames.set("D", 293.7);
noteNames.set("E", 329.6);
noteNames.set("F", 349.2);
noteNames.set("G", 392.0);
noteNames.set("A", 440.0);
noteNames.set("B", 493.9);

var freq;

// Define canvas variables
var canvas = document.getElementById("canvas");
var ctx = canvas.getContext("2d");
var width = ctx.canvas.width;
var height = ctx.canvas.height;

var counter = 0;
var interval = null;

var reset = false;

var timePerNote = 0;
var songLength = 6000;
var length = 0;

var colourGradient;

// HTML input elements
const colour_1 = document.getElementById('colour-1');
const colour_2 = document.getElementById('colour-2');
const colour_3 = document.getElementById('colour-3');

// Updates CSS colour variables
function updateColours() {
  document.documentElement.style.setProperty('--colour1', colour_1.value);
  document.documentElement.style.setProperty('--colour2', colour_2.value);
  document.documentElement.style.setProperty('--colour3', colour_3.value);
}

colour_1.addEventListener('input', updateColours);
colour_2.addEventListener('input', updateColours);
colour_3.addEventListener('input', updateColours);

updateColours();

const volumeSlider = document.getElementById('volume-slider');
const volumeSliderValue = document.getElementById('volume-sliderValue');

volumeSlider.addEventListener('input', function () {
  volumeSliderValue.textContent = volumeSlider.value;
});

const lengthSlider = document.getElementById('length-slider');
const lengthSliderValue = document.getElementById('length-sliderValue');

lengthSlider.addEventListener('input', function () {
  lengthSliderValue.textContent = lengthSlider.value + " seconds";
  songLength = parseInt(lengthSlider.value) * 1000; // Convert seconds to milliseconds
});

// Wave type
const waveTypeSelect = document.getElementById('wave-type-select');

// Recording
var blob, recorder = null;
var chunks = [];

const recordingToggle = document.getElementById('record');

function startRecording() {
  const canvasStream = canvas.captureStream(20); // Frame rate of canvas
  const audioDestination = audioCtx.createMediaStreamDestination();
  gainNode.connect(audioDestination);
  const combinedStream = new MediaStream();

  chunks = []; // Reset chunks for new recording

  // Add in video data
  canvasStream.getVideoTracks().forEach(track => combinedStream.addTrack(track));

  // Add in audio data
  audioDestination.stream.getAudioTracks().forEach(track => combinedStream.addTrack(track));

  recorder = new MediaRecorder(combinedStream, { mimeType: 'video/webm' });

  recorder.ondataavailable = e => {
    if (e.data.size > 0) {
      chunks.push(e.data);
    }
  };

  recorder.onstop = () => {
    const blob = new Blob(chunks, { type: 'video/webm' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'recording.webm';
    a.click();
    URL.revokeObjectURL(url);
  };

  recorder.start();
}

var is_recording = false;

function toggle() {
  is_recording = !is_recording;

  if (is_recording) {
    recordingToggle.innerHTML = "Stop Recording";
    startRecording();
  } else {
    recordingToggle.innerHTML = "Start Recording";
    recorder.stop();
  }
}

// Plays note at given pitch
function frequency(pitch) {
  gainNode.gain.setValueAtTime(volumeSlider.value, audioCtx.currentTime);
  setting = setInterval(() => { gainNode.gain.value = volumeSlider.value }, 1);
  oscillator.frequency.setValueAtTime(pitch, audioCtx.currentTime);
  setTimeout(() => {
    clearInterval(setting);
    gainNode.gain.value = 0;
  }, timePerNote - 100);

  freq = pitch;
}

function validInput(input) {
  // Check if input is valid (only contains C, D, E, F, G, A, B)
  const validChars = /^[CDEFGAB]+$/;
  return validChars.test(input);
}

// Handles button press
function handle() {
  reset = true;

  audioCtx.resume();
  gainNode.gain.value = 0;

  var userInput = String(input.value)
  var notesList = [];

  if (validInput(userInput)) {
    document.getElementById('input-error').style.display = 'none';

    songLength = parseInt(lengthSlider.value) * 1000; // Convert seconds to milliseconds
    length = userInput.length;
    timePerNote = (songLength / length);

    colourGradient = ctx.createLinearGradient(0, height / 2, width, height / 2);
    colourGradient.addColorStop(0, colour_1.value);
    colourGradient.addColorStop(0.5, colour_2.value);
    colourGradient.addColorStop(1, colour_3.value);

    for (i = 0; i < userInput.length; i++) {
      notesList.push(noteNames.get(userInput.charAt(i)));
    }

    let j = 0;

    // Play first note immediately
    frequency(parseInt(notesList[j]));
    drawWave();
    j++;

    repeat = setInterval(() => {
      if (j < notesList.length) {
        frequency(parseInt(notesList[j]));
        drawWave();
        j++;
      } else {
        clearInterval(repeat);
      }
    }, timePerNote);
  
  } else {
    document.getElementById('input-error').style.display = 'flex';
  }
  
}

function waveType(x, period) {
  switch (waveTypeSelect.value) {
    case 'sine':
      return Math.sin(2 * Math.PI / period * x);
    case 'square':
      return Math.sign(Math.sin(2 * Math.PI / period * x));
    case 'triangle':
      return (2 / Math.PI) * Math.asin(Math.sin(2 * Math.PI / period * x));
    case 'sawtooth':
      return 2 * (x / period - Math.floor(0.5 + x / period));
    default:
      return Math.sin(2 * Math.PI / period * x);
  }
}

var waveUpdatePeriod;

// Draws a sine wave with the current note frequency
function drawWave() {
  clearInterval(interval);

  if (reset) {
    ctx.clearRect(0, 0, width, height);

    x = 0;
    y = height / 2;

    ctx.moveTo(x, y);
    ctx.beginPath();
  }

  waveUpdatePeriod = songLength / width;

  counter = 0;
  interval = setInterval(line, waveUpdatePeriod);
  reset = false;
}

// Draws single part of sine wave
function line() {
  // Calculate where the cursor should be
  y = (height / 2) + (0.4 * volumeSlider.value) * waveType(x, 1 / ((freq / 10000) * (length / 2)));

  // Draw line
  ctx.lineTo(x, y);
  ctx.strokeStyle = colourGradient;
  ctx.stroke();

  x++;
  counter++;

  if (counter > (timePerNote / waveUpdatePeriod)) {
    clearInterval(interval);
  }
}

function toggleDarkMode() {
  let isDark = document.body.classList.toggle('dark-mode');
  localStorage.setItem('darkMode', isDark ? 'enabled' : 'disabled');
}

// On page load, remember if dark mode was enabled
document.addEventListener('DOMContentLoaded', (event) => {
  if (localStorage.getItem('darkMode') === 'enabled') {
    document.body.classList.add('dark-mode');
    document.getElementById('toggle-dark-mode').checked = true;
  }
});