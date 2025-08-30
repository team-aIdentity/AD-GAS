import { WalletConnector } from '../components/WalletConnector';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-4xl mx-auto">
        {/* 헤더 */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">🚀 Gasless SDK Frontend</h1>
          <p className="text-lg text-gray-600">Next.js + Wagmi를 활용한 Web3 지갑 연결 데모</p>
        </div>

        {/* 지갑 연결 컴포넌트 */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <WalletConnector />
        </div>

        {/* 추가 정보 */}
        <div className="text-center">
          <div className="inline-flex items-center space-x-4 text-sm text-gray-500">
            <span className="flex items-center space-x-1">
              <span>⚡</span>
              <span>Powered by Wagmi</span>
            </span>
            <span className="flex items-center space-x-1">
              <span>🔗</span>
              <span>Web3 Ready</span>
            </span>
            <span className="flex items-center space-x-1">
              <span>🛡️</span>
              <span>Secure Connection</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
