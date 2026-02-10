// arena-tools challenge — create an escrow match against an opponent
import { encodeFunctionData, parseEther, getAddress as checksumAddress } from "viem";
import { CONTRACTS, GAME_CONTRACTS, type GameTypeName, GAME_TYPES } from "../config.js";
import { escrowAbi } from "../contracts.js";
import { getPublicClient, getAddress } from "../client.js";
import { sendTx } from "../utils/tx.js";
import { ok, fail } from "../utils/output.js";

export async function challengeCommand(
  opponent: string,
  wager: string,
  gameType: string
) {
  const gt = gameType.toLowerCase() as GameTypeName;
  if (!(gt in GAME_TYPES)) {
    fail(`Invalid game type: ${gameType}. Must be rps, poker, or auction.`, "INVALID_GAME_TYPE");
  }

  const gameContract = GAME_CONTRACTS[gt];
  const wagerWei = parseEther(wager);
  const address = getAddress();

  const data = encodeFunctionData({
    abi: escrowAbi,
    functionName: "createMatch",
    args: [checksumAddress(opponent as `0x${string}`), gameContract as `0x${string}`],
  });

  const { hash } = await sendTx({
    to: CONTRACTS.Escrow as `0x${string}`,
    data,
    value: wagerWei,
  });

  // Get the match ID from nextMatchId
  const client = getPublicClient();
  const nextId = (await client.readContract({
    address: CONTRACTS.Escrow as `0x${string}`,
    abi: escrowAbi,
    functionName: "nextMatchId",
  })) as bigint;

  const matchId = Number(nextId) - 1;

  ok({
    action: "challenge",
    matchId,
    challenger: address,
    opponent,
    gameType: gt,
    wager,
    txHash: hash,
  });
}
