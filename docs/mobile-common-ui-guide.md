# Mobile Common UI Guide

Use this guide when adding or touching mobile screens. The goal is to keep loading, empty, error, form, and feedback UI consistent across Orbit.

## Common Building Blocks

| Need | Use | Location |
| --- | --- | --- |
| Text | `AppText` | `mobile/src/ui/AppText.tsx` |
| Theme colors/fonts/tokens | `useOrbitTheme`, `Spacing`, `FontSizes`, `BorderRadius` | `mobile/src/theme/` |
| Screen/section loading | `StateView type="loading"` | `mobile/src/components/StateView.tsx` |
| Empty or fetch-error screen states | `StateView type="empty"` / `StateView type="error"` | `mobile/src/components/StateView.tsx` |
| Brand loader only | `OrbitLoader` | `mobile/src/components/OrbitLoader.tsx` |
| Render crash fallback | `ErrorBoundary` | `mobile/src/components/ErrorBoundary.tsx` |
| User-visible mutation feedback | `useToast()` | `mobile/src/context/ToastContext.tsx` |
| API error copy | `formatApiError(error)` | `mobile/src/utils/apiErrors.ts` |
| Form field errors | `Input` with `error` | `mobile/src/components/Input.tsx` |
| CTA loading state | `GradientButton` with `loading` | `mobile/src/components/GradientButton.tsx` |

## Loading States

Use `StateView` for a whole screen or large section:

```tsx
import { StateView } from '../src/components';

if (isLoading) {
  return <StateView type="loading" title="Loading catchups" />;
}
```

Use `OrbitLoader` directly for small inline areas or overlays:

```tsx
<OrbitLoader variant="inline" size="sm" />
```

Use a button's built-in loading prop for button submits:

```tsx
<GradientButton title="Save" loading={mutation.isPending} onPress={save} />
```

## Empty States

Prefer `StateView` instead of custom one-off empty blocks:

```tsx
<StateView
  type="empty"
  title="Nothing happening nearby yet"
  description="Create a catchup or check again later."
  actionLabel="Create catchup"
  onAction={openCreateSheet}
/>
```

Keep empty-state copy short and specific. Avoid explaining the whole feature.

## Errors

Use `ErrorBoundary` for render/lifecycle crashes. It is already mounted near the app root in `mobile/app/_layout.tsx`.

Use `StateView type="error"` for recoverable fetch errors:

```tsx
if (isError) {
  return (
    <StateView
      type="error"
      title="Could not load notifications"
      description="Check your connection and try again."
      actionLabel="Retry"
      onAction={() => refetch()}
    />
  );
}
```

Use toasts for mutation failures and short feedback:

```tsx
const toast = useToast();

try {
  await mutation.mutateAsync(payload);
  toast.success('Saved');
} catch (error) {
  toast.error(formatApiError(error));
}
```

Use `Alert.alert` only for confirmations, destructive choices, permission blockers, or native-system prompts.

## Forms

Use `Input` for labeled text fields with validation:

```tsx
<Input
  label="Username"
  value={username}
  onChangeText={setUsername}
  error={usernameError}
  icon="person-outline"
/>
```

For server errors, normalize with `formatApiError(error)` before showing it in a toast or inline message.

## Current Audit Notes

- Shared pieces already exist for text, theme, loader, error boundary, toast, input, and buttons.
- `StateView` was added to cover the repeated loading/empty/error screen-state pattern.
- Several older screens still use local `ActivityIndicator` and custom empty/error blocks. Do not refactor them casually, but when touching those screens, migrate large states to `StateView`.
- Inline spinners inside controls are fine when the control already owns that loading state.

## Import Pattern

Prefer importing shared components from the barrel:

```tsx
import { GradientButton, OrbitLoader, StateView } from '../../src/components';
import { AppText } from '../../src/ui';
```

Use direct imports only when there is a circular import or platform-specific reason.
