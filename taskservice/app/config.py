from dataclasses import dataclass

@dataclass
class TaskServiceConfig:
    DB_PATH = '/app/tasks.db'
    
config = TaskServiceConfig()