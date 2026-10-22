import { useEffect } from "react";
import { useNavigate } from "react-router";
import { onNotificationActivated } from "../../notifications";

export function NotificationRouter() {
  const navigate = useNavigate();

  useEffect(() => {
    const unlistenPromise = onNotificationActivated((route) => {
      navigate(route);
    }).catch(() => () => {});
    return () => {
      unlistenPromise.then((fn) => fn());
    };
  }, [navigate]);

  return null;
}
