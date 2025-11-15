from flask import Flask, render_template, request, redirect, url_for, flash, session, jsonify
import database
import os
from werkzeug.utils import secure_filename
import sqlite3
from datetime import datetime
from flask import send_from_directory

app = Flask(__name__)
app.secret_key = 'your-secret-key-change-in-production'
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['MAX_CONTENT_LENGTH'] = 2* 1024 * 1024 * 1024  # 2gb max file size

# Create uploads folder if it doesn't exist
if not os.path.exists(app.config['UPLOAD_FOLDER']):
    os.makedirs(app.config['UPLOAD_FOLDER'])

# Initialize database
with app.app_context():
    database.init_db()

# Routes
@app.route('/')
def index():
    """Home page"""
    return render_template('index.html')

@app.route('/file-manager')
def file_manager():
    """File Manager page"""
    return render_template('file_manager.html')

def process_uploaded_item(item_path, relative_path, parent_folder="Root"):
    """Recursively process uploaded files and folders"""
    items_processed = []
    
    if os.path.isdir(item_path):
        # It's a folder - create folder record
        folder_name = secure_filename(os.path.basename(item_path))
        
        # Insert folder into database
        conn = database.get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT INTO root (name, parentFolder, toDisplay, selected, displayed, isFile)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (folder_name, parent_folder, 1, 1, 0, 0))
        
        folder_id = cursor.lastrowid
        conn.commit()
        conn.close()
        
        items_processed.append({
            'id': folder_id,
            'name': folder_name,
            'type': 'folder',
            'parentFolder': parent_folder,
            'isFile': False
        })
        
        # Process contents of the folder
        for item in os.listdir(item_path):
            item_full_path = os.path.join(item_path, item)
            new_relative_path = os.path.join(relative_path, item)
            items_processed.extend(process_uploaded_item(item_full_path, new_relative_path, folder_name))
            
    else:
        # It's a file - create file record
        if allowed_file(item_path):
            filename = secure_filename(os.path.basename(item_path))
            
            # Ensure unique filename in the upload folder
            base_name, extension = os.path.splitext(filename)
            counter = 1
            final_filename = filename
            final_path = os.path.join(app.config['UPLOAD_FOLDER'], final_filename)
            
            while os.path.exists(final_path):
                final_filename = f"{base_name}_{counter}{extension}"
                final_path = os.path.join(app.config['UPLOAD_FOLDER'], final_filename)
                counter += 1
            
            # Copy file to uploads folder (maintaining folder structure would be more complex)
            # For simplicity, we're putting all files in the main uploads folder
            import shutil
            shutil.copy2(item_path, final_path)
            
            # Get file size
            file_size = os.path.getsize(final_path)
            
            # Insert into database
            conn = database.get_db_connection()
            cursor = conn.cursor()
            
            cursor.execute('''
                INSERT INTO root (name, parentFolder, toDisplay, selected, displayed, isFile)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (final_filename, parent_folder, 0, 0, 0, 1))
            
            file_id = cursor.lastrowid
            conn.commit()
            conn.close()
            
            items_processed.append({
                'id': file_id,
                'name': final_filename,
                'path': final_path,
                'size': file_size,
                'type': 'image' if final_filename.lower().endswith(('.png', '.jpg', '.jpeg', '.gif', '.bmp')) else 'video',
                'parentFolder': parent_folder,
                'isFile': True
            })
    
    return items_processed

@app.route('/upload-files', methods=['POST'])
def upload_files():
    """Handle file and folder uploads"""
    try:
        if 'files[]' not in request.files:
            return jsonify({'error': 'No files selected'}), 400
        
        files = request.files.getlist('files[]')
        uploaded_items = []
        
        for file in files:
            if file.filename == '':
                continue
            
            # Check if this is a folder upload (webkitdirectory creates empty files with folder paths)
            if hasattr(file, 'filename') and file.filename:
                # For regular file uploads
                if file and allowed_file(file.filename):
                    filename = secure_filename(file.filename)
                    isWanted = filename.split('-', 2)
                    if len(isWanted) >= 3 and isWanted[1] == "Wanted":
                        isWanted = 1
                    else:
                        isWanted = 0
                    # Ensure unique filename
                    base_name, extension = os.path.splitext(filename)
                    counter = 1
                    while os.path.exists(os.path.join(app.config['UPLOAD_FOLDER'], filename)):
                        filename = f"{base_name}_{counter}{extension}"
                        counter += 1
                    
                    # Save file
                    file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
                    file.save(file_path)
                    
                    # Get file size
                    file_size = os.path.getsize(file_path)
                    
                    # Insert into database
                    conn = database.get_db_connection()
                    cursor = conn.cursor()
                    
                    cursor.execute('''
                        INSERT INTO root (name, parentFolder, toDisplay, selected, displayed, isFile, isWanted)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                    ''', (filename, "Root", 1, 1, 0, 1, isWanted))
                    
                    file_id = cursor.lastrowid
                    conn.commit()
                    conn.close()
                    
                    uploaded_items.append({
                        'id': file_id,
                        'name': filename,
                        'path': file_path,
                        'size': file_size,
                        'type': 'image' if filename.lower().endswith(('.png', '.jpg', '.jpeg', '.gif', '.bmp')) else 'video',
                        'parentFolder': "Root",
                        'isFile': True
                    })
        
        return jsonify({
            'message': f'Successfully uploaded {len(uploaded_items)} items',
            'files': uploaded_items
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/upload-folder', methods=['POST'])
def upload_folder():
    """Handle folder uploads specifically"""
    try:
        if 'folder' not in request.files:
            return jsonify({'error': 'No folder selected'}), 400
        
        folder = request.files['folder']
        
        # For folder uploads, we need to handle the directory structure
        # This is a simplified approach - in a real scenario, you'd need to handle
        # the folder upload properly with JavaScript File System Access API
        
        # Create a temporary directory to extract the folder structure
        temp_dir = os.path.join(app.config['UPLOAD_FOLDER'], 'temp_upload')
        if not os.path.exists(temp_dir):
            os.makedirs(temp_dir)
        
        # This is a placeholder - actual folder upload implementation
        # would require more complex handling with modern browsers
        uploaded_items = []
        
        return jsonify({
            'message': 'Folder upload would be processed here',
            'items': uploaded_items
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/get-files')
def get_files():
    """Get all files and folders from database"""
    try:
        conn = database.get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('SELECT * FROM root ORDER BY isFile DESC, id DESC')
        items = cursor.fetchall()
        conn.close()
        
        items_list = []
        for item in items:
            # Better file type detection
            filename = item['name'].lower()
            if filename.endswith(('.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp')):
                file_type = 'image'
            elif filename.endswith(('.mp4', '.avi', '.mov', '.mkv', '.webm', '.flv', '.wmv')):
                file_type = 'video'
            else:
                file_type = 'unknown'
            
            item_data = {
                'id': item['id'],
                'name': item['name'],
                'parentFolder': item['parentFolder'],
                'toDisplay': bool(item['toDisplay']),
                'selected': bool(item['selected']),
                'displayed': bool(item['displayed']),
                'isFile': bool(item['isFile']),
                'isWanted': bool(item['isWanted']),
                'type': 'folder' if not item['isFile'] else file_type
            }
            items_list.append(item_data)
        
        return jsonify({'items': items_list})
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def allowed_file(filename):
    """Check if file extension is allowed"""
    allowed_extensions = {'png', 'jpg', 'jpeg', 'gif', 'bmp', 'mp4', 'avi', 'mov', 'mkv', 'webm'}
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in allowed_extensions

@app.route('/viewer')
def viewer():
    """Viewer page"""
    return render_template('viewer.html')

@app.route('/delete-file/<int:file_id>', methods=['DELETE'])
def delete_file(file_id):
    """Delete a file and its database record"""
    try:
        conn = database.get_db_connection()
        cursor = conn.cursor()
        
        # Get file info
        cursor.execute('SELECT name, parentFolder FROM root WHERE id = ?', (file_id,))
        file = cursor.fetchone()
        
        if file:
            # Delete file from filesystem
            file_path = os.path.join(file['parentFolder'], file['name'])
            if os.path.exists(file_path):
                os.remove(file_path)
            
            # Delete from database
            cursor.execute('DELETE FROM root WHERE id = ?', (file_id,))
            conn.commit()
            conn.close()
            
            return jsonify({'message': 'File deleted successfully'})
        else:
            conn.close()
            return jsonify({'error': 'File not found'}), 404
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/uploads/<filename>')
def serve_file(filename):
    """Serve uploaded files from the uploads folder"""
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

@app.route('/debug-db')
def debug_db():
    """Debug endpoint to check database contents"""
    try:
        conn = database.get_db_connection()
        cursor = conn.cursor()
        
        # Get all records
        cursor.execute('SELECT * FROM root')
        items = cursor.fetchall()
        
        # Get column names
        cursor.execute('PRAGMA table_info(root)')
        columns = [column[1] for column in cursor.fetchall()]
        
        conn.close()
        
        items_list = []
        for item in items:
            item_dict = {}
            for i, col in enumerate(columns):
                item_dict[col] = item[i]
            items_list.append(item_dict)
        
        return jsonify({
            'columns': columns,
            'total_items': len(items_list),
            'files_count': len([i for i in items_list if i.get('isFile')]),
            'folders_count': len([i for i in items_list if not i.get('isFile')]),
            'items': items_list
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)
  
