require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');

// دروستکردنی فۆڵدەرەکان ئەگەر بوونیان نەبوو
async function ensureDirectories() {
    const dirs = ['data', 'uploads'];
    for (const dir of dirs) {
        try {
            await fs.mkdir(dir, { recursive: true });
            console.log(`✅ فۆڵدەر دروستکرا: ${dir}`);
        } catch (error) {
            console.error(`❌ هەڵە لە دروستکردنی فۆڵدەر ${dir}:`, error);
        }
    }
}

// فایلەکانی داتا دروست بکە ئەگەر بوونیان نەبوو
async function initializeDataFiles() {
    const files = [
        { 
            name: 'data/requests.json', 
            defaultData: [
                {
                    "id": "1",
                    "name": "نمونە",
                    "mobile": "٠٧٧٠ ١١١ ٢٢٢٢",
                    "type": "فرۆشتنی خانوو",
                    "location": "شۆرش",
                    "size": "150 م²",
                    "price": "١٠٠,٠٠٠,٠٠٠ دینار",
                    "saleType": "تاپۆ",
                    "status": "new",
                    "createdAt": new Date().toISOString(),
                    "viewed": false,
                    "processed": false
                }
            ] 
        },
        { 
            name: 'data/houses.json', 
            defaultData: [
                {
                    "id": "1",
                    "owner": "نمونە",
                    "mobile": "٠٧٧٠ ١١١ ٢٢٢٢",
                    "location": "شۆرش",
                    "type": "تاپۆ",
                    "size": "150 م²",
                    "price": "١٠٠,٠٠٠,٠٠٠ دینار",
                    "status": "available",
                    "requestId": "1",
                    "createdAt": new Date().toISOString()
                }
            ] 
        },
        { 
            name: 'data/lands.json', 
            defaultData: [
                {
                    "id": "1",
                    "owner": "نمونە",
                    "mobile": "٠٧٧٠ ٢٢٢ ٣٣٣٣",
                    "location": "کوێستان",
                    "size": "500 م²",
                    "price": "٥٠,٠٠٠,٠٠٠ دینار",
                    "status": "available",
                    "requestId": "2",
                    "createdAt": new Date().toISOString()
                }
            ] 
        },
        { 
            name: 'data/advertisements.json', 
            defaultData: [
                {
                    "id": "1",
                    "title": "رێکلامی نمونە",
                    "description": "ئەمە رێکلامێکی نمونەیە بۆ تێستکردن",
                    "image": null,
                    "link": "https://example.com",
                    "status": "active",
                    "createdAt": new Date().toISOString(),
                    "updatedAt": new Date().toISOString(),
                    "views": 0,
                    "clicks": 0
                }
            ] 
        }
    ];

    for (const file of files) {
        try {
            await fs.access(file.name);
            console.log(`✅ فایل بوونی هەیە: ${file.name}`);
        } catch {
            await fs.writeFile(file.name, JSON.stringify(file.defaultData, null, 2), 'utf8');
            console.log(`📁 فایل دروستکرا: ${file.name}`);
        }
    }
}

// فەنکشنی یارمەتی بۆ خوێندنەوە و نووسینی داتا
async function readData(fileName) {
    try {
        const data = await fs.readFile(`data/${fileName}`, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error(`❌ هەڵە لە خوێندنەوەی ${fileName}:`, error);
        // ئەگەر فایلەکە بوونی نەبوو، دروستی بکە
        const defaultFiles = {
            'requests.json': [],
            'houses.json': [],
            'lands.json': [],
            'advertisements.json': []
        };
        if (defaultFiles[fileName]) {
            await fs.writeFile(`data/${fileName}`, JSON.stringify(defaultFiles[fileName], null, 2), 'utf8');
            return defaultFiles[fileName];
        }
        return [];
    }
}

async function writeData(fileName, data) {
    try {
        await fs.writeFile(`data/${fileName}`, JSON.stringify(data, null, 2), 'utf8');
        return true;
    } catch (error) {
        console.error(`❌ هەڵە لە نووسینی ${fileName}:`, error);
        return false;
    }
}

// سێرڤەری Express
const app = express();
const PORT = process.env.PORT || 3001;

// CORS ڕێکخستن بۆ هەردوو دۆمەینەکە
const allowedOrigins = [
    'https://dawakrdn.vercel.app',      // سیستەمی ناردنی داواکاری
    'https://systamwargrtn.vercel.app', // سیستەمی وەرگرتنی داواکاری
    'http://localhost:3000',            // بۆ تێستکردن لە ناوخۆ
    'http://localhost:5173'             // بۆ تێستکردن لە ناوخۆ
];

const corsOptions = {
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            console.warn(`🔒 CORS ڕێگەپێنەدراو: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    credentials: true,
    optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// مەلتیەر بۆ وێنە ئەپلۆدکردن
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
        cb(null, uniqueName);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('تەنها وێنە پەسەند کراوە (jpeg, jpg, png, gif, webp)'));
        }
    }
});

// Middleware بۆ لاگکردن
app.use((req, res, next) => {
    console.log(`📝 ${new Date().toISOString()} - ${req.method} ${req.url} - ${req.ip}`);
    next();
});

// Middleware بۆ چەککردنی JSON
app.use((req, res, next) => {
    if (req.method === 'POST' || req.method === 'PUT') {
        if (!req.is('application/json')) {
            return res.status(400).json({ 
                success: false,
                error: 'Content-Type پێویستە بێت application/json' 
            });
        }
    }
    next();
});

// ڕێگاکانی API

// 1. چەکی تەندروستی
app.get('/api/health', (req, res) => {
    res.json({ 
        success: true,
        status: 'healthy',
        service: 'سیستەمی داواکاری API',
        version: '2.0.0',
        timestamp: new Date().toISOString(),
        dataPath: path.join(__dirname, 'data'),
        endpoints: {
            requests: '/api/requests',
            advertisements: '/api/advertisements',
            houses: '/api/houses',
            lands: '/api/lands'
        },
        allowedOrigins: allowedOrigins
    });
});

// 2. وەرگرتنی هەموو داواکاریەکان
app.get('/api/requests', async (req, res) => {
    try {
        const requests = await readData('requests.json');
        
        // فیلتەرکردن بەپێی دۆخ ئەگەر بەکارهێنەر دەیەوێت
        const { status, type } = req.query;
        let filteredRequests = [...requests];
        
        if (status) {
            filteredRequests = filteredRequests.filter(req => req.status === status);
        }
        
        if (type) {
            filteredRequests = filteredRequests.filter(req => req.type === type);
        }
        
        // ڕێزبەندی بەپێی کەوتن (نوێترین لەسەرەوە)
        filteredRequests.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        res.json({
            success: true,
            count: filteredRequests.length,
            total: requests.length,
            data: filteredRequests
        });
    } catch (error) {
        console.error('❌ هەڵە لە وەرگرتنی داواکاریەکان:', error);
        res.status(500).json({ 
            success: false,
            error: 'هەڵە لە وەرگرتنی داواکاریەکان',
            message: error.message 
        });
    }
});

// 3. ناردنی داواکاریێکی نوێ
app.post('/api/requests', async (req, res) => {
    try {
        const requestData = req.body;
        
        // چەککردنی داتاکان
        const requiredFields = ['name', 'mobile', 'type'];
        const missingFields = requiredFields.filter(field => !requestData[field]);
        
        if (missingFields.length > 0) {
            return res.status(400).json({ 
                success: false,
                error: 'خانەکان پێویستە پڕ بکرێنەوە',
                missingFields: missingFields
            });
        }
        
        // چەککردنی ژمارەی مۆبایل
        const mobileRegex = /^[٠-٩٠-٩\s\-]+$/;
        if (!mobileRegex.test(requestData.mobile)) {
            return res.status(400).json({ 
                success: false,
                error: 'ژمارەی مۆبایل نادروستە'
            });
        }
        
        const requests = await readData('requests.json');
        
        const newRequest = {
            id: uuidv4(),
            name: requestData.name,
            mobile: requestData.mobile,
            type: requestData.type,
            location: requestData.location || '',
            size: requestData.size || '',
            price: requestData.price || '',
            saleType: requestData.saleType || '',
            additionalInfo: requestData.additionalInfo || '',
            status: 'new',
            createdAt: new Date().toISOString(),
            viewed: false,
            processed: false,
            notes: ''
        };
        
        // زیادکردن بۆ سەرەوە (نوێترین لەسەرەوە)
        requests.unshift(newRequest);
        
        const writeSuccess = await writeData('requests.json', requests);
        
        if (!writeSuccess) {
            throw new Error('نەتوانرا داتاکان پاشەکەوت بکرێت');
        }
        
        console.log(`✅ داواکاری نوێ: ${newRequest.name} - ${newRequest.type} - ${newRequest.mobile}`);
        
        res.status(201).json({
            success: true,
            message: 'داواکاریەکەت بە سەرکەوتویی نێردرا',
            requestId: newRequest.id,
            data: newRequest
        });
    } catch (error) {
        console.error('❌ هەڵە لە ناردنی داواکاری:', error);
        res.status(500).json({ 
            success: false,
            error: 'هەڵە لە ناردنی داواکاری',
            message: error.message 
        });
    }
});

// 4. وەرگرتنی داواکاریێکی تایبەت
app.get('/api/requests/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const requests = await readData('requests.json');
        const request = requests.find(req => req.id === id);
        
        if (!request) {
            return res.status(404).json({ 
                success: false,
                error: 'داواکاری نەدۆزرایەوە' 
            });
        }
        
        // نیشانەکردنی وەک بینراو
        if (!request.viewed) {
            const requestIndex = requests.findIndex(req => req.id === id);
            requests[requestIndex].viewed = true;
            requests[requestIndex].viewedAt = new Date().toISOString();
            await writeData('requests.json', requests);
        }
        
        res.json({
            success: true,
            data: request
        });
    } catch (error) {
        console.error('❌ هەڵە لە وەرگرتنی داواکاری:', error);
        res.status(500).json({ 
            success: false,
            error: 'هەڵە لە وەرگرتنی داواکاری',
            message: error.message 
        });
    }
});

// 5. نوێکردنەوەی دۆخی داواکاری (وەرگرتن یان ڕەتکردنەوە)
app.put('/api/requests/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { status, notes } = req.body;
        
        if (!status || !['accepted', 'rejected', 'processing'].includes(status)) {
            return res.status(400).json({ 
                success: false,
                error: 'دۆخی ڕەوا پێویستە (accepted, rejected, processing)' 
            });
        }
        
        const requests = await readData('requests.json');
        const requestIndex = requests.findIndex(req => req.id === id);
        
        if (requestIndex === -1) {
            return res.status(404).json({ 
                success: false,
                error: 'داواکاری نەدۆزرایەوە' 
            });
        }
        
        // پاراستنی داتای کۆن
        const oldRequest = { ...requests[requestIndex] };
        
        // نوێکردنەوەی دۆخ
        requests[requestIndex].status = status;
        requests[requestIndex].updatedAt = new Date().toISOString();
        requests[requestIndex].processed = true;
        
        if (notes) {
            requests[requestIndex].notes = notes;
        }
        
        // ئەگەر دۆخ وەرگیرتن بێت، بیکە بۆ لیستی خانوو یان زەوی
        if (status === 'accepted') {
            const request = requests[requestIndex];
            
            if (request.type === 'فرۆشتنی خانوو') {
                const houses = await readData('houses.json');
                
                const newHouse = {
                    id: uuidv4(),
                    owner: request.name,
                    mobile: request.mobile,
                    location: request.location,
                    type: request.saleType || 'تاپۆ',
                    size: request.size,
                    price: request.price,
                    status: 'available',
                    requestId: request.id,
                    notes: request.notes || '',
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
                
                houses.unshift(newHouse);
                await writeData('houses.json', houses);
                
                console.log(`🏠 خانووی نوێ زیادکرا: ${newHouse.owner} - ${newHouse.location}`);
            }
            
            if (request.type === 'فرۆشتنی زەوی') {
                const lands = await readData('lands.json');
                
                const newLand = {
                    id: uuidv4(),
                    owner: request.name,
                    mobile: request.mobile,
                    location: request.location,
                    size: request.size,
                    price: request.price,
                    status: 'available',
                    requestId: request.id,
                    notes: request.notes || '',
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
                
                lands.unshift(newLand);
                await writeData('lands.json', lands);
                
                console.log(`🌳 زەوی نوێ زیادکرا: ${newLand.owner} - ${newLand.location}`);
            }
        }
        
        // ئەگەر دۆخ ڕەتکردنەوە بێت، داتاکە پارێزراو دەمێنێتەوە لە requests.json
        // بەڵام دۆخی دەگۆڕێت بۆ rejected
        
        const writeSuccess = await writeData('requests.json', requests);
        
        if (!writeSuccess) {
            throw new Error('نەتوانرا داتاکان پاشەکەوت بکرێت');
        }
        
        console.log(`🔄 دۆخی داواکاری نوێکرا: ${id} -> ${status}`);
        
        res.json({
            success: true,
            message: `داواکاری ${status === 'accepted' ? 'وەرگیرا' : status === 'rejected' ? 'ڕەتکرایەوە' : 'لە کاردایە'}`,
            oldStatus: oldRequest.status,
            newStatus: status,
            data: requests[requestIndex]
        });
    } catch (error) {
        console.error('❌ هەڵە لە نوێکردنەوەی دۆخی داواکاری:', error);
        res.status(500).json({ 
            success: false,
            error: 'هەڵە لە نوێکردنەوەی دۆخ',
            message: error.message 
        });
    }
});

// 6. سڕینەوەی داواکاری (تەنها لەسەر ئارەزووی بەڕێوەبەر)
app.delete('/api/requests/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // چەککردنی هێدەری تایبەت بۆ سڕینەوە (لە وێنەیەکی ڕاستەقینەدا API_KEY بەکاربهێنە)
        const adminToken = req.headers['x-admin-token'];
        if (!adminToken || adminToken !== process.env.ADMIN_TOKEN) {
            return res.status(403).json({ 
                success: false,
                error: 'مۆڵەتی نەکراوە بۆ سڕینەوەی داواکاری' 
            });
        }
        
        const requests = await readData('requests.json');
        const requestIndex = requests.findIndex(req => req.id === id);
        
        if (requestIndex === -1) {
            return res.status(404).json({ 
                success: false,
                error: 'داواکاری نەدۆزرایەوە' 
            });
        }
        
        // پاراستنی کۆپیێک پێش سڕینەوە (لۆگکردن)
        const deletedRequest = requests[requestIndex];
        
        // سڕینەوە
        requests.splice(requestIndex, 1);
        
        const writeSuccess = await writeData('requests.json', requests);
        
        if (!writeSuccess) {
            throw new Error('نەتوانرا داتاکان پاشەکەوت بکرێت');
        }
        
        console.log(`🗑️ داواکاری سڕایەوە: ${deletedRequest.id} - ${deletedRequest.name}`);
        
        res.json({
            success: true,
            message: 'داواکاری بە سەرکەوتویی سڕایەوە',
            deletedRequest: deletedRequest
        });
    } catch (error) {
        console.error('❌ هەڵە لە سڕینەوەی داواکاری:', error);
        res.status(500).json({ 
            success: false,
            error: 'هەڵە لە سڕینەوەی داواکاری',
            message: error.message 
        });
    }
});

// 7. وەرگرتنی ئاماری داواکاریەکان
app.get('/api/requests/stats/counts', async (req, res) => {
    try {
        const requests = await readData('requests.json');
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const stats = {
            total: requests.length,
            new: requests.filter(req => req.status === 'new').length,
            processing: requests.filter(req => req.status === 'processing').length,
            accepted: requests.filter(req => req.status === 'accepted').length,
            rejected: requests.filter(req => req.status === 'rejected').length,
            houses: requests.filter(req => req.type === 'فرۆشتنی خانوو').length,
            lands: requests.filter(req => req.type === 'فرۆشتنی زەوی').length,
            today: requests.filter(req => {
                const reqDate = new Date(req.createdAt);
                return reqDate >= today;
            }).length,
            viewed: requests.filter(req => req.viewed).length,
            unviewed: requests.filter(req => !req.viewed).length
        };
        
        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('❌ هەڵە لە وەرگرتنی ئامارەکان:', error);
        res.status(500).json({ 
            success: false,
            error: 'هەڵە لە وەرگرتنی ئامارەکان',
            message: error.message 
        });
    }
});

// 8. وەرگرتنی هەموو رێکلامەکان
app.get('/api/advertisements', async (req, res) => {
    try {
        const ads = await readData('advertisements.json');
        
        // فیلتەرکردن بەپێی دۆخ ئەگەر بەکارهێنەر دەیەوێت
        const { status } = req.query;
        let filteredAds = [...ads];
        
        if (status) {
            filteredAds = filteredAds.filter(ad => ad.status === status);
        } else {
            // بە پێگەیشتن، تەنها چالاکەکان پیشان بدە
            filteredAds = filteredAds.filter(ad => ad.status === 'active');
        }
        
        // ڕێزبەندی بەپێی کەوتن
        filteredAds.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        res.json({
            success: true,
            count: filteredAds.length,
            total: ads.length,
            data: filteredAds
        });
    } catch (error) {
        console.error('❌ هەڵە لە وەرگرتنی رێکلامەکان:', error);
        res.status(500).json({ 
            success: false,
            error: 'هەڵە لە وەرگرتنی رێکلامەکان',
            message: error.message 
        });
    }
});

// 9. ناردنی رێکلامێکی نوێ
app.post('/api/advertisements', upload.single('image'), async (req, res) => {
    try {
        const { title, description, link, status = 'active' } = req.body;
        
        if (!title || title.trim().length < 3) {
            return res.status(400).json({ 
                success: false,
                error: 'سەردێری رێکلام پێویستە (کەمتر لە ٣ پیت نەبێت)' 
            });
        }
        
        const ads = await readData('advertisements.json');
        
        const newAd = {
            id: uuidv4(),
            title: title.trim(),
            description: description ? description.trim() : '',
            image: req.file ? `/uploads/${req.file.filename}` : null,
            link: link ? link.trim() : null,
            status: status,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            views: 0,
            clicks: 0
        };
        
        ads.unshift(newAd);
        
        const writeSuccess = await writeData('advertisements.json', ads);
        
        if (!writeSuccess) {
            throw new Error('نەتوانرا داتاکان پاشەکەوت بکرێت');
        }
        
        console.log(`📢 رێکلامی نوێ: ${newAd.title} - ${newAd.id}`);
        
        res.status(201).json({
            success: true,
            message: 'رێکلام بە سەرکەوتویی نێردرا',
            data: newAd
        });
    } catch (error) {
        console.error('❌ هەڵە لە ناردنی رێکلام:', error);
        
        if (error instanceof multer.MulterError) {
            if (error.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ 
                    success: false,
                    error: 'قەبارەی فایل زۆر گەورەیە (کەمتر لە 5MB)' 
                });
            }
        }
        
        res.status(500).json({ 
            success: false,
            error: error.message || 'هەڵە لە ناردنی رێکلام',
            message: error.message 
        });
    }
});

// 10. وەرگرتنی رێکلامێکی تایبەت
app.get('/api/advertisements/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const ads = await readData('advertisements.json');
        const adIndex = ads.findIndex(a => a.id === id);
        
        if (adIndex === -1) {
            return res.status(404).json({ 
                success: false,
                error: 'رێکلام نەدۆزرایەوە' 
            });
        }
        
        // زیادکردنی بینا
        ads[adIndex].views = (ads[adIndex].views || 0) + 1;
        ads[adIndex].updatedAt = new Date().toISOString();
        await writeData('advertisements.json', ads);
        
        res.json({
            success: true,
            data: ads[adIndex]
        });
    } catch (error) {
        console.error('❌ هەڵە لە وەرگرتنی رێکلام:', error);
        res.status(500).json({ 
            success: false,
            error: 'هەڵە لە وەرگرتنی رێکلام',
            message: error.message 
        });
    }
});

// 11. نوێکردنەوەی دۆخی رێکلام
app.put('/api/advertisements/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        
        if (!status || !['active', 'inactive'].includes(status)) {
            return res.status(400).json({ 
                success: false,
                error: 'دۆخی ڕەوا پێویستە (active, inactive)' 
            });
        }
        
        const ads = await readData('advertisements.json');
        const adIndex = ads.findIndex(ad => ad.id === id);
        
        if (adIndex === -1) {
            return res.status(404).json({ 
                success: false,
                error: 'رێکلام نەدۆزرایەوە' 
            });
        }
        
        const oldStatus = ads[adIndex].status;
        ads[adIndex].status = status;
        ads[adIndex].updatedAt = new Date().toISOString();
        
        const writeSuccess = await writeData('advertisements.json', ads);
        
        if (!writeSuccess) {
            throw new Error('نەتوانرا داتاکان پاشەکەوت بکرێت');
        }
        
        console.log(`🔄 دۆخی رێکلام نوێکرا: ${id} -> ${status}`);
        
        res.json({
            success: true,
            message: `رێکلام ${status === 'active' ? 'چالاک' : 'ناچالاک'} کرا`,
            oldStatus: oldStatus,
            newStatus: status,
            data: ads[adIndex]
        });
    } catch (error) {
        console.error('❌ هەڵە لە نوێکردنەوەی دۆخی رێکلام:', error);
        res.status(500).json({ 
            success: false,
            error: 'هەڵە لە نوێکردنەوەی دۆخ',
            message: error.message 
        });
    }
});

// 12. زیادکردنی کلیک بۆ رێکلام
app.post('/api/advertisements/:id/click', async (req, res) => {
    try {
        const { id } = req.params;
        
        const ads = await readData('advertisements.json');
        const adIndex = ads.findIndex(ad => ad.id === id);
        
        if (adIndex === -1) {
            return res.status(404).json({ 
                success: false,
                error: 'رێکلام نەدۆزرایەوە' 
            });
        }
        
        ads[adIndex].clicks = (ads[adIndex].clicks || 0) + 1;
        ads[adIndex].updatedAt = new Date().toISOString();
        
        await writeData('advertisements.json', ads);
        
        res.json({
            success: true,
            message: 'کلیکەکە تۆمارکرا',
            data: {
                id: ads[adIndex].id,
                title: ads[adIndex].title,
                clicks: ads[adIndex].clicks
            }
        });
    } catch (error) {
        console.error('❌ هەڵە لە تۆمارکردنی کلیک:', error);
        res.status(500).json({ 
            success: false,
            error: 'هەڵە لە تۆمارکردنی کلیک',
            message: error.message 
        });
    }
});

// 13. سڕینەوەی رێکلام
app.delete('/api/advertisements/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // چەککردنی هێدەری تایبەت
        const adminToken = req.headers['x-admin-token'];
        if (!adminToken || adminToken !== process.env.ADMIN_TOKEN) {
            return res.status(403).json({ 
                success: false,
                error: 'مۆڵەتی نەکراوە بۆ سڕینەوەی رێکلام' 
            });
        }
        
        const ads = await readData('advertisements.json');
        const adIndex = ads.findIndex(ad => ad.id === id);
        
        if (adIndex === -1) {
            return res.status(404).json({ 
                success: false,
                error: 'رێکلام نەدۆزرایەوە' 
            });
        }
        
        const deletedAd = ads[adIndex];
        
        // سڕینەوە
        ads.splice(adIndex, 1);
        
        const writeSuccess = await writeData('advertisements.json', ads);
        
        if (!writeSuccess) {
            throw new Error('نەتوانرا داتاکان پاشەکەوت بکرێت');
        }
        
        console.log(`🗑️ رێکلام سڕایەوە: ${deletedAd.id} - ${deletedAd.title}`);
        
        res.json({
            success: true,
            message: 'رێکلام بە سەرکەوتویی سڕایەوە',
            deletedAd: deletedAd
        });
    } catch (error) {
        console.error('❌ هەڵە لە سڕینەوەی رێکلام:', error);
        res.status(500).json({ 
            success: false,
            error: 'هەڵە لە سڕینەوەی رێکلام',
            message: error.message 
        });
    }
});

// 14. وەرگرتنی هەموو خانووەکان
app.get('/api/houses', async (req, res) => {
    try {
        const houses = await readData('houses.json');
        
        // ڕێزبەندی بەپێی کەوتن
        houses.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        res.json({
            success: true,
            count: houses.length,
            data: houses
        });
    } catch (error) {
        console.error('❌ هەڵە لە وەرگرتنی خانووەکان:', error);
        res.status(500).json({ 
            success: false,
            error: 'هەڵە لە وەرگرتنی خانووەکان',
            message: error.message 
        });
    }
});

// 15. زیادکردنی خانوویەکی نوێ
app.post('/api/houses', async (req, res) => {
    try {
        const houseData = req.body;
        
        // چەککردنی داتاکان
        if (!houseData.owner || !houseData.location || !houseData.price) {
            return res.status(400).json({ 
                success: false,
                error: 'ناوی خاوەن، شوێن و نرخ پێویستە' 
            });
        }
        
        const houses = await readData('houses.json');
        
        const newHouse = {
            id: uuidv4(),
            owner: houseData.owner,
            mobile: houseData.mobile || '',
            location: houseData.location,
            type: houseData.type || 'تاپۆ',
            size: houseData.size || '',
            price: houseData.price,
            status: houseData.status || 'available',
            notes: houseData.notes || '',
            requestId: houseData.requestId || null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        houses.unshift(newHouse);
        
        const writeSuccess = await writeData('houses.json', houses);
        
        if (!writeSuccess) {
            throw new Error('نەتوانرا داتاکان پاشەکەوت بکرێت');
        }
        
        console.log(`🏠 خانووی نوێ زیادکرا: ${newHouse.owner} - ${newHouse.location}`);
        
        res.status(201).json({
            success: true,
            message: 'خانوو بە سەرکەوتویی زیادکرا',
            data: newHouse
        });
    } catch (error) {
        console.error('❌ هەڵە لە زیادکردنی خانوو:', error);
        res.status(500).json({ 
            success: false,
            error: 'هەڵە لە زیادکردنی خانوو',
            message: error.message 
        });
    }
});

// 16. نوێکردنەوەی دۆخی خانوو
app.put('/api/houses/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        
        if (!status || !['available', 'sold', 'reserved'].includes(status)) {
            return res.status(400).json({ 
                success: false,
                error: 'دۆخی ڕەوا پێویستە (available, sold, reserved)' 
            });
        }
        
        const houses = await readData('houses.json');
        const houseIndex = houses.findIndex(house => house.id === id);
        
        if (houseIndex === -1) {
            return res.status(404).json({ 
                success: false,
                error: 'خانوو نەدۆزرایەوە' 
            });
        }
        
        const oldStatus = houses[houseIndex].status;
        houses[houseIndex].status = status;
        houses[houseIndex].updatedAt = new Date().toISOString();
        
        const writeSuccess = await writeData('houses.json', houses);
        
        if (!writeSuccess) {
            throw new Error('نەتوانرا داتاکان پاشەکەوت بکرێت');
        }
        
        console.log(`🔄 دۆخی خانوو نوێکرا: ${id} -> ${status}`);
        
        res.json({
            success: true,
            message: `خانوو ${status === 'sold' ? 'فرۆشرا' : status === 'reserved' ? 'ڕیزکرا' : 'بەردەستە'}`,
            oldStatus: oldStatus,
            newStatus: status,
            data: houses[houseIndex]
        });
    } catch (error) {
        console.error('❌ هەڵە لە نوێکردنەوەی دۆخی خانوو:', error);
        res.status(500).json({ 
            success: false,
            error: 'هەڵە لە نوێکردنەوەی دۆخی خانوو',
            message: error.message 
        });
    }
});

// 17. وەرگرتنی هەموو زەویەکان
app.get('/api/lands', async (req, res) => {
    try {
        const lands = await readData('lands.json');
        
        // ڕێزبەندی بەپێی کەوتن
        lands.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        res.json({
            success: true,
            count: lands.length,
            data: lands
        });
    } catch (error) {
        console.error('❌ هەڵە لە وەرگرتنی زەویەکان:', error);
        res.status(500).json({ 
            success: false,
            error: 'هەڵە لە وەرگرتنی زەویەکان',
            message: error.message 
        });
    }
});

// 18. زیادکردنی زەویێکی نوێ
app.post('/api/lands', async (req, res) => {
    try {
        const landData = req.body;
        
        // چەککردنی داتاکان
        if (!landData.owner || !landData.location || !landData.price) {
            return res.status(400).json({ 
                success: false,
                error: 'ناوی خاوەن، شوێن و نرخ پێویستە' 
            });
        }
        
        const lands = await readData('lands.json');
        
        const newLand = {
            id: uuidv4(),
            owner: landData.owner,
            mobile: landData.mobile || '',
            location: landData.location,
            size: landData.size || '',
            price: landData.price,
            status: landData.status || 'available',
            notes: landData.notes || '',
            requestId: landData.requestId || null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        lands.unshift(newLand);
        
        const writeSuccess = await writeData('lands.json', lands);
        
        if (!writeSuccess) {
            throw new Error('نەتوانرا داتاکان پاشەکەوت بکرێت');
        }
        
        console.log(`🌳 زەوی نوێ زیادکرا: ${newLand.owner} - ${newLand.location}`);
        
        res.status(201).json({
            success: true,
            message: 'زەوی بە سەرکەوتویی زیادکرا',
            data: newLand
        });
    } catch (error) {
        console.error('❌ هەڵە لە زیادکردنی زەوی:', error);
        res.status(500).json({ 
            success: false,
            error: 'هەڵە لە زیادکردنی زەوی',
            message: error.message 
        });
    }
});

// 19. نوێکردنەوەی دۆخی زەوی
app.put('/api/lands/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        
        if (!status || !['available', 'sold', 'reserved'].includes(status)) {
            return res.status(400).json({ 
                success: false,
                error: 'دۆخی ڕەوا پێویستە (available, sold, reserved)' 
            });
        }
        
        const lands = await readData('lands.json');
        const landIndex = lands.findIndex(land => land.id === id);
        
        if (landIndex === -1) {
            return res.status(404).json({ 
                success: false,
                error: 'زەوی نەدۆزرایەوە' 
            });
        }
        
        const oldStatus = lands[landIndex].status;
        lands[landIndex].status = status;
        lands[landIndex].updatedAt = new Date().toISOString();
        
        const writeSuccess = await writeData('lands.json', lands);
        
        if (!writeSuccess) {
            throw new Error('نەتوانرا داتاکان پاشەکەوت بکرێت');
        }
        
        console.log(`🔄 دۆخی زەوی نوێکرا: ${id} -> ${status}`);
        
        res.json({
            success: true,
            message: `زەوی ${status === 'sold' ? 'فرۆشرا' : status === 'reserved' ? 'ڕیزکرا' : 'بەردەستە'}`,
            oldStatus: oldStatus,
            newStatus: status,
            data: lands[landIndex]
        });
    } catch (error) {
        console.error('❌ هەڵە لە نوێکردنەوەی دۆخی زەوی:', error);
        res.status(500).json({ 
            success: false,
            error: 'هەڵە لە نوێکردنەوەی دۆخی زەوی',
            message: error.message 
        });
    }
});

// 20. وەرگرتنی وێنەکان
app.use('/uploads', express.static('uploads'));

// 21. Backup API (پاراستنی داتاکان)
app.get('/api/backup', async (req, res) => {
    try {
        // چەککردنی هێدەری تایبەت
        const adminToken = req.headers['x-admin-token'];
        if (!adminToken || adminToken !== process.env.ADMIN_TOKEN) {
            return res.status(403).json({ 
                success: false,
                error: 'مۆڵەتی نەکراوە بۆ وەرگرتنی backup' 
            });
        }
        
        const backupData = {
            requests: await readData('requests.json'),
            houses: await readData('houses.json'),
            lands: await readData('lands.json'),
            advertisements: await readData('advertisements.json'),
            timestamp: new Date().toISOString(),
            totalRecords: 0
        };
        
        backupData.totalRecords = 
            backupData.requests.length + 
            backupData.houses.length + 
            backupData.lands.length + 
            backupData.advertisements.length;
        
        res.json({
            success: true,
            message: 'Backup بە سەرکەوتویی وەرگیرا',
            data: backupData
        });
    } catch (error) {
        console.error('❌ هەڵە لە وەرگرتنی backup:', error);
        res.status(500).json({ 
            success: false,
            error: 'هەڵە لە وەرگرتنی backup',
            message: error.message 
        });
    }
});

// 22. هەڵەی 404
app.use('/api/*', (req, res) => {
    res.status(404).json({ 
        success: false,
        error: 'ڕێگە نەدۆزرایەوە',
        requestedUrl: req.originalUrl 
    });
});

// 23. هەڵەی گشتی
app.use((err, req, res, next) => {
    console.error('🔥 هەڵەی سێرڤەر:', err);
    
    // جۆری هەڵەکان
    if (err instanceof multer.MulterError) {
        return res.status(400).json({ 
            success: false,
            error: 'هەڵەی فایل',
            message: err.message 
        });
    }
    
    if (err.type === 'entity.parse.failed') {
        return res.status(400).json({ 
            success: false,
            error: 'JSON نادروستە',
            message: 'تکایە JSONی ڕەوا بنێرە'
        });
    }
    
    res.status(500).json({ 
        success: false,
        error: 'هەڵەی ناوەخۆیی سێرڤەر',
        message: process.env.NODE_ENV === 'development' ? err.message : 'هەڵەیەکی ناوەخۆیی ڕوویدا'
    });
});

// دەستپێکردنی سێرڤەر
async function startServer() {
    try {
        await ensureDirectories();
        await initializeDataFiles();
        
        app.listen(PORT, () => {
            console.log(`
╔══════════════════════════════════════════════════════════════════╗
║              🚀 API سێرڤەر دەستی پێکرد                           ║
╠══════════════════════════════════════════════════════════════════╣
║ 📍 پۆرت: ${PORT}                                                  ║
║ 🌐 چەکی API: http://localhost:${PORT}/api/health                  ║
║ 📁 داتا فۆڵدەر: ${path.join(__dirname, 'data')}                  ║
║ 📱 سیستەمی ناردنی داواکاری: https://dawakrdn.vercel.app         ║
║ 🖥️ سیستەمی بەڕێوەبردنی داواکاری: https://systamwargrtn.vercel.app║
║ 🔒 دۆمەینە ڕێپێدراوەکان: ${allowedOrigins.join(', ')}            ║
╚══════════════════════════════════════════════════════════════════╝
            `);
            
            console.log('\n📊 داتای نمونە زیادکرا:');
            console.log('   • 1 داواکاری نمونە');
            console.log('   • 1 خانووی نمونە');
            console.log('   • 1 زەوی نمونە');
            console.log('   • 1 رێکلامی نمونە');
            console.log('\n✅ سێرڤەر ئامادەیە بۆ بەکارهێنان!');
        });
    } catch (error) {
        console.error('🔥 هەڵە لە دەستپێکردنی سێرڤەر:', error);
        process.exit(1);
    }
}

startServer();