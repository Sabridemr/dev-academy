import { Switch } from 'react-native';
import { Row, Text } from '@/components/ui';

/** Etiketli açma/kapama satırı (web'deki checkbox'ların mobil karşılığı) */
export function ToggleRow({
  label,
  value,
  onChange,
  testID,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  testID?: string;
}) {
  return (
    <Row style={{ justifyContent: 'space-between' }}>
      <Text variant="caption" style={{ flex: 1 }}>
        {label}
      </Text>
      <Switch value={value} onValueChange={onChange} accessibilityLabel={label} testID={testID} />
    </Row>
  );
}

/** params içinden boolean okuma ("true"/"false" metinleri de kabul edilir) */
export function paramBool(
  params: Record<string, unknown>,
  key: string,
  fallback: boolean,
): boolean {
  const v = params[key];
  if (typeof v === 'boolean') return v;
  if (v === 'true') return true;
  if (v === 'false') return false;
  return fallback;
}
