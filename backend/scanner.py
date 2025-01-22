from apscheduler.schedulers.asyncio import AsyncIOScheduler
from datetime import datetime
import os
import logging
from database import Database
from models import StorageStats

class StorageScanner:
    def __init__(self):
        self.scheduler = AsyncIOScheduler()
        self.db = Database()
        self.last_scan = None
        
    def start(self):
        # Schedule daily scan at 2 AM
        self.scheduler.add_job(self.scan_storage, 'cron', hour=2)
        self.scheduler.start()
        
    async def scan_storage(self):
        try:
            self.last_scan = datetime.now()
            stats = await self._scan_directory('/data')
            await self.db.store_stats(stats)
        except Exception as e:
            logging.error(f"Scan failed: {str(e)}")
            
    async def _scan_directory(self, path):
        total_size = 0
        file_types = {}
        folders = []

        for root, dirs, files in os.walk(path):
            folder_size = 0
            for file in files:
                file_path = os.path.join(root, file)
                try:
                    size = os.path.getsize(file_path)
                    folder_size += size
                    total_size += size
                    
                    # Track file types
                    ext = os.path.splitext(file)[1].lower()
                    if ext:
                        file_types[ext] = file_types.get(ext, 0) + size
                except OSError:
                    continue
            
            # Store folder statistics
            if folder_size > 0:
                folders.append({
                    "path": os.path.relpath(root, path),
                    "size": folder_size,
                    "items": len(files)
                })

        return StorageStats(
            timestamp=self.last_scan,
            total_size=total_size,
            file_types=file_types,
            folders=folders
        )