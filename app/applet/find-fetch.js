import fs from 'fs';
import path from 'path';

function search(dir) {
  if (dir.includes('.vite')) return;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const full = path.join(dir, file);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      search(full);
    } else if (full.endsWith('.js') || full.endsWith('.mjs') || full.endsWith('.cjs')) {
      const content = fs.readFileSync(full, 'utf8');
      if (content.includes('fetch =') || content.includes('fetch=') || content.includes('.fetch')) {
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes('fetch =') || lines[i].includes('fetch=')) {
            if (lines[i].includes('window') || lines[i].includes('global') || lines[i].includes('self')) {
              console.log(full, ':', lines[i].trim().substring(0, 100));
            }
          }
        }
      }
    }
  }
}

search('node_modules');
