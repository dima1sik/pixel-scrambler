const ui = {
  imageInput: document.getElementById("imageInput"),
  fileSelectBtn: document.getElementById("fileSelectBtn"),
  fileNameText: document.getElementById("fileNameText"),

  stageSelect: document.getElementById("stageSelect"),
  seedInput: document.getElementById("seedInput"),
  wrongSeedInput: document.getElementById("wrongSeedInput"),

  scrambleBtn: document.getElementById("scrambleBtn"),
  unscrambleBtn: document.getElementById("unscrambleBtn"),
  wrongUnscrambleBtn: document.getElementById("wrongUnscrambleBtn"),
  saveScrambledBtn: document.getElementById("saveScrambledBtn"),
  saveRestoredBtn: document.getElementById("saveRestoredBtn"),
  saveDifferenceBtn: document.getElementById("saveDifferenceBtn"),

  statusText: document.getElementById("statusText")
};

const canvases = {
  original: document.getElementById("originalCanvas"),
  scrambled: document.getElementById("scrambledCanvas"),
  restored: document.getElementById("restoredCanvas"),
  difference: document.getElementById("differenceCanvas")
};

const ctx = {
  original: canvases.original.getContext("2d"),
  scrambled: canvases.scrambled.getContext("2d"),
  restored: canvases.restored.getContext("2d"),
  difference: canvases.difference.getContext("2d")
};

const metrics = {
  originalCorr: document.getElementById("originalCorrValue"),
  scrambledCorr: document.getElementById("scrambledCorrValue"),
  restoreMode: document.getElementById("restoreModeValue"),
  restoredMse: document.getElementById("restoredMseValue"),
  exactRestore: document.getElementById("exactRestoreValue")
};

let currentImage = null;

/* ---------- Basic helpers ---------- */

function setStatus(message) {
  ui.statusText.textContent = "Status: " + message;
}

function parseSeed(value, fallback) {
  const number = parseInt(value, 10);
  return Number.isNaN(number) ? fallback : number;
}

function getStage() {
  return ui.stageSelect.value;
}

function getCorrectSeed() {
  return parseSeed(ui.seedInput.value, 10);
}

function getWrongSeed() {
  return parseSeed(ui.wrongSeedInput.value, 11);
}

function hasLoadedImage() {
  if (!currentImage) {
    setStatus("load an image first");
    return false;
  }
  return true;
}

function fitCanvasToImage(canvas, image) {
  canvas.width = image.width;
  canvas.height = image.height;
}

function clearCanvas(context, canvas) {
  context.clearRect(0, 0, canvas.width, canvas.height);
}

function clearAllCanvases() {
  clearCanvas(ctx.original, canvases.original);
  clearCanvas(ctx.scrambled, canvases.scrambled);
  clearCanvas(ctx.restored, canvases.restored);
  clearCanvas(ctx.difference, canvases.difference);
}

function clearOutputCanvases() {
  clearCanvas(ctx.scrambled, canvases.scrambled);
  clearCanvas(ctx.restored, canvases.restored);
  clearCanvas(ctx.difference, canvases.difference);
}

function getImageData(context, canvas) {
  return context.getImageData(0, 0, canvas.width, canvas.height);
}

function putImageData(context, imageData) {
  context.putImageData(imageData, 0, 0);
}

function normalizeShift(shift, size) {
  let result = shift % size;
  if (result < 0) {
    result += size;
  }
  return result;
}

function formatNumber(value) {
  return value.toFixed(6);
}

function downloadCanvas(canvas, filename) {
  if (canvas.width === 0 || canvas.height === 0) {
    setStatus("no image to save");
    return;
  }

  const link = document.createElement("a");
  link.href = canvas.toDataURL("image/png");
  link.download = filename;
  link.click();
}

/* ---------- Metrics ---------- */

function resetMetrics() {
  metrics.originalCorr.textContent = "-";
  metrics.scrambledCorr.textContent = "-";
  metrics.restoreMode.textContent = "-";
  metrics.restoredMse.textContent = "-";
  metrics.exactRestore.textContent = "-";
}

function resetRestoreMetrics() {
  metrics.restoreMode.textContent = "-";
  metrics.restoredMse.textContent = "-";
  metrics.exactRestore.textContent = "-";
}

function getGrayValue(data, offset) {
  return (data[offset] + data[offset + 1] + data[offset + 2]) / 3;
}

function calculateHorizontalCorrelation(imageData) {
  const width = imageData.width;
  const height = imageData.height;
  const data = imageData.data;

  if (width < 2) {
    return 0;
  }

  let n = 0;
  let sumX = 0;
  let sumY = 0;
  let sumXX = 0;
  let sumYY = 0;
  let sumXY = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width - 1; x++) {
      const a = getGrayValue(data, (y * width + x) * 4);
      const b = getGrayValue(data, (y * width + x + 1) * 4);

      n++;
      sumX += a;
      sumY += b;
      sumXX += a * a;
      sumYY += b * b;
      sumXY += a * b;
    }
  }

  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt(
    (n * sumXX - sumX * sumX) * (n * sumYY - sumY * sumY)
  );

  return denominator === 0 ? 0 : numerator / denominator;
}

function calculateMSE(imageA, imageB) {
  const dataA = imageA.data;
  const dataB = imageB.data;

  if (dataA.length !== dataB.length) {
    return null;
  }

  let sum = 0;
  let count = 0;

  for (let i = 0; i < dataA.length; i += 4) {
    const dr = dataA[i] - dataB[i];
    const dg = dataA[i + 1] - dataB[i + 1];
    const db = dataA[i + 2] - dataB[i + 2];

    sum += dr * dr + dg * dg + db * db;
    count += 3;
  }

  return sum / count;
}

function areImagesExactlyEqual(imageA, imageB) {
  const dataA = imageA.data;
  const dataB = imageB.data;

  if (dataA.length !== dataB.length) {
    return false;
  }

  for (let i = 0; i < dataA.length; i++) {
    if (dataA[i] !== dataB[i]) {
      return false;
    }
  }

  return true;
}

function buildDifferenceImage(imageA, imageB) {
  const width = imageA.width;
  const height = imageA.height;
  const dataA = imageA.data;
  const dataB = imageB.data;
  const result = new Uint8ClampedArray(dataA.length);

  for (let i = 0; i < dataA.length; i += 4) {
    result[i] = Math.abs(dataA[i] - dataB[i]);
    result[i + 1] = Math.abs(dataA[i + 1] - dataB[i + 1]);
    result[i + 2] = Math.abs(dataA[i + 2] - dataB[i + 2]);
    result[i + 3] = 255;
  }

  return new ImageData(result, width, height);
}

function updateOriginalMetric() {
  const image = getImageData(ctx.original, canvases.original);
  metrics.originalCorr.textContent = formatNumber(calculateHorizontalCorrelation(image));
}

function updateScrambledMetric(image) {
  metrics.scrambledCorr.textContent = formatNumber(calculateHorizontalCorrelation(image));
}

function updateRestoreMetrics(restoredImage, modeText) {
  const originalImage = getImageData(ctx.original, canvases.original);
  const mse = calculateMSE(originalImage, restoredImage);
  const exact = areImagesExactlyEqual(originalImage, restoredImage);
  const differenceImage = buildDifferenceImage(originalImage, restoredImage);

  metrics.restoreMode.textContent = modeText;
  metrics.restoredMse.textContent = mse === null ? "-" : formatNumber(mse);
  metrics.exactRestore.textContent = exact ? "TAK" : "NIE";

  clearCanvas(ctx.difference, canvases.difference);
  putImageData(ctx.difference, differenceImage);
}

/* ---------- Shared transforms ---------- */

function shiftRows(imageData, shifts) {
  const width = imageData.width;
  const height = imageData.height;
  const source = imageData.data;
  const result = new Uint8ClampedArray(source.length);

  for (let y = 0; y < height; y++) {
    const shift = normalizeShift(shifts[y], width);

    for (let x = 0; x < width; x++) {
      const oldOffset = (y * width + x) * 4;
      const newX = (x + shift) % width;
      const newOffset = (y * width + newX) * 4;

      result[newOffset] = source[oldOffset];
      result[newOffset + 1] = source[oldOffset + 1];
      result[newOffset + 2] = source[oldOffset + 2];
      result[newOffset + 3] = source[oldOffset + 3];
    }
  }

  return new ImageData(result, width, height);
}

function createPRNG(seed) {
  let state = seed >>> 0;

  if (state === 0) {
    state = 123456789;
  }

  return function () {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function buildPermutation(length, seed) {
  const permutation = new Uint32Array(length);

  for (let i = 0; i < length; i++) {
    permutation[i] = i;
  }

  const random = createPRNG(seed);

  for (let i = length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const temp = permutation[i];
    permutation[i] = permutation[j];
    permutation[j] = temp;
  }

  return permutation;
}

function invertPermutation(permutation) {
  const inverse = new Uint32Array(permutation.length);

  for (let i = 0; i < permutation.length; i++) {
    inverse[permutation[i]] = i;
  }

  return inverse;
}

function permutePixels(imageData, permutation) {
  const width = imageData.width;
  const height = imageData.height;
  const source = imageData.data;
  const result = new Uint8ClampedArray(source.length);
  const pixelCount = width * height;

  for (let oldPixelIndex = 0; oldPixelIndex < pixelCount; oldPixelIndex++) {
    const newPixelIndex = permutation[oldPixelIndex];
    const oldOffset = oldPixelIndex * 4;
    const newOffset = newPixelIndex * 4;

    result[newOffset] = source[oldOffset];
    result[newOffset + 1] = source[oldOffset + 1];
    result[newOffset + 2] = source[oldOffset + 2];
    result[newOffset + 3] = source[oldOffset + 3];
  }

  return new ImageData(result, width, height);
}

function buildKeystream(length, seed) {
  const stream = new Uint8Array(length);
  const random = createPRNG(seed);

  for (let i = 0; i < length; i++) {
    stream[i] = Math.floor(random() * 256);
  }

  return stream;
}

function substitutePixels(imageData, seed, inverse) {
  const width = imageData.width;
  const height = imageData.height;
  const source = imageData.data;
  const result = new Uint8ClampedArray(source.length);
  const stream = buildKeystream(width * height * 3, seed);

  let streamIndex = 0;

  for (let i = 0; i < source.length; i += 4) {
    const r = stream[streamIndex++];
    const g = stream[streamIndex++];
    const b = stream[streamIndex++];

    if (inverse) {
      result[i] = (source[i] - r + 256) % 256;
      result[i + 1] = (source[i + 1] - g + 256) % 256;
      result[i + 2] = (source[i + 2] - b + 256) % 256;
    } else {
      result[i] = (source[i] + r) % 256;
      result[i + 1] = (source[i + 1] + g) % 256;
      result[i + 2] = (source[i + 2] + b) % 256;
    }

    result[i + 3] = source[i + 3];
  }

  return new ImageData(result, width, height);
}

/* ---------- Stage 1: weak ---------- */

function createStage1RowShifts(seed, width, height) {
  const shifts = [];
  const bandSize = 18;
  const maxShift = Math.max(6, Math.floor(width * 0.05));

  for (let y = 0; y < height; y++) {
    const band = Math.floor(y / bandSize);
    const direction = band % 2 === 0 ? 1 : -1;
    const shift = ((seed + band * 4) % (maxShift + 1)) * direction;
    shifts.push(shift);
  }

  return shifts;
}

function scrambleStage1(imageData, seed) {
  const shifts = createStage1RowShifts(seed, imageData.width, imageData.height);
  return shiftRows(imageData, shifts);
}

function unscrambleStage1(imageData, seed) {
  const shifts = createStage1RowShifts(seed, imageData.width, imageData.height)
    .map((value) => -value);

  return shiftRows(imageData, shifts);
}

/* ---------- Stage 2: pure pixel permutation ---------- */

function scrambleStage2(imageData, seed) {
  const pixelCount = imageData.width * imageData.height;
  const permutation = buildPermutation(pixelCount, seed);
  return permutePixels(imageData, permutation);
}

function unscrambleStage2(imageData, seed) {
  const pixelCount = imageData.width * imageData.height;
  const permutation = buildPermutation(pixelCount, seed);
  const inversePermutation = invertPermutation(permutation);
  return permutePixels(imageData, inversePermutation);
}

/* ---------- Stage 3: permutation + substitution ---------- */

function scrambleStage3(imageData, seed) {
  const pixelCount = imageData.width * imageData.height;
  const permutation = buildPermutation(pixelCount, seed);
  const permuted = permutePixels(imageData, permutation);
  return substitutePixels(permuted, seed * 3 + 17, false);
}

function unscrambleStage3(imageData, seed) {
  const withoutColors = substitutePixels(imageData, seed * 3 + 17, true);
  const pixelCount = imageData.width * imageData.height;
  const permutation = buildPermutation(pixelCount, seed);
  const inversePermutation = invertPermutation(permutation);
  return permutePixels(withoutColors, inversePermutation);
}

/* ---------- Stage selector ---------- */

const scrambleMap = {
  "1": scrambleStage1,
  "2": scrambleStage2,
  "3": scrambleStage3
};

const unscrambleMap = {
  "1": unscrambleStage1,
  "2": unscrambleStage2,
  "3": unscrambleStage3
};

function scrambleByStage(imageData, stage, seed) {
  return scrambleMap[stage](imageData, seed);
}

function unscrambleByStage(imageData, stage, seed) {
  return unscrambleMap[stage](imageData, seed);
}

/* ---------- File loading ---------- */

function handleLoadedImage(image) {
  currentImage = image;

  Object.values(canvases).forEach((canvas) => fitCanvasToImage(canvas, image));

  clearAllCanvases();
  ctx.original.drawImage(image, 0, 0);

  resetMetrics();
  updateOriginalMetric();
  setStatus("image loaded");
}

function loadImageFromFile(file) {
  const reader = new FileReader();

  reader.onload = function (event) {
    const image = new Image();

    image.onload = function () {
      handleLoadedImage(image);
    };

    image.src = event.target.result;
  };

  reader.readAsDataURL(file);
}

function handleFileChange(event) {
  const file = event.target.files[0];

  if (!file) {
    ui.fileNameText.textContent = "No file selected";
    setStatus("no image selected");
    return;
  }

  ui.fileNameText.textContent = file.name;
  loadImageFromFile(file);
}

/* ---------- Main actions ---------- */

function handleScramble() {
  if (!hasLoadedImage()) {
    return;
  }

  const stage = getStage();
  const seed = getCorrectSeed();
  const originalImage = getImageData(ctx.original, canvases.original);
  const scrambledImage = scrambleByStage(originalImage, stage, seed);

  clearCanvas(ctx.scrambled, canvases.scrambled);
  putImageData(ctx.scrambled, scrambledImage);

  clearCanvas(ctx.restored, canvases.restored);
  clearCanvas(ctx.difference, canvases.difference);
  resetRestoreMetrics();

  updateScrambledMetric(scrambledImage);
  setStatus("Scramble completed for stage " + stage);
}

function handleUnscramble(seed, modeText, statusSuffix) {
  if (!hasLoadedImage()) {
    return;
  }

  const stage = getStage();
  const scrambledImage = getImageData(ctx.scrambled, canvases.scrambled);
  const restoredImage = unscrambleByStage(scrambledImage, stage, seed);

  clearCanvas(ctx.restored, canvases.restored);
  putImageData(ctx.restored, restoredImage);

  updateRestoreMetrics(restoredImage, modeText);
  setStatus("Unscramble completed for stage " + stage + " " + statusSuffix);
}

function saveCanvasWithStage(canvas, filenamePrefix, successMessage) {
  const stage = getStage();
  downloadCanvas(canvas, filenamePrefix + stage + ".png");
  setStatus(successMessage);
}

/* ---------- Events ---------- */

ui.fileSelectBtn.addEventListener("click", function () {
  ui.imageInput.click();
});

ui.imageInput.addEventListener("change", handleFileChange);

ui.scrambleBtn.addEventListener("click", handleScramble);

ui.unscrambleBtn.addEventListener("click", function () {
  handleUnscramble(getCorrectSeed(), "correct key", "with the correct key");
});

ui.wrongUnscrambleBtn.addEventListener("click", function () {
  handleUnscramble(getWrongSeed(), "wrong key", "with the wrong key");
});

ui.saveScrambledBtn.addEventListener("click", function () {
  saveCanvasWithStage(canvases.scrambled, "scrambled_stage_", "scrambled image saved");
});

ui.saveRestoredBtn.addEventListener("click", function () {
  saveCanvasWithStage(canvases.restored, "restored_stage_", "restored image saved");
});

ui.saveDifferenceBtn.addEventListener("click", function () {
  saveCanvasWithStage(canvases.difference, "difference_stage_", "difference image saved");
});


