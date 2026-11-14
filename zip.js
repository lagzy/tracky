/* Minimaler ZIP-Writer (Methode "store", UTF-8-Namen).
   Kein Fremdcode, keine CDN-Abhängigkeit — läuft auch offline und auf GitHub Pages.
   Dateien: [{ name: "bilder/l1_1.jpg", data: Uint8Array }]  →  Uint8Array (fertiges Zip) */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.TrackyZip = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var TABLE = (function () {
    var t = new Uint32Array(256);
    for (var i = 0; i < 256; i++) {
      var c = i;
      for (var k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[i] = c >>> 0;
    }
    return t;
  })();

  function crc32(bytes) {
    var c = 0xffffffff;
    for (var i = 0; i < bytes.length; i++) c = TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  function dosTime(d) {
    var time = ((d.getHours() & 31) << 11) | ((d.getMinutes() & 63) << 5) | ((d.getSeconds() / 2) & 31);
    var date = (((d.getFullYear() - 1980) & 127) << 9) | (((d.getMonth() + 1) & 15) << 5) | (d.getDate() & 31);
    return { time: time, date: date };
  }

  function utf8(str) {
    if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(str);
    var out = [];
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      if (c < 0x80) out.push(c);
      else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
      else out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    }
    return new Uint8Array(out);
  }

  /* files: [{name, data: Uint8Array}] → Uint8Array */
  function build(files, when) {
    var now = dosTime(when || new Date());
    var chunks = [];
    var central = [];
    var offset = 0;

    files.forEach(function (f) {
      var name = utf8(f.name);
      var data = f.data instanceof Uint8Array ? f.data : new Uint8Array(f.data);
      var crc = crc32(data);

      var head = new Uint8Array(30 + name.length);
      var h = new DataView(head.buffer);
      h.setUint32(0, 0x04034b50, true);
      h.setUint16(4, 20, true);        // Version nötig
      h.setUint16(6, 0x0800, true);    // UTF-8-Namen
      h.setUint16(8, 0, true);         // store
      h.setUint16(10, now.time, true);
      h.setUint16(12, now.date, true);
      h.setUint32(14, crc, true);
      h.setUint32(18, data.length, true);
      h.setUint32(22, data.length, true);
      h.setUint16(26, name.length, true);
      h.setUint16(28, 0, true);
      head.set(name, 30);

      chunks.push(head, data);

      var cd = new Uint8Array(46 + name.length);
      var c = new DataView(cd.buffer);
      c.setUint32(0, 0x02014b50, true);
      c.setUint16(4, 20, true);        // Version erstellt
      c.setUint16(6, 20, true);        // Version nötig
      c.setUint16(8, 0x0800, true);
      c.setUint16(10, 0, true);
      c.setUint16(12, now.time, true);
      c.setUint16(14, now.date, true);
      c.setUint32(16, crc, true);
      c.setUint32(20, data.length, true);
      c.setUint32(24, data.length, true);
      c.setUint16(28, name.length, true);
      c.setUint16(30, 0, true);
      c.setUint16(32, 0, true);
      c.setUint16(34, 0, true);
      c.setUint16(36, 0, true);
      c.setUint32(38, 0, true);
      c.setUint32(42, offset, true);
      cd.set(name, 46);
      central.push(cd);

      offset += head.length + data.length;
    });

    var cdSize = central.reduce(function (n, c) { return n + c.length; }, 0);
    var end = new Uint8Array(22);
    var e = new DataView(end.buffer);
    e.setUint32(0, 0x06054b50, true);
    e.setUint16(8, files.length, true);
    e.setUint16(10, files.length, true);
    e.setUint32(12, cdSize, true);
    e.setUint32(16, offset, true);

    var total = offset + cdSize + end.length;
    var out = new Uint8Array(total);
    var pos = 0;
    chunks.concat(central, [end]).forEach(function (part) {
      out.set(part, pos);
      pos += part.length;
    });
    return out;
  }

  return { build: build, crc32: crc32, utf8: utf8 };
});
