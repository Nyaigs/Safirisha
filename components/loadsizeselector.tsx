import React from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  LOAD_SIZE_OPTIONS,
  LoadSizeOption,
  getLoadSizeByKey,
} from "../constants/loadsizes";
import { LoadSize } from "../types";

type Props = {
  visible: boolean;
  selectedValue: LoadSize | null;
  onClose: () => void;
  onSelect: (value: LoadSize) => void;
};

export default function LoadSizeSelector({
  visible,
  selectedValue,
  onClose,
  onSelect,
}: Props) {
  const selected = getLoadSizeByKey(selectedValue);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />

          <Text style={styles.title}>Select Load Size</Text>
          <Text style={styles.subtitle}>
            Choose the size that best matches the approximate weight of your
            goods.
          </Text>

          {selected ? (
            <View style={styles.selectedCard}>
              <Text style={styles.selectedLabel}>Current selection</Text>
              <Text style={styles.selectedTitle}>{selected.label}</Text>
              <Text style={styles.selectedMeta}>{selected.weightRange}</Text>
            </View>
          ) : null}

          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          >
            {LOAD_SIZE_OPTIONS.map((item: LoadSizeOption) => {
              const active = item.key === selectedValue;

              return (
                <TouchableOpacity
                  key={item.key}
                  style={[styles.card, active && styles.cardActive]}
                  onPress={() => {
                    onSelect(item.key);
                    onClose();
                  }}
                >
                  <View style={styles.cardTopRow}>
                    <Text style={styles.cardTitle}>{item.label}</Text>
                    {active ? (
                      <Text style={styles.activeBadge}>Selected</Text>
                    ) : null}
                  </View>

                  <Text style={styles.weightRange}>{item.weightRange}</Text>
                  <Text style={styles.cardDescription}>{item.description}</Text>
                  <Text style={styles.recommendation}>
                    Recommended: {item.recommendedVehicles.join(", ")}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "82%",
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 24,
  },
  handle: {
    alignSelf: "center",
    width: 48,
    height: 5,
    borderRadius: 999,
    backgroundColor: "#cbd5e1",
    marginBottom: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0f172a",
  },
  subtitle: {
    color: "#64748b",
    marginTop: 6,
    marginBottom: 14,
    lineHeight: 20,
  },
  selectedCard: {
    backgroundColor: "#eff6ff",
    borderColor: "#bfdbfe",
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  selectedLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#2563eb",
    marginBottom: 4,
  },
  selectedTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0f172a",
  },
  selectedMeta: {
    color: "#475569",
    marginTop: 4,
  },
  list: {
    flexGrow: 0,
  },
  listContent: {
    paddingBottom: 10,
  },
  card: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
  },
  cardActive: {
    borderColor: "#2563eb",
    backgroundColor: "#f8fbff",
  },
  cardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0f172a",
  },
  activeBadge: {
    fontSize: 11,
    fontWeight: "800",
    color: "#2563eb",
  },
  weightRange: {
    marginTop: 6,
    fontWeight: "700",
    color: "#334155",
  },
  cardDescription: {
    marginTop: 8,
    color: "#64748b",
    lineHeight: 20,
  },
  recommendation: {
    marginTop: 10,
    color: "#0f172a",
    fontWeight: "700",
  },
});
