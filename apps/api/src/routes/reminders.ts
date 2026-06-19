import { Hono } from "hono";
import { prisma } from "../app";

const reminderRouter = new Hono();

// GET /api/v1/reminders — Active reminders
reminderRouter.get("/", async (c) => {
  const userId = c.get("userId") as string;

  const reminders = await prisma.medicationReminder.findMany({
    where: { userId, isActive: true },
    orderBy: { createdAt: "desc" },
  });

  return c.json({
    success: true,
    data: reminders.map((r) => ({
      id: r.id, medicationName: r.medicationName, dosage: r.dosage,
      frequency: r.frequency, startDate: r.startDate, endDate: r.endDate,
      source: r.source, isActive: r.isActive,
    })),
  });
});

// POST /api/v1/reminders — Create reminder
reminderRouter.post("/", async (c) => {
  try {
    const userId = c.get("userId") as string;
    const { medicationName, dosage, frequency, startDate, endDate, source } = await c.req.json();

    const reminder = await prisma.medicationReminder.create({
      data: {
        userId, medicationName,
        dosage: dosage || null,
        frequency: frequency || { times: ["09:00"], instruction: "Once daily" },
        startDate: startDate ? new Date(startDate) : new Date(),
        endDate: endDate ? new Date(endDate) : null,
        source: source || "manual",
      },
    });

    return c.json({ success: true, data: reminder });
  } catch (error: any) {
    return c.json({ success: false, error: { code: "CREATE_ERROR", message: error.message } }, 500);
  }
});

// PUT /api/v1/reminders/:id — Update reminder
reminderRouter.put("/:id", async (c) => {
  try {
    const userId = c.get("userId") as string;
    const id = c.req.param("id");
    const body = await c.req.json();

    const reminder = await prisma.medicationReminder.updateMany({
      where: { id, userId },
      data: {
        ...(body.medicationName && { medicationName: body.medicationName }),
        ...(body.dosage !== undefined && { dosage: body.dosage }),
        ...(body.frequency && { frequency: body.frequency }),
        ...(body.endDate && { endDate: new Date(body.endDate) }),
        ...(body.isActive !== undefined && { isActive: body.isActive }),
      },
    });

    if (reminder.count === 0) return c.json({ success: false, error: { code: "NOT_FOUND" } }, 404);
    return c.json({ success: true, data: { id, ...body } });
  } catch (error: any) {
    return c.json({ success: false, error: { code: "UPDATE_ERROR", message: error.message } }, 500);
  }
});

// DELETE /api/v1/reminders/:id — Deactivate reminder
reminderRouter.delete("/:id", async (c) => {
  const userId = c.get("userId") as string;
  const id = c.req.param("id");

  const result = await prisma.medicationReminder.updateMany({
    where: { id, userId },
    data: { isActive: false },
  });

  if (result.count === 0) return c.json({ success: false, error: { code: "NOT_FOUND" } }, 404);
  return c.json({ success: true, data: { id, isActive: false } });
});

// GET /api/v1/reminders/due — Due reminders
reminderRouter.get("/due", async (c) => {
  const userId = c.get("userId") as string;
  const now = new Date();
  const currentTime = now.toTimeString().slice(0, 5);

  const reminders = await prisma.medicationReminder.findMany({
    where: {
      userId, isActive: true,
      startDate: { lte: now },
      OR: [{ endDate: null }, { endDate: { gte: now } }],
    },
  });

  // Filter by time match
  const due = reminders.filter((r) => {
    const freq = r.frequency as any;
    if (!freq?.times) return false;
    return freq.times.some((t: string) => {
      const diff = Math.abs(timeToMinutes(currentTime) - timeToMinutes(t));
      return diff <= 30; // Within 30 min window
    });
  });

  return c.json({ success: true, data: due, currentTime });
});

// POST /api/v1/reminders/checkin — Mark medication taken (earns H2E points)
reminderRouter.post("/checkin", async (c) => {
  try {
    const userId = c.get("userId") as string;
    const { reminderId } = await c.req.json();

    const reminder = await prisma.medicationReminder.findFirst({
      where: { id: reminderId, userId, isActive: true },
    });
    if (!reminder) return c.json({ success: false, error: { code: "NOT_FOUND" } }, 404);

    const rewardAmount = 3;
    await prisma.pointTransaction.create({
      data: {
        userId, amount: rewardAmount, type: "HEALTH_LOG",
        description: `Medication checkin: ${reminder.medicationName} (reminderId: ${reminderId})`,
      },
    });
    await prisma.user.update({ where: { id: userId }, data: { totalPoints: { increment: rewardAmount } } });

    return c.json({
      success: true,
      data: { reminderId, medicationName: reminder.medicationName, rewardEarned: rewardAmount, checkedInAt: new Date() },
    });
  } catch (error: any) {
    return c.json({ success: false, error: { code: "CHECKIN_ERROR", message: error.message } }, 500);
  }
});

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export { reminderRouter };
