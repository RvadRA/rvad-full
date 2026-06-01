import fs from 'fs';
import path from 'path';
import readline from 'readline';

const brainDir = 'C:\\Users\\Abdusomad\\.gemini\\antigravity-ide\\brain';

async function scanLogsForApp() {
  const folders = fs.readdirSync(brainDir);
  console.log(`Found ${folders.length} brain folders.`);

  let bestContent = null;
  let bestTime = 0;

  for (const folder of folders) {
    const logPath = path.join(brainDir, folder, '.system_generated', 'logs', 'transcript.jsonl');
    if (!fs.existsSync(logPath)) continue;

    const stats = fs.statSync(logPath);
    console.log(`Scanning ${logPath} (Size: ${stats.size} bytes)...`);

    try {
      const fileStream = fs.createReadStream(logPath);
      const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
      });

      for await (const line of rl) {
        try {
          const obj = JSON.parse(line);
          
          // Look for view_file outputs of App.tsx
          if (obj.tool_calls) {
            for (const tc of obj.tool_calls) {
              if (tc.name === 'default_api:view_file' && tc.args && tc.args.AbsolutePath && tc.args.AbsolutePath.includes('App.tsx')) {
                // If it is a VIEW_FILE output and has no truncation notice, it might be a full read
                if (obj.output && !obj.output.includes('NOT show the entire file contents') && obj.output.includes('Total Lines: 2881')) {
                  const mTime = stats.mtimeMs;
                  if (mTime > bestTime) {
                    bestTime = mTime;
                    bestContent = obj.output;
                    console.log(`Found a potential full App.tsx in ${folder} (modified ${stats.mtime})`);
                  }
                }
              }
            }
          }
          
          // Also look for write_to_file or multi_replace outputs that contain the full file
          if (obj.type === 'WRITE_FILE' && obj.tool_calls) {
            for (const tc of obj.tool_calls) {
              if (tc.name === 'default_api:write_to_file' && tc.args && tc.args.TargetFile && tc.args.TargetFile.includes('App.tsx')) {
                const mTime = stats.mtimeMs;
                if (mTime > bestTime) {
                  bestTime = mTime;
                  bestContent = tc.args.CodeContent;
                  console.log(`Found a full write_to_file App.tsx in ${folder}`);
                }
              }
            }
          }
        } catch (e) {}
      }
    } catch (err) {
      console.error(`Error scanning ${logPath}:`, err.message);
    }
  }

  if (bestContent) {
    // If it has header formatting, clean it up
    let cleanContent = bestContent;
    if (bestContent.includes('The following code has been modified to include a line number')) {
      const lines = bestContent.split('\n');
      const cleanLines = [];
      for (const l of lines) {
        const match = l.match(/^\s*(\d+):\s(.*)$/);
        if (match) {
          cleanLines.push(match[2]);
        }
      }
      if (cleanLines.length > 0) {
        cleanContent = cleanLines.join('\n');
      }
    }
    fs.writeFileSync('C:\\Users\\Abdusomad\\Desktop\\Rvad full\\customer-storefront\\src\\App.tsx.recovered_global', cleanContent);
    console.log('Successfully wrote recovered file to App.tsx.recovered_global');
  } else {
    console.log('Could not find any complete App.tsx in any conversation logs.');
  }
}

scanLogsForApp();
