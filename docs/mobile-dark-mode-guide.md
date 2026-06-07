# Mobile Dark Mode Guide

This app uses the Orbit theme layer for light, dark, and system appearance.
When changing UI, prefer theme tokens over hard-coded colors so screens stay
readable in both modes.

## Central Files

- `mobile/src/theme/ThemeProvider.tsx`
  - Resolves `light`, `dark`, or `system`.
  - Exposes `useOrbitTheme()`.
- `mobile/src/theme/palettes.ts`
  - Owns light and dark color palettes plus shadows.
- `mobile/src/stores/themeStore.ts`
  - Persists the user preference: `light`, `dark`, or `system`.

## Local Testing

For quick testing, temporarily force the scheme in `ThemeProvider.tsx`:

```ts
const FORCE_SCHEME: 'light' | 'dark' | null = 'dark';

function resolveActiveScheme(preference, systemScheme) {
  if (FORCE_SCHEME) return FORCE_SCHEME;
  if (preference === 'system') return systemScheme === 'dark' ? 'dark' : 'light';
  return preference;
}
```

Set `FORCE_SCHEME` back to `null` before committing.

## Component Pattern

Use `useOrbitTheme()` inside UI components:

```tsx
const { colors, shadows, resolvedScheme } = useOrbitTheme();

return (
  <View style={{ backgroundColor: colors.background.card, borderColor: colors.borderLight }}>
    <AppText style={{ color: colors.text.primary }}>Title</AppText>
  </View>
);
```

Prefer these token groups:

- Backgrounds: `colors.background.primary`, `secondary`, `card`, `elevated`
- Text: `colors.text.primary`, `secondary`, `tertiary`, `muted`
- Borders: `colors.border`, `colors.borderLight`
- Actions: `colors.primary.default`, `start`, `end`
- Status: `colors.success`, `warning`, `error`, `info`
- Overlays: `colors.overlay`

## Checklist For UI Changes

- Avoid fixed `#FFFFFF`, `#FAFAFA`, `#0D0D0D`, and similar app-surface colors.
- Set `placeholderTextColor={colors.text.muted}` for inputs.
- Use themed borders on cards, chips, sheets, and dropdowns.
- Use `resolvedScheme` only when behavior truly differs by mode.
- Keep the bottom navbar styling unchanged unless a task explicitly asks for it.
- Test landing, login, signup, feed, event detail, create/edit sheets, and modals.
- Run `npx tsc --noEmit` from `mobile/` before opening a PR.
