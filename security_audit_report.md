# Cybersecurity Audit Report: Twitch TCG System
**Auditor Role:** Senior Staff Cybersecurity Engineer  
**Status:** Pre-Deployment Audit  
**Date:** March 22, 2026

---

## 🛡️ EXECUTIVE SUMMARY
The Twitch TCG system exhibits several critical security flaws that must be addressed prior to production release. While the core architecture correctly leverages serverless Workers and Supabase, the implementation of security controls—particularly around Row Level Security (RLS), Data Sanitization, and Cryptography—presents significant risks for data exfiltration and account takeover (ATO).

---

## 🚨 TOP 10 VULNERABILITIES (PRIORITIZED)

### 1. Persistent Cross-Site Scripting (XSS) via Metadata [CRITICAL]
*   **Location**: `app.js` (Lines 1386, 1549), `dashboard.js`
*   **Detail**: The frontend uses `innerHTML` to render user-controlled strings such as Card Names, Set Names, and Usernames. 
*   **Impact**: An attacker can create a card with a payload like `<img src=x onerror=alert(document.cookie)>`. When a streamer or other viewer opens their binder, the script executes, stealing session cookies or performing unauthorized actions.
*   **Remediation**: Replace all `innerHTML` usage with `textContent` or `innerText`. If HTML rendering is required, use a library like `DOMPurify`.

### 2. Over-permissive RLS Policies (Data Exfiltration) [HIGH]
*   **Location**: `migrations/040_reenable_rls.sql` (Line 29, 41)
*   **Detail**: Policies for the `users` and `user_cards` tables grant `SELECT` access to `true`. This exposes all user Twitch IDs, collection details, and metadata to anyone with the `anon` API key.
*   **Impact**: Mass scraping of the user base and card economy. Potential disclosure of PII if further fields are added to the `users` table.
*   **Remediation**: Restrict `SELECT` policies for users to their own `auth.uid()` or specific public columns only.

### 3. Cryptographic Key Reuse & Insecure Mode [HIGH]
*   **Location**: `src/index.ts` (Lines 165, 240, 478)
*   **Detail**: The `SESSION_SECRET` is reused for both JWT signing and symmetric AES-CBC encryption of Twitch tokens. Additionally, the AES-CBC implementation (Line 240) lacks an integrity MAC.
*   **Impact**: Key compromise in one area affects both sessions and stored credentials. Lack of authenticity in CBC mode makes it vulnerable to padding oracle attacks.
*   **Remediation**: Use separate keys for separate purposes. Transition to `AES-GCM` for authenticated encryption of stored tokens.

### 4. Ineffective Rate Limiting in Distributed Environments [HIGH]
*   **Location**: `src/index.ts` (Lines 153-154)
*   **Detail**: Rate limiting is implemented using in-memory `Map` objects within the Cloudflare Worker.
*   **Impact**: In a distributed/serverless environment, these maps are local to each isolate/edge node. An attacker can bypass the limit by hitting different edge locations, rendering brute-force protection for the `/auth` and `/admin` routes effectively useless.
*   **Remediation**: Use a centralized state store like **Upstash Redis** or Cloudflare **Durable Objects** for global rate limiting.

### 5. Sensitive Information Disclosure (API Verbosity) [MEDIUM]
*   **Location**: `src/index.ts` (e.g., Line 5820)
*   **Detail**: API endpoints catch database errors and return the raw `error.message` to the client.
*   **Impact**: Leaks table schemas, constraint names, and SQL logic, providing a roadmap for further exploitation.
*   **Remediation**: Return generic "Internal Server Error" messages to users while logging detailed errors to a private logging service.

### 6. Weak CSRF Enforcement for Mutations [MEDIUM]
*   **Location**: `src/index.ts` (API Routing Layer)
*   **Detail**: Multiple `POST/PUT/DELETE` endpoints (e.g., `/api/creator/cards`) rely on session cookies but do not verify the `X-CSRF-Token` header on the backend.
*   **Impact**: Malicious websites can trick an authenticated streamer into performing actions (like deleting their collection) via a Cross-Site Request.
*   **Remediation**: Implement a global middleware in the Worker to verify the CSRF token for all state-changing methods.

### 7. Fixed OBS Overlay Tokens (Leakage Risk) [MEDIUM]
*   **Location**: `src/index.ts` (Line 6616), `obs.html`
*   **Detail**: OBS Overlay security relies on a static `obs_overlay_token` passed as a URL parameter.
*   **Impact**: These tokens are easily leaked via screenshots, browser history, or Twitch "shoulder surfing." 
*   **Remediation**: Implement short-lived tokens or a "regenerate token" feature. Ideally, use a WebSocket connection with a challenge-response handshake.

### 8. Insecure Direct Object Reference (IDOR) in Deletions [MEDIUM]
*   **Location**: `src/index.ts` (Line 5354, 5106)
*   **Detail**: Authorization is often checked in a separate query (`select`) before the deletion (`delete`).
*   **Impact**: Potential logic bypass or race conditions.
*   **Remediation**: Combine authorization into the deletion query: `DELETE FROM cards WHERE id = $1 AND streamer_id = $2`.

### 9. Lack of Session Revocation Mechanism [MEDIUM]
*   **Location**: `src/index.ts` (Line 6571)
*   **Detail**: JWT sessions are valid for 7 days with no backend check for invalidation.
*   **Impact**: Compromised sessions cannot be terminated by the user or admin until the 7-day window expires.
*   **Remediation**: Maintain a "denylist" of revoked session IDs or check a `last_logout_at` timestamp on each request.

### 10. Broad CORS Configuration [LOW]
*   **Location**: `src/index.ts` (Variable `corsHeaders`)
*   **Detail**: Explicit usage of generic `corsHeaders` across the application without dynamic origin validation.
*   **Impact**: May allow unauthorized domains to interact with the API if the `Origin` is not strictly validated against the allowed `FRONTEND_URL`.
*   **Remediation**: Dynamically check the `Origin` header against an allowlist of trusted domains.

---

## 📝 RECOMMENDATION
**DO NOT DEPLOY** to a production environment until Vulnerabilities 1-4 are remediated. The XSS and RLS flaws alone represent a critical risk to user data integrity and platform reputation.
