import fs from 'fs';
import readline from 'readline';

async function scan() {
  const fileStream = fs.createReadStream('C:\\Users\\Abdusomad\\.gemini\\antigravity-ide\\brain\\3ca1b6ff-fdf6-4351-b62d-89196630076b\\.system_generated\\logs\\transcript.jsonl');
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let index = 0;
  for await (const line of rl) {
    try {
      const obj = JSON.parse(line);
      if (line.includes('customer-storefront/src/App.tsx') || line.includes('customer-storefront\\src\\App.tsx')) {
        console.log(`Line ${index}: Type=${obj.type}, Status=${obj.status}`);
        if (obj.tool_calls) {
          for (const tc of obj.tool_calls) {
            console.log(`  Tool: ${tc.name}`);
          }
        }
      }
    } catch (e) {}
    index++;
  }
}

scan();
