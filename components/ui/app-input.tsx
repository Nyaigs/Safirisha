import { TextInput, TextInputProps, StyleSheet, View } from "react-native";
import { design } from "../../constants/design";

export function AppInput(props: TextInputProps) {
  return <View style={styles.wrap}><TextInput placeholderTextColor="#84908B" {...props} style={[styles.input, props.style]} /></View>;
}

const styles = StyleSheet.create({
  wrap: { borderWidth: 1, borderColor: design.colors.border, borderRadius: design.radius.md, backgroundColor: design.colors.surface },
  input: { minHeight: 52, paddingHorizontal: design.spacing.md, paddingVertical: design.spacing.sm, color: design.colors.ink, ...design.typography.body },
});
