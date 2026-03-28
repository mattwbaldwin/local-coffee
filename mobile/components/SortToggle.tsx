import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface Props {
  value: 'distance' | 'rating';
  onChange: (value: 'distance' | 'rating') => void;
}

const OPTIONS: { label: string; value: 'distance' | 'rating' }[] = [
  { label: 'Distance', value: 'distance' },
  { label: 'Rating', value: 'rating' },
];

export default function SortToggle({ value, onChange }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>Sort by</Text>
      <View style={styles.row}>
        {OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            onPress={() => onChange(opt.value)}
            style={[styles.btn, value === opt.value && styles.btnActive]}
            activeOpacity={0.7}
          >
            <Text style={[styles.btnText, value === opt.value && styles.btnTextActive]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {},
  label: {
    fontSize: 12,
    color: '#bdbdbd',
    marginBottom: 6,
  },
  row: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    overflow: 'hidden',
  },
  btn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#1a1a1a',
  },
  btnActive: {
    backgroundColor: '#2a2a2a',
  },
  btnText: {
    fontSize: 14,
    color: '#888',
  },
  btnTextActive: {
    color: '#f5f5f5',
  },
});
