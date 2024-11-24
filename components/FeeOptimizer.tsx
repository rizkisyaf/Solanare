import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Line } from 'react-chartjs-2';
import { useConnection } from '@solana/wallet-adapter-react';
import { getPriorityFee } from '@/app/utils/rpc';
import { Connection, PublicKey } from '@solana/web3.js';

interface MempoolStats {
  pendingTxs: number;
  competingTxs: number;
  avgWaitTime: number;
  recentSuccessRate: number;
}

interface DexFees {
  jupiter: number;
  raydium: number;
  orca: number;
  phoenixV1: number;
  openbook: number;
}

interface FeeStats {
  currentStats: {
    avgPriorityFee: number;
    successRate: number;
    avgConfirmTime: number;
    networkLoad: 'Low' | 'Medium' | 'High';
    tps: number;
    mempool: MempoolStats;
  };
  historicalData: {
    time: string;
    priorityFee: number;
    successRate: number;
    confirmTime: number;
  }[];
  recommendations: {
    optimal: number;
    aggressive: number;
    conservative: number;
    dex: DexFees;
  };
}

function StatCard({ title, value, indicator, subtext }: any) {
  return (
    <motion.div 
      whileHover={{ scale: 1.02 }}
      className="bg-black/30 rounded-xl border border-purple-500/20 p-4"
    >
      <h3 className="text-sm text-purple-300/70">{title}</h3>
      <div className="flex items-end gap-2">
        <p className="text-2xl font-bold text-purple-300">{value}</p>
        {indicator && (
          <div className={`h-2 w-2 rounded-full mb-2 ${
            indicator === 'green' ? 'bg-green-500' :
            indicator === 'yellow' ? 'bg-yellow-500' :
            'bg-red-500'
          }`} />
        )}
      </div>
      {subtext && <p className="text-xs text-purple-300/50">{subtext}</p>}
    </motion.div>
  );
}

function RecommendationCard({ type, fee, expectedTime, successRate, className }: any) {
  return (
    <motion.div 
      whileHover={{ scale: 1.02 }}
      className={`bg-black/30 rounded-xl border p-4 ${className}`}
    >
      <div className="flex justify-between items-start mb-3">
        <h3 className="text-purple-300">{type}</h3>
        <span className={`text-xs px-2 py-1 rounded-full ${
          type === 'Conservative' ? 'bg-green-500/20 text-green-300' :
          type === 'Optimal' ? 'bg-yellow-500/20 text-yellow-300' :
          'bg-red-500/20 text-red-300'
        }`}>
          {successRate}
        </span>
      </div>
      <p className="text-2xl font-bold text-purple-300">{fee} μSOL</p>
      <p className="text-sm text-purple-300/70">{expectedTime}</p>
    </motion.div>
  );
}

function FeeChart({ data }: { data: FeeStats['historicalData'] | undefined }) {
  if (!data) return null;

  const chartData = {
    labels: data.map(d => d.time),
    datasets: [{
      label: 'Priority Fee (μSOL)',
      data: data.map(d => d.priorityFee),
      borderColor: 'rgb(147, 51, 234)',
      tension: 0.4,
    }]
  };

  return (
    <Line 
      data={chartData}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
        },
        scales: {
          y: {
            grid: { color: 'rgba(147, 51, 234, 0.1)' },
            ticks: { color: 'rgb(216, 180, 254)' }
          },
          x: {
            grid: { display: false },
            ticks: { color: 'rgb(216, 180, 254)' }
          }
        }
      }}
    />
  );
}

function DexFeeCard({ name, fee, successRate }: { name: string; fee: number; successRate: number }) {
  return (
    <motion.div 
      whileHover={{ scale: 1.02 }}
      className="bg-black/30 rounded-xl border border-purple-500/20 p-4"
    >
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-purple-300">{name}</h3>
        <span className="text-xs text-purple-300/70">{successRate}% success</span>
      </div>
      <p className="text-xl font-bold text-purple-300">{fee} μSOL</p>
    </motion.div>
  );
}

async function getHistoricalSuccess(connection: Connection, priorityFee: number): Promise<number> {
  try {
    // Get recent blocks instead of signatures
    const blocks = await connection.getRecentPerformanceSamples(20);
    const avgSuccessRate = blocks.reduce((acc, block) => {
      const successRate = (block.numTransactions - block.numSlots) / block.numTransactions;
      return acc + (successRate * 100);
    }, 0) / blocks.length;

    return Math.round(avgSuccessRate);
  } catch (error) {
    console.error('Error getting historical success:', error);
    return 95; // Fallback default
  }
}

async function getMempoolStats(connection: Connection): Promise<MempoolStats> {
  try {
    const [slots, recentBlockhash] = await Promise.all([
      connection.getRecentPerformanceSamples(5),
      connection.getLatestBlockhash()
    ]);
    
    const avgTxCount = slots.reduce((acc, slot) => acc + slot.numTransactions, 0) / slots.length;
    const avgSuccessRate = slots.reduce((acc, slot) => {
      return acc + ((slot.numTransactions - slot.numSlots) / slot.numTransactions);
    }, 0) / slots.length * 100;

    return {
      pendingTxs: Math.round(avgTxCount),
      competingTxs: Math.round(avgTxCount * 0.2), // Estimate of competing txs
      avgWaitTime: slots[0].samplePeriodSecs * 1000,
      recentSuccessRate: Math.round(avgSuccessRate)
    };
  } catch (error) {
    console.error('Error getting mempool stats:', error);
    return {
      pendingTxs: 0,
      competingTxs: 0,
      avgWaitTime: 0,
      recentSuccessRate: 0
    };
  }
}

async function getDexFees(connection: Connection): Promise<DexFees> {
  const baseFee = await getPriorityFee(connection);
  
  return {
    jupiter: Math.round(baseFee * 1.2),  // Jupiter typically needs higher
    raydium: Math.round(baseFee * 1.1),
    orca: Math.round(baseFee * 1.15),
    phoenixV1: Math.round(baseFee * 1.05), // Most efficient
    openbook: Math.round(baseFee * 1.1)
  };
}

export function FeeOptimizer() {
  const [feeStats, setFeeStats] = useState<FeeStats | null>(null);
  const { connection } = useConnection();

  useEffect(() => {
    const fetchFeeStats = async () => {
      const priorityFee = await getPriorityFee(connection);
      const recentPerformance = await connection.getRecentPerformanceSamples(1);
      const mempoolStats = await getMempoolStats(connection);
      const dexFees = await getDexFees(connection);
      const successRate = await getHistoricalSuccess(connection, priorityFee);
      
      // Store historical data in state or localStorage
      const newHistoricalData = {
        time: new Date().toISOString(),
        priorityFee,
        successRate,
        confirmTime: mempoolStats.avgWaitTime
      };

      setFeeStats(prev => ({
        currentStats: {
          avgPriorityFee: priorityFee,
          successRate,
          avgConfirmTime: mempoolStats.avgWaitTime,
          networkLoad: priorityFee > 50000 ? 'High' : priorityFee > 20000 ? 'Medium' : 'Low',
          tps: recentPerformance[0]?.numTransactions || 0,
          mempool: mempoolStats
        },
        historicalData: [...(prev?.historicalData || []).slice(-50), newHistoricalData],
        recommendations: {
          conservative: Math.round(priorityFee * 1.5),
          optimal: priorityFee,
          aggressive: Math.round(priorityFee * 0.8),
          dex: dexFees
        }
      }));
    };

    fetchFeeStats();
    const interval = setInterval(fetchFeeStats, 5000);
    return () => clearInterval(interval);
  }, [connection]);

  return (
    <div className="space-y-8 p-6">
      <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-purple-600 bg-clip-text text-transparent">
        Network Fee Monitor
      </h2>
      
      <div className="grid grid-cols-4 gap-4">
        <StatCard 
          title="Network Load"
          value={feeStats?.currentStats.networkLoad || 'Loading'}
          indicator={feeStats?.currentStats.networkLoad === 'High' ? 'red' : 'green'}
        />
        <StatCard 
          title="TPS"
          value={feeStats?.currentStats.tps.toLocaleString() || '0'}
          subtext="Transactions per second"
        />
        <StatCard 
          title="Success Rate"
          value={`${feeStats?.currentStats.successRate || 0}%`}
          indicator={feeStats?.currentStats.successRate && feeStats?.currentStats.successRate > 90 ? 'green' : 'yellow'}
        />
        <StatCard 
          title="Confirm Time"
          value={`${feeStats?.currentStats.avgConfirmTime || 0}ms`}
        />
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatCard 
          title="Pending Txs"
          value={feeStats?.currentStats.mempool.pendingTxs?.toLocaleString() || '0'}
          indicator={feeStats?.currentStats.mempool.pendingTxs && feeStats?.currentStats.mempool.pendingTxs > 1000 ? 'red' : 'green'}
        />
        <StatCard 
          title="Competing Txs"
          value={feeStats?.currentStats.mempool.competingTxs.toLocaleString()}
        />
      </div>

      <div>
        <h3 className="text-xl text-purple-300 mb-4">DEX-Specific Fees</h3>
        <div className="grid grid-cols-5 gap-4">
          {Object.entries(feeStats?.recommendations.dex || {}).map(([name, fee]) => (
            <DexFeeCard 
              key={name}
              name={name}
              fee={fee}
              successRate={95} // You can make this dynamic based on historical data
            />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <RecommendationCard
          type="Conservative"
          fee={feeStats?.recommendations.conservative}
          expectedTime="~2s"
          successRate="99%"
          className="border-green-500/20"
        />
        <RecommendationCard
          type="Optimal"
          fee={feeStats?.recommendations.optimal}
          expectedTime="~1s"
          successRate="95%"
          className="border-yellow-500/20"
        />
        <RecommendationCard
          type="Aggressive"
          fee={feeStats?.recommendations.aggressive}
          expectedTime="~500ms"
          successRate="85%"
          className="border-red-500/20"
        />
      </div>

      <div className="h-64 bg-purple-900/20 rounded-lg p-4">
        <FeeChart data={feeStats?.historicalData} />
      </div>
    </div>
  );
}