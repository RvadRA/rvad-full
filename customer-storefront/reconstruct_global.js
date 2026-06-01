import fs from 'fs';
import path from 'path';
import readline from 'readline';

const brainDir = 'C:\\Users\\Abdusomad\\.gemini\\antigravity-ide\\brain';

async function rebuildFromAllLogs() {
  const folders = fs.readdirSync(brainDir);
  const fileLinesMap = new Map(); // line number -> content

  for (const folder of folders) {
    const logPath = path.join(brainDir, folder, '.system_generated', 'logs', 'transcript.jsonl');
    if (!fs.existsSync(logPath)) continue;

    console.log(`Scanning ${logPath}...`);
    try {
      const fileStream = fs.createReadStream(logPath);
      const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
      });

      for await (const line of rl) {
        try {
          const obj = JSON.parse(line);
          
          // View file output
          if (obj.type === 'VIEW_FILE' && obj.status === 'DONE' && obj.content) {
            if (obj.content.includes('customer-storefront/src/App.tsx') || obj.content.includes('customer-storefront\\src\\App.tsx')) {
              const rawLines = obj.content.split('\n');
              for (const rl of rawLines) {
                const match = rl.match(/^\s*(\d+):\s(.*)$/);
                if (match) {
                  fileLinesMap.set(parseInt(match[1], 10), match[2]);
                }
              }
            }
          }

          // Tool calls
          if (obj.tool_calls) {
            for (const tc of obj.tool_calls) {
              if (tc.name === 'default_api:view_file' && tc.args && tc.args.AbsolutePath && tc.args.AbsolutePath.includes('App.tsx')) {
                if (obj.output) {
                  const rawLines = obj.output.split('\n');
                  for (const rl of rawLines) {
                    const match = rl.match(/^\s*(\d+):\s(.*)$/);
                    if (match) {
                      fileLinesMap.set(parseInt(match[1], 10), match[2]);
                    }
                  }
                }
              }
            }
          }
        } catch (e) {}
      }
    } catch (err) {
      console.error(`Error:`, err.message);
    }
  }

  const sortedLineNums = Array.from(fileLinesMap.keys()).sort((a, b) => a - b);
  console.log(`Gathered ${sortedLineNums.length} unique lines of App.tsx.`);
  
  if (sortedLineNums.length > 0) {
    const maxLine = sortedLineNums[sortedLineNums.length - 1];
    const finalLines = [];
    let missingCount = 0;
    for (let i = 1; i <= maxLine; i++) {
      if (fileLinesMap.has(i)) {
        finalLines.push(fileLinesMap.get(i));
      } else {
        missingCount++;
        finalLines.push('');
      }
    }
    console.log(`Missing ${missingCount} lines in total.`);
    fs.writeFileSync('C:\\Users\\Abdusomad\\Desktop\\Rvad full\\customer-storefront\\src\\App.tsx.rebuilt_global', finalLines.join('\n'));
    console.log('Successfully wrote App.tsx.rebuilt_global!');
  }
}

rebuildFromAllLogs();
