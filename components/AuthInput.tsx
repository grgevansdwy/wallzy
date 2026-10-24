import React, { useState } from 'react';
import { View, TextInput, Text, StyleSheet, TouchableOpacity, TextInputProps } from 'react-native';
import { Eye, EyeOff, LucideIcon } from 'lucide-react-native';
import Colors from '@/constants/colors';

interface AuthInputProps extends TextInputProps {
  label?: string;
  error?: string | null;
  isPassword?: boolean;
  icon?: LucideIcon;
}

export default function AuthInput({ 
  label, 
  error, 
  isPassword = false, 
  icon: Icon,
  style,
  ...props 
}: AuthInputProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={[
        styles.inputContainer,
        isFocused && styles.inputFocused,
        error && styles.inputError,
      ]}>
        {Icon && (
          <View style={styles.iconContainer}>
            <Icon size={20} color={Colors.textGray} />
          </View>
        )}
        <TextInput
          style={[styles.input, !Icon && styles.inputNoIcon, style]}
          placeholderTextColor={Colors.textGray}
          secureTextEntry={isPassword && !showPassword}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          {...props}
        />
        {isPassword && (
          <TouchableOpacity 
            onPress={() => setShowPassword(!showPassword)}
            style={styles.eyeButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            {showPassword ? (
              <EyeOff size={20} color={Colors.textGray} />
            ) : (
              <Eye size={20} color={Colors.textGray} />
            )}
          </TouchableOpacity>
        )}
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 14,
  },
  label: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.darkBlue,
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.pureWhite,
    borderRadius: 28,
    paddingHorizontal: 6,
    minHeight: 56,
  },
  inputFocused: {
    borderWidth: 2,
    borderColor: Colors.lightBlue,
  },
  inputError: {
    borderWidth: 2,
    borderColor: Colors.error,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.cardGray,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 4,
  },
  input: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 16,
    fontSize: 16,
    color: Colors.textDark,
  },
  inputNoIcon: {
    paddingLeft: 20,
  },
  eyeButton: {
    paddingRight: 16,
    paddingLeft: 8,
  },
  errorText: {
    fontSize: 12,
    color: Colors.error,
    marginTop: 6,
    marginLeft: 16,
  },
});
