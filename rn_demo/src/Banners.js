import { ScrollView, StyleSheet, Text, View } from 'react-native';

const DEFAULT_ITEMS = [
  { id: '1', title: 'Summer Sale', description: 'Up to 50% off on selected items', color: '#0b6f6a' },
  { id: '2', title: 'New Arrivals', description: 'Check out the latest collection', color: '#7c3aed' },
  { id: '3', title: 'Free Shipping', description: 'On all orders over $50', color: '#b45309' },
];

export function Banners({ items = DEFAULT_ITEMS }) {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.heading}>Promotions</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroll}>
        {items.map((item) => (
          <BannerCard key={item.id} item={item} />
        ))}
      </ScrollView>
    </View>
  );
}

function BannerCard({ item }) {
  return (
    <View style={[styles.card, { backgroundColor: item.color }]}>
      <Text style={styles.cardTitle}>{item.title}</Text>
      <Text style={styles.cardDesc}>{item.description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginTop: 14,
    padding: 16,
    borderColor: '#d6dde8',
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: '#ffffff',
  },
  heading: {
    color: '#24364a',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 12,
  },
  scroll: {
    flexDirection: 'row',
  },
  card: {
    borderRadius: 8,
    padding: 16,
    marginRight: 12,
    width: 200,
    minHeight: 90,
    justifyContent: 'center',
  },
  cardTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 6,
  },
  cardDesc: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
  },
});
