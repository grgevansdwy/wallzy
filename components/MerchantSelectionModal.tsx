import React from "react";
import {
  Modal,
  Pressable,
  View,
  Text,
  FlatList,
  StyleSheet,
} from "react-native";
import Colors from "@/constants/colors";
import { RadarPlace } from "@/services/radar/radarPlacesService";

type Props = {
  visible: boolean;
  places: RadarPlace[];
  onSelect: (place: RadarPlace) => void;
  onDismiss: () => void;
};

export default function MerchantSelectionModal({
  visible,
  places,
  onSelect,
  onDismiss,
}: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onDismiss}
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.title}>
            {places.length === 1
              ? `Are you currently at ${places[0].name}?`
              : "Which store are you at?"}
          </Text>

          <View style={styles.listContainer}>
            <FlatList
              data={places}
              keyExtractor={(item) => item._id}
              showsVerticalScrollIndicator
              renderItem={({ item }) => (
                <Pressable
                  style={styles.row}
                  onPress={() => onSelect(item)}
                >
                  <Text style={styles.rowName}>{item.name}</Text>
                  {item.distance != null && (
                    <Text style={styles.rowDistance}>
                      {item.distance < 1000
                        ? `${Math.round(item.distance)}m away`
                        : `${(item.distance / 1000).toFixed(1)}km away`}
                    </Text>
                  )}
                </Pressable>
              )}
            />
          </View>

          <Pressable style={styles.dismissButton} onPress={onDismiss}>
            <Text style={styles.dismissText}>None of these</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: Colors.pureWhite,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    paddingBottom: 36,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: Colors.darkBlue,
    marginBottom: 16,
  },
  listContainer: {
    backgroundColor: Colors.pureWhite,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    maxHeight: 300,
    marginBottom: 16,
  },
  row: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  rowName: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.textDark,
  },
  rowDistance: {
    fontSize: 13,
    color: Colors.textGray,
    marginTop: 2,
  },
  dismissButton: {
    paddingVertical: 14,
    borderRadius: 25,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  dismissText: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.textDark,
  },
});
