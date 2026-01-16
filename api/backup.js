#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

async function backupData() {
    try {
        const backupDir = path.join(__dirname, '..', 'backups');
        await fs.mkdir(backupDir, { recursive: true });
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupId = uuidv4().slice(0, 8);
        const backupFile = path.join(backupDir, `backup-${timestamp}-${backupId}.json`);
        
        const dataFiles = ['requests.json', 'houses.json', 'lands.json', 'advertisements.json'];
        const backupData = {
            meta: {
                id: backupId,
                timestamp: new Date().toISOString(),
                version: require('../package.json').version,
                createdBy: 'backup-script'
            },
            data: {}
        };
        
        for (const file of dataFiles) {
            try {
                const filePath = path.join(__dirname, '..', 'data', file);
                const data = await fs.readFile(filePath, 'utf8');
                backupData.data[file.replace('.json', '')] = JSON.parse(data);
                console.log(`✅ ${file} پێشکەوت`);
            } catch (error) {
                console.error(`❌ هەڵە لە خوێندنەوەی ${file}:`, error.message);
                backupData.data[file.replace('.json', '')] = [];
            }
        }
        
        await fs.writeFile(
            backupFile,
            JSON.stringify(backupData, null, 2),
            'utf8'
        );
        
        console.log(`💾 پاشەکەوت دروستکرا: ${backupFile}`);
        
        // سڕینەوەی پاشەکەوتە کۆنەکان
        const files = await fs.readdir(backupDir);
        const backupFiles = files.filter(f => f.startsWith('backup-') && f.endsWith('.json'));
        
        if (backupFiles.length > 30) {
            backupFiles.sort();
            const filesToDelete = backupFiles.slice(0, backupFiles.length - 30);
            
            for (const file of filesToDelete) {
                await fs.unlink(path.join(backupDir, file));
                console.log(`🗑️  پاشەکەوتی کۆن سڕایەوە: ${file}`);
            }
        }
        
        return backupFile;
    } catch (error) {
        console.error('🔥 هەڵە لە پاشەکەوت:', error);
        throw error;
    }
}

// ئەگەر فایلەکە ڕاستەوخۆ بانگێشت بکرێت
if (require.main === module) {
    backupData().then(() => {
        console.log('✨ پاشەکەوت تەواو بوو');
        process.exit(0);
    }).catch(error => {
        console.error('🔥 پاشەکەوت شکستی هێنا:', error);
        process.exit(1);
    });
}

module.exports = backupData;