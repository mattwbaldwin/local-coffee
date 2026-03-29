import { View, Text, TouchableOpacity, Linking, StyleSheet } from 'react-native';
import { metersToReadable } from '../lib/distance';
import type { CoffeeItem } from '../types/coffee';

export default function CoffeeCard({ item }: { item: CoffeeItem }) {
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Text style={styles.name}>{item.name}</Text>
        <Text style={styles.distance}>{metersToReadable(item.distanceMeters)}</Text>
      </View>

      <View style={styles.metaRow}>
        {item.rating != null && (
          <Text style={styles.meta}>
            {item.rating.toFixed(1)} ★{item.ratingsTotal != null ? ` (${item.ratingsTotal})` : ''}
          </Text>
        )}
        {item.openNow != null && (
          <Text style={styles.meta}>{item.openNow ? 'Open now' : 'Closed'}</Text>
        )}
      </View>

      {item.address && <Text style={styles.address}>{item.address}</Text>}

      <TouchableOpacity
        style={styles.mapsButton}
        onPress={() => Linking.openURL(item.mapsUrl)}
        activeOpacity={0.7}
      >
        <Text style={styles.mapsButtonText}>Open in Google Maps</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#f7f7f7',
    borderWidth: 1,
    borderColor: '#e5e5e5',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111',
    flex: 1,
  },
  distance: {
    fontSize: 12,
    color: '#555',
  },
  metaRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 6,
  },
  meta: {
    fontSize: 13,
    color: '#333',
  },
  address: {
    marginTop: 6,
    fontSize: 13,
    color: '#444',
    lineHeight: 18,
  },
  mapsButton: {
    marginTop: 10,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ccc',
    alignSelf: 'flex-start',
  },
  mapsButtonText: {
    fontSize: 14,
    color: '#111',
  },
});
