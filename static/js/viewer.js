class MediaPlayer {
    constructor() {
        this.mediaFiles = [];
        this.currentFile = null;
        this.isPlaying = false;
        this.isShuffle = true;
        this.playOrder = [];
        this.currentIndex = -1;
        this.avoidConsecutiveWanted = true;
        this.imageDisplayTime = 8; // seconds
        this.imageTimer = null;
        this.lastWasWanted = false;
        this.isFullscreen = false;

        // DOM elements
        this.videoPlayer = document.getElementById('videoPlayer');
        this.imagePlayer = document.getElementById('imagePlayer');
        this.noMedia = document.getElementById('noMedia');
        this.playPauseBtn = document.getElementById('playPauseBtn');
        this.nextBtn = document.getElementById('nextBtn');
        this.shuffleBtn = document.getElementById('shuffleBtn');
        this.orderedBtn = document.getElementById('orderedBtn');
        this.fullscreenBtn = document.getElementById('fullscreenBtn'); // New
        this.currentFileInfo = document.getElementById('currentFileInfo');
        this.playbackMode = document.getElementById('playbackMode');
        this.avoidConsecutiveCheckbox = document.getElementById('avoidConsecutiveWanted');
        this.imageDisplayTimeInput = document.getElementById('imageDisplayTime');
        this.mediaDisplay = document.getElementById('mediaDisplay'); // New

        this.initializeEventListeners();
        this.loadMediaFiles();
    }

    initializeEventListeners() {
        this.playPauseBtn.addEventListener('click', () => this.togglePlayPause());
        this.nextBtn.addEventListener('click', () => this.nextFile());
        this.shuffleBtn.addEventListener('click', () => this.setShuffle(true));
        this.orderedBtn.addEventListener('click', () => this.setShuffle(false));
        this.fullscreenBtn.addEventListener('click', () => this.toggleFullscreen()); // New
        
        this.videoPlayer.addEventListener('ended', () => this.nextFile());
        this.avoidConsecutiveCheckbox.addEventListener('change', (e) => {
            this.avoidConsecutiveWanted = e.target.checked;
        });
        
        this.imageDisplayTimeInput.addEventListener('change', (e) => {
            this.imageDisplayTime = parseInt(e.target.value) || 8;
        });

        // Fullscreen change events
        document.addEventListener('fullscreenchange', () => this.handleFullscreenChange());
        document.addEventListener('webkitfullscreenchange', () => this.handleFullscreenChange());
        document.addEventListener('mozfullscreenchange', () => this.handleFullscreenChange());
        document.addEventListener('MSFullscreenChange', () => this.handleFullscreenChange());

        // Prevent spacebar from scrolling page when video has focus
        this.videoPlayer.addEventListener('keydown', (e) => {
            if (e.code === 'Space') {
                e.preventDefault();
                this.togglePlayPause();
            }
        });

        // Keyboard shortcut for fullscreen (F key)
        document.addEventListener('keydown', (e) => {
            if (e.code === 'KeyF' && !e.ctrlKey && !e.altKey && !e.metaKey) {
                e.preventDefault();
                this.toggleFullscreen();
            }
        });
    }

    toggleFullscreen() {
        if (!this.isFullscreen) {
            this.enterFullscreen();
        } else {
            this.exitFullscreen();
        }
    }

    enterFullscreen() {
        const element = this.mediaDisplay; // Use the container, not individual media
        
        if (element.requestFullscreen) {
            element.requestFullscreen();
        } else if (element.webkitRequestFullscreen) {
            element.webkitRequestFullscreen();
        } else if (element.mozRequestFullScreen) {
            element.mozRequestFullScreen();
        } else if (element.msRequestFullscreen) {
            element.msRequestfullscreen();
        }
    }

    prepareElementForFullscreen(element) {
        // Ensure the element is visible and has proper dimensions
        element.style.display = 'block';
        element.style.width = '100%';
        element.style.height = '100%';
        element.style.objectFit = 'contain';
    }

    exitFullscreen() {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        } else if (document.mozCancelFullScreen) {
            document.mozCancelFullScreen();
        } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
        }
    }

    getCurrentMediaElement() {
        if (this.currentFile && this.currentFile.type === 'video') {
            return this.videoPlayer;
        } else if (this.currentFile && this.currentFile.type === 'image') {
            return this.imagePlayer;
        }
        return null;
    }

    handleFullscreenChange() {
        this.isFullscreen = !!(document.fullscreenElement || 
                              document.webkitFullscreenElement || 
                              document.mozFullScreenElement || 
                              document.msFullscreenElement);
        
        this.updateFullscreenButton();
        
        if (this.isFullscreen) {
            document.body.classList.add('fullscreen-active');
            // Ensure current media is properly displayed
            this.showCurrentMedia();
        } else {
            document.body.classList.remove('fullscreen-active');
            this.showCurrentMedia();
        }
    }

    showCurrentMedia() {
        if (!this.currentFile) return;

        // Reset display first
        this.videoPlayer.style.display = 'none';
        this.imagePlayer.style.display = 'none';

        if (this.currentFile.type === 'video') {
            this.videoPlayer.style.display = 'block';
            // Adjust video size for fullscreen
            if (this.isFullscreen) {
                this.videoPlayer.style.width = '100%';
                this.videoPlayer.style.height = '100%';
                this.videoPlayer.style.objectFit = 'contain';
            } else {
                this.videoPlayer.style.width = '';
                this.videoPlayer.style.height = '';
                this.videoPlayer.style.maxWidth = '100%';
                this.videoPlayer.style.maxHeight = '70vh';
            }
        } else {
            this.imagePlayer.style.display = 'block';
            // Adjust image size for fullscreen
            if (this.isFullscreen) {
                this.imagePlayer.style.width = '100%';
                this.imagePlayer.style.height = '100%';
                this.imagePlayer.style.objectFit = 'contain';
            } else {
                this.imagePlayer.style.width = '';
                this.imagePlayer.style.height = '';
                this.imagePlayer.style.maxWidth = '100%';
                this.imagePlayer.style.maxHeight = '70vh';
            }
        }
    }

    resetMediaElement(element) {
        element.style.width = '';
        element.style.height = '';
        element.style.objectFit = '';
        element.style.position = '';
        element.style.top = '';
        element.style.left = '';
        element.style.zIndex = '';
        element.style.backgroundColor = '';
        element.style.maxWidth = '100%';
        element.style.maxHeight = '70vh';
    }

    updateFullscreenButton() {
        if (this.isFullscreen) {
            this.fullscreenBtn.textContent = '⛶ Exit Fullscreen';
            this.fullscreenBtn.classList.add('active');
        } else {
            this.fullscreenBtn.textContent = '⛶ Fullscreen';
            this.fullscreenBtn.classList.remove('active');
        }
    }

    async loadMediaFiles() {
        try {
            console.log('Starting to load media files...');
            const response = await fetch('/get-files');
            const data = await response.json();
            
            if (data.error) {
                console.error('Error loading files:', data.error);
                return;
            }

            console.log('Raw data from /get-files:', data);
            console.log('Total items received:', data.items.length);

            // Detailed filtering with logging
            this.mediaFiles = data.items.filter(item => {
                console.log('Checking item:', item);
                
                const isFile = item.isFile === true;
                const isMediaType = item.type === 'image' || item.type === 'video';
                const isValid = isFile && isMediaType;
                
                console.log(`Item: "${item.name}" - isFile: ${isFile}, type: ${item.type}, isMediaType: ${isMediaType}, isValid: ${isValid}`);
                
                if (!isFile) {
                    console.log(`  → Skipped: Not a file (isFile: ${item.isFile})`);
                } else if (!isMediaType) {
                    console.log(`  → Skipped: Not image/video (type: ${item.type})`);
                } else {
                    console.log(`  → INCLUDED as media file`);
                }
                
                return isValid;
            });

            console.log('=== FILTERING COMPLETE ===');
            console.log('Total media files found:', this.mediaFiles.length);
            console.log('Media files array:', this.mediaFiles);

            this.updateUI();
            
        } catch (error) {
            console.error('Error loading media files:', error);
        }
    }

    updateUI() {
        console.log('Updating UI - mediaFiles count:', this.mediaFiles.length);
        
        if (this.mediaFiles.length === 0) {
            console.log('Showing "No media available" message');
            this.noMedia.style.display = 'block';
            this.playPauseBtn.disabled = true;
            this.nextBtn.disabled = true;
        } else {
            console.log('Hiding "No media available" message');
            this.noMedia.style.display = 'none';
            this.playPauseBtn.disabled = false;
            this.nextBtn.disabled = false;
        }

        this.updateModeButtons();
    }

    updateModeButtons() {
        this.shuffleBtn.classList.toggle('active', this.isShuffle);
        this.orderedBtn.classList.toggle('active', !this.isShuffle);
        this.playbackMode.textContent = `Mode: ${this.isShuffle ? 'Shuffle' : 'Ordered'}`;
    }

    setShuffle(shuffle) {
        this.isShuffle = shuffle;
        this.playOrder = [];
        this.currentIndex = -1;
        this.updateModeButtons();
    }

    togglePlayPause() {
        if (this.isPlaying) {
            this.pause();
        } else {
            this.play();
        }
    }

    play() {
        if (this.mediaFiles.length === 0) return;

        this.isPlaying = true;
        this.playPauseBtn.textContent = '⏸️ Pause';

        if (!this.currentFile) {
            this.nextFile();
        } else {
            this.playCurrentFile();
        }
    }

    pause() {
        this.isPlaying = false;
        this.playPauseBtn.textContent = '▶ Play';
        
        this.stopCurrentPlayback();
    }

    stopCurrentPlayback() {
        if (this.imageTimer) {
            clearTimeout(this.imageTimer);
            this.imageTimer = null;
        }
        
        this.videoPlayer.pause();
        this.videoPlayer.style.display = 'none';
        this.imagePlayer.style.display = 'none';
    }

    nextFile() {
        if (this.mediaFiles.length === 0) return;

        this.stopCurrentPlayback();

        // Show loading state briefly to prevent flash
        this.showLoadingState();

        setTimeout(() => {
            let nextFile;
            
            if (this.isShuffle) {
                nextFile = this.getRandomFile();
            } else {
                this.currentIndex = (this.currentIndex + 1) % this.mediaFiles.length;
                nextFile = this.mediaFiles[this.currentIndex];
            }

            if (nextFile) {
                this.currentFile = nextFile;
                this.playCurrentFile();
            }
        }, 50); // Very brief delay to ensure clean transition
    }

    showLoadingState() {
        // Hide both media elements
        this.videoPlayer.style.display = 'none';
        this.imagePlayer.style.display = 'none';
        
        // Optionally show a loading message
        //this.currentFileInfo.textContent = "";
    }

    playCurrentFile() {
        if (!this.currentFile) return;

        const fileUrl = `/uploads/${encodeURIComponent(this.currentFile.name)}`;
        this.currentFileInfo.textContent = `${this.currentFile.name} ${this.currentFile.isWanted ? '⭐' : ''}`;

        this.showCurrentMedia();

        if (this.currentFile.type === 'video') {
            this.playVideo(fileUrl);
        } else {
            this.showImage(fileUrl);
        }
    }

    playVideo(url) {
        this.videoPlayer.src = url;
        this.videoPlayer.play().catch(error => {
            console.error('Error playing video:', error);
            this.nextFile();
        });
    }

    showImage(url) {
        this.imagePlayer.src = url;
        this.imageTimer = setTimeout(() => {
            this.nextFile();
        }, this.imageDisplayTime * 1000);
    }

    getRandomFile() {
        let availableFiles = this.mediaFiles;
        
        // If we need to avoid consecutive wanted files
        if (this.avoidConsecutiveWanted && this.lastWasWanted && this.mediaFiles.length > 1) {
            availableFiles = this.mediaFiles.filter(file => !file.isWanted);
            
            // If no non-wanted files available, use all files
            if (availableFiles.length === 0) {
                availableFiles = this.mediaFiles;
            }
        }

        const randomIndex = Math.floor(Math.random() * availableFiles.length);
        const selectedFile = availableFiles[randomIndex];
        
        // Update lastWasWanted for next selection
        this.lastWasWanted = selectedFile.isWanted;
        
        return selectedFile;
    }

    playCurrentFile() {
        if (!this.currentFile) return;

        const fileUrl = `/uploads/${encodeURIComponent(this.currentFile.name)}`;
        this.currentFileInfo.textContent = `${this.currentFile.name} ${this.currentFile.isWanted ? '⭐' : ''}`;

        // Reset display first
        this.videoPlayer.style.display = 'none';
        this.imagePlayer.style.display = 'none';

        if (this.currentFile.type === 'video') {
            this.playVideo(fileUrl);
        } else {
            this.showImage(fileUrl);
        }
    }

    playVideo(url) {
        console.log('Playing video:', url);
        this.videoPlayer.src = url;
        this.videoPlayer.style.display = 'block';
        this.imagePlayer.style.display = 'none';
        
        this.videoPlayer.play().catch(error => {
            console.error('Error playing video:', error);
            this.nextFile();
        });
    }

    showImage(url) {
        console.log('Showing image:', url);
        this.videoPlayer.style.display = 'none';
        this.imagePlayer.style.display = 'block';
        this.imagePlayer.src = url;

        this.imageTimer = setTimeout(() => {
            this.nextFile();
        }, this.imageDisplayTime * 1000);
    }
}

// Initialize the media player when the page loads
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing MediaPlayer...');
    window.mediaPlayer = new MediaPlayer();
});