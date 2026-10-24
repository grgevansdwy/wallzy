import React from "react";
import { View, Text, StyleSheet, Image } from "react-native";
import Colors from "@/constants/colors";

const logoImage = require("@/assets/images/wallzy-logo-text.png");

interface WallzyLogoProps {
  size?: "small" | "medium" | "large";
  showTagline?: boolean;
}

export default function WallzyLogo({
  size = "medium",
  showTagline = false,
}: WallzyLogoProps) {
  const scale = size === "small" ? 0.7 : size === "large" ? 1.2 : 1;
  const taglineSize = 18 * scale;

  return (
    <View style={styles.container}>
      <Image
        source={logoImage}
        style={{ width: 180 * scale, height: 125 * scale }}
        resizeMode="contain"
      />

      {showTagline === true && (
        <Text style={[styles.tagline, { fontSize: taglineSize }]}>
          Stop Guessing, Start <Text style={styles.earning}>Earning.</Text>
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "flex-start",
    marginLeft: -40,
  },
  tagline: {
    color: Colors.darkBlue,
    fontWeight: "600",
    marginTop: -45,
    marginLeft: 65,
  },
  earning: {
    color: Colors.yellow,
    fontWeight: "600",
  },
});
