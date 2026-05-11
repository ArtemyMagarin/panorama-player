import { PanoramaPlayer } from './dist/index.js';

const welcome = document.getElementById('welcome');
const playerContainer = document.getElementById('player-container');
const uploadArea = document.getElementById('upload-area');
const fileInput = document.getElementById('file-input');
const errorEl = document.getElementById('error');
const gallery = document.getElementById('gallery');
const backButton = document.getElementById('back-button');
const loading = document.getElementById('loading');
const infoText = document.getElementById('info-text');

let currentPlayer = null;

function showError(message) {
  errorEl.textContent = message;
  errorEl.classList.add('show');
  setTimeout(() => errorEl.classList.remove('show'), 5000);
}

function validateImage(file) {
  if (!file.type.startsWith('image/')) {
    return { valid: false, error: 'Please select an image file' };
  }

  if (file.size > 50 * 1024 * 1024) {
    return { valid: false, error: 'Image must be smaller than 50 MB' };
  }

  return { valid: true };
}

function showLoading() {
  loading.classList.add('show');
}

function hideLoading() {
  loading.classList.remove('show');
}

function showWelcome() {
  welcome.classList.remove('hidden');
  playerContainer.classList.remove('active');
  backButton.classList.remove('show');
  infoText.classList.remove('show');
}

function showPlayer() {
  welcome.classList.add('hidden');
  playerContainer.classList.add('active');
  backButton.classList.add('show');
  infoText.classList.add('show');
}

function loadImage(imageSource) {
  showLoading();
  errorEl.classList.remove('show');
  showPlayer();

  try {
    if (!currentPlayer) {
      currentPlayer = new PanoramaPlayer({
        wheelModifierRequired: false,
      });
      currentPlayer.mount(playerContainer);
    }
  } catch (err) {
    hideLoading();
    showWelcome();
    showError(`Failed to initialize player: ${err.message}`);
    return;
  }

  currentPlayer
    .loadImage(imageSource)
    .then(() => {
      hideLoading();
    })
    .catch((err) => {
      hideLoading();
      showWelcome();
      showError(`Failed to load image: ${err.message}`);
    });
}

uploadArea.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', (e) => {
  const file = e.target.files?.[0];
  if (!file) return;

  const validation = validateImage(file);
  if (!validation.valid) {
    showError(validation.error);
    return;
  }

  const reader = new FileReader();
  reader.onload = (event) => {
    const img = new Image();
    img.onload = () => {
      const aspectRatio = img.width / img.height;
      if (Math.abs(aspectRatio - 2) > 0.1) {
        showError(
          `Image aspect ratio should be 2:1 (width:height). Your image is ${aspectRatio.toFixed(2)}:1`,
        );
        return;
      }
      loadImage(img);
    };
    img.onerror = () => {
      showError('Failed to load image');
    };
    img.src = event.target?.result;
  };
  reader.onerror = () => {
    showError('Failed to read file');
  };
  reader.readAsDataURL(file);
});

uploadArea.addEventListener('dragover', (e) => {
  e.preventDefault();
  uploadArea.classList.add('drag-over');
});

uploadArea.addEventListener('dragleave', () => {
  uploadArea.classList.remove('drag-over');
});

uploadArea.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadArea.classList.remove('drag-over');

  const file = e.dataTransfer?.files?.[0];
  if (!file) return;

  const validation = validateImage(file);
  if (!validation.valid) {
    showError(validation.error);
    return;
  }

  const reader = new FileReader();
  reader.onload = (event) => {
    const img = new Image();
    img.onload = () => {
      const aspectRatio = img.width / img.height;
      if (Math.abs(aspectRatio - 2) > 0.1) {
        showError(
          `Image aspect ratio should be 2:1 (width:height). Your image is ${aspectRatio.toFixed(2)}:1`,
        );
        return;
      }
      loadImage(img);
    };
    img.onerror = () => {
      showError('Failed to load image');
    };
    img.src = event.target?.result;
  };
  reader.onerror = () => {
    showError('Failed to read file');
  };
  reader.readAsDataURL(file);
});

backButton.addEventListener('click', showWelcome);

function createExampleCanvas(hueStart = 0) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');

  for (let x = 0; x < canvas.width; x++) {
    for (let y = 0; y < canvas.height; y++) {
      const hue = ((x / canvas.width + hueStart) % 1) * 360;
      const sat = 70 + (y / canvas.height) * 20;
      const lig = 40 + (y / canvas.height) * 30;
      ctx.fillStyle = `hsl(${hue}, ${sat}%, ${lig}%)`;
      ctx.fillRect(x, y, 1, 1);
    }
  }

  return canvas;
}

const examples = [
  { name: 'Warm', hue: 0 },
  { name: 'Cool', hue: 0.5 },
  { name: 'Green', hue: 0.3 },
];

examples.forEach(({ hue }) => {
  const item = document.createElement('div');
  item.className = 'gallery-item';
  const canvas = createExampleCanvas(hue);
  item.appendChild(canvas);
  item.addEventListener('click', () => {
    const img = new Image();
    img.src = canvas.toDataURL();
    loadImage(img);
  });
  gallery.appendChild(item);
});
