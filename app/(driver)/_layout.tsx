import { Ionicons } from "@expo/vector-icons";
import { Redirect, Tabs } from "expo-router";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { design } from "../../constants/design";
import { useAuthStore } from "../../store/auth";

const TABS = [
  { name: "index", title: "Home", icon: "home", iconOutline: "home-outline" },
  { name: "jobs", title: "Jobs", icon: "briefcase", iconOutline: "briefcase-outline" },
  { name: "earnings", title: "Earnings", icon: "wallet", iconOutline: "wallet-outline" },
  { name: "profile", title: "Profile", icon: "person", iconOutline: "person-outline" },
] as const;

function FloatingTabBar({ state, navigation }: any) {
  const insets = useSafeAreaInsets();
  const visibleRoutes = state.routes.filter((r: any) =>
    TABS.some((t) => t.name === r.name)
  );
  return (
    <View style={[styles.wrapper, { bottom: Math.max(insets.bottom, 16) }]} pointerEvents="box-none">
      <View style={styles.pill}>
        {visibleRoutes.map((route: any) => {
          const realIndex = state.routes.findIndex((r: any) => r.key === route.key);
          const focused = state.index === realIndex;
          const tab = TABS.find((t) => t.name === route.name)!;
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

export default function DriverLayout() {
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const hasHydrated = useAuthStore((state) => state.hasHydrated);

  if (!hasHydrated) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={design.colors.ink} />
      </View>
    );
  }

  if (!user || !token || user.role !== "DRIVER") {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: "#F5F5F5" },
      }}
      tabBar={(props) => <FloatingTabBar {...props} />}
    >
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="jobs" options={{ title: "Jobs" }} />
      <Tabs.Screen name="earnings" options={{ title: "Earnings" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
      <Tabs.Screen name="kyc" options={{ href: null }} />
      <Tabs.Screen name="active-trip" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#F5F5F5" },
  wrapper: { position: "absolute", left: 0, right: 0 },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    backgroundColor: design.colors.white,
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderRadius: 40,
    marginHorizontal: 60,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 14,
    elevation: 12,
    gap: 4,
  },
  tab: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 4, gap: 1 },
  label: { fontSize: 10, fontWeight: "600" },
});
