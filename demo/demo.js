const welcome = document.getElementById('welcome');
const playerContainer = document.getElementById('player-container');
const uploadArea = document.getElementById('upload-area');
const fileInput = document.getElementById('file-input');
const errorEl = document.getElementById('error');
const gallery = document.getElementById('gallery');
const backButton = document.getElementById('back-button');
const loading = document.getElementById('loading');
const infoText = document.getElementById('info-text');
const attributionOverlay = document.getElementById('attribution-overlay');

const METRIKA_COUNTER_ID = 109155448;

let currentPlayer = null;
let currentAttribution = null;

function trackGoal(goal, params) {
  if (typeof ym === 'undefined') return;
  ym(METRIKA_COUNTER_ID, 'reachGoal', goal, params);
}

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
  attributionOverlay.classList.remove('show');
}

function showPlayer() {
  welcome.classList.add('hidden');
  playerContainer.classList.add('active');
  backButton.classList.add('show');
  infoText.classList.add('show');
  if (currentAttribution) {
    attributionOverlay.innerHTML = currentAttribution;
    attributionOverlay.classList.add('show');
  }
}

async function loadImage(imageSource, attribution = null) {
  showLoading();
  errorEl.classList.remove('show');
  currentAttribution = attribution;
  showPlayer();

  trackGoal('view_panorama');

  try {
    if (!currentPlayer) {
      const { PanoramaPlayer } = await import('./dist/index.js');

      currentPlayer = new PanoramaPlayer({
        wheelModifierRequired: false,
        events: {
          onRotateStart: () => trackGoal('rotate_start'),
          onWheelZoom: () => trackGoal('wheel_zoom'),
          onPinchZoom: () => trackGoal('pinch_zoom'),
          onFullscreenEnter: () => trackGoal('fullscreen_enter'),
          onFullscreenExit: () => trackGoal('fullscreen_exit'),
        },
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
      trackGoal('load_success');
    })
    .catch((err) => {
      hideLoading();
      showWelcome();
      trackGoal('load_error');
      showError(`Failed to load image: ${err.message}`);
    });
}

uploadArea.addEventListener('click', () => {
  trackGoal('upload_image_click');
  fileInput.click();
});

fileInput.addEventListener('change', (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  trackGoal('select_upload_file');

  const validation = validateImage(file);
  if (!validation.valid) {
    trackGoal('upload_validation_error');
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
      trackGoal('upload_image_ready');
      loadImage(img);
    };
    img.onerror = () => {
      trackGoal('upload_image_decode_error');
      showError('Failed to load image');
    };
    img.src = event.target?.result;
  };
  reader.onerror = () => {
    trackGoal('upload_file_read_error');
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

  trackGoal('upload_image_drop');

  const file = e.dataTransfer?.files?.[0];
  if (!file) return;

  const validation = validateImage(file);
  if (!validation.valid) {
    trackGoal('upload_validation_error');
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
      trackGoal('upload_image_ready');
      loadImage(img);
    };
    img.onerror = () => {
      trackGoal('upload_image_decode_error');
      showError('Failed to load image');
    };
    img.src = event.target?.result;
  };
  reader.onerror = () => {
    trackGoal('upload_file_read_error');
    showError('Failed to read file');
  };
  reader.readAsDataURL(file);
});

backButton.addEventListener('click', () => {
  trackGoal('back_to_welcome');
  showWelcome();
});

gallery.querySelectorAll('.gallery-item').forEach((item, idx) => {
  const attributionEl = item.querySelector('.attribution');

  item.addEventListener('click', () => {
    trackGoal('select_gallery_image', { index: idx });
    const fullUrl = item.dataset.fullSrc;
    const attribution = attributionEl?.innerHTML;
    loadImage(fullUrl, attribution);
  });

  attributionEl?.addEventListener('click', (e) => {
    e.stopPropagation();
  });
});
