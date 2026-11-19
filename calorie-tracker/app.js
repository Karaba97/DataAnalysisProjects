// Fuel Up — step 1 preview with sample data.
//
// Calories come first. Steps earn (or cost) calories at 40 cal per 1,000 steps
// above or below a 4,000-step base. Go over your calories and the app tells you
// how many steps burn it off. Steps you don't walk by midnight roll into
// tomorrow as a step debt: those steps don't earn any calories until repaid.

// Goals come from the sign-up screen (setup.html). Until then, Trevor's current plan.
const DEFAULT_PLAN = { name: "Trevor", calTarget: 1935, stepGoal: 4000, proteinTarget: 140, calPer1k: 40, minCal: 1500 };
let saved = null;
try { saved = JSON.parse(localStorage.getItem("fuelup.plan")); } catch (e) { /* storage blocked */ }
const PLAN = { ...DEFAULT_PLAN, ...(saved || {}) };
const PROFILE = { name: PLAN.name, nick: PLAN.name.length > 5 ? PLAN.name.slice(0, 4) : PLAN.name, proteinTarget: PLAN.proteinTarget, mealsPerDay: 3, mealCap: 800 };
const BASE_CAL = PLAN.calTarget, BASE_STEPS = PLAN.stepGoal, CAL_PER_1K = PLAN.calPer1k, MIN_CAL = PLAN.minCal;

// ---- Sample days (real logging arrives in step 2) ----
const DEMOS = {
  today: {
    debt: 0, steps: 3000,
    meals: [
      { emoji: "🫓", name: "Chapati, eggs & beans", type: "meal", time: "10:40", cal: 950, protein: 62 },
      { emoji: "🥜", name: "Groundnuts & mala", type: "snack", time: "13:15", cal: 335, protein: 20 },
    ],
  },
  debt: {
    debt: 2000, steps: 1500,
    meals: [
      { emoji: "🫓", name: "Chapati, eggs & beans", type: "meal", time: "10:40", cal: 950, protein: 62 },
      { emoji: "🥜", name: "Groundnuts & mala", type: "snack", time: "13:15", cal: 335, protein: 20 },
    ],
  },
  over: {
    debt: 0, steps: 5000,
    meals: [
      { emoji: "🫓", name: "Chapati, eggs & beans", type: "meal", time: "10:40", cal: 950, protein: 62 },
      { emoji: "🥜", name: "Groundnuts & mala", type: "snack", time: "13:15", cal: 335, protein: 20 },
      { emoji: "🍛", name: "Pilau & beef fry", type: "meal", time: "19:30", cal: 900, protein: 45 },
    ],
  },
};

const params = new URLSearchParams(location.search);
const today = DEMOS[params.get("demo")] || DEMOS.today;

// ---- Rules ----
const round250 = (n) => Math.ceil(n / 250) * 250;
const stepsFor = (cal) => round250((cal / CAL_PER_1K) * 1000);
function dailyTarget(steps, debt) {
  const earningSteps = steps - debt; // debt steps are paid back first
  return Math.max(MIN_CAL, Math.round(BASE_CAL + CAL_PER_1K * (earningSteps - BASE_STEPS) / 1000));
}

// ---- Compute ----
const fmt = (n) => Math.round(n).toLocaleString("en-US");
const target = dailyTarget(today.steps, today.debt);
const eaten = today.meals.reduce((s, m) => s + m.cal, 0);
const protein = today.meals.reduce((s, m) => s + m.protein, 0);
const remaining = target - eaten;
const over = remaining < 0;
const burnSteps = over ? stepsFor(-remaining) : 0; // becomes tomorrow's debt if not walked
const mainMeals = today.meals.filter((m) => m.type === "meal").length;
const snacks = today.meals.filter((m) => m.type === "snack").length;
let mealsLeft = Math.max(0, PROFILE.mealsPerDay - mainMeals);
if (remaining < PROFILE.mealCap || snacks > 0) mealsLeft = Math.min(mealsLeft, 1);
const nextMealBudget = over ? 0 : mealsLeft ? Math.min(PROFILE.mealCap, Math.floor(remaining / mealsLeft)) : remaining;
const feastSteps = !over && remaining < PROFILE.mealCap ? stepsFor(PROFILE.mealCap - remaining) : 0;
const proteinLeft = Math.max(0, PROFILE.proteinTarget - protein);
const stepGoal = BASE_STEPS + today.debt + burnSteps;

// ---- Time of day ----
const now = new Date();
const hour = params.has("hour") ? Number(params.get("hour")) : now.getHours();
const p = hour < 5 ? "night" : hour < 12 ? "morning" : hour < 17 ? "afternoon" : hour < 21 ? "evening" : "night";
const $ = (id) => document.getElementById(id);

const GREET = {
  morning: [`Rise & dine, ${PROFILE.name}!`, "🌞"],
  afternoon: [`Yo ${PROFILE.nick}!`, "😎"],
  evening: [`Evening, ${PROFILE.nick}!`, "🌛"],
  night: [`Night owl ${PROFILE.nick}!`, "🦉"],
};
$("hero").classList.add(p);
$("greeting").textContent = GREET[p][0];
$("sky").textContent = GREET[p][1];
$("date").textContent = now.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });

const bites = [mainMeals && `${mainMeals} meal${mainMeals > 1 ? "s" : ""}`, snacks && `${snacks} snack${snacks > 1 ? "s" : ""}`].filter(Boolean).join(" + ");
$("subGreeting").textContent = !today.meals.length
  ? "Tank's full. Let's roll!"
  : over ? `${bites} down. Oops, overfilled 🫣`
  : `${bites} down. Gauge looks tasty.`;

// ---- Step debt banner ----
if (today.debt) {
  const left = Math.max(0, today.debt - today.steps);
  $("debt").hidden = false;
  const debtCal = Math.round(today.debt / 1000 * CAL_PER_1K);
  $("debtTitle").textContent = left ? `Step debt: ${fmt(left)} to go` : "Debt paid off! 🎉";
  $("debtText").textContent = left
    ? `Yesterday ran ${fmt(debtCal)} cal over, so today starts at −${fmt(debtCal)} cal and +${fmt(today.debt)} steps.`
    : `You walked off yesterday's ${fmt(debtCal)} cal. Steps earn cal again.`;
}

// ---- Gauge ----
const arc = $("calArc");
const len = arc.getTotalLength();
const frac = Math.min(1, eaten / target);
arc.style.strokeDasharray = len;
arc.style.strokeDashoffset = len;
arc.classList.toggle("over", over);
$("hubFace").textContent = over ? "🫣" : frac > 0.85 ? "😬" : "😋";
$("calLeftBig").textContent = fmt(Math.abs(remaining));
$("calLeftBig").classList.toggle("over", over);
$("calLeftLabel").textContent = over ? "cal over" : "cal left";
$("calEaten").textContent = fmt(eaten);
$("calTarget").textContent = fmt(target);
$("calPill").textContent = over ? "Overfilled!" : frac > 0.85 ? "Nearly full" : "Cruisin'";
$("calPill").classList.toggle("over", over);

// ---- Action card: what to do next ----
const action = $("actionCard");
if (over) {
  action.classList.add("over");
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

// ---- Protein & steps ----
const protMet = protein >= PROFILE.proteinTarget;
$("protEaten").textContent = protein;
$("protTarget").textContent = PROFILE.proteinTarget;
$("protBar").classList.toggle("met", protMet);
$("protFoot").textContent = protMet ? "Beast mode 💪" : `${proteinLeft}g to go · resets at midnight`;

$("steps").textContent = fmt(today.steps);
$("stepFoot").textContent = today.steps >= stepGoal ? "Goal smashed 🎉" : `Goal ${fmt(stepGoal)}`;

// ---- Coach ----
let coach;
if (over) coach = "Ate like a king? Walk like a warrior 🗡️";
else if (today.debt > today.steps) coach = "Slow and steady pays the debt. Lace up! 🐌";
else if (!today.meals.length) coach = "Eggs, beans or omena. Start strong!";
else if (proteinLeft > 40) coach = `Protein's lagging. Kuku or samaki for dinner? 🐔🐟`;
else coach = "You're crushing it. Keep munching smart!";
$("coach").textContent = coach;

// ---- Meals list ----
$("mealCount").textContent = `${today.meals.length} logged`;
today.meals.forEach((m) => {
  const li = document.createElement("li");
  li.innerHTML = `<div class="meal-emoji">${m.emoji}</div>
    <div class="meal-info"><div class="meal-name"></div><div class="meal-meta">${m.time} · ${m.protein}g protein</div></div>
    <div class="meal-cal">${fmt(m.cal)}</div>`;
  li.querySelector(".meal-name").textContent = m.name;
  $("meals").appendChild(li);
});

// ---- Animate in ----
setTimeout(() => {
  arc.style.strokeDashoffset = len * (1 - frac);
  $("needle").style.transform = `rotate(${-90 + 180 * frac}deg)`;
  $("protBar").style.width = Math.min(100, (protein / PROFILE.proteinTarget) * 100) + "%";
  $("stepBar").style.width = Math.min(100, (today.steps / stepGoal) * 100) + "%";
}, 350);
