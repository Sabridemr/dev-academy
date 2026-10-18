import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import type { AuthResponse } from '@devacademy/shared';
import { isAppleAvailable, signInWithApple, useGoogleSignIn } from '@/auth/oauth';
import { useI18n } from '@/i18n';
import { spacing, useTheme } from '@/theme';
import { Button, Text } from '@/components/ui';

/** Google + Apple giriş butonları; başarıda onSuccess(AuthResponse) */
export function SocialButtons({
  onSuccess,
  onError,
}: {
  onSuccess: (res: AuthResponse) => void;
  onError: (e: unknown) => void;
}) {
  const { t } = useI18n();
  const { scheme } = useTheme();
  const google = useGoogleSignIn(onSuccess, onError);
  const [appleAvailable, setAppleAvailable] = useState(false);

  useEffect(() => {
    void isAppleAvailable().then(setAppleAvailable);
  }, []);

  return (
    <View style={{ gap: spacing.sm }}>
      <Button
        title={t('auth.google')}
        variant="secondary"
        icon="logo-google"
        onPress={() => void google.signIn()}
        loading={google.busy}
        disabled={!google.available}
        accessibilityHint={google.available ? undefined : t('auth.oauthUnavailable')}
        testID="google-signin"
      />
      {!google.available ? (
        <Text variant="caption" muted align="center">
          {t('auth.oauthUnavailable')}
        </Text>
      ) : null}
      {Platform.OS === 'ios' && appleAvailable ? (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
          buttonStyle={
            scheme === 'dark'
              ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
              : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
          }
          cornerRadius={12}
          style={{ height: 48 }}
          onPress={() => {
            signInWithApple()
              .then((res) => {
                if (res) onSuccess(res);
              })
              .catch(onError);
          }}
        />
      ) : null}
    </View>
  );
}
