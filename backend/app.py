from fastapi import FastAPI, BackgroundTasks
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
import uvicorn
import json
import os
from scanner import StorageScanner
from database import Database
from models import StorageStats

app = FastAPI()
scanner = StorageScanner()
db = Database()

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files (React frontend)
app.mount("/", StaticFiles(directory="static", html=True), name="static")

@app.on_event("startup")
async def startup_event():
    await db.initialize()
    scanner.start()

@app.post("/api/scan")
async def trigger_scan(background_tasks: BackgroundTasks):
    background_tasks.add_task(scanner.scan_storage)
    return {"status": "Scan started"}

@app.get("/api/stats")
async def get_stats():
    stats = await db.get_latest_stats()
    return stats

@app.get("/api/history")
async def get_history(timeframe: str = "week"):
    history = await db.get_history(timeframe)
    return history

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8080)