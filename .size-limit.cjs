/** @type {import('size-limit').SizeLimitConfig} */
module.exports = [
  {
    name: 'PanoramaPlayer ESM (gzip)',
    path: 'dist/index.js',
    import: '{ PanoramaPlayer }',
    limit: '6 KB',
    gzip: true,
  },
  {
    name: 'PanoramaPlayer Tiles ESM (gzip)',
    path: 'dist/tiles/index.js',
    import: '{ TileCoordinateSystem, TileLoader }',
    limit: '14 KB',
    gzip: true,
  },
];
