const fs = require('fs');
const path = require('path');

function replaceInFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf-8');
    let original = content;

    // INSERT INTO ... VALUES (...) RETURNING *
    // We need to move RETURNING * to become OUTPUT inserted.* before VALUES
    content = content.replace(/INSERT INTO ([a-z_]+) \((.*?)\) VALUES \((.*?)\) RETURNING \*/g, 
        "INSERT INTO $1 ($2) OUTPUT inserted.* VALUES ($3)");
        
    // INSERT INTO ... VALUES (...) RETURNING id, name, ...
    content = content.replace(/INSERT INTO ([a-z_]+) \((.*?)\) VALUES \((.*?)\) RETURNING (.*?)(['"`])/g, 
        (match, table, cols, vals, returning, quote) => {
            if(match.includes('OUTPUT')) return match; // skip if already processed
            let outputCols = returning.trim().split(',').map(c => `inserted.${c.trim()}`).join(', ');
            return `INSERT INTO ${table} (${cols}) OUTPUT ${outputCols} VALUES (${vals})${quote}`;
        });

    // UPDATE ... SET ... WHERE ... RETURNING *
    content = content.replace(/UPDATE ([a-z_]+) SET (.*?) WHERE (.*?) RETURNING \*/g, 
        "UPDATE $1 SET $2 OUTPUT inserted.* WHERE $3");

    // UPDATE ... SET ... WHERE ... RETURNING id, name, ...
    content = content.replace(/UPDATE ([a-z_]+) SET (.*?) WHERE (.*?) RETURNING (.*?)(['"`])/g, 
        (match, table, set, where, returning, quote) => {
            if(match.includes('OUTPUT')) return match;
            let outputCols = returning.trim().split(',').map(c => `inserted.${c.trim()}`).join(', ');
            return `UPDATE ${table} SET ${set} OUTPUT ${outputCols} WHERE ${where}${quote}`;
        });

    // DELETE FROM ... WHERE ... RETURNING *
    content = content.replace(/DELETE FROM ([a-z_]+) WHERE (.*?) RETURNING \*/g, 
        "DELETE FROM $1 OUTPUT deleted.* WHERE $2");

    // DELETE FROM ... WHERE ... RETURNING id, ...
    content = content.replace(/DELETE FROM ([a-z_]+) WHERE (.*?) RETURNING (.*?)(['"`])/g, 
        (match, table, where, returning, quote) => {
            if(match.includes('OUTPUT')) return match;
            let outputCols = returning.trim().split(',').map(c => `deleted.${c.trim()}`).join(', ');
            return `DELETE FROM ${table} OUTPUT ${outputCols} WHERE ${where}${quote}`;
        });

    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf-8');
        console.log(`Fixed RETURNING in ${filePath}`);
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
console.log('Done RETURNING replacement script');
