import React from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { design } from "../constants/design";
import {
  LOAD_SIZE_OPTIONS,
  LoadSizeOption,
  getLoadSizeByKey,
} from "../constants/loadsizes";
import { LoadSize } from "../types";
import { BottomSheet } from "./ui/bottom-sheet";

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
    <BottomSheet visible={visible} onClose={onClose}>
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
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  title: {
    ...design.typography.title,
    color: design.colors.ink,
  },
  subtitle: {
    color: design.colors.muted,
    marginTop: 6,
    marginBottom: 14,
    lineHeight: 20,
  },
  selectedCard: {
    backgroundColor: design.colors.brandSoft,
    borderColor: design.colors.brand,
    borderWidth: 1,
    borderRadius: design.radius.md,
    padding: design.spacing.sm,
    marginBottom: design.spacing.sm,
  },
  selectedLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: design.colors.brand,
    marginBottom: 4,
  },
  selectedTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: design.colors.ink,
  },
  selectedMeta: {
    color: design.colors.muted,
    marginTop: 4,
  },
  list: {
    flexGrow: 0,
  },
  listContent: {
    paddingBottom: design.spacing.xs,
  },
  card: {
    borderWidth: 1,
    borderColor: design.colors.border,
    backgroundColor: design.colors.surface,
    borderRadius: design.radius.lg,
    padding: design.spacing.sm,
    marginBottom: design.spacing.sm,
  },
  cardActive: {
    borderColor: design.colors.brand,
    backgroundColor: design.colors.brandSoft,
  },
  cardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: design.colors.ink,
  },
  activeBadge: {
    fontSize: 11,
    fontWeight: "800",
    color: design.colors.brand,
  },
  weightRange: {
    marginTop: 6,
    fontWeight: "700",
    color: design.colors.ink,
  },
  cardDescription: {
    marginTop: 8,
    color: design.colors.muted,
    lineHeight: 20,
  },
  recommendation: {
    marginTop: 10,
    color: design.colors.ink,
    fontWeight: "700",
  },
});
