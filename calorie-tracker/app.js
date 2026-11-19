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
// What the body burns at a given step count: Mifflin-St Jeor x 1.2, plus steps.
function maintenanceFor(steps) {
  const w = PLAN.weight || 74, h = PLAN.height || 164, age = PLAN.age || 29, sex = PLAN.sex || "m";
  const bmr = 10 * w + 6.25 * h - 5 * age + (sex === "m" ? 5 : -161);
  return bmr * 1.2 + (PLAN.calPer1k * steps) / 1000;
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
  const stepGoal = PLAN.stepGoal + today.debt; // never ask for more than the goal (+ any debt)

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
    // Where are we vs maintenance (what the body actually burns today)?
    const maint = maintenanceFor(today.steps);
    const gap = Math.round(maint - eaten); // + = still in a deficit, − = surplus
    const kgWeek = (cal) => Math.max(0, (cal * 7) / 7700).toFixed(2).replace(/0$/, "");
    const plannedDef = maintenanceFor(PLAN.stepGoal) - PLAN.calTarget;
    const toGoal = Math.max(0, stepGoal - today.steps);
    const earn = Math.round((toGoal / 1000) * PLAN.calPer1k);
    const afterGap = gap + earn;
    const vsMaint = (g) => g > 25 ? `puts you ${fmt(g)} cal below maintenance 🙌` : g < -25 ? `still leaves you ${fmt(-g)} cal above maintenance 😬` : "puts you right at maintenance 😐";
    const walk = toGoal
      ? ` Walk your last ${fmt(toGoal)} steps to earn back ${fmt(earn)} cal, which ${vsMaint(afterGap)}.`
      : "";
    action.classList.remove("mild", "maint", "surplus");
    action.classList.add(gap > 25 ? "mild" : gap >= -25 ? "maint" : "surplus");
    if (gap > 25) {
      $("actionEmoji").textContent = "😅";
      $("actionTitle").textContent = `Not too bad. Still a deficit!`;
      $("actionText").textContent = `Missed target by ${fmt(-remaining)} cal, so today's pace is ${kgWeek(gap)} kg/week instead of ${kgWeek(plannedDef)}.${walk || " Do better tomorrow 💪"}`;
    } else if (gap >= -25) {
      $("actionEmoji").textContent = "😐";
      $("actionTitle").textContent = "Maintenance mode: no loss today";
      $("actionText").textContent = `You ate what you burn.${walk || " Tomorrow we cut, deal? 🤝"}`;
    } else {
      $("actionEmoji").textContent = "🚨";
      $("actionTitle").textContent = `Surplus alert: ${fmt(-gap)} cal over maintenance`;
      $("actionText").textContent = `${walk ? walk.trim() : "Step goal done ✅"} Whatever's still over target at midnight becomes tomorrow's step debt 🐌`;
    }
  }
  // Only show the action card when there's something to fix (going over).
  action.hidden = !over;

  // Protein & steps
  // Protein zones, by grams per kg of body weight:
  // under 1.2 g/kg too low, 1.2 to 1.6 good enough, 1.6+ perfect (benefits level off there).
  const kg = PLAN.weight || PLAN.proteinTarget / 1.9;
  const lowLine = Math.min(PLAN.proteinTarget, Math.round(kg * 1.2));
  const goodLine = Math.min(PLAN.proteinTarget, Math.round(kg * 1.6));
  const zone = protein >= goodLine ? "perfect" : protein >= lowLine ? "good" : "low";
  const ZONES = {
    low: `📞 Your muscles called. They want ${lowLine - protein}g more protein, no excuses.`,
    good: `👍 Good enough: muscle is protected, but it won't grow much. ${goodLine - protein}g more for perfect.`,
    perfect: protein >= PLAN.proteinTarget
      ? "💪 Perfect! Muscle protected and ready to grow. Fat loss, not muscle loss 🔒"
      : `💪 Perfect zone! Muscle is protected and can grow. ${PLAN.proteinTarget - protein}g more to max out.`,
  };

  const pct = (g) => Math.min(100, (g / PLAN.proteinTarget) * 100);
  $("protTrack").style.setProperty("--low", pct(lowLine) + "%");
  $("protTrack").style.setProperty("--good", pct(goodLine) + "%");
  $("tickLow").style.left = pct(lowLine) + "%";
  $("tickGood").style.left = pct(goodLine) + "%";
  $("protZone").textContent = ZONES[zone];
  $("protZone").className = "zone-tag " + zone;
  $("protBar").className = "bar-fill zone-" + zone;
  const protMet = protein >= PLAN.proteinTarget;
  $("protEaten").textContent = protein;
  $("protTarget").textContent = PLAN.proteinTarget;
  $("protFoot").textContent = "Resets at midnight";
  $("steps").textContent = fmt(today.steps);
  $("stepFoot").textContent = today.steps >= stepGoal ? "Goal smashed 🎉" : `Goal ${fmt(stepGoal)}`;

  // Coach
  let coach;
  if (over) coach = "Ate like a king? Walk like a warrior 🗡️";
  else if (today.debt - today.steps > 10000) coach = "That debt's a mountain 🏔️ Chip away with walks and keep plates light today.";
  else if (today.debt > today.steps) coach = "Slow and steady pays the debt. Lace up! 🐌";
  else if (!today.meals.length) coach = p === "morning" ? "Eggs, beans or omena. Start strong!" : "Don't skip! Log your first bite with the pink button.";
  else if (zone === "low" && today.meals.length) coach = "🚨 Your muscles called. They want extra protein, no excuses. Eggs, kuku or omena!";
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
    if (m.photo) li.querySelector(".meal-emoji").style.backgroundImage = `url(${m.photo})`;
    else li.querySelector(".meal-emoji").textContent = m.emoji;
    li.querySelector(".meal-name").textContent = m.name;
    li.querySelector(".meal-meta").textContent = `${m.time} · ${m.protein}g protein${m.oil ? (m.oil < 0.5 ? " · 💨 oil spray" : ` · 🫗 ${m.oil} tbsp oil`) : ""}${m.type === "snack" ? " · snack" : ""}`;
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
  if (aiCtl) aiCtl.abort();
  $("scrim").hidden = true;
  $("mealSheet").hidden = true;
  $("stepSheet").hidden = true;
}
$("scrim").addEventListener("click", closeSheets);
document.addEventListener("keydown", (e) => e.key === "Escape" && closeSheets());

// Meal sheet. Kenyan classics are rough estimates for a typical home portion.
const CLASSICS = [
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
const SNACK_UNDER = 300; // anything smaller than this counts as a snack
const loadFavs = () => store.get("fuelup.favs") || [];
let photoData = null, photoFile = null, pickedName = null;

function guessEmoji(name) {
  const n = name.toLowerCase();
  const hit = CLASSICS.find((c) => n.includes(c.name.toLowerCase().split(/[ (&]/)[0]));
  return hit ? hit.emoji : "🍽️";
}

function fillPicker() {
  const sel = $("fPick");
  sel.innerHTML = '<option value="">Choose from the list…</option>';
  const favs = loadFavs();
  const group = (label, items, prefix) => {
    if (!items.length) return;
    const g = document.createElement("optgroup");
    g.label = label;
    items.forEach((it, i) => {
      const o = document.createElement("option");
      o.value = `${prefix}:${i}`;
      o.textContent = `${it.emoji} ${it.name} · ${fmt(it.cal)} cal`;
      g.appendChild(o);
    });
    sel.appendChild(g);
  };
  group("⭐ My favourites", favs, "fav");
  group("🇰🇪 Kenyan classics", CLASSICS, "kc");
}

$("fPick").addEventListener("change", (e) => {
  const [kind, i] = e.target.value.split(":");
  const item = kind === "fav" ? loadFavs()[i] : kind === "kc" ? CLASSICS[i] : null;
  if (!item) return;
  $("fName").value = item.name; setFoodCal(item.cal); $("fProt").value = item.protein;
  updateTotal();
  pickedName = item.name;
  $("fFav").checked = false;
  $("fFav").parentElement.hidden = kind === "fav";
});
// Typing a different food clears the picked numbers so they don't stick around.
$("fName").addEventListener("input", () => {
  if (pickedName && $("fName").value.trim() !== pickedName) {
    setFoodCal(""); $("fProt").value = ""; $("fPick").value = "";
    updateTotal();
    pickedName = null; $("fFav").parentElement.hidden = false;
  }
});

// Photo: shrink it to a small thumbnail so it fits in phone storage.
$("fPhoto").addEventListener("change", (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  photoFile = file;
  const img = new Image();
  img.onload = () => {
    const size = 160, c = document.createElement("canvas");
    const s = Math.min(img.width, img.height);
    c.width = c.height = size;
    c.getContext("2d").drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
    photoData = c.toDataURL("image/jpeg", 0.7);
    $("photoPreview").innerHTML = "";
    $("photoPreview").style.backgroundImage = `url(${photoData})`;
    $("photoHint").textContent = ai ? "Looking good! Claude's on it 🔍" : "Looking good!";
    $("photoClear").hidden = false;
    URL.revokeObjectURL(img.src);
    if (ai && aiImages) estimate();
  };
  img.src = URL.createObjectURL(file);
});
function clearPhoto() {
  photoData = null; photoFile = null; $("fPhoto").value = "";
  $("photoPreview").style.backgroundImage = ""; $("photoPreview").textContent = "📸";
  $("photoHint").textContent = "Add a photo of your plate";
  $("photoClear").hidden = true;
}
$("photoClear").addEventListener("click", clearPhoto);

$("addBtn").addEventListener("click", () => {
  $("mealForm").reset();
  clearPhoto(); fillPicker(); pickedName = null; aiEmoji = null; setAiNote(""); baseCal = ""; setOil(0);
  $("fFav").parentElement.hidden = false;
  const n = new Date();
  $("fTime").value = `${pad(n.getHours())}:${pad(n.getMinutes())}`;
  openSheet("mealSheet");
});
$("mealForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const name = $("fName").value.trim();
  const oilCal = Math.round(oilTbsp * OIL_CAL);
  const cal = Math.max(0, +$("fCal").value || 0), protein = Math.max(0, +$("fProt").value || 0);
  const pick = CLASSICS.find((c) => c.name === name) || loadFavs().find((f) => f.name === name);
  const emoji = pick ? pick.emoji : aiEmoji || guessEmoji(name);
  const meal = { emoji, name, type: cal < SNACK_UNDER ? "snack" : "meal", time: $("fTime").value || "--:--", cal, protein };
  if (photoData) meal.photo = photoData;
  if (oilTbsp) meal.oil = oilTbsp;
  today.meals.push(meal);
  today.meals.sort((a, b) => a.time.localeCompare(b.time));
  if ($("fFav").checked) {
    const favs = loadFavs().filter((f) => f.name.toLowerCase() !== name.toLowerCase());
    favs.unshift({ emoji, name, cal: Math.max(0, cal - oilCal), protein });
    store.set("fuelup.favs", favs.slice(0, 20));
  }
  saveDays(days); closeSheets(); render();
  const left = targetFor(today) - eatenOf(today);
  toast(left < 0 ? `Nom! …uh-oh, ${fmt(-left)} over 🫣` : $("fFav").checked ? "Nom nom! Saved to favourites ⭐" : `Nom nom! +${fmt(meal.cal)} cal 😋`);
});


// ---- Claude estimates (only inside claude.ai, on the viewer's own Claude account) ----
let ai = null, aiImages = false, aiCtl = null;
const THINKING = ["Let's see the damage 👀", "Counting the chapatis… 🫓", "Weighing it with my eyes… 👀", "Asking the ugali gods 🙏", "Calculating the regret… 😅", "Sniffing your plate… 👃", "Consulting the chapati council… 🧐"];

function setAiNote(text, kind) {
  $("aiNote").hidden = !text;
  $("aiNote").textContent = text || "";
  $("aiNote").className = "ai-note" + (kind ? " " + kind : "");
}

async function estimate() {
  if (!ai) return;
  const desc = $("fName").value.trim();
  const useImage = !!(photoFile && aiImages);
  if (!desc && !useImage) { setAiNote(""); return; }
  if (aiCtl) aiCtl.abort();
  aiCtl = new AbortController();
  setAiNote(THINKING[Math.floor(Math.random() * THINKING.length)]);
  const prompt =
    "You estimate nutrition for a calorie tracker used by an adult in Kenya. " +
    (useImage ? "The attached photo shows what they are eating. " : "") +
    `Their description: "${desc || "(none, use the photo)"}". ` +
    "Give PRUDENT estimates: this person is tracking a calorie deficit, and under-counting hurts them more than over-counting. " +
    "Assume realistic, generous Kenyan home or local restaurant portions unless the description gives amounts. " +
    "When unsure about size, cut or ingredients, pick the higher plausible calories; never assume lean, skinless, small or 'light' unless stated. " +
    "Count fat that is part of the food itself (chicken skin, fatty meat, butter or margarine in chapati, coconut milk, sauces, gravy). " +
    "For protein, do not round up: give a realistic, not optimistic, number. " +
    "Calibration: 150 g roasted potatoes plus 1.5 roasted skin-on chicken thighs is about 485 kcal and 40 g protein. " +
    "Do NOT include separately added cooking oil; the app asks about oil separately. " +
    "Reply with only a JSON object: " +
    '{"name": short food name, max 40 characters, "cal": whole number of kcal, "protein": whole number of grams, ' +
    '"emoji": one food emoji, "note": one short, playful sentence (max 90 characters) naming the portion you assumed}. ' +
    'If it is not food, reply {"name": "Not food", "cal": 0, "protein": 0, "emoji": "🤨", "note": a playful line saying so}.';
  try {
    const r = await ai.json(prompt, { signal: aiCtl.signal, images: useImage ? [photoFile] : undefined });
    const cal = Math.max(0, Math.round(Number(r && r.cal) || 0));
    const protein = Math.max(0, Math.round(Number(r && r.protein) || 0));
    if (r && r.name && !desc) $("fName").value = String(r.name).slice(0, 60);
    if (r && r.name && desc && /not food/i.test(r.name)) $("fName").value = desc;
    setFoodCal(cal); $("fProt").value = protein;
    updateTotal();
    aiEmoji = r && typeof r.emoji === "string" ? r.emoji.slice(0, 4) : null;
    pickedName = null;
    setAiNote(`🤖 ${fmt(cal)} cal · ${protein}g protein. ${r && r.note ? r.note : ""} Tweak if it's off.`, "ok");
  } catch (e) {
    if (e && e.code === "cancelled") setAiNote("");
    else if (e && (e.code === "not_granted" || e.code === "sampling_disabled" || e.code === "not_declared")) {
      $("aiBox").hidden = true; ai = null;
      $("photoHint").textContent = "Looking good!";
    } else if (e && e.code === "rate_limited") setAiNote("Claude needs a breather. Type the numbers in for now 😮‍💨", "warn");
    else if (e && e.code === "image_rejected") setAiNote("Couldn't read that photo. Try another one 📸", "warn");
    else setAiNote("Hmm, Claude fumbled that one. Tweak the words to try again 🤷", "warn");
  } finally {
  }
}
let aiEmoji = null;

// Cooking oil: about 120 cal per tablespoon, added on top of the food.
const OIL_CAL = 120;
const OIL_LINES = { 0: "", 0.1: "+12 cal. A little spritz, very fancy 💅", 0.5: "+60 cal. A light drizzle, respect.", 1: "+120 cal. One tablespoon, the honest kind.", 2: "+240 cal. Getting slippery 🫠", 3: "+360 cal. Your chapati went for a swim 🏊" };
let oilTbsp = 0, baseCal = "";
const oilCalNow = () => Math.round(oilTbsp * OIL_CAL);
// The Calories box shows food + oil. baseCal remembers the food part.
function setFoodCal(v) {
  baseCal = v === "" ? "" : Math.max(0, Math.round(+v || 0));
  syncCal();
}
function syncCal() {
  const oil = oilCalNow();
  $("fCal").value = baseCal === "" ? (oil ? oil : "") : baseCal + oil;
  updateTotal();
}
function setOil(t) {
  oilTbsp = t;
  document.querySelectorAll("#oilOpts button").forEach((b) => b.classList.toggle("on", +b.dataset.tbsp === t));
  $("oilAdd").textContent = OIL_LINES[t] || "";
  syncCal();
}
function updateTotal() {
  const total = Math.max(0, +$("fCal").value || 0);
  const oil = oilCalNow();
  $("oilTotal").textContent = oil && total ? `Calories now ${fmt(total)} (includes ${fmt(oil)} from oil)` : "";
  $("gobbleBtn").textContent = total ? `Gobble it! ${fmt(total)} cal 🍴` : "Gobble it! 🍴";
}
$("fCal").addEventListener("input", () => {
  const v = $("fCal").value;
  baseCal = v === "" ? "" : Math.max(0, (+v || 0) - oilCalNow());
  updateTotal();
});

document.querySelectorAll("#oilOpts button").forEach((b) => b.addEventListener("click", () => setOil(+b.dataset.tbsp)));
// Estimate automatically once you stop typing (about a second), unless you picked from the list.
let typeTimer;
$("fName").addEventListener("input", () => {
  clearTimeout(typeTimer);
  if (!ai) return;
  const v = $("fName").value.trim();
  if (v.length < 3 || v === pickedName) return;
  typeTimer = setTimeout(estimate, 1100);
});

(async () => {
  if (!window.claude || !window.claude.use) return;
  try {
    ai = await window.claude.use("sample");
    if (!ai) return;
    const lim = await ai.limits().catch(() => null);
    aiImages = !!(lim && lim.images);
    $("aiBox").hidden = false;
  } catch (e) { ai = null; }
})();

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

$("winsBtn").addEventListener("click", () => { location.href = "wins.html"; });

// ---- Go ----
load();
render();
// Coming from the trophy cabinet's + button: open the meal sheet straight away.
if (location.hash === "#log") { history.replaceState(null, "", location.pathname + location.search); $("addBtn").click(); }

// Midnight rollover: if the date changes while the app is open, start a fresh day.
setInterval(() => {
  if (!DEMO && keyOf(new Date()) !== todayKey) { load(); render(); toast("New day! Tank refilled ⛽"); }
}, 30000);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && !DEMO && keyOf(new Date()) !== todayKey) { load(); render(); }
});
