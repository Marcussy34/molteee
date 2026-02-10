// arena-tools claim-timeout — claim a timeout win for any game type
import { encodeFunctionData } from "viem";
import { CONTRACTS, type GameTypeName, GAME_TYPES } from "../config.js";
import { rpsGameAbi, pokerGameAbi, auctionGameAbi } from "../contracts.js";
import { sendTx } from "../utils/tx.js";
import { ok, fail } from "../utils/output.js";

export async function claimTimeoutCommand(gameType: string, gameId: string) {
  const gt = gameType.toLowerCase() as GameTypeName;
  if (!(gt in GAME_TYPES)) {
    fail(`Invalid game type: ${gameType}. Must be rps, poker, or auction.`, "INVALID_GAME_TYPE");
  }

  const contractMap = {
    rps: { address: CONTRACTS.RPSGame, abi: rpsGameAbi },
    poker: { address: CONTRACTS.PokerGame, abi: pokerGameAbi },
    auction: { address: CONTRACTS.AuctionGame, abi: auctionGameAbi },
  };

  const { address, abi } = contractMap[gt];

  const data = encodeFunctionData({
    abi,
    functionName: "claimTimeout",
    args: [BigInt(gameId)],
  });

  const { hash } = await sendTx({
    to: address as `0x${string}`,
    data,
  });

  ok({
    action: "claim-timeout",
    gameType: gt,
    gameId: parseInt(gameId),
    txHash: hash,
  });
}
