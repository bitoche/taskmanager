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
        self.last_loaded_hash: str | None = None
        self._update_loaded_hash()
    
    def _update_loaded_hash(self):
        """Обновляет хэш загруженного локального файла."""
        if self.file and Path(self.file).exists():
            self.last_loaded_hash = self.get_file_hash(self.file)
        else:
            self.last_loaded_hash = None
    
    def get_file_hash(self, file_path, algorithm='sha256'):
        h = hashlib.new(algorithm)
        with open(file_path, 'rb') as f:
            while chunk := f.read(4096):
                h.update(chunk)
        return h.hexdigest()
    
    def _get_remote_hash(self):
        """Получает хэш удалённого файла из метаданных."""
        try:
            meta = self.interface.get_meta(str(self.remote_filepath))
            return getattr(meta, 'sha256', None)
        except Exception as e:
            print(f'Error getting remote file hash: {e}')
            return None
    
    def _get_remote_modified_time(self):
        """Получает время изменения удалённого файла в виде timestamp."""
        from datetime import datetime
        try:
            meta = self.interface.get_meta(str(self.remote_filepath))
            modified = getattr(meta, 'modified', None)
            if modified is None:
                return None
            if isinstance(modified, str):
                return datetime.fromisoformat(modified.replace('Z', '+00:00')).timestamp()
            elif isinstance(modified, datetime):
                return modified.timestamp()
            return None
        except Exception as e:
            print(f'Error getting remote modified time: {e}')
            return None
    
    def _get_local_modified_time(self):
        """Получает время изменения локального файла в виде timestamp."""
        try:
            if self.file and Path(self.file).exists():
                return Path(self.file).stat().st_mtime
            return None
        except Exception as e:
            print(f'Error getting local modified time: {e}')
            return None
    
    def is_remote_equals_local_file(self):
        """Сравнивает хэш локального файла с хэшем удалённого."""
        local_hash = self.get_file_hash(self.file) if Path(self.file).exists() else None
        remote_hash = self._get_remote_hash()
        
        if local_hash is None or remote_hash is None:
            return False
        return local_hash == remote_hash
    
    def has_remote_updates(self):
        """
        Проверяет, есть ли обновления в облаке (удалённый файл новее локального).
        
        Возвращает:
            True - если удалённая версия новее
            False - если локальная версия такая же или новее
            None - если не удалось проверить
        """
        remote_hash = self._get_remote_hash()
        local_hash = self.get_file_hash(self.file) if Path(self.file).exists() else None
        
        print(f'[has_remote_updates] local_hash={local_hash}, remote_hash={remote_hash}')
        
        # Если хэши совпадают - обновлений нет
        if remote_hash and local_hash and remote_hash == local_hash:
            print('[has_remote_updates] hashes match, no updates')
            return False
        
        # Если хэши не совпадают, проверяем время модификации
        remote_modified = self._get_remote_modified_time()
        local_modified = self._get_local_modified_time()
        
        if remote_modified is None or local_modified is None:
            print(f'[has_remote_updates] Cannot compare times')
            return None
        
        # Удалённый файл новее только если его время модификации больше
        is_remote_newer = remote_modified > local_modified
        print(f'[has_remote_updates] is_remote_newer={is_remote_newer}')
        return is_remote_newer
    def upload_file(self):
        if self.interface is None:
            return 'skipped'
        current_hash = self.get_file_hash(file_path=self.file)
        # if self.last_loaded_hash is not None and self.last_loaded_hash == current_hash:
            # return 'hashed'
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
        
        self._update_loaded_hash()
        return status
    
def get_remote_files_handler() -> RemoteFilesHandler:
    if saved_remote_files_handler is None:
        return RemoteFilesHandler()
    else: return saved_remote_files_handler