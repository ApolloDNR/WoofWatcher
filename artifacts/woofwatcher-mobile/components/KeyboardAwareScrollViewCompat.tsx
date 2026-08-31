import {
  KeyboardAwareScrollView,
  KeyboardAwareScrollViewProps,
} from "react-native-keyboard-controller";
import { Platform, ScrollView, ScrollViewProps } from "react-native";
import { getKeyboardAwareFormScrollProps } from "@/lib/mobileLayout";

type Props = KeyboardAwareScrollViewProps & ScrollViewProps;

export function KeyboardAwareScrollViewCompat({
  bottomOffset,
  children,
  keyboardDismissMode,
  keyboardShouldPersistTaps,
  ...props
}: Props) {
  const defaults = getKeyboardAwareFormScrollProps(Platform.OS);
  const resolvedKeyboardDismissMode = keyboardDismissMode ?? defaults.keyboardDismissMode;
  const resolvedKeyboardShouldPersistTaps = keyboardShouldPersistTaps ?? defaults.keyboardShouldPersistTaps;

  if (Platform.OS === "web") {
    return (
      <ScrollView
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
      bottomOffset={bottomOffset ?? defaults.bottomOffset}
      keyboardDismissMode={resolvedKeyboardDismissMode}
      keyboardShouldPersistTaps={resolvedKeyboardShouldPersistTaps}
      {...props}
    >
      {children}
    </KeyboardAwareScrollView>
  );
}
