/**
 * PNG, JPEG ve WebP dosyalarının piksel boyutunu başlıklarından okur (bağımlılıksız).
 * Biçim tanınmazsa ya da başlık bozuksa null döner.
 */
export function readImageSize(buf: Uint8Array): { width: number; height: number } | null {
  const b = Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength);
  // PNG: imza + IHDR
  if (b.length >= 24 && b.readUInt32BE(0) === 0x89504e47 && b.toString('ascii', 12, 16) === 'IHDR')
    return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
  // JPEG: SOFn segmentine kadar ilerle
  if (b.length >= 4 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) return null;
      const marker = b[i + 1];
      const len = b.readUInt16BE(i + 2);
      const isSof = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
      if (isSof) return { height: b.readUInt16BE(i + 5), width: b.readUInt16BE(i + 7) };
      i += 2 + len;
    }
    return null;
  }
  // WebP: RIFF....WEBP + VP8 / VP8L / VP8X
  if (
    b.length >= 30 &&
    b.toString('ascii', 0, 4) === 'RIFF' &&
    b.toString('ascii', 8, 12) === 'WEBP'
  ) {
    const chunk = b.toString('ascii', 12, 16);
    if (chunk === 'VP8 ')
      return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
    if (chunk === 'VP8L') {
      const bits = b.readUInt32LE(21);
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
    if (chunk === 'VP8X')
      return { width: b.readUIntLE(24, 3) + 1, height: b.readUIntLE(27, 3) + 1 };
  }
  return null;
}
