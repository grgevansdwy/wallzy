import React, { useState, useCallback, useRef, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  KeyboardAvoidingView, 
  Platform,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, ShieldCheck, CheckCircle } from 'lucide-react-native';
import Colors from '@/constants/colors';
import AuthButton from '@/components/AuthButton';

const CODE_LENGTH = 6;

export default function VerificationScreen() {
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email?: string }>();
  const insets = useSafeAreaInsets();

  const [code, setCode] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [resendTimer, setResendTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);

  const inputRefs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    if (resendTimer > 0 && !canResend) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    } else if (resendTimer === 0) {
      setCanResend(true);
    }
  }, [resendTimer, canResend]);

  const handleCodeChange = useCallback((text: string, index: number) => {
    if (error) setError(null);

    const newCode = [...code];
    
    if (text.length > 1) {
      const pastedCode = text.slice(0, CODE_LENGTH).split('');
      pastedCode.forEach((char, i) => {
        if (i < CODE_LENGTH && /^\d$/.test(char)) {
          newCode[i] = char;
        }
      });
      setCode(newCode);
      const lastFilledIndex = Math.min(pastedCode.length - 1, CODE_LENGTH - 1);
      inputRefs.current[lastFilledIndex]?.focus();
      return;
    }

    if (/^\d$/.test(text) || text === '') {
      newCode[index] = text;
      setCode(newCode);

      if (text && index < CODE_LENGTH - 1) {
        inputRefs.current[index + 1]?.focus();
      }
    }
  }, [code, error]);

  const handleKeyPress = useCallback((e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }, [code]);

  const handleVerify = useCallback(async () => {
    const fullCode = code.join('');
    
    if (fullCode.length !== CODE_LENGTH) {
      setError('Please enter the complete 6-digit code');
      return;
    }

    setIsLoading(true);

    setTimeout(() => {
      setIsLoading(false);
      setIsSuccess(true);
    }, 1500);
  }, [code]);

  const handleResend = useCallback(() => {
    if (!canResend) return;

    setCanResend(false);
    setResendTimer(60);

    Alert.alert('Code Sent', 'A new verification code has been sent to your email.');
  }, [canResend, email]);

  if (isSuccess) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.container}>
          <View style={[styles.topSafeArea, { height: insets.top }]} />
          <View style={styles.scrollContent}>
            <View style={styles.cardContainer}>
              <View style={styles.successContainer}>
                <View style={styles.successIconContainer}>
                  <CheckCircle size={48} color={Colors.pureWhite} />
                </View>
                <Text style={styles.title}>Email Verified!</Text>
                <Text style={styles.subtitle}>
                  Your email has been successfully verified. Welcome to Wallzy!
                </Text>

                <AuthButton
                  title="Get Started"
                  onPress={() => {
                    Alert.alert('Success', 'Account created! (Frontend only demo)');
                  }}
                  style={styles.getStartedButton}
                />
              </View>
            </View>
          </View>
          <View style={[styles.bottomSafeArea, { height: insets.bottom }]} />
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <View style={[styles.topSafeArea, { height: insets.top }]} />
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <ScrollView 
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.cardContainer}>
              <TouchableOpacity 
                style={styles.backButton}
                onPress={() => router.back()}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <ArrowLeft size={24} color={Colors.darkBlue} />
              </TouchableOpacity>

              <View style={styles.headerContainer}>
                <View style={styles.iconContainer}>
                  <ShieldCheck size={28} color={Colors.pureWhite} />
                </View>
                <Text style={styles.title}>Verify Your Email</Text>
                <Text style={styles.subtitle}>
                  We&apos;ve sent a 6-digit code to
                </Text>
                <Text style={styles.emailText}>{email || 'your email'}</Text>
              </View>

              <View style={styles.codeContainer}>
                {code.map((digit, index) => (
                  <TextInput
                    key={index}
                    ref={(ref) => { inputRefs.current[index] = ref; }}
                    style={[
                      styles.codeInput,
                      digit && styles.codeInputFilled,
                      error && styles.codeInputError,
                    ]}
                    value={digit}
                    onChangeText={(text) => handleCodeChange(text, index)}
                    onKeyPress={(e) => handleKeyPress(e, index)}
                    keyboardType="number-pad"
                    maxLength={index === 0 ? CODE_LENGTH : 1}
                    selectTextOnFocus
                    testID={`code-input-${index}`}
                  />
                ))}
              </View>

              {error && <Text style={styles.errorText}>{error}</Text>}

              <AuthButton
                title="Verify Email"
                onPress={handleVerify}
                loading={isLoading}
                disabled={code.some(d => !d)}
                style={styles.verifyButton}
              />

              <View style={styles.resendContainer}>
                <Text style={styles.resendText}>Didn&apos;t receive the code? </Text>
                {canResend ? (
                  <TouchableOpacity onPress={handleResend}>
                    <Text style={styles.resendLink}>Resend</Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={styles.timerText}>Resend in {resendTimer}s</Text>
                )}
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
        <View style={[styles.bottomSafeArea, { height: insets.bottom }]} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.cardGray,
  },
  topSafeArea: {
    backgroundColor: Colors.cardGray,
  },
  bottomSafeArea: {
    backgroundColor: Colors.cardGray,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 32,
  },
  cardContainer: {
    flex: 1,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.pureWhite,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.lightBlue,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.darkBlue,
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textGray,
    textAlign: 'center',
  },
  emailText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.darkBlue,
    marginTop: 4,
  },
  codeContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 24,
  },
  codeInput: {
    width: 46,
    height: 54,
    borderRadius: 12,
    backgroundColor: Colors.pureWhite,
    fontSize: 22,
    fontWeight: '600' as const,
    textAlign: 'center',
    color: Colors.darkBlue,
  },
  codeInputFilled: {
    backgroundColor: '#E8F0FE',
  },
  codeInputError: {
    borderWidth: 2,
    borderColor: Colors.error,
  },
  errorText: {
    fontSize: 14,
    color: Colors.error,
    textAlign: 'center',
    marginBottom: 16,
  },
  verifyButton: {
    marginTop: 8,
  },
  resendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  resendText: {
    fontSize: 14,
    color: Colors.textGray,
  },
  resendLink: {
    fontSize: 14,
    color: Colors.lightBlue,
    fontWeight: '600' as const,
  },
  timerText: {
    fontSize: 14,
    color: Colors.textGray,
    fontWeight: '500' as const,
  },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  successIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.success,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 28,
  },
  getStartedButton: {
    width: '100%',
    marginTop: 20,
  },
});
