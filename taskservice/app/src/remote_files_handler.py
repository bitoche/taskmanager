from ..config import config
from pathlib import Path
import yadisk
import shutil
import hashlib


class RemoteFilesHandler:
    def __init__(self):
        self.interface = yadisk.YaDisk(token=config.REMOTE_STORAGE_TOKEN) if config.REMOTE_STORAGE_TOKEN is not None and isinstance(config.REMOTE_STORAGE_TOKEN, str) else None
        self.remote_filepath = Path('/taskservice/tech/tasks.db')
        self.file = config.DB_PATH
        self.last_loaded_hash: str = None
    
    def get_file_hash(self, file_path, algorithm='sha256'):
        h = hashlib.new(algorithm)
        with open(file_path, 'rb') as f:
            while chunk := f.read(4096):
                h.update(chunk)
        return h.hexdigest()
        
    
    def upload_file(self):
        if self.interface is None:
            return 'skipped'
        current_hash = self.get_file_hash(file_path=self.file)
        if self.last_loaded_hash is not None and self.last_loaded_hash == current_hash:
            return 'hashed'
        try:
            self.interface.upload(self.file, str(self.remote_filepath), overwrite=True)
            status = '200'
        except yadisk.exceptions.PathNotFoundError as e:
            print(f'404: Не удалось найти файл базы данных на удаленном ресурсе: {e}')
            status = '404'
        except yadisk.exceptions.ParentNotFoundError as e:
            print(f'409: Не удалось найти указанную директорию на удаленном ресурсе: {e}')
            status = '409'
        self.last_loaded_hash = current_hash
        return status
    
    def download_file(self):
        if self.interface is None:
            return 'skipped'
        
        temp_file = self.file + ".tmp"
        try:
            self.interface.download(str(self.remote_filepath), temp_file)
            status = '200'
        except yadisk.exceptions.PathNotFoundError as e:
            print(f'404: Не удалось найти файл базы данных: {e}')
            return '404'
        except Exception as e:
            print(f'Ошибка скачивания: {e}')
            return 'error'
        
        p = Path(self.file)
        p.unlink(missing_ok=True)
        shutil.move(temp_file, self.file)
        
        return status