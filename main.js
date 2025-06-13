const input = document.getElementById('input');

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
const vol_slider = document.getElementById('vol-slider');

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

// Plays note at given pitch for 1 second
function frequency(pitch) {
  gainNode.gain.setValueAtTime(vol_slider.value, audioCtx.currentTime);
  setting = setInterval(() => { gainNode.gain.value = vol_slider.value }, 1);
  oscillator.frequency.setValueAtTime(pitch, audioCtx.currentTime);
  setTimeout(() => {
    clearInterval(setting);
    gainNode.gain.value = 0;
  }, timePerNote - 100);

  freq = pitch / 10000;
}

// Handles button press
function handle() {
  reset = true;

  audioCtx.resume();
  gainNode.gain.value = 0;

  var userInput = String(input.value)
  var notesList = [];

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
  repeat = setInterval(() => {
    if (j < notesList.length) {
      frequency(parseInt(notesList[j]));
      drawWave();
      j++;
    } else {
      clearInterval(repeat);
    }
  }, timePerNote);
}

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

  counter = 0;
  interval = setInterval(line, 20);
  reset = false;
}

// Draws single part of sine wave
function line() {
  // Calculate where the cursor should be
  y = height / 2 + (vol_slider.value * 40 / 100) * Math.sin(2 * Math.PI * freq * x * (0.5 * length));

  // Draw line
  ctx.lineTo(x, y);
  ctx.strokeStyle = colourGradient;
  ctx.stroke();

  x++;
  counter++;

  if (counter > (timePerNote / 20)) {
    clearInterval(interval);
  }
}