// Load Test Script — Simulate 1000 concurrent users
// Run: npx tsx infra/load-test.ts

const API_BASE = process.env.API_URL || "http://localhost:3001";
const CONCURRENT_USERS = 1000;
const REQUESTS_PER_USER = 5;

const symptoms = [
  "I have a bit of a headache and feel dizzy today. It's been like this since the morning.",
  "I've had a cough for three days now. I'm also coughing up phlegm. I took some Tylenol but it hasn't helped.",
  "My lower back hurts so much I couldn't sleep well. It's been going on for a week.",
  "I have a stomachache and diarrhea. I ate raw fish yesterday and I think that might be the cause.",
  "My throat feels sore and I think I have a fever. My nose is stuffy too.",
];

async function simulateUser(userId: number) {
  const results = { success: 0, fail: 0, avgLatency: 0 };
  const latencies: number[] = [];

  for (let i = 0; i < REQUESTS_PER_USER; i++) {
    const start = Date.now();
    try {
      const res = await fetch(`${API_BASE}/api/v1/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer mock-token-${userId}` },
        body: JSON.stringify({ message: symptoms[i % symptoms.length], language: "en" }),
      });
      if (res.ok) results.success++;
      else results.fail++;
    } catch { results.fail++; }
    latencies.push(Date.now() - start);
  }

  results.avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  return results;
}

async function runLoadTest() {
  console.log(`🚀 Load test: ${CONCURRENT_USERS} users × ${REQUESTS_PER_USER} requests = ${CONCURRENT_USERS * REQUESTS_PER_USER} total`);
  const start = Date.now();

  const promises = Array.from({ length: CONCURRENT_USERS }, (_, i) => simulateUser(i));
  const results = await Promise.all(promises);

  const totalSuccess = results.reduce((a, r) => a + r.success, 0);
  const totalFail = results.reduce((a, r) => a + r.fail, 0);
  const avgLatency = results.reduce((a, r) => a + r.avgLatency, 0) / results.length;
  const p95Latencies = results.map(r => r.avgLatency).sort((a, b) => a - b);
  const p95 = p95Latencies[Math.floor(p95Latencies.length * 0.95)];

  console.log(`\n📊 Results:`);
  console.log(`   Duration: ${((Date.now() - start) / 1000).toFixed(1)}s`);
  console.log(`   Success: ${totalSuccess} | Fail: ${totalFail}`);
  console.log(`   Avg Latency: ${avgLatency.toFixed(0)}ms | P95: ${p95.toFixed(0)}ms`);
  console.log(`   RPS: ${(totalSuccess / ((Date.now() - start) / 1000)).toFixed(1)}`);
}

runLoadTest();
