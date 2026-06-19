import { useEffect, useState } from "react";
import NetInfo from "@react-native-community/netinfo";
import { flushPendingPhotos } from "./photo-outbox";

export function useNetworkStatus() {
  const [isConnected, setIsConnected] = useState(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const nowConnected = Boolean(state.isConnected && state.isInternetReachable !== false);
      setIsConnected((wasConnected) => {
        if (!wasConnected && nowConnected) {
          flushPendingPhotos().catch(() => {});
        }
        return nowConnected;
      });
    });

    return unsubscribe;
  }, []);

  return { isConnected };
}
