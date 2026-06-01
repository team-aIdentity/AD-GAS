export type Network = {
  id: string;
  name: string;
  chainId: number;
  type: string;
  icon: string;
  nativeToken: string;
  // false면 UI에서 선택 비활성화 (배포 전 체인). 미지정 시 활성으로 간주.
  enabled?: boolean;
};

export type TokenCategory = 'stablecoin' | 'token';

export type Token = {
  symbol: string;
  name: string;
  balance: number;
  decimals: number;
  usdPrice?: number;
  category: TokenCategory;
};
