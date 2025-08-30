# Gasless Wallet SDK

## 프로젝트 개요
EIP-4337 Account Abstraction을 활용하여 사용자의 가스비 부담 없이 트랜잭션을 실행할 수 있는 Wallet SDK 제공

## 핵심 가치
- **무가스 트랜잭션**: 사용자는 가스비 없이 트랜잭션 실행 가능
- **광고 기반 수익 모델**: 가스비 대납의 대가로 광고 노출
- **멀티체인 지원**: 모든 EVM 호환 체인에서 동작
- **개발자 친화적**: 간단한 SDK 통합으로 즉시 사용 가능

## 기술 스택

### 스마트 컨트랙트
- Solidity ^0.8.20
- EIP-4337 (Account Abstraction)
- OpenZeppelin Contracts
- Hardhat 개발 환경

### SDK
- TypeScript
- Ethers.js v6
- Viem (옵션)
- Bundler 통신 라이브러리

### 인프라
- UserOperation Bundler (Stackup, Alchemy, Pimlico 등)
- EntryPoint Contract (EIP-4337 표준)
- 멀티체인 RPC 엔드포인트

## 주요 기능

### Paymaster 컨트랙트
- 가스비 대납 및 검증 로직
- 화이트리스트 관리 및 가스 한도 설정
- 재진입 공격 방지 및 비상 정지 기능

### TypeScript SDK
- Smart Account 생성 및 초기화
- 가스비 없는 트랜잭션 전송
- 배치 트랜잭션 처리
- 광고 트리거 인터페이스

### 멀티체인 지원
- Ethereum, Polygon, Arbitrum, Optimism, Base, BSC, Avalanche
- 체인별 독립적 설정 및 최적화

## 개발 목표
- 트랜잭션 처리 시간: < 5초
- SDK 초기화 시간: < 1초
- 동시 사용자: 10,000+ TPS 지원
- 시스템 가동률: > 99.9%

## 보안 요구사항
- 감사 완료된 스마트 컨트랙트
- 프라이빗 키 보안 관리
- 트랜잭션 무결성 보장
- MEV 공격 및 DoS 공격 방지
