import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import { design } from "../../constants/design";

type Props = { title: string; description?: string; tone?: "neutral" | "error" | "warning" };

export function StateMessage({ title, description, tone = "neutral" }: Props) {
  const color = tone === "error" ? design.colors.danger : tone === "warning" ? design.colors.warning : design.colors.muted;
  return <View style={styles.wrap}><Ionicons name={tone === "error" ? "alert-circle-outline" : "information-circle-outline"} size={24} color={color} /><View style={styles.copy}><Text style={[styles.title, { color }]}>{title}</Text>{description ? <Text style={styles.description}>{description}</Text> : null}</View></View>;
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", gap: design.spacing.sm, padding: design.spacing.md, borderRadius: design.radius.md, backgroundColor: design.colors.subtle },
  copy: { flex: 1 },
  title: { ...design.typography.label },
  description: { marginTop: design.spacing.xxs, color: design.colors.muted, ...design.typography.caption },
});
