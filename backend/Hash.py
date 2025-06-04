import requests

def get_latest_bitcoin_hash():
    try:
        # Запрашиваем информацию о последнем блоке с публичного API
        response = requests.get('https://blockchain.info/latestblock')
        response.raise_for_status()
        block_data = response.json()
        
        # Извлекаем хеш последнего блока
        latest_hash = block_data['hash']
        return latest_hash
    except requests.RequestException as e:
        return f"Ошибка при получении данных: {e}"

if __name__ == "__main__":
    latest_hash = get_latest_bitcoin_hash()
    print(f"Последний успешный хеш: {latest_hash}")