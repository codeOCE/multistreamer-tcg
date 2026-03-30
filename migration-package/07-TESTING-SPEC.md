## Coverage Target

Minimum 90%

## Unit Tests

-   Streamer resolution
-   Tenant isolation
-   Pack logic per streamer
-   Trade validation
-   Webhook routing

## Integration Tests

### Dual Streamer Isolation

User collects in A → verify B cannot access

### Pack Isolation

Open in A → confirm no record in B

### Trade Validation

Attempt cross-streamer trade → expect rejection (unless enabled)

### RLS Enforcement

Direct DB access without streamer context → expect failure

## Load Testing

Simulate: - 1000 concurrent pack opens - 500 battles - 200 webhook
events

Target: \<200ms p95

## Security Tests

Attempt: - Cross-tenant access - Forged slug - OBS token spoof - Webhook
replay attack

All must fail.

## Regression Tests

-   Pack opening (legacy)
-   Trading (legacy)
-   Battle system
-   Achievements
-   Notifications