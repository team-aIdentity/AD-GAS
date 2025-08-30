'use client';

// EIP-712 타입드 데이터 유틸리티 함수들

/**
 * MetaMask 호환 EIP-712 데이터 형식으로 변환
 */
export function formatEIP712ForMetaMask(typedData: {
  domain: any;
  types: any;
  primaryType: string;
  message: any;
}) {
  // MetaMask는 특정 형식을 요구함
  const formatted = {
    domain: {
      ...typedData.domain,
      // chainId는 숫자여야 함
      chainId: typeof typedData.domain.chainId === 'string' 
        ? parseInt(typedData.domain.chainId) 
        : typedData.domain.chainId,
    },
    types: {
      // EIP712Domain은 자동으로 추가되지만 명시적으로 정의
      EIP712Domain: [
        { name: 'name', type: 'string' },
        { name: 'version', type: 'string' },
        { name: 'chainId', type: 'uint256' },
        { name: 'verifyingContract', type: 'address' },
      ],
      ...typedData.types,
    },
    primaryType: typedData.primaryType,
    message: formatMessageForMetaMask(typedData.message, typedData.types[typedData.primaryType]),
  };

  return formatted;
}

/**
 * 메시지 값들을 MetaMask 호환 형식으로 변환
 */
function formatMessageForMetaMask(message: any, typeDefinition: any[]) {
  const formatted: any = {};

  for (const field of typeDefinition) {
    const value = message[field.name];
    
    if (value === undefined || value === null) {
      continue;
    }

    switch (field.type) {
      case 'uint256':
        // uint256은 hex 문자열 또는 숫자 문자열이어야 함
        if (typeof value === 'string' && value.startsWith('0x')) {
          formatted[field.name] = value; // 이미 hex
        } else if (typeof value === 'string' && !isNaN(Number(value))) {
          formatted[field.name] = `0x${BigInt(value).toString(16)}`; // 숫자 문자열을 hex로
        } else if (typeof value === 'bigint') {
          formatted[field.name] = `0x${value.toString(16)}`; // bigint를 hex로
        } else {
          formatted[field.name] = value; // 그대로 사용
        }
        break;
        
      case 'address':
        // 주소는 체크섬 형식이어야 함
        formatted[field.name] = value.toLowerCase().startsWith('0x') ? value : `0x${value}`;
        break;
        
      case 'bytes':
        // bytes는 hex 문자열이어야 함
        formatted[field.name] = value.startsWith('0x') ? value : `0x${value}`;
        break;
        
      default:
        formatted[field.name] = value;
        break;
    }
  }

  return formatted;
}

/**
 * UserOperation을 MetaMask 호환 형식으로 변환
 */
export function formatUserOperationForMetaMask(userOp: any) {
  const domain = {
    name: 'Account Abstraction',
    version: '1',
    chainId: 11155111, // 숫자로 전달
    verifyingContract: userOp.sender,
  };

  const types = {
    EIP712Domain: [
      { name: 'name', type: 'string' },
      { name: 'version', type: 'string' },
      { name: 'chainId', type: 'uint256' },
      { name: 'verifyingContract', type: 'address' },
    ],
    UserOperation: [
      { name: 'sender', type: 'address' },
      { name: 'nonce', type: 'uint256' },
      { name: 'initCode', type: 'bytes' },
      { name: 'callData', type: 'bytes' },
      { name: 'callGasLimit', type: 'uint256' },
      { name: 'verificationGasLimit', type: 'uint256' },
      { name: 'preVerificationGas', type: 'uint256' },
      { name: 'maxFeePerGas', type: 'uint256' },
      { name: 'maxPriorityFeePerGas', type: 'uint256' },
      { name: 'paymasterAndData', type: 'bytes' },
    ],
  };

  const message = {
    sender: userOp.sender,
    nonce: ensureHex(userOp.nonce),
    initCode: ensureHex(userOp.initCode),
    callData: ensureHex(userOp.callData),
    callGasLimit: ensureHex(userOp.callGasLimit),
    verificationGasLimit: ensureHex(userOp.verificationGasLimit),
    preVerificationGas: ensureHex(userOp.preVerificationGas),
    maxFeePerGas: ensureHex(userOp.maxFeePerGas),
    maxPriorityFeePerGas: ensureHex(userOp.maxPriorityFeePerGas),
    paymasterAndData: ensureHex(userOp.paymasterAndData),
  };

  return {
    domain,
    types,
    primaryType: 'UserOperation',
    message,
  };
}

/**
 * 값이 hex 형식인지 확인하고 변환
 */
function ensureHex(value: string | number | bigint): string {
  if (typeof value === 'string') {
    if (value.startsWith('0x')) {
      return value; // 이미 hex
    }
    // 숫자 문자열을 hex로 변환
    return `0x${BigInt(value).toString(16)}`;
  }
  
  if (typeof value === 'bigint') {
    return `0x${value.toString(16)}`;
  }
  
  if (typeof value === 'number') {
    return `0x${value.toString(16)}`;
  }
  
  return '0x0';
}
