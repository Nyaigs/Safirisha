import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { design } from "../../../constants/design";
import { useUIStore } from "../../../store/ui";

const TABS = [
  { name: "index", title: "Home", icon: "home", iconOutline: "home-outline" },
  { name: "activity", title: "Activity", icon: "time", iconOutline: "time-outline" },
  { name: "account", title: "Account", icon: "person", iconOutline: "person-outline" },
] as const;

function FloatingTabBar({ state, navigation }: any) {
  const insets = useSafeAreaInsets();
  const sheetOpen = useUIStore((s) => s.sheetOpen);
  if (sheetOpen) return null;
  return (
    <View style={[styles.wrapper, { bottom: Math.max(insets.bottom, 16) }]} pointerEvents="box-none">
      <View style={styles.pill}>
        {state.routes.map((route: any, index: number) => {
          const focused = state.index === index;
          const tab = TABS.find((t) => t.name === route.name) ?? TABS[0];
          return (
            <TouchableOpacity
              key={route.key}
              activeOpacity={0.7}
              onPress={() => {
                const event = navigation.emit({
                  type: "tabPress",
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!focused && !event.defaultPrevented) {
                  navigation.navigate(route.name);
                }
              }}
              style={styles.tab}
            >
              <Ionicons
                name={(focused ? tab.icon : tab.iconOutline) as any}
                size={20}
                color={focused ? design.colors.ink : design.colors.muted}
              />
              <Text
                style={[
                  styles.label,
                  { color: focused ? design.colors.ink : design.colors.muted },
                ]}
              >
                {tab.title}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export default function CustomerTabsLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <FloatingTabBar {...props} />}
    >
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="activity" options={{ title: "Activity" }} />
      <Tabs.Screen name="account" options={{ title: "Account" }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    left: 0,
    right: 0,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    backgroundColor: design.colors.white,
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderRadius: 40,
    alignSelf: "stretch",
    marginHorizontal: 60,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 14,
    elevation: 12,
    gap: 4,
  },
  tab: {
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    paddingVertical: 4,
    gap: 1,
  },
  label: {
    fontSize: 10,
    fontWeight: "600",
  },
});
