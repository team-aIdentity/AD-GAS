'use client';

import { svgPaths } from '@/lib/svgPaths';
import { useLocale } from '@/contexts/LocaleContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

function Logo() {
  return (
    <div className="bg-[rgba(255,255,255,0.08)] content-stretch flex items-center justify-center relative rounded-[14px] shrink-0 size-[48px]">
      <div
        aria-hidden
        className="absolute border border-[rgba(99,102,241,0.5)] border-solid inset-0 pointer-events-none rounded-[14px] shadow-[0px_8px_32px_0px_rgba(99,102,241,0.25)]"
      />
      <div className="relative shrink-0 size-[30px]">
        <img
          alt="AD GAS Logo"
          className="object-cover pointer-events-none size-full"
          src="/images/logo.png"
        />
      </div>
    </div>
  );
}

function TitleGroup() {
  const { t } = useLocale();
  return (
    <div className="content-stretch flex flex-col gap-[2px] items-start not-italic relative shrink-0">
      <p className="font-extrabold leading-[33.6px] relative shrink-0 text-[28px] text-shadow-[0px_0px_20px_rgba(99,102,241,0.5)] text-white">
        AD GAS
      </p>
      <p className="font-semibold leading-[16.8px] relative shrink-0 text-[#a5b4fc] text-[14px]">
        {t('header.tagline')}
      </p>
    </div>
  );
}

function WalletIcon() {
  return (
    <div className="relative shrink-0 size-[22px]">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 22 22">
        <g>
          <path
            d={svgPaths.p3c4af480}
            stroke="#A5B4FC"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.83333"
          />
          <path
            d={svgPaths.p280b6dc0}
            stroke="#A5B4FC"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.83333"
          />
        </g>
      </svg>
    </div>
  );
}

interface WalletButtonProps {
  isConnected: boolean;
  walletAddress: string;
  onConnect: () => void;
  onDisconnect: () => void;
}

function WalletButton({ isConnected, walletAddress, onConnect, onDisconnect }: WalletButtonProps) {
  const { t } = useLocale();
  return (
    <button
      type="button"
      onClick={isConnected ? onDisconnect : onConnect}
      className="bg-[rgba(99,102,241,0.19)] content-stretch flex gap-[10px] h-[48px] items-center justify-center px-[24px] relative rounded-[24px] shrink-0 border border-[rgba(99,102,241,0.38)] shadow-[0px_0px_20px_0px_rgba(99,102,241,0.25)] hover:bg-[rgba(99,102,241,0.25)] transition-colors"
    >
      <WalletIcon />
      <p className="font-bold leading-[18px] not-italic relative shrink-0 text-[15px] text-white">
        {isConnected ? walletAddress : t('header.connectWallet')}
      </p>
    </button>
  );
}

interface HeaderProps {
  isConnected: boolean;
  walletAddress: string;
  onConnect: () => void;
  onDisconnect: () => void;
}

export function Header({ isConnected, walletAddress, onConnect, onDisconnect }: HeaderProps) {
  return (
    <header className="relative shrink-0 w-full">
      <div className="content-stretch flex flex-col items-start px-12 py-8 relative w-full">
        <div className="content-stretch flex items-center justify-between relative shrink-0 w-full">
          <div className="content-stretch flex gap-[14px] items-center relative shrink-0">
            <Logo />
            <TitleGroup />
          </div>
          <div className="flex items-center gap-4">
            <LanguageSwitcher />
            <WalletButton
            isConnected={isConnected}
            walletAddress={walletAddress}
            onConnect={onConnect}
            onDisconnect={onDisconnect}
          />
          </div>
        </div>
      </div>
    </header>
  );
}
