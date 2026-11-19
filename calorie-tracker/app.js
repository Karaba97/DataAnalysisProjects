// Fuel Up — today screen.
//
// Calories come first. Steps earn (or cost) calories at ~40 cal per 1,000 steps
// above or below your step goal. Go over your calories and the app tells you
// how many steps burn it off. Whatever you don't walk off by midnight rolls into
// tomorrow as a step debt: those steps are paid back first and earn no calories.
// Protein resets every day.

const $ = (id) => document.getElementById(id);
const fmt = (n) => Math.round(n).toLocaleString("en-US");
const params = new URLSearchParams(location.search);
const DEMO = params.get("demo");

// ---- Storage (falls back to memory if the browser blocks it) ----
const mem = {};
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return mem[k] ?? null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { mem[k] = v; } },
  works() { try { localStorage.setItem("fuelup.t", "1"); localStorage.removeItem("fuelup.t"); return true; } catch (e) { return false; } },
};

// ---- Plan (from sign-up) ----
const DEFAULT_PLAN = { name: "Trevor", calTarget: 1935, stepGoal: 4000, proteinTarget: 140, calPer1k: 40, minCal: 1500 };
const savedPlan = store.get("fuelup.plan");
if (!savedPlan && !DEMO && store.works()) location.replace("setup.html");
const PLAN = { ...DEFAULT_PLAN, ...(savedPlan || {}) };
const NICK = PLAN.name.length > 5 ? PLAN.name.slice(0, 4) : PLAN.name;
const MEALS_PER_DAY = 3, MEAL_CAP = 800;

// ---- Rules ----
const round250 = (n) => Math.ceil(n / 250) * 250;
const stepsFor = (cal) => round250((cal / PLAN.calPer1k) * 1000);
function targetFor(day) {
  const earningSteps = day.steps - day.debt; // debt steps are paid back first
  return Math.max(PLAN.minCal, Math.round(PLAN.calTarget + PLAN.calPer1k * (earningSteps - PLAN.stepGoal) / 1000));
}
const eatenOf = (day) => day.meals.reduce((s, m) => s + m.cal, 0);
const proteinOf = (day) => day.meals.reduce((s, m) => s + m.protein, 0);

// ---- Days ----
const pad = (n) => String(n).padStart(2, "0");
const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const daysBetween = (a, b) => Math.round((new Date(b + "T12:00") - new Date(a + "T12:00")) / 86400000);

function loadDays() { return store.get("fuelup.days") || {}; }
function saveDays(days) { if (!DEMO) store.set("fuelup.days", days); }

// Opens today's page in the diary. If it's a new day, carry yesterday's overage in as step debt.
function openToday(days, key) {
  if (days[key]) return days[key];
  const prev = Object.keys(days).filter((k) => k < key).sort().pop();
  let debt = 0, carriedCal = 0;
  if (prev) {
    const p = days[prev];
    const over = eatenOf(p) - targetFor(p);
    if (over > 0) { carriedCal = over; debt = stepsFor(over); }
  }
  days[key] = { meals: [], steps: 0, debt, carriedCal };
  saveDays(days);
  return days[key];
}

// ---- Sample days for previews (?demo=today|debt|over) ----
const SAMPLE_MEALS = [
  { emoji: "🫓", name: "Chapati, eggs & beans", type: "meal", time: "10:40", cal: 950, protein: 62 },
  { emoji: "🥜", name: "Groundnuts & mala", type: "snack", time: "13:15", cal: 335, protein: 20 },
];
const DEMOS = {
  today: { debt: 0, carriedCal: 0, steps: 3000, meals: [...SAMPLE_MEALS] },
  debt: { debt: 2000, carriedCal: 80, steps: 1500, meals: [...SAMPLE_MEALS] },
  over: { debt: 0, carriedCal: 0, steps: 5000, meals: [...SAMPLE_MEALS, { emoji: "🍛", name: "Pilau & beef fry", type: "meal", time: "19:30", cal: 900, protein: 45 }] },
};

let days, todayKey, today;
function load() {
  todayKey = keyOf(new Date());
  if (DEMO) { days = { [todayKey]: DEMOS[DEMO] || DEMOS.today }; today = days[todayKey]; return; }
  days = loadDays();
  today = openToday(days, todayKey);
}

// ---- Render ----
function period(h) { return h < 5 ? "night" : h < 12 ? "morning" : h < 17 ? "afternoon" : h < 21 ? "evening" : "night"; }
const GREET = {
  morning: [`Rise & dine, ${PLAN.name}!`, "🌞"],
  afternoon: [`Yo ${NICK}!`, "😎"],
  evening: [`Evening, ${NICK}!`, "🌛"],
  night: [`Night owl ${NICK}!`, "🦉"],
};

function render() {
  const now = new Date();
  const hour = params.has("hour") ? Number(params.get("hour")) : now.getHours();
  const p = period(hour);

  const target = targetFor(today);
  const eaten = eatenOf(today);
  const protein = proteinOf(today);
  const remaining = target - eaten;
  const over = remaining < 0;
  const burnSteps = over ? stepsFor(-remaining) : 0;
  const mainMeals = today.meals.filter((m) => m.type === "meal").length;
  const snacks = today.meals.filter((m) => m.type === "snack").length;
  let mealsLeft = Math.max(0, MEALS_PER_DAY - mainMeals);
  if (remaining < MEAL_CAP || snacks > 0) mealsLeft = Math.min(mealsLeft, 1);
  const nextMealBudget = over ? 0 : mealsLeft ? Math.min(MEAL_CAP, Math.floor(remaining / mealsLeft)) : remaining;
  const feastSteps = !over && remaining < MEAL_CAP ? stepsFor(MEAL_CAP - remaining) : 0;
  const proteinLeft = Math.max(0, PLAN.proteinTarget - protein);
  const stepGoal = PLAN.stepGoal + today.debt + burnSteps;

  // Hero
  const hero = $("hero");
  hero.className = "hero " + p;
  $("greeting").textContent = GREET[p][0];
  $("sky").textContent = GREET[p][1];
  $("date").textContent = now.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  const first = Object.keys(days).sort()[0] || todayKey;
  $("dayChip").textContent = `Day ${daysBetween(first, todayKey) + 1} 🔥`;
  const bites = [mainMeals && `${mainMeals} meal${mainMeals > 1 ? "s" : ""}`, snacks && `${snacks} snack${snacks > 1 ? "s" : ""}`].filter(Boolean).join(" + ");
  $("subGreeting").textContent = !today.meals.length
    ? (p === "morning" ? "Fresh day, full tank. Let's roll!" : "Nothing logged yet. Hungry?")
    : over ? `${bites} down. Oops, overfilled 🫣`
    : `${bites} down. Gauge looks tasty.`;

  // Carry-over banner
  if (today.debt) {
    const left = Math.max(0, today.debt - today.steps);
    const cal = today.carriedCal || Math.round((today.debt / 1000) * PLAN.calPer1k);
    $("debt").hidden = false;
    $("debtTitle").textContent = left ? `Step debt: ${fmt(left)} to go` : "Debt paid off! 🎉";
    $("debtText").textContent = left
      ? `Yesterday ran ${fmt(cal)} cal over, so today starts at −${fmt(cal)} cal and +${fmt(today.debt)} steps.`
      : `You walked off yesterday's ${fmt(cal)} cal. Steps earn cal again.`;
  } else $("debt").hidden = true;

  // Gauge
  const arc = $("calArc");
  const len = arc.getTotalLength();
  const frac = Math.min(1, eaten / target);
  arc.style.strokeDasharray = len;
  if (!arc.style.strokeDashoffset) arc.style.strokeDashoffset = len;
  arc.classList.toggle("over", over);
  $("hubFace").textContent = over ? "🫣" : frac > 0.85 ? "😬" : "😋";
  $("calLeftBig").textContent = fmt(Math.abs(remaining));
  $("calLeftBig").classList.toggle("over", over);
  $("calLeftLabel").textContent = over ? "cal over" : "cal left";
  $("calEaten").textContent = fmt(eaten);
  $("calTarget").textContent = fmt(target);
  $("calPill").textContent = over ? "Overfilled!" : frac > 0.85 ? "Nearly full" : !eaten ? "Full tank" : "Cruisin'";
  $("calPill").classList.toggle("over", over);

  // Action card
  const action = $("actionCard");
  action.classList.toggle("over", over);
  if (over) {
    $("actionEmoji").textContent = "🏃‍♂️";
    $("actionTitle").textContent = `Walk it off: +${fmt(burnSteps)} steps`;
    $("actionText").textContent = "Not done by midnight? It's tomorrow's step debt 🐌";
  } else if (mealsLeft) {
    $("actionEmoji").textContent = "🍗";
    $("actionTitle").textContent = `Next up: ${fmt(nextMealBudget)} cal meal`;
    $("actionText").textContent = feastSteps
      ? `Walk +${fmt(feastSteps)} steps to make it an 800-cal feast.`
      : "Room for a full 800-cal feast. Dig in!";
  } else {
    $("actionEmoji").textContent = "🛑";
    $("actionTitle").textContent = "Kitchen's closed!";
    $("actionText").textContent = `${fmt(remaining)} cal spare. Nice work.`;
  }

  // Protein & steps
  const protMet = protein >= PLAN.proteinTarget;
  $("protEaten").textContent = protein;
  $("protTarget").textContent = PLAN.proteinTarget;
  $("protBar").classList.toggle("met", protMet);
  $("protFoot").textContent = protMet ? "Beast mode 💪" : `${proteinLeft}g to go · resets at midnight`;
  $("steps").textContent = fmt(today.steps);
  $("stepFoot").textContent = today.steps >= stepGoal ? "Goal smashed 🎉" : `Goal ${fmt(stepGoal)}`;

  // Coach
  let coach;
  if (over) coach = "Ate like a king? Walk like a warrior 🗡️";
  else if (today.debt - today.steps > 10000) coach = "That debt's a mountain 🏔️ Chip away with walks and keep plates light today.";
  else if (today.debt > today.steps) coach = "Slow and steady pays the debt. Lace up! 🐌";
  else if (!today.meals.length) coach = p === "morning" ? "Eggs, beans or omena. Start strong!" : "Don't skip! Log your first bite with the pink button.";
  else if (proteinLeft > 40) coach = "Protein's lagging. Kuku or samaki next? 🐔🐟";
  else if (!today.steps) coach = "Food's logged. Now tell me your steps, tap the shoe 👟";
  else coach = "You're crushing it. Keep munching smart!";
  $("coach").textContent = coach;

  // Meals
  const list = $("meals");
  list.innerHTML = "";
  $("mealCount").textContent = `${today.meals.length} logged`;
  if (!today.meals.length) {
    list.innerHTML = `<li class="empty"><div><b>🍽️</b>Empty plate. Tap the pink + to log a bite.</div></li>`;
  }
  today.meals.forEach((m, i) => {
    const li = document.createElement("li");
    li.innerHTML = `<div class="meal-emoji"></div>
      <div class="meal-info"><div class="meal-name"></div><div class="meal-meta"></div></div>
      <div class="meal-cal">${fmt(m.cal)}</div>
      <button class="meal-del" type="button" aria-label="Delete">🗑️</button>`;
    li.querySelector(".meal-emoji").textContent = m.emoji;
    li.querySelector(".meal-name").textContent = m.name;
    li.querySelector(".meal-meta").textContent = `${m.time} · ${m.protein}g protein${m.type === "snack" ? " · snack" : ""}`;
    li.querySelector(".meal-del").addEventListener("click", () => {
      today.meals.splice(i, 1);
      saveDays(days); render();
      toast(`Poof! ${m.name} un-eaten 🪄`);
    });
    list.appendChild(li);
  });
  if (DEMO) $("footNote").textContent = "Preview with sample data · nothing is saved";

  // Animate bars and gauge
  requestAnimationFrame(() => setTimeout(() => {
    arc.style.strokeDashoffset = len * (1 - frac);
    $("needle").style.transform = `rotate(${-90 + 180 * frac}deg)`;
    $("protBar").style.width = Math.min(100, (protein / PLAN.proteinTarget) * 100) + "%";
    $("stepBar").style.width = Math.min(100, (today.steps / stepGoal) * 100) + "%";
  }, 250));
}

// ---- Toast ----
let toastTimer;
function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2200);
}

// ---- Sheets ----
function openSheet(id) {
  $("scrim").hidden = false;
  $(id).hidden = false;
}
function closeSheets() {
  $("scrim").hidden = true;
  $("mealSheet").hidden = true;
  $("stepSheet").hidden = true;
}
$("scrim").addEventListener("click", closeSheets);
document.addEventListener("keydown", (e) => e.key === "Escape" && closeSheets());

// Meal sheet. Quick-pick numbers are rough estimates for a typical home portion.
const PICKS = [
  { emoji: "🍲", name: "Ugali & sukuma", cal: 450, protein: 12 },
  { emoji: "🍖", name: "Ugali & beef stew", cal: 700, protein: 38 },
  { emoji: "🐟", name: "Ugali & fried tilapia", cal: 750, protein: 50 },
  { emoji: "🫓", name: "Chapati (1)", cal: 300, protein: 6 },
  { emoji: "🫘", name: "Githeri (1 plate)", cal: 450, protein: 18 },
  { emoji: "🍚", name: "Rice & beans", cal: 520, protein: 20 },
  { emoji: "🍛", name: "Pilau (1 plate)", cal: 600, protein: 22 },
  { emoji: "🔥", name: "Nyama choma (250 g)", cal: 550, protein: 55 },
  { emoji: "🥚", name: "Boiled eggs (2)", cal: 150, protein: 12 },
  { emoji: "🍩", name: "Mandazi (1)", cal: 200, protein: 4 },
  { emoji: "☕", name: "Chai with milk", cal: 120, protein: 4 },
  { emoji: "🍌", name: "Banana", cal: 105, protein: 1 },
];
const EMOJIS = [...new Set(["🍽️", ...PICKS.map((p) => p.emoji), "🥗", "🥜", "🍪"])];
let mealType = "meal", mealEmoji = "🍽️";

function setType(v) {
  mealType = v;
  document.querySelectorAll("#fType button").forEach((b) => b.classList.toggle("on", b.dataset.v === v));
}
function setEmoji(e) {
  mealEmoji = e;
  document.querySelectorAll("#emojiRow button").forEach((b) => b.classList.toggle("on", b.textContent === e));
}
PICKS.forEach((pk) => {
  const b = document.createElement("button");
  b.type = "button"; b.className = "pick";
  b.textContent = `${pk.emoji} ${pk.name}`;
  b.addEventListener("click", () => {
    $("fName").value = pk.name; $("fCal").value = pk.cal; $("fProt").value = pk.protein;
    setEmoji(EMOJIS.includes(pk.emoji) ? pk.emoji : "🍽️");
    setType(pk.cal < 250 ? "snack" : "meal");
  });
  $("picks").appendChild(b);
});
EMOJIS.forEach((e) => {
  const b = document.createElement("button");
  b.type = "button"; b.textContent = e;
  b.addEventListener("click", () => setEmoji(e));
  $("emojiRow").appendChild(b);
});
document.querySelectorAll("#fType button").forEach((b) => b.addEventListener("click", () => setType(b.dataset.v)));

$("addBtn").addEventListener("click", () => {
  $("mealForm").reset();
  const n = new Date();
  $("fTime").value = `${pad(n.getHours())}:${pad(n.getMinutes())}`;
  setType("meal"); setEmoji("🍽️");
  openSheet("mealSheet");
});
$("mealForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const meal = {
    emoji: mealEmoji, name: $("fName").value.trim(), type: mealType,
    time: $("fTime").value || "--:--", cal: Math.max(0, +$("fCal").value || 0), protein: Math.max(0, +$("fProt").value || 0),
  };
  today.meals.push(meal);
  today.meals.sort((a, b) => a.time.localeCompare(b.time));
  saveDays(days); closeSheets(); render();
  const left = targetFor(today) - eatenOf(today);
  toast(left < 0 ? `Nom! …uh-oh, ${fmt(-left)} over 🫣` : `Nom nom! +${fmt(meal.cal)} cal 😋`);
});

// Step sheet
function openSteps() {
  $("sTotal").value = today.steps || "";
  openSheet("stepSheet");
  setTimeout(() => $("sTotal").focus(), 50);
}
$("stepsCard").addEventListener("click", openSteps);
$("stepsCard").addEventListener("keydown", (e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), openSteps()));
document.querySelectorAll("#stepSheet [data-add]").forEach((b) =>
  b.addEventListener("click", () => { $("sTotal").value = (+$("sTotal").value || 0) + +b.dataset.add; })
);
$("stepForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const before = today.steps;
  today.steps = Math.max(0, Math.round(+$("sTotal").value || 0));
  saveDays(days); closeSheets(); render();
  const earned = Math.round(((today.steps - before) / 1000) * PLAN.calPer1k);
  toast(earned > 0 ? `Stompin'! +${fmt(earned)} cal earned 🦶` : "Steps saved 👟");
});

$("winsBtn").addEventListener("click", () => toast("Trophy room is under construction 🏗️🏆"));

// ---- Go ----
load();
render();

// Midnight rollover: if the date changes while the app is open, start a fresh day.
setInterval(() => {
  if (!DEMO && keyOf(new Date()) !== todayKey) { load(); render(); toast("New day! Tank refilled ⛽"); }
}, 30000);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && !DEMO && keyOf(new Date()) !== todayKey) { load(); render(); }
});
