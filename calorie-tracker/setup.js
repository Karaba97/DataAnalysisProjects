// Fuel Up — sign-up: turns body stats + a step goal + a weekly loss goal
// into a daily calorie target and protein target, with honest (goofy) feedback.

const $ = (id) => document.getElementById(id);
const fmt = (n) => Math.round(n).toLocaleString("en-US");
const KCAL_PER_KG = 7700;

let sex = "m";
document.querySelectorAll("#sex button").forEach((b) =>
  b.addEventListener("click", () => {
    sex = b.dataset.v;
    document.querySelectorAll("#sex button").forEach((x) => x.classList.toggle("on", x === b));
    update();
  })
);

// Verdict levels: easy (you can do better), good, hard (too much)
function stepsVerdict(s) {
  if (s < 4000) return ["easy", "🥔 Couch potato mode. Your sofa loves you. Your heart doesn't. You can do better than that!"];
  if (s < 7000) return ["easy", "🚶 Warm-up level. Fine for a Sunday. You can do better than that 😏"];
  if (s < 12000) return ["good", "🎯 Sweet spot! Walkable every day, and you'll still have knees at 50."];
  if (s < 16000) return ["good", "🔥 Beast mode. Doable, but that's ~2 hours of walking. Got shoes?"];
  return ["hard", "🐫 That's a part-time job, not a step goal. Your knees just filed a complaint. Too hard!"];
}
function lossVerdict(kg) {
  if (kg === 0) return ["easy", "😴 Zero? That's maintenance, not a mission. You can do better than that!"];
  if (kg < 0.25) return ["easy", "🐌 Snail pace. You'll get there… around 2029. You can do better than that."];
  if (kg <= 0.75) return ["good", "🎯 Sweet spot. Fat goes, muscle stays, and you stay nice to people."];
  if (kg <= 1) return ["good", "🌶️ Spicy! Doable, but you'll stare at other people's chapati."];
  return ["hard", "🦖 Too hard! You'll be hangry, lose muscle, and bite a colleague. Ease up."];
}

function plan() {
  const age = +$("age").value || 29, h = +$("height").value || 164, w = +$("weight").value || 74;
  const steps = +$("steps").value, loss = +$("loss").value;
  const bmr = 10 * w + 6.25 * h - 5 * age + (sex === "m" ? 5 : -161); // Mifflin-St Jeor
  const calPer1k = Math.round(0.55 * w); // ~40 cal per 1,000 steps at 74 kg
  const maintenance = bmr * 1.2 + (calPer1k * steps) / 1000;
  const minCal = sex === "m" ? 1500 : 1200;
  const wanted = (loss * KCAL_PER_KG) / 7;
  const calTarget = Math.max(minCal, Math.round((maintenance - wanted) / 5) * 5);
  const deficit = Math.max(0, maintenance - calTarget);
  const proteinTarget = Math.round((w * (loss > 0.75 ? 2.1 : 1.9)) / 5) * 5; // more protein on a harder cut
  return { name: $("name").value.trim() || "Champ", sex, age, height: h, weight: w, stepGoal: steps, loss,
    calPer1k, minCal, maintenance, calTarget, deficit, proteinTarget, floored: maintenance - wanted < minCal };
}

function update() {
  const p = plan();
  $("stepsOut").textContent = fmt(p.stepGoal);
  $("lossOut").textContent = p.loss.toFixed(2).replace(/0$/, "") + " kg";
  const sv = stepsVerdict(p.stepGoal), lv = lossVerdict(p.loss);
  $("stepsVerdict").textContent = sv[1]; $("stepsVerdict").className = "verdict " + sv[0];
  $("lossVerdict").textContent = lv[1]; $("lossVerdict").className = "verdict " + lv[0];

  $("calOut").textContent = fmt(p.calTarget);
  $("protOut").textContent = p.proteinTarget + "g";
  $("defOut").textContent = "−" + fmt(p.deficit);
  $("weeksOut").textContent = ((p.deficit * 7 * 12) / 7700).toFixed(1);
  $("mathOut").textContent = `You burn about ${fmt(p.maintenance)} cal a day at ${fmt(p.stepGoal)} steps. Walk less and the target shrinks; walk more and you earn snacks. Protein resets every day; calories and steps carry over.`;

  let coach;
  if (p.floored) coach = `🚨 That would put you under ${fmt(p.minCal)} cal. Your body will rage-quit. I've capped it, so walk more or slow the loss.`;
  else if (sv[0] === "hard" || lv[0] === "hard") coach = "Easy, tiger 🐯 Big goals crash by Wednesday. Pick something you'd still do on a rainy Monday.";
  else if (sv[0] === "easy" && lv[0] === "easy") coach = "Ha! Nice try 😂 This plan is basically a nap. You can do better than that!";
  else if (sv[0] === "easy" || lv[0] === "easy") coach = "Not bad… but I've seen you. You can do better than that 😏 Nudge a slider!";
  else coach = "Chef's kiss 🤌 Hard enough to work, easy enough to keep. Let's goooo!";
  $("coach").textContent = coach;
}

["name", "age", "height", "weight", "steps", "loss"].forEach((id) => $(id).addEventListener("input", update));

$("go").addEventListener("click", () => {
  const p = plan();
  try { localStorage.setItem("fuelup.plan", JSON.stringify(p)); } catch (e) { /* storage blocked */ }
  location.href = "index.html";
});

// Prefill from a saved plan
try {
  const saved = JSON.parse(localStorage.getItem("fuelup.plan"));
  if (saved) {
    ["name", "age", "height", "weight"].forEach((k) => saved[k] != null && ($(k).value = saved[k]));
    if (saved.stepGoal) $("steps").value = saved.stepGoal;
    if (saved.loss != null) $("loss").value = saved.loss;
    if (saved.sex) document.querySelector(`#sex [data-v="${saved.sex}"]`).click();
  }
} catch (e) { /* ignore */ }

// Screenshot helper: ?steps=…&loss=…
const qs = new URLSearchParams(location.search);
if (qs.has("steps")) $("steps").value = qs.get("steps");
if (qs.has("loss")) $("loss").value = qs.get("loss");
update();
