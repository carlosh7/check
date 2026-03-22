const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'script.js');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Fix loadGroups (line ~352)
content = content.replace(
    /const groups = await this\.fetchAPI\('\/groups'\);\s+const users = await this\.fetchAPI\('\/users'\);/,
    `const groups = await this.fetchAPI('/groups');
            const users = await this.fetchAPI('/users');
            if (!Array.isArray(groups) || !Array.isArray(users)) return;`
);

// 2. Fix openEventUsers (line ~456)
content = content.replace(
    /const users = await this\.fetchAPI\('\/users'\);\s+const assignedUserIds/,
    `const users = await this.fetchAPI('/users');
        if (!Array.isArray(users)) return;
        const assignedUserIds`
);

// 3. Fix loadAdminDashboard (line ~571)
content = content.replace(
    /const users = await this\.fetchAPI\('\/users'\);\s+const pending = users\.filter/,
    `const users = await this.fetchAPI('/users');
        if (!Array.isArray(users)) return;
        const pending = users.filter`
);

// extra fix: add generic Array check for any fetchAPI result that is mapped/filtered
// This is more complex, but these 3 are the ones causing issues now.

fs.writeFileSync(filePath, content, 'utf8');
console.log('✓ script.js robustecido.');
