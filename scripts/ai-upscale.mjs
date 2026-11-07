// AI upscaling for small catalogue photos (Real-ESRGAN, general-photo model, 4x), used by catalogue-data.mjs.
//
// It sharpens and enlarges the product's own photo; it does not draw a new product. The model used is the
// general photo one (RealESRGAN_General_x4_v3), not the anime or "creative" ones, so it keeps the photo's
// shapes and colours and only restores edges.
//
// Setup (once per computer): download realesrgan-ncnn-vulkan for Windows and the RealESRGAN_General_x4_v3
// .bin/.param model, and put them in %LOCALAPPDATA%\aparna-tools\realesrgan (models in its models\ folder),
// or point APARNA_UPSCALER at the .exe. Without it, the build falls back to plain Lanczos enlarging.
//
// Results are cached in %LOCALAPPDATA%\aparna-tools\upscale-cache (keyed by the input pixels), so each photo is upscaled only once.

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import sharp from 'sharp';

const run = promisify(execFile);
const ROOT = path.resolve(import.meta.dirname, '..');
// outside the project (and so outside OneDrive, which would upload and lock it)
const CACHE = process.env.APARNA_UPSCALE_CACHE ?? path.join(os.homedir(), 'AppData', 'Local', 'aparna-tools', 'upscale-cache');
const EXE = process.env.APARNA_UPSCALER ?? path.join(os.homedir(), 'AppData', 'Local', 'aparna-tools', 'realesrgan', 'realesrgan-ncnn-vulkan.exe');
const MODEL = 'RealESRGAN_General_x4_v3';

export const upscalerAvailable = () => fs.existsSync(EXE) && fs.existsSync(path.join(path.dirname(EXE), 'models', `${MODEL}.param`));

// Returns a PNG buffer 4x the size of the input, or null if the upscaler isn't installed or fails.
export async function aiUpscale(input) {
  if (!upscalerAvailable()) return null;
  const png = await sharp(input).removeAlpha().png().toBuffer();
  const hash = crypto.createHash('sha1').update(png).update(MODEL).digest('hex');
  const cached = path.join(CACHE, `${hash}.webp`); // near-lossless WebP: a fraction of the PNG's size
  if (fs.existsSync(cached)) return fsp.readFile(cached);
  await fsp.mkdir(CACHE, { recursive: true });
  const tmpIn = path.join(os.tmpdir(), `aparna-up-${hash}-in.png`);
  const tmpOut = path.join(os.tmpdir(), `aparna-up-${hash}-out.png`);
  await fsp.writeFile(tmpIn, png);
  try {
    // small tiles: the laptop's integrated GPU has little video memory
    await run(EXE, ['-i', tmpIn, '-o', tmpOut, '-n', MODEL, '-s', '4', '-t', '64', '-m', path.join(path.dirname(EXE), 'models')], { timeout: 180000 });
    const out = await sharp(await fsp.readFile(tmpOut)).webp({ quality: 95 }).toBuffer();
    await fsp.writeFile(cached, out);
    return out;
  } catch (e) {
    console.warn(`  AI upscale failed (${e.message.split('\n')[0]}): using Lanczos for this one`);
    return null;
  } finally {
    await fsp.rm(tmpIn, { force: true });
    await fsp.rm(tmpOut, { force: true });
  }
}
