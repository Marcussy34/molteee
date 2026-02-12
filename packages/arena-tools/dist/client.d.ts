export declare const monadTestnet: {
    blockExplorers: {
        readonly default: {
            readonly name: "Monad Explorer";
            readonly url: "https://testnet.monadexplorer.com";
        };
    };
    blockTime?: number | undefined;
    contracts?: import("viem").Prettify<{
        [key: string]: import("viem").ChainContract | {
            [sourceId: number]: import("viem").ChainContract | undefined;
        } | undefined;
    } & {
        ensRegistry?: import("viem").ChainContract | undefined;
        ensUniversalResolver?: import("viem").ChainContract | undefined;
        multicall3?: import("viem").ChainContract | undefined;
        erc6492Verifier?: import("viem").ChainContract | undefined;
    }> | undefined;
    ensTlds?: readonly string[] | undefined;
    id: 10143;
    name: "Monad Testnet";
    nativeCurrency: {
        readonly name: "MON";
        readonly symbol: "MON";
        readonly decimals: 18;
    };
    experimental_preconfirmationTime?: number | undefined;
    rpcUrls: {
        readonly default: {
            readonly http: readonly [string];
            readonly webSocket: readonly [string];
        };
    };
    sourceId?: number | undefined;
    testnet?: boolean | undefined;
    custom?: Record<string, unknown>;
    extendSchema?: Record<string, unknown>;
    fees?: import("viem").ChainFees<undefined>;
    formatters?: undefined;
    prepareTransactionRequest?: ((args: import("viem").PrepareTransactionRequestParameters, options: {
        phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
    }) => Promise<import("viem").PrepareTransactionRequestParameters>) | [fn: ((args: import("viem").PrepareTransactionRequestParameters, options: {
        phase: "beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters";
    }) => Promise<import("viem").PrepareTransactionRequestParameters>) | undefined, options: {
        runAt: readonly ("beforeFillTransaction" | "beforeFillParameters" | "afterFillParameters")[];
    }] | undefined;
    serializers?: import("viem").ChainSerializers<undefined, import("viem").TransactionSerializable>;
    verifyHash?: ((client: import("viem").Client, parameters: import("viem").VerifyHashActionParameters) => Promise<import("viem").VerifyHashActionReturnType>) | undefined;
    extend: <const extended_1 extends Record<string, unknown>>(extended: extended_1) => import("viem").Assign<import("viem").Assign<import("viem").Chain<undefined>, {
        readonly id: 10143;
        readonly name: "Monad Testnet";
        readonly nativeCurrency: {
            readonly name: "MON";
            readonly symbol: "MON";
            readonly decimals: 18;
        };
        readonly rpcUrls: {
            readonly default: {
                readonly http: readonly [string];
                readonly webSocket: readonly [string];
            };
        };
        readonly blockExplorers: {
            readonly default: {
                readonly name: "Monad Explorer";
                readonly url: "https://testnet.monadexplorer.com";
            };
        };
    }>, extended_1>;
};
export declare function getPublicClient(): any;
export declare function getWalletClient(): any;
export declare function getAddress(): `0x${string}`;
