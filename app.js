/* Tracky — Lektionsnotizen für den Wochenrapport.
   Alles bleibt lokal im Browser (IndexedDB). Erst der Download erzeugt eine Datei. */
(function () {
  "use strict";

  var DB_NAME = "tracky", DB_VERSION = 1, KV = "kv", BILDER = "bilder";
  var MAX_KANTE = 1600, JPEG_Q = 0.82;
  var LEKTIONEN = 3;

  var state = {
    person: null,
    datum: heuteISO(),
    start: "",
    lektionen: [],
    positives: "",
    negatives: "",
    gelernt: "",
    naechste_woche: ""
  };
  for (var i = 0; i < LEKTIONEN; i++) state.lektionen.push({ notizen: "", bilder: [] });

  var el = {
    people: document.getElementById("people"),
    datum: document.getElementById("datum"),
    start: document.getElementById("start"),
    lektionen: document.getElementById("lektionen"),
    positives: document.getElementById("positives"),
    negatives: document.getElementById("negatives"),
    gelernt: document.getElementById("gelernt"),
    naechste_woche: document.getElementById("naechste_woche"),
    check: document.getElementById("check"),
    status: document.getElementById("status"),
    download: document.getElementById("download"),
    reset: document.getElementById("reset"),
    toast: document.getElementById("toast")
  };

  /* ---------------------------------------------------------------- IndexedDB */

  function openDB() {
    return new Promise(function (resolve, reject) {
      var req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains(KV)) db.createObjectStore(KV);
        if (!db.objectStoreNames.contains(BILDER)) db.createObjectStore(BILDER);
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }

  var dbp = null;
  function db() { return dbp || (dbp = openDB()); }

  function tx(store, mode, fn) {
    return db().then(function (d) {
      return new Promise(function (resolve, reject) {
        var t = d.transaction(store, mode), s = t.objectStore(store), r = fn(s);
        t.oncomplete = function () { resolve(r && r.result); };
        t.onerror = function () { reject(t.error); };
      });
    });
  }

  function put(store, key, val) { return tx(store, "readwrite", function (s) { return s.put(val, key); }); }
  function get(store, key) { return tx(store, "readonly", function (s) { return s.get(key); }); }
  function del(store, key) { return tx(store, "readwrite", function (s) { return s.delete(key); }); }
  function clear(store) { return tx(store, "readwrite", function (s) { return s.clear(); }); }

  /* ---------------------------------------------------------------- Helfer */

  function heuteISO() {
    var d = new Date(), p = function (n) { return (n < 10 ? "0" : "") + n; };
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
  }

  function datumDE(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
    return m ? m[3] + "." + m[2] + "." + m[1] : iso;
  }

  function zeilen(text) {
    return (text || "").split(/\r?\n/).map(function (z) { return z.trim(); }).filter(Boolean);
  }

  function saetze(text) {
    var t = (text || "").replace(/\s+/g, " ").trim();
    if (!t) return 0;
    var teile = t.split(/(?<=[.!?])\s+/).filter(function (s) { return s.trim().length > 1; });
    return teile.length;
  }

  function toast(msg, ms) {
    el.toast.textContent = msg;
    el.toast.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { el.toast.classList.remove("show"); }, ms || 2600);
  }

  function meldeStatus(text, ok) {
    el.status.textContent = text;
    el.status.className = "status" + (ok ? " saved" : "");
  }

  /* ---------------------------------------------------------------- Speichern */

  var saveTimer = null;
  function speichern() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      put(KV, "state", JSON.parse(JSON.stringify(state))).then(function () {
        var d = new Date(), p = function (n) { return (n < 10 ? "0" : "") + n; };
        meldeStatus("Entwurf gespeichert " + p(d.getHours()) + ":" + p(d.getMinutes()), true);
      });
    }, 350);
  }

  /* ---------------------------------------------------------------- Bilder */

  function verkleinern(file) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      var url = URL.createObjectURL(file);
      img.onload = function () {
        var w = img.naturalWidth, h = img.naturalHeight;
        var f = Math.min(1, MAX_KANTE / Math.max(w, h));
        var c = document.createElement("canvas");
        c.width = Math.round(w * f);
        c.height = Math.round(h * f);
        var ctx = c.getContext("2d");
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(function (blob) {
          if (blob) resolve(blob);
          else reject(new Error("Bild konnte nicht umgewandelt werden"));
        }, "image/jpeg", JPEG_Q);
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error("Bild nicht lesbar")); };
      img.src = url;
    });
  }

  function bildHinzufuegen(li, file) {
    if (!/^image\//.test(file.type)) { toast("Das ist kein Bild: " + file.name); return; }
    verkleinern(file).then(function (blob) {
      var id = "b" + Date.now() + Math.random().toString(36).slice(2, 7);
      return put(BILDER, id, blob).then(function () {
        state.lektionen[li].bilder.push({ id: id, name: file.name || "bild.jpg" });
        zeichneLektion(li);
        speichern();
        pruefe();
      });
    }).catch(function (err) { toast(err.message); });
  }

  /* ---------------------------------------------------------------- UI */

  function zeichneLektion(li) {
    var box = document.getElementById("lek" + li);
    var textarea = box.querySelector("textarea");
    var thumbs = box.querySelector(".thumbs");
    var zaehler = box.querySelector(".count");

    var notiert = (textarea.value || "").trim().length > 0;
    zaehler.textContent = notiert ? "notiert" : "leer";
    zaehler.className = "count" + (notiert ? " ok" : "");

    thumbs.innerHTML = "";
    state.lektionen[li].bilder.forEach(function (b, idx) {
      var wrap = document.createElement("div");
      wrap.className = "thumb";
      var img = document.createElement("img");
      img.alt = b.name;
      get(BILDER, b.id).then(function (blob) {
        if (blob) img.src = URL.createObjectURL(blob);
      });
      var x = document.createElement("button");
      x.type = "button";
      x.title = "Bild entfernen";
      x.textContent = "×";
      x.addEventListener("click", function () {
        del(BILDER, b.id);
        state.lektionen[li].bilder.splice(idx, 1);
        zeichneLektion(li);
        speichern();
      });
      wrap.appendChild(img);
      wrap.appendChild(x);
      thumbs.appendChild(wrap);
    });
  }

  function baueLektionen() {
    for (var li = 0; li < LEKTIONEN; li++) {
      (function (li) {
        var h = document.createElement("div");
        h.className = "lesson";
        h.id = "lek" + li;
        h.innerHTML =
          '<div class="lesson-head"><h3>Lektion ' + (li + 1) + '</h3>' +
          '<span class="count">leer</span></div>' +
          '<textarea rows="2" placeholder="' +
          ["Firmware weitergebracht, neuer Spielmodus angefangen",
           "Abstandston getestet, Werte notiert",
           "Töne für Zombie abgestimmt"][li] + '"></textarea>' +
          '<label class="drop">📷 Foto hinzufügen oder hierher ziehen<input type="file" accept="image/*" multiple></label>' +
          '<div class="thumbs"></div>';

        var textarea = h.querySelector("textarea");
        textarea.value = state.lektionen[li].notizen;
        textarea.addEventListener("input", function () {
          state.lektionen[li].notizen = textarea.value;
          var z = h.querySelector(".count");
          var notiert = textarea.value.trim().length > 0;
          z.textContent = notiert ? "notiert" : "leer";
          z.className = "count" + (notiert ? " ok" : "");
          speichern();
          pruefe();
        });

        var drop = h.querySelector(".drop");
        var input = h.querySelector("input[type=file]");
        input.addEventListener("change", function () {
          Array.prototype.forEach.call(input.files, function (f) { bildHinzufuegen(li, f); });
          input.value = "";
        });
        ["dragenter", "dragover"].forEach(function (ev) {
          drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add("over"); });
        });
        ["dragleave", "drop"].forEach(function (ev) {
          drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove("over"); });
        });
        drop.addEventListener("drop", function (e) {
          Array.prototype.forEach.call(e.dataTransfer.files, function (f) { bildHinzufuegen(li, f); });
        });

        el.lektionen.appendChild(h);
        zeichneLektion(li);
      })(li);
    }
  }

  function setzePerson(p) {
    state.person = p;
    Array.prototype.forEach.call(el.people.querySelectorAll(".person"), function (b) {
      b.setAttribute("aria-pressed", String(b.dataset.person === p));
    });
    speichern();
    pruefe();
  }

  function bilanz() {
    var probleme = [];
    if (!state.person) probleme.push("Person wählen");
    var mitNotiz = state.lektionen.filter(function (l) { return l.notizen.trim(); }).length;
    if (!mitNotiz) probleme.push("mindestens eine Lektion notieren");
    state.lektionen.forEach(function (l, idx) {
      if (l.notizen.trim() && !l.bilder.length) probleme.push("Lektion " + (idx + 1) + " hat kein Foto");
    });
    return probleme;
  }

  function pruefe() {
    var probleme = bilanz();
    var harte = probleme.filter(function (p) {
      return p.indexOf("Person") === 0 || p.indexOf("mindestens eine Lektion") >= 0;
    });
    el.check.innerHTML = probleme.length
      ? "Noch offen: <b>" + probleme.join(" · ") + "</b>"
      : "Alles bereit für den Download.";
    el.download.disabled = harte.length > 0;
  }

  /* ---------------------------------------------------------------- Download */

  function speichereBlob(blob, name) {
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 1500);
  }

  function baueExport() {
    var lektionen = state.lektionen.map(function (l) {
      return { notizen: l.notizen.trim(), bilder: [] };
    });
    var files = [];
    var aufgaben = [];

    state.lektionen.forEach(function (l, li) {
      l.bilder.forEach(function (b, bi) {
        aufgaben.push(get(BILDER, b.id).then(function (blob) {
          if (!blob) return;
          var name = "bilder/l" + (li + 1) + "_" + (bi + 1) + ".jpg";
          lektionen[li].bilder.push(name);
          return blob.arrayBuffer().then(function (buf) {
            files.push({ name: name, data: new Uint8Array(buf) });
          });
        }));
      });
    });

    return Promise.all(aufgaben).then(function () {
      var json = {
        format: "tracky/2",
        person: state.person,
        datum: state.datum,
        lektion_start: state.start || null,
        erzeugt: new Date().toISOString(),
        lektionen: lektionen.filter(function (l) { return l.notizen || l.bilder.length; }),
        positives: zeilen(state.positives),
        negatives: zeilen(state.negatives),
        gelernt: zeilen(state.gelernt),
        naechste_woche: zeilen(state.naechste_woche)
      };
      files.unshift({ name: "tracky.json", data: TrackyZip.utf8(JSON.stringify(json, null, 2)) });
      return TrackyZip.build(files);
    });
  }

  function herunterladen() {
    el.download.disabled = true;
    baueExport().then(function (bytes) {
      var name = "tracky_" + state.person + "_" + datumDE(state.datum) + ".zip";
      speichereBlob(new Blob([bytes], { type: "application/zip" }), name);
      toast(name + " gespeichert — jetzt an Hermes schicken.");
      var probleme = bilanz();
      if (probleme.length) {
        setTimeout(function () {
          toast("Hinweis: " + probleme.join(" · "), 6000);
        }, 2800);
      }
    }).catch(function (err) {
      toast("Fehler beim Export: " + err.message, 5000);
    }).then(function () {
      el.download.disabled = false;
      pruefe();
    });
  }

  /* ---------------------------------------------------------------- Start */

  function bindeFeld(node, key) {
    node.value = state[key] || "";
    node.addEventListener("input", function () {
      state[key] = node.value;
      speichern();
      pruefe();
    });
  }

  function start() {
    el.datum.value = state.datum;
    el.start.value = state.start;
    el.datum.addEventListener("change", function () { state.datum = el.datum.value; speichern(); pruefe(); });
    el.start.addEventListener("change", function () { state.start = el.start.value; speichern(); });

    Array.prototype.forEach.call(el.people.querySelectorAll(".person"), function (b) {
      b.addEventListener("click", function () { setzePerson(b.dataset.person); });
    });

    bindeFeld(el.positives, "positives");
    bindeFeld(el.negatives, "negatives");
    bindeFeld(el.gelernt, "gelernt");
    bindeFeld(el.naechste_woche, "naechste_woche");

    baueLektionen();

    el.download.addEventListener("click", herunterladen);
    el.reset.addEventListener("click", function () {
      if (!confirm("Entwurf wirklich löschen? Alle Texte und Bilder werden entfernt.")) return;
      clear(KV).then(function () { return clear(BILDER); }).then(function () {
        location.reload();
      });
    });

    get(KV, "state").then(function (gespeichert) {
      if (!gespeichert) { pruefe(); return; }
      if (gespeichert.lektionen && gespeichert.lektionen.length === LEKTIONEN) {
        gespeichert.lektionen.forEach(function (l, i) { state.lektionen[i].bilder = l.bilder || []; });
      }
      Object.keys(gespeichert).forEach(function (k) {
        if (k !== "lektionen") state[k] = gespeichert[k];
      });
      gespeichert.lektionen && gespeichert.lektionen.forEach(function (l, x) {
        if (state.lektionen[x]) state.lektionen[x].notizen = l.notizen || l.text || "";
      });

      el.datum.value = state.datum;
      el.start.value = state.start || "";
      el.positives.value = state.positives || "";
      el.negatives.value = state.negatives || "";
      el.gelernt.value = state.gelernt || "";
      el.naechste_woche.value = state.naechste_woche || "";
      Array.prototype.forEach.call(el.people.querySelectorAll(".person"), function (b) {
        b.setAttribute("aria-pressed", String(b.dataset.person === state.person));
      });
      for (var li = 0; li < LEKTIONEN; li++) {
        var box = document.getElementById("lek" + li);
        box.querySelector("textarea").value = state.lektionen[li].notizen;
        zeichneLektion(li);
      }
      meldeStatus("Entwurf geladen", true);
      pruefe();
    });
  }

  start();
})();
