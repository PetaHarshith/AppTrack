/**
 * Generate the three required Chrome extension icons (16/48/128 px).
 * No dependencies — uses Node's built-in zlib for PNG encoding.
 *
 * Visual: orange square with a centered white square (matches the brand mark).
 *
 * Run once with `node generate-icons.js`.
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Standard CRC32 table for PNG chunks
const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    CRC_TABLE[n] = c;
}
const crc32 = (buf) => {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
};

const chunk = (type, data) => {
    const typeBuf = Buffer.from(type, 'ascii');
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
    return Buffer.concat([len, typeBuf, data, crc]);
};

const makePng = (size) => {
    const dotSize = Math.max(2, Math.floor(size * 0.32));
    const dotX = Math.floor((size - dotSize) / 2);
    const dotY = Math.floor((size - dotSize) / 2);

    const rowBytes = size * 4;
    const filtered = Buffer.alloc(size * (rowBytes + 1));
    for (let y = 0; y < size; y++) {
        // Row filter byte
        filtered[y * (rowBytes + 1)] = 0;
        for (let x = 0; x < size; x++) {
            let r = 249, g = 115, b = 22, a = 255; // brand orange #f97316
            if (x >= dotX && x < dotX + dotSize && y >= dotY && y < dotY + dotSize) {
                // White inner mark
                r = 255; g = 255; b = 255;
            }
            const i = y * (rowBytes + 1) + 1 + x * 4;
            filtered[i] = r; filtered[i + 1] = g; filtered[i + 2] = b; filtered[i + 3] = a;
        }
    }

    const compressed = zlib.deflateSync(filtered);

    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(size, 0);
    ihdr.writeUInt32BE(size, 4);
    ihdr.writeUInt8(8, 8);   // bit depth
    ihdr.writeUInt8(6, 9);   // RGBA color type
    ihdr.writeUInt8(0, 10);  // compression
    ihdr.writeUInt8(0, 11);  // filter
    ihdr.writeUInt8(0, 12);  // interlace

    const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
    return Buffer.concat([
        signature,
        chunk('IHDR', ihdr),
        chunk('IDAT', compressed),
        chunk('IEND', Buffer.alloc(0)),
    ]);
};

const dir = path.join(__dirname, 'icons');
if (!fs.existsSync(dir)) fs.mkdirSync(dir);

for (const size of [16, 48, 128]) {
    const png = makePng(size);
    const file = path.join(dir, `icon-${size}.png`);
    fs.writeFileSync(file, png);
    console.log(`Generated ${file} (${png.length} bytes)`);
}
