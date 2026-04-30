import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pagesDir = path.join(__dirname, 'src', 'pages');

function processDir(dir) {
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      processDir(fullPath);
    } else if (file.endsWith('.tsx') || file.endsWith('.jsx')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      
      let newContent = content
        .replace(/bg-gray-50/g, 'bg-slate-50')
        .replace(/text-gray-900/g, 'text-slate-900')
        .replace(/text-gray-600/g, 'text-slate-600')
        .replace(/bg-white rounded-lg shadow-md/g, 'glass-card')
        .replace(/hover:bg-gray-50/g, 'hover:bg-slate-50/50 hover:backdrop-blur-sm transition-all');
        
      if (content !== newContent) {
        fs.writeFileSync(fullPath, newContent, 'utf8');
        console.log('Updated: ' + fullPath);
      }
    }
  }
}

processDir(pagesDir);
console.log('Update complete.');
