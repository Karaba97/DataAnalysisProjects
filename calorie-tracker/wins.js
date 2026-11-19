// Fuel Up — trophy cabinet: daily wins, streaks, a goals calendar and badges.
//
// A day "wins" a goal when:
//   calories: eaten <= that day's target (steps and step debt included)
//   protein:  in the perfect zone (1.6 g per kg or more)
//   steps:    steps >= step goal + any step debt carried in
// Today only counts once a goal is already hit; calories wait until the day is over.

const $ = (id) => document.getElementById(id);
const fmt = (n) => Math.round(n).toLocaleString("en-US");
const pad = (n) => String(n).padStart(2, "0");
const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dateOf = (k) => new Date(k + "T12:00");
const addDays = (k, n) => { const d = dateOf(k); d.setDate(d.getDate() + n); return keyOf(d); };

const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
};

const DEFAULT_PLAN = { name: "Trevor", calTarget: 1935, stepGoal: 4000, proteinTarget: 140, calPer1k: 40, minCal: 1500 };
const PLAN = { ...DEFAULT_PLAN, ...(store.get("fuelup.plan") || {}) };
const KG = PLAN.weight || PLAN.proteinTarget / 1.9;
const PROTEIN_WIN = Math.min(PLAN.proteinTarget, Math.round(KG * 1.6));

const targetFor = (d) => Math.max(PLAN.minCal, Math.round(PLAN.calTarget + PLAN.calPer1k * (d.steps - d.debt - PLAN.stepGoal) / 1000));
const eatenOf = (d) => d.meals.reduce((s, m) => s + m.cal, 0);
const proteinOf = (d) => d.meals.reduce((s, m) => s + m.protein, 0);

const TODAY = keyOf(new Date());

// ---- Sample history so an empty cabinet still shows what's possible ----
function sampleDays() {
  let seed = 7;
  const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  const days = {};
  let debt = 0;
  for (let i = 26; i >= 1; i--) {
    const k = addDays(TODAY, -i);
    if (i === 19 || i === 11) { debt = 0; continue; } // a couple of missed days
    const steps = Math.round((PLAN.stepGoal * (0.6 + rnd() * 0.9)) / 100) * 100;
    const day = { meals: [], steps, debt, carriedCal: 0 };
    const total = targetFor(day) * (0.84 + rnd() * 0.26);
    const prot = PROTEIN_WIN * (0.72 + rnd() * 0.45);
    day.meals = [
      { name: "Breakfast", cal: Math.round(total * 0.3), protein: Math.round(prot * 0.3), oil: rnd() > 0.6 ? 1 : 0, photo: rnd() > 0.65 ? "x" : undefined },
      { name: "Lunch", cal: Math.round(total * 0.4), protein: Math.round(prot * 0.4), photo: rnd() > 0.75 ? "x" : undefined },
      { name: "Dinner", cal: Math.round(total * 0.3), protein: Math.round(prot * 0.3), oil: rnd() > 0.5 ? 0.1 : 0 },
    ];
    days[k] = day;
    const over = eatenOf(day) - targetFor(day);
    debt = over > 0 ? Math.ceil(over / PLAN.calPer1k * 1000 / 250) * 250 : 0;
  }
  // Today: in progress
  days[TODAY] = { meals: [{ name: "Breakfast", cal: 520, protein: 38 }], steps: 4200, debt: days[addDays(TODAY, -1)]?.debt || 0, carriedCal: 0 };
  return days;
}

const params = new URLSearchParams(location.search);
let days = store.get("fuelup.days") || {};
const logged = Object.keys(days).filter((k) => days[k].meals.length || days[k].steps);
const SAMPLE = params.get("demo") === "1" || logged.length < 2;
if (SAMPLE) days = sampleDays();
$("sampleNote").hidden = !SAMPLE;

// ---- Daily results ----
function resultFor(k) {
  const d = days[k];
  if (!d || (!d.meals.length && !d.steps)) return null;
  const done = k < TODAY;
  const eaten = eatenOf(d), target = targetFor(d), protein = proteinOf(d);
  return {
    cal: done ? d.meals.length > 0 && eaten <= target : null, // today pending
    prot: protein >= PROTEIN_WIN,
    step: d.steps >= PLAN.stepGoal + d.debt,
    over: eaten - target, protein, steps: d.steps, debt: d.debt,
    meals: d.meals,
  };
}
const keys = Object.keys(days).sort();
const results = Object.fromEntries(keys.map((k) => [k, resultFor(k)]).filter(([, r]) => r));
const rkeys = Object.keys(results).sort();

// ---- Streaks ----
function streak(goal) {
  // current: walk back from today (today counts only if already hit)
  let cur = 0;
  let k = TODAY;
  const t = results[TODAY];
  if (!(t && t[goal] === true)) k = addDays(TODAY, -1);
  while (results[k] && results[k][goal] === true) { cur++; k = addDays(k, -1); }
  // best: longest run of consecutive calendar days
  let best = 0, run = 0, prev = null;
  for (const key of rkeys) {
    const hit = results[key][goal] === true;
    run = hit ? (prev && addDays(prev, 1) === key && run ? run + 1 : 1) : 0;
    if (!hit) run = 0;
    best = Math.max(best, run);
    prev = hit ? key : null;
  }
  return { cur, best: Math.max(best, cur) };
}
const STREAKS = { cal: streak("cal"), prot: streak("prot"), step: streak("step") };
[["stCal", "cal"], ["stProt", "prot"], ["stStep", "step"]].forEach(([id, g]) => {
  const s = STREAKS[g];
  const el = $(id);
  el.querySelector(".st-num").textContent = s.cur;
  el.querySelector(".st-best").textContent = `best ${s.best}`;
  el.classList.toggle("hot", s.cur >= 3);
});

// ---- Header ----
const firstKey = rkeys[0] || TODAY;
const dayCount = Math.round((dateOf(TODAY) - dateOf(firstKey)) / 86400000) + 1;
const crowns = rkeys.filter((k) => results[k].cal && results[k].prot && results[k].step).length;
$("winsSub").textContent = `${rkeys.length} days logged · ${crowns} perfect day${crowns === 1 ? "" : "s"} 👑`;

// ---- Calendar ----
let view = new Date(); view.setDate(1);
function renderCalendar() {
  $("monthName").textContent = view.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  const grid = $("calGrid");
  grid.innerHTML = "";
  const first = new Date(view.getFullYear(), view.getMonth(), 1);
  const lead = (first.getDay() + 6) % 7; // Monday first
  const daysIn = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
  for (let i = 0; i < lead; i++) grid.appendChild(document.createElement("span"));
  for (let d = 1; d <= daysIn; d++) {
    const k = keyOf(new Date(view.getFullYear(), view.getMonth(), d));
    const r = results[k];
    const cell = document.createElement("div");
    cell.className = "cal-day" + (k === TODAY ? " today" : "") + (k > TODAY ? " future" : "");
    const crown = r && r.cal && r.prot && r.step;
    if (crown) cell.classList.add("crown");
    cell.innerHTML = `<span class="cal-num">${crown ? "👑" : d}</span><span class="dots"></span>`;
    if (r) {
      const dots = cell.querySelector(".dots");
      [["cal", r.cal], ["prot", r.prot], ["step", r.step]].forEach(([c, hit]) => {
        const i = document.createElement("i");
        i.className = `dot ${c}` + (hit === true ? "" : hit === null ? " pending" : " miss");
        dots.appendChild(i);
      });
      const label = [`${d}`, r.cal === null ? "calories pending" : r.cal ? "calories hit" : "calories over", r.prot ? "protein hit" : "protein short", r.step ? "steps hit" : "steps short"];
      cell.setAttribute("aria-label", label.join(", "));
    }
    grid.appendChild(cell);
  }
  const now = new Date();
  $("nextMonth").disabled = view.getFullYear() === now.getFullYear() && view.getMonth() === now.getMonth();
}
$("prevMonth").addEventListener("click", () => { view.setMonth(view.getMonth() - 1); renderCalendar(); });
$("nextMonth").addEventListener("click", () => { view.setMonth(view.getMonth() + 1); renderCalendar(); });
renderCalendar();

// ---- Hit rates ----
const done = rkeys.filter((k) => k < TODAY);
function rate(goal, list) {
  const n = list.length;
  const hit = list.filter((k) => results[k][goal] === true).length;
  return { hit, n, pct: n ? Math.round((hit / n) * 100) : 0 };
}
const RATES = [
  ["🔥", "Calories under target", rate("cal", done)],
  ["💪", "Protein in the perfect zone", rate("prot", done)],
  ["👟", "Step goal smashed", rate("step", done)],
];
$("rates").innerHTML = "";
RATES.forEach(([icon, label, r]) => {
  const row = document.createElement("div");
  row.className = "rate";
  row.innerHTML = `<div class="rate-top"><span>${icon} ${label}</span><b>${r.hit}/${r.n}</b></div>
    <div class="bar"><div class="bar-fill" style="width:0"></div></div>`;
  const fill = row.querySelector(".bar-fill");
  fill.classList.add(r.pct >= 70 ? "zone-perfect" : r.pct >= 40 ? "zone-good" : "zone-low");
  setTimeout(() => { fill.style.width = r.pct + "%"; }, 200);
  $("rates").appendChild(row);
});

// ---- Badges ----
const allMeals = rkeys.flatMap((k) => results[k].meals);
const maxSteps = Math.max(0, ...rkeys.map((k) => results[k].steps));
const debtCleared = rkeys.filter((k) => results[k].debt > 0 && results[k].steps >= results[k].debt).length;
const comebacks = rkeys.filter((k) => { const p = results[addDays(k, -1)]; return p && p.cal === false && results[k].cal === true; }).length;
function bestRun(pred) {
  let best = 0, run = 0, prev = null;
  for (const k of rkeys) {
    if (pred(k)) { run = prev && addDays(prev, 1) === k ? run + 1 : 1; prev = k; } else { run = 0; prev = null; }
    best = Math.max(best, run);
  }
  return best;
}
const logRun = bestRun(() => true);

const BADGES = [
  { icon: "🍽️", name: "First Bite", how: "Log your first meal", have: allMeals.length, need: 1 },
  { icon: "🎩", name: "Hat Trick", how: "3 days in a row under calories", have: STREAKS.cal.best, need: 3 },
  { icon: "🗡️", name: "Week Warrior", how: "7 days in a row under calories", have: STREAKS.cal.best, need: 7 },
  { icon: "👑", name: "Triple Crown", how: "Hit all three goals in one day", have: crowns, need: 1 },
  { icon: "🏴‍☠️", name: "Protein Pirate", how: "5 days in the perfect protein zone", have: rkeys.filter((k) => results[k].prot).length, need: 5 },
  { icon: "🏃", name: "Marathon Legs", how: "Walk 15,000 steps in a day", have: maxSteps, need: 15000, steps: true },
  { icon: "⚔️", name: "Debt Slayer", how: "Walk off a step debt", have: debtCleared, need: 1 },
  { icon: "🔄", name: "Comeback Kid", how: "Go over, then nail it the next day", have: comebacks, need: 1 },
  { icon: "🫗", name: "Oil Confessor", how: "Own up to oil 5 times", have: allMeals.filter((m) => m.oil).length, need: 5 },
  { icon: "📸", name: "Food Paparazzi", how: "Snap 10 meal photos", have: allMeals.filter((m) => m.photo).length, need: 10 },
  { icon: "📅", name: "Fortnight Flex", how: "Log 14 days in a row", have: logRun, need: 14 },
  { icon: "💎", name: "Diamond Month", how: "20 perfect days", have: crowns, need: 20 },
];
const unlocked = BADGES.filter((b) => b.have >= b.need).length;
$("badgeCount").textContent = `${unlocked}/${BADGES.length}`;
BADGES.sort((a, b) => (b.have >= b.need) - (a.have >= a.need));
BADGES.forEach((b) => {
  const got = b.have >= b.need;
  const el = document.createElement("div");
  el.className = "badge" + (got ? " got" : "");
  const prog = b.steps ? `${fmt(Math.min(b.have, b.need))} / ${fmt(b.need)}` : `${Math.min(b.have, b.need)} / ${b.need}`;
  el.innerHTML = `<span class="b-icon">${got ? b.icon : "🔒"}</span><b></b><small></small>
    ${got ? "" : `<div class="b-bar"><i style="width:${Math.round(Math.min(1, b.have / b.need) * 100)}%"></i></div><small class="b-prog">${prog}</small>`}`;
  el.querySelector("b").textContent = b.name;
  el.querySelector("small").textContent = b.how;
  el.title = got ? `${b.name}: unlocked!` : `${b.name}: ${b.how}`;
  $("badges").appendChild(el);
});

// ---- Coach ----
const best = Object.entries(STREAKS).sort((a, b) => b[1].cur - a[1].cur)[0];
const NAMES = { cal: "calorie", prot: "protein", step: "step" };
let coach;
if (!rkeys.length) coach = "Empty cabinet! Log today and I'll start polishing trophies 🧽";
else if (best[1].cur >= 7) coach = `${best[1].cur}-day ${NAMES[best[0]]} streak?! I'm framing this one 🖼️`;
else if (best[1].cur >= 3) coach = `${best[1].cur} days of ${NAMES[best[0]]} wins in a row. Don't you dare break it 😤`;
else if (crowns) coach = `${crowns} perfect day${crowns > 1 ? "s" : ""} so far. Let's make today another 👑`;
else coach = "Every legend starts with day one. Go get a crown today 👑";
$("coach").textContent = coach;
