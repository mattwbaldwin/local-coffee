import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCoffeeSearch } from '../hooks/useCoffeeSearch';
import CoffeeCard from '../components/CoffeeCard';
import ResultsMap from '../components/ResultsMap';
import RadiusSlider from '../components/RadiusSlider';
import SortToggle from '../components/SortToggle';
import ViewToggle from '../components/ViewToggle';
import ErrorBanner from '../components/ErrorBanner';

export default function HomeScreen() {
  const {
    status,
    error,
    coords,
    sortedItems,
    sortBy,
    setSortBy,
    view,
    setView,
    radiusMiles,
    setRadiusMiles,
    useMyLocation,
  } = useCoffeeSearch();

  const headline =
    status === 'locating'
      ? 'Getting your location…'
      : status === 'loading'
      ? 'Finding independent coffee…'
      : 'Independent coffee nearby';

  const isBusy = status === 'locating' || status === 'loading';

  // Full-screen map — rendered outside ScrollView to avoid zero-height issue
  if (view === 'map' && coords && sortedItems.length > 0) {
    return (
      <View style={styles.mapScreen}>
        <ResultsMap
          userLat={coords.lat}
          userLng={coords.lng}
          items={sortedItems}
          radiusMiles={radiusMiles}
        />
        <SafeAreaView style={styles.mapOverlay} edges={['top']}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => setView('list')}
            activeOpacity={0.8}
          >
            <Text style={styles.backButtonText}>← List</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headline}>{headline}</Text>
          <Text style={styles.subheadline}>
            Shows{' '}
            <Text style={styles.bold}>independent coffee shops only</Text>
            . Chains are intentionally excluded.
          </Text>
        </View>

        {/* Location button */}
        <TouchableOpacity
          style={[styles.locationBtn, isBusy && styles.locationBtnDisabled]}
          onPress={useMyLocation}
          disabled={isBusy}
          activeOpacity={0.8}
        >
          <Text style={styles.locationBtnText}>
            {isBusy ? '…' : 'Use my location'}
          </Text>
        </TouchableOpacity>

        {coords && (
          <Text style={styles.coordsLabel}>
            Using location: {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
          </Text>
        )}

        {error && <ErrorBanner message={error} />}

        {/* Controls — only shown after first location */}
        {coords && (
          <View style={styles.controls}>
            <View style={styles.controlsRow}>
              <SortToggle value={sortBy} onChange={setSortBy} />
              <ViewToggle value={view} onChange={setView} />
            </View>
            <RadiusSlider value={radiusMiles} onChange={setRadiusMiles} />
          </View>
        )}

        {/* Empty state */}
        {status === 'ready' && sortedItems.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>
              No independent coffee shops found nearby.
            </Text>
          </View>
        )}

        {/* Results list */}
        {view === 'list' && (
          <View style={styles.results}>
            {sortedItems.map((item) => (
              <CoffeeCard key={item.placeId} item={item} />
            ))}
          </View>
        )}

        <Text style={styles.footer}>
          Data powered by Google Places. Results are "local-only" via chain-name heuristics.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#141414',
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
    gap: 12,
  },
  header: {
    gap: 8,
  },
  headline: {
    fontSize: 28,
    fontWeight: '700',
    color: '#f5f5f5',
  },
  subheadline: {
    fontSize: 14,
    lineHeight: 20,
    color: '#cfcfcf',
  },
  bold: {
    fontWeight: '700',
  },
  locationBtn: {
    marginTop: 8,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    backgroundColor: '#1a1a1a',
  },
  locationBtnDisabled: {
    backgroundColor: '#2a2a2a',
  },
  locationBtnText: {
    color: '#fff',
    fontSize: 16,
  },
  coordsLabel: {
    fontSize: 12,
    color: '#aaaaaa',
  },
  controls: {
    gap: 12,
    marginTop: 4,
  },
  controlsRow: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  emptyState: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#1c1c1c',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  emptyStateText: {
    color: '#cccccc',
    fontSize: 14,
  },
  results: {
    gap: 12,
  },
  footer: {
    fontSize: 12,
    color: '#888',
    lineHeight: 18,
    marginTop: 14,
  },
  // Map screen
  mapScreen: {
    flex: 1,
    backgroundColor: '#141414',
  },
  mapOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  backButton: {
    margin: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(20, 20, 20, 0.85)',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    alignSelf: 'flex-start',
  },
  backButtonText: {
    color: '#f5f5f5',
    fontSize: 15,
    fontWeight: '600',
  },
});
