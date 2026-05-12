#!/usr/bin/env node

/**
 * Build script for demo site
 * - Updates HTML with preview images (with fetchpriority="high" for LCP)
 * - Copies dist to demo directory
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CLOUD_BASE_URL = 'https://panorama-player-demo.storage.yandexcloud.net';

const examples = [
  {
    previewUrl: `${CLOUD_BASE_URL}/960px-0300a_ITA_Bergamo_Duomo_-_Cattedrale_S_Alessandro_-_360_planar_V-P.jpg`,
    fullUrl: `${CLOUD_BASE_URL}/3840px-0300a_ITA_Bergamo_Duomo_-_Cattedrale_S_Alessandro_-_360_planar_V-P.jpg`,
    attribution:
      '<a href="https://commons.wikimedia.org/wiki/File:0300a_ITA_Bergamo_Duomo_-_Cattedrale_S_Alessandro_-_360_planar_V-P.jpg">Virtual-Pano</a>, <a href="https://creativecommons.org/licenses/by-sa/4.0">CC BY-SA 4.0</a>, via Wikimedia Commons',
    alt: 'Bergamo Cathedral panorama preview',
  },
  {
    previewUrl: `${CLOUD_BASE_URL}/960px-12-13_Linia_26_2016-06_1465217094.jpg`,
    fullUrl: `${CLOUD_BASE_URL}/12-13_Linia_26_2016-06_1465217094.jpg`,
    attribution:
      '<a href="https://commons.wikimedia.org/wiki/File:12-13_Linia_26_2016-06_1465217094.jpg">Artem Svetlov</a>, <a href="https://creativecommons.org/licenses/by/4.0">CC BY 4.0</a>, via Wikimedia Commons',
    alt: 'Metro train panorama preview',
  },
  {
    previewUrl: `${CLOUD_BASE_URL}/960px-12_Antikenkopien_am_Obeliskportal,_Sanssouci,_Potsdam-0011075.jpg`,
    fullUrl: `${CLOUD_BASE_URL}/12_Antikenkopien_am_Obeliskportal,_Sanssouci,_Potsdam-0011075.jpg`,
    attribution: '© Raimond Spekking',
    alt: 'Sanssouci palace panorama preview',
  },
  {
    previewUrl: `${CLOUD_BASE_URL}/960px-2011-03-06_interior_of_a_Shinkansen_N700.jpg`,
    fullUrl: `${CLOUD_BASE_URL}/2011-03-06_interior_of_a_Shinkansen_N700.jpg`,
    attribution:
      '<a href="https://commons.wikimedia.org/wiki/File:2011-03-06_interior_of_a_Shinkansen_N700.jpg">Masakazu Matsumoto</a>, <a href="https://creativecommons.org/licenses/by/2.0">CC BY 2.0</a>, via Wikimedia Commons',
    alt: 'Shinkansen train interior panorama preview',
  },
  {
    previewUrl: `${CLOUD_BASE_URL}/960px-2016_Moscow_metro_exhibition_(26928471660).jpg`,
    fullUrl: `${CLOUD_BASE_URL}/2016_Moscow_metro_exhibition_(26928471660).jpg`,
    attribution:
      '<a href="https://commons.wikimedia.org/wiki/File:2016_Moscow_metro_exhibition_(26928471660).jpg">Artem Svetlov from Moscow, Russia</a>, <a href="https://creativecommons.org/licenses/by/2.0">CC BY 2.0</a>, via Wikimedia Commons',
    alt: 'Moscow metro exhibition panorama preview',
  },
  {
    previewUrl: `${CLOUD_BASE_URL}/960px-Soissons_Cathedral_Interior_360x180,_Picardy,_France_-_Diliff.jpg`,
    fullUrl: `${CLOUD_BASE_URL}/Soissons_Cathedral_Interior_360x180,_Picardy,_France_-_Diliff.jpg`,
    attribution:
      '<a href="https://commons.wikimedia.org/wiki/File:Soissons_Cathedral_Interior_360x180,_Picardy,_France_-_Diliff.jpg">Diliff</a>, <a href="https://creativecommons.org/licenses/by-sa/3.0">CC BY-SA 3.0</a>, via Wikimedia Commons',
    alt: 'Soissons Cathedral interior panorama preview',
  },
];

function buildDemo() {
  console.log('Building demo site...');

  // Read the HTML template
  const templatePath = path.join(__dirname, '..', 'demo', 'template.html');
  const htmlPath = path.join(__dirname, '..', 'demo', 'index.html');
  let html = fs.readFileSync(templatePath, 'utf-8');

  // Generate gallery HTML with images
  const galleryHtml = examples
    .map(
      (example, idx) => `
            <div class="gallery-item" data-full-src="${example.fullUrl}">
              <img
                src="${example.previewUrl}"
                width="600"
                height="300"
                ${idx === 0 ? 'fetchpriority="high"' : ''}
                alt="${example.alt}"
              />
              <div class="attribution">${example.attribution}</div>
            </div>`,
    )
    .join('\n');

  // Replace the gallery section
  html = html.replace(
    /<div class="gallery" id="gallery">[\s\S]*?<\/div>/,
    `<div class="gallery" id="gallery">${galleryHtml}\n          </div>`,
  );

  // Write the updated HTML
  fs.writeFileSync(htmlPath, html, 'utf-8');
  console.log('Updated demo/index.html with preview images');

  // Copy dist to demo directory
  const distPath = path.join(__dirname, '..', 'dist');
  const demoDistPath = path.join(__dirname, '..', 'demo', 'dist');

  if (fs.existsSync(demoDistPath)) {
    fs.rmSync(demoDistPath, { recursive: true, force: true });
  }

  fs.cpSync(distPath, demoDistPath, { recursive: true });
  console.log('Copied dist to demo/dist');

  console.log('Demo build complete!');
}

buildDemo();
