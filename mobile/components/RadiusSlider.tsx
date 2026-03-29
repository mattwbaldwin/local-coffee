import { View, Text, StyleSheet } from 'react-native';
import Slider from '@react-native-community/slider';

interface Props {
  value: number;
  onChange: (value: number) => void;
}

export default function RadiusSlider({ value, onChange }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>Radius: {Math.round(value)} mi</Text>
      <Slider
        style={styles.slider}
        minimumValue={1}
        maximumValue={60}
        step={1}
        value={value}
        onValueChange={(v) => onChange(Math.round(v))}
        minimumTrackTintColor="#f5f5f5"
        maximumTrackTintColor="#3a3a3a"
        thumbTintColor="#f5f5f5"
      />
      <Text style={styles.hint}>Expanding radius increases coverage and API usage.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  label: {
    fontSize: 12,
    color: '#bdbdbd',
    marginBottom: 4,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  hint: {
    fontSize: 11,
    color: '#8f8f8f',
  },
});
