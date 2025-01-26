import { execSync } from 'child_process';
import findProcess from 'find-process';

async function killProcesses() {
  // Kill any processes using port 5173 or 5174 (Vite)
  try {
    const viteProcesses = await findProcess('port', 5173);
    const viteProcesses2 = await findProcess('port', 5174);
    [...viteProcesses, ...viteProcesses2].forEach(proc => {
      console.log(`Killing Vite process ${proc.pid}`);
      process.kill(proc.pid);
    });
  } catch (err) {
    console.log('No Vite processes found');
  }

  // Kill any processes using port 8001 (ChromaDB)
  try {
    const chromaProcesses = await findProcess('port', 8001);
    for (const proc of chromaProcesses) {
      console.log(`Killing ChromaDB process ${proc.pid}`);
      process.kill(proc.pid);
    }
  } catch (err) {
    console.log('No ChromaDB processes found');
  }

  // Give processes time to fully terminate
  await new Promise(resolve => setTimeout(resolve, 1000));
}

// Just kill processes and exit - let npm script handle starting servers
killProcesses().catch(console.error);
