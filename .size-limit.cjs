/** @type {import('size-limit').SizeLimitConfig} */
module.exports = [
  {
    name: 'PanoramaPlayer ESM (gzip)',
    path: 'dist/index.js',
    import: '{ PanoramaPlayer }',
    limit: '15 KB',
    gzip: true,
  },
];
