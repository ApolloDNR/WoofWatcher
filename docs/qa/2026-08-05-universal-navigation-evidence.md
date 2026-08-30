# Universal Navigation Evidence — 2026-08-05

Captured and reviewed on 2026-08-07 UTC.

## Verdict

| Gate                                                      | Result                       | Boundary                                                                          |
| --------------------------------------------------------- | ---------------------------- | --------------------------------------------------------------------------------- |
| Exact-source build, export, and static route availability | **PASS**                     | Fixed exact tree; 47/47 runtime routes and 56/56 live-preview routes              |
| Rendered Chromium navigation                              | **PASS**                     | 544/544 checks at both required viewports; 78 screenshots; zero failures/warnings |
| Physical iOS/Android and assistive-technology proof       | **BLOCKED / PENDING NATIVE** | No device-capable iOS or Android environment was available                        |
| Overall release/device verdict                            | **BLOCKED / PENDING NATIVE** | Browser PASS does not satisfy the required native gate                            |

The rendered web gate is complete for this exact export. It does **not** prove
native Back behavior, native haptics, safe-area behavior, large-text layout,
VoiceOver, or TalkBack. Those checks remain release blockers.

## Exact Source and Export Provenance

| Evidence                               | Exact value                                                        |
| -------------------------------------- | ------------------------------------------------------------------ |
| Local commit used to build and capture | `66eff713e7204d02abab2315d9a51059f5ca71c1`                         |
| Durable remote equivalent              | `b6934f7a89e775c2853e4515e4f18820cd60cdfa`                         |
| Shared Git tree                        | `2042f1c2bc7d1066deb4852fd2755cd3580b3ab8`                         |
| Worktree during capture                | Clean                                                              |
| Capture window (UTC)                   | `2026-08-07T01:01:00.064Z`–`2026-08-07T01:01:57.382Z`              |
| Expo entry                             | `_expo/static/js/web/entry-7aa0712991fd1075613ebead7d8e668e.js`    |
| Export `index.html` SHA-256            | `a462ec04657779d06d0709c38f7fd3e9e484bd188e4a16d829d0fdd91b3fe548` |
| Expo entry SHA-256                     | `70e549cc5a9aa17febce4136a6aa9215dd454236e66b1b9bb4d6da5e1100f7f7` |
| Expo entry mtime (UTC)                 | `2026-08-07T01:00:16.635Z`                                         |
| Browser driver                         | Playwright Core `1.62.1`                                           |
| Chromium package                       | `@sparticuz/chromium` `149.0.0`                                    |
| Chromium executable                    | `Chromium 149.0.7827.0`                                            |
| Viewports                              | Phone `390×844`; desktop `1365×700`; device scale factor `1`       |

The harness hashed the Expo index and entry before and after capture. The names
and both hashes remained identical, so no concurrent export rebuild entered
the evidence.

The local and remote commit IDs differ because the authenticated publishing
path recreated the commit object. Their Git tree is byte-identical; the export
and browser run were made from the local commit listed above.

## Exact-Tree Build and Static Gates

Fresh verification on the immutable fixed tree recorded:

- Focused suite: **1,037/1,037 passed**.
- Mobile and root workspace TypeScript: **PASS**.
- PixelLab audit: **150/150 valid**, 0 missing, 0 invalid.
- Mobile beta doctor: **READY FOR EXPORT** with the repository-pinned pnpm
  `10.24.0`; unused bundled pnpm `11.7.0` was reported as one warning.
- Fresh Expo/Metro export: **PASS**, 260 emitted files.
- `build:ci`: **PASS**, including typechecks/builds, PixelLab verification,
  Expo export, runtime smoke, and live-preview proof.
- Runtime static shell availability: **47/47 routes passed**.
- Live-preview static shell availability: **56/56 routes passed**.

The 47 and 56 checks prove that emitted route shells are available over HTTP.
They do not, by themselves, prove client-side redirects, selected tabs, Back,
or history behavior; those claims come from the rendered gate below.

## Shared Manifest Inventory

The browser harness read
`artifacts/woofwatcher-mobile/lib/universalNavigationManifest.json` from the
exact tree instead of maintaining a separate route list.

| Inventory                        | Count | Exact values                                                                                                                                  |
| -------------------------------- | ----: | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Primary tabs                     |     5 | `Home /`, `Log /log`, `Plans /calendar`, `Health /health`, `More /more`                                                                       |
| Health children                  |     9 | `overview`, `health-watch`, `bile-watch`, `medications`, `diet`, `trends`, `records`, `dog-id`, `care-pass`                                   |
| More children                    |    10 | `dog-profile`, `avatar-studio`, `care-team`, `care-team-supplies`, `story-progress`, `adventure`, `woofguide`, `settings`, `privacy`, `legal` |
| Legacy redirects                 |    11 | 10 required routes plus retained `/trends` compatibility                                                                                      |
| Legacy query aliases             |     8 | Two Health aliases and six former More-section aliases                                                                                        |
| Runtime supplemental routes      |     4 | `/sign-in`, `/setup`, `/care-twin-qa`, `/premium`                                                                                             |
| Live-preview supplemental routes |    13 | Auth/setup plus the 11 provider/release QA cockpit surfaces                                                                                   |

The required legacy redirect matrix was:

| Direct route | Canonical destination              | Selected parent |
| ------------ | ---------------------------------- | --------------- |
| `/records`   | `/health?section=records`          | Health          |
| `/reminders` | `/calendar`                        | Plans           |
| `/pack`      | `/more?section=care-team-supplies` | More            |
| `/story`     | `/more?section=story-progress`     | More            |
| `/profile`   | `/more?section=dog-profile`        | More            |
| `/portrait`  | `/more?section=avatar-studio`      | More            |
| `/adventure` | `/more?section=adventure`          | More            |
| `/woofguide` | `/more?section=woofguide`          | More            |
| `/privacy`   | `/more?section=privacy`            | More            |
| `/legal`     | `/more?section=legal`              | More            |

The retained non-required redirect is `/trends` to
`/health?section=trends`. The eight retained aliases are:

- `/health?tab=health` to `/health?section=overview`
- `/health?tab=bile` to `/health?section=bile-watch`
- `/more?section=diet` to `/health?section=diet`
- `/more?section=care-pass` and `/more?section=carepass` to
  `/health?section=care-pass`
- `/more?section=household` and `/more?section=access` to
  `/more?section=care-team`
- `/more?section=career` to `/more?section=story-progress`

The manifest math is exact: `5 + 19 + 11 + 8 + 4 = 47` runtime routes and
`5 + 19 + 11 + 8 + 13 = 56` live-preview routes.

## Rendered Chromium Result

The final harness reported `FINAL_EXACT_COMMIT`, a clean worktree, and
**544/544 passed**, 0 failed, 0 warnings.

| Check category              |      Passed |
| --------------------------- | ----------: |
| Manifest identity           |         3/3 |
| Primary tabs                |       50/50 |
| Canonical children          |     190/190 |
| Required legacy routes      |     220/220 |
| Malformed/unknown fallbacks |       54/54 |
| Re-tap and history behavior |       24/24 |
| Browser/runtime signals     |         2/2 |
| Export provenance           |         1/1 |
| **Total**                   | **544/544** |

At both viewports, the rendered run verified:

- exactly `Home`, `Log`, `Plans`, `Health`, `More` in that order;
- one `aria-selected="true"` tab, a selected shape and color distinct from all
  inactive tabs, 14 px labels, and at least 48×48 for every tab target;
- every one of the 19 Health/More children retained its canonical URL and kept
  its parent selected;
- every required direct legacy route reached the manifest's canonical owner,
  added no duplicate redirect history entry, and Browser Back returned once to
  the preceding Home entry;
- invalid Health/More section values, including an encoded bidi-control value,
  failed closed to the owning root;
- an unknown path rendered the calm recovery surface; its 48 px Home action
  replaced to Home without stacking, and Browser Back returned once to the
  preceding Home entry;
- Home re-tap was idempotent; More-child re-tap replaced to More root; More-root
  re-tap did not stack; Browser Back then returned once to Home; and
- there were zero app-origin console errors, page errors, failed requests, HTTP
  4xx/5xx responses, or console warnings.

The earlier delayed-raster spot-check belonged to the pre-fix Task 6 tree and
was not rerun on this fixed tree. It is intentionally excluded from the exact
evidence here; only this run's standard 78 captures and 544 checks support the
rendered verdict above.

## Screenshot and Report Artifacts

The final exact-commit run produced 78 PNGs: 39 cases at each viewport. They
total 7,579,244 bytes. Representative filenames are:

- `phone-390x844-primary-home.png`
- `desktop-1365x700-primary-more.png`
- `phone-390x844-canonical-child-health-section-records.png`
- `desktop-1365x700-canonical-child-more-section-care-team-supplies.png`
- `phone-390x844-legacy-pack.png`
- `desktop-1365x700-legacy-records.png`
- `phone-390x844-fallback-health-section-e2-80-aerecords.png`
- `desktop-1365x700-fallback-unknown-not-found.png`
- `phone-390x844-history-more-retap-root.png`

The raw evidence is intentionally not committed to Git:

| Artifact                                                | Ephemeral QA path                                          | SHA-256                                                            |
| ------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------ |
| Full JSON report (671,019 bytes)                        | `/tmp/woofwatcher-task7-evidence-VI6NzJ/report.json`       | `b88efd0b8db84b79abbe079060451d57b9578338b403bbe206d204bc5c9cad7c` |
| Screenshot checksum manifest (78 PNGs; 7,579,244 bytes) | `/tmp/woofwatcher-task7-evidence-VI6NzJ/screenshots/*.png` | `95fa8ffbc310e021188fe0f25c81a073c6b12b2572acd854a0bf72c8eeaf9d81` |

The screenshot-manifest digest is the SHA-256 of the lexicographically sorted
`sha256sum` output for all PNG basenames:

```bash
cd /tmp/woofwatcher-task7-evidence-VI6NzJ/screenshots
find . -maxdepth 1 -type f -name '*.png' -printf '%f\0' \
  | LC_ALL=C sort -z \
  | xargs -0 sha256sum \
  | sha256sum
```

These `/tmp` paths are QA-run-local and may disappear when the workspace is
recycled. The hashes identify the artifacts but do not make the ephemeral files
durable. The large report and 78 binary screenshots were kept out of Git to
avoid repository bloat; native evidence must later be stored through the
approved release-evidence path.

## Reproduction Command

From a clean checkout at the exact local commit, first rebuild `.expo-smoke`
with the repository-pinned pnpm `10.24.0`, then run:

```bash
env -u TMPDIR \
  WOOFWATCHER_PROVISIONAL=0 \
  WOOFWATCHER_REQUIRE_CLEAN=1 \
  WOOFWATCHER_EXPECT_SHA=66eff713e7204d02abab2315d9a51059f5ca71c1 \
  WOOFWATCHER_SCREENSHOTS=all \
  WOOFWATCHER_PORT=4317 \
  node /tmp/woofwatcher-task7-browser-harness.cjs
```

The temporary harness README is
`/tmp/woofwatcher-task7-browser-harness-README.md`. The harness and browser
runtime are QA-only `/tmp` tools and do not change the repository, package
manifest, or lockfile.

## Native Blockers and Required Exit Evidence

This Linux `x86_64` workspace cannot complete the physical-device gate:

- `doctor:native-qa`: **BLOCKED** for the unavailable iOS environment and
  missing Android device toolchain.
- iOS: `xcrun` is absent and Linux cannot run the iOS simulator. No physical
  iPhone, TestFlight session, or VoiceOver capture was available.
- Android: `adb` and `emulator` are absent;
  `ANDROID_HOME`/`ANDROID_SDK_ROOT` and `JAVA_HOME` are unset. Java itself is
  present, but the SDK/device toolchain is not.
- Remote native build: the `eas` CLI and an Expo/EAS auth token were not
  available, so this environment could not create or attach a device build.

Before the release/device verdict can move from **BLOCKED / PENDING NATIVE**,
capture and approve, on physical iOS and Android targets:

1. tab order, useful labels/hints, and selected values with VoiceOver and
   TalkBack;
2. large-text navigation without clipping or hidden destinations;
3. native Back and legacy-deep-link history behavior;
4. exactly one native haptic per intended tab interaction; and
5. native safe-area and 48×48 target behavior at the supported device sizes.

Rendered Chromium and browser accessibility state are useful supplemental
proof, but they cannot substitute for any of those native checks.
