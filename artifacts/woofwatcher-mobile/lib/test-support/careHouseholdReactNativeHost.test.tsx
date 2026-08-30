import React from "react";

const host = (tag: string) =>
  React.forwardRef<unknown, Record<string, any>>(
    function RendererHost(props, ref) {
      const {
        children,
        accessibilityLabel,
        accessibilityRole,
        accessibilityState,
        accessible: _accessible,
        accessibilityHint: _accessibilityHint,
        accessibilityViewIsModal: _accessibilityViewIsModal,
        importantForAccessibility: _importantForAccessibility,
        onAccessibilityEscape: _onAccessibilityEscape,
        onLongPress: _onLongPress,
        onPress,
        onPressIn: _onPressIn,
        onPressOut: _onPressOut,
        delayLongPress: _delayLongPress,
        contentContainerStyle: _contentContainerStyle,
        hitSlop: _hitSlop,
        keyboardShouldPersistTaps: _keyboardShouldPersistTaps,
        showsVerticalScrollIndicator: _showsVerticalScrollIndicator,
        style,
        disabled,
        ...rest
      } = props;
      const blocked = Boolean(disabled || accessibilityState?.disabled);
      const resolvedStyle =
        typeof style === "function" ? style({ pressed: false }) : style;
      return React.createElement(
        tag,
        {
          ...rest,
          ref,
          role: accessibilityRole,
          "aria-label": accessibilityLabel,
          "aria-busy": accessibilityState?.busy || undefined,
          "aria-selected": accessibilityState?.selected,
          "aria-disabled": blocked || undefined,
          disabled: tag === "button" || tag === "input" ? blocked : undefined,
          onClick: blocked ? undefined : onPress,
          style: resolvedStyle,
        },
        children as React.ReactNode,
      );
    },
  );

export const View = host("div");
export const Text = host("span");
export const Pressable = host("button");
export const ScrollView = host("section");
export const SafeAreaView = host("main");
export const KeyboardAvoidingView = host("div");
export const ActivityIndicator = host("i");
export const Image = host("img");

export function Modal({
  visible,
  children,
}: {
  visible?: boolean;
  children?: React.ReactNode;
}): React.JSX.Element | null {
  return visible ? <div role="dialog">{children}</div> : null;
}

export const TextInput = React.forwardRef<unknown, Record<string, any>>(
  function RendererTextInput(props, ref) {
    const {
      accessibilityLabel,
      onChangeText,
      onSubmitEditing: _onSubmitEditing,
      placeholderTextColor: _placeholderTextColor,
      returnKeyType: _returnKeyType,
      style,
      value,
      ...rest
    } = props;
    return (
      <input
        {...rest}
        ref={ref as never}
        aria-label={accessibilityLabel}
        value={value ?? ""}
        onChange={(event) => onChangeText?.(event.currentTarget.value)}
        style={style}
      />
    );
  },
);

export const AccessibilityInfo = {
  setAccessibilityFocus() {},
  announceForAccessibility() {},
};
type RendererAppState = "active" | "background" | "inactive";
let rendererAppState: RendererAppState = "active";
const appStateListeners = new Set<(state: RendererAppState) => void>();

export const AppState = {
  get currentState(): RendererAppState {
    return rendererAppState;
  },
  addEventListener(
    event: "change",
    listener: (state: RendererAppState) => void,
  ) {
    if (event !== "change") throw new Error(`Unsupported event: ${event}`);
    appStateListeners.add(listener);
    return {
      remove() {
        appStateListeners.delete(listener);
      },
    };
  },
};

export function emitCareHouseholdRendererAppState(
  next: RendererAppState,
): void {
  rendererAppState = next;
  for (const listener of [...appStateListeners]) listener(next);
}

export function resetCareHouseholdRendererAppState(): void {
  rendererAppState = "active";
  appStateListeners.clear();
}
export const Alert = { alert() {} };
export const Share = {
  sharedAction: "sharedAction",
  dismissedAction: "dismissedAction",
  async share() {
    return { action: "dismissedAction" };
  },
};
export const StyleSheet = {
  create<T>(styles: T): T {
    return styles;
  },
};
export const Platform = {
  OS: "web",
  select<T>(choices: { web?: T; default?: T }): T | undefined {
    return choices.web ?? choices.default;
  },
};
export function findNodeHandle(): null {
  return null;
}
export function useColorScheme(): "light" {
  return "light";
}
export function useWindowDimensions() {
  return { width: 390, height: 844, scale: 1, fontScale: 1 };
}

export type ImageStyle = any;
export type ImageSourcePropType = any;
export type LayoutChangeEvent = any;
export type PressableProps = Record<string, any>;
export type StyleProp<T> = T | readonly T[] | null | undefined;
export type TextStyle = Record<string, any>;
export type ViewStyle = Record<string, any>;
