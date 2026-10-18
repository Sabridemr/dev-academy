import { useState } from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { Link } from 'expo-router';
import { RegisterSchema, type AuthResponse } from '@devacademy/shared';
import { useI18n } from '@/i18n';
import { endpoints } from '@/lib/endpoints';
import { useSession } from '@/stores/session';
import { useTheme } from '@/theme';
import { Button, Row, Screen, Text, TextField } from '@/components/ui';
import { SocialButtons } from '@/components/auth/SocialButtons';
import { errorText } from '@/utils/errors';

export default function RegisterScreen() {
  const { t, locale } = useI18n();
  const { colors } = useTheme();
  const signIn = useSession((s) => s.signIn);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{
    displayName?: string;
    email?: string;
    password?: string;
  }>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onAuth = (res: AuthResponse) => void signIn(res);
  const onError = (e: unknown) => setError(errorText(e, t));

  const submit = async () => {
    setError(null);
    const parsed = RegisterSchema.safeParse({
      displayName: displayName.trim(),
      email: email.trim(),
      password,
      locale,
    });
    if (!parsed.success) {
      const f = parsed.error.flatten().fieldErrors;
      setFieldErrors({
        displayName: f.displayName ? t('auth.nameMin') : undefined,
        email: f.email ? t('auth.invalidEmail') : undefined,
        password: f.password ? t('auth.passwordMin') : undefined,
      });
      return;
    }
    setFieldErrors({});
    setLoading(true);
    try {
      onAuth(await endpoints.register(parsed.data));
    } catch (e) {
      onError(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen
        edges={['top', 'bottom']}
        contentStyle={{ justifyContent: 'center', flexGrow: 1 }}
        testID="register-screen"
      >
        <Text variant="heading" accessibilityRole="header">
          {t('auth.registerTitle')}
        </Text>
        <TextField
          label={t('auth.displayName')}
          value={displayName}
          onChangeText={setDisplayName}
          autoComplete="name"
          textContentType="name"
          error={fieldErrors.displayName}
        />
        <TextField
          label={t('auth.email')}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          textContentType="emailAddress"
          error={fieldErrors.email}
        />
        <TextField
          label={t('auth.password')}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
          error={fieldErrors.password}
          onSubmitEditing={() => void submit()}
        />
        {error ? (
          <Text color={colors.danger} accessibilityLiveRegion="assertive">
            {error}
          </Text>
        ) : null}
        <Button title={t('auth.registerCta')} onPress={() => void submit()} loading={loading} />
        <Text muted align="center" variant="caption">
          {t('auth.or')}
        </Text>
        <SocialButtons onSuccess={onAuth} onError={onError} />
        <Row style={{ justifyContent: 'center' }}>
          <Text variant="caption" muted>
            {t('auth.haveAccount')}
          </Text>
          <Link href="/login" replace accessibilityRole="link">
            <Text variant="label" color={colors.primary}>
              {t('auth.loginCta')}
            </Text>
          </Link>
        </Row>
      </Screen>
    </KeyboardAvoidingView>
  );
}
