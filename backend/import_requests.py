import requests
import time
import os
from pathlib import Path
from datetime import datetime, timedelta

# Указываем путь к файлу
FILENAME = Path(__file__).parent.parent / "Txt" / "hashes.txt"

def load_existing_hashes():
    """Загружаем уже записанные хеши из файла."""
    if not os.path.exists(FILENAME):
        return set()
    with open(FILENAME, "r") as f:
        return set(line.strip() for line in f)

def fetch_blocks(existing_hashes):
    """Получаем новые хеши и дозаписываем их в начало файла."""
    new_hashes = []
    
    for i in range(1000):  # Запрашиваем хеши за последние 1000 дней
        date = (datetime.now() - timedelta(days=i+1)).strftime('%Y-%m-%d')
        print(f"Search Запрос {i+1}/1000: дата {date}")
        
        offset = 0
        while True:
            api_url = f'https://api.blockchair.com/bitcoin/blocks?q=time({date})&fields=hash&limit=100&offset={offset}'
            response = requests.get(api_url)
            
            if response.status_code == 200:
                data = response.json().get('data', [])
                if not data:
                    break  # Если данных больше нет, выходим
                
                for block in data:
                    hash_value = block['hash']
                    if hash_value in existing_hashes:
                        print(f"Stop Остановлено: хеш {hash_value} уже есть в файле.")
                        return new_hashes
                    new_hashes.append(hash_value)
                
                offset += 100
                time.sleep(1)  # Чтобы снизить нагрузку на API
            else:
                print(f"⚠️ Ошибка {response.status_code}, повтор запроса через 10 секунд...")
                time.sleep(10)
    
    return new_hashes

# Загружаем уже записанные хеши
existing_hashes = load_existing_hashes()

# Получаем новые хеши
new_hashes = fetch_blocks(existing_hashes)

# Проверяем, есть ли новые хеши
if new_hashes:
    try:
        with open(FILENAME, "r+") as f:
            old_data = f.read()
            f.seek(0)  # Перемещаем курсор в начало файла
            f.writelines(f"{h}\n" for h in new_hashes)  # Записываем новые хеши
            f.write(old_data)  # Восстанавливаем старые данные
        print(f"✅ Файл {FILENAME} обновлен. Добавлено {len(new_hashes)} новых хешей.")
    except Exception as e:
        print(f"❌ Ошибка при записи файла: {e}")
else:
    print("⚠️ Новых хешей не найдено. Файл не изменен.")
