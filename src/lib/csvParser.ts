import { Transaction } from '@/types/transaction';

export function parseCSV(csvText: string): Transaction[] {
  const lines = csvText.trim().split('\n');
  const headers = lines[0].split(',');
  
  const transactions: Transaction[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length !== headers.length) continue;
    
    const tx: Transaction = {
      Record: parseInt(values[0]) || 0,
      TxHash: values[1],
      Block: parseInt(values[2]) || 0,
      From: values[3].toLowerCase(),
      To: values[4].toLowerCase(),
      Value_ETH: parseFloat(values[5]) || 0,
      TxFee: parseFloat(values[6]) || 0,
      Age_seconds: parseInt(values[7]) || 0,
      From_is_address: values[8].toLowerCase() === 'true',
      To_is_address: values[9].toLowerCase() === 'true',
      To_entity_type: values[10],
      From_entity_type: values[11],
      Fee_to_Value: parseFloat(values[12]) || 0,
      Value_Wei: values[13],
      From_tx_count: parseInt(values[14]) || 0,
      To_tx_count: parseInt(values[15]) || 0,
    };
    
    transactions.push(tx);
  }
  
  return transactions;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}
