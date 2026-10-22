/* Fiction Studio — leitor/escritor ZIP mínimo, sem dependências.
   Compressão: deflate (CompressionStream) quando o navegador oferece; caso contrário, "stored". */
'use strict';

const Zip = (() => {
  const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
    return t;
  })();
  function crc32(buf) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }
  const canDeflate = typeof CompressionStream !== 'undefined';
  async function streamBytes(bytes, stream) {
    const s = new Blob([bytes]).stream().pipeThrough(stream);
    return new Uint8Array(await new Response(s).arrayBuffer());
  }
  async function toBytes(data) {
    if (data instanceof Uint8Array) return data;
    if (typeof data === 'string') return new TextEncoder().encode(data);
    if (data instanceof Blob) return new Uint8Array(await data.arrayBuffer());
    if (data instanceof ArrayBuffer) return new Uint8Array(data);
    throw new Error('Tipo de dado não suportado no ZIP');
  }

  /* files: [{name, data, compress?}] → Blob */
  async function create(files) {
    const enc = new TextEncoder();
    const chunks = []; const central = []; let offset = 0;
    const d = new Date();
    const dosTime = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
    const dosDate = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    for (const f of files) {
      const raw = await toBytes(f.data);
      const crc = crc32(raw);
      let method = 0, body = raw;
      if (canDeflate && f.compress !== false && raw.length > 64) {
        try {
          const c = await streamBytes(raw, new CompressionStream('deflate-raw'));
          if (c.length < raw.length) { method = 8; body = c; }
        } catch (e) { /* mantém stored */ }
      }
      const nameBytes = enc.encode(f.name);
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true);
      lh.setUint16(8, method, true); lh.setUint16(10, dosTime, true); lh.setUint16(12, dosDate, true);
      lh.setUint32(14, crc, true); lh.setUint32(18, body.length, true); lh.setUint32(22, raw.length, true);
      lh.setUint16(26, nameBytes.length, true); lh.setUint16(28, 0, true);
      chunks.push(new Uint8Array(lh.buffer), nameBytes, body);
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true);
      ch.setUint16(10, method, true); ch.setUint16(12, dosTime, true); ch.setUint16(14, dosDate, true);
      ch.setUint32(16, crc, true); ch.setUint32(20, body.length, true); ch.setUint32(24, raw.length, true);
      ch.setUint16(28, nameBytes.length, true); ch.setUint32(42, offset, true);
      central.push(new Uint8Array(ch.buffer), nameBytes);
      offset += 30 + nameBytes.length + body.length;
    }
    const cdSize = central.reduce((s, c) => s + c.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
    end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
    return new Blob([...chunks, ...central, new Uint8Array(end.buffer)], { type: 'application/zip' });
  }

  /* Blob/ArrayBuffer → Map(name → {bytes(), text()}) */
  async function read(input) {
    const buf = new Uint8Array(input instanceof Blob ? await input.arrayBuffer() : input);
    const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    let eocd = -1;
    for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) { if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; } }
    if (eocd < 0) throw new Error('Arquivo não é um ZIP válido.');
    const count = dv.getUint16(eocd + 10, true);
    let p = dv.getUint32(eocd + 16, true);
    const dec = new TextDecoder();
    const out = new Map();
    for (let i = 0; i < count; i++) {
      if (dv.getUint32(p, true) !== 0x02014b50) throw new Error('Diretório do ZIP corrompido.');
      const method = dv.getUint16(p + 10, true);
      const crc = dv.getUint32(p + 16, true);
      const csize = dv.getUint32(p + 20, true);
      const nlen = dv.getUint16(p + 28, true), xlen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true);
      const lho = dv.getUint32(p + 42, true);
      const name = dec.decode(buf.subarray(p + 46, p + 46 + nlen));
      p += 46 + nlen + xlen + clen;
      const lnlen = dv.getUint16(lho + 26, true), lxlen = dv.getUint16(lho + 28, true);
      const start = lho + 30 + lnlen + lxlen;
      const comp = buf.subarray(start, start + csize);
      const entry = {
        name,
        async bytes() {
          let data;
          if (method === 0) data = comp;
          else if (method === 8) {
            if (typeof DecompressionStream === 'undefined') throw new Error('Este navegador não descompacta ZIP (DecompressionStream ausente).');
            data = await streamBytes(comp, new DecompressionStream('deflate-raw'));
          } else throw new Error('Método de compressão não suportado: ' + method);
          if (crc32(data) !== crc) throw new Error('Falha de integridade (CRC) em ' + name);
          return data;
        },
        async text() { return dec.decode(await this.bytes()); },
      };
      if (!name.endsWith('/')) out.set(name, entry);
    }
    return out;
  }
  return { create, read, crc32 };
})();
