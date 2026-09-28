import { Response, Router } from "express";
import { AuthRequest, authenticate } from "../middleware/auth.middleware";
import {
  getUnreadCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../services/notification.service";

const router = Router();

router.get("/", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const data = await listNotifications(userId);
    return res.json(data);
  } catch (error) {
    console.error("listNotifications error:", error);
    return res.status(500).json({ message: "Failed to load notifications" });
  }
});

router.get("/unread-count", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const count = await getUnreadCount(userId);
    return res.json({ count });
  } catch (error) {
    console.error("getUnreadCount error:", error);
    return res.status(500).json({ message: "Failed to load unread count" });
  }
});

router.post("/:id/read", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const ok = await markNotificationRead(userId, String(req.params.id));
    return res.json({ ok });
  } catch (error) {
    console.error("markNotificationRead error:", error);
    return res.status(500).json({ message: "Failed to mark as read" });
  }
});

router.post("/read-all", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const count = await markAllNotificationsRead(userId);
    return res.json({ ok: true, count });
  } catch (error) {
    console.error("markAllNotificationsRead error:", error);
    return res.status(500).json({ message: "Failed to mark all as read" });
  }
});

export default router;
