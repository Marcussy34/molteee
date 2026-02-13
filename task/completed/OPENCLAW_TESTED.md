# OpenClaw Agent Autonomous Gameplay — Tested & Verified

**Date:** February 10, 2026
**Network:** Monad Testnet (Chain 10143)
**OpenClaw Version:** 2026.2.3-1 (d84eb46)
**Agent Model:** `openai/gpt-5-mini`
**Gateway:** `ws://127.0.0.1:18789`
**Fighter:** `0x6cCBe5f5Cf80f66a0ef286287e2A75e4aFec7Fbf`

---

## Summary

The OpenClaw fighter agent ran **fully autonomously** — no human intervention during gameplay. The LLM read the fighter SKILL.md, identified available commands, and executed a multi-step on-chain workflow: check status, find opponents, challenge the weakest, play the match, and report results. This validates the core hackathon deliverable: an AI agent that plays on-chain games without human input.

---

## Environment Setup

| Component | Status | Details |
|-----------|--------|---------|
| OpenClaw Gateway | Running | Port 18789, model `openai/gpt-5-mini` |
| Fighter Skill | Symlinked | `~/.openclaw/workspace/skills/fighter` → `skills/fighter/` |
| Opponent Bots | Running | 5 bots via `opponents/run_all.py` (threaded) |
| Python Runtime | `python3.13` | web3.py installed, shebangs updated |
| Workspace Files | Injected | AGENTS.md, SOUL.md, TOOLS.md, IDENTITY.md, USER.md, HEARTBEAT.md, BOOTSTRAP.md |
| Skills Discovered | 13 total | fighter skill detected alongside 12 built-in skills |

### OpenClaw CLI Command Used

```bash
# Session-based agent invocation (required --session-id for routing)
openclaw agent --session-id fighter-demo \
  --message "Use the fighter skill. Check your status, find RPS opponents, then challenge the weakest one to a best-of-3 RPS match for 0.001 MON. After the match, show the history." \
  --timeout 300 --json
```

**Note:** The first attempt without `--session-id` failed with:
```
Error: Pass --to <E.164>, --session-id, or --agent to choose a session
```
This is required by OpenClaw to route the message to a session.

---

## Test 1: Autonomous RPS Match (PASS)

### Agent Execution Flow

The LLM agent autonomously performed these steps in a single turn (~49 seconds):

| Step | Command | Result |
|------|---------|--------|
| 1 | Read SKILL.md | Understood all 6 fighter commands |
| 2 | `arena.py status` | Wallet: `0x6cCB...Fbf`, Balance: 84.33 MON, ELO: 1085 |
| 3 | `arena.py find-opponents` | Found 5 RPS opponents (ELOs: 1031, 985, 986, 958, 955) |
| 4 | Selected weakest | `0x8290c36e...` (CounterBot, ELO 955) |
| 5 | `arena.py challenge 0x8290... 0.001 3` | Match ID 30 created, escrow TX `458af4b0...` |
| 6 | Opponent bot accepted | Auto-accepted by CounterBot thread |
| 7 | Best-of-3 RPS played | Commit-reveal rounds executed on-chain |
| 8 | `arena.py history` | Match recorded as WIN |

### Match Result

```
2026-02-10 12:11  WIN  vs 0x8290c36e...  0.0010 MON  (RPS)
```

### Stats Change

| Metric | Before | After | Delta |
|--------|--------|-------|-------|
| Total Matches | 31 | 32 | +1 |
| Wins | 18 | 19 | +1 |
| Win Rate | 58.1% | 59.4% | +1.3% |
| ELO (RPS) | 1085 | 1099 | +14 |
| Balance | 84.333 MON | 84.225 MON | -0.108 (gas) |

### Agent LLM Usage (Run 1)

| Metric | Value |
|--------|-------|
| Duration | 49,258 ms |
| Input Tokens | 96 |
| Cache Read | 15,104 |
| Output Tokens | 486 |
| Total Tokens | 15,686 |

---

## Test 2: Follow-Up History Query (PASS)

Sent a follow-up message to the same session:

```bash
openclaw agent --session-id fighter-demo \
  --message "Continue monitoring the match. Once finished, show the match history with the history command." \
  --timeout 300 --json
```

**Result:** Agent ran `arena.py history` and returned the full match table. Session persistence worked — the agent retained context from the previous turn. Duration: 34,840 ms.

---

## Test 3: Autonomous Poker Challenge (PARTIAL — RPC Rate Limit)

```bash
openclaw agent --session-id fighter-demo \
  --message "Challenge an opponent to a poker match for 0.001 MON. Show the results after." \
  --timeout 300 --json
```

### First Attempt — Failed (429 Rate Limit)

- Opponent selected: `0x8290c36e...` (Poker ELO 943)
- Match ID 31 created, escrow TX `de98d717...`
- **Error:** `429 Client Error: Too Many Requests` from `https://testnet-rpc.monad.xyz/`
- Root cause: 5 bots + fighter all polling the same RPC endpoint simultaneously

### Retry — Succeeded

```bash
openclaw agent --session-id fighter-demo \
  --message "Retry the poker challenge. Pick a different opponent this time." \
  --timeout 300 --json
```

- Agent chose different opponent: `0xA56766DD...` (RandomBot)
- Match ID 32 created, escrow TX `16a299aa...`
- Agent correctly adapted — picked a new opponent after the first one triggered rate limits

**Key observation:** The agent handled failure gracefully. It explained the error, offered options (retry/switch/abort), and when told to retry with a different opponent, it did so without repeating the same mistake.

---

## What the Agent "Sees"

The OpenClaw system prompt includes:

| File | Size | Purpose |
|------|------|---------|
| AGENTS.md | 7,804 chars | Agent behavior configuration |
| SOUL.md | 1,664 chars | Personality / identity |
| TOOLS.md | 1,277 chars | Available tools (exec, process, read, etc.) |
| IDENTITY.md | 632 chars | Name and context |
| USER.md | 478 chars | User preferences |
| HEARTBEAT.md | 167 chars | Periodic task config |
| BOOTSTRAP.md | 1,449 chars | Startup instructions |

**Skills injected as metadata (329 chars for fighter):**
The agent gets a short description of each skill. When it decides to use the fighter skill, it reads the full `SKILL.md` via the `read` tool.

**Total system prompt:** 26,929 chars (13,795 project + 13,134 platform)

---

## Key Takeaways

### What Worked

1. **Autonomous multi-step execution** — Agent chained status → find → challenge → history without prompting
2. **Intelligent opponent selection** — Picked the weakest by ELO, not random
3. **Session persistence** — Follow-up messages continued the same conversation
4. **Background execution** — Agent used `process` tool for the blocking `challenge` command
5. **Error recovery** — When poker hit 429, agent explained the issue and offered alternatives
6. **Skill discovery** — Fighter skill was discovered among 13 skills and used correctly

### What Didn't Work Perfectly

1. **`--session-id` required** — Not obvious from docs; first attempt failed without it
2. **RPC rate limiting** — 5 bots + fighter overwhelmed Monad testnet RPC (429 errors)
3. **Poker match timing** — Match created in escrow but full gameplay was interrupted by rate limits
4. **Match history lag** — `history` command sometimes returned stale data (match not yet settled on-chain)

### Recommendations for Production

- Use a dedicated RPC endpoint (not public testnet) to avoid 429s
- Add RPC rate limiting/queueing in `contracts.py` to serialize requests
- Consider running fewer bots simultaneously during agent demos
- Add `--session-id` to SKILL.md documentation as a required parameter

---

## Files Involved

| File | Role |
|------|------|
| `~/.openclaw/openclaw.json` | Gateway config (port 18789, model) |
| `~/.openclaw/.env` | OPENAI_API_KEY for gpt-5-mini |
| `~/.openclaw/workspace/skills/fighter/` | Symlink to `skills/fighter/` |
| `skills/fighter/SKILL.md` | Agent reads this for command reference |
| `skills/fighter/scripts/arena.py` | CLI dispatcher (status, find-opponents, challenge, history) |
| `skills/fighter/lib/contracts.py` | web3.py wrappers for on-chain interaction |
| `opponents/run_all.py` | Launches 5 opponent bots in parallel threads |

---

## Verification Checklist

- [x] OpenClaw gateway started on port 18789
- [x] Fighter skill discovered (13 skills total)
- [x] Agent read SKILL.md autonomously
- [x] Agent executed `status` command
- [x] Agent executed `find-opponents` command
- [x] Agent selected weakest opponent by ELO
- [x] Agent issued `challenge` command (Match ID 30)
- [x] Opponent bot accepted and played match
- [x] Match settled on-chain (WIN)
- [x] ELO updated (1085 → 1099)
- [x] Match count increased (31 → 32)
- [x] Agent reported history correctly
- [x] Session persistence verified (follow-up messages work)
- [x] Agent handled RPC errors gracefully (429 recovery)
- [x] No human intervention during gameplay
