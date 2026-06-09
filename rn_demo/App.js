import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { loadProfile } from './src/api';
import { TaskList } from './src/TaskList';

const defaultApiBaseUrl = Platform.select({
  android: 'http://10.0.2.2:3001',
  ios: 'http://localhost:3001',
  default: 'http://localhost:3001',
});

const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || defaultApiBaseUrl;

export default function App() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const nextProfile = await loadProfile(fetch, apiBaseUrl);
      setProfile(nextProfile);
    } catch (caughtError) {
      setError(caughtError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>React Native Demo</Text>
          <Text style={styles.title}>Mobile API Client</Text>
          <Text style={styles.subtitle}>{apiBaseUrl}</Text>
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelLabel}>Profile</Text>
          {loading && !profile ? (
            <LoadingState />
          ) : error ? (
            <ErrorState error={error} onRetry={refresh} />
          ) : (
            <ProfileCard profile={profile} />
          )}
        </View>

        <TaskList apiBaseUrl={apiBaseUrl} />
      </ScrollView>
    </SafeAreaView>
  );
}

function LoadingState() {
  return (
    <View style={styles.centerState}>
      <ActivityIndicator color="#0b6f6a" />
      <Text style={styles.stateText}>Requesting backend API...</Text>
    </View>
  );
}

function ErrorState({ error, onRetry }) {
  return (
    <View style={styles.errorBox}>
      <Text style={styles.errorTitle}>API request failed</Text>
      <Text style={styles.errorText}>{error}</Text>
      <Pressable accessibilityRole="button" onPress={onRetry} style={styles.errorButton}>
        <Text style={styles.errorButtonText}>Try Again</Text>
      </Pressable>
    </View>
  );
}

function ProfileCard({ profile }) {
  return (
    <View style={styles.profileCard}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{profile.name.slice(0, 1)}</Text>
      </View>
      <View style={styles.profileText}>
        <Text style={styles.profileName}>{profile.name}</Text>
        <Text style={styles.profileMeta}>
          {profile.role} · {profile.city}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#eef2f7',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 18,
  },
  eyebrow: {
    color: '#0b6f6a',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  title: {
    marginTop: 4,
    color: '#172033',
    fontSize: 34,
    fontWeight: '800',
  },
  subtitle: {
    marginTop: 8,
    color: '#5f7282',
    fontSize: 13,
  },
  panel: {
    marginTop: 14,
    padding: 16,
    borderColor: '#d6dde8',
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: '#ffffff',
  },
  panelLabel: {
    color: '#24364a',
    fontSize: 16,
    fontWeight: '800',
  },
  centerState: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 28,
  },
  stateText: {
    color: '#5f7282',
    fontSize: 14,
  },
  errorBox: {
    marginTop: 14,
    padding: 14,
    borderColor: '#fecaca',
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: '#fff1f2',
  },
  errorTitle: {
    color: '#991b1b',
    fontSize: 15,
    fontWeight: '800',
  },
  errorText: {
    marginTop: 6,
    color: '#7f1d1d',
  },
  errorButton: {
    alignSelf: 'flex-start',
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#991b1b',
  },
  errorButtonText: {
    color: '#ffffff',
    fontWeight: '800',
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 14,
  },
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#0b6f6a',
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '800',
  },
  profileText: {
    flex: 1,
  },
  profileName: {
    color: '#172033',
    fontSize: 22,
    fontWeight: '800',
  },
  profileMeta: {
    marginTop: 4,
    color: '#5f7282',
    fontSize: 14,
  },
});
