import { createServerFn } from "@tanstack/react-start";

/** ดึงฟีดสถานะระบบ วิเคราะห์ผลกระทบ บันทึกลงฐานข้อมูล และแจ้งเตือน LINE */
export const syncStatusFeed = createServerFn({ method: "POST" }).handler(async () => {
  const { runStatusSync } = await import("./status-sync.server");
  return runStatusSync();
});
