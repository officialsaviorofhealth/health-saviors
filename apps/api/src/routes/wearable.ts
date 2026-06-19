// Wearable Device API Routes
// Hono routes for wearable data sync, OAuth, and summaries.

import { Hono } from "hono";
import { prisma } from "../app";
import {
  createAdapter,
  getSupportedSources,
  WearableAnalyzer,
  AppleHealthAdapter,
  SamsungHealthAdapter,
  GoogleFitAdapter,
} from "../../../../packages/wearable-adapter";
import type {
  WearableSource,
  WearableData,
  DataType,
  AppleHealthKitExport,
  SamsungHealthExport,
  SyncOptions,
} from "../../../../packages/wearable-adapter";

const wearableRouter = new Hono();
const analyzer = new WearableAnalyzer();

// ── Supported sources ──
const VALID_SOURCES: WearableSource[] = [
  "apple_health",
  "samsung_health",
  "google_fit",
  "fitbit",
  "garmin",
];

const VALID_DATA_TYPES: DataType[] = [
  "heart_rate",
  "blood_oxygen",
  "blood_pressure",
  "temperature",
  "steps",
  "sleep",
  "exercise",
  "stress",
  "menstrual",
];

// ── GET /wearable/sources — List supported wearable sources ──
wearableRouter.get("/sources", (c) => {
  return c.json({
    success: true,
    data: getSupportedSources(),
  });
});

// ── POST /wearable/sync — Receive and store wearable data ──
wearableRouter.post("/sync", async (c) => {
  const syncStart = Date.now();
  try {
    const userId = c.get("userId") as string;
    const body = await c.req.json();
    const { source, rawData } = body as {
      source: WearableSource;
      rawData: AppleHealthKitExport | SamsungHealthExport | unknown;
    };

    // Validate source
    if (!source || !VALID_SOURCES.includes(source)) {
      return c.json(
        {
          success: false,
          error: {
            code: "INVALID_SOURCE",
            message: `Invalid wearable source. Supported: ${VALID_SOURCES.join(", ")}`,
          },
        },
        400
      );
    }

    if (!rawData) {
      return c.json(
        {
          success: false,
          error: {
            code: "MISSING_DATA",
            message: "rawData is required",
          },
        },
        400
      );
    }

    // Check connection exists
    const connection = await prisma.wearableConnection.findUnique({
      where: { userId_source: { userId, source } },
    });

    if (!connection || !connection.isActive) {
      return c.json(
        {
          success: false,
          error: {
            code: "NOT_CONNECTED",
            message: `No active ${source} connection found. Connect first.`,
          },
        },
        400
      );
    }

    // Parse data based on source
    let wearableData: WearableData;
    let validationResult;

    if (source === "apple_health") {
      const adapter = new AppleHealthAdapter();
      const appleData = rawData as AppleHealthKitExport;
      appleData.userId = userId;

      // Validate data integrity
      validationResult = adapter.validateData(appleData);
      if (!validationResult.valid) {
        console.warn(
          `[Wearable] Apple HealthKit data validation issues for user ${userId}:`,
          validationResult.issues
        );
        // Log suspicious patterns but don't reject entirely
        if (
          validationResult.dataIntegrity.suspiciousPatterns.length > 0
        ) {
          console.warn(
            `[Wearable] Suspicious patterns:`,
            validationResult.dataIntegrity.suspiciousPatterns
          );
        }
      }

      wearableData = adapter.parseHealthKitData(appleData);
    } else if (source === "samsung_health") {
      const adapter = new SamsungHealthAdapter();
      const samsungData = rawData as SamsungHealthExport;
      samsungData.userId = userId;

      validationResult = adapter.validateData(samsungData);
      if (!validationResult.valid) {
        console.warn(
          `[Wearable] Samsung Health data validation issues for user ${userId}:`,
          validationResult.issues
        );
      }

      wearableData = adapter.parseSamsungHealthData(samsungData);
    } else {
      // For OAuth-based sources (Google Fit), sync via server-side API
      return c.json(
        {
          success: false,
          error: {
            code: "USE_SERVER_SYNC",
            message: `Use GET /wearable/server-sync/${source} for OAuth-based sources`,
          },
        },
        400
      );
    }

    // Store data points
    const dataPoints: {
      userId: string;
      source: string;
      dataType: string;
      timestamp: Date;
      value: any;
    }[] = [];

    if (wearableData.heartRate) {
      for (const hr of wearableData.heartRate) {
        dataPoints.push({
          userId,
          source,
          dataType: "heart_rate",
          timestamp: new Date(hr.timestamp),
          value: { bpm: hr.bpm, context: hr.context },
        });
      }
    }

    if (wearableData.bloodOxygen) {
      for (const bo of wearableData.bloodOxygen) {
        dataPoints.push({
          userId,
          source,
          dataType: "blood_oxygen",
          timestamp: new Date(bo.timestamp),
          value: { spo2: bo.spo2 },
        });
      }
    }

    if (wearableData.bloodPressure) {
      for (const bp of wearableData.bloodPressure) {
        dataPoints.push({
          userId,
          source,
          dataType: "blood_pressure",
          timestamp: new Date(bp.timestamp),
          value: { systolic: bp.systolic, diastolic: bp.diastolic },
        });
      }
    }

    if (wearableData.bodyTemperature) {
      for (const temp of wearableData.bodyTemperature) {
        dataPoints.push({
          userId,
          source,
          dataType: "temperature",
          timestamp: new Date(temp.timestamp),
          value: { celsius: temp.celsius, location: temp.location },
        });
      }
    }

    if (wearableData.steps) {
      dataPoints.push({
        userId,
        source,
        dataType: "steps",
        timestamp: new Date(wearableData.steps.date),
        value: {
          count: wearableData.steps.count,
          goal: wearableData.steps.goal,
        },
      });
    }

    if (wearableData.sleep) {
      dataPoints.push({
        userId,
        source,
        dataType: "sleep",
        timestamp: new Date(wearableData.sleep.date),
        value: wearableData.sleep,
      });
    }

    if (wearableData.exerciseMinutes !== undefined) {
      dataPoints.push({
        userId,
        source,
        dataType: "exercise",
        timestamp: new Date(wearableData.syncedAt),
        value: {
          exerciseMinutes: wearableData.exerciseMinutes,
          activeCalories: wearableData.activeCalories,
          distance: wearableData.distance,
          floors: wearableData.floors,
        },
      });
    }

    if (wearableData.stressLevel !== undefined) {
      dataPoints.push({
        userId,
        source,
        dataType: "stress",
        timestamp: new Date(wearableData.syncedAt),
        value: { stressLevel: wearableData.stressLevel },
      });
    }

    if (wearableData.menstrualCycle) {
      dataPoints.push({
        userId,
        source,
        dataType: "menstrual",
        timestamp: new Date(wearableData.menstrualCycle.date),
        value: wearableData.menstrualCycle,
      });
    }

    // Batch insert data points
    let recordCount = 0;
    if (dataPoints.length > 0) {
      const result = await prisma.wearableDataPoint.createMany({
        data: dataPoints,
        skipDuplicates: true,
      });
      recordCount = result.count;
    }

    // Determine which data types were synced
    const syncedDataTypes = [
      ...new Set(dataPoints.map((dp) => dp.dataType)),
    ];

    // Update connection last sync time
    await prisma.wearableConnection.update({
      where: { id: connection.id },
      data: { lastSyncAt: new Date() },
    });

    // Create sync log
    const syncDuration = Date.now() - syncStart;
    await prisma.wearableSyncLog.create({
      data: {
        connectionId: connection.id,
        syncDate: new Date(),
        dataTypes: syncedDataTypes,
        recordCount,
        status: recordCount > 0 ? "success" : "partial",
        durationMs: syncDuration,
      },
    });

    // Detect anomalies
    const anomalies = analyzer.detectAnomalies(wearableData);
    const criticalAnomalies = anomalies.filter(
      (a) => a.type === "critical"
    );

    return c.json({
      success: true,
      data: {
        recordCount,
        dataTypes: syncedDataTypes,
        syncDurationMs: syncDuration,
        anomalies:
          criticalAnomalies.length > 0 ? criticalAnomalies : undefined,
        validation: validationResult
          ? {
              valid: validationResult.valid,
              issueCount: validationResult.issues.length,
              suspiciousPatternCount:
                validationResult.dataIntegrity.suspiciousPatterns.length,
            }
          : undefined,
      },
    });
  } catch (error: any) {
    console.error("[Wearable] Sync error:", error);

    // Try to log the failed sync
    try {
      const userId = c.get("userId") as string;
      const body = await c.req.json().catch(() => ({}));
      const source = (body as any).source;
      if (userId && source) {
        const connection = await prisma.wearableConnection.findUnique({
          where: { userId_source: { userId, source } },
        });
        if (connection) {
          await prisma.wearableSyncLog.create({
            data: {
              connectionId: connection.id,
              syncDate: new Date(),
              dataTypes: [],
              recordCount: 0,
              status: "failed",
              errorMessage: error.message,
              durationMs: Date.now() - syncStart,
            },
          });
        }
      }
    } catch {
      // Ignore sync log error
    }

    return c.json(
      {
        success: false,
        error: { code: "SYNC_ERROR", message: error.message },
      },
      500
    );
  }
});

// ── GET /wearable/server-sync/:source — Server-side sync for OAuth sources ──
wearableRouter.get("/server-sync/:source", async (c) => {
  const syncStart = Date.now();
  try {
    const userId = c.get("userId") as string;
    const source = c.req.param("source") as WearableSource;

    if (!VALID_SOURCES.includes(source)) {
      return c.json(
        {
          success: false,
          error: { code: "INVALID_SOURCE", message: "Invalid source" },
        },
        400
      );
    }

    // Only Google Fit supports server-side sync currently
    if (source !== "google_fit") {
      return c.json(
        {
          success: false,
          error: {
            code: "NOT_SUPPORTED",
            message: `${source} requires client-side sync via POST /wearable/sync`,
          },
        },
        400
      );
    }

    const connection = await prisma.wearableConnection.findUnique({
      where: { userId_source: { userId, source } },
    });

    if (!connection || !connection.isActive || !connection.accessToken) {
      return c.json(
        {
          success: false,
          error: {
            code: "NOT_CONNECTED",
            message: "No active connection with valid token",
          },
        },
        400
      );
    }

    const adapter = new GoogleFitAdapter();

    // Determine date range (default: last 24 hours)
    const startDate =
      c.req.query("startDate") ||
      new Date(Date.now() - 86400000).toISOString();
    const endDate = c.req.query("endDate") || new Date().toISOString();
    const requestedTypes = c.req.query("dataTypes")?.split(",") as
      | DataType[]
      | undefined;
    const dataTypes: DataType[] =
      requestedTypes && requestedTypes.every((t) => VALID_DATA_TYPES.includes(t))
        ? requestedTypes
        : ["heart_rate", "steps", "sleep", "exercise"];

    // Try sync with token refresh on failure
    let accessToken = connection.accessToken;
    let wearableData: WearableData;

    try {
      wearableData = await adapter.syncData(accessToken, {
        userId,
        startDate,
        endDate,
        dataTypes,
      });
    } catch (tokenError: any) {
      // Token might be expired — try refresh
      if (connection.refreshToken) {
        try {
          const newTokens = await adapter.refreshToken(
            connection.refreshToken
          );
          accessToken = newTokens.accessToken;

          // Update stored tokens
          await prisma.wearableConnection.update({
            where: { id: connection.id },
            data: {
              accessToken: newTokens.accessToken,
              refreshToken: newTokens.refreshToken,
            },
          });

          wearableData = await adapter.syncData(accessToken, {
            userId,
            startDate,
            endDate,
            dataTypes,
          });
        } catch (refreshError: any) {
          return c.json(
            {
              success: false,
              error: {
                code: "TOKEN_REFRESH_FAILED",
                message:
                  "Token refresh failed. Please re-authenticate.",
              },
            },
            401
          );
        }
      } else {
        return c.json(
          {
            success: false,
            error: {
              code: "TOKEN_EXPIRED",
              message:
                "Access token expired and no refresh token available.",
            },
          },
          401
        );
      }
    }

    // Store data points (same logic as POST /sync)
    const dataPoints: {
      userId: string;
      source: string;
      dataType: string;
      timestamp: Date;
      value: any;
    }[] = [];

    if (wearableData.heartRate) {
      for (const hr of wearableData.heartRate) {
        dataPoints.push({
          userId,
          source,
          dataType: "heart_rate",
          timestamp: new Date(hr.timestamp),
          value: { bpm: hr.bpm, context: hr.context },
        });
      }
    }

    if (wearableData.steps) {
      dataPoints.push({
        userId,
        source,
        dataType: "steps",
        timestamp: new Date(wearableData.steps.date),
        value: {
          count: wearableData.steps.count,
          goal: wearableData.steps.goal,
        },
      });
    }

    if (wearableData.sleep) {
      dataPoints.push({
        userId,
        source,
        dataType: "sleep",
        timestamp: new Date(wearableData.sleep.date),
        value: wearableData.sleep,
      });
    }

    if (wearableData.exerciseMinutes !== undefined) {
      dataPoints.push({
        userId,
        source,
        dataType: "exercise",
        timestamp: new Date(wearableData.syncedAt),
        value: {
          exerciseMinutes: wearableData.exerciseMinutes,
          activeCalories: wearableData.activeCalories,
          distance: wearableData.distance,
        },
      });
    }

    if (wearableData.bloodOxygen) {
      for (const bo of wearableData.bloodOxygen) {
        dataPoints.push({
          userId,
          source,
          dataType: "blood_oxygen",
          timestamp: new Date(bo.timestamp),
          value: { spo2: bo.spo2 },
        });
      }
    }

    if (wearableData.bloodPressure) {
      for (const bp of wearableData.bloodPressure) {
        dataPoints.push({
          userId,
          source,
          dataType: "blood_pressure",
          timestamp: new Date(bp.timestamp),
          value: { systolic: bp.systolic, diastolic: bp.diastolic },
        });
      }
    }

    if (wearableData.bodyTemperature) {
      for (const temp of wearableData.bodyTemperature) {
        dataPoints.push({
          userId,
          source,
          dataType: "temperature",
          timestamp: new Date(temp.timestamp),
          value: { celsius: temp.celsius, location: temp.location },
        });
      }
    }

    let recordCount = 0;
    if (dataPoints.length > 0) {
      const result = await prisma.wearableDataPoint.createMany({
        data: dataPoints,
        skipDuplicates: true,
      });
      recordCount = result.count;
    }

    const syncedDataTypes = [
      ...new Set(dataPoints.map((dp) => dp.dataType)),
    ];

    await prisma.wearableConnection.update({
      where: { id: connection.id },
      data: { lastSyncAt: new Date() },
    });

    const syncDuration = Date.now() - syncStart;
    await prisma.wearableSyncLog.create({
      data: {
        connectionId: connection.id,
        syncDate: new Date(),
        dataTypes: syncedDataTypes,
        recordCount,
        status: recordCount > 0 ? "success" : "partial",
        durationMs: syncDuration,
      },
    });

    const anomalies = analyzer.detectAnomalies(wearableData);
    const criticalAnomalies = anomalies.filter(
      (a) => a.type === "critical"
    );

    return c.json({
      success: true,
      data: {
        recordCount,
        dataTypes: syncedDataTypes,
        syncDurationMs: syncDuration,
        anomalies:
          criticalAnomalies.length > 0 ? criticalAnomalies : undefined,
      },
    });
  } catch (error: any) {
    console.error("[Wearable] Server sync error:", error);
    return c.json(
      {
        success: false,
        error: { code: "SYNC_ERROR", message: error.message },
      },
      500
    );
  }
});

// ── GET /wearable/auth/:source — Get OAuth URL for a wearable source ──
wearableRouter.get("/auth/:source", async (c) => {
  try {
    const userId = c.get("userId") as string;
    const source = c.req.param("source") as WearableSource;
    const redirectUri =
      c.req.query("redirectUri") ||
      `${process.env.API_BASE_URL || "http://localhost:3001"}/api/v1/wearable/callback/${source}`;

    if (!VALID_SOURCES.includes(source)) {
      return c.json(
        {
          success: false,
          error: { code: "INVALID_SOURCE", message: "Invalid source" },
        },
        400
      );
    }

    const adapter = createAdapter(source);
    const authUrl = adapter.getAuthUrl(userId, redirectUri);

    // Upsert connection record (inactive until callback completes)
    await prisma.wearableConnection.upsert({
      where: { userId_source: { userId, source } },
      create: {
        userId,
        source,
        isActive: false,
      },
      update: {},
    });

    return c.json({
      success: true,
      data: {
        authUrl,
        source,
        isDeviceAuth: ["apple_health", "samsung_health"].includes(source),
      },
    });
  } catch (error: any) {
    console.error("[Wearable] Auth URL error:", error);
    return c.json(
      {
        success: false,
        error: { code: "AUTH_URL_ERROR", message: error.message },
      },
      500
    );
  }
});

// ── GET /wearable/callback/:source — OAuth callback handler ──
wearableRouter.get("/callback/:source", async (c) => {
  try {
    const source = c.req.param("source") as WearableSource;
    const code = c.req.query("code");
    const state = c.req.query("state"); // userId passed in state param
    const error = c.req.query("error");

    if (error) {
      return c.json(
        {
          success: false,
          error: {
            code: "OAUTH_DENIED",
            message: `OAuth authorization denied: ${error}`,
          },
        },
        400
      );
    }

    if (!code || !state) {
      return c.json(
        {
          success: false,
          error: {
            code: "MISSING_PARAMS",
            message: "Missing code or state parameter",
          },
        },
        400
      );
    }

    const userId = state;
    const adapter = createAdapter(source);
    const tokens = await adapter.handleAuthCallback(code, userId);

    // Activate connection and store tokens
    await prisma.wearableConnection.upsert({
      where: { userId_source: { userId, source } },
      create: {
        userId,
        source,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        isActive: true,
      },
      update: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        isActive: true,
      },
    });

    // For web-based OAuth flow, redirect to success page
    const successRedirect =
      process.env.WEARABLE_CALLBACK_REDIRECT ||
      `${process.env.FRONTEND_URL || "http://localhost:3000"}/settings/wearable?connected=${source}`;

    return c.redirect(successRedirect);
  } catch (error: any) {
    console.error("[Wearable] Callback error:", error);
    return c.json(
      {
        success: false,
        error: { code: "CALLBACK_ERROR", message: error.message },
      },
      500
    );
  }
});

// ── POST /wearable/connect — Connect a device-based wearable (Apple/Samsung) ──
wearableRouter.post("/connect", async (c) => {
  try {
    const userId = c.get("userId") as string;
    const { source, deviceToken, deviceModel, deviceOs } =
      (await c.req.json()) as {
        source: WearableSource;
        deviceToken?: string;
        deviceModel?: string;
        deviceOs?: string;
      };

    if (!source || !VALID_SOURCES.includes(source)) {
      return c.json(
        {
          success: false,
          error: { code: "INVALID_SOURCE", message: "Invalid source" },
        },
        400
      );
    }

    // For device-based sources, activate connection directly
    const connection = await prisma.wearableConnection.upsert({
      where: { userId_source: { userId, source } },
      create: {
        userId,
        source,
        accessToken: deviceToken || null,
        isActive: true,
        deviceModel: deviceModel || null,
        deviceOs: deviceOs || null,
      },
      update: {
        accessToken: deviceToken || undefined,
        isActive: true,
        deviceModel: deviceModel || undefined,
        deviceOs: deviceOs || undefined,
      },
    });

    return c.json({
      success: true,
      data: {
        connectionId: connection.id,
        source: connection.source,
        isActive: connection.isActive,
        createdAt: connection.createdAt,
      },
    });
  } catch (error: any) {
    console.error("[Wearable] Connect error:", error);
    return c.json(
      {
        success: false,
        error: { code: "CONNECT_ERROR", message: error.message },
      },
      500
    );
  }
});

// ── GET /wearable/data — Get user's wearable data ──
wearableRouter.get("/data", async (c) => {
  try {
    const userId = c.get("userId") as string;
    const source = c.req.query("source") as WearableSource | undefined;
    const dataType = c.req.query("dataType") as DataType | undefined;
    const startDate = c.req.query("startDate");
    const endDate = c.req.query("endDate");
    const page = parseInt(c.req.query("page") || "1");
    const limit = Math.min(parseInt(c.req.query("limit") || "100"), 500);

    // Build where clause
    const where: any = { userId };
    if (source) where.source = source;
    if (dataType) where.dataType = dataType;
    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = new Date(startDate);
      if (endDate) where.timestamp.lte = new Date(endDate);
    }

    const [dataPoints, total] = await Promise.all([
      prisma.wearableDataPoint.findMany({
        where,
        orderBy: { timestamp: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.wearableDataPoint.count({ where }),
    ]);

    return c.json({
      success: true,
      data: dataPoints.map((dp) => ({
        id: dp.id,
        source: dp.source,
        dataType: dp.dataType,
        timestamp: dp.timestamp,
        value: dp.value,
      })),
      meta: { page, limit, total },
    });
  } catch (error: any) {
    console.error("[Wearable] Data query error:", error);
    return c.json(
      {
        success: false,
        error: { code: "DATA_ERROR", message: error.message },
      },
      500
    );
  }
});

// ── GET /wearable/summary — Get daily wearable summary ──
wearableRouter.get("/summary", async (c) => {
  try {
    const userId = c.get("userId") as string;
    const date =
      c.req.query("date") || new Date().toISOString().split("T")[0];
    const language = (c.req.query("lang") as "ko" | "en") || "en";

    const dayStart = new Date(`${date}T00:00:00.000Z`);
    const dayEnd = new Date(`${date}T23:59:59.999Z`);

    // Fetch all data points for the day
    const dataPoints = await prisma.wearableDataPoint.findMany({
      where: {
        userId,
        timestamp: { gte: dayStart, lte: dayEnd },
      },
      orderBy: { timestamp: "asc" },
    });

    if (dataPoints.length === 0) {
      return c.json({
        success: true,
        data: {
          date,
          summary:
            language === "ko"
              ? "No wearable data available for today. Please sync your device."
              : "No wearable data for today. Please sync your device.",
          hasData: false,
        },
      });
    }

    // Reconstruct WearableData from stored data points
    const wearableData: WearableData = {
      source: (dataPoints[0].source as WearableSource) || "apple_health",
      userId,
      syncedAt: new Date().toISOString(),
    };

    for (const dp of dataPoints) {
      const value = dp.value as any;

      switch (dp.dataType) {
        case "heart_rate":
          if (!wearableData.heartRate) wearableData.heartRate = [];
          wearableData.heartRate.push({
            timestamp: dp.timestamp.toISOString(),
            bpm: value.bpm,
            context: value.context,
          });
          break;

        case "blood_oxygen":
          if (!wearableData.bloodOxygen) wearableData.bloodOxygen = [];
          wearableData.bloodOxygen.push({
            timestamp: dp.timestamp.toISOString(),
            spo2: value.spo2,
          });
          break;

        case "blood_pressure":
          if (!wearableData.bloodPressure)
            wearableData.bloodPressure = [];
          wearableData.bloodPressure.push({
            timestamp: dp.timestamp.toISOString(),
            systolic: value.systolic,
            diastolic: value.diastolic,
          });
          break;

        case "temperature":
          if (!wearableData.bodyTemperature)
            wearableData.bodyTemperature = [];
          wearableData.bodyTemperature.push({
            timestamp: dp.timestamp.toISOString(),
            celsius: value.celsius,
            location: value.location,
          });
          break;

        case "steps":
          wearableData.steps = {
            date: dp.timestamp.toISOString().split("T")[0],
            count: value.count,
            goal: value.goal,
          };
          break;

        case "sleep":
          wearableData.sleep = value;
          break;

        case "exercise":
          wearableData.exerciseMinutes = value.exerciseMinutes;
          wearableData.activeCalories = value.activeCalories;
          wearableData.distance = value.distance;
          wearableData.floors = value.floors;
          break;

        case "stress":
          wearableData.stressLevel = value.stressLevel;
          break;

        case "menstrual":
          wearableData.menstrualCycle = value;
          break;
      }
    }

    // Generate summary
    const summary = analyzer.generateDailySummary(wearableData, language);

    // Detect anomalies
    const anomalies = analyzer.detectAnomalies(wearableData);

    // Sleep analysis if available
    let sleepAnalysis = null;
    if (wearableData.sleep) {
      sleepAnalysis = analyzer.analyzeSleep(wearableData.sleep);
    }

    // Heart rate analysis if available
    let heartRateAnalysis = null;
    if (wearableData.heartRate && wearableData.heartRate.length > 0) {
      heartRateAnalysis = analyzer.analyzeHeartRate(
        wearableData.heartRate
      );
    }

    return c.json({
      success: true,
      data: {
        date,
        summary,
        hasData: true,
        anomalies,
        sleepAnalysis,
        heartRateAnalysis,
        quickStats: {
          steps: wearableData.steps?.count,
          exerciseMinutes: wearableData.exerciseMinutes
            ? Math.round(wearableData.exerciseMinutes)
            : undefined,
          avgHeartRate: heartRateAnalysis?.avgBpm,
          sleepHours: sleepAnalysis?.totalHours
            ? parseFloat(sleepAnalysis.totalHours.toFixed(1))
            : undefined,
          sleepScore: sleepAnalysis?.score,
        },
      },
    });
  } catch (error: any) {
    console.error("[Wearable] Summary error:", error);
    return c.json(
      {
        success: false,
        error: { code: "SUMMARY_ERROR", message: error.message },
      },
      500
    );
  }
});

// ── POST /wearable/verify-exercise — Verify exercise for Exercise Pool ──
wearableRouter.post("/verify-exercise", async (c) => {
  try {
    const userId = c.get("userId") as string;
    const { date, requiredMinutes } = (await c.req.json()) as {
      date?: string;
      requiredMinutes?: number;
    };

    const targetDate =
      date || new Date().toISOString().split("T")[0];
    const minMinutes = requiredMinutes || 30; // Default 30 min exercise requirement

    const dayStart = new Date(`${targetDate}T00:00:00.000Z`);
    const dayEnd = new Date(`${targetDate}T23:59:59.999Z`);

    // Fetch all data points for the day
    const dataPoints = await prisma.wearableDataPoint.findMany({
      where: {
        userId,
        timestamp: { gte: dayStart, lte: dayEnd },
      },
      orderBy: { timestamp: "asc" },
    });

    // Reconstruct WearableData
    const wearableData: WearableData = {
      source: "apple_health", // Will be overridden by actual data
      userId,
      syncedAt: new Date().toISOString(),
    };

    for (const dp of dataPoints) {
      const value = dp.value as any;
      wearableData.source = dp.source as WearableSource;

      switch (dp.dataType) {
        case "heart_rate":
          if (!wearableData.heartRate) wearableData.heartRate = [];
          wearableData.heartRate.push({
            timestamp: dp.timestamp.toISOString(),
            bpm: value.bpm,
            context: value.context,
          });
          break;

        case "steps":
          wearableData.steps = {
            date: dp.timestamp.toISOString().split("T")[0],
            count: value.count,
            goal: value.goal,
          };
          break;

        case "exercise":
          wearableData.exerciseMinutes = value.exerciseMinutes;
          wearableData.activeCalories = value.activeCalories;
          wearableData.distance = value.distance;
          break;
      }
    }

    const verification = analyzer.verifyExercise(
      wearableData,
      minMinutes
    );

    return c.json({
      success: true,
      data: verification,
    });
  } catch (error: any) {
    console.error("[Wearable] Exercise verification error:", error);
    return c.json(
      {
        success: false,
        error: { code: "VERIFY_ERROR", message: error.message },
      },
      500
    );
  }
});

// ── GET /wearable/connections — Get user's wearable connections ──
wearableRouter.get("/connections", async (c) => {
  try {
    const userId = c.get("userId") as string;

    const connections = await prisma.wearableConnection.findMany({
      where: { userId },
      include: {
        syncLogs: {
          orderBy: { createdAt: "desc" },
          take: 5,
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return c.json({
      success: true,
      data: connections.map((conn) => ({
        id: conn.id,
        source: conn.source,
        isActive: conn.isActive,
        lastSyncAt: conn.lastSyncAt,
        deviceModel: conn.deviceModel,
        deviceOs: conn.deviceOs,
        createdAt: conn.createdAt,
        recentSyncs: conn.syncLogs.map((log) => ({
          id: log.id,
          syncDate: log.syncDate,
          dataTypes: log.dataTypes,
          recordCount: log.recordCount,
          status: log.status,
          durationMs: log.durationMs,
        })),
      })),
    });
  } catch (error: any) {
    console.error("[Wearable] Connections error:", error);
    return c.json(
      {
        success: false,
        error: { code: "CONNECTIONS_ERROR", message: error.message },
      },
      500
    );
  }
});

// ── POST /wearable/disconnect — Disconnect a wearable source ──
wearableRouter.post("/disconnect", async (c) => {
  try {
    const userId = c.get("userId") as string;
    const { source } = (await c.req.json()) as {
      source: WearableSource;
    };

    if (!source || !VALID_SOURCES.includes(source)) {
      return c.json(
        {
          success: false,
          error: { code: "INVALID_SOURCE", message: "Invalid source" },
        },
        400
      );
    }

    const connection = await prisma.wearableConnection.findUnique({
      where: { userId_source: { userId, source } },
    });

    if (!connection) {
      return c.json(
        {
          success: false,
          error: {
            code: "NOT_CONNECTED",
            message: `No ${source} connection found`,
          },
        },
        404
      );
    }

    // Deactivate and clear tokens
    await prisma.wearableConnection.update({
      where: { id: connection.id },
      data: {
        isActive: false,
        accessToken: null,
        refreshToken: null,
      },
    });

    return c.json({
      success: true,
      data: {
        source,
        disconnected: true,
        message:
          "Wearable disconnected successfully",
      },
    });
  } catch (error: any) {
    console.error("[Wearable] Disconnect error:", error);
    return c.json(
      {
        success: false,
        error: { code: "DISCONNECT_ERROR", message: error.message },
      },
      500
    );
  }
});

// ── Standalone OAuth callback handler (for public route registration) ──
// Used by the main app to register the callback route without auth middleware.
import { Context } from "hono";

export async function handleWearableCallback(c: Context) {
  try {
    const source = c.req.param("source") as WearableSource;
    const code = c.req.query("code");
    const state = c.req.query("state"); // userId passed in state param
    const error = c.req.query("error");

    if (error) {
      return c.json(
        {
          success: false,
          error: {
            code: "OAUTH_DENIED",
            message: `OAuth authorization denied: ${error}`,
          },
        },
        400
      );
    }

    if (!code || !state) {
      return c.json(
        {
          success: false,
          error: {
            code: "MISSING_PARAMS",
            message: "Missing code or state parameter",
          },
        },
        400
      );
    }

    const userId = state;
    const adapter = createAdapter(source);
    const tokens = await adapter.handleAuthCallback(code, userId);

    // Activate connection and store tokens
    await prisma.wearableConnection.upsert({
      where: { userId_source: { userId, source } },
      create: {
        userId,
        source,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        isActive: true,
      },
      update: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        isActive: true,
      },
    });

    const successRedirect =
      process.env.WEARABLE_CALLBACK_REDIRECT ||
      `${process.env.FRONTEND_URL || "http://localhost:3000"}/settings/wearable?connected=${source}`;

    return c.redirect(successRedirect);
  } catch (err: any) {
    console.error("[Wearable] Public callback error:", err);
    return c.json(
      {
        success: false,
        error: { code: "CALLBACK_ERROR", message: err.message },
      },
      500
    );
  }
}

export { wearableRouter };
