import { Text, TouchableOpacity, View } from "react-native";
import { design } from "../../constants/design";
import { AppInput } from "../ui/app-input";
import { LoadSize } from "../../types";

const LOAD_SIZES: LoadSize[] = ["Small", "Medium", "Large", "Extra Large", "Custom"];

type Props = {
  selected: LoadSize | null;
  onSelect: (size: LoadSize) => void;
  onDescriptionChange: (description: string) => void;
  description: string;
};

export function LoadSizeStep({ selected, onSelect, onDescriptionChange, description }: Props) {
  const isCustom = selected === "Custom";

  return (
    <View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {LOAD_SIZES.map((size) => (
          <TouchableOpacity
            key={size}
            style={{
              padding: 12,
              borderWidth: 1,
              borderColor: selected === size ? design.colors.brand : design.colors.border,
              borderRadius: design.radius.md,
              backgroundColor: selected === size ? design.colors.brand : design.colors.surface,
            }}
            onPress={() => onSelect(size)}
          >
            <Text style={{ color: selected === size ? design.colors.white : design.colors.ink }}>
              {size}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isCustom && (
        <AppInput
          placeholder="Describe load (e.g., 20kg box, furniture)"
          value={description}
          onChangeText={onDescriptionChange}
          style={{ marginTop: 16 }}
        />
      )}

      {!isCustom && <AppInput placeholder="Additional details (optional)" value={description} onChangeText={onDescriptionChange} style={{ marginTop: 8 }} />}
    </View>
  );
}
