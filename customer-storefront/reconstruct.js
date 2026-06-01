import fs from 'fs';
import readline from 'readline';

async function reconstruct() {
  const fileStream = fs.createReadStream('C:\\Users\\Abdusomad\\.gemini\\antigravity-ide\\brain\\3ca1b6ff-fdf6-4351-b62d-89196630076b\\.system_generated\\logs\\transcript.jsonl');
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  const fileLinesMap = new Map(); // line number -> content

  for await (const line of rl) {
    try {
      const obj = JSON.parse(line);
      
      // If it is a VIEW_FILE step and successful
      if (obj.type === 'VIEW_FILE' && obj.status === 'DONE' && obj.content) {
        // Let's check if this content is from App.tsx
        if (obj.content.includes('customer-storefront/src/App.tsx') || obj.content.includes('customer-storefront\\src\\App.tsx') || obj.content.includes('customer-storefront/src/App.tsx')) {
          // Parse lines
          const rawLines = obj.content.split('\n');
          for (const rl of rawLines) {
            const match = rl.match(/^\s*(\d+):\s(.*)$/);
            if (match) {
              const lineNum = parseInt(match[1], 10);
              const content = match[2];
              fileLinesMap.set(lineNum, content);
            }
          }
        }
      }

      // If it is a tool output of view_file
      if (obj.tool_calls) {
        for (const tc of obj.tool_calls) {
          if (tc.name === 'default_api:view_file' && tc.args && tc.args.AbsolutePath && tc.args.AbsolutePath.includes('App.tsx')) {
            if (obj.output) {
              const rawLines = obj.output.split('\n');
              for (const rl of rawLines) {
                const match = rl.match(/^\s*(\d+):\s(.*)$/);
                if (match) {
                  const lineNum = parseInt(match[1], 10);
                  const content = match[2];
                  fileLinesMap.set(lineNum, content);
                }
              }
            }
          }
        }
      }
    } catch (e) {
      // skip
    }
  }

  // Sort and write the lines
  const sortedLineNums = Array.from(fileLinesMap.keys()).sort((a, b) => a - b);
  console.log(`Gathered ${sortedLineNums.length} unique lines of App.tsx.`);
  
  if (sortedLineNums.length > 0) {
    // Fill in any gaps with empty string or warning
    const maxLine = sortedLineNums[sortedLineNums.length - 1];
    const finalLines = [];
    for (let i = 1; i <= maxLine; i++) {
      if (fileLinesMap.has(i)) {
        finalLines.push(fileLinesMap.get(i));
      } else {
        console.warn(`Missing line ${i}!`);
        finalLines.push('');
      }
    }
    fs.writeFileSync('C:\\Users\\Abdusomad\\Desktop\\Rvad full\\customer-storefront\\src\\App.tsx.rebuilt', finalLines.join('\n'));
    console.log('Successfully wrote App.tsx.rebuilt!');
  } else {
    console.log('Could not find any App.tsx lines in logs.');
  }
}

reconstruct();
