import { Hono } from "hono";
const hospitalRouter = new Hono();
hospitalRouter.get("/status", (c) => {
  const configured = !!process.env.HOSPITAL_API_ENDPOINT;
  return c.json({ success: true, data: { available: configured, adapter: configured ? "AIListedCompanyAdapter" : "NullHospitalAdapter" } });
});
hospitalRouter.post("/sync", (c) => {
  if (!process.env.HOSPITAL_API_ENDPOINT) return c.json({ success: false, error: { code: "NOT_CONFIGURED", message: "Hospital integration pending" } }, 503);
  return c.json({ success: true, data: { syncedResources: 0 } });
});
hospitalRouter.get("/prescriptions", (c) => c.json({ success: true, data: [], message: "Manual reminders only until hospital sync" }));
hospitalRouter.post("/emergency", (c) => {
  if (!process.env.HOSPITAL_API_ENDPOINT) return c.json({ success: false, error: { code: "NOT_CONFIGURED", message: "Emergency share requires hospital integration" } }, 503);
  return c.json({ success: true, data: { accessCode: "", expiresAt: 0 } });
});
export { hospitalRouter };
