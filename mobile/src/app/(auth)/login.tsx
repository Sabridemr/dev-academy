import { useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { Link } from 'expo-router';
import { LoginSchema, type AuthResponse } from '@devacademy/shared';
import { useI18n } from '@/i18n';
import { isApiError } from '@/lib/api';
import { endpoints } from '@/lib/endpoints';
import { useSession } from '@/stores/session';
import { spacing, useTheme } from '@/theme';
import { Button, Row, Screen, Text, TextField } from '@/components/ui';
import { SocialButtons } from '@/components/auth/SocialButtons';
import { errorText } from '@/utils/errors';

export default function LoginScreen() {
  const { t } = useI18n();
  const { colors } = useTheme();
  const signIn = useSession((s) => s.signIn);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onAuth = (res: AuthResponse) => void signIn(res);
  const onError = (e: unknown) => setError(isApiError(e) && e.code === 'unauthorized' ? t('auth.loginFailed') : errorText(e, t));

  const submit = async () => {
    setError(null);
    const parsed = LoginSchema.safeParse({ email: email.trim(), password });
    if (!parsed.success) {
      const issues = parsed.error.flatten().fieldErrors;
      setFieldErrors({ email: issues.email ? t('auth.invalidEmail') : undefined, password: issues.password ? t('auth.passwordMin') : undefined });
      return;
    }
    setFieldErrors({});
    setLoading(true);
    try {
      onAuth(await endpoints.login(parsed.data));
    } catch (e) {
      onError(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen edges={['top', 'bottom']} contentStyle={{ justifyContent: 'center', flexGrow: 1 }} testID="login-screen">
        <View style={{ gap: spacing.xs }}>
          <Text variant="title" color={colors.primary}>
            {t('app.name')}
          </Text>
          <Text muted>{t('app.tagline')}</Text>
        </View>
        <Text variant="heading" accessibilityRole="header">
          {t('auth.loginTitle')}
        </Text>
        <TextField
          label={t('auth.email')}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
          error={fieldErrors.email}
          testID="login-email"
        />
        <TextField
          label={t('auth.password')}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="password"
          textContentType="password"
          error={fieldErrors.password}
          onSubmitEditing={() => void submit()}
          testID="login-password"
        />
        {error ? (
          <Text color={colors.danger} accessibilityLiveRegion="assertive">
            {error}
          </Text>
        ) : null}
        <Button title={t('auth.loginCta')} onPress={() => void submit()} loading={loading} testID="login-submit" />
        <Text muted align="center" variant="caption">
          {t('auth.or')}
        </Text>
        <SocialButtons onSuccess={onAuth} onError={onError} />
        <Row style={{ justifyContent: 'center' }}>
          <Text variant="caption" muted>
            {t('auth.noAccount')}
          </Text>
          <Link href="/register" replace accessibilityRole="link">
            <Text variant="label" color={colors.primary}>
              {t('auth.registerCta')}
            </Text>
          </Link>
        </Row>
      </Screen>
    </KeyboardAvoidingView>
  );
}
