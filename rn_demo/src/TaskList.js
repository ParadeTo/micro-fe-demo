import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { loadTasks } from './api';

export function TaskList({ apiBaseUrl }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const nextTasks = await loadTasks(fetch, apiBaseUrl);
      setTasks(nextTasks);
    } catch (caughtError) {
      setError(caughtError.message);
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <View style={styles.panel}>
      <View style={styles.sectionHeader}>
        <Text style={styles.panelLabel}>Server Tasks</Text>
        <Pressable
          accessibilityRole="button"
          disabled={loading}
          onPress={refresh}
          style={({ pressed }) => [
            styles.refreshButton,
            pressed && styles.pressed,
            loading && styles.disabled,
          ]}
        >
          <Text style={styles.refreshButtonText}>{loading ? 'Loading' : 'Refresh'}</Text>
        </Pressable>
      </View>

      {loading && !tasks.length ? (
        <View style={styles.centerState}>
          <ActivityIndicator color="#0b6f6a" />
          <Text style={styles.stateText}>Requesting backend API...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>API request failed</Text>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable accessibilityRole="button" onPress={refresh} style={styles.errorButton}>
            <Text style={styles.errorButtonText}>Try Again</Text>
          </Pressable>
        </View>
      ) : (
        tasks.map((task) => <TaskRow key={task.id} task={task} />)
      )}
    </View>
  );
}

function TaskRow({ task }) {
  return (
    <View style={styles.taskRow}>
      <View style={[styles.taskDot, task.done && styles.taskDotDone]} />
      <Text style={styles.taskTitle}>{task.title}</Text>
      <Text style={[styles.taskStatus, task.done && styles.taskStatusDone]}>
        {task.done ? 'Done' : 'Open'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
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
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  refreshButton: {
    minHeight: 38,
    minWidth: 92,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: '#0b6f6a',
  },
  refreshButtonText: {
    color: '#ffffff',
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.8,
  },
  disabled: {
    opacity: 0.55,
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
  taskRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 12,
    borderTopColor: '#e7ecf2',
    borderTopWidth: 1,
  },
  taskDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#f59e0b',
  },
  taskDotDone: {
    backgroundColor: '#0b6f6a',
  },
  taskTitle: {
    flex: 1,
    color: '#24364a',
    fontSize: 15,
  },
  taskStatus: {
    color: '#92400e',
    fontSize: 12,
    fontWeight: '800',
  },
  taskStatusDone: {
    color: '#0b6f6a',
  },
});
