from sqlalchemy import create_engine, Column, Integer, String, DateTime, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
import json
from datetime import datetime, timedelta

Base = declarative_base()

class StorageStatsDB(Base):
    __tablename__ = 'storage_stats'
    
    id = Column(Integer, primary_key=True)
    timestamp = Column(DateTime, nullable=False)
    total_size = Column(Integer, nullable=False)
    file_types = Column(JSON)
    folders = Column(JSON)

class Database:
    def __init__(self):
        self.engine = create_engine('sqlite:///config/storage_monitor.db')
        self.SessionLocal = sessionmaker(bind=self.engine)
        
    async def initialize(self):
        Base.metadata.create_all(self.engine)
        
    async def store_stats(self, stats):
        session = self.SessionLocal()
        db_stats = StorageStatsDB(
            timestamp=stats.timestamp,
            total_size=stats.total_size,
            file_types=stats.file_types,
            folders=stats.folders
        )
        session.add(db_stats)
        session.commit()
        session.close()
        
    async def get_latest_stats(self):
        session = self.SessionLocal()
        stats = session.query(StorageStatsDB).order_by(StorageStatsDB.timestamp.desc()).first()
        session.close()
        return stats
        
    async def get_history(self, timeframe):
        session = self.SessionLocal()
        if timeframe == "day":
            start_date = datetime.now() - timedelta(days=1)
        elif timeframe == "week":
            start_date = datetime.now() - timedelta(weeks=1)
        elif timeframe == "month":
            start_date = datetime.now() - timedelta(days=30)
        elif timeframe == "year":
            start_date = datetime.now() - timedelta(days=365)
        
        stats = session.query(StorageStatsDB)\
            .filter(StorageStatsDB.timestamp >= start_date)\
            .order_by(StorageStatsDB.timestamp.asc())\
            .all()
        session.close()
        return stats