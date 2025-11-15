document.addEventListener('DOMContentLoaded', function() {
    const fileInput = document.getElementById('fileInput');
    const folderInput = document.getElementById('folderInput');
    const filesList = document.getElementById('filesList');

    // Handle file upload option click
    document.querySelector('[for="fileInput"]').addEventListener('click', function(e) {
        e.preventDefault();
        fileInput.click();
    });

    // Handle folder upload option click
    document.querySelector('[for="folderInput"]').addEventListener('click', function(e) {
        e.preventDefault();
        folderInput.click();
    });

    // File input change
    fileInput.addEventListener('change', function(e) {
        handleFiles(e.target.files, false);
        fileInput.value = '';
    });

    // Folder input change
    folderInput.addEventListener('change', function(e) {
        const files = e.target.files;
        if (files.length > 0) {
            const hasFolderStructure = Array.from(files).some(file => 
                file.webkitRelativePath && file.webkitRelativePath.includes('/')
            );
            
            handleFiles(files, hasFolderStructure);
        }
        folderInput.value = '';
    });

    // Handle selected files/folders
    function handleFiles(files, isFolder = false) {
        let validFiles;
        
        if (isFolder) {
            // For folders, only include image and video files
            validFiles = Array.from(files).filter(file => 
                file.type.startsWith('image/') || file.type.startsWith('video/')
            );
            
            if (validFiles.length === 0) {
                alert('No image or video files found in the selected folder.');
                return;
            }
        } else {
            // For individual file selection, filter strictly
            validFiles = Array.from(files).filter(file => 
                file.type.startsWith('image/') || file.type.startsWith('video/')
            );

            if (validFiles.length === 0) {
                alert('Please select only image or video files.');
                return;
            }
        }

        // Upload files to server
        uploadFilesToServer(validFiles, isFolder);
    }

    // Upload files to server
    function uploadFilesToServer(files, isFolder = false) {
        const formData = new FormData();
        
        files.forEach(file => {
            formData.append('files[]', file);
        });

        if (isFolder) {
            formData.append('is_folder', 'true');
        }

        // Show loading state
        filesList.innerHTML = '<p class="no-files">Uploading items...</p>';

        fetch('/upload-files', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                alert('Error uploading items: ' + data.error);
                loadItemsFromServer();
                return;
            }

            alert(data.message);
            loadItemsFromServer(); // Refresh the items list
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Error uploading items');
            loadItemsFromServer();
        });
    }

    // Load items from server
    function loadItemsFromServer() {
        fetch('/get-files')
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    console.error('Error loading items:', data.error);
                    return;
                }
                displayItemsFromServer(data.items);
            })
            .catch(error => {
                console.error('Error loading items:', error);
            });
    }

    // Display items from server
    function displayItemsFromServer(items) {
        if (items.length === 0) {
            filesList.innerHTML = '<p class="no-files">No files or folders uploaded yet</p>';
            return;
        }

        filesList.innerHTML = items.map(item => `
            <div class="file-item ${item.isFile ? (item.type === 'video' ? 'file-video' : 'file-image') : 'file-folder'}">
                <div class="file-icon">
                    ${item.isFile ? (item.type === 'video' ? '🎥' : '🖼️') : '📁'}
                </div>
                <div class="file-info">
                    <div class="file-name">${item.name}</div>
                    <div class="file-meta">
                        <span class="file-type">${item.isFile ? 'File' : 'Folder'}</span>
                        ${item.parentFolder && item.parentFolder !== 'Root' ? 
                            `<span class="parent-folder">In: ${item.parentFolder}</span>` : ''}
                    </div>
                    <div class="file-status">
                        ${item.toDisplay ? '📱 To Display' : ''} 
                        ${item.selected ? '✅ Selected' : ''} 
                        ${item.displayed ? '👁️ Displayed' : ''}
                    </div>
                </div>
                <div class="file-actions">
                    <button class="remove-btn" onclick="deleteItem(${item.id}, ${item.isFile})">Delete</button>
                </div>
            </div>
        `).join('');
    }

    // Delete item
    window.deleteItem = function(itemId, isFile) {
        const itemType = isFile ? 'file' : 'folder';
        if (confirm(`Are you sure you want to delete this ${itemType}?`)) {
            fetch(`/delete-file/${itemId}`, {
                method: 'DELETE'
            })
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    alert('Error deleting item: ' + data.error);
                    return;
                }
                alert(data.message);
                loadItemsFromServer();
            })
            .catch(error => {
                console.error('Error:', error);
                alert('Error deleting item');
            });
        }
    };

    // Load items when page loads
    loadItemsFromServer();
});