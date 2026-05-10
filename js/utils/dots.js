// Procedural land-dot generator.
// Produces ~8000 dots within rough continental rectangles, then paints them
// onto a 2D canvas using equirectangular projection. The canvas becomes the
// globe map texture.

const LAND_REGIONS = [
  // [latMin, latMax, lngMin, lngMax, weight]
  // North America
  [49,  72, -141,  -52, 1.0],   // Canada
  [60,  72, -168, -141, 0.7],   // Alaska
  [25,  49, -125,  -67, 1.0],   // USA
  [14,  32, -118,  -86, 0.7],   // Mexico
  [ 6,  18,  -92,  -77, 0.5],   // Central America
  [60,  84,  -75,  -10, 0.9],   // Greenland
  [63,  67,  -25,  -13, 0.5],   // Iceland
  // South America
  [-12, 12,  -82,  -50, 1.0],   // Northern SA
  [-23,-12,  -78,  -34, 1.0],   // Brazil
  [-55,-23,  -75,  -53, 0.9],   // Southern Cone
  // Europe
  [50,  60,  -10,    2, 0.6],   // UK / Ireland
  [35,  61,  -10,   42, 1.0],   // Continental Europe
  [55,  71,    5,   30, 0.7],   // Scandinavia
  // Russia / North Asia
  [50,  75,   30,  180, 1.0],   // Russia
  // Asia
  [20,  50,   60,  140, 1.0],   // China + Mongolia
  [ 5,  35,   60,   95, 0.9],   // India + Pakistan
  [-10, 25,   95,  130, 0.9],   // SE Asia mainland
  [-10,  6,   95,  140, 0.6],   // Indonesia
  [30,  46,  130,  146, 0.6],   // Japan
  [33,  43,  124,  131, 0.4],   // Korea
  // Middle East
  [12,  35,   34,   60, 0.9],   // Arabia + Iran
  // Africa
  [10,  37,  -18,   42, 1.0],   // North Africa
  [-12, 12,    8,   42, 1.0],   // Central Africa
  [-35,-10,   12,   42, 1.0],   // Southern Africa
  [-26,-12,   43,   51, 0.5],   // Madagascar
  // Oceania
  [-38,-10,  113,  155, 1.0],   // Australia
  [-47,-34,  165,  179, 0.5],   // New Zealand
];

// Holes — water bodies inside larger rectangles. Skip dots that fall here.
const WATER_HOLES = [
  [51, 65, -95, -75],   // Hudson Bay
  [18, 30, -97, -82],   // Gulf of Mexico
  [30, 46,  -5,  36],   // Mediterranean
  [40, 47,  28,  42],   // Black Sea
  [36, 47,  47,  54],   // Caspian
  [12, 30,  32,  43],   // Red Sea
  [24, 30,  48,  58],   // Persian Gulf
  [-8, 10, 100, 120],   // Java Sea / Borneo gap (rough)
];

function rand(min, max) { return min + Math.random() * (max - min); }

function inHole(lat, lng) {
  for (const [a, b, c, d] of WATER_HOLES) {
    if (lat >= a && lat <= b && lng >= c && lng <= d) return true;
  }
  return false;
}

/**
 * Generate { lat, lng } pairs distributed across continental landmasses.
 * @param {number} count
 * @returns {Array<{lat:number,lng:number}>}
 */
export function generateLandDots(count = 8000) {
  const totalWeight = LAND_REGIONS.reduce(
    (sum, [a, b, c, d, w]) => sum + (b - a) * (d - c) * w,
    0
  );

  const dots = [];
  let attempts = 0;
  const maxAttempts = count * 4;

  while (dots.length < count && attempts < maxAttempts) {
    attempts++;
    // Weighted region pick
    let r = Math.random() * totalWeight;
    let region = LAND_REGIONS[LAND_REGIONS.length - 1];
    for (const reg of LAND_REGIONS) {
      const [a, b, c, d, w] = reg;
      const weight = (b - a) * (d - c) * w;
      r -= weight;
      if (r <= 0) { region = reg; break; }
    }
    const [a, b, c, d] = region;
    const lat = rand(a, b);
    const lng = rand(c, d);
    if (inHole(lat, lng)) continue;
    dots.push({ lat, lng });
  }

  return dots;
}

/**
 * Render a dot-matrix world-map texture and return the canvas element.
 * @param {object} opts
 * @param {number} [opts.width=2048]
 * @param {number} [opts.height=1024]
 * @param {number} [opts.dotCount=8000]
 * @param {string} [opts.dotColor='#1a3a6a']
 * @param {string} [opts.bgColor='#060e20']
 */
export function buildMapCanvas({
  width = 2048,
  height = 1024,
  dotCount = 8000,
  dotColor = '#1a3a6a',
  bgColor = '#060e20'
} = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, width, height);

  const dots = generateLandDots(dotCount);

  // Subtle outer glow layer
  ctx.fillStyle = 'rgba(40, 88, 156, 0.2)';
  for (const { lat, lng } of dots) {
    const x = ((lng + 180) / 360) * width;
    const y = ((90 - lat) / 180) * height;
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Crisp dot layer on top
  ctx.fillStyle = dotColor;
  for (const { lat, lng } of dots) {
    const x = ((lng + 180) / 360) * width;
    const y = ((90 - lat) / 180) * height;
    ctx.beginPath();
    ctx.arc(x, y, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  return canvas;
}

/**
 * lat/lng (deg) to a 3D point on a sphere of given radius.
 */
export function latLngToVec3(lat, lng, radius = 1) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  return {
    x: -radius * Math.sin(phi) * Math.cos(theta),
    y:  radius * Math.cos(phi),
    z:  radius * Math.sin(phi) * Math.sin(theta)
  };
}
