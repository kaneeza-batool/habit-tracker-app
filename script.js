
const STORAGE_KEY = "habitTrackerData";
const STORAGE_VERSION = 1;

let habits = [];
let logs = {};
let currentDate = new Date();
let currentView = "tracker";
let modalHabitId = null;
let modalDate = null;
let selectedMood = null;

const CAT_COLORS = {
    health: "#3d5a45",
    mind: "#6b4c7a",
    body: "#b55e34",
    social: "#3a6a8a",
    creative: "#a0445a",
    work: "#c89a2e",
    none: "#a89b8e",
};
const CAT_LABELS = {
    health: "Health",
    mind: "Mind",
    body: "Body",
    social: "Social",
    creative: "Creative",
    work: "Work",
    none: "No category",
};

function loadData() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const data = JSON.parse(raw);
        if (data.version === STORAGE_VERSION) {
            habits = data.habits || [];
            logs = data.logs || {};
        }
    } catch (err) {
        console.error("Storage load failed", err);
    }
}

function save() {
    localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ version: STORAGE_VERSION, habits, logs }),
    );
}

function showToast(msg) {
    const toast = document.getElementById("toast");
    toast.textContent = msg;
    toast.classList.add("show");
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove("show"), 2200);
}

function fmt(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function today() {
    return fmt(new Date());
}

function getMonday(date) {
    const d = new Date(date);
    const day = d.getDay();
    d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
    return d;
}

function weekDays() {
    const start = getMonday(currentDate);
    return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        return d;
    });
}

function weekLabel(days) {
    const s = days[0],
        e = days[6];
    const mo = (d) => d.toLocaleDateString("en", { month: "short" });
    if (s.getMonth() === e.getMonth())
        return `${mo(s)} ${s.getDate()}–${e.getDate()}, ${e.getFullYear()}`;
    return `${mo(s)} ${s.getDate()} – ${mo(e)} ${e.getDate()}, ${e.getFullYear()}`;
}

function isFutureDate(dateStr) {
    return (
        new Date(dateStr + "T00:00:00") > new Date(today() + "T00:00:00")
    );
}

function streak(habit) {
    let count = 0,
        cur = new Date();
    while (habit.completed[fmt(cur)]) {
        count++;
        cur.setDate(cur.getDate() - 1);
    }
    return count;
}

function bestStreak(habit) {
    const keys = Object.keys(habit.completed).sort();
    if (!keys.length) return 0;
    let best = 1,
        run = 1;
    for (let i = 1; i < keys.length; i++) {
        const diff = (new Date(keys[i]) - new Date(keys[i - 1])) / 86400000;
        run = diff === 1 ? run + 1 : 1;
        if (run > best) best = run;
    }
    return best;
}

function renderSidebar() {
    const todayKey = today();
    document.getElementById("statTotal").textContent = habits.length;
    document.getElementById("statToday").textContent = habits.filter(
        (h) => h.completed[todayKey],
    ).length;
    document.getElementById("statBestStreak").textContent = habits.length
        ? Math.max(...habits.map(bestStreak))
        : 0;
    renderWeeklyRing();
    renderLegend();
}

function renderWeeklyRing() {
    const days = weekDays();
    const totalCells = habits.length * 7;
    const doneCells = habits.reduce(
        (acc, h) => acc + days.filter((d) => h.completed[fmt(d)]).length,
        0,
    );
    const pct = totalCells ? Math.round((doneCells / totalCells) * 100) : 0;
    const circ = 2 * Math.PI * 32;
    document
        .getElementById("ringFg")
        .setAttribute("stroke-dasharray", `${(pct / 100) * circ} ${circ}`);
    document.getElementById("ringPct").textContent = pct + "%";
    document.getElementById("ringSub").textContent =
        `${doneCells} of ${totalCells} completed`;
}

function renderLegend() {
    const used = [...new Set(habits.map((h) => h.category || "none"))];
    document.getElementById("catLegend").innerHTML = used
        .map(
            (c) =>
                `<div class="cat-dot-row"><span class="cat-dot" style="background:${CAT_COLORS[c]}"></span><span>${CAT_LABELS[c]}</span></div>`,
        )
        .join("");
}

function renderTracker() {
    const head = document.getElementById("tableHead");
    const body = document.getElementById("tableBody");
    const empty = document.getElementById("emptyState");
    const days = weekDays();
    const todayKey = today();

    document.getElementById("weekLabel").textContent = weekLabel(days);

    if (!habits.length) {
        head.innerHTML = "";
        body.innerHTML = "";
        empty.classList.remove("hidden");
        return;
    }
    empty.classList.add("hidden");

    let headHtml = `<tr><th class="habit-col">Habit</th><th>Streak</th>`;
    days.forEach((d) => {
        const key = fmt(d);
        const isToday = key === todayKey;
        headHtml += `<th class="${isToday ? "today-col" : ""}">${d.toLocaleDateString("en", { weekday: "short" })}<br><span style="font-size:12px;font-weight:400">${d.getDate()}</span></th>`;
    });
    headHtml += `<th>Log</th><th>Actions</th></tr>`;
    head.innerHTML = headHtml;

    body.innerHTML = "";
    habits.forEach((h) => {
        const tr = document.createElement("tr");
        const cat = h.category || "none";
        const s = streak(h);

        let html = `<td class="habit-col-td"><div class="habit-name-wrap"><span class="cat-pip" style="background:${CAT_COLORS[cat]}"></span><span class="habit-name-text" title="${h.name}">${h.name}</span></div></td>`;
        html += `<td class="streak-cell">${s ? "🔥 " + s : "—"}</td>`;

        days.forEach((d) => {
            const key = fmt(d);
            const checked = !!h.completed[key];
            const future = isFutureDate(key);
            const isToday = key === todayKey;
            const log = logs[h.id]?.[key];
            const hasNote = log && (log.note || log.mood);

            html += `<td class="${isToday ? "today-cell" : ""}"><div class="check${checked ? " checked" : ""}${future ? " disabled" : ""}${hasNote && checked ? " has-note" : ""}" role="checkbox" aria-checked="${checked}" aria-disabled="${future}" tabindex="${future ? -1 : 0}" data-id="${h.id}" data-date="${key}">${checked ? "✓" : ""}</div></td>`;
        });

        html += `<td><button class="act-btn" data-log="${h.id}">✎</button></td>`;
        html += `<td><div class="actions"><button class="act-btn" data-rename="${h.id}">Rename</button><button class="act-btn del" data-delete="${h.id}">Delete</button></div></td>`;
        tr.innerHTML = html;
        body.appendChild(tr);
    });
}

function renderAnalytics() {
    const grid = document.getElementById("analyticsGrid");
    if (!habits.length) {
        grid.innerHTML = `<div class="an-card" style="grid-column:1/-1"><p style="color:var(--ink3)">Add habits to see analytics.</p></div>`;
        return;
    }

    const last30 = Array.from({ length: 30 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (29 - i));
        return fmt(d);
    });

    let completion = `<div class="an-card"><div class="an-card-title">30-day completion</div>`;
    habits.forEach((h) => {
        const done = last30.filter((k) => h.completed[k]).length;
        const pct = Math.round((done / 30) * 100);
        const cat = h.category || "none";
        completion += `<div class="an-habit-row"><span class="an-habit-name">${h.name}</span><div class="an-bar-wrap"><div class="an-bar" style="width:${pct}%;background:${CAT_COLORS[cat]}"></div></div><span class="an-pct">${pct}%</span></div>`;
    });
    completion += `</div>`;

    const champ = [...habits].sort(
        (a, b) =>
            Object.keys(b.completed).length - Object.keys(a.completed).length,
    )[0];
    const champCard = `<div class="an-card"><div class="an-card-title">🏆 Top habit</div><p style="font-family:'Lora',serif;font-size:1.15rem;font-weight:600;">${champ.name}</p><p style="font-size:12px;color:var(--ink3);">${Object.keys(champ.completed).length} total check-ins</p></div>`;

    const bestS = habits.length ? Math.max(...habits.map(bestStreak)) : 0;
    const bestHabit = habits.find((h) => bestStreak(h) === bestS);
    const streakCard = `<div class="an-card"><div class="an-card-title">🔥 Longest streak</div><p style="font-family:'Lora',serif;font-size:1.15rem;font-weight:600;">${bestHabit ? bestHabit.name : "—"}</p><p style="font-size:12px;color:var(--ink3);">${bestS} days</p></div>`;

    grid.innerHTML = completion + champCard + streakCard;
}

function render() {
    renderSidebar();
    renderTracker();
    if (currentView === "analytics") renderAnalytics();
}

function toggleHabit(id, date) {
    if (isFutureDate(date)) return;
    const habit = habits.find((h) => h.id == id);
    if (!habit) return;
    if (habit.completed[date]) {
        delete habit.completed[date];
    } else {
        habit.completed[date] = true;
    }
    save();
    render();
}

function addHabit() {
    const input = document.getElementById("habitInput");
    const category = document.getElementById("habitCategory");
    const val = input.value.trim();
    if (!val) {
        input.focus();
        return;
    }
    if (habits.some((h) => h.name.toLowerCase() === val.toLowerCase())) {
        showToast("Habit already exists");
        return;
    }
    habits.push({
        id: Date.now(),
        name: val,
        category: category.value,
        createdAt: Date.now(),
        completed: {},
    });
    input.value = "";
    category.value = "none";
    save();
    render();
    showToast("Habit added ✓");
}

function renameHabit(id) {
    const habit = habits.find((h) => h.id == id);
    if (!habit) return;
    const next = prompt("Rename habit", habit.name);
    if (!next?.trim()) return;
    habit.name = next.trim();
    save();
    render();
}

function deleteHabit(id) {
    habits = habits.filter((h) => h.id != id);
    delete logs[id];
    save();
    render();
    showToast("Habit removed");
}

function switchView(view) {
    currentView = view;
    document
        .querySelectorAll(".view")
        .forEach((el) => el.classList.remove("active"));
    document
        .querySelectorAll(".snav-btn")
        .forEach((el) => el.classList.remove("active"));
    document.getElementById(`view-${view}`).classList.add("active");
    document.querySelector(`[data-view="${view}"]`).classList.add("active");
    if (view === "analytics") renderAnalytics();
}
window.switchView = switchView;

function openModal(habitId, date) {
    modalHabitId = habitId;
    modalDate = date;
    const habit = habits.find((h) => h.id == habitId);
    const log = logs[habitId]?.[date] || {};
    selectedMood = log.mood || null;
    document.getElementById("modalTitle").textContent = habit.name;
    document.getElementById("modalDate").textContent = new Date(
        date + "T12:00:00",
    ).toLocaleDateString("en", {
        weekday: "long",
        month: "long",
        day: "numeric",
    });
    document.querySelectorAll(".mood-btn").forEach((btn) => {
        btn.classList.remove("selected");
        if (parseInt(btn.dataset.mood) === selectedMood)
            btn.classList.add("selected");
    });
    const noteInput = document.getElementById("noteInput");
    noteInput.value = log.note || "";
    document.getElementById("noteChars").textContent =
        `${noteInput.value.length} / 280`;
    document.getElementById("modalOverlay").classList.remove("hidden");
}

function closeModal() {
    document.getElementById("modalOverlay").classList.add("hidden");
}
window.closeModal = closeModal;

function saveLog() {
    const note = document.getElementById("noteInput").value.trim();
    if (!logs[modalHabitId]) logs[modalHabitId] = {};
    if (!logs[modalHabitId][modalDate]) logs[modalHabitId][modalDate] = {};
    const entry = logs[modalHabitId][modalDate];
    if (selectedMood) entry.mood = selectedMood;
    else delete entry.mood;
    if (note) entry.note = note;
    else delete entry.note;
    if (!entry.note && !entry.mood) delete logs[modalHabitId][modalDate];
    save();
    closeModal();
    render();
    showToast("Entry saved ✓");
}

document.getElementById("addHabit").addEventListener("click", addHabit);
document.getElementById("habitInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") addHabit();
});
document.getElementById("prevWeek").addEventListener("click", () => {
    currentDate.setDate(currentDate.getDate() - 7);
    render();
});
document.getElementById("nextWeek").addEventListener("click", () => {
    currentDate.setDate(currentDate.getDate() + 7);
    render();
});
document.getElementById("todayBtn").addEventListener("click", () => {
    currentDate = new Date();
    render();
});

document.getElementById("tableBody").addEventListener("click", (e) => {
    const t = e.target.closest(
        "[data-id],[data-rename],[data-delete],[data-log]",
    );
    if (!t) return;
    if (t.dataset.id) toggleHabit(t.dataset.id, t.dataset.date);
    else if (t.dataset.rename) renameHabit(t.dataset.rename);
    else if (t.dataset.delete) deleteHabit(t.dataset.delete);
    else if (t.dataset.log) openModal(t.dataset.log, today());
});

document.addEventListener("keydown", (e) => {
    if (
        (e.key === "Enter" || e.key === " ") &&
        document.activeElement.classList.contains("check")
    ) {
        e.preventDefault();
        document.activeElement.click();
    }
    if (e.key === "Escape") closeModal();
});

document.getElementById("modalOverlay").addEventListener("click", (e) => {
    if (e.target === document.getElementById("modalOverlay")) closeModal();
});
document
    .getElementById("modalCloseBtn")
    .addEventListener("click", closeModal);

document.querySelectorAll(".mood-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
        document
            .querySelectorAll(".mood-btn")
            .forEach((b) => b.classList.remove("selected"));
        btn.classList.add("selected");
        selectedMood = parseInt(btn.dataset.mood);
    });
});

document
    .getElementById("noteInput")
    .addEventListener("input", function () {
        document.getElementById("noteChars").textContent =
            `${this.value.length} / 280`;
    });

document.getElementById("saveNote").addEventListener("click", saveLog);

const menuToggle = document.getElementById("menuToggle");
const sidebar = document.getElementById("sidebar");

menuToggle.addEventListener("click", (e) => {
  e.stopPropagation();
  sidebar.classList.toggle("open");
});

sidebar.addEventListener("click", (e) => {
  e.stopPropagation();

  if (
    e.target.closest(".snav-btn") ||
    e.target.closest("button") ||
    e.target.closest("a")
  ) {
    sidebar.classList.remove("open");
  }
});

document.addEventListener("click", (e) => {
    
  if (
    sidebar.classList.contains("open") &&
    !sidebar.contains(e.target) &&
    !menuToggle.contains(e.target)
  ) {
    sidebar.classList.remove("open");
  }
});
loadData();
render();
