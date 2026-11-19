import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';

import { isFirestoreDoseEventsFeatureEnabled } from '@/services/firebase/firestore-dose-event-feature';
import { useDoseHistoryStore, useSessionStore } from '@/store';

/** Connects the protected history route to the currently authenticated owner only. */
export function useDoseHistory() {
  const user = useSessionStore((state) => state.user);
  const activeUserId = useDoseHistoryStore((state) => state.activeUserId);
  const range = useDoseHistoryStore((state) => state.range);
  const events = useDoseHistoryStore((state) => state.events);
  const nextCursor = useDoseHistoryStore((state) => state.nextCursor);
  const listStatus = useDoseHistoryStore((state) => state.listStatus);
  const isLoadingMore = useDoseHistoryStore((state) => state.isLoadingMore);
  const errorMessage = useDoseHistoryStore((state) => state.errorMessage);
  const loadForAuthenticatedUser = useDoseHistoryStore((state) => state.loadForAuthenticatedUser);
  const loadMore = useDoseHistoryStore((state) => state.loadMore);
  const retry = useDoseHistoryStore((state) => state.retry);
  const enabled = isFirestoreDoseEventsFeatureEnabled();
  const userId = user?.role === 'elderly' ? user.id : null;
  const rangeRef = useRef(range);

  useEffect(() => {
    rangeRef.current = range;
  }, [range]);

  const reload = useCallback((nextRange = rangeRef.current) => {
    if (enabled && userId) {
      void loadForAuthenticatedUser(userId, nextRange);
    }
  }, [enabled, loadForAuthenticatedUser, userId]);

  useFocusEffect(useCallback(() => {
    reload();
  }, [reload]));

  return {
    enabled,
    user,
    activeUserId,
    range,
    events,
    nextCursor,
    listStatus,
    isLoadingMore,
    errorMessage,
    selectRange: reload,
    loadMore,
    retry,
  };
}
