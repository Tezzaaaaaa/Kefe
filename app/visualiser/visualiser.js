/* KEFE visualiser engine — shared renderer and preset registry. */
import * as THREE from 'three';
const PRESETS = [
  {
    key:'particles-swarm', name:'Particles Swarm', desc:'A responsive swarm of particles flowing through a layered orbital field.',
    keywords:['particles','particle','swarm','field','flow','orb','cloud'],
    params:{radius:42,spread:1.2,flow:1.1,drift:0.65,twist:1.4,glow:0.8},
    code:`const radius = addControl("radius", "Swarm Radius", 15, 90, 42);
const spread = addControl("spread", "Particle Spread", 0.2, 3, 1.2);
const flow = addControl("flow", "Flow Speed", 0, 3, 1.1);
const drift = addControl("drift", "Field Drift", 0, 2, 0.65);
const twist = addControl("twist", "Field Twist", 0, 4, 1.4);
const glow = addControl("glow", "Glow", 0, 1, 0.8);
const u = i / Math.max(count, 1);
const golden = 2.399963229728653;
const phi = Math.acos(1 - 2 * u);
const theta = i * golden;
const band = Math.sin(theta * 3.0 + time * flow) * 0.5 + 0.5;
const radial = radius * (0.25 + 0.75 * Math.sqrt(u)) * spread;
const localTwist = theta + time * flow * 0.55 + radial * 0.035 * twist;
const wobble = Math.sin(theta * 5.0 + time * flow * 1.7) * drift * (0.4 + u);
const x = Math.sin(phi) * Math.cos(localTwist) * radial + wobble * 7.0;
const y = Math.cos(phi) * radial + Math.sin(theta * 2.0 - time * flow) * drift * 8.0;
const z = Math.sin(phi) * Math.sin(localTwist) * radial + Math.cos(theta * 4.0 + time * flow) * drift * 5.0;
const pinch = 1.0 + 0.12 * Math.sin(time * flow * 1.3 + radial * 0.08);
target.set(x * pinch, y * pinch, z * pinch);
const energy = 0.5 + 0.5 * Math.sin(theta * 2.0 + time * flow * 2.0 + band * twist);
const hue = (0.52 + u * 0.34 + energy * 0.08) % 1.0;
const light = Math.min(0.9, 0.34 + energy * 0.38 + glow * 0.12);
color.setHSL(hue, 0.82, light);`
  },
  {
    key:'sphere', name:'Fibonacci Sphere', desc:'Even point distribution on a sphere surface.',
    keywords:['sphere','ball','globe','orb','fibonacci'],
    params:{},
    code:`const r = 30;
const phi = Math.acos(-1 + (2 * i) / count);
const theta = Math.sqrt(count * Math.PI) * phi;
target.set(r * Math.cos(theta) * Math.sin(phi), r * Math.sin(theta) * Math.sin(phi), r * Math.cos(phi));
color.setHex(0x00ff88);`
  },
  {
    key:'cube', name:'Lattice Cube', desc:'Solid grid of particles filling a cube volume.',
    keywords:['cube','box','grid','lattice','block','square'],
    params:{},
    code:`const s = Math.ceil(Math.pow(count, 1/3));
const sep = 2.5; const off = (s * sep) / 2;
let z = Math.floor(i / (s*s));
let y = Math.floor((i % (s*s)) / s);
let x = i % s;
target.set(x * sep - off, y * sep - off, z * sep - off);
color.setHex(0x00aaff);`
  },
  {
    key:'torus', name:'Torus', desc:'A closed ring of particles wound around a circular path.',
    keywords:['torus','ring','donut','annulus','doughnut'],
    params:{},
    code:`const R = 25; const r = 8;
const u = (i / count) * Math.PI * 2 * 40;
const v = (i / count) * Math.PI * 2;
target.set((R + r * Math.cos(u)) * Math.cos(v), (R + r * Math.cos(u)) * Math.sin(v), r * Math.sin(u));
color.setHex(0xff0055);`
  },
  {
    key:'helix', name:'Helix', desc:'Double-spiral coil rising along the Y axis, rainbow coloured.',
    keywords:['helix','spiral','dna','spring','coil','strand'],
    params:{},
    code:`const r = 15;
const h = count * 0.003;
const off = h / 2;
const t = i * 0.05;
target.set(Math.cos(t) * r, (i * 0.003) - off, Math.sin(t) * r);
color.setHSL((i / count), 1, 0.5);`
  },
  {
    key:'galaxy', name:'Spiral Galaxy', desc:'A rotating star field with a glowing core and sweeping spiral arms.',
    keywords:['galaxy','spiral','cosmos','stars','arms','nebula','milky'],
    params:{arms:4,swirl:0.35,radius:60,thickness:4,core:1.5,twinkle:2},
    code:`const armCount = addControl("arms", "Spiral Arms", 2, 8, 4);
const swirl = addControl("swirl", "Rotation Speed", 0, 2, 0.35);
const galaxyR = addControl("radius", "Galaxy Radius", 20, 120, 60);
const thickness = addControl("thickness", "Disk Thickness", 0.5, 20, 4);
const coreGlow = addControl("core", "Core Brightness", 0, 3, 1.5);
const twinkle = addControl("twinkle", "Star Twinkle", 0, 5, 2);
const safeCount = count > 1 ? count : 2;
const fi = i / safeCount;
const armIndex = i % Math.max(1, Math.floor(armCount));
const armAngleOffset = (armIndex / armCount) * Math.PI * 2;
const dist = Math.pow(fi, 0.5) * galaxyR + 0.001;
const spin = dist * 0.05 + time * swirl;
const angle = armAngleOffset + spin;
const scatter = Math.sin(i * 12.9898) * 43758.5453;
const scatterFrac = scatter - Math.floor(scatter);
const jitter = (scatterFrac - 0.5) * 6;
const yWave = Math.sin(dist * 0.15 - time * 0.4 + armIndex) * thickness * (1 - fi * 0.7);
target.set(
  Math.cos(angle) * dist + jitter,
  yWave + jitter * 0.3,
  Math.sin(angle) * dist + jitter
);
const coreFactor = 1.0 - Math.min(dist / galaxyR, 1.0);
const flicker = 0.5 + 0.5 * Math.sin(time * twinkle + i * 0.37);
const hue = 0.58 - coreFactor * 0.4 + fi * 0.05;
const lightness = 0.35 + coreFactor * coreGlow * 0.25 + flicker * 0.15;
color.setHSL(hue < 0 ? hue + 1 : hue, 0.75, Math.min(lightness, 0.95));`
  },
  {
    key:'aurora', name:'Aurora', desc:'Three ribbon-like curtains of light rippling across the sky.',
    keywords:['aurora','northern lights','curtain','sky','ribbon','borealis'],
    params:{},
    code:`const u = i / count;
const band = i % 3;
const seed = i * 2.399963229728653;
const spread = Math.sin(seed * 1.7) * 0.5 + 0.5;
const x = (u - 0.5) * 240;
const phase = x * 0.032 + time * 0.35 + band * 1.3;
const pulse = 0.5 + 0.5 * Math.sin(time * 0.7);
const curtain = Math.sin(phase) * (13 + pulse * 6);
const folds = Math.sin(x * 0.085 + time * 0.23 + band) * 7;
const height = 16 + spread * 44;
const y = curtain + folds + height * (spread - 0.5);
const z = (band - 1) * 17 + Math.sin(phase * 0.7) * 8;
target.set(x, y, z);
const hue = band === 2 ? 0.74 : 0.45 + band * 0.055;
const saturation = 0.65 + pulse * 0.18;
const lightness = 0.16 + spread * 0.25 + pulse * 0.08;
color.setHSL(hue, saturation, lightness);`
  },
  {
    key:'supernova', name:'Supernova Explosion', desc:'A stellar core collapse releasing an expanding shockwave of superheated debris.',
    keywords:['supernova','explosion','blast','boom','nova','shockwave','stellar'],
    params:{blast:70,speed:6,flash:2.5,debris:1.8,shell:8,pulse:1},
    code:`const blastRadius = addControl("blast", "Blast Radius", 20, 150, 70);
const shockSpeed = addControl("speed", "Expansion Speed", 0, 20, 6);
const coreFlash = addControl("flash", "Core Brightness", 0, 5, 2.5);
const debris = addControl("debris", "Debris Chaos", 0, 5, 1.8);
const shellThick = addControl("shell", "Shell Thickness", 1, 20, 8);
const pulseRate = addControl("pulse", "Shockwave Pulse", 0, 3, 1.0);
const safeCount = count > 1 ? count : 2;
const fi = i / safeCount;
const seedA = Math.sin(i * 12.9898) * 43758.5453;
const randA = seedA - Math.floor(seedA);
const seedB = Math.sin(i * 78.233 + 3.1) * 12345.678;
const randB = seedB - Math.floor(seedB);
const seedC = Math.sin(i * 45.164 + 7.7) * 98765.432;
const randC = seedC - Math.floor(seedC);
const phi = randA * Math.PI * 2;
const costh = randB * 2 - 1;
const sinth = Math.sqrt(Math.max(0, 1 - costh * costh));
const dirX = sinth * Math.cos(phi);
const dirY = costh;
const dirZ = sinth * Math.sin(phi);
const cycleTime = (time * shockSpeed + randC * shellThick) % (blastRadius + shellThick);
const dist = cycleTime;
const wobble = Math.sin(dist * 0.3 + time * 2 + i * 0.05) * debris * (dist / (blastRadius + 1));
const shockPulse = 0.5 + 0.5 * Math.sin(time * pulseRate * 3 - dist * 0.15);
target.set(
  dirX * dist + wobble,
  dirY * dist + wobble * 0.8,
  dirZ * dist + wobble
);
const coreProximity = Math.max(0, 1 - dist / (shellThick * 2));
const shellFactor = Math.max(0, 1 - Math.abs(dist - blastRadius * 0.6) / shellThick);
const hue = 0.13 - coreProximity * 0.1 - shellFactor * 0.05;
const sat = 0.9 - coreProximity * 0.3;
const light = 0.3 + coreProximity * coreFlash * 0.4 + shellFactor * shockPulse * 0.4;
color.setHSL(Math.max(hue, 0.0), Math.max(sat, 0.4), Math.min(light, 0.98));`
  },
  {
    key:'binary', name:'Binary Supernova', desc:'Twin stellar remnants orbiting amid layered shockwaves from a cataclysmic explosion.',
    keywords:['binary','twin','remnant','supernova','pulsar','neutron'],
    params:{blast:70,speed:6,flash:2.5,debris:1.8,shells:3,orbit:12,orbitspeed:1.5},
    code:`const blastRadius = addControl("blast", "Blast Radius", 20, 150, 70);
const shockSpeed = addControl("speed", "Expansion Speed", 0, 20, 6);
const coreFlash = addControl("flash", "Core Brightness", 0, 5, 2.5);
const debris = addControl("debris", "Debris Chaos", 0, 5, 1.8);
const shellCount = addControl("shells", "Shockwave Shells", 1, 5, 3);
const orbitGap = addControl("orbit", "Binary Separation", 2, 30, 12);
const orbitSpeed = addControl("orbitspeed", "Binary Orbit Speed", 0, 5, 1.5);
const safeCount = count > 1 ? count : 2;
const fi = i / safeCount;
const isRemnant = fi < 0.03 ? 1 : 0;
const seedA = Math.sin(i * 12.9898) * 43758.5453;
const randA = seedA - Math.floor(seedA);
const seedB = Math.sin(i * 78.233 + 3.1) * 12345.678;
const randB = seedB - Math.floor(seedB);
const seedC = Math.sin(i * 45.164 + 7.7) * 98765.432;
const randC = seedC - Math.floor(seedC);
const starPick = i % 2;
const orbitAngle = time * orbitSpeed + starPick * Math.PI;
const remX = Math.cos(orbitAngle) * orbitGap * starPick;
const remY = Math.sin(orbitAngle * 0.6) * orbitGap * 0.3 * starPick;
const remZ = Math.sin(orbitAngle) * orbitGap * starPick;
const remJitter = (randA - 0.5) * 3;
const phi = randA * Math.PI * 2;
const costh = randB * 2 - 1;
const sinth = Math.sqrt(Math.max(0, 1 - costh * costh));
const dirX = sinth * Math.cos(phi);
const dirY = costh;
const dirZ = sinth * Math.sin(phi);
const shellId = Math.floor(randC * shellCount);
const shellOffset = shellId * (shellThickSafe(shellCount));
const cycleSpan = blastRadius + shellOffset + 10;
const dist = (time * shockSpeed + randC * 10 + shellOffset * 3) % cycleSpan;
const wobble = Math.sin(dist * 0.3 + time * 2 + i * 0.05) * debris * (dist / (blastRadius + 1));
const shockPulse = 0.5 + 0.5 * Math.sin(time * 2 - dist * 0.15 + shellId * 2);
const ejectaX = dirX * dist + wobble;
const ejectaY = dirY * dist + wobble * 0.8;
const ejectaZ = dirZ * dist + wobble;
target.set(
  isRemnant ? (remX + remJitter) : ejectaX,
  isRemnant ? (remY + remJitter) : ejectaY,
  isRemnant ? (remZ + remJitter) : ejectaZ
);
const coreProximity = Math.max(0, 1 - dist / 16);
const shellFactor = Math.max(0, 1 - Math.abs((dist % (cycleSpan / shellCount)) - 8) / 8);
const hue = isRemnant ? (starPick === 0 ? 0.58 : 0.05) : (0.13 - coreProximity * 0.1 - shellFactor * 0.05);
const sat = isRemnant ? 0.85 : Math.max(0.9 - coreProximity * 0.3, 0.4);
const light = isRemnant ? (0.6 + coreFlash * 0.15) : Math.min(0.3 + coreProximity * coreFlash * 0.4 + shellFactor * shockPulse * 0.4, 0.98);
color.setHSL(Math.max(hue, 0.0), sat, light);
function shellThickSafe(n) { return 200 / Math.max(n, 1); }`
  },
  {
    key:'tesseract', name:'Breathing 4D Tesseract', desc:'A projected hyper-dimensional lattice rotating through four-dimensional space with organic field distortion.',
    keywords:['tesseract','4d','hypercube','hyper','lattice','clifford','dimension'],
    params:{scale:38,speed:0.8,breath:0.7,warp:0.55},
    code:`const scale = addControl("scale", "Tesseract Scale", 10, 80, 38);
const speed = addControl("speed", "4D Rotation", 0, 3, 0.8);
const breath = addControl("breath", "Breathing", 0, 2, 0.7);
const warp = addControl("warp", "Organic Warp", 0, 2, 0.55);
const n = Math.max(1, count); const p = i / n;
const a = p * 6.28318530718 * 18.0;
const b = p * 6.28318530718 * 7.0;
const t = time * speed;
const s1 = Math.sin(t); const c1 = Math.cos(t);
const s2 = Math.sin(t * 0.73 + 1.7); const c2 = Math.cos(t * 0.73 + 1.7);
let x = Math.sin(a) * scale;
let y = Math.cos(a) * scale;
let z = Math.sin(b) * scale;
const w = Math.cos(a * 0.5 + t) * Math.sin(b + t * 0.6);
const qx = x * c1 - w * s1; const qw = x * s1 + w * c1;
const ry = y * c2 - qw * s2; const rw = y * s2 + qw * c2;
const proj = scale / Math.max(1.0, scale - rw * 0.018);
x = qx * proj; y = ry * proj; z = z * proj;
const r = Math.sqrt(x * x + y * y + z * z);
const flow = Math.sin(r * 0.16 - time * 1.8 + Math.sin(a * 0.25)) * warp;
x += Math.sin(y * 0.12 + time) * flow * scale * 0.18;
y += Math.cos(z * 0.11 - time * 0.8) * flow * scale * 0.18;
z += Math.sin(x * 0.10 + time * 0.6) * flow * scale * 0.18;
const pulse = 1.0 + Math.sin(time * 1.7 + a * 0.35) * breath * 0.12;
target.set(x * pulse, y * pulse, z * pulse);
const hue = (0.58 + 0.16 * Math.sin(r * 0.08 + time * 0.35) + p * 0.08) % 1.0;
const light = 0.48 + 0.16 * Math.sin(a * 0.5 + time);
color.setHSL(hue < 0 ? hue + 1.0 : hue, 0.85, Math.max(0.28, Math.min(0.72, light)));`
  },
  {
    key:'saturn', name:'Jewel-Toned Saturn', desc:'A gas giant with vivid sapphire, emerald, amber, and ruby cloud bands, ringed by shimmering multicolor dust.',
    keywords:['saturn','planet','gas giant','jewel','ringed','rings'],
    params:{planet:28,ringIn:38,ringOut:68,rotation:0.6,tilt:0.45,bands:3.5,vivid:0.85},
    code:`const planetRadius = addControl("planet", "Planet Radius", 15, 50, 28);
const ringInner = addControl("ringIn", "Ring Inner Radius", 30, 60, 38);
const ringOuter = addControl("ringOut", "Ring Outer Radius", 50, 100, 68);
const rotSpeed = addControl("rotation", "Planet Rotation", 0, 3, 0.6);
const ringTilt = addControl("tilt", "Ring Tilt", 0, 1.5, 0.45);
const bandContrast = addControl("bands", "Cloud Bands", 0, 8, 3.5);
const vividness = addControl("vivid", "Color Vividness", 0, 1, 0.85);
const safeCount = count > 1 ? count : 2;
const fi = i / safeCount;
const isRing = fi < 0.55 ? 1 : 0;
const seedA = Math.sin(i * 12.9898) * 43758.5453;
const randA = seedA - Math.floor(seedA);
const seedB = Math.sin(i * 78.233 + 3.1) * 12345.678;
const randB = seedB - Math.floor(seedB);
const seedC = Math.sin(i * 45.164 + 7.7) * 98765.432;
const randC = seedC - Math.floor(seedC);
const ringDist = ringInner + randA * (ringOuter - ringInner);
const ringGapPulse = Math.sin(ringDist * 0.5) * 0.5 + 0.5;
const ringAngle = randB * Math.PI * 2 + time * (0.8 / (ringDist * 0.05 + 1));
const ringXFlat = Math.cos(ringAngle) * ringDist;
const ringZFlat = Math.sin(ringAngle) * ringDist;
const ringYFlat = (randC - 0.5) * 0.6;
const cosT = Math.cos(ringTilt); const sinT = Math.sin(ringTilt);
const ringX = ringXFlat;
const ringY = ringYFlat * cosT - ringZFlat * sinT;
const ringZ = ringYFlat * sinT + ringZFlat * cosT;
const phi = Math.acos(1 - 2 * randA);
const theta = randB * Math.PI * 2 + time * rotSpeed;
const sinPhi = Math.sin(phi);
const planetX = planetRadius * sinPhi * Math.cos(theta);
const planetY = planetRadius * Math.cos(phi);
const planetZ = planetRadius * sinPhi * Math.sin(theta);
target.set(
  isRing ? ringX : planetX,
  isRing ? ringY : planetY,
  isRing ? ringZ : planetZ
);
const bandRaw = Math.sin(planetY * bandContrast * 0.3 + time * 0.2) + Math.sin(planetY * bandContrast * 0.7 - time * 0.15) * 0.5;
const band = (bandRaw + 1.5) / 3;
const bandLayer = Math.floor(band * 6);
const swirl = Math.sin(theta * 3 + planetY * 0.4 + time * 0.3) * 0.06;
const jewelHues = [0.58, 0.75, 0.5, 0.08, 0.85, 0.13];
const hueIndex = ((bandLayer % 6) + 6) % 6;
const planetHue = jewelHues[hueIndex] + swirl;
const ringGapVisible = ringGapPulse > 0.15 ? 1 : 0.3;
const ringHueBands = [0.1, 0.55, 0.75, 0.05];
const ringHueIndex = Math.floor(randC * 4) % 4;
const ringHue = ringHueBands[ringHueIndex];
const planetSat = 0.3 + vividness * 0.55;
const planetLight = 0.42 + (band - 0.5) * 0.25;
const ringSat = 0.25 + vividness * 0.4;
const ringLight = (0.4 + randC * 0.3) * ringGapVisible;
color.setHSL(
  isRing ? ringHue : planetHue,
  isRing ? ringSat : planetSat,
  isRing ? Math.min(ringLight, 0.9) : Math.min(Math.max(planetLight, 0.15), 0.9)
);`
  },
  {
    key:'chladni', name:'Chladni Plate', desc:'Standing-wave nodal patterns on a resonating surface.',
    keywords:['chladni','node','plate','resonance','standing wave','wave','vibration'],
    params:{},
    code:`var side = Math.ceil(Math.sqrt(count));
var gx = i % side;
var gy = Math.floor(i / side);
var x = (gx / (side - 1)) * 2.0 - 1.0;
var y = (gy / (side - 1)) * 2.0 - 1.0;
var modeA = 3.0;
var modeB = 5.0;
var wave = Math.sin(modeA * Math.PI * x) * Math.sin(modeB * Math.PI * y);
wave += Math.sin(modeB * Math.PI * x) * Math.sin(modeA * Math.PI * y);
var wave2 = Math.sin(2.0 * Math.PI * x) * Math.sin(6.0 * Math.PI * y);
wave2 += Math.sin(6.0 * Math.PI * x) * Math.sin(2.0 * Math.PI * y);
var blend = 0.5 + 0.5 * Math.sin(time * 0.18);
var field = wave * (1.0 - blend) + wave2 * blend;
var eps = 0.012;
var fx1 = Math.sin(modeA * Math.PI * (x + eps)) * Math.sin(modeB * Math.PI * y);
fx1 += Math.sin(modeB * Math.PI * (x + eps)) * Math.sin(modeA * Math.PI * y);
var fx2 = Math.sin(modeA * Math.PI * (x - eps)) * Math.sin(modeB * Math.PI * y);
fx2 += Math.sin(modeB * Math.PI * (x - eps)) * Math.sin(modeA * Math.PI * y);
var fy1 = Math.sin(modeA * Math.PI * x) * Math.sin(modeB * Math.PI * (y + eps));
fy1 += Math.sin(modeB * Math.PI * x) * Math.sin(modeA * Math.PI * (y + eps));
var fy2 = Math.sin(modeA * Math.PI * x) * Math.sin(modeB * Math.PI * (y - eps));
fy2 += Math.sin(modeB * Math.PI * x) * Math.sin(modeA * Math.PI * (y - eps));
var dx = (fx1 - fx2) / (2.0 * eps);
var dy = (fy1 - fy2) / (2.0 * eps);
var sign = field / (Math.abs(field) + 0.0005);
var forceX = -sign * dx;
var forceY = -sign * dy;
var forceLength = Math.sqrt(forceX * forceX + forceY * forceY) + 0.0001;
forceX /= forceLength;
forceY /= forceLength;
var distanceFromNode = Math.abs(field);
var attraction = 0.30 * (1.0 - Math.min(distanceFromNode, 1.0));
x += forceX * attraction;
y += forceY * attraction;
var flow = Math.sin(time * 0.7 + x * 4.0 + y * 3.0) * 0.012;
x += forceY * flow;
y -= forceX * flow;
var z = field * 0.018;
target.set(x * 4.5, y * 4.5, z);
var brightness = 0.62 + 0.12 * (1.0 - Math.min(distanceFromNode, 1.0));
color.setHSL(0.76, 0.45, brightness);`
  },
  {
    key:'earth', name:'Earth with Clouds', desc:'A rotating blue planet with continents, polar ice, drifting cloud cover, and a soft atmospheric glow.',
    keywords:['earth','planet','globe','world','clouds','atmosphere'],
    params:{planet:30,rotation:0.4,clouds:0.4,cloudalt:1.8,land:0.35,atmo:1.2},
    code:`const planetRadius = addControl("planet", "Earth Radius", 15, 50, 30);
const rotSpeed = addControl("rotation", "Rotation Speed", 0, 3, 0.4);
const cloudDensity = addControl("clouds", "Cloud Coverage", 0, 1, 0.4);
const cloudHeight = addControl("cloudalt", "Cloud Altitude", 0.5, 5, 1.8);
const landRatio = addControl("land", "Land Coverage", 0.1, 0.8, 0.35);
const atmosphereGlow = addControl("atmo", "Atmosphere Glow", 0, 3, 1.2);
const safeCount = count > 1 ? count : 2;
const fi = i / safeCount;
const layer = fi < 0.7 ? 0 : (fi < 0.92 ? 1 : 2);
const seedA = Math.sin(i * 12.9898) * 43758.5453;
const randA = seedA - Math.floor(seedA);
const seedB = Math.sin(i * 78.233 + 3.1) * 12345.678;
const randB = seedB - Math.floor(seedB);
const seedC = Math.sin(i * 45.164 + 7.7) * 98765.432;
const randC = seedC - Math.floor(seedC);
const phi = Math.acos(1 - 2 * randA);
const thetaBase = randB * Math.PI * 2;
const theta = thetaBase + time * rotSpeed;
const sinPhi = Math.sin(phi);
const surfR = planetRadius;
const cloudR = planetRadius + cloudHeight;
const atmoR = planetRadius + cloudHeight * 2.5 + 2;
const r = layer === 0 ? surfR : (layer === 1 ? cloudR : atmoR);
target.set(
  r * sinPhi * Math.cos(theta),
  r * Math.cos(phi),
  r * sinPhi * Math.sin(theta)
);
const continentNoise = Math.sin(thetaBase * 4 + randC * 3) * Math.cos(phi * 5 + randA * 4) + Math.sin(phi * 8 - thetaBase * 2) * 0.4;
const isLand = continentNoise > (1.2 - landRatio * 2.4) ? 1 : 0;
const poleFactor = Math.abs(Math.cos(phi));
const isIce = poleFactor > 0.82 ? 1 : 0;
const cloudNoise = Math.sin(thetaBase * 6 + time * 0.1 + randB * 5) * Math.cos(phi * 7 - time * 0.08 + randC * 4);
const isCloud = cloudNoise > (1.3 - cloudDensity * 2.2) ? 1 : 0;
const oceanHue = 0.58;
const landHue = 0.28 + randC * 0.08;
const surfaceHue = isIce ? 0.55 : (isLand ? landHue : oceanHue);
const surfaceSat = isIce ? 0.1 : (isLand ? 0.55 : 0.75);
const surfaceLight = isIce ? 0.92 : (isLand ? 0.4 : 0.35);
const finalHue = layer === 2 ? 0.56 : surfaceHue;
const finalSat = layer === 2 ? 0.6 : (layer === 1 ? 0.05 : surfaceSat);
const finalLight = layer === 2
  ? Math.min(0.5 + atmosphereGlow * 0.15, 0.85)
  : (layer === 1 ? (isCloud ? 0.92 : 0.0) : surfaceLight);
const finalOpacityLight = layer === 1 && !isCloud ? 0.0 : finalLight;
color.setHSL(finalHue, finalSat, Math.min(Math.max(finalOpacityLight, 0.02), 0.95));`
  },
  {
    key:'phone', name:'Smartphone', desc:'A modern phone built from particles: glowing screen, metal frame, triple camera, side button and front island.',
    keywords:['phone','smartphone','mobile','device','iphone','android'],
    params:{spin:0.6,sc:1,glow:0.6},
    code:`const spin = addControl("spin", "Rotation Speed", 0, 3, 0.6);
const sc = addControl("sc", "Phone Scale", 0.5, 2, 1.0);
const glow = addControl("glow", "Screen Brightness", 0.2, 1, 0.6);
const W = 40; const H = 80; const D = 6;
const u = i / count;
const a = (i * 0.6180339887) % 1;
const b = (i * 0.7548776662) % 1;
let x = 0; let y = 0; let z = 0; let h = 0; let s = 0; let l = 0;
if (u < 0.35) {
  x = (a - 0.5) * W * 0.9;
  y = (b - 0.5) * H * 0.94;
  z = D * 0.5 + 0.3;
  h = 0.55 + 0.12 * Math.sin(y * 0.08 + time) + 0.08 * Math.sin(x * 0.1 - time * 0.7);
  s = 0.85;
  l = glow * (0.5 + 0.3 * Math.sin(x * 0.3 + time * 2.0) * Math.sin(y * 0.2 - time));
} else if (u < 0.6) {
  x = (a - 0.5) * W * 0.96;
  y = (b - 0.5) * H * 0.97;
  z = -D * 0.5;
  h = 0.62; s = 0.25;
  l = 0.22 + 0.1 * Math.sin(y * 0.1 + time);
} else if (u < 0.82) {
  const ang = a * 6.2831853;
  const c = Math.cos(ang); const sn = Math.sin(ang);
  x = W * 0.5 * Math.sign(c) * Math.pow(Math.abs(c), 0.25);
  y = H * 0.5 * Math.sign(sn) * Math.pow(Math.abs(sn), 0.25);
  z = (b - 0.5) * D;
  h = 0.6; s = 0.1;
  l = 0.65 + 0.15 * Math.sin(ang * 3.0 + time * 2.0);
} else if (u < 0.92) {
  const k = i % 3;
  const ka = k * 2.0943951 + 1.5707963;
  const cx = -W * 0.18 + Math.cos(ka) * 5.5;
  const cy = H * 0.5 - 14 + Math.sin(ka) * 5.5;
  const ra = a * 6.2831853;
  const r = 1.2 + b * 3.0;
  x = cx + Math.cos(ra) * r;
  y = cy + Math.sin(ra) * r;
  z = -D * 0.5 - 0.9 * (1.0 - b);
  h = 0.6 + 0.1 * b; s = 0.7;
  l = 0.15 + 0.35 * b * (0.6 + 0.4 * Math.sin(time * 3.0 + k));
} else if (u < 0.96) {
  x = W * 0.5 + 0.6;
  y = 10 + (a - 0.5) * 12;
  z = (b - 0.5) * 1.6;
  h = 0.08; s = 0.9; l = 0.55;
} else {
  x = (a - 0.5) * 10;
  y = H * 0.5 - 5 + (b - 0.5) * 2.5;
  z = D * 0.5 + 0.6;
  h = 0.35; s = 0.6;
  l = 0.12 + 0.3 * Math.max(0, Math.sin(time * 2.0 + a * 6.0));
}
const rot = time * spin;
const cr = Math.cos(rot); const sr = Math.sin(rot);
const px = x * cr + z * sr;
const pz = -x * sr + z * cr;
const bob = Math.sin(time * 1.2) * 1.5;
target.set(px * sc, y * sc + bob, pz * sc);
color.setHSL(h, s, Math.min(1, Math.max(0, l)));`
  },
  {
    key:'lotus', name:'Golden Geometric Lotus', desc:'A 3D particle swarm inspired by the rigid metallic W/X base and blooming crown.',
    keywords:['lotus','flower','golden','geometric','bloom','petal'],
    params:{scale:40,speed:0.8,goldTone:0.12},
    code:`const scale = addControl("scale", "Global Scale", 10, 80, 40);
const speed = addControl("speed", "Time Speed", 0.1, 2.0, 0.8);
const goldTone = addControl("goldTone", "Gold Tone", 0.0, 0.2, 0.12);
const t = time * speed;
const norm = i / count;
let x = 0; let y = 0; let z = 0; let brightness = 0.5;
if (norm < 0.75) {
  const localNorm = norm / 0.75;
  const strands = 12;
  const strand = i % strands;
  const phase = localNorm;
  y = (phase * 2.0 - 1.0) * scale * 0.7;
  const pinch = Math.abs(y) / (scale * 0.7);
  const radius = scale * 0.5 * Math.pow(pinch, 0.8) + 1.0;
  const baseAngle = (strand / strands) * Math.PI * 2;
  const twist = (strand % 2 === 0 ? 1 : -1) * (1.0 - pinch) * 1.5;
  const angle = baseAngle + twist + t * 0.5;
  const geometryFactor = 1.0 + 0.15 * Math.cos(angle * 4);
  x = Math.cos(angle) * radius * geometryFactor;
  z = Math.sin(angle) * radius * geometryFactor;
  brightness = 0.3 + 0.4 * Math.abs(Math.sin(phase * 20.0 - t * 3.0));
} else {
  const localNorm = (norm - 0.75) / 0.25;
  const petals = 16;
  const petal = i % petals;
  const isInner = petal % 2 === 0;
  const baseHeight = scale * 0.4;
  y = baseHeight + localNorm * scale * 0.6;
  const baseAngle = (petal / petals) * Math.PI * 2;
  const angle = baseAngle + t * 0.5;
  const bloomCurve = Math.sin(localNorm * Math.PI);
  const flareCurve = Math.pow(localNorm, 0.5);
  const radius = bloomCurve * scale * (isInner ? 0.3 : 0.5) + flareCurve * scale * 0.1;
  x = Math.cos(angle) * radius;
  z = Math.sin(angle) * radius;
  brightness = 0.4 + 0.5 * localNorm;
}
const breathe = 1.0 + Math.sin(t * 1.5 + y * 0.05) * 0.03;
target.set(x * breathe, y * breathe, z * breathe);
const hue = goldTone + Math.sin(y * 0.1 - t) * 0.02;
color.setHSL(hue, 0.9, brightness);`
  },
  {
    key:'decoding', name:'Decoding Matrix', desc:'Materializing golden lotus geometry through an active scanline matrix.',
    keywords:['decoding','matrix','scan','hologram','protocol','materialize'],
    params:{scale:30,scanSpeed:0.8,goldTone:0.12},
    code:`const masterScale = addControl("scale", "Logo Scale", 10, 50, 30);
const scanSpeed = addControl("scanSpeed", "Decoding Speed", 0.1, 2.0, 0.8);
const goldTone = addControl("goldTone", "Gold Hue", 0.0, 0.2, 0.12);
let p = i / count;
let lx = 0, ly = 0, lz = 0;
let isBase = p < 0.75;
let cross = (i % 31) / 30.0;
let bevel = (0.5 - Math.abs(cross - 0.5)) * 2.0;
let baseLit = 0.5;
if (isBase) {
  let lp = p / 0.75;
  let line_idx = Math.floor(lp * 4);
  let t_line = (lp * 4) % 1.0;
  let depth = ((i * 7) % 17) / 16.0;
  let sx = 0, sy = 0, ex = 0, ey = 0;
  if (line_idx === 0) { sx = -0.8; sy = -0.6; ex = 0.0; ey = 0.6; }
  else if (line_idx === 1) { sx = 0.0; sy = 0.6; ex = 0.8; ey = -0.6; }
  else if (line_idx === 2) { sx = -0.8; sy = 0.6; ex = 0.0; ey = -0.6; }
  else { sx = 0.0; sy = -0.6; ex = 0.8; ey = 0.6; }
  let dx = ex - sx;
  let dy = ey - sy;
  let len = Math.sqrt(dx*dx + dy*dy);
  let nx = -dy / len;
  let ny = dx / len;
  let w = 0.25;
  let bx = (cross - 0.5) * w;
  let bz = (depth - 0.5) * bevel * w * 1.5;
  lx = sx + dx * t_line + nx * bx;
  ly = sy + dy * t_line + ny * bx;
  lz = bz;
  baseLit = 0.2 + 0.6 * bevel;
} else {
  let lp = (p - 0.75) / 0.25;
  let petal_idx = Math.floor(lp * 5);
  let tp = (lp * 5) % 1.0;
  let scale_p = 1.0, rot_p = 0.0, x_off = 0.0, y_off = 0.55;
  if (petal_idx === 0) { scale_p = 1.0; rot_p = 0.0; x_off = 0.0; y_off = 0.55; }
  else if (petal_idx === 1) { scale_p = 0.8; rot_p = -0.4; x_off = -0.25; y_off = 0.6; }
  else if (petal_idx === 2) { scale_p = 0.8; rot_p = 0.4; x_off = 0.25; y_off = 0.6; }
  else if (petal_idx === 3) { scale_p = 0.6; rot_p = -0.8; x_off = -0.45; y_off = 0.65; }
  else { scale_p = 0.6; rot_p = 0.8; x_off = 0.45; y_off = 0.65; }
  let px = Math.sin(tp * Math.PI) * (1.0 - tp) * 0.45 * scale_p * (i % 2 === 0 ? 1 : -1);
  let py = tp * 0.7 * scale_p;
  lx = x_off + px * Math.cos(rot_p) - py * Math.sin(rot_p);
  ly = y_off + px * Math.sin(rot_p) + py * Math.cos(rot_p);
  lz = (Math.sin(tp * Math.PI) * 0.15) * (i % 3 === 0 ? 1 : -1);
  baseLit = 0.3 + 0.5 * Math.sin(tp * Math.PI);
}
lx *= masterScale; ly *= masterScale; lz *= masterScale;
let phase = (time * scanSpeed) % 4.0;
let scanY = (phase - 1.0) * masterScale * 1.5;
let distToScan = scanY - ly;
let lockWeight = Math.max(0.0, Math.min(1.0, distToScan * 0.5));
lockWeight = lockWeight * lockWeight * (3.0 - 2.0 * lockWeight);
let angle = i * 0.1 + time;
let radius = masterScale * (1.2 + Math.sin(i * 123.4) * 0.4);
let cx = Math.cos(angle) * radius;
let cz = Math.sin(angle) * radius;
let cy = ly + masterScale * (0.5 + Math.sin(i * 78.9 + time * 2.0) * 0.5);
target.set(
  cx * (1.0 - lockWeight) + lx * lockWeight,
  cy * (1.0 - lockWeight) + ly * lockWeight,
  cz * (1.0 - lockWeight) + lz * lockWeight
);
let scanGlow = Math.max(0.0, 1.0 - Math.abs(distToScan) * 0.5);
let finalHue = 0.5 * (1.0 - lockWeight) + goldTone * lockWeight;
let finalSat = 1.0 * (1.0 - lockWeight) + 0.9 * lockWeight;
let finalLit = 0.5 * (1.0 - lockWeight) + baseLit * lockWeight;
finalLit += scanGlow * 0.5;
finalSat -= scanGlow * 0.3;
color.setHSL(finalHue, finalSat, finalLit);`
  },
  {
    key:'butterfly', name:'Butterfly in a Garden', desc:'Scattered particles bloom into a butterfly surrounded by flowers, then dissolve again.',
    keywords:['butterfly','garden','flower','bloom','scatter','nature'],
    params:{cycle:10,bScale:16,scatterRadius:160,drift:0.6,flowerCount:10,fieldSpread:110,fieldCenterY:0,flowerSize:7,flapSpeed:6,flapAmp:0.55},
    code:`const safeCount = count > 0 ? count : 1;
const cycle = addControl("cycle", "Cycle Length (s)", 4, 20, 10);
const bScale = addControl("bScale", "Butterfly Size", 6, 30, 16);
const scatterRadius = addControl("scatterRadius", "Scatter Spread", 40, 300, 160);
const driftStrength = addControl("drift", "Scatter Drift", 0, 1, 0.6);
const flowerCount = addControl("flowerCount", "Flower Count", 4, 18, 10);
const fieldSpread = addControl("fieldSpread", "Field Radius", 30, 220, 110);
const fieldCenterY = addControl("fieldCenterY", "Field Center Height", -60, 60, 0);
const flowerSize = addControl("flowerSize", "Flower Size", 3, 14, 7);
const flapSpeed = addControl("flapSpeed", "Flap Speed", 1, 12, 6);
const flapAmp = addControl("flapAmp", "Flap Amount", 0.1, 1.2, 0.55);
const safeCycle = cycle > 0.001 ? cycle : 4;
const phase = (time % safeCycle) / safeCycle;
const progress = 0.5 - 0.5 * Math.cos(phase * 2.0 * Math.PI);
const flapAngle = Math.sin(time * flapSpeed) * flapAmp * progress;
const deg = Math.PI / 180.0;
const u = i / safeCount;
const gh1 = Math.sin(i * 12.9898) * 43758.5453;
const gu1 = Math.max(1e-6, gh1 - Math.floor(gh1));
const gh2 = Math.sin(i * 78.233) * 12543.987;
const gu2 = gh2 - Math.floor(gh2);
const gh3 = Math.sin(i * 39.346) * 25563.641;
const gu3 = Math.max(1e-6, gh3 - Math.floor(gh3));
const gh4 = Math.sin(i * 54.716) * 31415.926;
const gu4 = gh4 - Math.floor(gh4);
const gRadius1 = Math.sqrt(-2.0 * Math.log(gu1));
const gx = gRadius1 * Math.cos(2.0 * Math.PI * gu2);
const gy = gRadius1 * Math.sin(2.0 * Math.PI * gu2);
const gRadius2 = Math.sqrt(-2.0 * Math.log(gu3));
const gz = gRadius2 * Math.cos(2.0 * Math.PI * gu4);
const sigma = scatterRadius / 3.0;
const driftH = Math.sin(i * 6.283) * 9999.123;
const driftPhase = (driftH - Math.floor(driftH)) * 2.0 * Math.PI;
const driftAmp = sigma * 0.08 * driftStrength;
const sx = gx * sigma + Math.sin(time * 0.3 + driftPhase) * driftAmp;
const sy = gy * sigma + Math.cos(time * 0.25 + driftPhase * 1.3) * driftAmp;
const sz = gz * sigma + Math.sin(time * 0.2 + driftPhase * 0.7) * driftAmp;
const bfBr = 0.243, bfBg = 0.651, bfBb = 1.0;
const bfAr = 0.910, bfAg = 0.639, bfAb = 0.239;
const bfColR = bfBr + (bfAr - bfBr) * progress;
const bfColG = bfBg + (bfAg - bfBg) * progress;
const bfColB = bfBb + (bfAb - bfBb) * progress;
let bx = 0.0, by = 0.0, bz = 0.0;
let colBaseR = bfColR, colBaseG = bfColG, colBaseB = bfColB;
let regCx = 0.0, regCy = -0.05, regEa = 0.06, regEb = 0.68, regAngle = 0.0, isWing = 0.0;
if (u < 0.19344) { regCx = 0.72; regCy = 0.52; regEa = 0.775; regEb = 0.425; regAngle = 32.0 * deg; isWing = 1.0; }
else if (u < 0.38688) { regCx = -0.72; regCy = 0.52; regEa = 0.775; regEb = 0.425; regAngle = -32.0 * deg; isWing = 1.0; }
else if (u < 0.49476) { regCx = 0.62; regCy = -0.28; regEa = 0.525; regEb = 0.35; regAngle = -28.0 * deg; isWing = 1.0; }
else if (u < 0.60264) { regCx = -0.62; regCy = -0.28; regEa = 0.525; regEb = 0.35; regAngle = 28.0 * deg; isWing = 1.0; }
else if (u < 0.607476) { regCx = 1.18; regCy = -0.62; regEa = 0.15; regEb = 0.055; regAngle = -55.0 * deg; isWing = 1.0; }
else if (u < 0.612312) { regCx = -1.18; regCy = -0.62; regEa = 0.15; regEb = 0.055; regAngle = 55.0 * deg; isWing = 1.0; }
if (u < 0.62) {
  const hr = Math.sin(i * 91.345) * 10000.0;
  const rFrac = hr - Math.floor(hr);
  const hp = Math.sin(i * 57.234) * 20000.0;
  const phiFrac = hp - Math.floor(hp);
  const radiusFrac = Math.sqrt(rFrac);
  const phi = phiFrac * 2.0 * Math.PI;
  const localX = radiusFrac * regEa * Math.cos(phi);
  const localY = radiusFrac * regEb * Math.sin(phi);
  const cosA = Math.cos(regAngle);
  const sinA = Math.sin(regAngle);
  const wingLocalX = regCx + localX * cosA - localY * sinA;
  const wingLocalY = regCy + localX * sinA + localY * cosA;
  bx = wingLocalX * bScale;
  by = wingLocalY * bScale;
  bz = Math.abs(wingLocalX) * Math.sin(flapAngle) * bScale * isWing;
  colBaseR = bfColR;
  colBaseG = bfColG;
  colBaseB = bfColB;
} else {
  const flowerU = (u - 0.62) / 0.38;
  const flowerFloat = flowerU * flowerCount;
  const flowerIndex = Math.floor(flowerFloat);
  const th1 = Math.sin(i * 63.71) * 10000.0;
  const theta = (th1 - Math.floor(th1)) * 2.0 * Math.PI;
  const th2 = Math.sin(i * 84.19) * 10000.0;
  const rr = th2 - Math.floor(th2);
  const petalR = Math.abs(Math.cos(5.0 * theta)) * flowerSize;
  const radiusFrac2 = Math.sqrt(rr);
  const petalX = radiusFrac2 * petalR * Math.cos(theta);
  const petalY = radiusFrac2 * petalR * Math.sin(theta);
  const fh1 = Math.sin(flowerIndex * 17.53 + 11.1) * 10000.0;
  const fhTheta = (fh1 - Math.floor(fh1)) * 2.0 * Math.PI;
  const fh2 = Math.sin(flowerIndex * 29.13 + 7.7) * 10000.0;
  const fhCosPhi = (fh2 - Math.floor(fh2)) * 2.0 - 1.0;
  const fhSinPhi = Math.sqrt(Math.max(0.0, 1.0 - fhCosPhi * fhCosPhi));
  const fh3 = Math.sin(flowerIndex * 41.91 + 3.3) * 10000.0;
  const fhJitter = fh3 - Math.floor(fh3);
  const shellR = fieldSpread * (0.65 + 0.35 * fhJitter);
  const fieldX = shellR * fhSinPhi * Math.cos(fhTheta);
  const fieldZ = shellR * fhSinPhi * Math.sin(fhTheta);
  const fieldY = shellR * fhCosPhi + fieldCenterY;
  bx = fieldX + petalX * progress;
  by = fieldY + petalY * progress;
  bz = fieldZ;
  const fyR = 0.976, fyG = 0.827, fyB = 0.325;
  const fpR = 0.976, fpG = 0.416, fpB = 0.686;
  colBaseR = fyR + (fpR - fyR) * radiusFrac2;
  colBaseG = fyG + (fpG - fyG) * radiusFrac2;
  colBaseB = fyB + (fpB - fyB) * radiusFrac2;
}
const px = sx + (bx - sx) * progress;
const py = sy + (by - sy) * progress;
const pz = sz + (bz - sz) * progress;
const rot = time * 0.05;
const cosr = Math.cos(rot);
const sinr = Math.sin(rot);
const finalX = px * cosr - pz * sinr;
const finalZ = px * sinr + pz * cosr;
target.set(finalX, py, finalZ);
const s4 = Math.sin(i * 3.1415) * 4321.1234;
const shimmerPhase = (s4 - Math.floor(s4)) * 2.0 * Math.PI;
const glow = 0.85 + 0.15 * Math.sin(time * 2.0 + shimmerPhase);
const outR = Math.min(1.0, colBaseR * glow);
const outG = Math.min(1.0, colBaseG * glow);
const outB = Math.min(1.0, colBaseB * glow);
color.setRGB(outR, outG, outB);`
  },
  {
    key:'energycore', name:'Energy Core', desc:'Original ring-shaped power core made of particles. Seamless loop.',
    keywords:['energy','core','reactor','power','ring','beam','canva'],
    params:{loopSec:12,turns:1,sc:1,glow:0.85,hue:0.54,beam:0.8},
    code:`const loopSec = Math.round(addControl("loopSec", "Loop Seconds", 4, 20, 12));
const turns = Math.round(addControl("turns", "Coil Spin Turns", 0, 4, 1));
const sc = addControl("sc", "Core Scale", 0.5, 2, 1.0);
const glow = addControl("glow", "Core Glow", 0.2, 1, 0.85);
const hue = addControl("hue", "Core Hue", 0, 1, 0.54);
const beam = addControl("beam", "Energy Beam", 0, 1, 0.8);
const TAU = 6.2831853;
const lp = (time % loopSec) / loopSec * TAU;
const u = i / count;
const a = (i * 0.6180339887) % 1;
const b = (i * 0.7548776662) % 1;
const c = (i * 0.3819660113) % 1;
const rot = lp * turns;
let x = 0; let y = 0; let z = 0; let h = 0; let s = 0; let l = 0;
if (u < 0.20) {
  const ang = a * TAU;
  const phi = b * TAU;
  const rad = 30 + 3.4 * Math.cos(phi);
  x = rad * Math.cos(ang);
  y = rad * Math.sin(ang);
  z = 2.8 * Math.sin(phi);
  h = 0.58; s = 0.12;
  l = 0.3 + 0.18 * Math.abs(Math.sin(ang * 12.0)) + 0.1 * Math.max(0, Math.cos(phi));
} else if (u < 0.30) {
  const ang = a * TAU;
  const r = 14 + b * 15;
  x = r * Math.cos(ang);
  y = r * Math.sin(ang);
  z = -1.8 + (c - 0.5) * 0.8;
  h = 0.6; s = 0.2;
  l = 0.1 + 0.07 * Math.abs(Math.sin(ang * 10.0 + rot));
} else if (u < 0.56) {
  const k = i % 10;
  const ang = k * TAU / 10.0 + rot + (b - 0.5) * 0.42;
  const r = 15 + a * 12;
  x = r * Math.cos(ang);
  y = r * Math.sin(ang);
  z = 0.4 + c * 3.2;
  h = hue;
  s = 0.75 - 0.35 * c;
  l = glow * (0.4 + 0.3 * Math.sin(lp * 3.0 + k * 0.6283) + 0.25 * c);
} else if (u < 0.66) {
  const ang = a * TAU;
  const phi = b * TAU;
  const rad = 12 + 1.5 * Math.cos(phi);
  x = rad * Math.cos(ang);
  y = rad * Math.sin(ang);
  z = 1.2 + 1.5 * Math.sin(phi);
  h = hue; s = 0.45;
  l = glow * (0.65 + 0.2 * Math.sin(lp * 2.0 + ang * 3.0));
} else if (u < 0.78) {
  const r = Math.sqrt(a) * 10.5;
  const ang = b * TAU;
  x = r * Math.cos(ang);
  y = r * Math.sin(ang);
  z = 0.8 + 0.3 * Math.sin(r * 0.8 - lp * 2.0);
  h = hue;
  s = 0.85 * (r / 10.5);
  l = Math.min(1, glow * (0.95 - 0.35 * r / 10.5 + 0.12 * Math.sin(r * 1.2 - lp * 4.0)));
} else if (u < 0.88) {
  const ang = a * TAU + lp * 2.0;
  const r = 36 + 10 * b;
  x = r * Math.cos(ang);
  y = r * Math.sin(ang);
  z = (c - 0.5) * 8.0 * Math.sin(a * 17.0);
  h = hue; s = 0.8;
  l = glow * 0.5 * Math.max(0, Math.sin(a * 60.0 + lp * 3.0));
} else {
  const t = (a + lp / TAU * 2.0) % 1;
  const ang = c * TAU;
  const r = (1.0 - t) * 7.0 * b;
  x = r * Math.cos(ang);
  y = r * Math.sin(ang);
  z = 2.0 + t * 45.0;
  h = hue;
  s = 0.6 + 0.4 * t;
  l = beam * glow * (1.0 - t) * 0.9;
}
const yaw = Math.sin(lp) * 0.6;
const cyw = Math.cos(yaw);
const syw = Math.sin(yaw);
const px = x * cyw + z * syw;
const pz = -x * syw + z * cyw;
const tl = 0.2;
const ct = Math.cos(tl);
const st = Math.sin(tl);
const py = y * ct - pz * st;
const qz = y * st + pz * ct;
const pulse = 1.0 + 0.02 * Math.sin(lp * 3.0);
target.set(px * sc * pulse, py * sc * pulse, qz * sc * pulse);
color.setHSL(h, Math.min(1, Math.max(0, s)), Math.min(1, Math.max(0, l)));`
  },
  {
    key:'clifford', name:'Clifford Rift', desc:'A rotating 4D Clifford torus projected into 3D, threaded with travelling interference waves.',
    keywords:['clifford','rift','4d','torus','projection','interference'],
    params:{size:62,speed:0.55,warp:0.72,pulse:0.16,twist:3.2},
    code:`const size = addControl("size", "Swarm Size", 20, 120, 62);
const speed = addControl("speed", "4D Rotation", 0, 2.5, 0.55);
const warp = addControl("warp", "Dimensional Warp", 0, 1.5, 0.72);
const pulse = addControl("pulse", "Breathing", 0, 0.45, 0.16);
const twist = addControl("twist", "Field Twist", 0, 8, 3.2);
const invCount = 1 / Math.max(count, 1);
const u = i * invCount;
const g = i * 0.6180339887498949;
const f = g - Math.floor(g);
const a = u * 6.283185307179586;
const b = f * 6.283185307179586 + Math.sin(a * 3 + time * 0.31) * 0.22;
const ca = Math.cos(a);
const sa = Math.sin(a);
const cb = Math.cos(b);
const sb = Math.sin(b);
const t0 = time * speed;
const c0 = Math.cos(t0);
const s0 = Math.sin(t0);
const c1 = Math.cos(t0 * 0.731);
const s1 = Math.sin(t0 * 0.731);
const qx = ca * c0 - sb * s0;
const qw = ca * s0 + sb * c0;
const qy = sa * c1 - cb * s1;
const qz = sa * s1 + cb * c1;
const phase = a * twist + b * 2.0 - time * (0.7 + speed * 0.4);
const wave = Math.sin(phase) * 0.5 + Math.sin(phase * 0.37 + b * 3.0) * 0.25;
const breath = 1 + pulse * Math.sin(time * 1.13 + a * 2.0 + b);
const denom = 1 + warp * 0.62 * qw;
const proj = size * breath / Math.max(denom, 0.08);
const bend = 1 + 0.13 * wave;
const x = qx * proj * bend;
const y = qy * proj * (1 - 0.09 * wave);
const z = qz * proj + wave * size * 0.18;
target.set(x, y, z);
const energy = 0.5 + 0.5 * Math.sin(phase + qw * 4.0);
const hue = u + 0.16 * Math.sin(b + time * 0.12) + 0.08 * qw;
const sat = 0.72 + energy * 0.25;
const light = 0.34 + energy * 0.28 + 0.06 * Math.abs(qw);
color.setHSL(hue, sat, light);`
  },
  {
    key:'hyperfield', name:'Living Hyperfield', desc:'A breathing spherical field warped by layered interference waves.',
    keywords:['hyperfield','living','breathing','spherical','interference','warp','organic'],
    params:{},
    code:`const u = i / Math.max(1, count - 1);
const phi = Math.acos(1 - 2 * u);
const theta = i * 2.399963229728653 + time * 0.32;
const breathe = 1 + 0.22 * Math.sin(time * 1.7 + u * 18.0);
const warp = 1.0 + 0.28 * Math.sin(theta * 3.0 + time) * Math.sin(phi * 5.0);
const pulse = 1.0 + 0.16 * Math.sin(time * 2.4 + theta * 2.0 + phi * 7.0);
const radius = (18.0 + 42.0 * Math.pow(u, 0.42)) * breathe * warp * pulse;
const twist = time * 0.22 + radius * 0.018 + Math.sin(phi * 6.0 + time) * 0.35;
const ct = Math.cos(theta + twist);
const st = Math.sin(theta + twist);
const sp = Math.sin(phi);
const cp = Math.cos(phi);
const x = radius * sp * ct;
const y = radius * cp + Math.sin(theta * 4.0 + time * 1.3) * 3.5;
const z = radius * sp * st;
const fold = Math.sin(x * 0.09 + time) * Math.cos(z * 0.075 - time * 0.7);
const lift = fold * 5.5 + Math.sin(y * 0.12 + theta) * 2.5;
target.set(
  x + fold * 2.2,
  y + lift,
  z + Math.cos(x * 0.06 + z * 0.08 + time) * 3.0
);
const hue = (0.55 + u * 0.32 + fold * 0.035 + time * 0.025) % 1.0;
const light = 0.42 + 0.18 * Math.abs(Math.sin(theta * 2.0 + time));
color.setHSL(hue, 0.9, light);`
  }
];
/* ============================================================
   LIVE PREVIEW
   ============================================================ */
const canvas = document.getElementById('kefeVisualiserCanvas');
const stage = canvas?.closest('.kefe-stage');
if (!canvas) throw new Error('KEFE visualiser canvas is missing from the preview stage.');
canvas.style.visibility = 'visible';
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x000000, 0.01);
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 2000);
camera.position.set(0, 0, 100);
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 1);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
} catch (error) {
  canvas.dataset.rendererError = 'true';
  console.error('[KEFE visualiser renderer]', error);
  throw error;
}
const initialSpin = window.kefeSettings ? !!window.kefeSettings.get('autoSpin') : true;

const dummy = new THREE.Object3D();
const color = new THREE.Color();
const target = new THREE.Vector3();

const geometry = new THREE.TetrahedronGeometry(1.0);
const material = new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: true });

let instancedMesh = null;
let positions = null;
const initialCount = Math.max(1000, Math.min(20000, Number(window.kefeSettings?.get('particleCount')) || 8000));
let currentCount = initialCount;

const state = {
  preset: PRESETS[0],
  params: {},
  count: initialCount,
  speed: 1,
  time: 0,
  autoSpin: initialSpin
};

function rebuild(count) {
  if (instancedMesh) {
    scene.remove(instancedMesh);
    instancedMesh.geometry = geometry;
    instancedMesh.material = material;
  }
  currentCount = count;
  instancedMesh = new THREE.InstancedMesh(geometry, material, count);
  instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(instancedMesh);
  positions = new Array(count);
  for (let i = 0; i < count; i++) {
    positions[i] = new THREE.Vector3(0, 0, 0);
    if (injectionFn) {
      try {
        injectionFn(i, count, state.time, addControlLive, target, color, THREE);
        positions[i].copy(target);
      } catch (e) {
        injectionFn = null;
        console.error('[KEFE visualiser preset]', state.preset.key, e);
      }
    }
    dummy.position.copy(positions[i]);
    dummy.updateMatrix();
    instancedMesh.setMatrixAt(i, dummy.matrix);
    instancedMesh.setColorAt(i, color);
  }
  document.getElementById('visualiserCountValue').textContent = count.toLocaleString();
}

let injectionFn = null;
function compileInjection(preset) {
  try {
    injectionFn = new Function('return function(i,count,time,addControl,target,color,THREE){' + preset.code + '}')();
  } catch (e) {
    console.error('Injection compile failed:', e);
    injectionFn = null;
  }
}

const addControlLive = (id, label, min, max, def) => {
  return state.params[id] !== undefined ? state.params[id] : def;
};

const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  state.time += dt * state.speed;
  const time = state.time;

  if (state.autoSpin) {
    const orbit = state.time * 0.35;
    camera.position.x = Math.sin(orbit) * 100;
    camera.position.z = Math.cos(orbit) * 100;
    camera.lookAt(0, 0, 0);
  }

  if (injectionFn && instancedMesh) {
    for (let i = 0; i < currentCount; i++) {
      try {
        injectionFn(i, currentCount, time, addControlLive, target, color, THREE);
      } catch (e) {
        injectionFn = null;
        console.error('[KEFE visualiser preset]', state.preset.key, e);
        break;
      }
      positions[i].lerp(target, 0.14);
      dummy.position.copy(positions[i]);
      dummy.updateMatrix();
      instancedMesh.setMatrixAt(i, dummy.matrix);
      instancedMesh.setColorAt(i, color);
    }
    instancedMesh.instanceMatrix.needsUpdate = true;
    instancedMesh.instanceColor.needsUpdate = true;
  }
  renderer.render(scene, camera);
}

let exportLock = false, savedPixelRatio = 1;
function resize() {
  if (exportLock) return;
  const w = canvas.clientWidth || stage?.clientWidth || 0, h = canvas.clientHeight || stage?.clientHeight || 0;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.kefeVisualiserExport = {
  begin(w, h) {
    exportLock = true;
    savedPixelRatio = renderer.getPixelRatio();
    renderer.setPixelRatio(1);
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  },
  end() {
    exportLock = false;
    renderer.setPixelRatio(savedPixelRatio);
    resize();
  }
};
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 200));

// If the stage starts at 0×0 (e.g. inside a hidden container, or before the
// layout is settled), the renderer never gets a usable size. Observe the
// stage and resize whenever its box changes to a non-zero value.
(() => {
  const stage = document.querySelector('.kefe-stage');
  if (!stage) return;
  const tryResize = () => {
    if (stage.clientWidth > 0 && stage.clientHeight > 0) resize();
  };
  if (window.ResizeObserver) {
    new ResizeObserver(tryResize).observe(stage);
  }
  // Also run once after layout settles.
  requestAnimationFrame(() => requestAnimationFrame(tryResize));
})();

/* ============================================================
   UI
   ============================================================ */
const promptEl = document.getElementById('visualiserPrompt');
const presetSelect = document.getElementById('visualiserPreset');
const paramList = document.getElementById('visualiserParameters');
const presetGrid = document.getElementById('visualiserPresetGrid');

function renderPresetGrid() {
  presetGrid.innerHTML = PRESETS.map(p =>
    '<button type="button" class="kefe-visualiser-preset' + (p.key === state.preset.key ? ' active' : '') + '" data-key="' + p.key + '">' + p.name + '</button>'
  ).join('');
  presetGrid.querySelectorAll('.kefe-visualiser-preset').forEach(el => {
    el.addEventListener('click', () => {
      const p = PRESETS.find(x => x.key === el.dataset.key);
      if (p) setPreset(p);
    });
  });
}

function renderParamSliders() {
  const defs = state.preset.params;
  const keys = Object.keys(defs);
  if (keys.length === 0) {
    paramList.innerHTML = '<div class="empty-hint">This preset has no parameters.</div>';
    return;
  }
  state.params = { ...defs };
  paramList.innerHTML = keys.map(k => {
    const v = defs[k];
    const meta = lookupMeta(state.preset.code, k) || { label: k, min: 0, max: 100 };
    const step = (meta.max - meta.min) / 200;
    return '<div class="field">' +
      '<div class="field-head"><label for="p-' + k + '">' + meta.label + '</label><output id="po-' + k + '">' + formatVal(v) + '</output></div>' +
      '<input id="p-' + k + '" type="range" min="' + meta.min + '" max="' + meta.max + '" step="' + step + '" value="' + v + '">' +
      '</div>';
  }).join('');
  keys.forEach(k => {
    const input = document.getElementById('p-' + k);
    const out = document.getElementById('po-' + k);
    input.addEventListener('input', () => {
      state.params[k] = parseFloat(input.value);
      out.textContent = formatVal(state.params[k]);
    });
  });
}

function lookupMeta(code, id) {
  const re = new RegExp('addControl\\("' + id + '",\\s*"([^"]+)",\\s*([\\d.-]+),\\s*([\\d.-]+),\\s*([\\d.-]+)\\)');
  const m = code.match(re);
  if (!m) return null;
  return { label: m[1], min: parseFloat(m[2]), max: parseFloat(m[3]) };
}

function formatVal(v) {
  if (Number.isInteger(v)) return v.toString();
  return v.toFixed(2).replace(/\.?0+$/, '') || v.toString();
}

function setPreset(preset, opts) {
  opts = opts || {};
  if (!preset) return;
  state.preset = preset;
  state.params = { ...preset.params };
  document.getElementById('visualiserSceneName').textContent = preset.name;
  document.getElementById('visualiserSceneDesc').textContent = preset.desc;
  compileInjection(preset);
  presetSelect.value = preset.key;
  renderParamSliders();
  renderPresetGrid();

}

function matchPrompt(text) {
  const t = text.toLowerCase();
  let best = null, bestScore = 0;
  for (const p of PRESETS) {
    let score = 0;
    for (const kw of p.keywords) {
      if (t.includes(kw)) score += kw.length;
    }
    if (score > bestScore) { bestScore = score; best = p; }
  }
  return best;
}


let rebuildTimer=null;
const countInput=document.getElementById('visualiserCount');
const countOutput=document.getElementById('visualiserCountValue');
const speedInput=document.getElementById('visualiserSpeed');
const speedOutput=document.getElementById('visualiserSpeedValue');
const spinButton=document.getElementById('visualiserSpin');
presetSelect.innerHTML = PRESETS.map(p => '<option value="' + p.key + '">' + p.name + '</option>').join('');
presetSelect.addEventListener('change', () => {
  const p = PRESETS.find(x => x.key === presetSelect.value);
  if (p) setPreset(p);
});

document.getElementById('visualiserGenerate').addEventListener('click',()=>setPreset(matchPrompt(promptEl.value.trim())||PRESETS[0]));
document.getElementById('visualiserRandom').addEventListener('click',()=>setPreset(PRESETS[Math.floor(Math.random()*PRESETS.length)]));
countInput.addEventListener('input',e=>{const v=Math.max(1000,Math.min(20000,parseInt(e.target.value,10)||8000));countOutput.textContent=v.toLocaleString();clearTimeout(rebuildTimer);rebuildTimer=setTimeout(()=>{state.count=v;rebuild(v);},120);});
speedInput.addEventListener('input',e=>{state.speed=parseFloat(e.target.value)||1;speedOutput.textContent=state.speed.toFixed(2)+'×';});
spinButton.addEventListener('click',()=>{state.autoSpin=!state.autoSpin;spinButton.textContent=state.autoSpin?'On':'Off';});
countInput.value = String(initialCount);
spinButton.textContent = initialSpin ? 'On' : 'Off';
setPreset(PRESETS[0],{toast:false});
rebuild(initialCount);
resize();
animate();
