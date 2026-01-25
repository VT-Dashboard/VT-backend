import express from 'express';
import bwipjs from 'bwip-js';
import sharp from 'sharp';
import net from 'net';
import fs from 'fs';
import path from 'path';

const app = express();
app.use(express.json({limit: '5mb'}));

const DEFAULT_PRINTER_PORT = 9100;
const DEFAULT_WIDTH = 384; // common thermal printer printable width in pixels

function bwipToBuffer(opts){
  return new Promise((resolve, reject) => {
    bwipjs.toBuffer(opts, function(err, png) {
      if (err) return reject(err);
      resolve(png);
    });
  });
}

async function pngToEscposRaster(pngBuffer, targetWidth = DEFAULT_WIDTH){
  const img = sharp(pngBuffer).resize({width: targetWidth, withoutEnlargement: true}).flatten({background: '#FFFFFF'}).threshold(128).ensureAlpha(1);
  const {data, info} = await img.raw().toBuffer({resolveWithObject:true});
  const width = info.width;
  const height = info.height;

  // Convert to 1-bit per pixel (0=black, 1=white) and pack as vertical bytes (LSB = top pixel)
  const bytesPerLine = Math.ceil(width / 8);
  const slices = Math.ceil(height / 8);
  const imgData = Buffer.alloc(bytesPerLine * height);

  // Build data in column-major per 8-pixel vertical slices per ESC/POS raster format
  const raster = [];
  for (let y = 0; y < height; y += 8) {
    for (let x = 0; x < width; x++) {
      let byte = 0;
      for (let bit = 0; bit < 8; bit++) {
        const yy = y + bit;
        let pixel = 0xFF; // white default
        if (yy < height) {
          // raw output is one byte per pixel (grayscale) or RGBA depending; we used flatten+ensureAlpha so stride = channels
          // Assuming single channel (grayscale) or first channel is grayscale
          pixel = data[yy * info.channels * width + x * info.channels];
        }
        const isBlack = pixel < 128;
        if (isBlack) byte |= (1 << bit);
      }
      raster.push(byte);
    }
  }

  // ESC/POS raster bit image command: GS v 0 m xL xH yL yH [data]
  const xL = (width >> 3) & 0xFF;
  const xH = ((width >> 3) >> 8) & 0xFF;
  const yL = height & 0xFF;
  const yH = (height >> 8) & 0xFF;
  const header = Buffer.from([0x1D, 0x76, 0x30, 0x00, xL, xH, yL, yH]);
  return Buffer.concat([header, Buffer.from(raster)]);
}

async function generateBarcodePng(text, opts = {}){
  const bwipOpts = Object.assign({
    bcid: 'code128',
    text: text || '0123456789',
    scale: 3,
    height: 60,
    includetext: false,
    backgroundcolor: 'FFFFFF'
  }, opts || {});
  return await bwipToBuffer(bwipOpts);
}

app.get('/status', (req, res) => {
  res.json({ok: true, agent: 'local-node-print-agent'});
});

// Preview endpoint: returns base64 PNG for the barcode
app.post('/preview', async (req, res) => {
  try {
    const {text, opts} = req.body || {};
    const png = await generateBarcodePng(String(text || ''), opts);
    res.json({mime: 'image/png', image: png.toString('base64')});
  } catch (err) {
    console.error('Preview error', err);
    res.status(500).json({error: String(err.message || err)});
  }
});

// Print endpoint: generates ESC/POS raster from barcode PNG and sends to printer over TCP
app.post('/print', async (req, res) => {
  try {
    const {text, opts, host, port, raw, width} = req.body || {};
    const targetHost = host || '127.0.0.1';
    const targetPort = port || DEFAULT_PRINTER_PORT;

    // If client provided raw ESC/POS bytes (base64), forward them directly
    if (raw) {
      const buf = Buffer.from(raw, 'base64');
      await sendToPrinter(targetHost, targetPort, buf);
      return res.json({ok: true, sent: buf.length});
    }

    // Otherwise generate barcode PNG and convert to ESC/POS raster
    const png = await generateBarcodePng(String(text || ''), opts);
    const rasterBuf = await pngToEscposRaster(png, width || DEFAULT_WIDTH);

    // Build final payload: initialize, raster image, feed, cut
    const init = Buffer.from([0x1B, 0x40]); // ESC @
    const feed = Buffer.from('\n');
    const cut = Buffer.from([0x1D, 0x56, 0x00]); // GS V 0
    const payload = Buffer.concat([init, rasterBuf, feed, cut]);

    await sendToPrinter(targetHost, targetPort, payload);
    res.json({ok: true, bytes: payload.length});
  } catch (err) {
    console.error('Print error', err);
    res.status(500).json({error: String(err.message || err)});
  }
});

function sendToPrinter(host, port, buffer){
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    socket.setTimeout(5000);
    socket.on('error', (err) => { socket.destroy(); reject(err); });
    socket.on('timeout', () => { socket.destroy(); reject(new Error('Printer connection timeout')); });
    socket.connect(port, host, () => {
      socket.write(buffer, () => {
        socket.end();
        resolve();
      });
    });
  });
}

const PORT = process.env.PRINT_AGENT_PORT || 9100;
app.listen(PORT, () => console.log(`Local print agent listening on http://0.0.0.0:${PORT}`));

// If run directly, print a quick note
if (process.env.NODE_ENV !== 'test'){
  console.log('Print agent ready — use POST /preview and POST /print');
}
