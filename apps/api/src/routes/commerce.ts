import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "../app";

const commerceRouter = new Hono();

// ── Zod schemas / validation schemas ──

const clickSchema = z.object({
  productId: z.string().uuid(),
  agentId: z.string().uuid().optional(),
});

const purchaseSchema = z.object({
  productId: z.string().uuid(),
  agentId: z.string().uuid().optional(),
});

// ── GET /products — fetch product list (DB) ──
commerceRouter.get("/products", async (c) => {
  const category = c.req.query("category");
  const search = c.req.query("search");

  const where: any = { isActive: true };
  if (category) where.category = category;
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
    ];
  }

  const products = await prisma.commerceProduct.findMany({
    where,
    include: { _count: { select: { clicks: true } } },
    orderBy: { createdAt: "desc" },
  });

  return c.json({
    success: true,
    data: products.map((p) => ({
      ...p,
      clickCount: p._count.clicks,
      affiliateRevenue: Math.floor(p.price * p.affiliateCommission * p.totalSales),
    })),
    meta: {
      totalProducts: products.length,
      categories: ["supplement", "fitness", "sleep", "nutrition", "mental", "device"],
    },
  });
});

// ── GET /recommend — AI-based personalized recommendations ──
commerceRouter.get("/recommend", async (c) => {
  const userId = c.get("userId") as string;

  // Fetch the user's symptom logs from the last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const recentSymptoms = await prisma.symptomLog.findMany({
    where: {
      entry: { userId },
      onsetDate: { gte: thirtyDaysAgo },
    },
    select: { displayName: true, snomedCode: true, severity: true },
    orderBy: { onsetDate: "desc" },
    take: 50,
  });

  // Extract symptom keywords (based on displayName)
  const symptomKeywords = [
    ...new Set(recentSymptoms.map((s) => s.displayName.toLowerCase())),
  ];

  let products;

  if (symptomKeywords.length > 0) {
    // Fetch all active products, then match against symptoms
    const allProducts = await prisma.commerceProduct.findMany({
      where: { isActive: true },
      include: { _count: { select: { clicks: true } } },
    });

    // Compute a match score for each product
    const scored = allProducts.map((p) => {
      let matchCount = 0;
      for (const keyword of symptomKeywords) {
        for (const symptom of p.matchingSymptoms) {
          if (
            keyword.includes(symptom.toLowerCase()) ||
            symptom.toLowerCase().includes(keyword)
          ) {
            matchCount++;
          }
        }
      }
      // Score combining rating and match count
      const matchScore = Math.min(
        100,
        Math.round(matchCount * 25 + p.rating * 5)
      );
      return { ...p, matchScore };
    });

    // Sort by match score, top 5
    products = scored
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 5);
  } else {
    // No symptoms: return the top-rated products
    const topRated = await prisma.commerceProduct.findMany({
      where: { isActive: true },
      include: { _count: { select: { clicks: true } } },
      orderBy: [{ rating: "desc" }, { reviews: "desc" }],
      take: 5,
    });
    products = topRated.map((p, i) => ({
      ...p,
      matchScore: 90 - i * 8,
    }));
  }

  return c.json({
    success: true,
    data: {
      userId,
      symptomContext: symptomKeywords.length > 0
        ? symptomKeywords.slice(0, 10)
        : ["no-recent-symptoms"],
      products: products.map((p) => ({
        id: p.id,
        name: p.name,
        category: p.category,
        brand: p.brand,
        price: p.price,
        rating: p.rating,
        reviews: p.reviews,
        imageEmoji: p.imageEmoji,
        description: p.description,
        matchingSymptoms: p.matchingSymptoms,
        h2eDiscount: p.h2eDiscount,
        matchScore: p.matchScore,
        matchReason:
          symptomKeywords.length > 0
            ? `Matches your recent symptoms with ${p.matchScore}% confidence`
            : `Top-rated product (${p.rating}/5)`,
      })),
      reasoning:
        symptomKeywords.length > 0
          ? `Based on ${symptomKeywords.length} recent symptoms, matched products with relevant ingredients and conditions.`
          : "No recent symptoms found. Showing top-rated products for general wellness.",
    },
  });
});

// ── GET /revenue — commerce revenue dashboard (live DB aggregation) ──
commerceRouter.get("/revenue", async (c) => {
  // Overall product statistics
  const productStats = await prisma.commerceProduct.aggregate({
    _sum: { totalRevenue: true, totalSales: true },
    _avg: { affiliateCommission: true },
    where: { isActive: true },
  });

  const totalRevenue = productStats._sum.totalRevenue || 0;
  const totalSales = productStats._sum.totalSales || 0;
  const avgCommission = productStats._avg.affiliateCommission || 0;

  // Overall click/conversion statistics
  const totalClicks = await prisma.commerceClick.count();
  const totalConversions = await prisma.commerceClick.count({
    where: { converted: true },
  });
  const conversionRate =
    totalClicks > 0 ? ((totalConversions / totalClicks) * 100).toFixed(1) : "0.0";

  // Daily revenue for the last 30 days (based on converted=true clicks)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const dailyClicks = await prisma.commerceClick.groupBy({
    by: ["createdAt"],
    where: { createdAt: { gte: thirtyDaysAgo } },
    _count: { id: true },
    _sum: { revenue: true },
  });

  // Aggregate by date (raw date → YYYY-MM-DD group)
  const dailyMap = new Map<
    string,
    { revenue: number; clicks: number; conversions: number }
  >();

  // First, classify all click data by date
  const recentClicks = await prisma.commerceClick.findMany({
    where: { createdAt: { gte: thirtyDaysAgo } },
    select: { createdAt: true, converted: true, revenue: true },
    orderBy: { createdAt: "asc" },
  });

  for (const click of recentClicks) {
    const dateKey = click.createdAt.toISOString().split("T")[0];
    const existing = dailyMap.get(dateKey) || {
      revenue: 0,
      clicks: 0,
      conversions: 0,
    };
    existing.clicks++;
    if (click.converted) {
      existing.conversions++;
      existing.revenue += click.revenue;
    }
    dailyMap.set(dateKey, existing);
  }

  const dailyRevenue = Array.from(dailyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, data]) => ({
      date,
      revenue: Math.floor(data.revenue),
      sales: data.conversions,
      clicks: data.clicks,
      conversionRate:
        data.clicks > 0
          ? +((data.conversions / data.clicks) * 100).toFixed(1)
          : 0,
    }));

  // Top 5 products by revenue
  const topProducts = await prisma.commerceProduct.findMany({
    where: { isActive: true },
    orderBy: { totalRevenue: "desc" },
    take: 5,
  });

  // Aggregate by category
  const categories = [
    "supplement",
    "fitness",
    "sleep",
    "nutrition",
    "mental",
    "device",
  ] as const;

  const byCategory = await Promise.all(
    categories.map(async (cat) => {
      const stats = await prisma.commerceProduct.aggregate({
        where: { category: cat, isActive: true },
        _count: { id: true },
        _sum: { totalRevenue: true, totalSales: true },
      });
      return {
        category: cat,
        products: stats._count.id,
        revenue: stats._sum.totalRevenue || 0,
        sales: stats._sum.totalSales || 0,
      };
    })
  );

  return c.json({
    success: true,
    data: {
      summary: {
        totalRevenue,
        totalSales,
        avgCommissionRate: `${(avgCommission * 100).toFixed(1)}%`,
        avgOrderValue:
          totalSales > 0
            ? +((totalRevenue / totalSales) * (1 / avgCommission)).toFixed(2)
            : 0,
        conversionRate: `${conversionRate}%`,
        totalClicks,
        totalConversions,
      },
      dailyRevenue,
      topProducts: topProducts.map((p) => ({
        id: p.id,
        name: p.name,
        emoji: p.imageEmoji,
        revenue: p.totalRevenue,
        sales: p.totalSales,
        commission: `${p.affiliateCommission * 100}%`,
      })),
      byCategory,
    },
  });
});

// ── POST /click — product click tracking (affiliate tracking) ──
commerceRouter.post("/click", async (c) => {
  const body = await c.req.json();
  const parsed = clickSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { success: false, error: { code: "VALIDATION_ERROR", details: parsed.error.issues } },
      400
    );
  }

  const { productId, agentId } = parsed.data;
  const userId = c.get("userId") as string;

  // Verify the product exists
  const product = await prisma.commerceProduct.findUnique({
    where: { id: productId },
  });
  if (!product) {
    return c.json({ success: false, error: { code: "NOT_FOUND", message: "Product not found" } }, 404);
  }

  // Simulate an 18% conversion rate
  const converted = Math.random() < 0.18;
  const revenue = converted
    ? Math.floor(product.price * product.affiliateCommission * 100) / 100
    : 0;

  // Create the click record
  const click = await prisma.commerceClick.create({
    data: {
      productId,
      userId,
      agentId: agentId || null,
      converted,
      revenue,
    },
  });

  // On conversion, update product statistics and platform revenue
  if (converted) {
    await prisma.commerceProduct.update({
      where: { id: productId },
      data: {
        totalSales: { increment: 1 },
        totalRevenue: { increment: revenue },
      },
    });

    // Record platform revenue
    await prisma.platformRevenue.create({
      data: {
        source: "commerce",
        amount: revenue,
        amountH2e: Math.floor(revenue * 10), // 1 USD ≈ 10 H2E
        metadata: {
          productId,
          productName: product.name,
          clickId: click.id,
          affiliateCommission: product.affiliateCommission,
        },
      },
    });
  }

  return c.json({
    success: true,
    data: {
      clickId: click.id,
      productId,
      converted,
      revenue,
      tracked: true,
      affiliateLink: `https://affiliate.example.com/track/${productId}`,
    },
  });
});

// ── POST /purchase — H2E discount purchase ──
commerceRouter.post("/purchase", async (c) => {
  const body = await c.req.json();
  const parsed = purchaseSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { success: false, error: { code: "VALIDATION_ERROR", details: parsed.error.issues } },
      400
    );
  }

  const { productId, agentId } = parsed.data;
  const userId = c.get("userId") as string;

  // Fetch the product
  const product = await prisma.commerceProduct.findUnique({
    where: { id: productId },
  });
  if (!product) {
    return c.json({ success: false, error: { code: "NOT_FOUND", message: "Product not found" } }, 404);
  }

  // Check the user's points
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { totalPoints: true },
  });
  if (!user) {
    return c.json({ success: false, error: { code: "USER_NOT_FOUND" } }, 404);
  }

  if (user.totalPoints < product.h2eDiscount) {
    return c.json(
      {
        success: false,
        error: {
          code: "INSUFFICIENT_POINTS",
          message: `${product.h2eDiscount} H2E points are required. Current balance: ${user.totalPoints}`,
          required: product.h2eDiscount,
          current: user.totalPoints,
        },
      },
      400
    );
  }

  const revenue =
    Math.floor(product.price * product.affiliateCommission * 100) / 100;

  // Deduct points + record the click + create the point transaction (transaction)
  const [updatedUser, click, pointTx] = await prisma.$transaction([
    // Deduct points
    prisma.user.update({
      where: { id: userId },
      data: { totalPoints: { decrement: product.h2eDiscount } },
    }),
    // Record the commerce click (includes h2eUsed; converted=true since it is a purchase)
    prisma.commerceClick.create({
      data: {
        productId,
        userId,
        agentId: agentId || null,
        converted: true,
        revenue,
        h2eUsed: product.h2eDiscount,
      },
    }),
    // Record the point transaction
    prisma.pointTransaction.create({
      data: {
        userId,
        amount: -product.h2eDiscount,
        type: "COMMERCE_PURCHASE",
        description: `${product.name} H2E discount purchase (${product.h2eDiscount} H2E)`,
      },
    }),
  ]);

  // Update product sales statistics
  await prisma.commerceProduct.update({
    where: { id: productId },
    data: {
      totalSales: { increment: 1 },
      totalRevenue: { increment: revenue },
    },
  });

  return c.json({
    success: true,
    data: {
      clickId: click.id,
      productId,
      productName: product.name,
      h2eUsed: product.h2eDiscount,
      remainingPoints: updatedUser.totalPoints,
      revenue,
      transactionId: pointTx.id,
    },
  });
});

// ── POST /seed — health product seed data ──
commerceRouter.post("/seed", async (c) => {
  const seedProducts = [
    {
      name: "Magnesium Glycinate 400mg",
      category: "supplement",
      brand: "NOW Foods",
      price: 24.99,
      affiliateCommission: 0.15,
      rating: 4.7,
      reviews: 12840,
      imageEmoji: "💊",
      description:
        "Highly bioavailable magnesium for sleep, muscle recovery, and stress relief",
      matchingSymptoms: ["insomnia", "muscle-pain", "stress", "headache", "fatigue"],
      matchingConditions: ["sleep-disorder", "anxiety", "muscle-cramp"],
      ingredients: ["Magnesium Glycinate", "Cellulose", "Stearic Acid"],
      h2eDiscount: 200,
      totalSales: 3420,
      totalRevenue: 12847,
    },
    {
      name: "Vitamin D3 5000 IU + K2",
      category: "supplement",
      brand: "Sports Research",
      price: 19.99,
      affiliateCommission: 0.18,
      rating: 4.8,
      reviews: 45230,
      imageEmoji: "☀️",
      description:
        "Essential for bone health, immunity, and mood regulation",
      matchingSymptoms: ["fatigue", "bone-pain", "depression", "weakness"],
      matchingConditions: ["vitamin-d-deficiency", "seasonal-depression"],
      ingredients: ["Vitamin D3", "Vitamin K2", "Coconut Oil"],
      h2eDiscount: 150,
      totalSales: 8920,
      totalRevenue: 32133,
    },
    {
      name: "Triple Strength Omega-3",
      category: "supplement",
      brand: "Nordic Naturals",
      price: 34.99,
      affiliateCommission: 0.12,
      rating: 4.6,
      reviews: 28900,
      imageEmoji: "🐟",
      description: "High EPA/DHA for heart, brain, and joint health",
      matchingSymptoms: ["joint-pain", "brain-fog", "inflammation"],
      matchingConditions: ["cardiovascular", "cognitive-decline", "arthritis"],
      ingredients: ["Fish Oil", "EPA", "DHA", "Vitamin E"],
      h2eDiscount: 250,
      totalSales: 5670,
      totalRevenue: 23819,
    },
    {
      name: "Ashwagandha KSM-66 600mg",
      category: "mental",
      brand: "Jarrow Formulas",
      price: 22.99,
      affiliateCommission: 0.16,
      rating: 4.5,
      reviews: 15600,
      imageEmoji: "🌿",
      description:
        "Clinically studied adaptogen for stress, cortisol, and sleep",
      matchingSymptoms: ["stress", "anxiety", "insomnia", "fatigue"],
      matchingConditions: ["chronic-stress", "anxiety", "adrenal-fatigue"],
      ingredients: ["Ashwagandha KSM-66 Root Extract"],
      h2eDiscount: 180,
      totalSales: 4320,
      totalRevenue: 15905,
    },
    {
      name: "Whey Protein Isolate",
      category: "fitness",
      brand: "Optimum Nutrition",
      price: 39.99,
      affiliateCommission: 0.1,
      rating: 4.7,
      reviews: 89000,
      imageEmoji: "💪",
      description:
        "24g protein per serving for muscle recovery and growth",
      matchingSymptoms: ["muscle-pain", "fatigue", "weakness"],
      matchingConditions: ["muscle-recovery", "exercise-related"],
      ingredients: ["Whey Protein Isolate", "Lecithin", "Natural Flavors"],
      h2eDiscount: 300,
      totalSales: 12400,
      totalRevenue: 49560,
    },
    {
      name: "Melatonin 3mg Time Release",
      category: "sleep",
      brand: "Natrol",
      price: 12.99,
      affiliateCommission: 0.2,
      rating: 4.4,
      reviews: 67800,
      imageEmoji: "🌙",
      description: "Drug-free sleep aid with time-release formula",
      matchingSymptoms: ["insomnia", "sleep-difficulty", "jet-lag"],
      matchingConditions: ["sleep-disorder", "circadian-disruption"],
      ingredients: ["Melatonin", "Vitamin B6", "Calcium"],
      h2eDiscount: 100,
      totalSales: 9800,
      totalRevenue: 25480,
    },
    {
      name: "Multi-Strain Probiotic 50B",
      category: "nutrition",
      brand: "Garden of Life",
      price: 29.99,
      affiliateCommission: 0.14,
      rating: 4.6,
      reviews: 21300,
      imageEmoji: "🦠",
      description:
        "16 diverse strains for gut health, immunity, and digestion",
      matchingSymptoms: ["digestive-issues", "bloating", "stomach-pain"],
      matchingConditions: ["ibs", "digestive-disorder", "immune-support"],
      ingredients: ["Lactobacillus", "Bifidobacterium", "Organic Prebiotic Fiber"],
      h2eDiscount: 220,
      totalSales: 6700,
      totalRevenue: 28098,
    },
    {
      name: "Advanced Health Tracker Band",
      category: "device",
      brand: "Xiaomi",
      price: 49.99,
      affiliateCommission: 0.08,
      rating: 4.3,
      reviews: 34500,
      imageEmoji: "⌚",
      description:
        "HR, SpO2, sleep tracking, steps, and stress monitoring",
      matchingSymptoms: [],
      matchingConditions: ["general-wellness"],
      h2eDiscount: 400,
      totalSales: 2100,
      totalRevenue: 8399,
    },
  ];

  // Delete existing products and recreate them (clean reset instead of upsert)
  await prisma.commerceClick.deleteMany({});
  await prisma.commerceProduct.deleteMany({});

  const created = await Promise.all(
    seedProducts.map((p) => prisma.commerceProduct.create({ data: p }))
  );

  return c.json({
    success: true,
    data: {
      seeded: created.length,
      products: created.map((p) => ({
        id: p.id,
        name: p.name,
        emoji: p.imageEmoji,
        category: p.category,
        price: p.price,
      })),
    },
    message: `${created.length} health products were seeded`,
  });
});

export { commerceRouter };
