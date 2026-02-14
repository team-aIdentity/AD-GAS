export type Network = {
  id: string;
  name: string;
  chainId: number;
  type: string;
  icon: string;
  nativeToken: string;
};

export type Token = {
  symbol: string;
  name: string;
  balance: number;
  decimals: number;
  usdPrice: number;
};
