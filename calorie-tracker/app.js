// Fuel Up — step 1: look and feel with sample data.
// Logic mirrors the meal-step-logger rules.

const PROFILE = { name: "Trevor", nick: "Trev", proteinTarget: 140, mealsPerDay: 3, mealCap: 800 };

// Sample day (replaced by real logging in step 2)
const today = {
  steps: 3000,
  meals: [
    { emoji: "🫓", name: "Chapati, eggs & beans", type: "meal", time: "10:40", cal: 950, protein: 62 },
    { emoji: "🥜", name: "Groundnuts & mala", type: "snack", time: "13:15", cal: 335, protein: 20 },
  ],
};

// ---- Rules ----
function dailyTarget(steps) {
  return Math.max(1500, Math.round(1935 + 40 * (steps - 4000) / 1000));
}
function round250(n) { return Math.round(n / 250) * 250; }
function extraStepsFor(desired, remaining) {
  if (remaining >= desired) return 0;
  return round250(((desired - remaining) / 40) * 1000);
}

// ---- Time of day ----
const params = new URLSearchParams(location.search);
const now = new Date();
const hour = params.has("hour") ? Number(params.get("hour")) : now.getHours();

function period(h) {
  if (h < 5) return "night";
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  if (h < 21) return "evening";
  return "night";
}
const SKY = { morning: "🌤️", afternoon: "☀️", evening: "🌇", night: "🌙" };

// ---- Compute ----
const fmt = (n) => n.toLocaleString("en-US");
const target = dailyTarget(today.steps);
const eaten = today.meals.reduce((s, m) => s + m.cal, 0);
const protein = today.meals.reduce((s, m) => s + m.protein, 0);
const remaining = target - eaten;
const mainMeals = today.meals.filter((m) => m.type === "meal").length;
const snacks = today.meals.filter((m) => m.type === "snack").length;

let mealsLeft = Math.max(0, PROFILE.mealsPerDay - mainMeals);
if (remaining < PROFILE.mealCap || snacks > 0) mealsLeft = Math.min(mealsLeft, 1);
const budgetNow = Math.max(0, mealsLeft ? Math.min(PROFILE.mealCap, Math.floor(remaining / mealsLeft)) : remaining);
const extra = extraStepsFor(PROFILE.mealCap, remaining);
const proteinLeft = Math.max(0, PROFILE.proteinTarget - protein);

// ---- Greeting ----
const p = period(hour);
const greetWord = { morning: "Good morning", afternoon: "Good afternoon", evening: "Good evening", night: "Late night" }[p];
const name = p === "morning" ? PROFILE.name : PROFILE.nick;
const hero = document.getElementById("hero");
hero.classList.add(p);
document.getElementById("sky").textContent = SKY[p];
document.getElementById("greeting").textContent = `${greetWord}, ${name}`;
document.getElementById("date").textContent = now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" });

function mealsPhrase() {
  const parts = [];
  if (mainMeals) parts.push(`${mainMeals} meal${mainMeals > 1 ? "s" : ""}`);
  if (snacks) parts.push(`${snacks > 1 ? snacks + " snacks" : "a snack"}`);
  return parts.join(" and ");
}
let sub;
if (!today.meals.length) sub = p === "morning" ? "Let's start the day. Your tank is full." : "Nothing logged yet. What's on the plate?";
else if (p === "morning") sub = `Strong start: ${mealsPhrase()} down. Here's your gauge.`;
else if (p === "night") sub = `You had ${mealsPhrase()} today. Here's how it landed.`;
else sub = `You've had ${mealsPhrase()}. Here's your gauge.`;
document.getElementById("subGreeting").textContent = sub;

// ---- Calorie gauge ----
const arc = document.getElementById("calArc");
const len = arc.getTotalLength();
const frac = Math.min(1, eaten / target);
arc.style.strokeDasharray = len;
arc.style.strokeDashoffset = len;
const over = eaten > target;
arc.classList.toggle("over", over);
document.getElementById("calEaten").textContent = fmt(eaten);
document.getElementById("calTarget").textContent = fmt(target);
const leftEl = document.getElementById("calLeft");
leftEl.textContent = over ? fmt(-remaining) + " over" : fmt(remaining);
leftEl.classList.toggle("over", over);
if (over) leftEl.parentElement.lastChild.textContent = " budget";
const pill = document.getElementById("calPill");
pill.textContent = over ? "Over target" : "Under target";
pill.classList.toggle("over", over);
const stepAdj = target - 1935;
document.getElementById("targetNote").textContent =
  `Target ${fmt(target)} = 1,935 base ${stepAdj >= 0 ? "+" : "−"} ${fmt(Math.abs(stepAdj))} from ${fmt(today.steps)} steps. Walk more, earn more.`;

// ---- Protein & steps ----
document.getElementById("protEaten").textContent = protein;
document.getElementById("protTarget").textContent = PROFILE.proteinTarget;
const protBar = document.getElementById("protBar");
const protMet = protein >= PROFILE.proteinTarget;
protBar.classList.toggle("met", protMet);
const protFoot = document.getElementById("protFoot");
protFoot.textContent = protMet ? "Goal smashed 💪" : `${proteinLeft} g to go`;
protFoot.className = "mini-foot " + (protMet ? "green" : "red");

document.getElementById("steps").textContent = fmt(today.steps);
const stepGoal = today.steps + extra || 4000;
const stepFoot = document.getElementById("stepFoot");
stepFoot.textContent = extra ? `+${fmt(extra)} unlocks 800 cal` : "Base 4,000 covered";

// ---- Coach ----
function coachLine() {
  if (over) return `We're ${fmt(-remaining)} over. No stress. A long walk tonight and a lighter plate tomorrow evens it out.`;
  if (!today.meals.length) return p === "morning"
    ? "New day, full tank! Aim for a protein-heavy breakfast. Eggs, beans or omena are your friends."
    : "Haven't seen any food yet. Don't skip, log your first meal when you eat.";
  if (proteinLeft > 40) return `Calories look good, but protein is ${proteinLeft} g short. Make dinner a chicken, beef or fish plate with greens.`;
  if (remaining < PROFILE.mealCap) return `${fmt(remaining)} cal left for one more meal. Walk ${fmt(extra)} more steps and dinner grows to 800.`;
  return "Right on pace. Keep the plates balanced and the legs moving.";
}
document.getElementById("coach").textContent = coachLine();

// ---- Plan ----
document.getElementById("mealsLeftPill").textContent = mealsLeft === 1 ? "1 meal left" : `${mealsLeft} meals left`;
document.getElementById("budgetNow").textContent = fmt(budgetNow);
document.getElementById("extraSteps").textContent = extra ? "+" + fmt(extra) : "0";
let planNote = snacks > 0 ? "You've snacked, so we plan just one more meal today. " : "";
if (extra > 10000) planNote += "That's a lot of walking. A smaller meal is the realistic move.";
else if (extra > 0) planNote += `That's about ${Math.round(extra / 100)} minutes of brisk walking.`;
else planNote += "You already have room for a full 800-cal meal.";
document.getElementById("planNote").textContent = planNote;

// ---- Meals list ----
const list = document.getElementById("meals");
today.meals.forEach((m) => {
  const li = document.createElement("li");
  li.innerHTML = `<div class="meal-emoji">${m.emoji}</div>
    <div class="meal-info"><div class="meal-name"></div><div class="meal-meta">${m.type === "snack" ? "Snack" : "Meal"} · ${m.time} · ${m.protein} g protein</div></div>
    <div class="meal-cal">${fmt(m.cal)}<small>cal</small></div>`;
  li.querySelector(".meal-name").textContent = m.name;
  list.appendChild(li);
});
if (mealsLeft) {
  const li = document.createElement("li");
  li.className = "ghost";
  li.innerHTML = `<div class="meal-emoji">🍽️</div>
    <div class="meal-info"><div class="meal-name">${p === "morning" ? "Lunch" : "Dinner"}</div><div class="meal-meta">Up to ${fmt(budgetNow)} cal · aim for ${proteinLeft} g protein</div></div>
    <div class="meal-cal">${fmt(budgetNow)}<small>left</small></div>`;
  list.appendChild(li);
}
document.getElementById("mealCount").textContent = `${today.meals.length} logged`;

// ---- Animate in ----
requestAnimationFrame(() => setTimeout(() => {
  arc.style.strokeDashoffset = len * (1 - frac);
  document.getElementById("needle").style.transform = `rotate(${-90 + 180 * frac}deg)`;
  protBar.style.width = Math.min(100, (protein / PROFILE.proteinTarget) * 100) + "%";
  document.getElementById("stepBar").style.width = Math.min(100, (today.steps / stepGoal) * 100) + "%";
}, 150));
