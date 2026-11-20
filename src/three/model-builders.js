// Every product's real-time 3D model builder, by the key in src/three/models.js. Kept out of the 3D chunk
// (src/three/fan-scene.js, which holds only the Aeroflow): src/scenes/products.js loads this file only when a
// product other than the Aeroflow shows a 3D view, i.e. only for products listed in LIVE_3D (src/three/models.js).

import { createAeroflow } from './aeroflow-model.js';
import { createAerosleek, createIkonBldc } from './bldc-models.js';
import * as FRONT from './front-fans.js';
import { COOLERS } from './coolers.js';
import { CEILING_MODELS } from './ceiling-fans.js';
import { APPLIANCES } from './appliances.js';
import { SMALL_APPLIANCES } from './small-appliances.js';

export const MODELS = {
  aeroflow: createAeroflow, aerosleek: createAerosleek, ikon: createIkonBldc,
  sultan: FRONT.createSultan, hexa: FRONT.createHexa, nexa: FRONT.createNexa, fiona: FRONT.createFiona,
  vistara: FRONT.createVistara, glider: FRONT.createGlider, spider: FRONT.createSpider,
  vento: FRONT.createVento, spectra: FRONT.createSpectra, wendy: FRONT.createWendy,
  'tornado': FRONT.createTornado,
  'jazz': FRONT.createJazz,
  'velora': FRONT.createVelora,
  'vectra': FRONT.createVectra,
  'blazo': FRONT.createBlazo,
  'blitz': FRONT.createBlitz,
  'goair-12': FRONT.createGoair12,
  'goair-16': FRONT.createGoair16,
  'jawa': FRONT.createJawa,
  'regal': FRONT.createRegal,
  'safari': FRONT.createSafari,
  'piano-black': FRONT.createPianoBlack,
  'piano-white': FRONT.createPianoWhite,
  'stallion': FRONT.createStallion,
  'bullet-12': FRONT.createBullet12,
  'bullet-16': FRONT.createBullet16,
  'bullet-osc-16': FRONT.createBulletOsc16,
  'ornet': FRONT.createOrnet,
  'shine': FRONT.createShine,
  'champion': FRONT.createChampion,
  'indus': FRONT.createIndus,
  ...Object.fromEntries(Object.entries(APPLIANCES).map(([id, create]) => [`appl-${id}`, create])),
  // irons, the Cabin Fan, cooler motors and pumps (same 'appl-' keys)
  ...Object.fromEntries(Object.entries(SMALL_APPLIANCES).map(([id, create]) => [`appl-${id}`, create])),
  ...Object.fromEntries(Object.entries(CEILING_MODELS).map(([key, create]) => [`ceiling-${key}`, create])),
  ...Object.fromEntries(Object.entries(COOLERS).map(([key, create]) => [`cooler-${key}`, create])),
  'fresh-air-9': FRONT.createFreshAir9, 'fresh-air-12': FRONT.createFreshAir12, ventilation: FRONT.createVentilation,
  ...FRONT.FRONT_MODELS, // every front-facing fan, including the ones built from the studio photos
};
