from dataclasses import dataclass
from os import getenv
from dotenv import load_dotenv

@dataclass
class TaskServiceConfig:
    load_dotenv('/app/.env')
    DB_PATH = '/app/tasks.db'
    REMOTE_STORAGE_TOKEN = getenv('REMOTE_STORAGE_TOKEN')
    
config = TaskServiceConfig()