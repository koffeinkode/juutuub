let selectedFormat = null;
let selectedFolder = null;
let currentVideoUrl = null;
let selectedQuality = '320k'; // Default høyeste kvalitet
let downloadHistory = [];

const urlInput = document.getElementById('urlInput');
const getInfoBtn = document.getElementById('getInfoBtn');
const videoInfo = document.getElementById('videoInfo');
const downloadOptions = document.getElementById('downloadOptions');
const progressSection = document.getElementById('progressSection');
const statusMessage = document.getElementById('statusMessage');

const videoTitle = document.getElementById('videoTitle');
const videoUploader = document.getElementById('videoUploader');
const videoDuration = document.getElementById('videoDuration');
const thumbnail = document.getElementById('thumbnail');

const formatButtons = document.querySelectorAll('.format-btn');
const qualityButtons = document.querySelectorAll('.quality-btn');
const mp3QualitySection = document.getElementById('mp3QualitySection');
const selectFolderBtn = document.getElementById('selectFolderBtn');
const selectedFolderSpan = document.getElementById('selectedFolder');
const downloadBtn = document.getElementById('downloadBtn');

const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');

const logContent = document.getElementById('logContent');
const clearLogBtn = document.getElementById('clearLogBtn');

function showStatus(message, type = 'info') {
    statusMessage.textContent = message;
    statusMessage.className = `status-message ${type}`;
    statusMessage.style.display = 'block';
    
    if (type !== 'error') {
        setTimeout(() => {
            statusMessage.style.display = 'none';
        }, 5000);
    }
}

function formatDuration(seconds) {
    if (!seconds || isNaN(seconds)) return 'Ukjent varighet';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else {
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }
}

getInfoBtn.addEventListener('click', async () => {
    const url = urlInput.value.trim();
    
    if (!url) {
        showStatus('Vennligst lim inn en YouTube URL', 'error');
        return;
    }
    
    if (!url.includes('youtube.com') && !url.includes('youtu.be')) {
        showStatus('Ugyldig YouTube URL', 'error');
        return;
    }
    
    getInfoBtn.disabled = true;
    getInfoBtn.textContent = 'Henter info...';
    
    try {
        const result = await window.electronAPI.getVideoInfo(url);
        
        if (result.success) {
            currentVideoUrl = url;
            
            videoTitle.textContent = result.title;
            videoUploader.textContent = `Av: ${result.uploader}`;
            videoDuration.textContent = formatDuration(result.duration);
            
            if (result.thumbnail) {
                thumbnail.src = result.thumbnail;
                thumbnail.style.display = 'block';
            } else {
                thumbnail.style.display = 'none';
            }
            
            videoInfo.style.display = 'block';
            downloadOptions.style.display = 'block';
            
            showStatus('Video informasjon hentet!', 'success');
        } else {
            showStatus(`Feil: ${result.error}`, 'error');
        }
    } catch (error) {
        showStatus(`Feil ved henting av video info: ${error.message}`, 'error');
    }
    
    getInfoBtn.disabled = false;
    getInfoBtn.textContent = 'Hent info';
});

formatButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        formatButtons.forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        selectedFormat = btn.dataset.format;
        
        // Vis kvalitetsvalg kun for MP3
        if (selectedFormat === 'mp3') {
            mp3QualitySection.style.display = 'block';
        } else {
            mp3QualitySection.style.display = 'none';
        }
        
        updateDownloadButton();
    });
});

qualityButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        qualityButtons.forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        selectedQuality = btn.dataset.quality;
    });
});

selectFolderBtn.addEventListener('click', async () => {
    try {
        const folder = await window.electronAPI.selectDownloadFolder();
        if (folder) {
            selectedFolder = folder;
            selectedFolderSpan.textContent = folder;
            updateDownloadButton();
        }
    } catch (error) {
        showStatus(`Feil ved valg av mappe: ${error.message}`, 'error');
    }
});

function updateDownloadButton() {
    downloadBtn.disabled = !selectedFormat || !selectedFolder || !currentVideoUrl;
}

downloadBtn.addEventListener('click', async () => {
    if (!selectedFormat || !selectedFolder || !currentVideoUrl) {
        showStatus('Vennligst velg format og nedlastingsmappe', 'error');
        return;
    }
    
    downloadBtn.disabled = true;
    downloadBtn.textContent = 'Laster ned...';
    progressSection.style.display = 'block';
    progressFill.style.width = '0%';
    progressText.textContent = 'Starter nedlasting...';
    
    try {
        const result = await window.electronAPI.downloadVideo({
            url: currentVideoUrl,
            format: selectedFormat,
            quality: selectedQuality,
            outputPath: selectedFolder
        });
        
        if (result.success) {
            progressFill.style.width = '100%';
            progressText.textContent = 'Nedlasting fullført!';
            showStatus('Video lastet ned!', 'success');
            
            // Add to download history
            const videoTitleEl = document.getElementById('videoTitle');
            const videoUploaderEl = document.getElementById('videoUploader');
            const title = videoTitleEl ? videoTitleEl.textContent : 'Ukjent tittel';
            const uploader = videoUploaderEl ? videoUploaderEl.textContent.replace('Av: ', '') : 'Ukjent kanal';
            
            addToDownloadHistory(title, currentVideoUrl, selectedFormat, selectedQuality, uploader);
        } else {
            showStatus(`Nedlasting feilet: ${result.error}`, 'error');
        }
    } catch (error) {
        showStatus(`Feil under nedlasting: ${error.message}`, 'error');
    }
    
    downloadBtn.disabled = false;
    downloadBtn.textContent = '⬇️ Start nedlasting';
    
    setTimeout(() => {
        progressSection.style.display = 'none';
    }, 3000);
});

window.electronAPI.onDownloadProgress((event, progress) => {
    if (progress.percent !== undefined) {
        const percent = Math.round(progress.percent);
        progressFill.style.width = `${percent}%`;
        progressText.textContent = `Laster ned: ${percent}%`;
        
        if (progress.speed) {
            progressText.textContent += ` (${progress.speed})`;
        }
        
        if (progress.eta) {
            progressText.textContent += ` - ${progress.eta} igjen`;
        }
    }
});

// Download history functions
function loadDownloadHistory() {
    const stored = localStorage.getItem('juutuub_downloads');
    if (stored) {
        downloadHistory = JSON.parse(stored);
        renderDownloadLog();
    }
}

function saveDownloadHistory() {
    localStorage.setItem('juutuub_downloads', JSON.stringify(downloadHistory));
}

function addToDownloadHistory(title, url, format, quality, uploader) {
    const entry = {
        id: Date.now(),
        timestamp: new Date().toLocaleString('no-NO', {
            day: '2-digit',
            month: '2-digit', 
            year: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        }),
        title: title,
        url: url,
        format: format,
        quality: quality,
        uploader: uploader
    };
    
    downloadHistory.unshift(entry); // Add to beginning
    if (downloadHistory.length > 50) { // Keep max 50 entries
        downloadHistory = downloadHistory.slice(0, 50);
    }
    
    saveDownloadHistory();
    renderDownloadLog();
}

function renderDownloadLog() {
    if (downloadHistory.length === 0) {
        logContent.innerHTML = '<div class="log-empty">Ingen nedlastinger ennå...</div>';
        return;
    }
    
    logContent.innerHTML = downloadHistory.map(entry => `
        <div class="log-entry">
            <div class="log-line">
                <span class="log-timestamp">${entry.timestamp}</span>
                <span class="log-title">${entry.title}</span>
                <span class="log-format">${entry.format.toUpperCase()}${entry.quality ? `/${entry.quality}` : ''}</span>
            </div>
            <div class="log-actions">
                <a href="${entry.url}" target="_blank" class="video-link">↗</a>
                <button class="redownload-btn" data-url="${entry.url}" data-format="${entry.format}" data-quality="${entry.quality || ''}">
                    RE-DL
                </button>
            </div>
        </div>
    `).join('');
    
    // Add event listeners to redownload buttons
    document.querySelectorAll('.redownload-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const url = e.target.dataset.url;
            const format = e.target.dataset.format;
            const quality = e.target.dataset.quality;
            
            urlInput.value = url;
            getInfoBtn.click();
            
            setTimeout(() => {
                // Set format
                const formatBtn = document.querySelector(`[data-format="${format}"]`);
                if (formatBtn) formatBtn.click();
                
                // Set quality if MP3
                if (format === 'mp3' && quality) {
                    setTimeout(() => {
                        const qualityBtn = document.querySelector(`[data-quality="${quality}"]`);
                        if (qualityBtn) qualityBtn.click();
                    }, 100);
                }
            }, 500);
        });
    });
}

clearLogBtn.addEventListener('click', () => {
    if (confirm('Tøm all nedlastingshistorikk?')) {
        downloadHistory = [];
        saveDownloadHistory();
        renderDownloadLog();
    }
});

// Load history on startup
loadDownloadHistory();

urlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        getInfoBtn.click();
    }
});