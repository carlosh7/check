const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
let currentYear, currentMonth;

async function loadCalendar(year, month) {
  currentYear = year; currentMonth = month;
  document.getElementById('cal-month-label').textContent = MONTHS[month-1] + ' ' + year;
  const res = await fetch('/api/events/calendar/data?year=' + year + '&month=' + month, { headers: { 'x-user-id': localStorage.getItem('user_id') || '' } });
  const data = await res.json();
  renderCalendar(year, month, data.events || []);
  updateStats(data.events || []);
}

function renderCalendar(year, month, events) {
  const grid = document.getElementById('cal-grid');
  grid.innerHTML = '<div class="weekday">Dom</div><div class="weekday">Lun</div><div class="weekday">Mar</div><div class="weekday">Mie</div><div class="weekday">Jue</div><div class="weekday">Vie</div><div class="weekday">Sab</div>';
  const firstDay = new Date(year, month-1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const daysInPrev = new Date(year, month-1, 0).getDate();
  const today = new Date();

  for (let i = firstDay - 1; i >= 0; i--) {
    grid.innerHTML += '<div class="cal-day other-month"><div class="day-num">' + (daysInPrev - i) + '</div></div>';
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = year + '-' + String(month).padStart(2,'0') + '-' + String(d).padStart(2,'0');
    const dayEvents = events.filter(e => {
      const eDate = (e.date || '').split('T')[0];
      const eEnd = (e.end_date || e.date || '').split('T')[0];
      return eDate <= dateStr && eEnd >= dateStr;
    });
    const isToday = today.getFullYear() === year && today.getMonth() === month-1 && today.getDate() === d;
    grid.innerHTML += '<div class="cal-day ' + (isToday ? 'today' : '') + '" data-date="' + dateStr + '"><div class="day-num">' + d + '</div>' +
      dayEvents.map(e => '<div class="event-chip" data-act="goto" data-a1="' + e.id + '">' + e.name + ' <span class="count">(' + (e.checked_in_count || 0) + '/' + (e.guest_count || 0) + ')</span></div>').join('') + '</div>';
  }
  const remaining = 7 - ((firstDay + daysInMonth) % 7);
  if (remaining < 7) {
    for (let i = 1; i <= (remaining === 7 ? 0 : remaining); i++) {
      grid.innerHTML += '<div class="cal-day other-month"><div class="day-num">' + i + '</div></div>';
    }
  }
}

function updateStats(events) {
  const total = events.length;
  const totalGuests = events.reduce((s, e) => s + (e.guest_count || 0), 0);
  const totalChecked = events.reduce((s, e) => s + (e.checked_in_count || 0), 0);
  document.getElementById('cal-stats').innerHTML = '<span>📅 ' + total + ' eventos</span><span>👥 ' + totalGuests + ' invitados</span><span>✅ ' + totalChecked + ' check-ins</span>';
}

function prevMonth() {
  let m = currentMonth - 1, y = currentYear;
  if (m < 1) { m = 12; y--; }
  loadCalendar(y, m);
}

function nextMonth() {
  let m = currentMonth + 1, y = currentYear;
  if (m > 12) { m = 1; y++; }
  loadCalendar(y, m);
}

const now = new Date();
loadCalendar(now.getFullYear(), now.getMonth() + 1);
