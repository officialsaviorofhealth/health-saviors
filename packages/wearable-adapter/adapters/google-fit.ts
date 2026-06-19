// Google Fit Adapter
// Google Fit has a REST API that can be called server-side.
// This adapter handles OAuth2 authentication, REST API calls,
// and data normalization to our standard format.

import type {
  WearableAdapter,
  WearableData,
  WearableSource,
  SyncOptions,
  DataType,
  HeartRateData,
  BloodOxygenData,
  BloodPressureData,
  TemperatureData,
  StepsData,
  SleepData,
  GoogleFitDataPoint,
  GoogleFitDataset,
  ValidationResult,
} from "../types";

// ── Google Fit API Constants ──
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_FIT_BASE_URL = "https://www.googleapis.com/fitness/v1/users/me";

// Google Fit data type names
const GF_HEART_RATE = "com.google.heart_rate.bpm";
const GF_BLOOD_OXYGEN = "com.google.oxygen_saturation";
const GF_BLOOD_PRESSURE = "com.google.blood_pressure";
const GF_BODY_TEMPERATURE = "com.google.body.temperature";
const GF_STEP_COUNT = "com.google.step_count.delta";
const GF_CALORIES = "com.google.calories.expended";
const GF_DISTANCE = "com.google.distance.delta";
const GF_SLEEP_SEGMENT = "com.google.sleep.segment";
const GF_ACTIVITY_SEGMENT = "com.google.activity.segment";

// Google Fit scopes
const SCOPES = [
  "https://www.googleapis.com/auth/fitness.heart_rate.read",
  "https://www.googleapis.com/auth/fitness.blood_pressure.read",
  "https://www.googleapis.com/auth/fitness.blood_glucose.read",
  "https://www.googleapis.com/auth/fitness.oxygen_saturation.read",
  "https://www.googleapis.com/auth/fitness.body_temperature.read",
  "https://www.googleapis.com/auth/fitness.body.read",
  "https://www.googleapis.com/auth/fitness.activity.read",
  "https://www.googleapis.com/auth/fitness.sleep.read",
  "https://www.googleapis.com/auth/fitness.location.read",
];

// Sleep stage constants from Google Fit
const SLEEP_STAGE_AWAKE = 1;
const SLEEP_STAGE_SLEEP = 2;
const SLEEP_STAGE_OUT_OF_BED = 3;
const SLEEP_STAGE_LIGHT = 4;
const SLEEP_STAGE_DEEP = 5;
const SLEEP_STAGE_REM = 6;

export class GoogleFitAdapter implements WearableAdapter {
  source: WearableSource = "google_fit";
  private clientId: string;
  private clientSecret: string;

  constructor(clientId?: string, clientSecret?: string) {
    this.clientId = clientId || process.env.GOOGLE_FIT_CLIENT_ID || "";
    this.clientSecret =
      clientSecret || process.env.GOOGLE_FIT_CLIENT_SECRET || "";
  }

  // ── OAuth2 Authentication ──

  getAuthUrl(userId: string, redirectUri: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: SCOPES.join(" "),
      access_type: "offline",
      prompt: "consent",
      state: userId, // Pass userId in state for callback matching
    });

    return `${GOOGLE_AUTH_URL}?${params.toString()}`;
  }

  async handleAuthCallback(
    code: string,
    _userId: string
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const redirectUri =
      process.env.GOOGLE_FIT_REDIRECT_URI ||
      "http://localhost:3001/api/v1/wearable/callback/google_fit";

    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(
        `Google OAuth token exchange failed: ${response.status} — ${error}`
      );
    }

    const tokenData = (await response.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
      token_type: string;
    };

    if (!tokenData.access_token) {
      throw new Error("Google OAuth response missing access_token");
    }

    return {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token || "",
    };
  }

  async refreshToken(
    refreshToken: string
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: "refresh_token",
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(
        `Google OAuth token refresh failed: ${response.status} — ${error}`
      );
    }

    const tokenData = (await response.json()) as {
      access_token: string;
      expires_in: number;
    };

    return {
      accessToken: tokenData.access_token,
      refreshToken, // Google doesn't issue new refresh tokens on refresh
    };
  }

  supportsRealtime(): boolean {
    // Google Fit supports change notifications via Google Cloud Pub/Sub
    return false; // Not implementing Pub/Sub in this adapter
  }

  // ── Data Sync ──

  async syncData(
    accessToken: string,
    options: SyncOptions
  ): Promise<WearableData> {
    const data: WearableData = {
      source: "google_fit",
      userId: options.userId,
      syncedAt: new Date().toISOString(),
    };

    const startTimeNanos = this.dateToNanos(options.startDate);
    const endTimeNanos = this.dateToNanos(options.endDate);

    // Fetch each requested data type in parallel
    const fetchPromises: Promise<void>[] = [];

    for (const dataType of options.dataTypes) {
      switch (dataType) {
        case "heart_rate":
          fetchPromises.push(
            this.fetchHeartRate(
              accessToken,
              startTimeNanos,
              endTimeNanos
            ).then((hr) => {
              data.heartRate = hr;
            })
          );
          break;

        case "blood_oxygen":
          fetchPromises.push(
            this.fetchBloodOxygen(
              accessToken,
              startTimeNanos,
              endTimeNanos
            ).then((bo) => {
              data.bloodOxygen = bo;
            })
          );
          break;

        case "blood_pressure":
          fetchPromises.push(
            this.fetchBloodPressure(
              accessToken,
              startTimeNanos,
              endTimeNanos
            ).then((bp) => {
              data.bloodPressure = bp;
            })
          );
          break;

        case "temperature":
          fetchPromises.push(
            this.fetchTemperature(
              accessToken,
              startTimeNanos,
              endTimeNanos
            ).then((temp) => {
              data.bodyTemperature = temp;
            })
          );
          break;

        case "steps":
          fetchPromises.push(
            this.fetchSteps(
              accessToken,
              startTimeNanos,
              endTimeNanos,
              options.startDate
            ).then((steps) => {
              data.steps = steps;
            })
          );
          break;

        case "exercise":
          fetchPromises.push(
            this.fetchExercise(
              accessToken,
              startTimeNanos,
              endTimeNanos
            ).then((result) => {
              data.exerciseMinutes = result.exerciseMinutes;
              data.activeCalories = result.activeCalories;
              data.distance = result.distance;
            })
          );
          break;

        case "sleep":
          fetchPromises.push(
            this.fetchSleep(
              accessToken,
              startTimeNanos,
              endTimeNanos
            ).then((sleep) => {
              data.sleep = sleep;
            })
          );
          break;
      }
    }

    // Wait for all fetches to complete, catching individual errors
    const results = await Promise.allSettled(fetchPromises);
    for (const result of results) {
      if (result.status === "rejected") {
        console.error("Google Fit data fetch error:", result.reason);
      }
    }

    return data;
  }

  // ── Validate data ──

  validateData(data: WearableData): ValidationResult {
    const issues: string[] = [];
    const suspiciousPatterns: string[] = [];
    let hasValidTimestamps = true;
    let hasValidRanges = true;

    if (data.heartRate) {
      for (const hr of data.heartRate) {
        if (isNaN(new Date(hr.timestamp).getTime())) {
          hasValidTimestamps = false;
          issues.push(`Invalid heart rate timestamp: ${hr.timestamp}`);
        }
        if (hr.bpm < 20 || hr.bpm > 300) {
          hasValidRanges = false;
          issues.push(`Heart rate out of range: ${hr.bpm} bpm`);
        }
      }
    }

    if (data.bloodOxygen) {
      for (const bo of data.bloodOxygen) {
        if (bo.spo2 < 50 || bo.spo2 > 100) {
          hasValidRanges = false;
          issues.push(`Blood oxygen out of range: ${bo.spo2}%`);
        }
      }
    }

    if (data.bloodPressure) {
      for (const bp of data.bloodPressure) {
        if (bp.systolic < 60 || bp.systolic > 300) {
          hasValidRanges = false;
          issues.push(`Systolic BP out of range: ${bp.systolic}`);
        }
        if (bp.diastolic < 30 || bp.diastolic > 200) {
          hasValidRanges = false;
          issues.push(`Diastolic BP out of range: ${bp.diastolic}`);
        }
      }
    }

    if (data.steps && data.steps.count > 100000) {
      hasValidRanges = false;
      issues.push(`Step count suspicious: ${data.steps.count}`);
    }

    return {
      valid: issues.length === 0,
      issues,
      dataIntegrity: {
        hasValidTimestamps,
        hasValidRanges,
        hasConsistentSource: data.source === "google_fit",
        suspiciousPatterns,
      },
    };
  }

  // ── Private: Google Fit API Calls ──

  private async fetchDataset(
    accessToken: string,
    dataTypeName: string,
    startTimeNanos: string,
    endTimeNanos: string
  ): Promise<GoogleFitDataPoint[]> {
    const dataSourceId = `derived:${dataTypeName}:com.google.android.gms:merge_${dataTypeName.split(".").pop()}`;
    const url = `${GOOGLE_FIT_BASE_URL}/dataSources/${encodeURIComponent(dataSourceId)}/datasets/${startTimeNanos}-${endTimeNanos}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      // Try aggregate endpoint as fallback
      return this.fetchAggregate(
        accessToken,
        dataTypeName,
        startTimeNanos,
        endTimeNanos
      );
    }

    const dataset = (await response.json()) as GoogleFitDataset;
    return dataset.point || [];
  }

  private async fetchAggregate(
    accessToken: string,
    dataTypeName: string,
    startTimeNanos: string,
    endTimeNanos: string
  ): Promise<GoogleFitDataPoint[]> {
    const url = `${GOOGLE_FIT_BASE_URL}/dataset:aggregate`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        aggregateBy: [{ dataTypeName }],
        bucketByTime: { durationMillis: 60000 }, // 1-minute buckets
        startTimeMillis: Math.floor(parseInt(startTimeNanos) / 1000000),
        endTimeMillis: Math.floor(parseInt(endTimeNanos) / 1000000),
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(
        `Google Fit aggregate API error: ${response.status} — ${error}`
      );
    }

    const result = (await response.json()) as {
      bucket: {
        startTimeMillis: string;
        endTimeMillis: string;
        dataset: { point: GoogleFitDataPoint[] }[];
      }[];
    };

    const points: GoogleFitDataPoint[] = [];
    for (const bucket of result.bucket || []) {
      for (const dataset of bucket.dataset || []) {
        points.push(...(dataset.point || []));
      }
    }
    return points;
  }

  private async fetchHeartRate(
    accessToken: string,
    startNanos: string,
    endNanos: string
  ): Promise<HeartRateData[]> {
    const points = await this.fetchDataset(
      accessToken,
      GF_HEART_RATE,
      startNanos,
      endNanos
    );

    return points
      .filter((p) => p.value && p.value.length > 0)
      .map((point) => ({
        timestamp: this.nanosToIso(point.startTimeNanos),
        bpm: Math.round(point.value[0]?.fpVal || 0),
        context: this.inferGoogleFitHeartRateContext(point),
      }));
  }

  private inferGoogleFitHeartRateContext(
    point: GoogleFitDataPoint
  ): HeartRateData["context"] {
    const bpm = point.value[0]?.fpVal || 0;
    if (bpm < 65) return "resting";
    if (bpm > 130) return "active";
    return undefined;
  }

  private async fetchBloodOxygen(
    accessToken: string,
    startNanos: string,
    endNanos: string
  ): Promise<BloodOxygenData[]> {
    const points = await this.fetchDataset(
      accessToken,
      GF_BLOOD_OXYGEN,
      startNanos,
      endNanos
    );

    return points
      .filter((p) => p.value && p.value.length > 0)
      .map((point) => ({
        timestamp: this.nanosToIso(point.startTimeNanos),
        spo2: Math.round((point.value[0]?.fpVal || 0) * 100),
      }));
  }

  private async fetchBloodPressure(
    accessToken: string,
    startNanos: string,
    endNanos: string
  ): Promise<BloodPressureData[]> {
    const points = await this.fetchDataset(
      accessToken,
      GF_BLOOD_PRESSURE,
      startNanos,
      endNanos
    );

    return points
      .filter((p) => p.value && p.value.length >= 2)
      .map((point) => ({
        timestamp: this.nanosToIso(point.startTimeNanos),
        systolic: Math.round(point.value[0]?.fpVal || 0),
        diastolic: Math.round(point.value[1]?.fpVal || 0),
      }));
  }

  private async fetchTemperature(
    accessToken: string,
    startNanos: string,
    endNanos: string
  ): Promise<TemperatureData[]> {
    const points = await this.fetchDataset(
      accessToken,
      GF_BODY_TEMPERATURE,
      startNanos,
      endNanos
    );

    return points
      .filter((p) => p.value && p.value.length > 0)
      .map((point) => ({
        timestamp: this.nanosToIso(point.startTimeNanos),
        celsius: parseFloat((point.value[0]?.fpVal || 0).toFixed(1)),
      }));
  }

  private async fetchSteps(
    accessToken: string,
    startNanos: string,
    endNanos: string,
    dateStr: string
  ): Promise<StepsData> {
    const points = await this.fetchDataset(
      accessToken,
      GF_STEP_COUNT,
      startNanos,
      endNanos
    );

    const totalSteps = points.reduce(
      (sum, p) => sum + (p.value[0]?.intVal || 0),
      0
    );

    return {
      date: dateStr.split("T")[0],
      count: totalSteps,
      goal: 10000,
    };
  }

  private async fetchExercise(
    accessToken: string,
    startNanos: string,
    endNanos: string
  ): Promise<{
    exerciseMinutes: number;
    activeCalories: number;
    distance: number;
  }> {
    // Fetch activity segments, calories, and distance in parallel
    const [activityPoints, caloriePoints, distancePoints] =
      await Promise.all([
        this.fetchDataset(
          accessToken,
          GF_ACTIVITY_SEGMENT,
          startNanos,
          endNanos
        ),
        this.fetchDataset(
          accessToken,
          GF_CALORIES,
          startNanos,
          endNanos
        ),
        this.fetchDataset(
          accessToken,
          GF_DISTANCE,
          startNanos,
          endNanos
        ),
      ]);

    // Calculate exercise minutes from activity segments
    // Activity types 7-15 are various exercise types in Google Fit
    let exerciseMinutes = 0;
    for (const point of activityPoints) {
      const activityType = point.value[0]?.intVal || 0;
      // Google Fit activity types: 7=walking, 8=running, 9=aerobics, etc.
      // Types >= 7 and excluding 3 (still) and 4 (unknown) are exercise
      if (activityType >= 7) {
        const durationMs =
          parseInt(point.endTimeNanos) / 1000000 -
          parseInt(point.startTimeNanos) / 1000000;
        exerciseMinutes += durationMs / 60000;
      }
    }

    const activeCalories = caloriePoints.reduce(
      (sum, p) => sum + (p.value[0]?.fpVal || 0),
      0
    );

    const distance = distancePoints.reduce(
      (sum, p) => sum + (p.value[0]?.fpVal || 0),
      0
    );

    return {
      exerciseMinutes: Math.round(exerciseMinutes),
      activeCalories: Math.round(activeCalories),
      distance: Math.round(distance),
    };
  }

  private async fetchSleep(
    accessToken: string,
    startNanos: string,
    endNanos: string
  ): Promise<SleepData | undefined> {
    const points = await this.fetchDataset(
      accessToken,
      GF_SLEEP_SEGMENT,
      startNanos,
      endNanos
    );

    if (points.length === 0) return undefined;

    // Sort by start time
    const sorted = [...points].sort(
      (a, b) =>
        parseInt(a.startTimeNanos) - parseInt(b.startTimeNanos)
    );

    let awakeMinutes = 0;
    let lightMinutes = 0;
    let deepMinutes = 0;
    let remMinutes = 0;

    const bedtime = this.nanosToIso(sorted[0].startTimeNanos);
    const wakeTime = this.nanosToIso(
      sorted[sorted.length - 1].endTimeNanos
    );

    for (const point of sorted) {
      const durationMs =
        parseInt(point.endTimeNanos) / 1000000 -
        parseInt(point.startTimeNanos) / 1000000;
      const durationMin = durationMs / 60000;
      const stage = point.value[0]?.intVal || 0;

      switch (stage) {
        case SLEEP_STAGE_AWAKE:
        case SLEEP_STAGE_OUT_OF_BED:
          awakeMinutes += durationMin;
          break;
        case SLEEP_STAGE_LIGHT:
        case SLEEP_STAGE_SLEEP:
          lightMinutes += durationMin;
          break;
        case SLEEP_STAGE_DEEP:
          deepMinutes += durationMin;
          break;
        case SLEEP_STAGE_REM:
          remMinutes += durationMin;
          break;
      }
    }

    const sleepMinutes = lightMinutes + deepMinutes + remMinutes;
    const totalMinutes = sleepMinutes + awakeMinutes;
    const efficiency = totalMinutes > 0 ? sleepMinutes / totalMinutes : 0;

    const durationScore = Math.min((sleepMinutes / 480) * 40, 40);
    const deepScore = Math.min(
      (deepMinutes / (sleepMinutes || 1)) * 100,
      30
    );
    const efficiencyScore = efficiency * 30;
    const sleepScore = Math.round(
      durationScore + deepScore + efficiencyScore
    );

    return {
      date:
        bedtime.split("T")[0] || new Date().toISOString().split("T")[0],
      totalMinutes: Math.round(sleepMinutes),
      stages: {
        awake: Math.round(awakeMinutes),
        light: Math.round(lightMinutes),
        deep: Math.round(deepMinutes),
        rem: Math.round(remMinutes),
      },
      sleepScore: Math.min(sleepScore, 100),
      bedtime,
      wakeTime,
    };
  }

  // ── Utility Methods ──

  private dateToNanos(dateStr: string): string {
    const ms = new Date(dateStr).getTime();
    return (ms * 1000000).toString();
  }

  private nanosToIso(nanos: string): string {
    const ms = parseInt(nanos) / 1000000;
    return new Date(ms).toISOString();
  }
}
