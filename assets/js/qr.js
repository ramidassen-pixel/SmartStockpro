/* === qr.js === */
/* A small QR code maker (byte mode, error correction level M, versions 1–10, up to 213 characters).
   Follows the QR standard (ISO/IEC 18004) the same way Project Nayuki's reference library does.
   QR.svg(text, px) → an <svg> string with dark modules on white and a 4-module quiet zone. */
var QR = (function() {
  // Error-correction codewords per block and number of blocks, level M, versions 1..10
  var ECC = [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26];
  var BLOCKS = [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5];

  function rawModules(ver) {
    var r = (16 * ver + 128) * ver + 64;
    if (ver >= 2) { var n = Math.floor(ver / 7) + 2; r -= (25 * n - 10) * n - 55; if (ver >= 7) r -= 36; }
    return r;
  }
  function dataCodewords(ver) { return Math.floor(rawModules(ver) / 8) - ECC[ver] * BLOCKS[ver]; }
  function alignPositions(ver) {
    if (ver === 1) return [];
    var n = Math.floor(ver / 7) + 2, size = ver * 4 + 17;
    var step = Math.floor((ver * 8 + n * 3 + 5) / (n * 4 - 4)) * 2, out = [6];
    for (var p = size - 7; out.length < n; p -= step) out.splice(1, 0, p);
    return out;
  }

  // Galois field GF(2^8) arithmetic and Reed–Solomon
  function mul(x, y) { var z = 0; for (var i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11D); z ^= ((y >>> i) & 1) * x; } return z & 0xFF; }
  function divisor(degree) {
    var r = []; for (var i = 0; i < degree - 1; i++) r.push(0); r.push(1);
    var root = 1;
    for (i = 0; i < degree; i++) {
      for (var j = 0; j < r.length; j++) { r[j] = mul(r[j], root); if (j + 1 < r.length) r[j] ^= r[j + 1]; }
      root = mul(root, 2);
    }
    return r;
  }
  function remainder(data, div) {
    var r = div.map(function() { return 0; });
    data.forEach(function(b) {
      var f = b ^ r.shift(); r.push(0);
      div.forEach(function(c, i) { r[i] ^= mul(c, f); });
    });
    return r;
  }

  function utf8(s) { var u = unescape(encodeURIComponent(s)), a = []; for (var i = 0; i < u.length; i++) a.push(u.charCodeAt(i)); return a; }

  function encode(text) {
    var bytes = utf8(text), ver;
    for (ver = 1; ver <= 10; ver++) {
      var countBits = ver < 10 ? 8 : 16;
      if (4 + countBits + bytes.length * 8 <= dataCodewords(ver) * 8) break;
    }
    if (ver > 10) throw new Error('Text too long for a QR code');
    var cap = dataCodewords(ver) * 8, bits = [];
    function put(v, n) { for (var i = n - 1; i >= 0; i--) bits.push((v >>> i) & 1); }
    put(4, 4); put(bytes.length, ver < 10 ? 8 : 16); bytes.forEach(function(b) { put(b, 8); });
    put(0, Math.min(4, cap - bits.length));
    put(0, (8 - bits.length % 8) % 8);
    for (var pad = 0xEC; bits.length < cap; pad ^= 0xEC ^ 0x11) put(pad, 8);
    var data = []; for (var i = 0; i < bits.length; i += 8) { var b = 0; for (var k = 0; k < 8; k++) b = (b << 1) | bits[i + k]; data.push(b); }

    // Split into blocks, add error correction, interleave
    var nb = BLOCKS[ver], ecl = ECC[ver], raw = Math.floor(rawModules(ver) / 8);
    var shortBlocks = nb - raw % nb, shortLen = Math.floor(raw / nb), div = divisor(ecl), blocks = [], at = 0;
    for (i = 0; i < nb; i++) {
      var d = data.slice(at, at + shortLen - ecl + (i < shortBlocks ? 0 : 1)); at += d.length;
      var e = remainder(d, div); if (i < shortBlocks) d.push(0);
      blocks.push(d.concat(e));
    }
    var words = [];
    for (i = 0; i < blocks[0].length; i++) for (var j = 0; j < nb; j++) if (i !== shortLen - ecl || j >= shortBlocks) words.push(blocks[j][i]);

    // Build the matrix
    var size = ver * 4 + 17, m = [], fn = [];
    for (i = 0; i < size; i++) { m.push(new Array(size).fill(false)); fn.push(new Array(size).fill(false)); }
    function set(x, y, dark) { m[y][x] = dark; fn[y][x] = true; }
    for (i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
    [[3, 3], [size - 4, 3], [3, size - 4]].forEach(function(c) {
      for (var dy = -4; dy <= 4; dy++) for (var dx = -4; dx <= 4; dx++) {
        var x = c[0] + dx, y = c[1] + dy, dist = Math.max(Math.abs(dx), Math.abs(dy));
        if (x >= 0 && x < size && y >= 0 && y < size) set(x, y, dist !== 2 && dist !== 4);
      }
    });
    var al = alignPositions(ver), last = al.length - 1;
    for (i = 0; i < al.length; i++) for (j = 0; j < al.length; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) continue;
      for (var dy2 = -2; dy2 <= 2; dy2++) for (var dx2 = -2; dx2 <= 2; dx2++) set(al[i] + dx2, al[j] + dy2, Math.max(Math.abs(dx2), Math.abs(dy2)) !== 1);
    }
    function format(mask) {
      var v = (0 << 3) | mask, r = v; // level M = 00
      for (var q = 0; q < 10; q++) r = (r << 1) ^ ((r >>> 9) * 0x537);
      var f = ((v << 10) | r) ^ 0x5412, bit = function(n) { return ((f >>> n) & 1) === 1; };
      for (q = 0; q <= 5; q++) set(8, q, bit(q));
      set(8, 7, bit(6)); set(8, 8, bit(7)); set(7, 8, bit(8));
      for (q = 9; q < 15; q++) set(14 - q, 8, bit(q));
      for (q = 0; q < 8; q++) set(size - 1 - q, 8, bit(q));
      for (q = 8; q < 15; q++) set(8, size - 15 + q, bit(q));
      set(8, size - 8, true);
    }
    format(0);
    if (ver >= 7) {
      var r = ver; for (i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1F25);
      var vb = (ver << 12) | r;
      for (i = 0; i < 18; i++) { var bt = ((vb >>> i) & 1) === 1, a = size - 11 + i % 3, b2 = Math.floor(i / 3); set(a, b2, bt); set(b2, a, bt); }
    }
    // Place the codewords in the zig-zag order
    var n = 0;
    for (var right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (var vert = 0; vert < size; vert++) for (j = 0; j < 2; j++) {
        var x = right - j, up = ((right + 1) & 2) === 0, y = up ? size - 1 - vert : vert;
        if (!fn[y][x] && n < words.length * 8) { m[y][x] = ((words[n >>> 3] >>> (7 - (n & 7))) & 1) === 1; n++; }
      }
    }
    // Try all 8 masks and keep the one with the lowest penalty
    var MASKS = [
      function(x, y) { return (x + y) % 2 === 0; }, function(x, y) { return y % 2 === 0; },
      function(x) { return x % 3 === 0; }, function(x, y) { return (x + y) % 3 === 0; },
      function(x, y) { return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; },
      function(x, y) { return x * y % 2 + x * y % 3 === 0; },
      function(x, y) { return (x * y % 2 + x * y % 3) % 2 === 0; },
      function(x, y) { return ((x + y) % 2 + x * y % 3) % 2 === 0; },
    ];
    function applyMask(k) { for (var y = 0; y < size; y++) for (var x = 0; x < size; x++) if (!fn[y][x] && MASKS[k](x, y)) m[y][x] = !m[y][x]; }
    function penalty() {
      var p = 0, dark = 0, x, y, run;
      for (y = 0; y < size; y++) { run = 1; for (x = 1; x <= size; x++) { if (x < size && m[y][x] === m[y][x - 1]) run++; else { if (run >= 5) p += run - 2; run = 1; } } }
      for (x = 0; x < size; x++) { run = 1; for (y = 1; y <= size; y++) { if (y < size && m[y][x] === m[y - 1][x]) run++; else { if (run >= 5) p += run - 2; run = 1; } } }
      for (y = 0; y < size - 1; y++) for (x = 0; x < size - 1; x++) { var c = m[y][x]; if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) p += 3; }
      for (y = 0; y < size; y++) for (x = 0; x < size; x++) if (m[y][x]) dark++;
      return p + Math.floor(Math.abs(dark * 20 - size * size * 10) / (size * size)) * 10;
    }
    var best = 0, bestP = Infinity;
    for (var k = 0; k < 8; k++) { applyMask(k); format(k); var pk = penalty(); if (pk < bestP) { bestP = pk; best = k; } applyMask(k); }
    applyMask(best); format(best);
    return { size: size, version: ver, mask: best, modules: m };
  }

  function svg(text, px) {
    var q = encode(text), size = q.size, total = size + 8, path = '';
    for (var y = 0; y < size; y++) for (var x = 0; x < size; x++) if (q.modules[y][x]) path += 'M' + (x + 4) + ',' + (y + 4) + 'h1v1h-1z';
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + total + ' ' + total + '" width="' + (px || 220) + '" height="' + (px || 220)
      + '" shape-rendering="crispEdges" role="img" aria-label="QR code"><rect width="100%" height="100%" fill="#fff"/><path d="' + path + '" fill="#000"/></svg>';
  }

  return { encode: encode, svg: svg };
})();
