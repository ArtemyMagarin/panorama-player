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
const attributionOverlay = document.getElementById('attribution-overlay');

let currentPlayer = null;
let currentAttribution = null;

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

function loadImage(imageSource, attribution = null) {
  showLoading();
  errorEl.classList.remove('show');
  currentAttribution = attribution;
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

const examples = [
  {
    previewUrl:
      './images/960px-0300a_ITA_Bergamo_Duomo_-_Cattedrale_S_Alessandro_-_360_planar_V-P.jpg',
    fullUrl:
      './images/3840px-0300a_ITA_Bergamo_Duomo_-_Cattedrale_S_Alessandro_-_360_planar_V-P.jpg',
    attribution:
      '<a href="https://commons.wikimedia.org/wiki/File:0300a_ITA_Bergamo_Duomo_-_Cattedrale_S_Alessandro_-_360_planar_V-P.jpg">Virtual-Pano</a>, <a href="https://creativecommons.org/licenses/by-sa/4.0">CC BY-SA 4.0</a>, via Wikimedia Commons',
  },
  {
    previewUrl: './images/960px-12-13_Linia_26_2016-06_1465217094.jpg',
    fullUrl: './images/12-13_Linia_26_2016-06_1465217094.jpg',
    attribution:
      '<a href="https://commons.wikimedia.org/wiki/File:12-13_Linia_26_2016-06_1465217094.jpg">Artem Svetlov</a>, <a href="https://creativecommons.org/licenses/by/4.0">CC BY 4.0</a>, via Wikimedia Commons',
  },
  {
    previewUrl: './images/960px-12_Antikenkopien_am_Obeliskportal,_Sanssouci,_Potsdam-0011075.jpg',
    fullUrl: './images/12_Antikenkopien_am_Obeliskportal,_Sanssouci,_Potsdam-0011075.jpg',
    attribution: '© Raimond Spekking',
  },
  {
    previewUrl: './images/960px-2011-03-06_interior_of_a_Shinkansen_N700.jpg',
    fullUrl: './images/2011-03-06_interior_of_a_Shinkansen_N700.jpg',
    attribution:
      '<a href="https://commons.wikimedia.org/wiki/File:2011-03-06_interior_of_a_Shinkansen_N700.jpg">Masakazu Matsumoto</a>, <a href="https://creativecommons.org/licenses/by/2.0">CC BY 2.0</a>, via Wikimedia Commons',
  },
  {
    previewUrl: './images/960px-2016_Moscow_metro_exhibition_(26928471660).jpg',
    fullUrl: './images/2016_Moscow_metro_exhibition_(26928471660).jpg',
    attribution:
      '<a href="https://commons.wikimedia.org/wiki/File:2016_Moscow_metro_exhibition_(26928471660).jpg">Artem Svetlov from Moscow, Russia</a>, <a href="https://creativecommons.org/licenses/by/2.0">CC BY 2.0</a>, via Wikimedia Commons',
  },
  {
    previewUrl: './images/960px-Soissons_Cathedral_Interior_360x180,_Picardy,_France_-_Diliff.jpg',
    fullUrl: './images/Soissons_Cathedral_Interior_360x180,_Picardy,_France_-_Diliff.jpg',
    attribution:
      '<a href="https://commons.wikimedia.org/wiki/File:Soissons_Cathedral_Interior_360x180,_Picardy,_France_-_Diliff.jpg">Diliff</a>, <a href="https://creativecommons.org/licenses/by-sa/3.0">CC BY-SA 3.0</a>, via Wikimedia Commons',
  },
];

examples.forEach(({ name, previewUrl, fullUrl, attribution }) => {
  const item = document.createElement('div');
  item.className = 'gallery-item';

  const img = document.createElement('img');
  img.src = previewUrl;
  img.alt = name;
  img.loading = 'lazy';

  const attributionEl = document.createElement('div');
  attributionEl.className = 'attribution';
  attributionEl.innerHTML = attribution;

  item.appendChild(img);
  item.appendChild(attributionEl);

  item.addEventListener('click', () => {
    loadImage(fullUrl, attribution);
  });

  attributionEl.addEventListener('click', (e) => {
    e.stopPropagation();
  });

  gallery.appendChild(item);
});
