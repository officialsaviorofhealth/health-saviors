import { Hono } from "hono";
import { prisma } from "../app";

const consentRouter = new Hono();

// GET /api/v1/consent — List user consents
consentRouter.get("/", async (c) => {
  const userId = c.get("userId") as string;

  const consents = await prisma.dataConsent.findMany({
    where: { userId, revokedAt: null },
    orderBy: { grantedAt: "desc" },
  });

  return c.json({
    success: true,
    data: consents.map((consent) => ({
      id: consent.id, grantee: consent.grantee, granteeName: consent.granteeName,
      scope: consent.scope,
      grantedAt: consent.grantedAt, expiresAt: consent.expiresAt,
    })),
  });
});

// POST /api/v1/consent/grant — Grant data consent
consentRouter.post("/grant", async (c) => {
  try {
    const userId = c.get("userId") as string;
    const { grantee, granteeName, scope, expiresAt } = await c.req.json();

    if (!grantee || !scope) {
      return c.json({ success: false, error: { code: "MISSING_FIELDS", message: "grantee and scope required" } }, 400);
    }

    const consent = await prisma.dataConsent.create({
      data: {
        userId, grantee,
        granteeName: granteeName || null,
        scope: scope as any,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
    });

    return c.json({
      success: true,
      data: { id: consent.id, grantee, scope, status: "granted", grantedAt: consent.grantedAt },
    });
  } catch (error: any) {
    return c.json({ success: false, error: { code: "GRANT_ERROR", message: error.message } }, 500);
  }
});

// POST /api/v1/consent/revoke — Revoke consent
consentRouter.post("/revoke", async (c) => {
  try {
    const userId = c.get("userId") as string;
    const { consentId } = await c.req.json();

    const result = await prisma.dataConsent.updateMany({
      where: { id: consentId, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    if (result.count === 0) {
      return c.json({ success: false, error: { code: "NOT_FOUND", message: "Consent not found or already revoked" } }, 404);
    }

    return c.json({ success: true, data: { consentId, status: "revoked", revokedAt: new Date() } });
  } catch (error: any) {
    return c.json({ success: false, error: { code: "REVOKE_ERROR", message: error.message } }, 500);
  }
});

export { consentRouter };
