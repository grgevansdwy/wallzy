import React from 'react';
import { 
  TouchableOpacity, 
  Text, 
  StyleSheet, 
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  View,
  Image,
} from 'react-native';
import { LucideIcon } from 'lucide-react-native';
import Colors from '@/constants/colors';

interface AuthButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'social';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: LucideIcon;
  iconColor?: string;
  iconSource?: any;
}

export default function AuthButton({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  style,
  textStyle,
  icon: Icon,
  iconColor,
  iconSource
}: AuthButtonProps) {
  const getButtonStyle = () => {
    switch (variant) {
      case 'primary':
        return styles.primaryButton;
      case 'secondary':
        return styles.secondaryButton;
      case 'outline':
        return styles.outlineButton;
      case 'social':
        return styles.socialButton;
      default:
        return styles.primaryButton;
    }
  };

  const getTextStyle = () => {
    switch (variant) {
      case 'primary':
        return styles.primaryText;
      case 'secondary':
        return styles.secondaryText;
      case 'outline':
        return styles.outlineText;
      case 'social':
        return styles.socialText;
      default:
        return styles.primaryText;
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.button,
        getButtonStyle(),
        disabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator 
          color={variant === 'outline' || variant === 'social' ? Colors.darkBlue : Colors.pureWhite} 
          size="small" 
        />
      ) : (
        <View style={styles.contentContainer}>
          {iconSource && (
           <Image source={iconSource} style={styles.imageIcon} resizeMode="contain" />
         )}
          {Icon && (
            <Icon 
              size={20} 
              color={iconColor || (variant === 'social' ? Colors.textDark : Colors.pureWhite)} 
              style={styles.icon}
            />
          )}
          <Text style={[styles.text, getTextStyle(), textStyle]}>{title}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
  },
  primaryButton: {
    backgroundColor: Colors.darkBlue,
  },
  secondaryButton: {
    backgroundColor: Colors.yellow,
  },
  outlineButton: {
    backgroundColor: Colors.pureWhite,
    borderWidth: 1.5,
    borderColor: Colors.darkBlue,
  },
  socialButton: {
    backgroundColor: Colors.pureWhite,
  },
  disabled: {
    opacity: 0.6,
  },
  contentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    marginRight: 12,
  },
  imageIcon: {
   width: 20,
   height: 20,
    marginRight: 12,
  },
  text: {
    fontSize: 16,
    fontWeight: '600' as const,
  },
  primaryText: {
    color: Colors.pureWhite,
  },
  secondaryText: {
    color: Colors.darkBlue,
  },
  outlineText: {
    color: Colors.darkBlue,
  },
  socialText: {
    color: Colors.textDark,
  },
});
