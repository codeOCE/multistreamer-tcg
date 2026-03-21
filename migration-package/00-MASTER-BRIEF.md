# MASTER BRIEF: Multi-Streamer TCG Platform Migration

## MISSION
Transform a single-streamer Twitch TCG system into a multi-tenant platform where unlimited streamers can run their own branded card collections while maintaining data integrity and all existing functionality.

## CRITICAL CONSTRAINTS
1. **NON-BREAKING**: Each phase must be deployable independently without breaking production
2. **SECURITY FIRST**: Multi-tenancy must not introduce security vulnerabilities
3. **PERFORMANCE**: System must handle 1000+ concurrent streamers with <200ms response times

## SUCCESS CRITERIA
✅ New streamers can onboard and create cards independently
✅ Users can collect cards from multiple streamers
✅ Cross-streamer features work (trading, leaderboards)
✅ All webhooks route correctly per streamer
✅ OBS overlays work with per-streamer branding
✅ Zero security issues (proper tenant isolation)
✅ Complete test coverage (>90%)

## TECHNOLOGY STACK (DO NOT CHANGE)
- Backend: Cloudflare Workers (TypeScript)
- Database: Supabase (PostgreSQL)
- Frontend: Vanilla JS + Tailwind CSS
- APIs: Twitch OAuth, Twitch EventSub, StreamElements
- Deployment: Cloudflare Workers

## PHASES
1. Database Schema Migration
2. Backend API Transformation
3. Frontend Multi-Streamer UI
4. Data Migration Scripts
5. Testing & Validation
6. Deployment

## KEY FILES TO MODIFY
- `/src/index.ts` - Main backend logic
- `/public/index.html` - Main dashboard
- `/public/app.js` - Frontend logic
- `/public/arena.html` - Battle arena
- `/public/obs.html` - OBS overlay

## DO NOT MODIFY
- Pack opening animations (unless adding per-streamer branding)
- Battle logic (unless adding cross-streamer battles)
- Trading atomic swap logic
- Achievement system core logic
- Notification system core logic

## ANTI-GRAVITY LLM INSTRUCTIONS
You are an expert full-stack developer tasked with executing this migration. You have access to the complete codebase. Your job is to:

1. READ all specification documents thoroughly
2. ANALYZE the current system completely
3. PLAN your implementation strategy
4. EXECUTE each phase methodically
5. VALIDATE each change before proceeding
6. DOCUMENT all changes made

When you encounter ambiguity, make reasonable decisions and document them.
When you complete a phase, output a summary of changes and request validation before proceeding.
Always prioritize data integrity and backward compatibility.

## CONTACT & ESCALATION
If you encounter:
- Ambiguous requirements → Document assumption and proceed
- Technical blocker → Document issue and suggest alternatives
- Data integrity risk → STOP and request human review
- Security concern → STOP and request human review

## START HERE
Begin by reading 01-SYSTEM-ANALYSIS.md to understand the current system completely.
Then proceed to 02-ARCHITECTURE-SPEC.md to understand the target state.
Execute phases in order: 03 → 04 → 05 → 06 → 07 → 08.