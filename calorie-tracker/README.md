# Fuel Up — calorie & step tracker

A playful, mobile-first calorie, protein and step tracker. Built as a PWA first, to be wrapped for iOS/Android later.

## Status
- [x] Step 1: look and feel (time-aware greeting, calorie fuel gauge, protein and steps, coach, next-meal plan) with sample data
- [ ] Step 2: manual meal and step logging, saved per day, midnight reset
- [ ] Step 3: meal estimates from a photo or text via Claude (key kept on a small backend)
- [ ] Step 4: metrics: goal calendar, streaks, badges
- [ ] Step 5: installable PWA, then Capacitor for mobile

## Run it
Open `index.html` in a browser. Add `?hour=9`, `?hour=14` or `?hour=20` to preview morning, afternoon or evening, and `?demo=debt` or `?demo=over` to preview a step-debt day or an over-budget day.

## Rules
- Daily target = 1,935 + 40 × (steps − 4,000) / 1,000, never below 1,500
- Protein target 140 g
- 3 meals a day, up to 800 cal each; if under 800 cal are left or you've snacked, plan 1 more meal
- Extra steps for an 800-cal meal = (800 − remaining) / 40 × 1,000, rounded up to 250
- Calories come first. Over budget? Walk it off: steps = calories over / 40 × 1,000, rounded up to 250
- Steps not walked by midnight roll into tomorrow as a step debt. Debt steps are paid back first and earn no calories, so tomorrow's target uses (steps − debt)
