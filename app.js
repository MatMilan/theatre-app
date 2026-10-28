/* ============================================================
   «Рассадка» — распределение зрителей по местам в зале
   Чистый JavaScript, без модулей. Работает офлайн из файла.
   ============================================================ */
'use strict';

/* ---------------- Константы ---------------- */

const DEFAULT_FILE_NAME = 'рассадка_зрителей.xlsx';
const NO_CATEGORY = 'Без категории';
const NO_CAT_COLOR = '#8d93a1';

/* Палитра автоназначения цветов категориям */
const PALETTE = [
  '#FF5252', '#29B6F6', '#66BB6A', '#FFA726', '#BA68C8',
  '#FF7043', '#4DD0E1', '#9CCC65', '#FB8C00', '#AB47BC',
  '#EF5350', '#03A9F4', '#4CAF50', '#FF9800', '#9C27B0',
  '#E57373', '#0288D1', '#43A047', '#F57C00', '#7B1FA2',
  '#D32F2F', '#01579B', '#2E7D32', '#E65100', '#4A148C',
  '#F44336', '#2196F3', '#8BC34A', '#FFC107', '#673AB7'
];


/* Маленькие SVG-иконки для кнопок в списке зрителей */
const IC_EDIT = '<svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>';
const IC_DEL  = '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>';

/* ---------------- Утилиты ---------------- */

const $ = (sel) => document.querySelector(sel);

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function debounce(fn, ms) {
  let t = null;
  return function () {
    clearTimeout(t);
    const args = arguments;
    t = setTimeout(() => fn.apply(this, args), ms);
  };
}

/* ---------------- Состояние ---------------- */

let uid = 1;
const nextId = () => uid++;
let paletteIdx = 0;

/* ===== Реестр залов ===== */

/* Временная заготовка для залов без реальной схемы.
   Замените зоны каждого зала, когда будет готова раскладка. */
function stubZones() {
  return [
    { name: 'Зал', prefix: 'З', rows: 10, seats: 20, aisleAfterSeat: 10, crossAisleAfterRow: 0 }
  ];
}

const HALLS = [
  {
    id: 'drama',
    name: 'Театр Драмы',
    zones: [
      {
        name: 'Партер', prefix: 'П', rows: 15, seats: 36, aisleAfterSeat: 18, crossAisleAfterRow: 8,
        rowSettings: {
          1:  { seats: 20, aisleAfterSeat: 10 },
          2:  { seats: 28, aisleAfterSeat: 14 },
          3:  { seats: 30, aisleAfterSeat: 15 },
          4:  { seats: 32, aisleAfterSeat: 16 },
          5:  { seats: 34, aisleAfterSeat: 17 },
          6:  { seats: 30, aisleAfterSeat: 15 },
          7:  { seats: 30, aisleAfterSeat: 15 },
          8:  { seats: 32, aisleAfterSeat: 16 },
          9:  { seats: 34, aisleAfterSeat: 16, offset: 1.1 },
          10: { seats: 32, aisleAfterSeat: 16 },
          11: { seats: 33, aisleAfterSeat: 17, offset: -0.55 },
          12: { seats: 34, aisleAfterSeat: 17 },
          13: { seats: 36, aisleAfterSeat: 18 },
          14: { seats: 36, aisleAfterSeat: 18 },
          15: { seats: 32, aisleAfterSeat: 16 }
        }
      },
      {
        name: 'Балкон', prefix: 'Б', rows: 7, seats: 36, aisleAfterSeat: 18, crossAisleAfterRow: 0,
        rowSettings: {
          1: { seats: 34, aisleAfterSeat: 17 },
          2: { seats: 36, aisleAfterSeat: 18 },
          3: { seats: 30, aisleAfterSeat: 15 },
          4: { seats: 30, aisleAfterSeat: 15 },
          5: { seats: 32, aisleAfterSeat: 16 },
          6: { seats: 34, aisleAfterSeat: 17 },
          7: { seats: 42, aisleAfterSeat: 0 }
        }
      }
    ]
  },
  {
    id: 'sibir',
    name: 'КЗ «Сибирь»',
    sideTop: 0,
    zones: [
      {
        name: 'Партер', prefix: 'П', rows: 16, seats: 24,
        aisleAfterSeat: 12, reverseSeats: true, position: 'main',
        rowSettings: {
          14: { seats: 16, aisleAfterSeat: [7, 9], aisleWidth: 2.7 },
          15: { seats: 14, aisleAfterSeat: [6, 8], aisleWidth: 2.7 },
          16: { seats: 15, aisleAfterSeat: 7, aisleWidth: 7.7, offset: -0.5 }
        }
      },
      {
        name: 'VIP-Ложа', prefix: 'В', rows: 3, seats: 8,
        aisleAfterSeat: 4, reverseSeats: true, position: 'main',
        rowSettings: {
          2: { seats: 6, aisleAfterSeat: 3 }
        }
      },
      {
        name: 'Балкон левый', prefix: 'БЛ', rows: 1, seats: 13,
        vertical: true, position: 'left',
        numberFromStage: true, spanRows: 13, topOffset: 3
      },
      {
        name: 'Балкон правый', prefix: 'БП', rows: 1, seats: 13,
        vertical: true, position: 'right',
        numberFromStage: true, spanRows: 13, topOffset: 3
      }
    ]
  },
  {
    id: 'muzkomediya',
    name: 'Музкомедия',
    zones: [
      {
        name: 'Партер', prefix: 'П', rows: 10, seats: 26, aisleAfterSeat: 13, crossAisleAfterRow: 0,
        rowSettings: {
          1: { seats: 22, aisleAfterSeat: 11 },
          2: { seats: 22, aisleAfterSeat: 11 },
          3: { seats: 24, aisleAfterSeat: 12 },
          4: { seats: 24, aisleAfterSeat: 12 }
        }
      },
      {
        name: 'Амфитеатр', prefix: 'А', rows: 15, seats: 29, aisleAfterSeat: [7, 22], crossAisleAfterRow: 0, rowStart: 11
      }
    ]
  },
  {
    id: 'filarmoniya',
    name: 'Филармония',
    zones: [
      {
        name: 'Партер', prefix: 'П', rows: 12, seats: 21, crossAisleAfterRow: 5,
        position: 'main'
      },
      {
        name: 'Амфитеатр', prefix: 'А', rows: 7, seats: 22, rowStart: 13,
        position: 'main',
        rowSettings: { 7: { seats: 24 } }
      },
      {
        name: 'Балкон', prefix: 'Б', rows: 4, seats: 21,
        position: 'main',
        rowSettings: { 4: { seats: 34 } }
      },
      { name: 'Ложа левая',    prefix: 'ЛЛ', rows: 1, seats: 6,  vertical: true, position: 'left' },
      { name: 'Балкон левый',  prefix: 'ЛБ', rows: 1, seats: 12, vertical: true, position: 'left' },
      { name: 'Ложа правая',   prefix: 'ПЛ', rows: 1, seats: 6,  vertical: true, position: 'right' },
      { name: 'Балкон правый', prefix: 'ПБ', rows: 1, seats: 12, vertical: true, position: 'right' }
    ]
  },
  {
    id: 'molodezhny',
    name: 'Молодёжный театр',
    sideTop: 0,
    zones: [
      {
        name: 'Партер', prefix: 'П', rows: 16, seats: 20,
        aisleAfterSeat: 10, reverseSeats: true, position: 'main',
        crossAisleAfterRow: [6, 14],
        rowSettings: {
          16: { seats: 23, aisleAfterSeat: 0 , offset: -0.5}
        }
      },
      {
        name: 'Балкон', prefix: 'Б', rows: 5, seats: 22,
        reverseSeats: true, position: 'main'
      },
      { name: 'Ложа правая 1 этаж', prefix: 'П1', label: 'Правая Ложа 1 этаж',
        rows: 1, seats: 10, vertical: true, position: 'right', lane: 0, labelSide: true,
        numberFromStage: true, topOffset: 0, vGapsAfter: [1, 4, 5, 6, 9], vGapSize: 1.5 },
      { name: 'Ложа правая 2 этаж', prefix: 'П2', label: 'Правая Ложа 2 этаж',
        rows: 1, seats: 9, vertical: true, position: 'right', lane: 1, labelSide: true,
        numberFromStage: true, topOffset: 2, vGapsAfter: [1, 4, 5, 8], vGapSize: 1.5 },
      { name: 'Ложа левая 1 этаж', prefix: 'Л1', label: 'Левая Ложа 1 этаж',
        rows: 1, seats: 10, vertical: true, position: 'left', lane: 0, labelSide: true,
        numberFromStage: true, topOffset: 0, vGapsAfter: [1, 4, 5, 6, 9], vGapSize: 1.5 },
      { name: 'Ложа левая 2 этаж', prefix: 'Л2', label: 'Левая Ложа 2 этаж',
        rows: 1, seats: 9, vertical: true, position: 'left', lane: 1, labelSide: true,
        numberFromStage: true, topOffset: 2, vGapsAfter: [1, 4, 5, 8], vGapSize: 1.5 }
    ]
  }
];
function hallById(id) {
  return HALLS.find(h => h.id === id) || null;
}

function hallTemplate(id) {
  const h = hallById(id) || HALLS[0];
  return JSON.parse(JSON.stringify(h));
}

function defaultHall() {
  return hallTemplate('drama');
}

function fillHallSelect() {
  const sel = $('#hallSelect');
  if (!sel) return;
  sel.innerHTML = '';
  for (const h of HALLS) {
    const o = document.createElement('option');
    o.value = h.id;
    o.textContent = h.name;
    sel.appendChild(o);
  }
  sel.value = state.hallId;
}

async function onHallChange() {
  const sel = $('#hallSelect');
  const newId = sel.value;
  if (newId === state.hallId) return;

  const assigned = state.spectators.filter(s => s.seat).length;
  if (assigned > 0) {
    const ok = await confirmDlg(
      'Смена зала',
      'В текущем зале назначено мест: ' + assigned + '. При переходе в «' +
      hallById(newId).name + '» все назначения будут сняты (список зрителей сохранится). Продолжить?',
      { ok: 'Сменить зал', danger: true });
    if (!ok) { sel.value = state.hallId; return; }
  }

  state.hallId = newId;
  state.hall = hallTemplate(newId);
  for (const sp of state.spectators) sp.seat = null;
  seatIndex.clear();
  state.selectedId = null;
  markDirty();
  renderAll();
  toast('Зал: ' + hallById(newId).name, 'ok');
}

/* Сколько мест в конкретном ряду зоны (с учётом переопределений) */
function rowSeats(z, r) {
  const o = z.rowSettings && z.rowSettings[r];
  return (o && o.seats) ? o.seats : z.seats;
}

/* Общее количество мест в зоне (сумма мест по всем рядам) */
function zoneTotalSeats(z) {
  let total = 0;
  for (let r = 1; r <= z.rows; r++) {
    total += rowSeats(z, r);
  }
  return total;
}

/* Русские формы слова: plural(22, 'место', 'места', 'мест') → 'места' */
function plural(n, one, few, many) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
  return many;
}

/* Список проходов в ряду: возвращает массив номеров кресел, ПОСЛЕ которых проход.
   Поддерживает один проход (число) и несколько (массив). */
function rowAisles(z, r) {
  const o = z.rowSettings && z.rowSettings[r];
  let v = (o && o.aisleAfterSeat !== undefined) ? o.aisleAfterSeat : z.aisleAfterSeat;
  if (!v) return [];
  if (Array.isArray(v)) return v.filter(x => x > 0);
  return [v];
}

/* Ряды, после которых большой проход. Число или массив чисел. */
function crossAisleRows(z) {
  const v = z.crossAisleAfterRow;
  if (!v) return [];
  if (Array.isArray(v)) return v.filter(x => x > 0);
  return [v];
}

/* Ширина прохода в ряду (в размерах кресла). По умолчанию 2, как в CSS. */
function rowAisleWidth(z, r) {
  const o = z.rowSettings && z.rowSettings[r];
  return (o && o.aisleWidth) || z.aisleWidth || 2;
}

/* Отображаемый номер ряда (с учётом сдвига нумерации зоны).
   Для Амфитеатра с rowStart=11 внутренний ряд 1 показывается как ряд 11. */
function displayRowNumber(z, r) {
  return (z.rowStart || 1) + (r - 1);
}

/* Внутренний номер ряда (1..rows) по отображаемому номеру */
function internalRowNumber(z, displayRow) {
  return displayRow - (z.rowStart || 1) + 1;
}

/* Смещение ряда в единицах кресла: положительное — вправо, отрицательное — влево */
function rowOffset(z, r) {
  const o = z.rowSettings && z.rowSettings[r];
  return (o && typeof o.offset === 'number') ? o.offset : 0;
}

/* Максимум мест по всем рядам всех зон (для подбора размера кресла) */
function maxRowSeats(hall) {
  let m = 1;
  for (const z of hall.zones) {
    for (let r = 1; r <= z.rows; r++) {
      const n = rowSeats(z, r);
      if (n > m) m = n;
    }
  }
  return m;
}

const state = {
  hallId: 'drama',
  hall: defaultHall(),
  spectators: [],          // {id, name, category, seat}
  categories: new Map(),   // имя категории -> цвет
  selectedId: null,
  mode: 'view',            // 'view' | 'edit'
  dirty: false,
  fileName: DEFAULT_FILE_NAME,
  fileHandle: null         // FileSystemFileHandle (если доступен API)
};

const seatIndex = new Map(); // код места -> id зрителя
const seatEls = new Map();   // код места -> DOM-элемент кресла
let lastHintTs = 0;

function specById(id) {
  return state.spectators.find((s) => s.id === id) || null;
}

/* ---------------- Коды и описания мест ---------------- */

function zoneByPrefix(p) {
  return state.hall.zones.find((z) => z.prefix === p) || null;
}

function makeCode(zone, r, s) {
  return zone.prefix + '-' + displayRowNumber(zone, r) + '-' + s;
}

/* Разбор внутреннего кода вида «П-1-5». null, если код некорректен для текущей схемы */
function splitCode(code) {
  const m = /^(.+)-(\d+)-(\d+)$/.exec(code || '');
  if (!m) return null;
  const z = zoneByPrefix(m[1]);
  if (!z) return null;
  const d = +m[2], seat = +m[3];
  const r = internalRowNumber(z, d);
  if (r < 1 || r > z.rows || seat < 1 || seat > rowSeats(z, r)) return null;
  return { zone: z, row: d, seat: seat };
}

/* Человекочитаемое описание: «Партер, ряд 1, место 5» */
function humanSeat(code) {
  const s = splitCode(code);
  return s ? seatPlaceLabel(s) : null;
}

function seatPlaceLabel(info) {
  if (info.zone.vertical) return info.zone.name + ', место ' + info.seat;
  return info.zone.name + ', ряд ' + info.row + ', место ' + info.seat;
}

/* Разбор произвольного текста места из файла/ввода.
   Понимает: «П-1-5», «п 1 5», «Партер, ряд 1, место 5», «Балкон 7 36» и т.п. */
function parseSeatText(raw) {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const low = s.toLowerCase();

  /* Ищем зону по имени — берём самое длинное совпавшее имя,
     чтобы «Балкон левый» не перепутался с «Балкон» */
  let zone = null;
  let bestLen = 0;
  for (const z of state.hall.zones) {
    const nm = z.name.toLowerCase();
    if (nm && low.indexOf(nm) !== -1 && nm.length > bestLen) {
      bestLen = nm.length;
      zone = z;
    }
  }
  /* Если по имени не нашли — ищем по префиксу в начале строки,
     берём самый длинный префикс (чтобы «ПЛ» не стал «П») */
  if (!zone) {
    let best = null;
    for (const z of state.hall.zones) {
      const p = z.prefix.toLowerCase();
      if (p && low.indexOf(p) === 0) {
        if (!best || p.length > best.prefix.toLowerCase().length) best = z;
      }
    }
    zone = best;
  }
  if (!zone) return null;

  const nums = s.match(/\d+/g);
  if (!nums) return null;

  if (zone.vertical) {
    /* Вертикальная зона: номер один — это место */
    const seat = +nums[nums.length - 1];
    if (seat < 1 || seat > rowSeats(zone, 1)) return null;
    return makeCode(zone, 1, seat);
  }

  if (nums.length < 2) return null;
  const d = +nums[0], seat = +nums[1];
  const r = internalRowNumber(zone, d);
  if (r < 1 || r > zone.rows || seat < 1 || seat > rowSeats(zone, r)) return null;
  return makeCode(zone, r, seat);
}

/* Проверка кода места для произвольной схемы зала */
function codeValidIn(code, hall) {
  const m = /^(.+)-(\d+)-(\d+)$/.exec(code || '');
  if (!m) return false;
  const z = hall.zones.find((zz) => zz.prefix === m[1]);
  if (!z) return false;
  const r = +m[2], s = +m[3];
  return r >= 1 && r <= z.rows && s >= 1 && s <= rowSeats(z, r);
}

/* ---------------- Категории и цвета ---------------- */

function catColor(name) {
  return state.categories.get(name) || NO_CAT_COLOR;
}

/* Перестроить список категорий по текущим зрителям.
   Существующие цвета сохраняются, новым категориям цвет назначается из палитры.
   Пустые категории автоматически удаляются. */
function rebuildCategories() {
  const old = state.categories;
  const m = new Map();
  for (const sp of state.spectators) {
    sp.category = (sp.category || '').trim() || NO_CATEGORY;
    if (!m.has(sp.category)) {
      let color = old.get(sp.category);
      if (!color) {
        color = (sp.category === NO_CATEGORY)
          ? NO_CAT_COLOR
          : PALETTE[paletteIdx++ % PALETTE.length];
      }
      m.set(sp.category, color);
    }
  }
  state.categories = m;
}

function setCategoryColor(name, color) {
  state.categories.set(name, color);
  markDirty();
  refreshAllSeats();
  renderList();
  renderLegend();
}

/* ---------------- Индекс мест ---------------- */

function rebuildSeatIndex() {
  seatIndex.clear();
  for (const sp of state.spectators) {
    if (sp.seat) {
      if (seatIndex.has(sp.seat)) sp.seat = null; // дубликат: место остаётся за первым
      else seatIndex.set(sp.seat, sp.id);
    }
  }
}

function setSeat(sp, code) {
  if (sp.seat) seatIndex.delete(sp.seat);
  sp.seat = code || null;
  if (sp.seat) seatIndex.set(sp.seat, sp.id);
}

/* ---------------- Признак изменений ---------------- */

function markDirty(v) {
  state.dirty = (v !== false);
  document.title = (state.dirty ? '● ' : '') + 'Рассадка зрителей';
  updateStatus();
}

/* ---------------- Назначение мест ---------------- */

function handleSeatClick(code) {
  if (state.mode !== 'edit') return; // в просмотре работает только подсказка

  const sel = state.selectedId ? specById(state.selectedId) : null;

  if (!sel) {
    const occId = seatIndex.get(code);
    if (occId) {
      selectSpectator(occId, true);
    } else {
      const now = Date.now();
      if (now - lastHintTs > 4000) {
        lastHintTs = now;
        toast('Сначала выберите зрителя в списке слева', 'info');
      }
    }
    return;
  }

  const prevCode = sel.seat;

  /* Повторный клик по собственному месту — снять назначение */
  if (prevCode === code) {
    setSeat(sel, null);
    markDirty();
    updateSeatEl(code);
    renderList(); renderLegend(); updateStatus();
    toast('Назначение снято: ' + humanSeat(code), 'info');
    return;
  }

  /* Если место занято другим — прежний зритель остаётся без места */
  let displaced = null;
  const occId = seatIndex.get(code);
  if (occId && occId !== sel.id) {
    displaced = specById(occId);
    setSeat(displaced, null);
  }

  setSeat(sel, code);
  markDirty();
  updateSeatEl(code);
  if (prevCode) updateSeatEl(prevCode);
  renderList(); renderLegend(); updateStatus(); refreshSelRing();

  if (displaced) {
    toast(sel.name + ' → ' + humanSeat(code) + '. ' + displaced.name + ' остаётся без места.', 'warn', 4500);
  } else {
    toast(sel.name + ' → ' + humanSeat(code), 'ok');
  }
}

/* ---------------- Выбор зрителя ---------------- */

function selectSpectator(id, scroll) {
  state.selectedId = id;
  renderList();
  refreshSelRing();
  if (id !== null && scroll) {
    const el = document.querySelector('.spec[data-id="' + id + '"]');
    if (el) el.scrollIntoView({ block: 'nearest' });
  }
}

function refreshSelRing() {
  document.querySelectorAll('.seat.sel-ring').forEach((e) => e.classList.remove('sel-ring'));
  const sel = state.selectedId ? specById(state.selectedId) : null;
  if (sel && sel.seat) {
    const el = seatEls.get(sel.seat);
    if (el) el.classList.add('sel-ring');
  }
}

/* ---------------- Отрисовка: план зала ---------------- */

function rowLabel(r) {
  const s = document.createElement('span');
  s.className = 'rownum';
  s.textContent = r;
  return s;
}

function renderPlan() {
  seatEls.clear();
  const plan = $('#plan');
  plan.innerHTML = '';
  /* Верхняя граница боковых зон задаётся отдельно для каждого зала. Без этого поля сохраняется прежнее поведение (Филармония). */
  if (typeof state.hall.sideTop === 'number') {
    plan.style.setProperty('--side-top', 'calc(var(--seat) * ' + state.hall.sideTop + ' + 50px)');
  } else {
    plan.style.removeProperty('--side-top');
  }
  const stage = document.createElement('div');
  stage.className = 'stage';
  stage.innerHTML = '<span>СЦЕНА</span>';

  const leftZones = state.hall.zones.filter(z => z.position === 'left');
  const rightZones = state.hall.zones.filter(z => z.position === 'right');
  const mainZones = state.hall.zones.filter(z => !z.position || z.position === 'main');
  const hasSides = leftZones.length > 0 || rightZones.length > 0;

  let zi = 0;
  if (hasSides) {
    plan.appendChild(stage);
    const grid = document.createElement('div');
    grid.className = 'plan-grid';

    const leftCol = buildSideColumn(leftZones, 'left');

    const mainCol = document.createElement('div');
    mainCol.className = 'main-col';
    for (const z of mainZones) mainCol.appendChild(buildZone(z, zi++));

    const rightCol = buildSideColumn(rightZones, 'right');

    grid.append(leftCol, mainCol, rightCol);
    plan.appendChild(grid);
  } else {
    plan.appendChild(stage);
    for (const z of mainZones) plan.appendChild(buildZone(z, zi++));
  }

  fitPlan();
  refreshAllSeats();
  refreshSelRing();
}

/* Обычная горизонтальная зона (ряды кресел) */
function buildZone(z, zi) {
  const sec = document.createElement('section');
  sec.className = 'zone zone-i' + zi;

  const head = document.createElement('div');
  head.className = 'zone-head';
  const totalSeats = zoneTotalSeats(z);
  head.innerHTML = '<h2>' + esc(z.name) + '</h2>' +
    '<span class="zone-sub">' + z.rows + ' ' + plural(z.rows, 'ряд', 'ряда', 'рядов') + ' · ' +
    totalSeats + ' ' + plural(totalSeats, 'место', 'места', 'мест') + '</span>';
  sec.appendChild(head);

  const body = document.createElement('div');
  body.className = 'zone-body';

  const crossRows = crossAisleRows(z);

  for (let r = 1; r <= z.rows; r++) {
    const row = document.createElement('div');
    row.className = 'hall-row' + (crossRows.includes(r) ? ' after-aisle' : '');
    row.appendChild(rowLabel(displayRowNumber(z, r)));

    const seatsInRow = rowSeats(z, r);
    const aisles = rowAisles(z, r);
    const reverse = !!z.reverseSeats;

    /* Порядок отрисовки слева направо на экране */
    const order = [];
    if (reverse) {
      for (let s = seatsInRow; s >= 1; s--) order.push(s);
    } else {
      for (let s = 1; s <= seatsInRow; s++) order.push(s);
    }

    for (let i = 0; i < order.length; i++) {
      const s = order[i];
      const code = makeCode(z, r, s);
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'seat free';
      b.dataset.code = code;
      seatEls.set(code, b);
      row.appendChild(b);

      /* Проход ставим между текущим креслом и следующим в порядке отрисовки.
         При обратной нумерации это кресло с номером на 1 меньше. */
      const neighbor = reverse ? s - 1 : s + 1;
      if (neighbor >= 1 && neighbor <= seatsInRow && aisles.includes(neighbor)) {
        const gap = document.createElement('span');
        gap.className = 'aisle-gap';
        gap.style.width = 'calc(var(--seat) * ' + rowAisleWidth(z, r) + ')';
        row.appendChild(gap);
      }
    }

    row.appendChild(rowLabel(displayRowNumber(z, r)));

    const off = rowOffset(z, r);
    if (off) {
      row.classList.add('shifted');
      if (off > 0) row.style.paddingLeft = 'calc(var(--seat) * ' + (off * 2) + ')';
      else row.style.paddingRight = 'calc(var(--seat) * ' + (-off * 2) + ')';
    }

    body.appendChild(row);
  }

  sec.appendChild(body);
  return sec;
}

/* Вертикальная зона (ложа / боковой балкон): кресла сверху вниз.
   Место 1 рисуется внизу (дальше от сцены), поэтому идём от N к 1. */
function buildVerticalZone(z) {
  const wrap = document.createElement('div');
  wrap.className = 'vzone' + (z.labelSide ? ' vzone-labelside' : '');

  if (typeof z.topOffset === 'number' && z.topOffset) {
    wrap.style.marginTop = 'calc((var(--seat) + 3px) * ' + z.topOffset + ')';
  }

  const head = document.createElement('div');
  head.className = 'vzone-head';
  head.textContent = z.label || z.name;

  const col = document.createElement('div');
  col.className = 'vzone-seats';

  if (z.spanRows) {
    col.style.height = 'calc((var(--seat) + 3px) * ' + z.spanRows + ')';
    col.style.justifyContent = 'space-between';
  }

  const n = z.seats || 0;
  const order = [];
  if (z.numberFromStage) {
    for (let s = 1; s <= n; s++) order.push(s);
  } else {
    for (let s = n; s >= 1; s--) order.push(s);
  }

  const gapsAfter = z.vGapsAfter || [];
  const gapSize = z.vGapSize || 1;

  for (const s of order) {
    const code = makeCode(z, 1, s);
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'seat free';
    b.dataset.code = code;
    seatEls.set(code, b);
    col.appendChild(b);

    /* Дополнительный вертикальный зазор после указанного кресла */
    if (gapsAfter.includes(s)) {
      const spacer = document.createElement('span');
      spacer.className = 'vseat-gap';
      spacer.style.height = 'calc((var(--seat) + 3px) * ' + gapSize + ')';
      col.appendChild(spacer);
    }
  }

  /* Подпись сбоку: размещаем её снаружи (дальше от зала) */
  if (z.labelSide && z.position === 'right') {
    wrap.appendChild(col);
    wrap.appendChild(head);
  } else {
    wrap.appendChild(head);
    wrap.appendChild(col);
  }

  return wrap;
}
/* Боковая колонна: группирует вертикальные зоны по полосам (lane).
   Полоса 0 — ближе к залу, далее — наружу. Слева полосы зеркалятся. */
function buildSideColumn(zones, side) {
  const col = document.createElement('div');
  col.className = 'side-col';

  const lanes = new Map();
  for (const z of zones) {
    const lane = z.lane || 0;
    if (!lanes.has(lane)) lanes.set(lane, []);
    lanes.get(lane).push(z);
  }

  const laneKeys = Array.from(lanes.keys()).sort((a, b) => a - b);
  /* Слева — в обратном порядке, чтобы получилось зеркально */
  const ordered = (side === 'left') ? laneKeys.slice().reverse() : laneKeys;

  for (const lane of ordered) {
    const laneCol = document.createElement('div');
    laneCol.className = 'side-lane';
    for (const z of lanes.get(lane)) {
      laneCol.appendChild(buildVerticalZone(z));
    }
    col.appendChild(laneCol);
  }

  return col;
}
/* Подбор размера кресла под ширину области */
function fitPlan() {
  const scroller = $('#planScroll');
  const plan = $('#plan');
  if (!scroller || !plan) return;
  const avail = scroller.clientWidth - 44;

  const horiz = state.hall.zones.filter(z => !z.vertical);
  let maxSeats = 1;
  for (const z of horiz) {
    for (let r = 1; r <= z.rows; r++) {
      const n = rowSeats(z, r);
      if (n > maxSeats) maxSeats = n;
    }
  }

  const leftLaneSet = new Set();
  const rightLaneSet = new Set();
  for (const z of state.hall.zones) {
    if (z.position === 'left') leftLaneSet.add(z.lane || 0);
    if (z.position === 'right') rightLaneSet.add(z.lane || 0);
  }
  const maxLanes = Math.max(leftLaneSet.size, rightLaneSet.size);
  const hasSides = state.hall.zones.some(z => z.position === 'left' || z.position === 'right');
  const reserve = hasSides ? maxLanes * 180 : 0;

  let s = Math.floor((avail - reserve - 60 - 2 * (maxSeats - 1)) / (maxSeats + 1.6));
  s = Math.max(8, Math.min(26, s));
  plan.style.setProperty('--seat', s + 'px');
}

function updateSeatEl(code) {
  const el = seatEls.get(code);
  if (!el) return;
  const info = splitCode(code);
  if (!info) return;
  const place = seatPlaceLabel(info);
  const occId = seatIndex.get(code);

  if (occId) {
    const sp = specById(occId);
    el.classList.remove('free');
    el.classList.add('occ');
    el.style.background = catColor(sp.category);
    el.setAttribute('aria-label', place + ' — ' + sp.name + ' (' + sp.category + ')');
  } else {
    el.classList.add('free');
    el.classList.remove('occ');
    el.style.background = '';
    el.setAttribute('aria-label', place + ' — свободно');
  }
}

function refreshAllSeats() {
  for (const code of seatEls.keys()) updateSeatEl(code);
}

/* ---------------- Отрисовка: список зрителей ---------------- */

function buildSpecRow(sp) {
  const li = document.createElement('li');
  li.className = 'spec' + (sp.id === state.selectedId ? ' selected' : '');
  li.dataset.id = sp.id;
  li.innerHTML =
    '<span class="dot" style="background:' + catColor(sp.category) + '"></span>' +
    '<div class="spec-main">' +
      '<span class="spec-name">' + esc(sp.name) + '</span>' +
      '<span class="spec-meta">' + esc(sp.category) + ' · ' +
        (sp.seat ? esc(humanSeat(sp.seat)) : '<em>не назначено</em>') + '</span>' +
    '</div>' +
    '<span class="spec-tools">' +
      '<button type="button" class="ibtn edit" title="Редактировать">' + IC_EDIT + '</button>' +
      '<button type="button" class="ibtn del" title="Удалить">' + IC_DEL + '</button>' +
    '</span>';
  return li;
}

function renderList() {
  const search = $('#search');
  const q = search ? search.value.trim().toLowerCase() : '';
  const onlyFreeEl = $('#onlyUnassigned');
  const onlyFree = onlyFreeEl ? onlyFreeEl.checked : false;
  const ul = $('#specList');
  ul.innerHTML = '';

  const freeCount = state.spectators.filter((sp) => !sp.seat).length;
  if (onlyFreeEl) $('#unassignedCount').textContent = freeCount;

  const items = state.spectators.filter((sp) =>
    (!q || sp.name.toLowerCase().includes(q) || sp.category.toLowerCase().includes(q)) &&
    (!onlyFree || !sp.seat));

  if (!state.spectators.length) {
    ul.innerHTML = '<li class="empty">Список пуст.<br>Добавьте зрителей вручную, вставьте из буфера или загрузите файл .xlsx.</li>';
  } else if (!items.length) {
    ul.innerHTML = '<li class="empty">' + (q
      ? 'По запросу «' + esc(q) + '» ничего не найдено.'
      : 'Все зрители уже рассажены.') + '</li>';
  } else {
    const frag = document.createDocumentFragment();
    for (const sp of items) frag.appendChild(buildSpecRow(sp));
    ul.appendChild(frag);
  }

  const cnt = $('#listCount');
  if (cnt) {
    cnt.textContent = q
      ? items.length + ' из ' + state.spectators.length
      : String(state.spectators.length);
  }
}

/* ---------------- Отрисовка: легенда ---------------- */

function renderLegend() {
  const box = $('#legendChips');
  box.innerHTML = '';

  const free = document.createElement('span');
  free.className = 'chip chip-static';
  free.innerHTML = '<span class="sw" style="background:#d9d7d2"></span>' +
    '<span class="chip-name">Свободно</span>';
  box.appendChild(free);

  if (!state.categories.size) {
    const em = document.createElement('span');
    em.className = 'legend-empty';
    em.textContent = 'Категории появятся после добавления зрителей';
    box.appendChild(em);
    return;
  }

  const counts = {};
  for (const sp of state.spectators) counts[sp.category] = (counts[sp.category] || 0) + 1;

  for (const [name, color] of state.categories) {
    const chip = document.createElement('label');
    chip.className = 'chip' + (state.mode === 'edit' ? '' : ' readonly');
    chip.title = state.mode === 'edit' ? 'Щёлкните, чтобы изменить цвет категории' : name;

    const sw = document.createElement('span');
    sw.className = 'sw';
    sw.style.background = color;

    const inp = document.createElement('input');
    inp.type = 'color';
    inp.value = color;
    inp.disabled = state.mode !== 'edit';
    inp.addEventListener('change', () => setCategoryColor(name, inp.value));

    const nm = document.createElement('span');
    nm.className = 'chip-name';
    nm.textContent = name;

    const ct = document.createElement('span');
    ct.className = 'chip-count';
    ct.textContent = counts[name] || 0;

    chip.append(sw, inp, nm, ct);
    box.appendChild(chip);
  }
}

/* ---------------- Отрисовка: статус-бар ---------------- */

function updateStatus() {
  const assigned = state.spectators.filter((s) => s.seat).length;
  const total = state.spectators.length;
  const totalSeats = state.hall.zones.reduce((a, z) => {
    for (let r = 1; r <= z.rows; r++) a += rowSeats(z, r);
    return a;
  }, 0);

  $('#stMode').textContent = state.mode === 'edit' ? 'Редактирование' : 'Просмотр';
  $('#stHall').textContent = 'Зал: ' + state.hall.name;
  $('#stAssigned').textContent = 'Назначено: ' + assigned + ' из ' + total +
    ' · Свободных мест: ' + (totalSeats - assigned) + ' из ' + totalSeats;
  $('#stCats').textContent = 'Категорий: ' + state.categories.size;
  $('#stFile').textContent = state.fileName + (state.dirty ? ' · не сохранено' : '');
  $('#stFile').classList.toggle('unsaved', state.dirty);
}

/* ---------------- Режимы ---------------- */

function setMode(m) {
  state.mode = m;
  document.body.classList.toggle('mode-edit', m === 'edit');
  document.body.classList.toggle('mode-view', m === 'view');
  if (m === 'view') selectSpectator(null);
  $('#modeLabel').textContent = m === 'edit' ? 'Просмотр' : 'Редактировать';
  $('#btnMode').title = m === 'edit' ? 'Переключиться в режим просмотра' : 'Переключиться в режим редактирования';
  renderLegend();
  updateStatus();
}

/* ---------------- Общая перерисовка ---------------- */

function renderAll() {
  renderPlan();
  renderList();
  renderLegend();
  updateStatus();
}

/* ---------------- Подсказка (тултип) ---------------- */

function showTooltip(code, x, y) {
  const info = splitCode(code);
  if (!info) return;
  const tip = $('#tooltip');
  const place = seatPlaceLabel(info);
  const occId = seatIndex.get(code);

  let html = '';
  if (occId) {
    const sp = specById(occId);
    html = '<div class="tt-name">' + esc(sp.name) + '</div>' +
      '<div class="tt-cat"><i style="background:' + catColor(sp.category) + '"></i>' + esc(sp.category) + '</div>' +
      '<div class="tt-place">' + esc(place) + '</div>';
  } else {
    html = '<div class="tt-free">Место свободно</div>' +
      '<div class="tt-place">' + esc(place) + '</div>';
  }
  tip.innerHTML = html;
  tip.classList.add('show');

  const pad = 14;
  let tx = x + pad, ty = y + pad;
  const r = tip.getBoundingClientRect();
  if (tx + r.width > window.innerWidth - 8) tx = x - r.width - pad;
  if (ty + r.height > window.innerHeight - 8) ty = y - r.height - pad;
  tip.style.left = Math.max(4, tx) + 'px';
  tip.style.top = Math.max(4, ty) + 'px';
}

function hideTooltip() {
  $('#tooltip').classList.remove('show');
}

/* ---------------- Всплывающие уведомления ---------------- */

function toast(msg, kind, ms) {
  kind = kind || 'info';
  ms = ms || 3200;
  const box = $('#toasts');
  const t = document.createElement('div');
  t.className = 'toast ' + kind;
  t.textContent = msg;
  box.appendChild(t);
  requestAnimationFrame(() => t.classList.add('in'));
  setTimeout(() => {
    t.classList.remove('in');
    setTimeout(() => t.remove(), 260);
  }, ms);
}

/* ---------------- Модальные окна ---------------- */

const modalStack = [];

function openModal(opts) {
  opts = opts || {};
  const back = document.createElement('div');
  back.className = 'modal-backdrop';
  const m = document.createElement('div');
  m.className = 'modal';
  if (opts.width) m.style.maxWidth = opts.width;
  m.innerHTML = '<div class="modal-head"><h3>' + esc(opts.title || '') + '</h3>' +
    '<button type="button" class="ibtn modal-x" title="Закрыть">✕</button></div>';

  const body = document.createElement('div');
  body.className = 'modal-body';
  m.appendChild(body);
  const foot = document.createElement('div');
  foot.className = 'modal-foot';
  m.appendChild(foot);
  back.appendChild(m);
  document.body.appendChild(back);
  requestAnimationFrame(() => back.classList.add('in'));

  const api = { body: body, foot: foot, onDismiss: null };

  api.close = function () {
    back.classList.remove('in');
    setTimeout(() => back.remove(), 150);
    const i = modalStack.indexOf(api);
    if (i !== -1) modalStack.splice(i, 1);
    document.removeEventListener('keydown', onKey, true);
  };

  function dismiss() {
    if (api.onDismiss) api.onDismiss();
    api.close();
  }
  function onKey(e) {
    if (e.key === 'Escape') { e.stopPropagation(); dismiss(); }
  }

  back.addEventListener('mousedown', (e) => { if (e.target === back) dismiss(); });
  m.querySelector('.modal-x').addEventListener('click', dismiss);
  document.addEventListener('keydown', onKey, true);

  modalStack.push(api);
  return api;
}

function confirmDlg(title, text, o) {
  o = o || {};
  return new Promise((res) => {
    const api = openModal({ title: title, width: '460px' });
    api.body.innerHTML = '<p class="confirm-text">' + esc(text) + '</p>';

    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'btn';
    cancel.textContent = o.cancel || 'Отмена';

    const ok = document.createElement('button');
    ok.type = 'button';
    ok.className = 'btn ' + (o.danger ? 'danger' : 'primary');
    ok.textContent = o.ok || 'Подтвердить';

    const done = (v) => { api.onDismiss = null; api.close(); res(v); };
    ok.addEventListener('click', () => done(true));
    cancel.addEventListener('click', () => done(false));
    api.onDismiss = () => done(false);

    api.foot.append(cancel, ok);
    setTimeout(() => ok.focus(), 60);
  });
}

/* ---------------- Модалка: зритель (добавить/изменить) ---------------- */

function openSpectatorModal(id) {
  const sp = id ? specById(id) : null;
  const api = openModal({ title: sp ? 'Редактировать зрителя' : 'Новый зритель', width: '500px' });

  const catOptions = Array.from(state.categories.keys())
    .map((c) => '<option value="' + esc(c) + '">').join('');

  api.body.innerHTML =
    '<label class="fld"><span>ФИО *</span>' +
      '<input id="mName" type="text" maxlength="150" placeholder="Воронкова Анна Сергеевна"></label>' +
    '<label class="fld"><span>Категория</span>' +
      '<input id="mCat" type="text" list="catList" maxlength="60" placeholder="например: Депутаты АКЗС">' +
      '<datalist id="catList">' + catOptions + '</datalist>' +
      '<small>Пустая категория сохраняется как «' + NO_CATEGORY + '»</small></label>' +
    '<label class="fld"><span>Место</span>' +
      '<input id="mSeat" type="text" maxlength="60" placeholder="П-1-5 или «Партер, ряд 1, место 5»">' +
      '<small>Оставьте пустым, если место пока не назначено</small></label>' +
    '<div id="mErr" class="form-err" hidden></div>';

  const nameI = api.body.querySelector('#mName');
  const catI = api.body.querySelector('#mCat');
  const seatI = api.body.querySelector('#mSeat');
  const errEl = api.body.querySelector('#mErr');

  if (sp) {
    nameI.value = sp.name;
    catI.value = sp.category === NO_CATEGORY ? '' : sp.category;
    seatI.value = sp.seat ? humanSeat(sp.seat) : '';
  }

  const showErr = (t) => { errEl.textContent = t; errEl.hidden = false; };

  async function save() {
    const name = nameI.value.trim();
    const catRaw = catI.value.trim();
    const seatRaw = seatI.value.trim();

    if (!name) { showErr('Укажите ФИО зрителя.'); return; }

    let code = null;
    if (seatRaw) {
      code = parseSeatText(seatRaw);
      if (!code) {
        showErr('Не удалось распознать место. Примеры: «П-1-5», «Партер, ряд 1, место 5».');
        return;
      }
    }

    const occId = code ? seatIndex.get(code) : null;
    if (occId && occId !== (sp ? sp.id : null)) {
      const occ = specById(occId);
      const ok = await confirmDlg(
        'Место занято',
        '«' + humanSeat(code) + '» уже назначено: ' + occ.name +
        '. Назначить его этому зрителю? ' + occ.name + ' останется без места.',
        { ok: 'Назначить', danger: true }
      );
      if (!ok) return; // остаёмся в окне
      setSeat(occ, null);
      updateSeatEl(code);
    }

    if (sp) {
      if (sp.seat && sp.seat !== code) seatIndex.delete(sp.seat);
      sp.name = name;
      sp.category = catRaw;
      sp.seat = code;
      if (code) seatIndex.set(code, sp.id);
    } else {
      const nsp = { id: nextId(), name: name, category: catRaw, seat: code };
      if (code) seatIndex.set(code, nsp.id);
      state.spectators.push(nsp);
      state.selectedId = nsp.id;
    }

    rebuildCategories();
    markDirty();
    api.onDismiss = null;
    api.close();
    renderAll();
    toast(sp ? 'Зритель обновлён' : 'Зритель добавлен', 'ok');
  }

  const okBtn = document.createElement('button');
  okBtn.type = 'button';
  okBtn.className = 'btn primary';
  okBtn.textContent = 'Сохранить';
  okBtn.addEventListener('click', save);

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'btn';
  cancelBtn.textContent = 'Отмена';
  cancelBtn.addEventListener('click', () => api.close());

  api.foot.append(cancelBtn, okBtn);
  api.body.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); save(); }
  });
  setTimeout(() => nameI.focus(), 60);
}

/* ---------------- Модалка: удаление зрителя ---------------- */

async function deleteSpectator(id) {
  const sp = specById(id);
  if (!sp) return;
  const ok = await confirmDlg(
    'Удалить зрителя',
    'Удалить «' + sp.name + '»? Назначенное место будет освобождено.',
    { ok: 'Удалить', danger: true }
  );
  if (!ok) return;

  if (sp.seat) {
    const code = sp.seat;
    seatIndex.delete(code);
    state.spectators = state.spectators.filter((s) => s.id !== id);
    if (state.selectedId === id) state.selectedId = null;
    rebuildCategories();
    markDirty();
    renderPlan(); renderList(); renderLegend(); updateStatus(); refreshSelRing();
    toast('Зритель удалён: ' + sp.name, 'info');
  } else {
    state.spectators = state.spectators.filter((s) => s.id !== id);
    if (state.selectedId === id) state.selectedId = null;
    rebuildCategories();
    markDirty();
    renderList(); renderLegend(); updateStatus();
    toast('Зритель удалён: ' + sp.name, 'info');
  }
}

/* ---------------- Модалка: вставка списка ---------------- */

function parsePasted(text) {
  const out = [];
  for (let line of text.split(/\r?\n/)) {
    line = line.trim();
    if (!line) continue;
    let parts;
    if (line.indexOf('\t') !== -1) parts = line.split('\t');
    else if (line.indexOf(';') !== -1) parts = line.split(';');
    else if (line.indexOf(',') !== -1) parts = line.split(',');
    else parts = [line];
    parts = parts.map((p) => p.trim());
    const name = parts[0];
    if (!name) continue;
    out.push({ name: name, category: parts[1] || '', seatRaw: parts[2] || '' });
  }
  return out;
}

function applyPasted(items) {
  let n = 0, conflicts = 0, noSeat = 0;
  for (const it of items) {
    const sp = { id: nextId(), name: it.name, category: it.category, seat: null };
    const code = parseSeatText(it.seatRaw);
    if (code) {
      const occId = seatIndex.get(code);
      if (occId) {
        const occ = specById(occId);
        setSeat(occ, null);
        conflicts++;
      }
      seatIndex.set(code, sp.id);
      sp.seat = code;
    } else if (it.seatRaw) {
      noSeat++;
    }
    state.spectators.push(sp);
    n++;
  }
  rebuildCategories();
  markDirty();
  renderAll();
  let msg = 'Добавлено зрителей: ' + n;
  if (conflicts) msg += ' · конфликтов мест: ' + conflicts;
  if (noSeat) msg += ' · мест не распознано: ' + noSeat;
  toast(msg, 'ok', 5000);
}

function openPasteModal() {
  const api = openModal({ title: 'Вставить список зрителей', width: '600px' });
  api.body.innerHTML =
    '<p class="hint">Вставьте строки в формате <b>ФИО, категория, место</b> — по одному зрителю в строке. ' +
    'Разделители: табуляция, точка с запятой или запятая. Категория и место могут быть пустыми.</p>' +
    '<textarea id="pasteText" rows="9" placeholder="Иванова Анна Сергеевна; Спонсоры; П-1-5&#10;Петров Олег Иванович, Пресса, Балкон, ряд 2, место 10&#10;Сидорова Мария (без места)"></textarea>' +
    '<div id="mErr" class="form-err" hidden></div>';

  const ta = api.body.querySelector('#pasteText');
  const errEl = api.body.querySelector('#mErr');

  const clipBtn = document.createElement('button');
  clipBtn.type = 'button';
  clipBtn.className = 'btn';
  clipBtn.textContent = 'Прочитать буфер обмена';
  clipBtn.addEventListener('click', async () => {
    try {
      const t = await navigator.clipboard.readText();
      if (t) ta.value = t;
      toast('Текст из буфера вставлен в поле', 'ok');
    } catch (err) {
      toast('Нет доступа к буферу обмена — вставьте текст вручную (Ctrl+V)', 'warn', 4500);
    }
  });

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'btn';
  cancelBtn.textContent = 'Отмена';
  cancelBtn.addEventListener('click', () => api.close());

  const addBtn = document.createElement('button');
  addBtn.type = 'button';
  addBtn.className = 'btn primary';
  addBtn.textContent = 'Добавить';
  addBtn.addEventListener('click', () => {
    const items = parsePasted(ta.value);
    if (!items.length) {
      errEl.textContent = 'Не найдено ни одной строки со зрителем.';
      errEl.hidden = false;
      return;
    }
    api.onDismiss = null;
    api.close();
    applyPasted(items);
  });

  api.foot.append(clipBtn, cancelBtn, addBtn);
  setTimeout(() => ta.focus(), 60);
}

/* ---------------- Модалка: схема зала ---------------- эта функция не вызывается, ее можно удалить */

function openHallModal() {
  const api = openModal({ title: 'Схема зала', width: '640px' });
  const zs = state.hall.zones;

  api.body.innerHTML =
    '<p class="hint">Измените количество рядов и мест. Значение <b>0</b> убирает проход. ' +
    'Места, вышедшие за пределы новой схемы, будут освобождены.</p>' +
    zs.map((z, i) =>
      '<fieldset class="hallset"><legend>' + esc(z.name) + '</legend>' +
      '<label>Рядов (1–60)<input type="number" min="1" max="60" data-z="' + i + '" data-f="rows" value="' + z.rows + '"></label>' +
      '<label>Мест в ряду (1–80)<input type="number" min="1" max="80" data-z="' + i + '" data-f="seats" value="' + z.seats + '"></label>' +
      '<label>Проход после места (0 — нет)<input type="number" min="0" max="80" data-z="' + i + '" data-f="aisleAfterSeat" value="' + (z.aisleAfterSeat || 0) + '"></label>' +
      '<label>Проход после ряда (0 — нет)<input type="number" min="0" max="60" data-z="' + i + '" data-f="crossAisleAfterRow" value="' + (z.crossAisleAfterRow || 0) + '"></label>' +
      '</fieldset>'
    ).join('');

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'btn';
  cancelBtn.textContent = 'Отмена';
  cancelBtn.addEventListener('click', () => api.close());

  const okBtn = document.createElement('button');
  okBtn.type = 'button';
  okBtn.className = 'btn primary';
  okBtn.textContent = 'Применить';
  okBtn.addEventListener('click', async () => {
    const nh = { zones: zs.map((z) => Object.assign({}, z)) };

    api.body.querySelectorAll('input[type=number]').forEach((inp) => {
      const zi = +inp.dataset.z, f = inp.dataset.f;
      let v = parseInt(inp.value, 10);
      if (isNaN(v)) v = nh.zones[zi][f];
      nh.zones[zi][f] = v;
    });

    for (const z of nh.zones) {
      z.rows = Math.max(1, Math.min(60, z.rows));
      z.seats = Math.max(1, Math.min(80, z.seats));
      z.aisleAfterSeat = (z.aisleAfterSeat > 0 && z.aisleAfterSeat < z.seats) ? z.aisleAfterSeat : 0;
      z.crossAisleAfterRow = (z.crossAisleAfterRow > 0 && z.crossAisleAfterRow < z.rows) ? z.crossAisleAfterRow : 0;
    }

    let lost = 0;
    for (const sp of state.spectators) {
      if (sp.seat && !codeValidIn(sp.seat, nh)) lost++;
    }

    if (lost > 0) {
      const ok = await confirmDlg(
        'Изменение схемы зала',
        'Назначенных мест, выходящих за пределы новой схемы: ' + lost +
        '. Они будут освобождены. Продолжить?',
        { ok: 'Применить', danger: true }
      );
      if (!ok) return;
    }

    state.hall = nh;
    for (const sp of state.spectators) {
      if (sp.seat && !codeValidIn(sp.seat, nh)) sp.seat = null;
    }
    rebuildSeatIndex();
    markDirty();
    api.onDismiss = null;
    api.close();
    renderAll();
    toast(lost ? 'Схема обновлена. Освобождено мест: ' + lost : 'Схема зала обновлена', 'ok');
  });

  api.foot.append(cancelBtn, okBtn);
}

/* ---------------- Excel: импорт ---------------- */

function isHeaderRow(row) {
  if (!row) return false;
  const a = String(row[0] == null ? '' : row[0]).toLowerCase().trim();
  const b = String(row[1] == null ? '' : row[1]).toLowerCase().trim();
  const c = String(row[2] == null ? '' : row[2]).toLowerCase().trim();
  
  /* Ищем ключевые слова заголовков */
  const hasName = a.includes('фио') || a.includes('имя') || a.includes('фамилия') || 
                  a.includes('name') || a.includes('зритель');
  const hasCat = b.includes('категор') || b.includes('category') || b.includes('группа') || 
                 b.includes('тип');
  const hasSeat = c.includes('мест') || c.includes('seat') || c.includes('ряд') || 
                  c.includes('row') || c.includes('располож');
  
  /* Заголовок, если найдено минимум 2 из 3 признаков */
  const score = (hasName ? 1 : 0) + (hasCat ? 1 : 0) + (hasSeat ? 1 : 0);
  return score >= 2;
}

async function cmdLoad() {
  if (typeof XLSX === 'undefined') {
    toast('Библиотека SheetJS не найдена. Поместите файл в vendor/xlsx.full.min.js (см. README).', 'err', 6000);
    return;
  }
  if (state.spectators.length || state.dirty) {
    const ok = await confirmDlg(
      'Загрузить шаблон',
      'Текущий список зрителей и назначенные места будут заменены данными из файла. Продолжить?',
      { ok: 'Загрузить', danger: true }
    );
    if (!ok) return;
  }
  $('#fileInput').click();
}

async function importFile(file) {
  try {
    let buf;
    if (file.arrayBuffer) buf = await file.arrayBuffer();
    else buf = await new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result);
      fr.onerror = rej;
      fr.readAsArrayBuffer(file);
    });

    /* Оборачиваем в Uint8Array и явно указываем кодовую страницу UTF-8 */
    const bytes = new Uint8Array(buf);
    const wb = XLSX.read(bytes, { type: 'array', codepage: 65001 });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    console.log('=== ОТЛАДКА ИМПОРТА ===');
    console.log('Файл:', file.name, '| размер:', file.size, 'байт');
    console.log('Листов в книге:', wb.SheetNames.join(', '));
    console.log('Первый лист:', wb.SheetNames[0]);
    console.log('Всего строк:', rows.length);
    console.log('Строка 0:', JSON.stringify(rows[0]));
    console.log('Строка 1:', JSON.stringify(rows[1]));
    console.log('Заголовок распознан:', isHeaderRow(rows[0]));
    /* Отладка: выводим первые 3 строки файла */
    console.log('Прочитано строк:', rows.length);
    console.log('Первые строки:', rows.slice(0, 3));
    console.log('Заголовок распознан:', isHeaderRow(rows[0]));
    /* Определяем зал из служебного листа «Зал», если он есть */
    const hallSheetName = wb.SheetNames.find(n => n.toLowerCase() === 'зал');
    if (hallSheetName) {
      const hr = XLSX.utils.sheet_to_json(wb.Sheets[hallSheetName], { header: 1, defval: '' });
      if (hr.length >= 2) {
        const hid = String(hr[1][0] == null ? '' : hr[1][0]).trim();
        if (hid && hallById(hid)) {
          state.hallId = hid;
          state.hall = hallTemplate(hid);
          fillHallSelect();
        }
      }
    }
    const specs = [];
    const start = (rows.length && isHeaderRow(rows[0])) ? 1 : 0;
    let seatGiven = 0, seatOk = 0;

    for (let i = start; i < rows.length; i++) {
      const r = rows[i];
      const name = String(r[0] == null ? '' : r[0]).trim();
      if (!name) continue;
      const cat = String(r[1] == null ? '' : r[1]).trim();
      const seatRaw = r[2] == null ? '' : r[2];
      let seat = null;
      if (String(seatRaw).trim()) {
        seatGiven++;
        seat = parseSeatText(seatRaw);
        if (seat) seatOk++;
      }
      specs.push({ id: nextId(), name: name, category: cat, seat: seat });
    }

    state.spectators = specs;
    rebuildSeatIndex();
    rebuildCategories();

    /* Цвета категорий со служебного листа «Категории», если он есть */
    const catSheetName = wb.SheetNames.find((n) => n.toLowerCase() === 'категории');
    if (catSheetName) {
      const cr = XLSX.utils.sheet_to_json(wb.Sheets[catSheetName], { header: 1, defval: '' });
      for (let i = 0; i < cr.length; i++) {
        const nm = String(cr[i][0] == null ? '' : cr[i][0]).trim();
        const col = String(cr[i][1] == null ? '' : cr[i][1]).trim();
        if (!nm || !col || nm.toLowerCase() === 'категория') continue;
        if (/^#?[0-9a-f]{6}$/i.test(col)) {
          const hex = col.charAt(0) === '#' ? col : '#' + col;
          if (state.categories.has(nm)) state.categories.set(nm, hex);
        }
      }
    }

    state.fileName = file.name;
    state.fileHandle = null;
    state.selectedId = null;
    markDirty(false);
    setMode('edit');
    renderAll();

    let msg = 'Загружено зрителей: ' + specs.length;
    if (seatGiven > seatOk) msg += ' · не распознано мест: ' + (seatGiven - seatOk);
    toast(msg, 'ok', 5000);
  } catch (err) {
    console.error(err);
    toast('Не удалось прочитать файл: ' + (err && err.message ? err.message : err), 'err', 6000);
  }
}

/* ---------------- Excel: экспорт и сохранение ---------------- */

function buildWorkbook() {
  const aoa = [['ФИО', 'Категория', 'Ряд и место']];
  for (const sp of state.spectators) {
    aoa.push([sp.name, sp.category, sp.seat ? humanSeat(sp.seat) : '']);
  }
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [{ wch: 42 }, { wch: 22 }, { wch: 30 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Зрители');

  const ca = [['Категория', 'Цвет']];
  for (const [n, c] of state.categories) ca.push([n, c]);
  const ws2 = XLSX.utils.aoa_to_sheet(ca);
  ws2['!cols'] = [{ wch: 30 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, ws2, 'Категории');

  /* Служебный лист «Зал» — какой зал использовался */
  const hallRows = [['id зала', 'Имя зала'], [state.hallId, state.hall.name]];
  const wsHall = XLSX.utils.aoa_to_sheet(hallRows);
  wsHall['!cols'] = [{ wch: 18 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, wsHall, 'Зал');

  return wb;
}

function ensureXlsxName(name) {
  name = (name || '').trim();
  if (!name) name = DEFAULT_FILE_NAME;
  if (!/\.xlsx$/i.test(name)) name += '.xlsx';
  return name;
}

function onSaveSuccess() {
  markDirty(false);
  setMode('view');
  toast('Сохранено: ' + state.fileName, 'ok');
}

async function writeToFileHandle(handle) {
  const data = XLSX.write(buildWorkbook(), { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([data], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  const writable = await handle.createWritable();
  await writable.write(blob);
  await writable.close();
}

async function saveViaPicker(suggestedName) {
  const handle = await window.showSaveFilePicker({
    suggestedName: suggestedName,
    types: [{
      description: 'Книга Excel (.xlsx)',
      accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] }
    }]
  });
  await writeToFileHandle(handle);
  state.fileHandle = handle;
  state.fileName = handle.name;
  onSaveSuccess();
}

async function cmdSave() {
  if (typeof XLSX === 'undefined') {
    toast('Библиотека SheetJS не найдена — экспорт недоступен.', 'err', 6000);
    return;
  }
  /* Уже открытый файл — перезаписываем */
  if (state.fileHandle) {
    try {
      await writeToFileHandle(state.fileHandle);
      onSaveSuccess();
    } catch (err) {
      if (!err || err.name !== 'AbortError') toast('Ошибка сохранения: ' + (err && err.message), 'err');
    }
    return;
  }
  if ('showSaveFilePicker' in window) {
    try {
      await saveViaPicker(state.fileName);
    } catch (err) {
      if (!err || err.name !== 'AbortError') toast('Ошибка сохранения: ' + (err && err.message), 'err');
      /* отмена — остаёмся в режиме редактирования */
    }
    return;
  }
  /* Фолбэк: скачивание */
  try {
    XLSX.writeFile(buildWorkbook(), state.fileName);
    onSaveSuccess();
  } catch (err) {
    toast('Ошибка сохранения: ' + (err && err.message), 'err');
  }
}

async function cmdSaveAs() {
  if (typeof XLSX === 'undefined') {
    toast('Библиотека SheetJS не найдена — экспорт недоступен.', 'err', 6000);
    return;
  }
  if ('showSaveFilePicker' in window) {
    try {
      await saveViaPicker(state.fileName);
    } catch (err) {
      if (!err || err.name !== 'AbortError') toast('Ошибка сохранения: ' + (err && err.message), 'err');
    }
    return;
  }
  /* Фолбэк: спросить имя и скачать */
  const api = openModal({ title: 'Сохранить как', width: '440px' });
  api.body.innerHTML =
    '<label class="fld"><span>Имя файла</span>' +
    '<input id="saName" type="text" value="' + esc(state.fileName) + '"></label>';
  const inp = api.body.querySelector('#saName');

  const doSave = () => {
    const name = ensureXlsxName(inp.value);
    try {
    XLSX.writeFile(buildWorkbook(), name);
      state.fileName = name;
      api.onDismiss = null;
      api.close();
      onSaveSuccess();
    } catch (err) {
      toast('Ошибка сохранения: ' + (err && err.message), 'err');
    }
  };

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'btn';
  cancelBtn.textContent = 'Отмена';
  cancelBtn.addEventListener('click', () => api.close());

  const okBtn = document.createElement('button');
  okBtn.type = 'button';
  okBtn.className = 'btn primary';
  okBtn.textContent = 'Сохранить';
  okBtn.addEventListener('click', doSave);

  api.foot.append(cancelBtn, okBtn);
  api.body.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); doSave(); }
  });
  setTimeout(() => { inp.focus(); inp.select(); }, 60);
}

/* ---------------- Команды меню ---------------- */

async function cmdNew() {
  if (state.spectators.length || state.dirty) {
    const ok = await confirmDlg(
      'Новый шаблон',
      'Список зрителей и все назначенные места будут очищены. Продолжить?',
      { ok: 'Очистить', danger: true }
    );
    if (!ok) return;
  }
  state.spectators = [];
  state.categories = new Map();
  seatIndex.clear();
  state.selectedId = null;
  state.fileHandle = null;
  state.fileName = DEFAULT_FILE_NAME;
  markDirty(false);
  renderAll();
  toast('Создан новый шаблон', 'ok');
}

async function cmdClearSeats() {
  if (!state.spectators.length) {
    toast('Список зрителей пуст', 'info');
    return;
  }
  const assigned = state.spectators.filter((s) => s.seat).length;
  if (!assigned) {
    toast('Назначенных мест нет', 'info');
    return;
  }
  const ok = await confirmDlg(
    'Очистить рассадку',
    'Все назначенные места (' + assigned + ') будут освобождены. Список зрителей сохранится. Продолжить?',
    { ok: 'Очистить', danger: true }
  );
  if (!ok) return;
  for (const sp of state.spectators) sp.seat = null;
  seatIndex.clear();
  markDirty();
  refreshAllSeats();
  renderList();
  refreshSelRing();
  updateStatus();
  toast('Рассадка очищена', 'ok');
}

function cmdPrint() {
  window.print();
}

/* ---------------- События плана ---------------- */

function wirePlanEvents() {
  const plan = $('#plan');
  const scroller = $('#planScroll');

  plan.addEventListener('click', (e) => {
    const seatEl = e.target.closest('.seat');
    if (seatEl) {
      handleSeatClick(seatEl.dataset.code);
    } else if (state.mode === 'edit') {
      selectSpectator(null);
    }
  });

  scroller.addEventListener('mousemove', (e) => {
    const seatEl = e.target.closest && e.target.closest('.seat');
    if (seatEl) showTooltip(seatEl.dataset.code, e.clientX, e.clientY);
    else hideTooltip();
  });
  scroller.addEventListener('mouseleave', hideTooltip);
}

/* ---------------- События списка ---------------- */

function wireSidebar() {
  $('#search').addEventListener('input', renderList);
  $('#onlyUnassigned').addEventListener('change', renderList);
  $('#btnAdd').addEventListener('click', () => openSpectatorModal(null));
  $('#btnPaste').addEventListener('click', openPasteModal);

  $('#specList').addEventListener('click', (e) => {
    const li = e.target.closest('.spec');
    if (!li) return;
    const id = +li.dataset.id;
    if (e.target.closest('.del')) { deleteSpectator(id); return; }
    if (e.target.closest('.edit')) { openSpectatorModal(id); return; }
    selectSpectator(state.selectedId === id ? null : id);
  });
}

/* ---------------- События меню ---------------- */

function wireToolbar() {
  $('#btnNew').addEventListener('click', cmdNew);
  $('#btnLoad').addEventListener('click', cmdLoad);
  $('#btnSave').addEventListener('click', cmdSave);
  $('#btnSaveAs').addEventListener('click', cmdSaveAs);
  $('#btnPrint').addEventListener('click', cmdPrint);
  $('#btnClearSeats').addEventListener('click', cmdClearSeats);
  $('#hallSelect').addEventListener('change', onHallChange);
  $('#btnMode').addEventListener('click', () => setMode(state.mode === 'edit' ? 'view' : 'edit'));

  $('#fileInput').addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (f) importFile(f);
  });
}

/* ---------------- Глобальные события ---------------- */

function wireKeys() {
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modalStack.length) selectSpectator(null);
  });
}

function wirePrintEvents() {
  window.addEventListener('beforeprint', () => {
    $('#printDate').textContent =
      state.hall.name + ' · ' +
      new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }) +
      ' · ' + state.fileName;
  });
  window.addEventListener('afterprint', () => {
    if (state.mode === 'edit') setMode('view');
  });
}

window.addEventListener('beforeunload', (e) => {
  if (state.dirty) {
    e.preventDefault();
    e.returnValue = '';
  }
});

window.addEventListener('resize', debounce(fitPlan, 120));

/* ---------------- Запуск ---------------- */

function init() {
  fillHallSelect();
  wireToolbar();
  wireSidebar();
  wirePlanEvents();
  wireKeys();
  wirePrintEvents();
  renderAll();
  setMode('edit');
  if (typeof XLSX === 'undefined') {
    toast('Файл vendor/xlsx.full.min.js не найден — импорт и экспорт Excel недоступны. Подробности в README.', 'err', 8000);
  }
  setTimeout(fitPlan, 60);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}