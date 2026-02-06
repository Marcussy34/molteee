# Moltiverse Hackathon: Task Overview

## Project Summary

Build an autonomous RPS (Rock-Paper-Scissors) fighter agent for the Moltiverse hackathon on Monad blockchain. The agent uses OpenClaw skills to compete against opponents, employing pattern recognition and adaptive strategies to maximize winnings.

**Hackathon:** Moltiverse
**Blockchain:** Monad Testnet
**Agent Framework:** OpenClaw
**Smart Contracts:** Foundry/Solidity

---

## Phase Dependency Graph

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  ┌──────────────┐                                               │
│  │   Phase 1    │                                               │
│  │  Foundation  │                                               │
│  └──────┬───────┘                                               │
│         │                                                       │
│         ▼                                                       │
│  ┌──────────────┐                                               │
│  │   Phase 2    │                                               │
│  │ Basic Agent  │                                               │
│  └──────┬───────┘                                               │
│         │                                                       │
│         ├─────────────────────┐                                 │
│         ▼                     ▼                                 │
│  ┌──────────────┐      ┌──────────────┐                         │
│  │   Phase 3    │      │   Phase 4    │                         │
│  │  Opponents   │◄────►│   Strategy   │                         │
│  └──────┬───────┘      └──────┬───────┘                         │
│         │                     │                                 │
│         └──────────┬──────────┘                                 │
│                    ▼                                            │
│             ┌──────────────┐                                    │
│             │   Phase 5    │                                    │
│             │ Demo/Polish  │                                    │
│             └──────┬───────┘                                    │
│                    │                                            │
│                    ▼                                            │
│             ┌──────────────┐                                    │
│             │   Phase 6    │                                    │
│             │    Bonus     │                                    │
│             └──────────────┘                                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Legend:**
- Phase 1 → Phase 2: Sequential (must complete before)
- Phase 2 → Phase 3/4: Can run in parallel
- Phase 3 ↔ Phase 4: Cross-dependency (opponents needed for testing strategy)
- Phase 5: Requires 3 + 4 complete
- Phase 6: Stretch goals (time permitting)

---

## Critical Path

The minimum path to a working submission:

1. **Phase 1** — Deploy contracts (BLOCKING)
2. **Phase 2** — Basic agent works (BLOCKING)
3. **Phase 4** — Strategy engine (CORE VALUE)
4. **Phase 5** — Demo prep (SUBMISSION)

Phase 3 (Opponents) enhances testing but can use manual opponents if needed.
Phase 6 (Bonus) is optional stretch goals.

---

## Success Metrics

| Metric | Target | Stretch |
|--------|--------|---------|
| Contracts deployed | 3 | 4+ (with prediction market) |
| Agent completes match | Yes | — |
| Win rate vs random | >50% | >65% |
| Opponents available | 5 | 5+ |
| Bankroll growth | Positive | >20% |
| Demo video | 2 min | 5 min with extras |

---

## Phase Summary

| Phase | Name | Objective | Gate Criteria |
|-------|------|-----------|---------------|
| 1 | Foundation | Dev setup + contracts deployed | 3 contracts on testnet |
| 2 | Basic Agent | First working fighter | Completes 1 match |
| 3 | Opponents | 5 distinct opponent agents | All 5 registered & playing |
| 4 | Strategy Engine | Pattern recognition + bankroll | Positive win rate in gauntlet |
| 5 | Demo & Polish | Submission materials ready | Video + submission complete |
| 6 | Bonus | Prediction market + extras | Stretch features working |

---

## Submission Checklist

### Required Materials
- [ ] Fighter agent skill (OpenClaw)
- [ ] Smart contracts (deployed, verified)
- [ ] Demo video (2+ min)
- [ ] README with setup instructions
- [ ] Source code (GitHub repo)

### Optional Enhancements
- [ ] Live dashboard
- [ ] Prediction market integration
- [ ] Spectator skill
- [ ] Multiple game types

### Submission Steps
1. Ensure all code is pushed to GitHub
2. Verify contracts are verified on block explorer
3. Upload demo video
4. Submit at moltiverse.dev
5. Share on Moltbook

---

## Quick Links

- [Phase 1: Foundation](./01-FOUNDATION.md)
- [Phase 2: Basic Agent](./02-BASIC-AGENT.md)
- [Phase 3: Opponents](./03-OPPONENTS.md)
- [Phase 4: Strategy Engine](./04-STRATEGY-ENGINE.md)
- [Phase 5: Demo & Polish](./05-DEMO-POLISH.md)
- [Phase 6: Bonus](./06-BONUS.md)

---

## Notes

- All times are estimates; focus on quality over speed
- Test after every meaningful change
- Commit often with clear messages
- Document decisions as you go
