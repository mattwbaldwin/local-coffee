import { View, Text, StyleSheet } from 'react-native';

export default function ErrorBanner({ message }: { message: string }) {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#2b1b1b',
    borderWidth: 1,
    borderColor: '#4a2a2a',
  },
  text: {
    color: '#ffb4b4',
    fontSize: 14,
  },
});
