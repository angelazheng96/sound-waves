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

// Plays note at given pitch for 1 second
function frequency(pitch) {
  gainNode.gain.setValueAtTime(100, audioCtx.currentTime);
  oscillator.frequency.setValueAtTime(pitch, audioCtx.currentTime);
  gainNode.gain.setValueAtTime(0, audioCtx.currentTime + 1);

  freq = pitch / 10000;
}

// Handles button press
function handle() {
  audioCtx.resume();
  gainNode.gain.value = 0;

  var userInput = String(input.value)
  frequency(noteNames.get(userInput));

  counter = 0;

  drawWave();
}

// Draws a sine wave with the current note frequency
function drawWave() {
  ctx.clearRect(0, 0, width, height);

  x = 0;
  y = height / 2;

  ctx.moveTo(x, y);
  ctx.beginPath();

  interval = setInterval(line, 20);
}

// Draws single part of sine wave
function line() {
  // Calculate where the cursor should be
  y = height / 2 + amplitude * Math.sin(2 * Math.PI * freq * x);

  // Draw line
  ctx.lineTo(x, y);
  ctx.stroke();

  x++;
  counter++;

  if (counter > 50) {
    clearInterval(interval);
  }
}