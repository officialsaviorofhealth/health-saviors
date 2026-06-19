import { Hono } from "hono";
import { prisma } from "../app";

const educationRouter = new Hono();

// GET /api/v1/education/tip — Today's personalized tip
educationRouter.get("/tip", async (c) => {
  const userId = c.get("userId") as string;

  // Get user's recent symptoms to personalize tip
  const recentSymptoms = await prisma.symptomLog.findMany({
    where: { entry: { userId } },
    orderBy: { onsetDate: "desc" },
    take: 5,
    select: { snomedCode: true },
  });
  const snomedCodes = recentSymptoms.map((s) => s.snomedCode);

  // Find a tip matching recent symptoms, or random active tip
  let tip = snomedCodes.length > 0
    ? await prisma.dailyTip.findFirst({
        where: { isActive: true, relatedSnomedCodes: { hasSome: snomedCodes } },
        orderBy: { createdAt: "desc" },
      })
    : null;

  if (!tip) {
    const count = await prisma.dailyTip.count({ where: { isActive: true } });
    if (count > 0) {
      const skip = Math.floor(Math.random() * count);
      tip = await prisma.dailyTip.findFirst({ where: { isActive: true }, skip });
    }
  }

  if (!tip) {
    return c.json({
      success: true,
      data: {
        id: "default", title: "Stay Hydrated",
        content: "Aim for 8 glasses of water daily.",
        category: "general", rewardPoints: 2,
      },
    });
  }

  return c.json({
    success: true,
    data: {
      id: tip.id, title: tip.title,
      content: tip.content,
      category: tip.category, rewardPoints: 2,
    },
  });
});

// GET /api/v1/education/quiz — Next unanswered quiz
educationRouter.get("/quiz", async (c) => {
  const userId = c.get("userId") as string;

  // Find quiz not yet answered by this user
  const answeredIds = (
    await prisma.quizSubmission.findMany({
      where: { userId },
      select: { quizId: true },
    })
  ).map((s) => s.quizId);

  const quiz = await prisma.quizQuestion.findFirst({
    where: { isActive: true, id: { notIn: answeredIds.length > 0 ? answeredIds : ["none"] } },
    orderBy: { createdAt: "asc" },
  });

  if (!quiz) {
    return c.json({ success: true, data: null, message: "All quizzes completed" });
  }

  return c.json({
    success: true,
    data: {
      id: quiz.id, question: quiz.question,
      options: quiz.options, difficulty: quiz.difficulty, rewardAmount: quiz.rewardAmount,
    },
  });
});

// POST /api/v1/education/quiz/submit — Submit quiz answer
educationRouter.post("/quiz/submit", async (c) => {
  try {
    const userId = c.get("userId") as string;
    const { quizId, selectedIndex } = await c.req.json();

    const quiz = await prisma.quizQuestion.findUnique({ where: { id: quizId } });
    if (!quiz) return c.json({ success: false, error: { code: "QUIZ_NOT_FOUND" } }, 404);

    // Check for duplicate submission
    const existing = await prisma.quizSubmission.findUnique({
      where: { userId_quizId: { userId, quizId } },
    });
    if (existing) {
      return c.json({ success: false, error: { code: "ALREADY_SUBMITTED", message: "You have already submitted this quiz" } }, 400);
    }

    const isCorrect = selectedIndex === quiz.correctIndex;
    const rewardEarned = isCorrect ? quiz.rewardAmount : 0;

    await prisma.quizSubmission.create({
      data: { userId, quizId, selectedIndex, isCorrect, rewardEarned },
    });

    // Grant reward if correct
    if (isCorrect) {
      await prisma.pointTransaction.create({
        data: { userId, amount: rewardEarned, type: "QUIZ_CORRECT", description: `Quiz correct (quizId: ${quizId})` },
      });
      await prisma.user.update({ where: { id: userId }, data: { totalPoints: { increment: rewardEarned } } });
    }

    return c.json({
      success: true,
      data: {
        correct: isCorrect, correctIndex: quiz.correctIndex,
        explanation: quiz.explanation,
        rewardEarned,
      },
    });
  } catch (error: any) {
    console.error("Quiz submit error:", error);
    return c.json({ success: false, error: { code: "QUIZ_ERROR", message: error.message } }, 500);
  }
});

// GET /api/v1/education/courses — Available courses
educationRouter.get("/courses", async (c) => {
  const userId = c.get("userId") as string;

  const courses = await prisma.course.findMany({
    where: { isActive: true },
    include: { progress: { where: { userId } } },
  });

  return c.json({
    success: true,
    data: courses.map((course) => {
      const userProgress = course.progress[0];
      return {
        id: course.id, title: course.title,
        description: course.description,
        modules: course.modules, totalReward: course.totalReward, category: course.category,
        progress: userProgress ? {
          completedModules: userProgress.completedModules,
          isCompleted: userProgress.isCompleted,
          rewardClaimed: userProgress.rewardClaimed,
        } : null,
      };
    }),
  });
});

// POST /api/v1/education/courses/:id/progress — Update course progress
educationRouter.post("/courses/:id/progress", async (c) => {
  try {
    const userId = c.get("userId") as string;
    const courseId = c.req.param("id");
    const { moduleIndex } = await c.req.json();

    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course) return c.json({ success: false, error: { code: "COURSE_NOT_FOUND" } }, 404);

    const progress = await prisma.courseProgress.upsert({
      where: { userId_courseId: { userId, courseId } },
      update: { completedModules: { push: moduleIndex } },
      create: { userId, courseId, completedModules: [moduleIndex] },
    });

    const totalModules = (course.modules as any[]).length;
    const isCompleted = progress.completedModules.length >= totalModules;

    if (isCompleted && !progress.isCompleted) {
      await prisma.courseProgress.update({
        where: { id: progress.id },
        data: { isCompleted: true, completedAt: new Date() },
      });
      // Grant course completion reward
      await prisma.pointTransaction.create({
        data: { userId, amount: course.totalReward, type: "DAILY_TIP_VIEW", description: `Course completed (courseId: ${courseId})` },
      });
      await prisma.user.update({ where: { id: userId }, data: { totalPoints: { increment: course.totalReward } } });
    }

    return c.json({
      success: true,
      data: { courseId, completedModules: progress.completedModules, isCompleted },
    });
  } catch (error: any) {
    return c.json({ success: false, error: { code: "COURSE_ERROR", message: error.message } }, 500);
  }
});

export { educationRouter };
