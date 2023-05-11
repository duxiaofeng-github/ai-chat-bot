export {};

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      REACT_APP_CLUSTER: 'devnet' | 'testnet' | 'mainnet';
      REACT_APP_GEODE_SERVER: string;
      COVALENT_KEY: string;
      REACT_APP_SOLANA_API_URL: string;
      REACT_APP_SOLANA_WS_URL: string;
    }
  }
}
