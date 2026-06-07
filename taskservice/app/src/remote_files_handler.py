from ..config import config
from pathlib import Path
import yadisk
import shutil
import hashlib

saved_remote_files_handler = None

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
    
    def is_remote_equals_local_file(self):
        meta = self.interface.get_meta(str(self.remote_filepath))
        remote_sha256 = getattr(meta, 'sha256', None)
        return self.last_loaded_hash == remote_sha256 
    
    def get_remote_modified_time(self):
        """Получает время изменения удалённого файла."""
        try:
            meta = self.interface.get_meta(str(self.remote_filepath))
            return getattr(meta, 'modified', None)
        except Exception as e:
            print(f'Error getting remote file meta: {e}')
            return None
    
    def get_local_modified_time(self):
        """Получает время изменения локального файла."""
        try:
            if self.file and Path(self.file).exists():
                return Path(self.file).stat().st_mtime
            return None
        except Exception as e:
            print(f'Error getting local file meta: {e}')
            return None
    
    def compare_file_versions(self):
        """
        Сравнивает версии локального и удалённого файлов по времени изменения.
        
        Возвращает:
            'remote_newer' - удалённая версия новее
            'local_newer' - локальная версия новее
            'equal' - файлы одинаковые (по времени)
            'error' - ошибка при сравнении
        """
        from datetime import datetime
        
        remote_modified = self.get_remote_modified_time()
        local_modified = self.get_local_modified_time()
        
        if remote_modified is None or local_modified is None:
            print(f'Cannot compare: remote_modified={remote_modified}, local_modified={local_modified}')
            return 'error'
        
        # Конвертируем remote_modified в timestamp
        try:
            if isinstance(remote_modified, str):
                remote_modified = datetime.fromisoformat(remote_modified.replace('Z', '+00:00')).timestamp()
            elif isinstance(remote_modified, datetime):
                remote_modified = remote_modified.timestamp()
        except Exception as e:
            print(f'Error parsing remote_modified: {e}')
            return 'error'
        
        if remote_modified > local_modified:
            return 'remote_newer'
        elif local_modified > remote_modified:
            return 'local_newer'
        else:
            return 'equal'
    
    def upload_file(self):
        if self.interface is None:
            return 'skipped'
        current_hash = self.get_file_hash(file_path=self.file)
        # if self.last_loaded_hash is not None and self.last_loaded_hash == current_hash:
        #     return 'hashed'
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
    
def get_remote_files_handler() -> RemoteFilesHandler:
    if saved_remote_files_handler is None:
        return RemoteFilesHandler()
    else: return saved_remote_files_handler