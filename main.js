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

var amplitude = 40;

var counter = 0;
var interval = null;

var reset = false;

var timePerNote = 0;
var length = 0;

// HTML input elements
const colour_picker = document.getElementById('colour');
const vol_slider = document.getElementById('vol-slider');

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
  timePerNote = (6000 / length);

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
  y = height / 2 + amplitude * Math.sin(2 * Math.PI * freq * x * (0.5 * length));

  // Draw line
  ctx.lineTo(x, y);
  ctx.strokeStyle = colour_picker.value;
  ctx.stroke();

  x++;
  counter++;

  if (counter > (timerPerNote / 20)) {
    clearInterval(interval);
  }
}