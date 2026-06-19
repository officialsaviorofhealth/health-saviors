import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "../app";

const dataIntelligenceRouter = new Hono();

// ── Revenue distribution shares ──
const PROVIDER_SHARE = 0.50; // 50% to data providers (users)
const PLATFORM_SHARE = 0.30; // 30% platform revenue
const AGENT_SHARE = 0.20;   // 20% to AI agent developers

// ── Zod schema ──
const purchaseSchema = z.object({
  packageId: z.string().min(1, "packageId is required"),
  buyerName: z.string().min(1, "buyerName is required"),
  buyerType: z.enum(["pharma", "insurance", "research", "hospital", "startup"], {
    errorMap: () => ({ message: "buyerType must be one of pharma, insurance, research, hospital, or startup" }),
  }),
  buyerEmail: z.string().email("Please enter a valid email address"),
});

// ── GET /packages — List data packages (DB query) ──
dataIntelligenceRouter.get("/packages", async (c) => {
  const category = c.req.query("category");

  const where = category ? { category } : {};

  const packages = await prisma.dataPackage.findMany({
    where,
    include: {
      _count: { select: { purchases: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return c.json({
    success: true,
    data: packages.map((p) => {
      // Total revenue = purchase count * package USD price
      const totalRevenue = p._count.purchases * p.priceUsd;
      return {
        ...p,
        purchaseCount: p._count.purchases,
        revenueSplit: {
          providers: Math.floor(totalRevenue * PROVIDER_SHARE),
          platform: Math.floor(totalRevenue * PLATFORM_SHARE),
          agents: Math.floor(totalRevenue * AGENT_SHARE),
        },
      };
    }),
    meta: {
      totalPackages: packages.length,
      categories: [
        "symptom-trends",
        "medication-patterns",
        "wearable-insights",
        "demographic-health",
        "seasonal-patterns",
        "behavioral",
      ],
    },
  });
});

// ── GET /revenue — Revenue dashboard (live DB aggregation) ──
dataIntelligenceRouter.get("/revenue", async (c) => {
  // Fetch all purchase data
  const allPurchases = await prisma.dataPurchase.findMany({
    include: { package: true },
  });

  const allPackages = await prisma.dataPackage.findMany();

  // Summary statistics
  const totalRevenue = allPurchases.reduce((s, p) => s + p.pricePaid, 0);
  const platformRevenue = allPurchases.reduce((s, p) => s + p.platformPayout, 0);
  const providerPayouts = allPurchases.reduce((s, p) => s + p.providerPayout, 0);
  const agentPayouts = allPurchases.reduce((s, p) => s + p.agentPayout, 0);
  const totalDataPoints = allPackages.reduce((s, p) => s + p.dataPoints, 0);
  const uniqueBuyers = new Set(allPurchases.map((p) => p.buyerEmail)).size;

  const avgPackagePrice =
    allPackages.length > 0
      ? Math.floor(allPackages.reduce((s, p) => s + p.priceUsd, 0) / allPackages.length)
      : 0;
  const avgQualityScore =
    allPackages.length > 0
      ? Math.floor(allPackages.reduce((s, p) => s + p.qualityScore, 0) / allPackages.length)
      : 0;

  // Daily revenue (grouped by purchase date)
  const dailyMap = new Map<string, { revenue: number; platform: number; provider: number; agent: number; count: number }>();
  for (const purchase of allPurchases) {
    const dateKey = purchase.createdAt.toISOString().split("T")[0];
    const existing = dailyMap.get(dateKey) || { revenue: 0, platform: 0, provider: 0, agent: 0, count: 0 };
    existing.revenue += purchase.pricePaid;
    existing.platform += purchase.platformPayout;
    existing.provider += purchase.providerPayout;
    existing.agent += purchase.agentPayout;
    existing.count += 1;
    dailyMap.set(dateKey, existing);
  }

  const dailyRevenue = Array.from(dailyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, data]) => ({
      date,
      revenue: data.revenue,
      platformShare: data.platform,
      providerShare: data.provider,
      agentShare: data.agent,
      packagesSold: data.count,
    }));

  // Top buyers (aggregated by email)
  const buyerMap = new Map<string, { name: string; type: string; email: string; totalSpent: number; packagesOwned: number }>();
  for (const purchase of allPurchases) {
    const existing = buyerMap.get(purchase.buyerEmail) || {
      name: purchase.buyerName,
      type: purchase.buyerType,
      email: purchase.buyerEmail,
      totalSpent: 0,
      packagesOwned: 0,
    };
    existing.totalSpent += purchase.pricePaid;
    existing.packagesOwned += 1;
    buyerMap.set(purchase.buyerEmail, existing);
  }

  const topBuyers = Array.from(buyerMap.values()).sort((a, b) => b.totalSpent - a.totalSpent);

  // Category breakdown
  const categories = [
    "symptom-trends",
    "medication-patterns",
    "wearable-insights",
    "demographic-health",
    "seasonal-patterns",
    "behavioral",
  ];

  const byCategory = categories.map((cat) => {
    const catPackages = allPackages.filter((p) => p.category === cat);
    const catPackageIds = new Set(catPackages.map((p) => p.id));
    const catPurchases = allPurchases.filter((p) => catPackageIds.has(p.packageId));
    return {
      category: cat,
      packages: catPackages.length,
      revenue: catPurchases.reduce((s, p) => s + p.pricePaid, 0),
      dataPoints: catPackages.reduce((s, p) => s + p.dataPoints, 0),
    };
  });

  return c.json({
    success: true,
    data: {
      summary: {
        totalRevenue,
        platformRevenue,
        providerPayouts,
        agentPayouts,
        totalDataPoints,
        totalPackages: allPackages.length,
        totalBuyers: uniqueBuyers,
        avgPackagePrice,
        avgQualityScore,
        revenueSplit: {
          providers: `${PROVIDER_SHARE * 100}%`,
          platform: `${PLATFORM_SHARE * 100}%`,
          agents: `${AGENT_SHARE * 100}%`,
        },
      },
      dailyRevenue,
      topBuyers,
      byCategory,
    },
  });
});

// ── POST /purchase — Purchase a data package (live DB transaction) ──
dataIntelligenceRouter.post("/purchase", async (c) => {
  const body = await c.req.json();

  // Zod validation
  const parsed = purchaseSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          details: parsed.error.flatten().fieldErrors,
        },
      },
      400,
    );
  }

  const { packageId, buyerName, buyerType, buyerEmail } = parsed.data;

  // Verify the package exists
  const pkg = await prisma.dataPackage.findUnique({ where: { id: packageId } });
  if (!pkg) {
    return c.json({ success: false, error: { code: "NOT_FOUND", message: "Package not found" } }, 404);
  }

  if (pkg.status !== "available") {
    return c.json({ success: false, error: { code: "UNAVAILABLE", message: "This package is not currently available for purchase" } }, 400);
  }

  // Calculate revenue distribution
  const pricePaid = pkg.priceUsd;
  const providerPayout = Math.floor(pricePaid * PROVIDER_SHARE);
  const platformPayout = Math.floor(pricePaid * PLATFORM_SHARE);
  const agentPayout = Math.floor(pricePaid * AGENT_SHARE);

  // Transaction: record the purchase + record platform revenue
  const [purchase] = await prisma.$transaction([
    // Create DataPurchase
    prisma.dataPurchase.create({
      data: {
        packageId,
        buyerName,
        buyerType,
        buyerEmail,
        pricePaid,
        providerPayout,
        platformPayout,
        agentPayout,
      },
    }),
    // Record PlatformRevenue
    prisma.platformRevenue.create({
      data: {
        source: "data-intelligence",
        amount: platformPayout,
        amountH2e: Math.floor(pkg.priceH2e * PLATFORM_SHARE),
        metadata: {
          packageId,
          packageName: pkg.name,
          buyerName,
          buyerEmail,
          totalPricePaid: pricePaid,
        },
      },
    }),
  ]);

  return c.json({
    success: true,
    data: {
      purchaseId: purchase.id,
      packageId,
      packageName: pkg.name,
      purchasePrice: pricePaid,
      format: pkg.format,
      dataPoints: pkg.dataPoints,
      revenueSplit: {
        providers: providerPayout,
        platform: platformPayout,
        agents: agentPayout,
      },
    },
  });
});

// ── GET /buyers — List top buyers (DB aggregation) ──
dataIntelligenceRouter.get("/buyers", async (c) => {
  const purchases = await prisma.dataPurchase.findMany();

  // Aggregate buyers by email
  const buyerMap = new Map<string, { name: string; type: string; email: string; totalSpent: number; packagesOwned: number }>();
  for (const p of purchases) {
    const existing = buyerMap.get(p.buyerEmail) || {
      name: p.buyerName,
      type: p.buyerType,
      email: p.buyerEmail,
      totalSpent: 0,
      packagesOwned: 0,
    };
    existing.totalSpent += p.pricePaid;
    existing.packagesOwned += 1;
    buyerMap.set(p.buyerEmail, existing);
  }

  const buyers = Array.from(buyerMap.values()).sort((a, b) => b.totalSpent - a.totalSpent);

  return c.json({
    success: true,
    data: buyers,
    meta: {
      totalBuyers: buyers.length,
      totalSpent: buyers.reduce((s, b) => s + b.totalSpent, 0),
    },
  });
});

// ── POST /seed — Generate seed data (6 packages + sample purchases) ──
dataIntelligenceRouter.post("/seed", async (c) => {
  // Reset existing data
  await prisma.dataPurchase.deleteMany();
  await prisma.dataPackage.deleteMany();
  await prisma.platformRevenue.deleteMany({ where: { source: "data-intelligence" } });

  // Seed 6 data packages
  const seedPackages = [
    {
      name: "Q1 2026 Symptom Trend Analysis",
      description: "Anonymized symptom frequency, severity, and duration patterns across 50K+ entries",
      category: "symptom-trends",
      dataPoints: 52400,
      anonymizedUsers: 3200,
      timeRange: "2026 Q1 (Jan-Mar)",
      format: "FHIR-R4",
      priceH2e: 50000,
      priceUsd: 2500,
      curatedBy: "DataCurator AI",
      qualityScore: 94,
      sampleFields: ["snomedCode", "severity", "duration", "ageGroup", "seasonality", "comorbidity"],
      status: "available",
    },
    {
      name: "Medication Interaction Patterns",
      description: "Reported medication combinations, effectiveness ratings, and side effect correlations",
      category: "medication-patterns",
      dataPoints: 28700,
      anonymizedUsers: 1800,
      timeRange: "2025 Q4 - 2026 Q1",
      format: "JSON",
      priceH2e: 75000,
      priceUsd: 3750,
      curatedBy: "PharmaInsight AI",
      qualityScore: 91,
      sampleFields: ["medicationPair", "interactionType", "severityLevel", "userReportedEffects", "duration"],
      status: "available",
    },
    {
      name: "Wearable Cardiovascular Dataset",
      description: "Heart rate, SpO2, activity correlation data from connected wearable devices",
      category: "wearable-insights",
      dataPoints: 1250000,
      anonymizedUsers: 4500,
      timeRange: "2025 H2 - 2026 Q1",
      format: "PARQUET",
      priceH2e: 150000,
      priceUsd: 7500,
      curatedBy: "BioData AI",
      qualityScore: 97,
      sampleFields: ["heartRate", "spo2", "steps", "sleepStage", "activityType", "timestamp"],
      status: "available",
    },
    {
      name: "Seasonal Health Pattern Report",
      description: "Year-long seasonal symptom variation analysis with climate correlation",
      category: "seasonal-patterns",
      dataPoints: 89000,
      anonymizedUsers: 5600,
      timeRange: "2025 Full Year",
      format: "CSV",
      priceH2e: 100000,
      priceUsd: 5000,
      curatedBy: "EpiData AI",
      qualityScore: 89,
      sampleFields: ["month", "symptomCluster", "temperature", "humidity", "prevalence", "severity"],
      status: "available",
    },
    {
      name: "Sleep Behavior Intelligence",
      description: "Sleep patterns correlated with lifestyle, diet, exercise, and medication data",
      category: "behavioral",
      dataPoints: 67300,
      anonymizedUsers: 2900,
      timeRange: "2025 Q3 - 2026 Q1",
      format: "JSON",
      priceH2e: 85000,
      priceUsd: 4250,
      curatedBy: "SleepResearch AI",
      qualityScore: 92,
      sampleFields: ["sleepDuration", "sleepQuality", "preSleepActivity", "dietType", "exerciseIntensity", "medications"],
      status: "available",
    },
    {
      name: "Demographic Health Baseline",
      description: "Age-group segmented health baselines, symptom prevalence, and wellness scores",
      category: "demographic-health",
      dataPoints: 41000,
      anonymizedUsers: 8200,
      timeRange: "2025 - 2026",
      format: "FHIR-R4",
      priceH2e: 120000,
      priceUsd: 6000,
      curatedBy: "PopHealth AI",
      qualityScore: 95,
      sampleFields: ["ageGroup", "gender", "wellnessScore", "topSymptoms", "avgDetailScore", "streakRetention"],
      status: "available",
    },
  ];

  const createdPackages = await Promise.all(
    seedPackages.map((pkg) => prisma.dataPackage.create({ data: pkg })),
  );

  // Sample purchase seed data
  const sampleBuyers = [
    { name: "HealthMetrics Research", type: "research", email: "data@healthmetrics.io" },
    { name: "AstraZeneca Data Lab", type: "pharma", email: "datalab@astrazeneca.com" },
    { name: "Global Health Insurance Group", type: "insurance", email: "data@ghig.com" },
    { name: "Metropolitan University Hospital", type: "hospital", email: "research@muh.org" },
    { name: "Noom Health AI", type: "startup", email: "ai@noom.com" },
    { name: "Bayer Pharmaceuticals", type: "pharma", email: "insights@bayer.com" },
    { name: "Meridian Biopharmaceuticals", type: "pharma", email: "data@meridianbio.com" },
  ];

  // Generate random purchases for each package
  const purchasePromises: Promise<unknown>[] = [];
  const revenuePromises: Promise<unknown>[] = [];

  for (const pkg of createdPackages) {
    // 2 to 5 buyers per package
    const numBuyers = 2 + Math.floor(Math.random() * 4);
    const shuffled = [...sampleBuyers].sort(() => Math.random() - 0.5).slice(0, numBuyers);

    for (const buyer of shuffled) {
      const providerPayout = Math.floor(pkg.priceUsd * PROVIDER_SHARE);
      const platformPayout = Math.floor(pkg.priceUsd * PLATFORM_SHARE);
      const agentPayout = Math.floor(pkg.priceUsd * AGENT_SHARE);

      // Spread purchase dates across the last 30 days
      const daysAgo = Math.floor(Math.random() * 30);
      const purchaseDate = new Date();
      purchaseDate.setDate(purchaseDate.getDate() - daysAgo);

      purchasePromises.push(
        prisma.dataPurchase.create({
          data: {
            packageId: pkg.id,
            buyerName: buyer.name,
            buyerType: buyer.type,
            buyerEmail: buyer.email,
            pricePaid: pkg.priceUsd,
            providerPayout,
            platformPayout,
            agentPayout,
            createdAt: purchaseDate,
          },
        }),
      );

      revenuePromises.push(
        prisma.platformRevenue.create({
          data: {
            source: "data-intelligence",
            amount: platformPayout,
            amountH2e: Math.floor(pkg.priceH2e * PLATFORM_SHARE),
            metadata: {
              packageId: pkg.id,
              packageName: pkg.name,
              buyerName: buyer.name,
              buyerEmail: buyer.email,
              totalPricePaid: pkg.priceUsd,
            },
            createdAt: purchaseDate,
          },
        }),
      );
    }
  }

  await Promise.all([...purchasePromises, ...revenuePromises]);

  // Count the generated data
  const totalPurchases = await prisma.dataPurchase.count();
  const totalRevenueRecords = await prisma.platformRevenue.count({ where: { source: "data-intelligence" } });

  return c.json({
    success: true,
    message: "Seed data generated successfully",
    data: {
      packagesCreated: createdPackages.length,
      purchasesCreated: totalPurchases,
      revenueRecordsCreated: totalRevenueRecords,
      packages: createdPackages.map((p) => ({ id: p.id, name: p.name, category: p.category })),
    },
  });
});

export { dataIntelligenceRouter };
