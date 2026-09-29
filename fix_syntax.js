const fs = require('fs');
const path = require('path');

function replaceInFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf-8');
    let original = content;

    // 1. SELECT key, value FROM settings -> SELECT [key], value FROM settings
    content = content.replace(/SELECT key, value FROM settings/g, 'SELECT [key], value FROM settings');

    // 2. LIMIT ... OFFSET ...
    // e.g. LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
    // SQL Server: OFFSET $${...} ROWS FETCH NEXT $${...} ROWS ONLY
    content = content.replace(/LIMIT\s+\$\$\{(.*?)\}\s+OFFSET\s+\$\$\{(.*?)\}/g, 'OFFSET $${$2} ROWS FETCH NEXT $${$1} ROWS ONLY');
    
    // LIMIT $x OFFSET $y
    content = content.replace(/LIMIT\s+\$(\d+)\s+OFFSET\s+\$(\d+)/g, 'OFFSET $$2 ROWS FETCH NEXT $$1 ROWS ONLY');

    // 3. LIMIT 1 (when it has ORDER BY before it)
    content = content.replace(/ORDER BY\s+(.*?)\s+LIMIT 1/g, 'ORDER BY $1 OFFSET 0 ROWS FETCH NEXT 1 ROWS ONLY');
    content = content.replace(/LIMIT 1/g, 'OFFSET 0 ROWS FETCH NEXT 1 ROWS ONLY'); // Generic fallback if order by is on previous line
    
    // ON CONFLICT (key) DO UPDATE SET value = $1 
    content = content.replace(/INSERT INTO settings \(key, value\) VALUES \('([^']+)',\s*\$(\d+)\)\s*ON CONFLICT \(key\) DO UPDATE SET value = \$\d+/g, 
      "IF EXISTS (SELECT 1 FROM settings WHERE [key] = '$1') UPDATE settings SET value = $$2 WHERE [key] = '$1' ELSE INSERT INTO settings ([key], value) VALUES ('$1', $$2)");
      
    // DELETE FROM settings WHERE key = '...'
    content = content.replace(/DELETE FROM settings WHERE key = /g, "DELETE FROM settings WHERE [key] = ");
    
    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf-8');
        console.log(`Updated ${filePath}`);
    }
}

function traverseDir(dir) {
    fs.readdirSync(dir).forEach(file => {
        let fullPath = path.join(dir, file);
        if (fs.lstatSync(fullPath).isDirectory()) {
            traverseDir(fullPath);
        } else if (fullPath.endsWith('.js')) {
            replaceInFile(fullPath);
        }
    });
}

traverseDir(path.join(__dirname, 'src'));
console.log('Done replacement script');
