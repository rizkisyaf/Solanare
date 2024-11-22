const RATE_LIMIT = 5; // 5 TPS
const queue: (() => Promise<any>)[] = [];
let processing = false;

export async function rateLimit<T>(operation: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    queue.push(async () => {
      try {
        const result = await operation();
        resolve(result);
      } catch (error) {
        reject(error);
      }
    });
    
    if (!processing) {
      processQueue();
    }
  });
}

async function processQueue() {
  if (queue.length === 0) {
    processing = false;
    return;
  }

  processing = true;
  const operation = queue.shift();
  
  if (operation) {
    await operation();
    await new Promise(resolve => setTimeout(resolve, 1000 / RATE_LIMIT));
    await processQueue();
  }
} 