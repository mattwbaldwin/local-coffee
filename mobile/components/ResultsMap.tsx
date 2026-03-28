import { View, Text, TouchableOpacity, Linking, StyleSheet } from 'react-native';
import MapView, { Marker, Callout } from 'react-native-maps';
import type { CoffeeItem } from '../types/coffee';

interface Props {
  userLat: number;
  userLng: number;
  items: CoffeeItem[];
  radiusMiles: number;
}

export default function ResultsMap({ userLat, userLng, items, radiusMiles }: Props) {
  // latitudeDelta ~ 2.2x the radius in degrees; 1 degree lat ≈ 69 miles
  const delta = Math.max(0.01, (radiusMiles / 69) * 2.2);

  const points = items.filter((x) => x.lat != null && x.lng != null) as (CoffeeItem & {
    lat: number;
    lng: number;
  })[];

  return (
    <MapView
      style={styles.map}
      showsUserLocation
      initialRegion={{
        latitude: userLat,
        longitude: userLng,
        latitudeDelta: delta,
        longitudeDelta: delta,
      }}
    >
      {points.map((p) => (
        <Marker key={p.placeId} coordinate={{ latitude: p.lat, longitude: p.lng }}>
          <Callout onPress={() => Linking.openURL(p.mapsUrl)}>
            <View style={styles.callout}>
              <Text style={styles.calloutTitle}>{p.name}</Text>
              {p.address && <Text style={styles.calloutAddr}>{p.address}</Text>}
              <Text style={styles.calloutLink}>Open in Google Maps</Text>
            </View>
          </Callout>
        </Marker>
      ))}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
  callout: {
    maxWidth: 220,
    padding: 4,
    gap: 4,
  },
  calloutTitle: {
    fontWeight: '700',
    fontSize: 14,
    color: '#111',
  },
  calloutAddr: {
    fontSize: 12,
    color: '#444',
  },
  calloutLink: {
    fontSize: 12,
    color: '#0066cc',
    textDecorationLine: 'underline',
  },
});
