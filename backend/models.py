from pydantic import BaseModel
from datetime import datetime
from typing import Dict, List

class StorageStats(BaseModel):
    timestamp: datetime
    total_size: int
    file_types: Dict[str, int]
    folders: List[dict]