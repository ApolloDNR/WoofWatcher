---
name: Expo Router tab patterns
description: Non-obvious expo-router behaviors for tab layouts (center action button, route naming).
---

# Expo Router tab gotchas

- **Files starting with `_` are NOT routes.** expo-router treats `_`-prefixed
  files as private/non-route (like `_layout`). A `<Tabs.Screen name="_add">`
  with no matching route file throws "No route named _add exists in nested
  children". Name the screen without the underscore (e.g. `add`) and add a real
  `app/(tabs)/add.tsx` file. If the tab only triggers navigation, the file can
  just `return <Redirect href="/log" />`.

- **Center "+" action button:** use `tabBarButton` (a single interaction
  surface), NOT an interactive `Pressable` nested inside `tabBarIcon`. Combining
  a `Pressable` in `tabBarIcon` with a `listeners.tabPress` handler fires
  navigation/haptics twice per press. One `tabBarButton` with one `onPress`
  (haptics + `router.navigate`) is the idiomatic, single-fire pattern.
