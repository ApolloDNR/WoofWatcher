# See WoofWatcher on your phone (plain-English guide)

Written for a non-coder. The goal: put the real app in your hands so **you**
decide it's ready — before spending a cent on Apple or Google.

Quick truth up front: nobody can promise an app "won't glitch" until it has run
on a real phone. It has passed heavy testing in a browser and it builds cleanly
into a real iOS and Android app — but it has not yet run on physical hardware.
These steps close that gap. Do them in order; stop whenever you're satisfied.

---

## Step 1 — The 60-second look (free, no accounts, do this first)

This opens the **web version** of the real app in your phone's browser. Same
screens, same navigation, same design — just running in Safari/Chrome instead
of as an installed app.

1. Open the WoofWatcher project on Replit.
2. Press the green **Run** button (or **Deploy**). A little web preview appears
   with a web address (URL) at the top.
3. Copy that URL and open it in the browser **on your phone**.
4. Tap around: the home room, log a meal or a walk, open every tab along the
   bottom, switch your phone to dark mode and look again.

**What this proves:** the look, the feel, the navigation, whether it reads as a
professional app on a real phone screen.
**What it can't prove:** vibration/haptics, the native share sheet, and raw
speed — those only exist in the installed app (Steps 2–3).

---

## Step 2 — The real Android app, free (~20 minutes, one free account)

If you have (or can borrow) an **Android** phone, this gives you the actual
installed app to keep and test — no money, no Apple.

1. Make a free account at **expo.dev** (email + password).
2. On any computer, open a terminal and run these three lines once:
   ```
   npm install -g eas-cli
   eas login
   eas build -p android --profile preview
   ```
   (It's already set up in this project to produce an installable `.apk`.)
3. Wait ~15 minutes. Expo gives you a download link when it's done.
4. Open that link **on the Android phone**, download the `.apk`, and tap it to
   install (you may need to allow "install from this source" once).

**This is the real native app** — it tests everything, including vibration, the
share sheet, and speed.

---

## Step 3 — The real app on an iPhone

Apple does not allow a free way to put an app on an iPhone without a Mac. Honest
options:

- **Have a Mac?** A Mac with the free Xcode app can load it onto your own iPhone
  for 7 days at a time, no payment. (This is a bit technical — ask for a
  walkthrough.)
- **No Mac?** This is the one place the **$99/year Apple Developer** account is
  required, which then unlocks **TestFlight** (Apple's official way to try an app
  before it's public). If Steps 1–2 already look and feel great, this is a safe
  spend.

This iPhone limitation is Apple's rule, not a shortcoming of the app.

---

## What to check once it's on your phone (the 3-minute test)

- Log a **meal**, a **walk**, and a **potty** from the paw button — each saves
  instantly and shows up.
- Open **every tab** along the bottom; nothing should look broken or cut off.
- Switch your phone to **dark mode** and glance through again — text stays
  readable, the room goes to night.
- Open **Records → share the Dog ID**, and **Care Pass → share** — the share
  sheet should appear.
- Just live in it for a minute. Does it feel like something you'd pay for?

If anything feels off, note which screen and what happened — that's exactly what
gets fixed next, before any public launch.
