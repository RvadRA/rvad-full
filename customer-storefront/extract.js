import fs from 'fs';
import readline from 'readline';

async function extract() {
  const fileStream = fs.createReadStream('C:\\Users\\Abdusomad\\.gemini\\antigravity-ide\\brain\\3ca1b6ff-fdf6-4351-b62d-89196630076b\\.system_generated\\logs\\transcript.jsonl');
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let lastAppContent = null;

  for await (const line of rl) {
    try {
      const obj = JSON.parse(line);
      // Look for view_file tool output or write_to_file tool contents for App.tsx
      if (obj.tool_calls) {
        for (const tc of obj.tool_calls) {
          if (tc.name === 'default_api:view_file' && tc.args && tc.args.AbsolutePath && tc.args.AbsolutePath.includes('App.tsx')) {
            // Check if it returned the full file or parts
            if (obj.output && !obj.output.includes('truncated')) {
              lastAppContent = obj.output;
            }
          }
        }
      }
      
      // Also look for system or system responses that might contain App.tsx content
      if (obj.content && obj.content.includes('File Path:') && obj.content.includes('App.tsx')) {
        // If it's a full print of App.tsx
        const match = obj.content.match(/Showing lines 1 to \d+([\s\S]+)$/);
        if (match && !obj.content.includes('NOT show the entire file contents')) {
          // clean line numbers
          const lines = match[1].split('\n').map(l => {
            const m = l.match(/^\s*\d+:\s(.*)$/);
            return m ? m[1] : l;
          });
          lastAppContent = lines.join('\n');
        }
      }
    } catch (e) {
      // skip invalid json
    }
  }

  if (lastAppContent) {
    fs.writeFileSync('C:\\Users\\Abdusomad\\Desktop\\Rvad full\\customer-storefront\\src\\App.tsx.recovered', lastAppContent);
    console.log('Successfully recovered App.tsx.recovered!');
  } else {
    console.log('Could not find complete App.tsx in logs.');
  }
}

extract();
