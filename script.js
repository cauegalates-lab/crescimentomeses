const monthNames = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const API_URL = 'https://script.google.com/macros/s/AKfycbzVQVL3t8UjhSVHGX-P-uetEQezoVEfjQaC0c8qTHBYF-OQz_uFNjwcNGt5S7aMOHHA/exec';
const USE_GOOGLE_SHEETS = true;
const API_TIMEOUT = 12000;

const now = new Date();
const currentYear = now.getFullYear();
const currentMonthIndex = now.getMonth();
const currentDay = now.getDate();

const defaultFirstMonth = 5;
const defaultSecondMonth = currentMonthIndex;

const storageKey = 'painel-crescimento-mensal-v1';
const selectors = {
  mainScreen: document.getElementById('mainScreen'),
  weeklyScreen: document.getElementById('weeklyScreen'),
  openWeeklyView: document.getElementById('openWeeklyView'),
  closeWeeklyView: document.getElementById('closeWeeklyView'),
  currentDayLabel: document.getElementById('currentDayLabel'),
  currentDateLabel: document.getElementById('currentDateLabel'),
  monthSelectA: document.getElementById('monthSelectA'),
  monthSelectB: document.getElementById('monthSelectB'),
  titleMonthA: document.getElementById('titleMonthA'),
  titleMonthB: document.getElementById('titleMonthB'),
  rowsMonthA: document.getElementById('rowsMonthA'),
  rowsMonthB: document.getElementById('rowsMonthB'),
  rowsGrowth: document.getElementById('rowsGrowth'),
  summaryLabelA: document.getElementById('summaryLabelA'),
  summaryLabelB: document.getElementById('summaryLabelB'),
  summaryTotalA: document.getElementById('summaryTotalA'),
  summaryTotalB: document.getElementById('summaryTotalB'),
  summaryGrowthPercent: document.getElementById('summaryGrowthPercent'),
  summaryGrowthMoney: document.getElementById('summaryGrowthMoney'),
  weeklyPeriodLabel: document.getElementById('weeklyPeriodLabel'),
  weeklyTotal: document.getElementById('weeklyTotal'),
  weekCards: document.getElementById('weekCards'),
  footerTotalA: document.getElementById('footerTotalA'),
  footerTotalB: document.getElementById('footerTotalB'),
  footerGrowth: document.getElementById('footerGrowth')
};

const fallbackData = createFallbackData();
let faturamento = loadData();
let selectedA = defaultFirstMonth;
let selectedB = defaultSecondMonth;
let sheetData = null;
let isLoadingSheetData = false;
let lastLoadId = 0;

init();

function init() {
  selectors.currentDayLabel.textContent = `1 a ${currentDay}`;
  selectors.currentDateLabel.textContent = now.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });

  fillMonthOptions(selectors.monthSelectA, selectedA);
  fillMonthOptions(selectors.monthSelectB, selectedB);

  selectors.monthSelectA.addEventListener('change', () => {
    selectedA = Number(selectors.monthSelectA.value);
    refreshData();
  });

  selectors.monthSelectB.addEventListener('change', () => {
    selectedB = Number(selectors.monthSelectB.value);
    refreshData();
  });

  selectors.openWeeklyView.addEventListener('click', openWeeklyScreen);
  selectors.closeWeeklyView.addEventListener('click', closeWeeklyScreen);

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && document.body.classList.contains('week-view')) {
      closeWeeklyScreen();
    }
  });

  refreshData();
}

function openWeeklyScreen() {
  selectors.weeklyScreen.hidden = false;
  document.body.classList.add('week-view');
  selectors.closeWeeklyView.focus({ preventScroll: true });
}

function closeWeeklyScreen() {
  document.body.classList.remove('week-view');
  selectors.weeklyScreen.hidden = true;
  selectors.openWeeklyView.focus({ preventScroll: true });
}

function refreshData() {
  if (!USE_GOOGLE_SHEETS) {
    sheetData = null;
    render();
    return;
  }

  const loadId = ++lastLoadId;
  isLoadingSheetData = true;
  sheetData = null;
  renderLoading();

  loadGoogleSheetsData()
    .then((data) => {
      if (loadId !== lastLoadId) return;
      sheetData = normalizeSheetData(data);
      mergeSheetDataIntoLocalCache(sheetData);
    })
    .catch((error) => {
      if (loadId !== lastLoadId) return;
      sheetData = null;
      console.warn('Não foi possível carregar os dados do Google Sheets. Usando dados locais.', error);
    })
    .finally(() => {
      if (loadId !== lastLoadId) return;
      isLoadingSheetData = false;
      render();
    });
}

function loadGoogleSheetsData() {
  return new Promise((resolve, reject) => {
    const callbackName = `receberDadosPainel_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement('script');
    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error('Tempo limite ao carregar dados da planilha.'));
    }, API_TIMEOUT);

    function cleanup() {
      window.clearTimeout(timer);
      delete window[callbackName];
      if (script.parentNode) script.parentNode.removeChild(script);
    }

    window[callbackName] = (data) => {
      cleanup();
      resolve(data);
    };

    const params = new URLSearchParams({
      mesBase: String(selectedA + 1),
      anoBase: String(currentYear),
      abaAtual: monthNames[selectedB],
      callback: callbackName,
      _: String(Date.now())
    });

    script.onerror = () => {
      cleanup();
      reject(new Error('Erro ao carregar o Apps Script.'));
    };

    script.src = `${API_URL}?${params.toString()}`;
    document.body.appendChild(script);
  });
}

function normalizeSheetData(data) {
  const safeData = data && typeof data === 'object' ? data : {};
  const dias = Array.isArray(safeData.dias) ? safeData.dias : [];

  return {
    base: safeData.base || {},
    atual: safeData.atual || {},
    crescimentoTotal: safeData.crescimentoTotal || {},
    dias: dias.map((item) => ({
      dia: Number(item.dia) || 0,
      base: Number(item.base) || 0,
      atual: Number(item.atual) || 0,
      diferenca: Number(item.diferenca) || 0,
      crescimento: item.crescimento === null ? null : Number(item.crescimento) || 0
    })).filter((item) => item.dia > 0)
  };
}

function mergeSheetDataIntoLocalCache(data) {
  if (!data || !data.dias.length) return;

  if (!faturamento[selectedA]) faturamento[selectedA] = {};
  if (!faturamento[selectedB]) faturamento[selectedB] = {};

  data.dias.forEach((item) => {
    faturamento[selectedA][item.dia] = item.base;
    faturamento[selectedB][item.dia] = item.atual;
  });
}

function renderLoading() {
  const mesA = monthNames[selectedA];
  const mesB = monthNames[selectedB];

  selectors.titleMonthA.textContent = mesA;
  selectors.titleMonthB.textContent = mesB;
  selectors.summaryLabelA.textContent = mesA;
  selectors.summaryLabelB.textContent = mesB;
  selectors.summaryTotalA.textContent = 'Carregando...';
  selectors.summaryTotalB.textContent = 'Carregando...';
  selectors.summaryGrowthPercent.textContent = '...';
  selectors.summaryGrowthMoney.textContent = 'Buscando na planilha';
  selectors.footerTotalA.textContent = '...';
  selectors.footerTotalB.textContent = '...';
  selectors.footerGrowth.textContent = '...';
  selectors.weeklyPeriodLabel.textContent = 'Buscando dados da semana';
  selectors.weeklyTotal.textContent = '...';
  selectors.weekCards.innerHTML = '<div class="week-loading">Carregando fechamento semanal...</div>';

  selectors.rowsMonthA.innerHTML = '<div class="loading-row">Carregando dados da aba Vendas...</div>';
  selectors.rowsMonthB.innerHTML = `<div class="loading-row">Carregando dados da aba ${mesB}...</div>`;
  selectors.rowsGrowth.innerHTML = '<div class="loading-row">Calculando crescimento...</div>';
}

function createFallbackData() {
  const data = {};

  monthNames.forEach((_, monthIndex) => {
    data[monthIndex] = {};
    const days = getDaysToShow(monthIndex);

    for (let day = 1; day <= days; day++) {
      data[monthIndex][day] = '';
    }
  });

  return data;
}

function loadData() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    return saved && typeof saved === 'object' ? saved : fallbackData;
  } catch (error) {
    return fallbackData;
  }
}

function saveData() {
  localStorage.setItem(storageKey, JSON.stringify(faturamento));
}

function fillMonthOptions(select, selectedMonth) {
  select.innerHTML = '';

  monthNames.forEach((month, index) => {
    const option = document.createElement('option');
    option.value = index;
    option.textContent = month;
    option.selected = index === selectedMonth;
    select.appendChild(option);
  });
}

function render() {
  if (isLoadingSheetData) return;

  const days = getDaysForRender(selectedA, selectedB);
  const titleA = sheetData?.base?.mes || monthNames[selectedA];
  const titleB = sheetData?.atual?.mes || monthNames[selectedB];

  selectors.titleMonthA.textContent = titleA;
  selectors.titleMonthB.textContent = titleB;
  selectors.summaryLabelA.textContent = titleA;
  selectors.summaryLabelB.textContent = titleB;

  renderMonthRows('a', selectedA, days, selectors.rowsMonthA);
  renderMonthRows('b', selectedB, days, selectors.rowsMonthB);
  renderGrowthRows(days);
  renderWeekCards();
  renderTotals(days);
}

function renderMonthRows(column, monthIndex, days, target) {
  target.innerHTML = '';

  for (let day = 1; day <= days; day++) {
    ensureDay(monthIndex, day);

    const row = document.createElement('div');
    row.className = 'data-row two-cols';

    const badge = document.createElement('span');
    badge.className = 'day-badge';
    badge.textContent = day;

    const input = document.createElement('input');
    input.className = 'money-input';
    input.type = 'text';
    input.inputMode = 'decimal';
    input.placeholder = 'R$ 0,00';
    input.value = formatInputValue(getValue(monthIndex, day));
    input.dataset.column = column;
    input.dataset.month = monthIndex;
    input.dataset.day = day;
    input.readOnly = Boolean(sheetData);

    if (sheetData) {
      input.classList.add('is-readonly');
    } else {
      input.addEventListener('focus', () => {
        input.value = cleanNumberForEditing(getValue(monthIndex, day));
        input.select();
      });

      input.addEventListener('blur', () => {
        const value = parseMoney(input.value);
        setValue(monthIndex, day, value);
        input.value = formatInputValue(value);
        renderGrowthRows(days);
        renderTotals(days);
      });

      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          input.blur();
        }
      });
    }

    row.append(badge, input);
    target.appendChild(row);
  }
}

function renderGrowthRows(days) {
  selectors.rowsGrowth.innerHTML = '';

  for (let day = 1; day <= days; day++) {
    const firstValue = getValue(selectedA, day);
    const secondValue = getValue(selectedB, day);
    const difference = secondValue - firstValue;
    const percent = calculateGrowth(firstValue, secondValue);
    const status = getStatusClass(difference, percent);

    const row = document.createElement('div');
    row.className = 'growth-row growth-cols';

    const badge = document.createElement('span');
    badge.className = 'day-badge';
    badge.textContent = day;

    const money = document.createElement('span');
    money.className = `growth-money ${status}`;
    money.textContent = formatCurrency(difference);

    const percentElement = document.createElement('span');
    percentElement.className = `growth-percent ${status}`;
    percentElement.textContent = formatPercent(percent, firstValue, secondValue);

    row.append(badge, money, percentElement);
    selectors.rowsGrowth.appendChild(row);
  }
}


function renderWeekCards() {
  const weekDates = getCurrentWeekDates();
  const currentMonthName = sheetData?.atual?.mes || monthNames[selectedB];
  let weeklyTotalValue = 0;

  selectors.weekCards.innerHTML = '';
  selectors.weeklyPeriodLabel.textContent = `${formatShortDate(weekDates[0])} até ${formatShortDate(weekDates[weekDates.length - 1])} • ${currentMonthName}`;

  weekDates.forEach((date, index) => {
    const isSelectedMonth = date.getMonth() === selectedB;
    const day = date.getDate();
    const value = isSelectedMonth ? getValue(selectedB, day) : 0;
    const isToday = isSameDate(date, now);
    const isFuture = date > startOfDay(now);

    weeklyTotalValue += value;

    const card = document.createElement('article');
    card.className = `week-card week-tone-${index + 1}`;

    if (isToday) card.classList.add('is-today');
    if (isFuture) card.classList.add('is-future');
    if (!isSelectedMonth) card.classList.add('is-outside-month');

    const icon = document.createElement('div');
    icon.className = 'week-card-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.innerHTML = getWeekIconSvg();

    const weekday = document.createElement('h3');
    weekday.textContent = getWeekdayName(date);

    const divider = document.createElement('div');
    divider.className = 'week-card-line';

    const label = document.createElement('span');
    label.className = 'week-card-label';
    label.textContent = isSelectedMonth ? 'Fechamento' : 'Fora do mês';

    const total = document.createElement('strong');
    total.textContent = isSelectedMonth ? formatCurrency(value) : '—';

    const dateLabel = document.createElement('small');
    dateLabel.textContent = isToday ? `${formatShortDate(date)} • Hoje` : formatShortDate(date);

    card.append(icon, weekday, divider, label, total, dateLabel);
    selectors.weekCards.appendChild(card);
  });

  selectors.weeklyTotal.textContent = formatCurrency(weeklyTotalValue);
}

function getCurrentWeekDates() {
  const today = startOfDay(now);
  const dayOfWeek = today.getDay();
  const distanceFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const monday = new Date(today);
  monday.setDate(today.getDate() - distanceFromMonday);

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    return date;
  });
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isSameDate(firstDate, secondDate) {
  return firstDate.getFullYear() === secondDate.getFullYear()
    && firstDate.getMonth() === secondDate.getMonth()
    && firstDate.getDate() === secondDate.getDate();
}

function getWeekdayName(date) {
  return date.toLocaleDateString('pt-BR', { weekday: 'long' }).replace('-feira', '');
}

function formatShortDate(date) {
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit'
  });
}

function getWeekIconSvg() {
  return `
    <svg viewBox="0 0 24 24" focusable="false">
      <path d="M7 2a1 1 0 0 1 1 1v1h8V3a1 1 0 1 1 2 0v1h1.2A2.8 2.8 0 0 1 22 6.8v11.4a2.8 2.8 0 0 1-2.8 2.8H4.8A2.8 2.8 0 0 1 2 18.2V6.8A2.8 2.8 0 0 1 4.8 4H6V3a1 1 0 0 1 1-1Zm12.5 8.5h-15v7.7c0 .72.58 1.3 1.3 1.3h12.4c.72 0 1.3-.58 1.3-1.3v-7.7ZM7 13a1 1 0 1 1 0 2 1 1 0 0 1 0-2Zm5 0a1 1 0 1 1 0 2 1 1 0 0 1 0-2Zm5 0a1 1 0 1 1 0 2 1 1 0 0 1 0-2ZM7 16.5a1 1 0 1 1 0 2 1 1 0 0 1 0-2Zm5 0a1 1 0 1 1 0 2 1 1 0 0 1 0-2Zm5 0a1 1 0 1 1 0 2 1 1 0 0 1 0-2ZM18.2 5.5H5.8c-.72 0-1.3.58-1.3 1.3V9h15V6.8c0-.72-.58-1.3-1.3-1.3Z" />
    </svg>
  `;
}

function renderTotals(days) {
  const totalA = sheetData?.base?.total !== undefined ? Number(sheetData.base.total) || 0 : getMonthTotal(selectedA, days);
  const totalB = sheetData?.atual?.total !== undefined ? Number(sheetData.atual.total) || 0 : getMonthTotal(selectedB, days);
  const diff = totalB - totalA;
  const growth = calculateGrowth(totalA, totalB);
  const status = getStatusClass(diff, growth);

  selectors.summaryTotalA.textContent = formatCurrency(totalA);
  selectors.summaryTotalB.textContent = formatCurrency(totalB);
  selectors.footerTotalA.textContent = formatCurrency(totalA);
  selectors.footerTotalB.textContent = formatCurrency(totalB);

  selectors.summaryGrowthPercent.className = status;
  selectors.summaryGrowthPercent.textContent = formatPercent(growth, totalA, totalB);
  selectors.summaryGrowthMoney.textContent = formatCurrency(diff);
  selectors.summaryGrowthMoney.className = status;
  selectors.footerGrowth.className = status;
  selectors.footerGrowth.textContent = `${formatPercent(growth, totalA, totalB)} | ${formatCurrency(diff)}`;
}

function getDaysToShow(monthIndex) {
  const lastDayOfMonth = new Date(currentYear, monthIndex + 1, 0).getDate();
  return Math.min(currentDay, lastDayOfMonth);
}

function getDaysForRender(monthA, monthB) {
  if (sheetData?.dias?.length) {
    return Math.max(...sheetData.dias.map((item) => item.dia));
  }

  return Math.min(getDaysToShow(monthA), getDaysToShow(monthB));
}

function ensureDay(monthIndex, day) {
  if (!faturamento[monthIndex]) faturamento[monthIndex] = {};
  if (faturamento[monthIndex][day] === undefined) faturamento[monthIndex][day] = '';
}

function getSheetDay(day) {
  return sheetData?.dias?.find((item) => item.dia === day) || null;
}

function getValue(monthIndex, day) {
  const sheetDay = getSheetDay(day);

  if (sheetDay) {
    if (monthIndex === selectedA) return sheetDay.base;
    if (monthIndex === selectedB) return sheetDay.atual;
  }

  ensureDay(monthIndex, day);
  return Number(faturamento[monthIndex][day]) || 0;
}

function setValue(monthIndex, day, value) {
  ensureDay(monthIndex, day);
  faturamento[monthIndex][day] = Number(value) || 0;
  saveData();
}

function getMonthTotal(monthIndex, days) {
  let total = 0;
  for (let day = 1; day <= days; day++) {
    total += getValue(monthIndex, day);
  }
  return total;
}

function calculateGrowth(baseValue, currentValue) {
  if (baseValue === 0 && currentValue === 0) return 0;
  if (baseValue === 0 && currentValue > 0) return null;
  return ((currentValue - baseValue) / baseValue) * 100;
}

function getStatusClass(difference, percent) {
  if (percent === null || difference > 0) return 'positive';
  if (difference < 0) return 'negative';
  return 'neutral';
}

function formatPercent(percent, baseValue, currentValue) {
  if (percent === null) return currentValue > 0 && baseValue === 0 ? '+100%' : '0%';

  const signal = percent > 0 ? '+' : '';
  return `${signal}${percent.toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  })}%`;
}

function formatCurrency(value) {
  const signal = value < 0 ? '-' : '';
  const absoluteValue = Math.abs(value);

  return `${signal}${absoluteValue.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  })}`;
}

function parseMoney(value) {
  if (!value) return 0;

  const normalized = String(value)
    .replace(/R\$/g, '')
    .replace(/\s/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
    .replace(/[^0-9.-]/g, '');

  return Number(normalized) || 0;
}

function formatInputValue(value) {
  return value ? formatCurrency(Number(value)) : '';
}

function cleanNumberForEditing(value) {
  const numberValue = Number(value) || 0;
  if (!numberValue) return '';
  return numberValue.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}
