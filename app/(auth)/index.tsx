import React from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Path, Ellipse } from 'react-native-svg';
import Colors from '@/constants/colors';
import WallzyLogo from '@/components/WallzyLogo';

const { width, height } = Dimensions.get('window');

export default function LandingScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.topSection}>
        <Svg 
          width={width * 1.4} 
          height={height * 0.45} 
          viewBox={`0 0 ${width * 1.4} ${height * 0.45}`}
          style={styles.yellowBlob}
        >
        
          <Ellipse
            cx={width * 0.7}
            cy={-height * 0.05}
            rx={width * 0.85}
            ry={height * 0.4}
            fill={Colors.paleYellow}
            opacity={0.85}
          />
        </Svg>

        <View style={styles.cardsContainer}>
          <View style={[styles.card, styles.cardLight]} />
          <View style={[styles.card, styles.cardYellow]} />
          <View style={[styles.card, styles.cardDark]} />
        </View>
      </View>

      <View style={styles.contentSection}>
        <View style={styles.logoContainer}>
          <WallzyLogo size="large" showTagline />
        </View>

        <View style={styles.buttonsContainer}>
          <TouchableOpacity
            style={styles.button}
            onPress={() => router.push('/sign-up')}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>Get started</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.button}
            onPress={() => router.push('/sign-in')}
            activeOpacity={0.8}
          >
            <Text style={[styles.buttonText, styles.buttonTextSecondary]}>I have an account</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.waveContainer}>
        <Svg width={width} height={120} viewBox={`0 0 ${width} 120`} preserveAspectRatio="none">
          <Path
            d={`
              M0,75
              C${width * 0.2},20 ${width * 0.35},130 ${width * 0.5},85
              C${width * 0.65},40 ${width * 0.8},10 ${width},70
              L${width},120 L0,120 Z
            `}
            fill={Colors.darkBlue}
          />
        </Svg>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  topSection: {
    height: height * 0.48,
    position: 'relative',
    overflow: 'hidden',
  },
  yellowBlob: {
    position: 'absolute',
    top: 0,
    left: -width * 0.2,
  },
  cardsContainer: {
    flex: 1,
    position: 'relative',
    marginTop: 60,
  },
  card: {
    position: 'absolute',
    borderRadius: 24,
  },
  cardLight: {
    width: 190,
    height: 150,
    backgroundColor: Colors.lightBlue,
    left: width * 0.15,
    top: 30,
    transform: [{ rotate: '-8deg' }],
  },
  cardYellow: {
    width: 200,
    height: 130,
    backgroundColor: Colors.yellow,
    right: width * 0.08,
    top: 90,
    borderRadius: 28,
    transform: [{ rotate: '12deg' }],
  },
  cardDark: {
    width: 210,
    height: 160,
    backgroundColor: Colors.darkBlue,
    left: width * 0.25,
    top: 160,
    transform: [{ rotate: '5deg' }],
  },
  contentSection: {
    flex: 1,
    paddingHorizontal: 40,
    justifyContent: 'flex-start',
    marginTop: -20,
  },
  logoContainer: {
    alignItems: 'flex-start',
    marginBottom: 40,
  },
  buttonsContainer: {
    gap: 16,
  },
  button: {
    backgroundColor: Colors.pureWhite,
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  buttonText: {
    fontSize: 17,
    fontWeight: '500' as const,
    color: Colors.darkBlue,
  },
  buttonTextSecondary: {
    color: Colors.darkBlue,
  },
  waveContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
});
