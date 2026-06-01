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
      if (line.includes('customer-storefront/src/App.tsx') && obj.type === 'PLANNER_RESPONSE' && obj.tool_calls) {
        for (const tc of obj.tool_calls) {
          if (tc.name === 'default_api:multi_replace_file_content' || tc.name === 'default_api:replace_file_content') {
            console.log(`Line ${index}: Tool=${tc.name}`);
            if (tc.args && tc.args.ReplacementContent) {
              console.log(`  Length of replacement: ${tc.args.ReplacementContent.length}`);
            }
            if (tc.args && tc.args.ReplacementChunks) {
              console.log(`  Chunks: ${tc.args.ReplacementChunks.length}`);
              tc.args.ReplacementChunks.forEach((c, i) => {
                console.log(`    Chunk ${i}: Target length=${c.TargetContent ? c.TargetContent.length : 0}, Replacement length=${c.ReplacementContent ? c.ReplacementContent.length : 0}`);
              });
            }
          }
        }
      }
    } catch (e) {}
    index++;
  }
}

scan();
