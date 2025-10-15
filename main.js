const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const mysql = require('mysql2');

// Initialize @electron/remote
require('@electron/remote/main').initialize();

// Database connection
const db = mysql.createConnection({
    host: '192.168.0.3',
    user: 'monarch',
    password: 'LughTuathaDe@#3',
    port: 3939,
    database: 'rsaz_sik'
});

// Queue state management
const queueState = {
    counterA: 0,
    counterB: 0,
    lastCalledA: [],
    lastCalledB: []
};

// Global window references
const windows = {
    main: null,
    displayA: null,
    displayB: null
};

// Global settings cache
let globalSettings = {};

// Settings path management
function getSettingsPath() {
    const userDataPath = app.getPath('userData');
    const settingsPath = path.join(userDataPath, 'settings.json');
    
    // If settings doesn't exist in userData, copy from resources or create default
    if (!fs.existsSync(settingsPath)) {
        const defaultSettingsPath = app.isPackaged 
            ? path.join(process.resourcesPath, 'settings.json')
            : path.join(__dirname, 'settings.json');
        
        if (fs.existsSync(defaultSettingsPath)) {
            try {
                fs.copyFileSync(defaultSettingsPath, settingsPath);
                console.log('✅ Copied settings from:', defaultSettingsPath, 'to:', settingsPath);
            } catch (error) {
                console.warn('⚠️ Failed to copy settings, creating default:', error.message);
                createDefaultSettings(settingsPath);
            }
        } else {
            createDefaultSettings(settingsPath);
        }
    }
    
    return settingsPath;
}

function createDefaultSettings(settingsPath) {
    const defaultSettings = {
        displaySettings: {
            runningText: "Selamat Datang di Sistem Antrian Rumah Sakit",
            logo: {
                path: "assets/logo.svg",
                width: 200,
                height: 100
            },
            institutionName: "RSUD H. Abdul Aziz Marabahan",
            showVideo: false,
            youtubeUrl: ""
        }
    };
    
    try {
        // Ensure directory exists
        const dir = path.dirname(settingsPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        
        fs.writeFileSync(settingsPath, JSON.stringify(defaultSettings, null, 2));
        console.log('✅ Created default settings at:', settingsPath);
        return defaultSettings;
    } catch (error) {
        console.error('❌ Failed to create default settings:', error);
        return defaultSettings;
    }
}

function loadSettingsFromFile() {
    try {
        const settingsPath = getSettingsPath();
        const settingsData = fs.readFileSync(settingsPath, 'utf8');
        const settings = JSON.parse(settingsData);
        console.log('✅ Settings loaded from:', settingsPath);
        return settings;
    } catch (error) {
        console.error('❌ Error loading settings:', error);
        return createDefaultSettings(getSettingsPath());
    }
}

// Window creation helper
function createWindow(file, options = {}) {
    const defaultOptions = {
        width: 1024,
        height: 768,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            webSecurity: false,
            enableRemoteModule: true
        }
    };

    try {
        const windowOptions = { ...defaultOptions, ...options };
        const win = new BrowserWindow(windowOptions);
        
        win.loadFile(file).catch(err => {
            console.error(`Error loading file ${file}:`, err);
        });

        win.once('ready-to-show', () => {
            win.show();
        });

        return win;
    } catch (error) {
        console.error('Error creating window:', error);
        return null;
    }
}

// Specific window creators
function createMainWindow() {
    windows.main = createWindow('index.html', {
        width: 1200,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        show: false  // Hide window initially
    });

    if (windows.main) {
        // Enable remote for main window
        require('@electron/remote/main').enable(windows.main.webContents);
        
        // Maximize and show window when ready
        windows.main.once('ready-to-show', () => {
            windows.main.maximize();
            windows.main.show();
        });

        windows.main.on('closed', () => {
            windows.main = null;
            // Close all display windows when main window is closed
            ['A', 'B'].forEach(counter => {
                const windowKey = `display${counter}`;
                if (windows[windowKey]) {
                    windows[windowKey].close();
                    windows[windowKey] = null;
                }
            });
        });
    }

    return windows.main;
}

function createDisplayWindow(counter) {
    try {
        const windowKey = `display${counter}`;
        const file = `display-${counter.toLowerCase()}.html`;

        // If window exists and is valid, just focus it
        if (windows[windowKey] && !windows[windowKey].isDestroyed()) {
            if (windows[windowKey].isMinimized()) {
                windows[windowKey].restore();
            }
            windows[windowKey].focus();
            return windows[windowKey];
        }

        // Get all available displays
        const displays = require('electron').screen.getAllDisplays();
        const externalDisplay = displays.find((display) => {
            return display.bounds.x !== 0 || display.bounds.y !== 0;
        });

        // Create new window
        windows[windowKey] = createWindow(file, {
            width: 1280,
            height: 720,
            frame: false,
            alwaysOnTop: false,
            fullscreen: true,
            x: externalDisplay ? externalDisplay.bounds.x : undefined,
            y: externalDisplay ? externalDisplay.bounds.y : undefined,
            show: false,
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false,
                webSecurity: false,
                enableRemoteModule: true
            }
        });

        if (!windows[windowKey]) {
            throw new Error(`Failed to create display window for Counter ${counter}`);
        }

        // Enable remote for this window
        require('@electron/remote/main').enable(windows[windowKey].webContents);

        // Configure window
        windows[windowKey].setMenuBarVisibility(false);
        windows[windowKey].setMovable(true);

        // Setup window event handlers
        windows[windowKey].on('closed', () => {
            windows[windowKey] = null;
        });

        windows[windowKey].webContents.once('did-finish-load', () => {
            // Send initial state and settings
            windows[windowKey].webContents.send('update-queue', {
                counter: counter,
                number: queueState[`counter${counter}`],
                lastCalled: queueState[`lastCalled${counter}`]
            });
            
            // Send current settings to display window
            windows[windowKey].webContents.send('settings-updated', globalSettings);
            
            windows[windowKey].show();
        });

        return windows[windowKey];
    } catch (error) {
        console.error(`Error creating display window for Counter ${counter}:`, error);
        return null;
    }
}

function updateDatabase(counter, queueNumber, rmNumber) {
    const currentDate = new Date().toISOString().split('T')[0];
    const query = `
        UPDATE mlite_antrian_loket 
        SET no_rkm_medis = ?, 
            end_time = NOW(), 
            status = 1, 
            type = ? 
        WHERE noantrian = ? 
        AND DATE(postdate) = ?`;

    db.query(
        query,
        [rmNumber, counter === 'A' ? 'Loket' : 'CS', queueNumber, currentDate],
        (err, result) => {
            if (err) {
                console.error('Error updating queue in database:', err);
            } else {
                console.log(`Updated antrian=${queueNumber}, type=${counter === 'A' ? 'Loket' : 'CS'}`);
            }
        }
    );
}

function fetchQueueTotals() {
    const currentDate = new Date().toISOString().split('T')[0];
    console.log(`\n=== FETCHING QUEUE TOTALS FOR DATE: ${currentDate} ===`);
    
    const query = `
        SELECT 
            type,
            COUNT(CASE WHEN status = 0 THEN 1 END) as waiting,
            COUNT(CASE WHEN status = 1 THEN 1 END) as called,
            COUNT(*) as total
        FROM mlite_antrian_loket
        WHERE DATE(postdate) = ?
        AND type IN ('Loket', 'CS')
        GROUP BY type`;

    console.log('Query:', query);
    console.log('Parameters:', [currentDate]);

    db.query(query, [currentDate], (err, results) => {
        if (err) {
            console.error('Error fetching queue totals:', err);
            return;
        }

        console.log('=== RAW DATABASE RESULTS ===');
        console.log('Results count:', results ? results.length : 0);
        console.log('Raw results:', JSON.stringify(results, null, 2));

        const totals = {
            Loket: { waiting: 0, called: 0, total: 0 },
            CS: { waiting: 0, called: 0, total: 0 }
        };

        if (Array.isArray(results)) {
            results.forEach((row, index) => {
                console.log(`Processing row ${index}:`, row);
                if (row.type) {
                    const type = row.type.trim();
                    console.log(`Row type: "${type}" (length: ${type.length})`);
                    if (type.toUpperCase() === 'LOKET' || type.toUpperCase() === 'CS') {
                        const key = type.toUpperCase() === 'LOKET' ? 'Loket' : 'CS';
                        totals[key] = {
                            waiting: parseInt(row.waiting || 0),
                            called: parseInt(row.called || 0),
                            total: parseInt(row.total || 0)
                        };
                        console.log(`Set totals[${key}]:`, totals[key]);
                    } else {
                        console.log(`Type "${type}" tidak dikenali`);
                    }
                }
            });
        }

        console.log('=== FINAL PROCESSED TOTALS ===');
        console.log('Final totals:', JSON.stringify(totals, null, 2));
        console.log('==========================================\n');

        Object.values(windows).forEach(win => {
            if (win && !win.isDestroyed()) {
                win.webContents.send('queue-totals-update', totals);
            }
        });
    });
}


// App lifecycle events
app.whenReady().then(() => {
    // Load settings first
    globalSettings = loadSettingsFromFile();
    console.log('🔧 Global settings loaded:', globalSettings);
    
    createMainWindow();
    
    db.connect((err) => {
        if (err) {
            console.error('Error connecting to database:', err);
            return;
        }
        console.log('Connected to database');
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
    }
});

// Set up periodic queue totals update
setInterval(fetchQueueTotals, 5000); // Update every 5 seconds

// IPC event handlers
ipcMain.on('request-queue-totals', () => {
    fetchQueueTotals();
});

// Settings IPC handlers
ipcMain.handle('get-settings', () => {
    console.log('📤 IPC: get-settings requested');
    return globalSettings;
});

ipcMain.handle('save-settings', (event, newSettings) => {
    try {
        const settingsPath = getSettingsPath();
        fs.writeFileSync(settingsPath, JSON.stringify(newSettings, null, 2));
        globalSettings = newSettings;
        
        console.log('💾 Settings saved and cached:', settingsPath);
        
        // Notify all windows about settings update
        BrowserWindow.getAllWindows().forEach(win => {
            if (!win.isDestroyed()) {
                win.webContents.send('settings-updated', newSettings);
            }
        });
        
        return { success: true, path: settingsPath };
    } catch (error) {
        console.error('❌ Error saving settings:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('get-settings-path', () => {
    try {
        return { success: true, path: getSettingsPath() };
    } catch (error) {
        console.error('❌ Error getting settings path:', error);
        return { success: false, error: error.message };
    }
});

// Manual sync handler for current date
ipcMain.on('sync-queue-totals', (event) => {
    console.log('Manual sync requested for current date:', new Date().toISOString().split('T')[0]);
    fetchQueueTotals();
    event.reply('sync-complete', { 
        message: 'Data berhasil disinkronisasi',
        date: new Date().toISOString().split('T')[0]
    });
});

ipcMain.on('open-display', (event, data) => {
    try {
        const counter = data.counter;
        const displayWindow = createDisplayWindow(counter);
        if (!displayWindow) {
            console.error(`Failed to create or focus display window for Counter ${counter}`);
        }
    } catch (error) {
        console.error('Error handling open-display event:', error);
    }
});

// Handle queue updates
ipcMain.on('update-queue', (event, data) => {
    try {
        const { counter, number } = data;
        queueState[`counter${counter}`] = number;
        
        // Update the specific display window
        const windowKey = `display${counter}`;
        if (windows[windowKey] && !windows[windowKey].isDestroyed()) {
            windows[windowKey].webContents.send('update-queue', {
                counter,
                number,
                lastCalled: queueState[`lastCalled${counter}`],
                audioFormat: {
                    prefix: counter,
                    number: number,
                    loketNumber: counter === 'A' ? 'satu' : 'dua'
                }
            });
        }
    } catch (error) {
        console.error('Error handling queue update:', error);
    }
});

// Handle number calls
ipcMain.on('call-number', (event, data) => {
    try {
        const { counter, queueNumber, rmNumber } = data;
        
        // Update queue state
        queueState[`counter${counter}`] = parseInt(queueNumber);
        queueState[`lastCalled${counter}`].unshift(queueNumber);
        if (queueState[`lastCalled${counter}`].length > 5) {
            queueState[`lastCalled${counter}`].pop();
        }

        // Update specific display window
        const windowKey = `display${counter}`;
        if (windows[windowKey] && !windows[windowKey].isDestroyed()) {
            const updateData = {
                counter: counter,
                number: queueNumber,
                lastCalled: queueState[`lastCalled${counter}`],
                audioFormat: {
                    prefix: counter,
                    number: queueNumber,
                    loketNumber: counter === 'A' ? 'satu' : 'dua'
                }
            };
            windows[windowKey].webContents.send('update-queue', updateData);
        }

        // Update database
        updateDatabase(counter, queueNumber, rmNumber);
        
        // Send success response
        event.reply('call-number-success');
    } catch (error) {
        console.error('Error handling number call:', error);
        event.reply('call-number-error', { error: error.message });
    }
});

// Handle app paths request
ipcMain.on('get-app-paths', (event) => {
    try {
        const os = require('os');
        const paths = {
            userData: app.getPath('userData'),
            documents: app.getPath('documents'),
            home: os.homedir(),
            appData: app.getPath('appData'),
            currentDir: __dirname,
            resourcesPath: process.resourcesPath || __dirname,
            isPackaged: app.isPackaged,
            execPath: process.execPath,
            cwd: process.cwd()
        };
        console.log('📍 IPC get-app-paths response:', paths);
        event.reply('app-paths-response', paths);
    } catch (error) {
        console.error('Error getting app paths:', error);
        event.reply('app-paths-error', { error: error.message });
    }
});

// Handle folder dialog request
ipcMain.on('open-folder-dialog', async (event) => {
    try {
        const { dialog } = require('electron');
        const result = await dialog.showOpenDialog({
            properties: ['openDirectory'],
            title: 'Pilih Folder untuk Settings'
        });
        event.reply('folder-dialog-response', result);
    } catch (error) {
        console.error('Error opening folder dialog:', error);
        event.reply('folder-dialog-response', { canceled: true, error: error.message });
    }
});
