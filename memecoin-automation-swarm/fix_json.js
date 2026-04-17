const fs = require('fs');
const content = JSON.parse(fs.readFileSync('.claude/mcp.json', 'utf8'));

const servers = content.mcpServers || {};

for (const key in content) {
    if (key !== 'mcpServers') {
        servers[key] = content[key];
        delete content[key];
    }
}

content.mcpServers = servers;
fs.writeFileSync('.claude/mcp.json', JSON.stringify(content, null, 2));
