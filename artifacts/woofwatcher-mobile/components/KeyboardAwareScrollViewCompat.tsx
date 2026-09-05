import {
  KeyboardAwareScrollView,
  KeyboardAwareScrollViewProps,
} from "react-native-keyboard-controller";
import { forwardRef } from "react";
import { Platform, ScrollView, ScrollViewProps } from "react-native";
import { getKeyboardAwareFormScrollProps } from "@/lib/mobileLayout";

type Props = KeyboardAwareScrollViewProps & ScrollViewProps;

export const KeyboardAwareScrollViewCompat = forwardRef<ScrollView, Props>(
  function KeyboardAwareScrollViewCompat(
    {
      bottomOffset,
      children,
      keyboardDismissMode,
      keyboardShouldPersistTaps,
      ...props
    },
    ref,
  ) {
  const defaults = getKeyboardAwareFormScrollProps(Platform.OS);
  const resolvedKeyboardDismissMode = keyboardDismissMode ?? defaults.keyboardDismissMode;
  const resolvedKeyboardShouldPersistTaps = keyboardShouldPersistTaps ?? defaults.keyboardShouldPersistTaps;

  if (Platform.OS === "web") {
    return (
      <ScrollView
        ref={ref}
        keyboardDismissMode={resolvedKeyboardDismissMode}
        keyboardShouldPersistTaps={resolvedKeyboardShouldPersistTaps}
        {...props}
      >
        {children}
      </ScrollView>
    );
  }
  return (
    <KeyboardAwareScrollView
      ref={ref}
      bottomOffset={bottomOffset ?? defaults.bottomOffset}
      keyboardDismissMode={resolvedKeyboardDismissMode}
      keyboardShouldPersistTaps={resolvedKeyboardShouldPersistTaps}
      {...props}
    >
      {children}
    </KeyboardAwareScrollView>
  );
  },
);
