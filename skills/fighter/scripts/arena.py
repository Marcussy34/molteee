#!/usr/bin/env python3
"""
arena.py — CLI dispatcher for the Gaming Arena Fighter Agent.

Usage: python3 scripts/arena.py <command> [args]

Commands:
    status              Show wallet balance, ELO, registration status
    register            Register this agent in the AgentRegistry
    find-opponents      List open agents for RPS
    challenge           Create an RPS challenge (escrow + game)
    play-rps            Play an active RPS game
    history             Show match history
"""
import sys

def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    command = sys.argv[1]

    # Stub — implementations come in Phase 2
    if command == "status":
        print("[TODO] Show wallet balance, ELO, registration status")
    elif command == "register":
        print("[TODO] Register agent in AgentRegistry")
    elif command == "find-opponents":
        print("[TODO] List open agents")
    elif command == "challenge":
        print("[TODO] Create RPS challenge")
    elif command == "play-rps":
        print("[TODO] Play RPS game")
    elif command == "history":
        print("[TODO] Show match history")
    else:
        print(f"Unknown command: {command}")
        print(__doc__)
        sys.exit(1)

if __name__ == "__main__":
    main()
