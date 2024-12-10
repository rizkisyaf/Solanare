import { useEffect, useState } from 'react';

interface TransactionMemoProps {
  signature: string;
}

export function TransactionMemo({ signature }: TransactionMemoProps) {
  const [memoData, setMemoData] = useState<string | null>(null);

  useEffect(() => {
    const fetchMemo = async () => {
      const response = await fetch(`/api/transactions/${signature}`);
      const data = await response.json();
      setMemoData(data.memo);
    };
    
    fetchMemo();
  }, [signature]);

  if (!memoData) return null;

  return (
    <div className="text-sm text-purple-300/70 mt-2">
      <span className="font-medium">Memo:</span> {memoData}
    </div>
  );
} 