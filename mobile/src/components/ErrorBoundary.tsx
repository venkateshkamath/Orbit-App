import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText } from '../ui/AppText';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  children: React.ReactNode;
  /**
   * Custom fallback UI. Receives the caught error and a `retry` callback
   * that resets the boundary so the children are re-mounted.
   */
  fallback?: (error: Error, retry: () => void) => React.ReactNode;
  /** Called whenever an error is caught — useful for logging to Sentry, etc. */
  onError?: (error: Error, info: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * `ErrorBoundary` — wraps a subtree and catches render/lifecycle errors.
 *
 * @example
 * // Basic usage — default fallback UI
 * <ErrorBoundary>
 *   <MyScreen />
 * </ErrorBoundary>
 *
 * @example
 * // Custom fallback
 * <ErrorBoundary fallback={(err, retry) => <MyFallback error={err} onRetry={retry} />}>
 *   <MyScreen />
 * </ErrorBoundary>
 *
 * @example
 * // With error logging
 * <ErrorBoundary onError={(err, info) => Sentry.captureException(err, { extra: info })}>
 *   <MyScreen />
 * </ErrorBoundary>
 */
export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    this.props.onError?.(error, info);
    if (__DEV__) {
      console.error('[ErrorBoundary] caught error:', error, info.componentStack);
    }
  }

  retry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    if (this.props.fallback && this.state.error) {
      return this.props.fallback(this.state.error, this.retry);
    }

    return <DefaultFallback error={this.state.error} onRetry={this.retry} />;
  }
}

// ─── Default fallback ─────────────────────────────────────────────────────────

function DefaultFallback({
  error,
  onRetry,
}: {
  error: Error | null;
  onRetry: () => void;
}) {
  return (
    <View style={styles.container}>
      <AppText style={styles.emoji}>⚠️</AppText>
      <AppText style={styles.title}>Something went wrong</AppText>
      {__DEV__ && error ? (
        <AppText style={styles.devMessage} numberOfLines={4}>
          {error.message}
        </AppText>
      ) : null}
      <Pressable style={styles.retryBtn} onPress={onRetry}>
        <AppText style={styles.retryText}>Try again</AppText>
      </Pressable>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: '#FFFFFF',
  },
  emoji: {
    fontSize: 40,
    marginBottom: 16,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: '#0D0D0D',
    textAlign: 'center',
    marginBottom: 8,
  },
  devMessage: {
    fontSize: 12,
    color: '#888888',
    textAlign: 'center',
    fontFamily: 'monospace',
    marginBottom: 24,
    lineHeight: 18,
  },
  retryBtn: {
    marginTop: 24,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#0D0D0D',
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
});
