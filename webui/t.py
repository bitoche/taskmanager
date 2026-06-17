import os
from pathlib import Path

IGNORE_MATCHES = [
    "__pycache__",
    "log",
    "tasks.db",
    "node_modules",
    "package.lock"
]

def print_text_files_relative(start_dir, encodings=('utf-8', 'cp1251', 'latin-1')):
    """
    Рекурсивно обходит start_dir.
    Для каждого файла пытается прочитать его как текст с одной из encodings.
    Если успешно — выводит относительный путь и содержимое.
    Бинарные и нечитаемые файлы игнорируются.
    """
    start_dir = os.path.abspath(start_dir)  # нормализуем путь
    for root, dirs, files in os.walk(start_dir):
        for file in files:
            full_path = os.path.join(root, file)
            if any([m in full_path for m in IGNORE_MATCHES]):
                continue
            rel_path = os.path.relpath(full_path, start_dir)
            # Пытаемся открыть файл в текстовом режиме
            for enc in encodings:
                try:
                    with open(full_path, 'r', encoding=enc) as f:
                        content = f.read()
                    # Если дошли сюда — файл успешно прочитан как текст
                    print(f"\n--- {rel_path} ---\n")
                    print(content)
                    break  # выходим из цикла кодировок, файл обработан
                except (UnicodeDecodeError, IOError, OSError):
                    continue  # пробуем следующую кодировку
            # Если ни одна кодировка не подошла — файл считается бинарным, ничего не выводим

if __name__ == '__main__':
    # Пример использования: текущая директория
    print_text_files_relative(Path.cwd())