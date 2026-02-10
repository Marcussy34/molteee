export declare const RPC_URL: string;
export declare const CHAIN_ID = 10143;
export declare const CHAIN_NAME = "Monad Testnet";
export declare const EXPLORER_URL = "https://testnet.monadexplorer.com";
export declare function getPrivateKey(): `0x${string}`;
export declare const CONTRACTS: {
    readonly AgentRegistry: "0x96728e0962d7B3fA3B1c632bf489004803C165cE";
    readonly Escrow: "0x6a52bd7fe53f022bb7c392de6285bfec2d7dd163";
    readonly RPSGame: "0x4f66f4a355ea9a54fb1f39ec9be0e3281c2cf415";
    readonly PokerGame: "0xb7b9741da4417852f42267fa1d295e399d11801c";
    readonly AuctionGame: "0x1fc358c48e7523800eec9b0baed5f7c145e9e847";
    readonly Tournament: "0xb9a2634e53ea9df280bb93195898b7166b2cadab";
    readonly TournamentV2: "0x90a4facae37e8d98c36404055ab8f629be64b30e";
    readonly PredictionMarket: "0xeb40a1f092e7e2015a39e4e5355a252b57440563";
};
export declare const GAME_TYPES: {
    readonly rps: 0;
    readonly poker: 1;
    readonly auction: 2;
};
export type GameTypeName = keyof typeof GAME_TYPES;
export declare const GAME_CONTRACTS: Record<GameTypeName, string>;
//# sourceMappingURL=config.d.ts.map