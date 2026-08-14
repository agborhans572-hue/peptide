import http from 'k6/http'
import { check } from 'k6'
import { Counter } from 'k6/metrics'
import exec from 'k6/execution'

const mode = __ENV.K6_MODE || 'soak'
const successes = new Counter('reservations_succeeded')
const commonThresholds = {
  http_req_duration: ['p(95)<4000', 'p(99)<8000'],
  http_req_failed: ['rate<0.02'],
}

export const options = mode === 'oversell'
  ? {
      scenarios: { oversell: { executor: 'shared-iterations', vus: 50, iterations: 50, maxDuration: '2m' } },
      thresholds: { http_req_duration: ['p(99)<8000'], reservations_succeeded: ['count==10'] },
    }
  : {
      scenarios: {
        target: { executor: 'constant-arrival-rate', rate: 100, timeUnit: '1m', duration: '15m', preAllocatedVUs: 30, maxVUs: 100 },
        burst: { executor: 'constant-arrival-rate', startTime: '15m', rate: 200, timeUnit: '1m', duration: '2m', preAllocatedVUs: 60, maxVUs: 150 },
      },
      thresholds: commonThresholds,
    }

function uuid() {
  const iteration = `${Date.now()}-${exec.vu.idInTest}-${exec.scenario.iterationInTest}-${Math.random()}`
  let hash = 2166136261
  for (let index = 0; index < iteration.length; index += 1) hash = Math.imul(hash ^ iteration.charCodeAt(index), 16777619)
  const suffix = Math.abs(hash).toString(16).padStart(8, '0')
  return `10000000-0000-4000-8000-${suffix}${suffix.slice(0, 4)}`
}

export default function () {
  const baseUrl = (__ENV.BASE_URL || '').replace(/\/$/, '')
  if (!baseUrl || !__ENV.CATALOG_VERSION || !__ENV.PRODUCT_ID || !__ENV.VARIANT_ID) {
    throw new Error('BASE_URL, CATALOG_VERSION, PRODUCT_ID, and VARIANT_ID are required.')
  }
  const response = http.post(`${baseUrl}/api/checkout`, JSON.stringify({
    checkoutAttemptId: uuid(),
    catalogVersion: __ENV.CATALOG_VERSION,
    items: [{ productId: __ENV.PRODUCT_ID, variantId: __ENV.VARIANT_ID, quantity: 1 }],
  }), {
    headers: { 'Content-Type': 'application/json', Origin: baseUrl },
    redirects: 0,
  })
  if (response.status === 200) successes.add(1)
  if (mode === 'oversell') check(response, { 'reservation accepted or stock conflict': (result) => [200, 409].includes(result.status) })
  else check(response, { 'checkout created': (result) => result.status === 200 })
}
