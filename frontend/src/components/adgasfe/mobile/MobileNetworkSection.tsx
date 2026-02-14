'use client';

import type { Network } from '@/types/adgasfe';
import { useLocale } from '@/contexts/LocaleContext';

interface MobileNetworkSectionProps {
  networks: Network[];
  selectedNetwork: Network;
  onNetworkChange: (network: Network) => void;
}

function StatusBadge() {
  const { t } = useLocale();
  return (
    <div className="bg-[rgba(16,185,129,0.15)] content-stretch flex gap-1.5 h-[26px] items-center justify-center px-3 relative rounded-[13px] shrink-0 border border-[rgba(16,185,129,0.25)] shadow-[0px_0px_10px_0px_rgba(16,185,129,0.38)]">
      <div className="bg-[#10b981] rounded-[3px] shadow-[0px_0px_6px_0px_#10b981] shrink-0 size-1.5" />
      <p className="font-bold leading-[13.2px] not-italic relative shrink-0 text-[#10b981] text-[11px]">
        {t('connected')}
      </p>
    </div>
  );
}

interface NetworkCardProps {
  network: Network;
  isActive: boolean;
  onClick: () => void;
}

function NetworkCard({ network, isActive, onClick }: NetworkCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`content-stretch flex gap-3 h-24 items-start justify-center p-4 relative rounded-[18px] shrink-0 w-[150px] transition-all ${
        isActive
          ? 'bg-[rgba(99,102,241,0.13)] border-2 border-[rgba(99,102,241,0.38)] shadow-[0px_0px_24px_0px_rgba(99,102,241,0.5)]'
          : 'bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.08)] shadow-[0px_4px_16px_0px_rgba(0,0,0,0.13)] hover:border-[rgba(99,102,241,0.2)]'
      }`}
    >
      <div className="absolute left-2.5 top-2.5 size-[25px] flex items-center justify-center text-lg">
        {network.icon.startsWith('http') || network.icon.startsWith('/') ? (
          <img
            alt={network.name}
            className="absolute inset-0 max-w-none object-cover pointer-events-none size-full rounded"
            src={network.icon}
          />
        ) : (
          <span>{network.icon}</span>
        )}
      </div>
      <div className="absolute content-stretch flex flex-col gap-[3px] items-start left-2.5 top-11">
        <p
          className={`font-bold leading-[18px] relative shrink-0 text-[15px] ${isActive ? 'text-white' : 'text-[#e2e8f0]'}`}
        >
          {network.name}
        </p>
        <p
          className={`font-medium leading-[14.4px] relative shrink-0 text-[12px] ${isActive ? 'text-[#c7d2fe]' : 'text-[#94a3b8]'}`}
        >
          {network.type}
        </p>
      </div>
    </button>
  );
}

export function MobileNetworkSection({
  networks,
  selectedNetwork,
  onNetworkChange,
}: MobileNetworkSectionProps) {
  const { t } = useLocale();
  return (
    <div className="bg-[rgba(255,255,255,0.03)] relative rounded-[20px] shrink-0 w-full border border-[rgba(255,255,255,0.08)] shadow-[0px_6px_24px_0px_rgba(0,0,0,0.19)]">
      <div className="content-stretch flex flex-col gap-4 items-start p-5 relative w-full">
        <div className="content-stretch flex flex-col gap-1 items-start relative shrink-0 w-full">
          <div className="content-stretch flex items-center justify-between relative shrink-0 w-full">
            <p className="font-extrabold leading-[19.2px] not-italic relative shrink-0 text-[16px] text-white">
              {t('networkSelect')}
            </p>
            <StatusBadge />
          </div>
          <p className="font-medium leading-[14.4px] not-italic relative shrink-0 text-[#94a3b8] text-[12px]">
            {t('networkSelectDesc')}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 w-full">
          {networks.map((network) => (
            <NetworkCard
              key={network.id}
              network={network}
              isActive={selectedNetwork.id === network.id}
              onClick={() => onNetworkChange(network)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
